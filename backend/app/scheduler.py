import asyncio
import json
import httpx
import sys
import re
from urllib.parse import urlparse
from datetime import datetime, timezone
from sqlalchemy import desc
from .database import SessionLocal, Monitor, Heartbeat, MonitorTlsInfo, ErrorTable
from .mailer import send_mail
from .tls_fetcher import fetch_tls_info

# Global dictionary to hold active monitor tasks: monitor_id -> asyncio.Task
monitor_tasks = {}
tls_fetch_task = None

STATUS_UP = "up"
STATUS_DOWN = "down"
STATUS_DEGRADED = "degraded"
STATUS_PENDING = "pending"

def extract_hostname_and_port(url: str, default_port: int = 80) -> tuple[str, int]:
    """Helper to parse a hostname and port from a URL/hostname string."""
    url_str = url.strip()
    if not url_str.startswith(("http://", "https://")):
        url_str = f"http://{url_str}"
    try:
        parsed = urlparse(url_str)
        hostname = parsed.hostname or url
        port = parsed.port or (443 if url.startswith("https") else default_port)
        return hostname, port
    except Exception:
        return url, default_port

async def run_ping(hostname: str, timeout_ms: int = 2000) -> tuple[bool, int, str]:
    """Runs system ping command to check if host is reachable."""
    try:
        if sys.platform == "win32":
            args = ["ping", "-n", "1", "-w", str(timeout_ms), hostname]
        else:
            args = ["ping", "-c", "1", "-W", str(timeout_ms), hostname]
            
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        exit_code = proc.returncode
        
        if exit_code == 0:
            output = stdout.decode('utf-8', errors='ignore')
            match = re.search(r"time=([0-9.]+)", output)
            if match:
                ping_time = float(match.group(1))
                return True, int(ping_time), f"Ping Succeeded - {ping_time:.2f} ms"
            return True, 0, "Ping Succeeded"
        else:
            err_msg = stderr.decode('utf-8', errors='ignore').strip()
            return False, 0, f"Ping Failed: {err_msg or 'Host Unreachable'}"
    except Exception as exc:
        return False, 0, f"Ping Exception: {str(exc)}"

async def run_tcp_port_check(hostname: str, port: int, timeout_sec: float = 5.0) -> tuple[bool, int, str]:
    """Performs a non-blocking TCP socket connection check on a specific port."""
    start_time = datetime.now(timezone.utc)
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(hostname, port),
            timeout=timeout_sec
        )
        writer.close()
        await writer.wait_closed()
        
        response_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        return True, response_time, f"TCP Port {port} Open - {response_time} ms"
    except asyncio.TimeoutError:
        return False, 0, f"TCP Connection to port {port} Timed Out"
    except Exception as exc:
        return False, 0, f"TCP Connection to port {port} Failed: {str(exc)}"

def is_important_beat(is_first_beat: bool, previous_status: str, current_status: str) -> bool:
    """Determines whether a status change is important enough to send an email alert."""
    if is_first_beat:
        return True
    if previous_status == STATUS_UP and current_status == STATUS_DOWN:
        return True
    if previous_status == STATUS_DOWN and current_status == STATUS_UP:
        return True
    if previous_status == STATUS_PENDING and current_status == STATUS_DOWN:
        return True
    return False

