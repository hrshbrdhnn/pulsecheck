import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import get_db, init_db, Monitor, Heartbeat, MonitorTlsInfo, ErrorTable, Notification, AppConfig
from .scheduler import (
    start_all_monitoring,
    start_monitor,
    stop_monitor,
    fetch_tls_once_if_needed,
    tls_fetcher_loop,
    check_monitor_once,
)

# Determine path for served static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../dist"))

app = FastAPI(title="API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas for request validation
class MonitorCreate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    url: Optional[str] = None
    interval: int = 20
    timeout: int = 16
    maxretries: int = 0
    method: str = "GET"
    accepted_statuscodes_json: str = '["200-299"]'
    httpBodyEncoding: str = "json"
    body: Optional[str] = None
    headers: Optional[str] = None
    active: bool = True
    port: Optional[int] = None
    keyword: Optional[str] = None
    email_on_down: Optional[bool] = False
    down_emails: Optional[str] = None
    ssl_expiry_alert_days: Optional[int] = None
    ssl_expiry_alert_interval_days: Optional[int] = None
    ssl_expiry_emails: Optional[str] = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: dict):
        payload = json.dumps({"type": event_type, "data": data})
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                # Clean up stale connections gracefully
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection and listen for any messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# API routes
@app.get("/api/monitors")
def get_monitors(db: Session = Depends(get_db)):
    monitors = db.query(Monitor).all()
    monitors_list = []
    for m in monitors:
        monitors_list.append({
            "id": m.id,
            "name": m.name,
            "type": m.type,
            "url": m.url,
            "interval": m.interval,
            "timeout": m.timeout,
            "maxretries": m.maxretries,
            "method": m.method,
            "accepted_statuscodes_json": m.accepted_statuscodes_json,
            "httpBodyEncoding": m.httpBodyEncoding,
            "body": m.body,
            "headers": m.headers,
            "active": m.active,
            "created_date": m.created_date.isoformat() if m.created_date else None,
            "port": m.port,
            "keyword": m.keyword,
            "email_on_down": m.email_on_down,
            "down_emails": m.down_emails,
            "ssl_expiry_alert_days": m.ssl_expiry_alert_days,
            "ssl_expiry_alert_interval_days": m.ssl_expiry_alert_interval_days,
            "ssl_expiry_emails": m.ssl_expiry_emails
        })
    return {"monitors": monitors_list}

@app.get("/api/monitors/{monitor_id}")
def get_monitor(monitor_id: int, db: Session = Depends(get_db)):
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
        
    tls_info = None
    if monitor.type in ('http', 'keyword', 'ssl'):
        tls_info = db.query(MonitorTlsInfo).filter(MonitorTlsInfo.monitor_id == monitor_id).first()
        
    dns_trace = None
    if monitor.type == 'dns':
        from .dns_resolver import generate_dns_trace_info
        domain = monitor.url.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        try:
            dns_trace = generate_dns_trace_info(domain)
        except Exception as e:
            print(f"Failed to generate DNS trace info: {e}")
    
    monitor_dict = {
        "id": monitor.id,
        "name": monitor.name,
        "type": monitor.type,
        "url": monitor.url,
        "interval": monitor.interval,
        "timeout": monitor.timeout,
        "maxretries": monitor.maxretries,
        "method": monitor.method,
        "accepted_statuscodes_json": monitor.accepted_statuscodes_json,
        "httpBodyEncoding": monitor.httpBodyEncoding,
        "body": monitor.body,
        "headers": monitor.headers,
        "active": monitor.active,
        "created_date": monitor.created_date.isoformat() if monitor.created_date else None,
        "port": monitor.port,
        "keyword": monitor.keyword,
        "email_on_down": monitor.email_on_down,
        "down_emails": monitor.down_emails,
        "ssl_expiry_alert_days": monitor.ssl_expiry_alert_days,
        "ssl_expiry_alert_interval_days": monitor.ssl_expiry_alert_interval_days,
        "ssl_expiry_emails": monitor.ssl_expiry_emails,
        "dnsTraceInfo": dns_trace
    }
    
    tls_dict = {
        "id": tls_info.id,
        "monitor_id": tls_info.monitor_id,
        "info_json": tls_info.info_json,
        "timestamp": tls_info.timestamp.isoformat() if tls_info and tls_info.timestamp else None
    } if tls_info else None
    
    return {"monitor": monitor_dict, "monitorCertificate": tls_dict}

