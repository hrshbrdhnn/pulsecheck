import os
import resend
from dotenv import load_dotenv
from .database import SessionLocal, Notification, ErrorTable, AppConfig

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(BASE_DIR, "../.env"))
load_dotenv(dotenv_path)

# Initialize resend with API Key from environment
resend.api_key = os.getenv("RESEND_API_KEY")

def get_config_val(db, key: str, default: str) -> str:
    """Helper to query a key from AppConfig database table dynamically."""
    try:
        row = db.query(AppConfig).filter(AppConfig.key == key).first()
        if row and row.value is not None and row.value.strip() != "":
            return row.value.strip()
    except Exception as e:
        print(f"Error querying AppConfig key {key}: {e}")
    return default

def mail_template(monitor_status: str, monitor_name: str, monitor_url: str, monitor_response: str, app_name: str, support_email: str) -> str:
    """Generates the HTML email body based on status (UP/DOWN)."""
    wrapper_class = "up-email-wrapper" if monitor_status == 'UP' else "down-email-wrapper"
    status_class = "status-up" if monitor_status == 'UP' else "status-down"
    
    additional_text = (
        "<p>The monitor is back up, no further action is needed at the moment.</p>"
        if monitor_status == 'UP'
        else "<p>The monitor is down, please look into it as soon as possible to ensure the service is fully operational.</p>"
    )
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitor Status Alert</title>
        <style>
            body {{
                    margin: 0;
                    padding: 0;
                    background-color: #0d0d0d;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #e5e2e1;
                }}

                .up-email-wrapper {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #e5e2e1;
                    background-color: #0b140c;
                    border-top: 4px solid #00e55b;
                    margin: 0;
                    padding: 24px 12px;
                    min-height: 100vh;
                    box-sizing: border-box;
                }}

                .down-email-wrapper {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #e5e2e1;
                    background-color: #190a09;
                    border-top: 4px solid #ED2100;
                    margin: 0;
                    padding: 24px 12px;
                    min-height: 100vh;
                    box-sizing: border-box;
                }}

                .email-container {{
                    background-color: #181818;
                    border: 1px solid #3b4b3a;
                    border-radius: 12px;
                    padding: 28px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    max-width: 600px;
                    margin: 0 auto;
                }}

                .brand-header {{
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #2a3829;
                    padding-bottom: 16px;
                    margin-bottom: 20px;
                }}

                .brand-logo {{
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 16px;
                    color: #00e55b;
                    letter-spacing: 1px;
                }}

                h2 {{
                    color: #e5e2e1;
                    font-size: 20px;
                    font-weight: 700;
                    margin-top: 0;
                    margin-bottom: 10px;
                }}

                p {{
                    font-size: 14px;
                    color: #b9ccb5;
                    line-height: 1.6;
                    margin: 10px 0;
                }}

                .status-up {{
                    background-color: rgba(0, 229, 91, 0.15);
                    color: #00e55b;
                    border: 1px solid rgba(0, 229, 91, 0.4);
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                }}

                .status-down {{
                    background-color: rgba(237, 33, 0, 0.15);
                    color: #ED2100;
                    border: 1px solid rgba(237, 33, 0, 0.4);
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                }}

                .data-card {{
                    background-color: #0e0e0e;
                    border: 1px solid #2a3829;
                    border-radius: 8px;
                    padding: 16px;
                    margin: 18px 0;
                    font-family: 'Courier New', Courier, monospace;
                }}

                .data-row {{
                    display: flex;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                    font-size: 13px;
                    line-height: 1.5;
                }}

                .data-row:last-child {{
                    margin-bottom: 0;
                }}

                .data-label {{
                    color: #849581;
                    width: 140px;
                    font-weight: bold;
                }}

                .data-value {{
                    color: #e5e2e1;
                    flex: 1;
                }}

                .response-box {{
                    background-color: #121d12;
                    border-left: 3px solid #00e55b;
                    padding: 12px 16px;
                    border-radius: 4px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 13px;
                    color: #e5e2e1;
                    margin: 14px 0;
                }}

                .link {{
                    color: #9fcaff;
                    text-decoration: none;
                }}

                .link:hover {{
                    text-decoration: underline;
                }}

                .action-button-up {{
                    display: inline-block;
                    background-color: #00e55b;
                    color: #003911;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 13px;
                    padding: 10px 20px;
                    border-radius: 6px;
                    text-decoration: none;
                    margin-top: 14px;
                }}

                .action-button-down {{
                    display: inline-block;
                    background-color: #ED2100;
                    color: #ffffff;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 13px;
                    padding: 10px 20px;
                    border-radius: 6px;
                    text-decoration: none;
                    margin-top: 14px;
                }}

                .footer {{
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11px;
                    color: #888888;
                    text-align: center;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #222d21;
                }}
            </style>
        </head>
        <body>
            <div class="{wrapper_class}">
                <div class="email-container">
                    <div class="brand-header">
                        <div class="brand-logo" style="display: flex; align-items: center; gap: 8px;">
                            <img src="https://raw.githubusercontent.com/hrshbrdhnn/pulsecheck/master/public/logo.png" width="24" height="24" style="vertical-align: middle; border: 0;" alt="Logo" />
                            <span>{app_name}</span>
                        </div>
                        <div class="{status_class}">{monitor_status}</div>
                    </div>

                    <h2>Monitor Status Alert</h2>
                    <p>Dear Team,</p>
                    <p>We would like to inform you about the current status of the monitored endpoint:</p>

                    <div class="data-card">
                        <div class="data-row">
                            <span class="data-label">MONITOR NAME:</span>
                            <span class="data-value">{monitor_name}</span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">MONITOR URL:</span>
                            <span class="data-value"><a href="{monitor_url}" class="link">{monitor_url}</a></span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">STATUS:</span>
                            <span class="data-value"><span
                                    class="{status_class}"><strong>{monitor_status}</strong></span></span>
                        </div>
                        <div class="data-row" style="margin-top: 6px;">
                            <span class="data-label">RESPONSE:</span>
                            <span class="data-value" style="color: #00e55b;">{monitor_response}</span>
                        </div>
                    </div>

                    <div class="response-box">
                        {additional_text}
                    </div>

                    <p>Please don't hesitate to contact us or log in to your dashboard if you need further diagnostic details.
                    </p>

                    <div>
                        <a href="{monitor_url}" class="action-button-up">View Live Status Page ↗</a>
                    </div>

                    <p style="margin-top: 24px;">Best regards,<br />
                        <strong style="color: #e5e2e1;">SRE Monitoring Admin</strong><br />
                        <span style="font-family: monospace; font-size: 12px; color: #849581;">{app_name} &bull; <a
                                href="mailto:{support_email}">{support_email}</a></span>
                    </p>
                </div>

                <div class="footer">
                    <p>&copy; 2026 | {app_name}. Automated Infrastructure Alert System.</p>
                </div>
            </div>
        </body>
    </html>
    """

def send_mail(monitor_status: str, monitor_name: str, monitor_url: str, monitor_response: str, custom_emails: str = None):
    """Sends status change notification email via Resend."""
    db = SessionLocal()
    try:
        app_name = get_config_val(db, "app_name", os.getenv("APP_NAME", ""))
        support_email = get_config_val(db, "support_email", os.getenv("SUPPORT_EMAIL", ""))
        env_from = f"Alert <alert@{support_email.split('@')[-1]}>" if '@' in support_email else "Alert <alert@localhost>"
        alert_from_email = get_config_val(db, "alert_from_email", os.getenv("ALERT_FROM_EMAIL", env_from))
        global_admin_email = get_config_val(db, "default_email_addresses", os.getenv("GLOBAL_ADMIN_EMAIL", ""))

        if custom_emails:
            raw_emails = custom_emails.replace(";", ",")
            to_emails = [e.strip() for e in raw_emails.split(",") if e.strip()]
        else:
            # Fetch active notification emails from DB
            notifications = db.query(Notification).filter(Notification.active == True).all()
            if notifications:
                to_emails = [n.email for n in notifications]
            else:
                raw_emails = global_admin_email.replace(";", ",")
                to_emails = [e.strip() for e in raw_emails.split(",") if e.strip()]
        
        if not to_emails:
            return None

        subject = (
            f"{monitor_name} Is Back Up - All Systems Normal"
            if monitor_status == 'UP'
            else f"{monitor_name} Is Down - Urgent Action Required"
        )
        
        html_content = mail_template(monitor_status, monitor_name, monitor_url, monitor_response, app_name, support_email)
        
        # Prepare mail payload
        params = {
            "from": alert_from_email,
            "to": to_emails,
            "subject": subject,
            "html": html_content
        }
        
        # Send mail
        res = resend.Emails.send(params)
        return res
    except Exception as e:
        # Log to ErrorTable
        err_msg = str(e)
        print(f"Error sending email: {err_msg}")
        try:
            error_entry = ErrorTable(table_name="mail", err_text=err_msg)
            db.add(error_entry)
            db.commit()
        except Exception as db_err:
            print(f"Failed to log mail error to DB: {db_err}")
    finally:
        db.close()

def ssl_expiry_mail_template(monitor_name: str, monitor_url: str, days_left: int, expiration_date: str, app_name: str, support_email: str) -> str:
    """Generates the HTML email body for SSL Expiry warnings."""
    return f"""
    <!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SSL Certificate Expiration Warning</title>
        <style>
            body {{
                margin: 0;
                    padding: 0;
                    background-color: #0d0d0d;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #e5e2e1;
                }}
                .ssl-email-wrapper {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #e5e2e1;
                    background-color: #120e06;
                    border-top: 4px solid #f39c12;
                    margin: 0;
                    padding: 24px 12px;
                    min-height: 100vh;
                    box-sizing: border-box;
                }}
                .email-container {{
                    background-color: #181818;
                    border: 1px solid #3b4b3a;
                    border-radius: 12px;
                    padding: 28px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    max-width: 600px;
                    margin: 0 auto;
                }}
                .brand-header {{
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #2a3829;
                    padding-bottom: 16px;
                    margin-bottom: 20px;
                }}
                .brand-logo {{
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 16px;
                    color: #00e55b;
                    letter-spacing: 1px;
                }}
                .status-badge {{
                    background-color: rgba(243, 156, 18, 0.15);
                    color: #f39c12;
                    border: 1px solid rgba(243, 156, 18, 0.4);
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                }}
                h2 {{
                    color: #f39c12;
                    font-size: 20px;
                    font-weight: 700;
                    margin-top: 0;
                    margin-bottom: 10px;
                }}
                p {{
                    font-size: 14px;
                    color: #b9ccb5;
                    line-height: 1.6;
                    margin: 10px 0;
                }}
                .data-card {{
                    background-color: #0e0e0e;
                    border: 1px solid #2a3829;
                    border-radius: 8px;
                    padding: 16px;
                    margin: 18px 0;
                    font-family: 'Courier New', Courier, monospace;
                }}
                .data-row {{
                    display: flex;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                    font-size: 13px;
                    line-height: 1.5;
                }}
                .data-row:last-child {{
                    margin-bottom: 0;
                }}
                .data-label {{
                    color: #849581;
                    width: 140px;
                    font-weight: bold;
                }}
                .data-value {{
                    color: #e5e2e1;
                    flex: 1;
                }}
                .days-warning {{
                    font-size: 15px;
                    color: #f39c12;
                    font-weight: bold;
                    background-color: rgba(243, 156, 18, 0.1);
                    padding: 2px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(243, 156, 18, 0.3);
                }}
                .link {{
                    color: #9fcaff;
                    text-decoration: none;
                }}
                .link:hover {{
                    text-decoration: underline;
                }}
                .action-button {{
                    display: inline-block;
                    background-color: #f39c12;
                    color: #181818;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    font-size: 13px;
                    padding: 10px 20px;
                    border-radius: 6px;
                    text-decoration: none;
                    margin-top: 14px;
                }}
                .footer {{
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11px;
                    color: #888888;
                    text-align: center;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #222d21;
                }}
            </style>
        </head>
        <body>
            <div class="ssl-email-wrapper">
                <div class="email-container">
                    <div class="brand-header">
                        <div class="brand-logo" style="display: flex; align-items: center; gap: 8px;">
                            <img src="https://raw.githubusercontent.com/hrshbrdhnn/pulsecheck/master/public/logo.png" width="24" height="24" style="vertical-align: middle; border: 0;" alt="Logo" />
                            <span>{app_name}</span>
                        </div>
                        <div class="status-badge">SSL WARNING</div>
                    </div>

                    <h2>SSL Certificate Expiration Warning</h2>
                    <p>Dear Team,</p>
                    <p>We are writing to alert you that the SSL/TLS certificate for the following monitored host is expiring soon:</p>
                    
                    <div class="data-card">
                        <div class="data-row">
                            <span class="data-label">MONITOR NAME:</span>
                            <span class="data-value">{monitor_name}</span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">TARGET URL:</span>
                            <span class="data-value"><a href="{monitor_url}" class="link">{monitor_url}</a></span>
                        </div>
                        <div class="data-row">
                            <span class="data-label">EXPIRATION:</span>
                            <span class="data-value">{expiration_date}</span>
                        </div>
                        <div class="data-row" style="margin-top: 6px;">
                            <span class="data-label">TIME LEFT:</span>
                            <span class="data-value"><span class="days-warning">{days_left} Days Remaining</span></span>
                        </div>
                    </div>
                    
                    <p>Please ensure you renew the certificate as soon as possible to prevent operational downtime or browser security warnings.</p>

                    <div>
                        <a href="{monitor_url}" class="action-button">Manage SSL Certificate ↗</a>
                    </div>
            
                    <p style="margin-top: 24px;">Best regards,<br />
                    <strong style="color: #e5e2e1;">SRE Monitoring Admin</strong><br />
                    <span style="font-family: monospace; font-size: 12px; color: #849581;">{app_name} &bull; <a href="mailto:{support_email}" class="link">{support_email}</a></span></p>
                </div>
            
                <div class="footer">
                    <p>&copy; 2026 | {app_name}. Automated Infrastructure Alert System.</p>
                </div>
            </div>
        </body>
    </html>
    """

def send_ssl_expiry_mail(monitor_name: str, monitor_url: str, days_left: int, expiration_date: str, custom_emails: str = None):
    """Sends SSL expiration warning email via Resend."""
    db = SessionLocal()
    try:
        app_name = get_config_val(db, "app_name", os.getenv("APP_NAME", ""))
        support_email = get_config_val(db, "support_email", os.getenv("SUPPORT_EMAIL", ""))
        env_from = f"Alert <alert@{support_email.split('@')[-1]}>" if '@' in support_email else "Alert <alert@localhost>"
        alert_from_email = get_config_val(db, "alert_from_email", os.getenv("ALERT_FROM_EMAIL", env_from))
        global_admin_email = get_config_val(db, "default_email_addresses", os.getenv("GLOBAL_ADMIN_EMAIL", ""))

        if custom_emails:
            raw_emails = custom_emails.replace(";", ",")
            to_emails = [e.strip() for e in raw_emails.split(",") if e.strip()]
        else:
            notifications = db.query(Notification).filter(Notification.active == True).all()
            if notifications:
                to_emails = [n.email for n in notifications]
            else:
                raw_emails = global_admin_email.replace(";", ",")
                to_emails = [e.strip() for e in raw_emails.split(",") if e.strip()]
            
        if not to_emails:
            return None
            
        subject = f"SSL Certificate Warning: {monitor_name} Expires in {days_left} Days"
        html_content = ssl_expiry_mail_template(monitor_name, monitor_url, days_left, expiration_date, app_name, support_email)
        
        params = {
            "from": alert_from_email,
            "to": to_emails,
            "subject": subject,
            "html": html_content
        }
        
        res = resend.Emails.send(params)
        return res
    except Exception as e:
        err_msg = str(e)
        print(f"Error sending SSL expiry email: {err_msg}")
        try:
            error_entry = ErrorTable(table_name="mail", err_text=err_msg)
            db.add(error_entry)
            db.commit()
        except Exception as db_err:
            print(f"Failed to log SSL mail error to DB: {db_err}")
    finally:
        db.close()
