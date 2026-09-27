import pytest
from app.database import Monitor, ErrorTable, Notification, MonitorTlsInfo, AppConfig

def test_get_monitors_empty(client):
    response = client.get("/api/monitors")
    assert response.status_code == 200
    assert response.json() == {"monitors": []}

def test_create_http_monitor(client, db_session):
    payload = {
        "name": "Test HTTP Monitor",
        "url": "https://example.com",
        "type": "http",
        "interval": 60,
        "timeout": 5,
        "maxretries": 3,
        "method": "POST",
        "accepted_statuscodes_json": '["200-299"]',
        "httpBodyEncoding": "json",
        "body": '{"key":"value"}',
        "headers": '{"Authorization":"Bearer test"}',
        "active": True,
        "email_on_down": True,
        "down_emails": "ops@example.com, admin@example.com",
        "ssl_expiry_alert_days": 10,
        "ssl_expiry_alert_interval_days": 5,
        "ssl_expiry_emails": "ssl-ops@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test HTTP Monitor"
    assert db_mon.type == "http"
    assert db_mon.url == "https://example.com"
    assert db_mon.interval == 60
    assert db_mon.timeout == 5
    assert db_mon.maxretries == 3
    assert db_mon.method == "POST"
    assert db_mon.accepted_statuscodes_json == '["200-299"]'
    assert db_mon.httpBodyEncoding == "json"
    assert db_mon.body == '{"key":"value"}'
    assert db_mon.headers == '{"Authorization":"Bearer test"}'
    assert db_mon.active is True
    assert db_mon.email_on_down is True
    assert db_mon.down_emails == "ops@example.com, admin@example.com"
    assert db_mon.ssl_expiry_alert_days == 10
    assert db_mon.ssl_expiry_alert_interval_days == 5
    assert db_mon.ssl_expiry_emails == "ssl-ops@example.com"
    assert db_mon.port is None
    assert db_mon.keyword is None
    assert db_mon.created_date is not None

def test_create_http_monitor_validation(client):
    # Failing case: sending port or keyword for HTTP monitor
    payload = {
        "name": "HTTP Fail",
        "url": "https://example.com",
        "type": "http",
        "port": 8080
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 400
    assert "Fields ['port'] are not allowed for HTTP monitors." in response.json()["detail"]

def test_create_keyword_monitor(client, db_session):
    # Failing case: Keyword missing
    fail_payload = {
        "name": "Test Keyword Fail",
        "url": "https://example.com",
        "type": "keyword",
        "interval": 60,
        "active": True
    }
    response = client.post("/api/monitors", json=fail_payload)
    assert response.status_code == 400
    assert "Keyword is required for keyword search monitors" in response.json()["detail"]

    # Succeeding case: Keyword provided
    payload = {
        "name": "Test Keyword Success",
        "url": "https://example.com",
        "type": "keyword",
        "keyword": "Welcome",
        "interval": 30,
        "timeout": 10,
        "maxretries": 1,
        "method": "GET",
        "accepted_statuscodes_json": '["200"]',
        "httpBodyEncoding": "json",
        "active": True,
        "email_on_down": True,
        "down_emails": "ops@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test Keyword Success"
    assert db_mon.type == "keyword"
    assert db_mon.url == "https://example.com"
    assert db_mon.keyword == "Welcome"
    assert db_mon.interval == 30
    assert db_mon.port is None
    assert db_mon.created_date is not None

def test_create_ping_monitor(client, db_session):
    # Failing case: sending HTTP or SSL fields for Ping monitor
    fail_payload = {
        "name": "Test Ping Fail",
        "url": "8.8.8.8",
        "type": "ping",
        "port": 80
    }
    response = client.post("/api/monitors", json=fail_payload)
    assert response.status_code == 400
    assert "Fields ['port'] are not allowed for Ping monitors." in response.json()["detail"]

    # Success case
    payload = {
        "name": "Test Ping Success",
        "url": "1.1.1.1",
        "type": "ping",
        "interval": 15,
        "active": True,
        "email_on_down": True,
        "down_emails": "ping-alerts@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test Ping Success"
    assert db_mon.type == "ping"
    assert db_mon.url == "1.1.1.1"
    assert db_mon.interval == 15
    assert db_mon.email_on_down is True
    assert db_mon.down_emails == "ping-alerts@example.com"
    # Unrelated sanitized fields in DB
    assert db_mon.port is None
    assert db_mon.keyword is None
    assert db_mon.method is None
    assert db_mon.accepted_statuscodes_json is None
    assert db_mon.httpBodyEncoding is None
    assert db_mon.body is None
    assert db_mon.headers is None
    assert db_mon.ssl_expiry_alert_days is None
    assert db_mon.ssl_expiry_alert_interval_days is None
    assert db_mon.ssl_expiry_emails is None

def test_create_port_monitor(client, db_session):
    # Failing case: sending HTTP body for Port monitor
    fail_payload = {
        "name": "Test Port Fail",
        "url": "db.example.com",
        "type": "port",
        "port": 5432,
        "body": "unallowed"
    }
    response = client.post("/api/monitors", json=fail_payload)
    assert response.status_code == 400
    assert "Fields ['body'] are not allowed for Port monitors." in response.json()["detail"]

    # Success case
    payload = {
        "name": "Test Postgres Port",
        "url": "db.example.com",
        "type": "port",
        "port": 5432,
        "interval": 30,
        "timeout": 5,
        "active": True,
        "email_on_down": True,
        "down_emails": "db-ops@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test Postgres Port"
    assert db_mon.type == "port"
    assert db_mon.url == "db.example.com"
    assert db_mon.port == 5432
    assert db_mon.interval == 30
    assert db_mon.timeout == 5
    assert db_mon.email_on_down is True
    assert db_mon.down_emails == "db-ops@example.com"
    # Unrelated sanitized fields in DB
    assert db_mon.keyword is None
    assert db_mon.method is None
    assert db_mon.ssl_expiry_emails is None

def test_create_ssl_monitor(client, db_session):
    # Failing case 1: sending port for SSL monitor
    fail_payload1 = {
        "name": "SSL Fail Port",
        "url": "https://google.com",
        "type": "ssl",
        "port": 443
    }
    response = client.post("/api/monitors", json=fail_payload1)
    assert response.status_code == 400
    assert "Fields ['port'] are not allowed for SSL monitors." in response.json()["detail"]

    # Failing case 2: sending email_on_down for SSL monitor
    fail_payload2 = {
        "name": "SSL Fail Down Email",
        "url": "https://google.com",
        "type": "ssl",
        "email_on_down": True
    }
    response = client.post("/api/monitors", json=fail_payload2)
    assert response.status_code == 400
    assert "Fields ['email_on_down'] are not allowed for SSL monitors." in response.json()["detail"]

    # Success case
    payload = {
        "name": "Test SSL Monitor",
        "url": "https://secure.example.com",
        "type": "ssl",
        "interval": 86400,
        "ssl_expiry_alert_days": 30,
        "ssl_expiry_alert_interval_days": 7,
        "ssl_expiry_emails": "ssl-admin@example.com",
        "active": True
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test SSL Monitor"
    assert db_mon.type == "ssl"
    assert db_mon.url == "https://secure.example.com"
    assert db_mon.interval == 86400
    assert db_mon.ssl_expiry_alert_days == 30
    assert db_mon.ssl_expiry_alert_interval_days == 7
    assert db_mon.ssl_expiry_emails == "ssl-admin@example.com"
    assert db_mon.email_on_down is False
    assert db_mon.down_emails is None
    assert db_mon.port is None
    assert db_mon.method is None

def test_create_dns_monitor(client, db_session):
    # Failing case: sending HTTP method for DNS monitor
    fail_payload = {
        "name": "DNS Fail",
        "url": "google.com",
        "type": "dns",
        "method": "GET"
    }
    response = client.post("/api/monitors", json=fail_payload)
    assert response.status_code == 400
    assert "Fields ['method'] are not allowed for DNS monitors." in response.json()["detail"]

    # Success case
    payload = {
        "name": "Test DNS Monitor",
        "url": "dns.google.com",
        "type": "dns",
        "keyword": "8.8.8.8",
        "interval": 300,
        "active": True,
        "email_on_down": True,
        "down_emails": "dns-team@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    mon_id = response.json()["monitor"]["id"]

    # Direct database table verification
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Test DNS Monitor"
    assert db_mon.type == "dns"
    assert db_mon.url == "dns.google.com"
    assert db_mon.keyword == "8.8.8.8"
    assert db_mon.interval == 300
    assert db_mon.email_on_down is True
    assert db_mon.down_emails == "dns-team@example.com"
    assert db_mon.port is None
    assert db_mon.method is None
    assert db_mon.ssl_expiry_alert_days is None

def test_update_and_delete_monitor(client, db_session):
    # Create monitor
    payload = {
        "name": "Initial Monitor Name",
        "url": "https://initial.example.com",
        "type": "http",
        "interval": 60,
        "active": True
    }
    create_res = client.post("/api/monitors", json=payload)
    assert create_res.status_code == 201
    mon_id = create_res.json()["monitor"]["id"]

    # Verify initial creation in DB
    db_mon = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon is not None
    assert db_mon.name == "Initial Monitor Name"

    # Update monitor
    update_payload = {
        "name": "Updated Monitor Name",
        "url": "https://updated.example.com",
        "type": "http",
        "interval": 120,
        "active": False
    }
    update_res = client.put(f"/api/monitors/{mon_id}", json=update_payload)
    assert update_res.status_code == 200

    # Verify update in DB
    db_session.refresh(db_mon)
    assert db_mon.name == "Updated Monitor Name"
    assert db_mon.url == "https://updated.example.com"
    assert db_mon.interval == 120
    assert db_mon.active is False

    # Fetch details via API
    details_res = client.get(f"/api/monitors/{mon_id}")
    assert details_res.status_code == 200
    assert details_res.json()["monitor"]["name"] == "Updated Monitor Name"

    # Delete monitor
    del_res = client.delete(f"/api/monitors/{mon_id}")
    assert del_res.status_code == 200

    # Verify deletion in DB
    db_mon_after_delete = db_session.query(Monitor).filter(Monitor.id == mon_id).first()
    assert db_mon_after_delete is None

    # Fetch details via API (should be 404)
    assert client.get(f"/api/monitors/{mon_id}").status_code == 404

def test_api_config(client, db_session):
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "app_name" in data
    assert "support_email" in data
    assert "alert_from_email" in data
    assert "default_email_addresses" in data

    payload = {
        "app_name": "CustomPulseCheck",
        "support_email": "ops@custom.local",
        "alert_from_email": "OpsAlert <ops@custom.local>",
        "default_email_addresses": "ops-fallback@custom.local"
    }
    update_res = client.put("/api/config", json=payload)
    assert update_res.status_code == 200
    assert update_res.json() == {"status": "ok"}

    # Verify directly in DB
    cfg_row = db_session.query(AppConfig).filter(AppConfig.key == "app_name").first()
    assert cfg_row is not None
    assert cfg_row.value == "CustomPulseCheck"

    # GET config again to verify API response
    response2 = client.get("/api/config")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["app_name"] == "CustomPulseCheck"
    assert data2["support_email"] == "ops@custom.local"

def test_error_table_timestamp(db_session):
    err = ErrorTable(table_name="test_table", err_text="Sample error message")
    db_session.add(err)
    db_session.commit()
    db_session.refresh(err)

    db_err = db_session.query(ErrorTable).filter(ErrorTable.id == err.id).first()
    assert db_err is not None
    assert db_err.table_name == "test_table"
    assert db_err.err_text == "Sample error message"
    assert db_err.timestamp is not None

def test_notification_timestamp(db_session):
    sub = Notification(name="testuser", email="test@example.com", active=True)
    db_session.add(sub)
    db_session.commit()
    db_session.refresh(sub)

    db_sub = db_session.query(Notification).filter(Notification.id == sub.id).first()
    assert db_sub is not None
    assert db_sub.email == "test@example.com"
    assert db_sub.timestamp is not None

def test_monitor_tls_info_timestamp(db_session):
    mon = Monitor(name="TLS Mon", type="ssl", url="https://example.com")
    db_session.add(mon)
    db_session.commit()
    db_session.refresh(mon)

    tls = MonitorTlsInfo(monitor_id=mon.id, info_json='{"valid": true}')
    db_session.add(tls)
    db_session.commit()
    db_session.refresh(tls)

    db_tls = db_session.query(MonitorTlsInfo).filter(MonitorTlsInfo.id == tls.id).first()
    assert db_tls is not None
    assert db_tls.monitor_id == mon.id
    assert db_tls.timestamp is not None

def test_ai_diagnosis_endpoint(client, db_session):
    from app.database import Heartbeat
    
    # Create monitor
    mon = Monitor(name="Outage Mon", type="http", url="https://down-service.example.com")
    db_session.add(mon)
    db_session.commit()
    db_session.refresh(mon)

    # Create failed heartbeat
    hb = Heartbeat(monitor_id=mon.id, status=0, msg="HTTP 502 Bad Gateway", ping=150)
    db_session.add(hb)
    db_session.commit()

    # Call AI Diagnosis endpoint
    resp = client.post(f"/api/monitors/{mon.id}/ai-diagnosis")
    assert resp.status_code == 200
    data = resp.json()

    assert "summary" in data
    assert "502 Bad Gateway" in data["summary"]
    assert data["severity"] == "CRITICAL"
    assert len(data["likely_causes"]) > 0
    assert len(data["recommended_actions"]) > 0