def validate_and_sanitize_monitor(monitor_data: MonitorCreate, payload_dict: dict):
    m_type = (monitor_data.type or 'http').lower().strip()
    
    # Identify keys explicitly sent by the user in the HTTP request payload
    sent_keys = {k for k, v in payload_dict.items() if v is not None}
    
    if m_type == 'http':
        # Unrelated: port, keyword
        unrelated = {'port', 'keyword'}
        explicitly_sent_unrelated = unrelated.intersection(sent_keys)
        if explicitly_sent_unrelated:
            raise HTTPException(status_code=400, detail=f"Fields {list(explicitly_sent_unrelated)} are not allowed for HTTP monitors.")
        monitor_data.port = None
        monitor_data.keyword = None
        
    elif m_type == 'keyword':
        # Unrelated: port
        if 'port' in sent_keys and payload_dict['port'] is not None:
            raise HTTPException(status_code=400, detail="Port is not allowed for Keyword monitors.")
        if not monitor_data.keyword or not monitor_data.keyword.strip():
            raise HTTPException(status_code=400, detail="Keyword is required for keyword search monitors.")
        monitor_data.port = None
        
    elif m_type == 'ping':
        # Unrelated for Ping: port, keyword, HTTP fields, and SSL alerts
        unrelated = {'port', 'keyword', 'method', 'accepted_statuscodes_json', 'httpBodyEncoding', 'body', 'headers', 'ssl_expiry_alert_days', 'ssl_expiry_alert_interval_days', 'ssl_expiry_emails'}
        explicitly_sent_unrelated = unrelated.intersection(sent_keys)
        if explicitly_sent_unrelated:
            raise HTTPException(
                status_code=400, 
                detail=f"Fields {list(explicitly_sent_unrelated)} are not allowed for Ping monitors."
            )
        # Sanitize all unrelated to NULL
        monitor_data.port = None
        monitor_data.keyword = None
        monitor_data.method = None
        monitor_data.accepted_statuscodes_json = None
        monitor_data.httpBodyEncoding = None
        monitor_data.body = None
        monitor_data.headers = None
        monitor_data.ssl_expiry_alert_days = None
        monitor_data.ssl_expiry_alert_interval_days = None
        monitor_data.ssl_expiry_emails = None
        
    elif m_type == 'port':
        # Unrelated for Port: keyword, HTTP fields, and SSL alerts
        unrelated = {'keyword', 'method', 'accepted_statuscodes_json', 'httpBodyEncoding', 'body', 'headers', 'ssl_expiry_alert_days', 'ssl_expiry_alert_interval_days', 'ssl_expiry_emails'}
        explicitly_sent_unrelated = unrelated.intersection(sent_keys)
        if explicitly_sent_unrelated:
            raise HTTPException(
                status_code=400, 
                detail=f"Fields {list(explicitly_sent_unrelated)} are not allowed for Port monitors."
            )
        # Sanitize all unrelated to NULL
        monitor_data.keyword = None
        monitor_data.method = None
        monitor_data.accepted_statuscodes_json = None
        monitor_data.httpBodyEncoding = None
        monitor_data.body = None
        monitor_data.headers = None
        monitor_data.ssl_expiry_alert_days = None
        monitor_data.ssl_expiry_alert_interval_days = None
        monitor_data.ssl_expiry_emails = None
        
    elif m_type == 'ssl':
        # Unrelated for SSL: port, keyword, HTTP fields, and Down notify
        unrelated = {'port', 'keyword', 'method', 'accepted_statuscodes_json', 'httpBodyEncoding', 'body', 'headers', 'email_on_down', 'down_emails'}
        explicitly_sent_unrelated = unrelated.intersection(sent_keys)
        if explicitly_sent_unrelated:
            raise HTTPException(
                status_code=400, 
                detail=f"Fields {list(explicitly_sent_unrelated)} are not allowed for SSL monitors."
            )
        # Sanitize all unrelated to NULL
        monitor_data.port = None
        monitor_data.keyword = None
        monitor_data.method = None
        monitor_data.accepted_statuscodes_json = None
        monitor_data.httpBodyEncoding = None
        monitor_data.body = None
        monitor_data.headers = None
        monitor_data.email_on_down = False
        monitor_data.down_emails = None
        
    elif m_type == 'dns':
        # Unrelated for DNS: port, HTTP fields, and SSL alerts
        unrelated = {'port', 'method', 'accepted_statuscodes_json', 'httpBodyEncoding', 'body', 'headers', 'ssl_expiry_alert_days', 'ssl_expiry_alert_interval_days', 'ssl_expiry_emails'}
        explicitly_sent_unrelated = unrelated.intersection(sent_keys)
        if explicitly_sent_unrelated:
            raise HTTPException(
                status_code=400, 
                detail=f"Fields {list(explicitly_sent_unrelated)} are not allowed for DNS monitors."
            )
        # Sanitize all unrelated to NULL
        monitor_data.port = None
        monitor_data.method = None
        monitor_data.accepted_statuscodes_json = None
        monitor_data.httpBodyEncoding = None
        monitor_data.body = None
        monitor_data.headers = None
        monitor_data.ssl_expiry_alert_days = None
        monitor_data.ssl_expiry_alert_interval_days = None
        monitor_data.ssl_expiry_emails = None

