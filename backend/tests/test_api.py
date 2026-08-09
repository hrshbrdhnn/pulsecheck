import pytest

def test_get_monitors_empty(client):
    response = client.get("/api/monitors")
    assert response.status_code == 200
    assert response.json() == {"monitors": []}

def test_create_http_monitor(client):
    payload = {
        "name": "Test HTTP Monitor",
        "url": "https://example.com",
        "type": "http",
        "interval": 60,
        "timeout": 5,
        "maxretries": 3,
        "method": "GET",
        "accepted_statuscodes_json": '["200-299"]',
        "httpBodyEncoding": "json",
        "active": True,
        "email_on_down": True,
        "down_emails": "ops@example.com, admin@example.com",
        "ssl_expiry_alert_days": 10,
        "ssl_expiry_alert_interval_days": 5,
        "ssl_expiry_emails": "ssl-ops@example.com"
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    data = response.json()["monitor"]
    assert data["name"] == "Test HTTP Monitor"
    assert data["type"] == "http"
    assert data["port"] is None
    assert data["keyword"] is None
    assert data["email_on_down"] is True
    assert data["down_emails"] == "ops@example.com, admin@example.com"
    assert data["ssl_expiry_alert_days"] == 10
    assert data["ssl_expiry_alert_interval_days"] == 5
    assert data["ssl_expiry_emails"] == "ssl-ops@example.com"

def test_create_keyword_monitor_validation(client):
    # Failing case: Keyword is empty
    payload = {
        "name": "Test Keyword Fail",
        "url": "https://example.com",
        "type": "keyword",
        "interval": 60,
        "active": True
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 400
    assert "Keyword is required for keyword search monitors" in response.json()["detail"]

    # Succeeding case: Keyword is provided
    payload["keyword"] = "welcome"
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    data = response.json()["monitor"]
    assert data["keyword"] == "welcome"
    assert data["type"] == "keyword"

def test_create_ssl_monitor_sanitization(client):
    # Case 1: Explicitly sending port or HTTP properties should return a 400 Bad Request
    payload = {
        "name": "Test SSL Monitor Fail",
        "url": "https://google.com",
        "type": "ssl",
        "interval": 86400, # 1 Day in seconds
        "port": 8080, # Custom port is not allowed explicitly
        "active": True
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 400
    assert "Fields ['port'] are not allowed for SSL monitors." in response.json()["detail"]

    # Case 2: Explicitly sending email_on_down should return a 400 Bad Request
    payload_down = {
        "name": "Test SSL Monitor Fail Down",
        "url": "https://google.com",
        "type": "ssl",
        "interval": 86400,
        "email_on_down": True,
        "active": True
    }
    response = client.post("/api/monitors", json=payload_down)
    assert response.status_code == 400
    assert "Fields ['email_on_down'] are not allowed for SSL monitors." in response.json()["detail"]

    # Case 2: Clean parameters should succeed
    clean_payload = {
        "name": "Test SSL Monitor Success",
        "url": "https://google.com",
        "type": "ssl",
        "interval": 86400,
        "active": True
    }
    response = client.post("/api/monitors", json=clean_payload)
    assert response.status_code == 201
    data = response.json()["monitor"]
    assert data["type"] == "ssl"
    assert data["port"] is None
    assert data["keyword"] is None

def test_create_dns_monitor(client):
    payload = {
        "name": "Test DNS Query",
        "url": "google.com",
        "type": "dns",
        "interval": 120,
        "keyword": "8.8.8.8", # Expected resolved IP constraint
        "active": True
    }
    response = client.post("/api/monitors", json=payload)
    assert response.status_code == 201
    data = response.json()["monitor"]
    assert data["type"] == "dns"
    assert data["keyword"] == "8.8.8.8"

def test_get_and_delete_monitor(client):
    # Create
    payload = {
        "name": "Delete Target",
        "url": "https://test.com",
        "type": "http",
        "interval": 60,
        "active": True
    }
    create_res = client.post("/api/monitors", json=payload)
    assert create_res.status_code == 201
    mon_id = create_res.json()["monitor"]["id"]

    # Fetch details
    details_res = client.get(f"/api/monitors/{mon_id}")
    assert details_res.status_code == 200
    assert details_res.json()["monitor"]["name"] == "Delete Target"

    # Delete
    del_res = client.delete(f"/api/monitors/{mon_id}")
    assert del_res.status_code == 200

    # Fetch details again (should fail)
    details_res_again = client.get(f"/api/monitors/{mon_id}")
    assert details_res_again.status_code == 404

def test_api_config(client):
    # GET initial config (should return seeded defaults)
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "app_name" in data
    assert "support_email" in data
    assert "alert_from_email" in data
    assert "default_email_addresses" in data

    # PUT config update
    payload = {
        "app_name": "CustomPulseCheck",
        "support_email": "ops@custom.local",
        "alert_from_email": "OpsAlert <ops@custom.local>",
        "default_email_addresses": "ops-fallback@custom.local"
    }
    update_res = client.put("/api/config", json=payload)
    assert update_res.status_code == 200
    assert update_res.json() == {"status": "ok"}

    # GET config again to verify update
    response2 = client.get("/api/config")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["app_name"] == "CustomPulseCheck"
    assert data2["support_email"] == "ops@custom.local"
    assert data2["alert_from_email"] == "OpsAlert <ops@custom.local>"
    assert data2["default_email_addresses"] == "ops-fallback@custom.local"


