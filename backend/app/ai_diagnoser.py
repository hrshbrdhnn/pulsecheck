import json
import re
import httpx
from typing import Optional

def generate_heuristic_fallback(monitor: dict, heartbeat: dict, tls_info: Optional[dict] = None) -> dict:
    """Intelligent fallback rule-based diagnostic engine for monitor outages."""
    m_type = (monitor.get("type") or "http").lower().strip()
    msg = heartbeat.get("msg") or "Unknown error"
    msg_lower = msg.lower()
    url = monitor.get("url") or ""
    name = monitor.get("name") or "Monitor"

    summary = f"Monitor '{name}' is DOWN: {msg}"
    severity = "CRITICAL"
    causes = []
    actions = []

    # HTTP / KEYWORD
    if m_type in ("http", "keyword"):
        if "502" in msg or "bad gateway" in msg_lower:
            summary = f"502 Bad Gateway: The reverse proxy (e.g. Nginx/Cloudflare) at '{url}' cannot reach the upstream app server."
            causes = [
                "Upstream web app or backend daemon is crashed or stopped.",
                "Reverse proxy configuration points to an incorrect internal port or IP.",
                "System resource exhaustion (OOM or 100% CPU) on upstream server."
            ]
            actions = [
                "Check upstream app service status: `systemctl status <your-app>` or `docker ps`.",
                "Inspect proxy error logs: `tail -f /var/log/nginx/error.log`.",
                "Restart the backend application process."
            ]
        elif "504" in msg or "gateway timeout" in msg_lower:
            summary = f"504 Gateway Timeout: The server at '{url}' took too long to respond to the gateway proxy."
            causes = [
                "Backend application is deadlock-blocked or executing slow queries.",
                "Database server connection pool exhausted.",
                "High network latency or external API call timeout in upstream server."
            ]
            actions = [
                "Inspect backend thread/process dumps and database slow query logs.",
                "Increase gateway timeout thresholds in Nginx/HAProxy if long requests are expected.",
                "Restart worker pool or web server."
            ]
        elif "500" in msg or "internal server error" in msg_lower:
            summary = f"500 Internal Server Error: An unhandled application exception occurred on '{url}'."
            causes = [
                "Unhandled runtime exception or stack trace in backend code.",
                "Database connection failure or unhandled environment variable error.",
                "Permission issue accessing server disk or log files."
            ]
            actions = [
                "Check backend stdout/stderr log output for exception tracebacks.",
                "Verify database credentials and environment configuration.",
                "Re-deploy or roll back recent code changes."
            ]
        elif "keyword" in msg_lower or "not found on page" in msg_lower:
            summary = f"Keyword Assertion Failed: Required text keyword '{monitor.get('keyword')}' was missing from HTTP response."
            causes = [
                "Application returned an error page or custom maintenance screen.",
                "Page content updated and keyword text changed.",
                "Single-Page Application (SPA) rendered blank HTML shell."
            ]
            actions = [
                "Open URL in web browser to check current page content.",
                "Update monitor expected keyword if page copy changed.",
                "Verify backend rendering pipeline."
            ]
        elif "404" in msg or "not found" in msg_lower:
            summary = f"404 Not Found: The endpoint '{url}' does not exist on the web server."
            causes = [
                "URL path changed or misconfigured in monitor settings.",
                "Router/Web server missing route definition.",
                "Deployment artifact uploaded to wrong directory."
            ]
            actions = [
                "Verify the exact monitor target URL path.",
                "Check server routing table or static file directory."
            ]
        elif "403" in msg or "401" in msg or "forbidden" in msg_lower or "unauthorized" in msg_lower:
            summary = f"Authentication/Authorization Failure on '{url}' ({msg})."
            causes = [
                "API token or basic auth header missing/expired.",
                "WAF or Bot protection (e.g. Cloudflare) blocking monitor user-agent/IP.",
                "File permissions forbidden on server."
            ]
            actions = [
                "Check monitor HTTP headers for valid auth tokens.",
                "Whitelist PulseCheck IP address in Cloudflare or server firewall."
            ]
        elif "connection refused" in msg_lower:
            summary = f"Connection Refused: Target web server at '{url}' is not listening on the specified port."
            causes = [
                "Web server (Nginx/Apache/Node.js) service is completely stopped.",
                "Server rebooted and service did not auto-start on boot.",
                "Host listening on localhost (127.0.0.1) instead of public interface (0.0.0.0)."
            ]
            actions = [
                "SSH into host and check process status.",
                "Start or enable web server daemon: `systemctl start nginx`.",
                "Check host binding IP addresses."
            ]
        elif "timeout" in msg_lower or "timed out" in msg_lower:
            summary = f"Request Timeout: Target '{url}' did not respond within {monitor.get('timeout', 16)} seconds."
            causes = [
                "Host is overloaded or suffering severe network degradation.",
                "Firewall or security group dropping TCP packets silently.",
                "DNS resolution stalling or routing loop."
            ]
            actions = [
                "Check host CPU, RAM, and network interface load.",
                "Verify cloud security group and iptables firewall rules.",
                "Increase timeout in monitor configuration."
            ]
        else:
            summary = f"HTTP Monitoring Failure: {msg}"
            causes = [
                "Unexpected HTTP response code or TCP network failure.",
                "Target web application error."
            ]
            actions = [
                "Review server logs and network reachability.",
                "Verify monitor target URL and accepted status code settings."
            ]

    # PING
    elif m_type == "ping":
        summary = f"Ping Check Failed for host '{url}': {msg}"
        causes = [
            "Target host is powered off or kernel panicked.",
            "Network firewall or cloud security group blocking ICMP echo requests.",
            "Upstream router or gateway outage between monitor node and target."
        ]
        actions = [
            "Attempt manual ping or traceroute to target IP.",
            "Ensure ICMP Echo requests are permitted in firewall/security groups.",
            "Verify host machine hardware / hypervisor status."
        ]

    # PORT
    elif m_type == "port":
        port_num = monitor.get("port") or "target"
        summary = f"Port Check Failed: Cannot establish TCP connection to {url}:{port_num} ({msg})."
        causes = [
            f"Service listening on port {port_num} (e.g. Database / Redis / SSH) is stopped or crashed.",
            f"Firewall (ufw/iptables/cloud SG) blocking inbound traffic on port {port_num}.",
            f"Service is bound to 127.0.0.1 (loopback) instead of public network interface."
        ]
        actions = [
            f"Verify service process is running on target host.",
            f"Check if port {port_num} is listening: `netstat -tuln | grep {port_num}`.",
            f"Update security group rules to allow inbound TCP port {port_num}."
        ]

    # SSL
    elif m_type == "ssl":
        summary = f"SSL/TLS Health Check Failed for '{url}': {msg}"
        severity = "CRITICAL"
        causes = [
            "SSL/TLS Certificate has expired or been revoked.",
            "Hostname mismatch (Certificate issued for a different domain).",
            "Broken certificate chain (missing intermediate CA certificates)."
        ]
        actions = [
            "Renew SSL certificate via Certbot / Let's Encrypt / Cloud provider.",
            "Inspect certificate chain: `openssl s_client -connect <domain>:443 -showcerts`.",
            "Verify DNS domain pointing to correct server host."
        ]

    # DNS
    elif m_type == "dns":
        summary = f"DNS Resolution Check Failed for domain '{url}': {msg}"
        causes = [
            "DNS domain name registration expired or domain suspended.",
            "Authoritative nameservers unreachable or misconfigured.",
            "Resolved IP address does not match expected keyword constraint."
        ]
        actions = [
            "Check domain WHOIS status and expiration date.",
            "Test resolution via public DNS: `dig +trace {url}`.",
            "Verify DNS record configuration at domain registrar."
        ]

    return {
        "summary": summary,
        "severity": severity,
        "likely_causes": causes,
        "recommended_actions": actions
    }