@app.post("/api/monitors", status_code=201)
async def create_monitor(request: Request, db: Session = Depends(get_db)):
    try:
        payload_dict = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")
        
    try:
        monitor_data = MonitorCreate(**payload_dict)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
        
    validate_and_sanitize_monitor(monitor_data, payload_dict)

    new_monitor = Monitor(
        name=monitor_data.name,
        type=monitor_data.type,
        url=monitor_data.url,
        interval=monitor_data.interval,
        timeout=monitor_data.timeout,
        maxretries=monitor_data.maxretries,
        method=monitor_data.method,
        accepted_statuscodes_json=monitor_data.accepted_statuscodes_json,
        httpBodyEncoding=monitor_data.httpBodyEncoding,
        body=monitor_data.body,
        headers=monitor_data.headers,
        active=monitor_data.active,
        created_date=datetime.now(timezone.utc),
        port=monitor_data.port,
        keyword=monitor_data.keyword,
        email_on_down=monitor_data.email_on_down,
        down_emails=monitor_data.down_emails,
        ssl_expiry_alert_days=monitor_data.ssl_expiry_alert_days,
        ssl_expiry_alert_interval_days=monitor_data.ssl_expiry_alert_interval_days,
        ssl_expiry_emails=monitor_data.ssl_expiry_emails
    )
    db.add(new_monitor)
    db.commit()
    db.refresh(new_monitor)
    
    monitor_dict = {
        "id": new_monitor.id,
        "name": new_monitor.name,
        "type": new_monitor.type,
        "url": new_monitor.url,
        "interval": new_monitor.interval,
        "timeout": new_monitor.timeout,
        "maxretries": new_monitor.maxretries,
        "method": new_monitor.method,
        "accepted_statuscodes_json": new_monitor.accepted_statuscodes_json,
        "httpBodyEncoding": new_monitor.httpBodyEncoding,
        "body": new_monitor.body,
        "headers": new_monitor.headers,
        "active": new_monitor.active,
        "created_date": new_monitor.created_date.isoformat() if new_monitor.created_date else None,
        "port": new_monitor.port,
        "keyword": new_monitor.keyword,
        "email_on_down": new_monitor.email_on_down,
        "down_emails": new_monitor.down_emails,
        "ssl_expiry_alert_days": new_monitor.ssl_expiry_alert_days,
        "ssl_expiry_alert_interval_days": new_monitor.ssl_expiry_alert_interval_days,
        "ssl_expiry_emails": new_monitor.ssl_expiry_emails
    }
    
    # Broadcast event
    await manager.broadcast("monitor-added", monitor_dict)
    
    # Trigger scheduler
    if new_monitor.active:
        start_monitor(new_monitor.id, manager.broadcast)
        # Fetch cert details in background
        asyncio.create_task(fetch_tls_once_if_needed(new_monitor.id))
        
    return {"monitor": monitor_dict}