async def check_monitor_once(monitor_id: int, broadcast_fn, is_ondemand: bool = False):
    """Executes a single availability check, saves the heartbeat, and broadcasts updates."""
    db = SessionLocal()
    try:
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
        if not monitor or not monitor.active:
            return
            
        previous_beat = db.query(Heartbeat).filter(Heartbeat.monitor_id == monitor_id).order_by(desc(Heartbeat.time)).first()
        is_first_beat = previous_beat is None
        
        previous_status = None
        if previous_beat:
            if previous_beat.status == 1:
                previous_status = STATUS_UP
            elif previous_beat.status == 2:
                previous_status = STATUS_DEGRADED
            else:
                previous_status = STATUS_DOWN
            
        down_count = previous_beat.down_count if previous_beat else 0
        
        start_time = datetime.now(timezone.utc)
        
        is_success = False
        status_message = ""
        response_time = 0
        
        m_type = (monitor.type or 'http').lower().strip()
        
        if m_type == 'ping':
            hostname, _ = extract_hostname_and_port(monitor.url)
            is_success, response_time, status_message = await run_ping(hostname, timeout_ms=int(monitor.timeout * 1000))
            current_status = STATUS_UP if is_success else STATUS_DOWN
            current_status_numeric = 1 if is_success else 0
            down_count = 0 if is_success else (down_count + 1)
        elif m_type == 'port':
            if monitor.port:
                hostname = monitor.url
                port = monitor.port
            else:
                hostname, port = extract_hostname_and_port(monitor.url, default_port=80)
            is_success, response_time, status_message = await run_tcp_port_check(hostname, port, timeout_sec=float(monitor.timeout))
            current_status = STATUS_UP if is_success else STATUS_DOWN
            current_status_numeric = 1 if is_success else 0
            down_count = 0 if is_success else (down_count + 1)
        elif m_type == 'ssl':
            try:
                res = await asyncio.get_event_loop().run_in_executor(None, fetch_tls_info, monitor.url)
                cert_info = res.get('certInfo', {})
                days_remaining = cert_info.get('daysRemaining', 0)
                if days_remaining <= 0:
                    is_success = False
                    current_status = STATUS_DOWN
                    current_status_numeric = 0
                    status_message = f"SSL Certificate Expired ({abs(days_remaining)} days ago)"
                elif days_remaining <= 14:
                    is_success = True
                    current_status = STATUS_DEGRADED
                    current_status_numeric = 2
                    status_message = f"SSL Certificate Expiring Soon ({days_remaining} days remaining)"
                else:
                    is_success = True
                    current_status = STATUS_UP
                    current_status_numeric = 1
                    status_message = f"SSL Certificate Valid ({days_remaining} days remaining)"
                response_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            except Exception as e:
                is_success = False
                current_status = STATUS_DOWN
                current_status_numeric = 0
                status_message = str(e)
                response_time = 0
            down_count = 0 if is_success else (down_count + 1)
        elif m_type == 'dns':
            try:
                addr_info = await asyncio.get_event_loop().getaddrinfo(monitor.url, None)
                resolved_ips = list(set(info[4][0] for info in addr_info))
                response_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                
                if monitor.keyword:
                    expected = monitor.keyword.strip()
                    if expected in resolved_ips:
                        is_success = True
                        current_status = STATUS_UP
                        current_status_numeric = 1
                        status_message = f"DNS resolved to expected IP {expected}"
                    else:
                        is_success = False
                        current_status = STATUS_DOWN
                        current_status_numeric = 0
                        status_message = f"DNS resolved to {resolved_ips}, expected {expected}"
                else:
                    is_success = True
                    current_status = STATUS_UP
                    current_status_numeric = 1
                    status_message = f"DNS resolved to {resolved_ips[0]}"
            except Exception as e:
                is_success = False
                current_status = STATUS_DOWN
                current_status_numeric = 0
                status_message = f"DNS Resolution Failed: {str(e)}"
                response_time = 0
            down_count = 0 if is_success else (down_count + 1)
        else:  # http(s) / keyword
            headers = json.loads(monitor.headers) if monitor.headers else {}
            method = monitor.method or 'GET'
            timeout = monitor.timeout or 16
            
            # Status code checking
            accepted_status_ranges = ["200-299"]
            if monitor.accepted_statuscodes_json:
                try:
                    accepted_status_ranges = json.loads(monitor.accepted_statuscodes_json)
                except Exception:
                    pass
                    
            def is_status_accepted(status_code: int) -> bool:
                for r in accepted_status_ranges:
                    if "-" in r:
                        start, end = r.split("-")
                        if int(start) <= status_code <= int(end):
                            return True
                    else:
                        try:
                            if int(r) == status_code:
                                return True
                        except ValueError:
                            pass
                return False
            
            async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
                try:
                    request_kwargs = {
                        "method": method,
                        "url": monitor.url,
                        "headers": headers,
                    }
                    
                    # Check HTTP body
                    if monitor.body:
                        if monitor.httpBodyEncoding == 'json':
                            try:
                                request_kwargs["json"] = json.loads(monitor.body)
                            except Exception:
                                request_kwargs["content"] = monitor.body
                        else:
                            request_kwargs["content"] = monitor.body
                            
                    response = await client.request(**request_kwargs)
                    response_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                    
                    is_success = is_status_accepted(response.status_code)
                    if is_success:
                        status_message = f"{response.status_code} - {response.reason_phrase}"
                        if m_type == 'keyword' and monitor.keyword:
                            if monitor.keyword not in response.text:
                                is_success = False
                                status_message = f"Keyword '{monitor.keyword}' not found in response content"
                            else:
                                status_message = f"Keyword '{monitor.keyword}' found in response ({response.status_code})"
                    else:
                        status_message = f"{response.status_code} - {response.reason_phrase}"
                    
                except httpx.TimeoutException:
                    status_message = "Request timed out"
                except httpx.RequestError as exc:
                    status_message = f"Network Error: {str(exc)}"
                except Exception as exc:
                    status_message = str(exc)
            current_status = STATUS_UP if is_success else STATUS_DOWN
            current_status_numeric = 1 if is_success else 0
            down_count = 0 if is_success else (down_count + 1)
            
        is_important = is_important_beat(is_first_beat, previous_status, current_status)
        timestamp = datetime.now(timezone.utc)
        
        # Save Heartbeat in SQLite
        heartbeat = Heartbeat(
            important=is_important,
            monitor_id=monitor.id,
            status=current_status_numeric,
            msg=status_message,
            time=timestamp,
            ping=response_time if is_success else 0,
            duration=response_time if is_success else 0,
            down_count=down_count,
            is_ondemand=is_ondemand
        )
        db.add(heartbeat)
        db.commit()
        
        # Format timestamp matching YYYY-MM-DD HH:mm:ss.SSS for frontend parsing
        timestamp_formatted = timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        broadcast_payload = {
            "monitorId": monitor.id,
            "monitorName": monitor.name,
            "msg": status_message,
            "status": current_status,
            "ping": response_time if is_success else 0,
            "timestamp": timestamp_formatted,
            "is_ondemand": is_ondemand
        }
        
        # Emit to WebSockets
        if broadcast_fn:
            await broadcast_fn("heartbeat", broadcast_payload)
            
        # Trigger email alerts on status changes OR if on-demand check fails
        should_email = monitor.email_on_down and (is_important or (is_ondemand and current_status == STATUS_DOWN))
        if should_email:
            send_mail(
                current_status.upper(), 
                monitor.name, 
                monitor.url, 
                status_message, 
                custom_emails=monitor.down_emails
            )
            
    except Exception as e:
        print(f"Error checking monitor {monitor_id}: {e}")
    finally:
        db.close()