def generate_ai_diagnosis(monitor: dict, heartbeat: dict, tls_info: Optional[dict] = None, gemini_api_key: str = "") -> dict:
    """Generates an AI root cause outage diagnosis using Gemini API or heuristic fallback."""
    if not gemini_api_key or not gemini_api_key.strip():
        return generate_heuristic_fallback(monitor, heartbeat, tls_info)

    try:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key.strip()}"
        
        m_type = monitor.get("type", "http")
        name = monitor.get("name", "Target")
        url = monitor.get("url", "")
        msg = heartbeat.get("msg", "Down")
        ping = heartbeat.get("ping")
        keyword = monitor.get("keyword")
        port = monitor.get("port")
        
        prompt = f"""You are an expert DevOps engineer and Site Reliability Engineer (SRE).
Analyze the following server monitor failure and provide a concise root cause diagnosis.

MONITOR TARGET:
- Name: {name}
- Type: {m_type}
- URL / Target Host: {url}
- Port: {port if port else 'Default'}
- Expected Keyword: {keyword if keyword else 'N/A'}

OUTAGE DETAILS:
- Error Message: {msg}
- Latency (ping): {ping} ms
- TLS/SSL Info: {json.dumps(tls_info) if tls_info else 'N/A'}

Respond ONLY with a valid JSON object matching this exact structure:
{{
  "summary": "Concise 1-2 sentence description of what failed and why.",
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "likely_causes": [
    "Cause 1",
    "Cause 2",
    "Cause 3"
  ],
  "recommended_actions": [
    "Step 1 to troubleshoot or fix",
    "Step 2 to troubleshoot or fix",
    "Step 3 to troubleshoot or fix"
  ]
}}
Do not wrap JSON in markdown formatting or triple backticks. Return raw JSON string.
"""

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800
            }
        }

        with httpx.Client(timeout=10.0) as client:
            resp = client.post(api_url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                # Clean up any potential code block markers
                raw_text = re.sub(r'^```(json)?', '', raw_text, flags=re.MULTILINE)
                raw_text = re.sub(r'```$', '', raw_text, flags=re.MULTILINE).strip()
                parsed = json.loads(raw_text)
                return parsed
            else:
                print(f"Gemini API error ({resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"Failed to call Gemini API for diagnosis: {e}")

    # Fall back if API call fails
    return generate_heuristic_fallback(monitor, heartbeat, tls_info)