@app.put("/api/monitors/{monitor_id}")
async def update_monitor(monitor_id: int, request: Request, db: Session = Depends(get_db)):
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
        
    try:
        payload_dict = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")
        
    try:
        monitor_data = MonitorCreate(**payload_dict)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
        
    validate_and_sanitize_monitor(monitor_data, payload_dict)
        
    monitor.name = monitor_data.name
    monitor.url = monitor_data.url
    monitor.type = monitor_data.type
    monitor.interval = monitor_data.interval
    monitor.timeout = monitor_data.timeout
    monitor.maxretries = monitor_data.maxretries
    monitor.method = monitor_data.method
    monitor.accepted_statuscodes_json = monitor_data.accepted_statuscodes_json
    monitor.httpBodyEncoding = monitor_data.httpBodyEncoding
    monitor.body = monitor_data.body
    monitor.headers = monitor_data.headers
    monitor.active = monitor_data.active
    monitor.port = monitor_data.port
    monitor.keyword = monitor_data.keyword
    monitor.email_on_down = monitor_data.email_on_down
    monitor.down_emails = monitor_data.down_emails
    monitor.ssl_expiry_alert_days = monitor_data.ssl_expiry_alert_days
    monitor.ssl_expiry_alert_interval_days = monitor_data.ssl_expiry_alert_interval_days
    monitor.ssl_expiry_emails = monitor_data.ssl_expiry_emails
    
    # If type changed to non-HTTP/non-SSL, delete legacy TLS info
    if monitor.type not in ('http', 'keyword', 'ssl'):
        db.query(MonitorTlsInfo).filter(MonitorTlsInfo.monitor_id == monitor.id).delete()
        
    db.commit()
    
    # Restart the check schedule in background
    if monitor.active:
        start_monitor(monitor.id, manager.broadcast)
    else:
        stop_monitor(monitor.id)
        
    return {"message": "Monitor updated successfully"}

@app.post("/api/monitors/{monitor_id}/check")
async def trigger_check(monitor_id: int, db: Session = Depends(get_db)):
    await check_monitor_once(monitor_id, manager.broadcast, is_ondemand=True)
    return {"message": "Check triggered successfully"}

@app.post("/api/monitors/{monitor_id}/toggle")
async def toggle_monitor_active(monitor_id: int, db: Session = Depends(get_db)):
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    monitor.active = not monitor.active
    db.commit()
    
    if monitor.active:
        start_monitor(monitor.id, manager.broadcast)
    else:
        stop_monitor(monitor.id)
        
    return {"message": "Monitor active status toggled", "active": monitor.active}

@app.delete("/api/monitors/{monitor_id}")
async def delete_monitor(monitor_id: int, db: Session = Depends(get_db)):
    stop_monitor(monitor_id)
    
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
        
    db.delete(monitor)
    db.commit()
    
    # Broadcast event
    await manager.broadcast("monitor-deleted", monitor_id)
    return {"message": "Monitor and its related data deleted successfully"}

