# PulseCheck - Uptime & Performance Watchdog

An advanced website, API, and network protocol monitoring application designed to track the availability, latency, and security configurations of your online assets.

PulseCheck consists of:
1. **Frontend**: A high-fidelity, real-time React dashboard with dedicated views for HTTP, Ping, TCP Port, SSL Expiration, and DNS Resolution checks.
2. **Backend**: An asynchronous FastAPI runner managing monitoring loops, database configurations, and mail alerts.

---

## Key Features

- **Six Protocol Trackers**:
  - **HTTP(s)**: Monitors page uptime and status codes.
  - **Ping (ICMP)**: Measures server network ping responsiveness.
  - **TCP Port**: Probes custom port connectivity (e.g. database connections, SSH).
  - **Keyword**: Verifies exact matching text strings inside HTTP response payloads.
  - **SSL Expiry**: Recursively queries and checks chain certificates, showing a dynamic bento-grid stats dashboard.
  - **DNS Query**: Performs DNS record set lookups and visualizes the full recursive query routing path.
- **WebSocket-Powered Dashboard**: Updates dashboard stats dynamically without reloading.
- **Selection Persistence**: Stores and keeps your selected monitor on page refresh.
- **Intelligent Log Filtering**: Reduces log clutter by displaying only the latest successful check and the latest failed check.
- **Timezone Synchronization**: Automatic conversion of raw database UTC timestamps into your local browser's timezone.

---

## Tech Stack & Libraries Used

### Frontend (React & TypeScript)
- **Framework**: `React 19`
- **Build Tool**: `Vite` (producing small minified chunks under 2s)
- **Styling**: `Tailwind CSS 4.0` (Vite CSS module integration)
- **Routing**: `React Router DOM 7`
- **Charts**: `Recharts` (custom stylized area grids)
- **Animations**: `Motion` (micro-interactions)
- **Icons**: Google Material Symbols Outlined

### Backend (FastAPI & Python)
- **Framework**: `FastAPI` (serving WebSockets and endpoints)
- **Server**: `Uvicorn`
- **Database ORM**: `SQLAlchemy`
- **SSL Parsing**: `cryptography` (DER decoder, issuer extraction, signature parser)
- **DNS Resolution**: Google DNS-over-HTTPS (DoH) API client + socket lookup fallback
- **Mail System**: `resend` (transactional alert templates)

---

## Database Fallback Mechanism

PulseCheck's backend dynamically selects its database engine based on the environment variables defined in `.env`:
1. **Production DB Pool**: If `DB_TYPE` matches `mysql` or `postgres`, the engine automatically initializes a pooled connection using `pymysql` or `psycopg2`.
2. **SQLite Auto-Fallback**: If `DB_TYPE` is left empty or omitted, the database engine **automatically falls back to SQLite** (`backend/database/db.sqlite`).
3. **Auto-Migrations**: On startup, SQLite automatically parses table PRAGMAs and runs ALTER scripts to create tables or columns (such as the custom `keyword` field) if they are missing from local configurations.

---

## Environment Variables (`backend/.env`)

Configure your connection secrets inside `backend/.env`:

```env
# Mail Notifications
RESEND_API_KEY=your_resend_api_key_here

# Server Configuration
PORT=3002

# --- Database Configurations ---
# Options: postgres, mysql. Leave empty to fallback to local SQLite.
DB_TYPE=
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=pulsecheck

# Alternatively, specify a direct connection string:
# DATABASE_URL=postgresql+psycopg2://user:pass@host:port/dbname

# --- Branding & Email Customizations (Optional) ---
# APP_NAME=PulseCheck
# SUPPORT_EMAIL=support@pulsecheck.watch
# ALERT_FROM_EMAIL=Alert <alert@pulsecheck.watch>
```

> [!NOTE]
> Global configurations (such as branding names, support contact points, alert dispatchers, and default recipient fallback email addresses) are stored in the `app_config` database table. You can configure these keys (`app_name`, `support_email`, `alert_from_email`, `default_email_addresses`) directly inside the database. If a key is empty or not configured, it will securely check the corresponding environment variable fallback inside the `backend/.env` file.

---

## Getting Started

### Backend Setup
1. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```
2. **Create and activate a virtual environment**:
   * macOS/Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   * Windows:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
3. **Install python packages**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the API server**:
   ```bash
   python run.py
   ```
   FastAPI will listen on **`http://localhost:3002`**.
   * Interactive Documentation: `http://localhost:3002/docs`
   * WebSocket stream: `ws://localhost:3002/ws`

### Frontend Setup
1. **Navigate to the root folder**:
   ```bash
   cd ..
   ```
2. **Install Node packages**:
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open the browser dashboard on **`http://localhost:3000`**.
4. **Production Build**:
   ```bash
   npm run build
   ```


## TODO
- [ ] Test every scenario thoroughly. Especially related to environment file, global config table and email notification.
- [ ] Work on other types of notification integration.
- [ ] Work on other types of monitoring integration.