async def monitor_loop(monitor_id: int, broadcast_fn):
    """Indefinite background task for a single monitor."""
    while True:
        db = SessionLocal()
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
        db.close()
        
        if not monitor or not monitor.active:
            break
            
        await check_monitor_once(monitor_id, broadcast_fn)
        await asyncio.sleep(monitor.interval)

def start_monitor(monitor_id: int, broadcast_fn):
    """Starts the checking loop task for a monitor."""
    if monitor_id in monitor_tasks:
        stop_monitor(monitor_id)
        
    task = asyncio.create_task(monitor_loop(monitor_id, broadcast_fn))
    monitor_tasks[monitor_id] = task

def stop_monitor(monitor_id: int):
    """Cancels the checking loop task for a monitor."""
    task = monitor_tasks.pop(monitor_id, None)
    if task:
        task.cancel()

async def start_all_monitoring(broadcast_fn):
    """Starts background loops for all active monitors configured in the database."""
    db = SessionLocal()
    try:
        monitors = db.query(Monitor).filter(Monitor.active == True).all()
        for monitor in monitors:
            start_monitor(monitor.id, broadcast_fn)
    finally:
        db.close()

# TLS/SSL Expiration Fetching Jobs
def check_and_send_ssl_expiry_alert(monitor, tls_res, db):
    """Checks if a monitor's certificate is expiring and triggers an alert if configured."""
    if not monitor.ssl_expiry_alert_days:
        return
        
    try:
        cert_info = tls_res.get("certInfo")
        if not cert_info:
            return
            
        days_remaining = cert_info.get("daysRemaining")
        if days_remaining is None:
            return
            
        if days_remaining <= monitor.ssl_expiry_alert_days:
            # Check the repeat interval logic
            last_notified = monitor.ssl_expiry_last_notified
            should_notify = False
            
            if last_notified is None:
                should_notify = True
            else:
                if last_notified.tzinfo is None:
                    last_notified = last_notified.replace(tzinfo=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                interval_days = monitor.ssl_expiry_alert_interval_days or 7
                if (now_utc - last_notified).days >= interval_days:
                    should_notify = True
                    
            if should_notify:
                from .mailer import send_ssl_expiry_mail
                valid_to = cert_info.get("validTo", "Unknown")
                
                # Send email
                send_ssl_expiry_mail(
                    monitor_name=monitor.name,
                    monitor_url=monitor.url,
                    days_left=days_remaining,
                    expiration_date=valid_to,
                    custom_emails=monitor.ssl_expiry_emails
                )
                
                # Update last notified timestamp
                monitor.ssl_expiry_last_notified = datetime.now(timezone.utc)
                db.commit()
    except Exception as e:
        print(f"Error checking/sending SSL expiry alert for monitor {monitor.id}: {e}")

async def fetch_tls_once_if_needed(monitor_id: int):
    """Queries SSL details immediately on creation and writes them to the DB."""
    db = SessionLocal()
    try:
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
        if monitor and (monitor.type or 'http').lower().strip() in ('http', 'keyword', 'ssl'):
            res = fetch_tls_info(monitor.url)
            
            existing = db.query(MonitorTlsInfo).filter(MonitorTlsInfo.monitor_id == monitor_id).first()
            if existing:
                existing.info_json = json.dumps(res)
            else:
                new_info = MonitorTlsInfo(monitor_id=monitor_id, info_json=json.dumps(res))
                db.add(new_info)
            db.commit()
            
            # Check and send alerts
            check_and_send_ssl_expiry_alert(monitor, res, db)
    except Exception as e:
        try:
            err_entry = ErrorTable(table_name="monitor_tls_info", err_text=str(e))
            db.add(err_entry)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()

async def tls_fetcher_loop():
    """Regular background cron task (every 5 hours) to fetch certificate expirations."""
    from sqlalchemy import or_
    while True:
        db = SessionLocal()
        try:
            monitors = db.query(Monitor).filter(or_(
                Monitor.type == 'http',
                Monitor.type == 'keyword',
                Monitor.type == 'ssl',
                Monitor.type == None
            )).all()
            for monitor in monitors:
                try:
                    res = fetch_tls_info(monitor.url)
                    existing = db.query(MonitorTlsInfo).filter(MonitorTlsInfo.monitor_id == monitor.id).first()
                    if existing:
                        existing.info_json = json.dumps(res)
                    else:
                        new_info = MonitorTlsInfo(monitor_id=monitor.id, info_json=json.dumps(res))
                        db.add(new_info)
                    db.commit()
                    
                    # Check and send alerts
                    check_and_send_ssl_expiry_alert(monitor, res, db)
                except Exception as e:
                    err_entry = ErrorTable(table_name="monitor_tls_info", err_text=str(e))
                    db.add(err_entry)
                    db.commit()
        except Exception as exc:
            print(f"Error in TLS fetch loop: {exc}")
        finally:
            db.close()
            
        await asyncio.sleep(5 * 3600)  # Run every 5 hours