@app.get("/api/heartbeat/{monitor_id}")
def get_heartbeat(monitor_id: int, db: Session = Depends(get_db)):
    # 1. Consolidated heartbeat intervals using SQL window function (Gaps and Islands)
    query = text("""
        WITH grouped AS (
            SELECT 
                msg,
                status,
                time,
                is_ondemand,
                ROW_NUMBER() OVER (ORDER BY time) 
                - ROW_NUMBER() OVER (PARTITION BY msg ORDER BY time) AS grp
            FROM heartbeat
            WHERE monitor_id = :monitor_id
        )
        SELECT 
            msg,
            status, 
            MIN(time) AS "startTime",
            MAX(is_ondemand) AS "isOndemand"
        FROM grouped
        GROUP BY msg, grp, status
        ORDER BY "startTime" DESC
    """)
    
    result = db.execute(query, {"monitor_id": monitor_id}).fetchall()
    summary = []
    for row in result:
        start_time_str = row[2]
        if isinstance(start_time_str, datetime):
            start_time_str = start_time_str.isoformat()
        summary.append({
            "msg": row[0],
            "status": row[1],
            "startTime": start_time_str,
            "isOndemand": bool(row[3])
        })
        
    # 2. Uptime/Latency Graph Points (Last 10 Hours)
    ten_hours_ago = datetime.now(timezone.utc) - timedelta(hours=10)
    graph_points = db.query(Heartbeat.status, Heartbeat.time, Heartbeat.ping, Heartbeat.is_ondemand).filter(
        Heartbeat.monitor_id == monitor_id,
        Heartbeat.time >= ten_hours_ago
    ).order_by(Heartbeat.time.desc()).all()
    
    graph = []
    for pt in graph_points:
        t_str = pt[1].isoformat() if isinstance(pt[1], datetime) else str(pt[1])
        graph.append({
            "status": pt[0],
            "time": t_str,
            "ping": pt[2],
            "is_ondemand": pt[3]
        })
        
    # 3. Calculate 24h Stats
    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    beats_24h = db.query(Heartbeat.status, Heartbeat.ping).filter(
        Heartbeat.monitor_id == monitor_id,
        Heartbeat.time >= twenty_four_hours_ago
    ).all()
    
    total_beats = len(beats_24h)
    if total_beats > 0:
        up_beats = sum(1 for b in beats_24h if b[0] == 1)
        uptime_pct = round((up_beats / total_beats) * 100, 2)
        
        pings = [b[1] for b in beats_24h if b[0] == 1 and b[1] is not None]
        avg_response = round(sum(pings) / len(pings), 1) if pings else 0.0
    else:
        uptime_pct = 100.0
        avg_response = 0.0
        
    return {
        "heartbeatSummary": summary,
        "heartbeatGraph": graph,
        "uptime24h": uptime_pct,
        "avgResponse24h": avg_response
    }

class ConfigUpdate(BaseModel):
    app_name: Optional[str] = None
    support_email: Optional[str] = None
    alert_from_email: Optional[str] = None
    default_email_addresses: Optional[str] = None
    gemini_api_key: Optional[str] = None

@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    app_name = db.query(AppConfig).filter(AppConfig.key == "app_name").first()
    support_email = db.query(AppConfig).filter(AppConfig.key == "support_email").first()
    alert_from_email = db.query(AppConfig).filter(AppConfig.key == "alert_from_email").first()
    default_email_addresses = db.query(AppConfig).filter(AppConfig.key == "default_email_addresses").first()
    gemini_api_key = db.query(AppConfig).filter(AppConfig.key == "gemini_api_key").first()
    
    # Resolve fallback from env
    env_app_name = os.getenv("APP_NAME", "")
    env_support_email = os.getenv("SUPPORT_EMAIL", "")
    env_alert_from_email = os.getenv("ALERT_FROM_EMAIL", f"Alert <alert@{env_support_email.split('@')[-1]}>" if '@' in env_support_email else "Alert <alert@localhost>")
    env_global_email = os.getenv("GLOBAL_ADMIN_EMAIL", "")
    env_gemini_key = os.getenv("GEMINI_API_KEY", "")

    return {
        "app_name": app_name.value if app_name and app_name.value else env_app_name,
        "support_email": support_email.value if support_email and support_email.value else env_support_email,
        "alert_from_email": alert_from_email.value if alert_from_email and alert_from_email.value else env_alert_from_email,
        "default_email_addresses": default_email_addresses.value if default_email_addresses and default_email_addresses.value else env_global_email,
        "gemini_api_key": gemini_api_key.value if gemini_api_key and gemini_api_key.value else env_gemini_key
    }

@app.put("/api/config")
def update_config(payload: ConfigUpdate, db: Session = Depends(get_db)):
    if payload.app_name is not None:
        row = db.query(AppConfig).filter(AppConfig.key == "app_name").first()
        if row:
            row.value = payload.app_name.strip()
        else:
            db.add(AppConfig(key="app_name", value=payload.app_name.strip()))
            
    if payload.support_email is not None:
        row = db.query(AppConfig).filter(AppConfig.key == "support_email").first()
        if row:
            row.value = payload.support_email.strip()
        else:
            db.add(AppConfig(key="support_email", value=payload.support_email.strip()))
            
    if payload.alert_from_email is not None:
        row = db.query(AppConfig).filter(AppConfig.key == "alert_from_email").first()
        if row:
            row.value = payload.alert_from_email.strip()
        else:
            db.add(AppConfig(key="alert_from_email", value=payload.alert_from_email.strip()))
            
    if payload.default_email_addresses is not None:
        row = db.query(AppConfig).filter(AppConfig.key == "default_email_addresses").first()
        if row:
            row.value = payload.default_email_addresses.strip()
        else:
            db.add(AppConfig(key="default_email_addresses", value=payload.default_email_addresses.strip()))

    if payload.gemini_api_key is not None:
        row = db.query(AppConfig).filter(AppConfig.key == "gemini_api_key").first()
        if row:
            row.value = payload.gemini_api_key.strip()
        else:
            db.add(AppConfig(key="gemini_api_key", value=payload.gemini_api_key.strip()))
            
    db.commit()
    return {"status": "ok"}

@app.post("/api/monitors/{monitor_id}/ai-diagnosis")
def get_ai_diagnosis(monitor_id: str, db: Session = Depends(get_db)):
    try:
        numeric_id = int(str(monitor_id).replace("mon-", "").strip())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid monitor ID format: {monitor_id}")

    monitor = db.query(Monitor).filter(Monitor.id == numeric_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
        
    latest_heartbeat = db.query(Heartbeat).filter(
        Heartbeat.monitor_id == numeric_id
    ).order_by(Heartbeat.id.desc()).first()
    
    if not latest_heartbeat:
        raise HTTPException(status_code=400, detail="No heartbeat data available for diagnosis")

    # If diagnosis is already generated and cached on the heartbeat, return cached
    if latest_heartbeat.ai_summary:
        try:
            return json.loads(latest_heartbeat.ai_summary)
        except Exception:
            pass

    # Retrieve TLS info if applicable
    tls_info = None
    if monitor.type in ('http', 'keyword', 'ssl'):
        tls_row = db.query(MonitorTlsInfo).filter(MonitorTlsInfo.monitor_id == numeric_id).first()
        if tls_row and tls_row.info_json:
            try:
                tls_info = json.loads(tls_row.info_json)
            except Exception:
                pass

    # Resolve gemini_api_key from AppConfig or env
    gemini_key_row = db.query(AppConfig).filter(AppConfig.key == "gemini_api_key").first()
    gemini_key = (gemini_key_row.value if gemini_key_row and gemini_key_row.value else os.getenv("GEMINI_API_KEY", "")).strip()

    from .ai_diagnoser import generate_ai_diagnosis
    
    monitor_dict = {
        "id": monitor.id,
        "name": monitor.name,
        "type": monitor.type,
        "url": monitor.url,
        "port": monitor.port,
        "keyword": monitor.keyword,
        "timeout": monitor.timeout
    }
    
    heartbeat_dict = {
        "status": latest_heartbeat.status,
        "msg": latest_heartbeat.msg,
        "ping": latest_heartbeat.ping,
        "time": latest_heartbeat.time.isoformat() if latest_heartbeat.time else None
    }
    
    diagnosis = generate_ai_diagnosis(monitor_dict, heartbeat_dict, tls_info, gemini_key)

    # Cache diagnosis on the heartbeat row
    try:
        latest_heartbeat.ai_summary = json.dumps(diagnosis)
        db.commit()
    except Exception as e:
        print(f"Failed to cache AI diagnosis to heartbeat: {e}")

    return diagnosis

@app.get("/api/public-status")
def get_public_status(db: Session = Depends(get_db)):
    monitors = db.query(Monitor).all()
    
    total_latency = 0
    latency_count = 0
    total_uptime = 0.0
    monitor_list = []
    
    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    
    for m in monitors:
        latest_hb = db.query(Heartbeat).filter(Heartbeat.monitor_id == m.id).order_by(Heartbeat.time.desc()).first()
        status = "paused"
        current_ping = 0
        
        if m.active:
            if latest_hb:
                status = "up" if latest_hb.status == 1 else "down"
                current_ping = latest_hb.ping or 0
            else:
                status = "up"
        
        beats_24h = db.query(Heartbeat.status, Heartbeat.ping).filter(
            Heartbeat.monitor_id == m.id,
            Heartbeat.time >= twenty_four_hours_ago
        ).all()
        
        total_beats = len(beats_24h)
        if total_beats > 0:
            up_beats = sum(1 for b in beats_24h if b[0] == 1)
            uptime_pct = round((up_beats / total_beats) * 100, 2)
            pings = [b[1] for b in beats_24h if b[0] == 1 and b[1] is not None]
            avg_ping = round(sum(pings) / len(pings), 1) if pings else 0.0
        else:
            uptime_pct = 100.0
            avg_ping = 0.0
            
        monitor_list.append({
            "id": f"mon-{m.id}",
            "name": m.name,
            "url": m.url,
            "type": m.type,
            "status": status,
            "currentResponseMs": current_ping,
            "avgResponseMs": int(avg_ping),
            "uptime24h": uptime_pct
        })
        
        if status != "paused" and current_ping > 0:
            total_latency += current_ping
            latency_count += 1
        total_uptime += uptime_pct

    avg_latency = round(total_latency / latency_count) if latency_count > 0 else 0
    overall_uptime = round(total_uptime / len(monitors), 2) if monitors else 100.0
    
    return {
        "monitors": monitor_list,
        "overallUptime": overall_uptime,
        "avgLatency": avg_latency
    }

@app.post("/api/subscribe")
def subscribe_email(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    existing = db.query(Notification).filter(Notification.email == email).first()
    if not existing:
        sub = Notification(name=email.split("@")[0], email=email, active=True)
        db.add(sub)
        db.commit()
    return {"message": "Subscribed successfully"}


# Startup logic
@app.on_event("startup")
async def startup_event():
    # Setup tables if they do not exist
    init_db()
    
    # Start URL check schedules for active monitors
    await start_all_monitoring(manager.broadcast)
    
    # Run TLS Fetch Loop in background
    asyncio.create_task(tls_fetcher_loop())

# Catch-all to serve frontend client-side SPA index.html or assets
@app.get("/{catchall:path}")
async def serve_frontend(catchall: str):
    file_path = os.path.join(DIST_PATH, catchall)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
        
    # Fallback to SPA index.html
    index_path = os.path.join(DIST_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    return {"detail": "Frontend assets not found. Run a Vite production build first."}
