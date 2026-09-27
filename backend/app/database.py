import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, SmallInteger, DateTime, ForeignKey, TypeDecorator
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# Setup logging with custom colors
class ColoredFormatter(logging.Formatter):
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    RESET = "\033[0m"
    
    COLORS = {
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: RED,
    }

    def format(self, record):
        orig_levelname = record.levelname
        color = self.COLORS.get(record.levelno, "")
        if color:
            record.levelname = f"{color}{orig_levelname}{self.RESET}"
        val = super().format(record)
        record.levelname = orig_levelname
        return val

logger = logging.getLogger("db_init")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = ColoredFormatter("%(levelname)s:%(name)s:%(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False

# Determine SQLite path dynamically relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(BASE_DIR, "../.env"))
load_dotenv(dotenv_path)

sqlite_path = os.path.abspath(os.path.join(BASE_DIR, "../database/db.sqlite"))
os.makedirs(os.path.dirname(sqlite_path), exist_ok=True)

db_type = os.getenv("DB_TYPE", "").lower().strip()
db_url = os.getenv("DATABASE_URL")

engine = None
connection_success = False

# Try database connection if configured
if db_url:
    try:
        logger.info("Attempting connection using DATABASE_URL...")
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        engine = create_engine(db_url, connect_args=connect_args)
        with engine.connect() as conn:
            pass
        connection_success = True
        logger.info("Successfully connected to database via DATABASE_URL.")
    except Exception as e:
        logger.error(f"Failed to connect via DATABASE_URL: {e}")
        engine = None

if not connection_success and db_type in ("mysql", "postgres", "postgresql"):
    host = os.getenv("DB_HOST", "localhost")
    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "")
    
    if db_type == "mysql":
        port = os.getenv("DB_PORT", "3306")
        # mysql+pymysql driver
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"
    else:  # postgres / postgresql
        port = os.getenv("DB_PORT", "5432")
        # postgresql+psycopg2 driver
        url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db_name}"
        
    try:
        logger.info(f"Attempting connection to {db_type.upper()} at {host}:{port}...")
        engine = create_engine(url)
        with engine.connect() as conn:
            pass
        connection_success = True
        logger.info(f"Successfully connected to {db_type.upper()} database.")
    except Exception as e:
        logger.error(f"Failed to connect to {db_type.upper()} database: {e}")
        engine = None

# Fallback to local SQLite
if not connection_success:
    logger.warning(f"External database not configured or connection failed. Falling back to local SQLite at: {sqlite_path}")
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SafeDateTime(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M:%S.%f")
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        val_str = value.strip()
        if " +" in val_str:
            val_str = val_str.replace(" +", "+")
        elif " -" in val_str:
            val_str = val_str.replace(" -", "-")
            
        try:
            return datetime.fromisoformat(val_str)
        except Exception:
            try:
                return datetime.strptime(val_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
            except Exception:
                return datetime.utcnow()

class Monitor(Base):
    __tablename__ = 'monitor'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=True)
    type = Column(String(20), nullable=True)
    url = Column(Text, nullable=True)
    interval = Column(Integer, nullable=False, default=20)
    timeout = Column(Integer, nullable=False, default=16)
    maxretries = Column(Integer, nullable=False, default=0)
    method = Column(Text, nullable=True)
    accepted_statuscodes_json = Column(Text, nullable=True)
    httpBodyEncoding = Column(String(20), nullable=True) # maps to httpBodyEncoding in JS
    body = Column(Text, nullable=True)
    headers = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_date = Column(SafeDateTime, nullable=True, default=datetime.utcnow)
    port = Column(Integer, nullable=True)
    keyword = Column(String(255), nullable=True)

    # Configurable notifications
    email_on_down = Column(Boolean, nullable=True, default=False)
    down_emails = Column(Text, nullable=True)
    ssl_expiry_alert_days = Column(Integer, nullable=True)
    ssl_expiry_alert_interval_days = Column(Integer, nullable=True)
    ssl_expiry_emails = Column(Text, nullable=True)
    ssl_expiry_last_notified = Column(SafeDateTime, nullable=True)

    # Relationships
    heartbeats = relationship("Heartbeat", back_populates="monitor", cascade="all, delete-orphan")
    tls_info = relationship("MonitorTlsInfo", back_populates="monitor", cascade="all, delete-orphan")

class Heartbeat(Base):
    __tablename__ = 'heartbeat'

    id = Column(Integer, primary_key=True, autoincrement=True)
    important = Column(Boolean, nullable=False, default=False)
    monitor_id = Column(Integer, ForeignKey('monitor.id', ondelete='CASCADE'), nullable=False)
    status = Column(SmallInteger, nullable=False) # 1 for UP, 0 for DOWN
    msg = Column(Text, nullable=True)
    time = Column(SafeDateTime, nullable=False, default=datetime.utcnow)
    ping = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=False, default=0)
    down_count = Column(Integer, nullable=False, default=0)
    is_ondemand = Column(Boolean, nullable=False, default=False)
    ai_summary = Column(Text, nullable=True)

    # Relationships
    monitor = relationship("Monitor", back_populates="heartbeats")

class Notification(Base):
    __tablename__ = 'notification'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=True)
    description = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    email = Column(String(255), nullable=False)
    timestamp = Column(SafeDateTime, nullable=True, default=datetime.utcnow)

class MonitorTlsInfo(Base):
    __tablename__ = 'monitor_tls_info'

    id = Column(Integer, primary_key=True, autoincrement=True)
    monitor_id = Column(Integer, ForeignKey('monitor.id', ondelete='CASCADE'), nullable=False)
    info_json = Column(Text, nullable=True)
    timestamp = Column(SafeDateTime, nullable=True, default=datetime.utcnow)

    # Relationships
    monitor = relationship("Monitor", back_populates="tls_info")

class ErrorTable(Base):
    __tablename__ = 'error'

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_name = Column(Text, nullable=False)
    err_text = Column(Text, nullable=False)
    timestamp = Column(SafeDateTime, nullable=True, default=datetime.utcnow)

class AppConfig(Base):
    __tablename__ = 'app_config'

    key = Column(String(255), primary_key=True)
    value = Column(Text, nullable=True)




# Helper to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Sync tables (creates if they do not exist, preserves data if they do)
def init_db():
    from sqlalchemy import text
    
    # Check and migrate monitor table NOT NULL columns first
    with engine.connect() as conn:
        try:
            table_exists = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='monitor'")).first()
            if table_exists:
                columns_info = conn.execute(text("PRAGMA table_info(monitor)")).fetchall()
                notnull_cols = [row[1] for row in columns_info if row[3] == 1 and row[1] in ("method", "accepted_statuscodes_json", "httpBodyEncoding")]
                if notnull_cols:
                    logger.info(f"Columns {notnull_cols} are NOT NULL. Recreating table to make them nullable...")
                    conn.execute(text("ALTER TABLE monitor RENAME TO monitor_old"))
                    Base.metadata.create_all(bind=engine)
                    conn.execute(text("""
                        INSERT INTO monitor (id, name, type, url, interval, timeout, maxretries, method, accepted_statuscodes_json, httpBodyEncoding, body, headers, active, created_date, port)
                        SELECT id, name, type, url, interval, timeout, maxretries, method, accepted_statuscodes_json, httpBodyEncoding, body, headers, active, created_date, port FROM monitor_old
                    """))
                    conn.execute(text("DROP TABLE monitor_old"))
                    conn.commit()
                    logger.info("Successfully recreated monitor table with nullable columns.")
        except Exception as e:
            logger.error(f"Failed to migrate monitor table columns to nullable: {e}")

    Base.metadata.create_all(bind=engine)
    
    # Seed AppConfig table from environment if missing, then verify
    import sys
    db = SessionLocal()
    try:
        app_name = os.getenv("APP_NAME", "")
        support_email_val = os.getenv("SUPPORT_EMAIL", "")
        env_from = f"Alert <alert@{support_email_val.split('@')[-1]}>" if (support_email_val and '@' in support_email_val) else ""
        alert_from_val = os.getenv("ALERT_FROM_EMAIL", env_from)
        
        seed_data = {
            "app_name": app_name,
            "support_email": support_email_val,
            "alert_from_email": alert_from_val,
            "default_email_addresses": os.getenv("GLOBAL_ADMIN_EMAIL", ""),
            "gemini_api_key": os.getenv("GEMINI_API_KEY", "")
        }
        
        # Seed keys if they don't exist, or update them if they exist but are currently blank/empty
        for k, v in seed_data.items():
            row = db.query(AppConfig).filter(AppConfig.key == k).first()
            if not row:
                db.add(AppConfig(key=k, value=v))
            elif (not row.value or not row.value.strip()) and v:
                row.value = v
        db.commit()
        
        # Verify if required keys are still missing or blank
        missing_keys = []
        for k in ["app_name", "support_email", "alert_from_email", "default_email_addresses"]:
            exists = db.query(AppConfig).filter(AppConfig.key == k).first()
            if not exists or not exists.value or not exists.value.strip():
                missing_keys.append(k)
                
        if missing_keys:
            print("\n\033[1;31m" + "="*80)
            print("CRITICAL ERROR: Global configurations are missing or incomplete in the 'app_config' database table!")
            print(f"Missing keys: {', '.join(missing_keys)}")
            print("Please configure these settings in your 'backend/.env' file or directly in the 'app_config' database table.")
            print("="*80 + "\033[0m\n")
            if "pytest" not in sys.modules:
                try:
                    os.kill(os.getppid(), 15)  # Send SIGTERM to parent uvicorn reloader process
                except Exception:
                    pass
                os._exit(1)
    except Exception as e:
        logger.error(f"Error initializing app configurations: {e}")
    finally:
        db.close()

    with engine.connect() as conn:
        try:
            # Migrate heartbeat
            hb_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(heartbeat)")).fetchall()]
            if "is_ondemand" not in hb_columns:
                conn.execute(text("ALTER TABLE heartbeat ADD COLUMN is_ondemand BOOLEAN NOT NULL DEFAULT 0"))
                conn.commit()
                logger.info("Migrated SQLite database: added is_ondemand column to heartbeat table.")
            if "ai_summary" not in hb_columns:
                conn.execute(text("ALTER TABLE heartbeat ADD COLUMN ai_summary TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added ai_summary column to heartbeat table.")
                
            # Migrate monitor
            mon_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(monitor)")).fetchall()]
            if "port" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN port INTEGER"))
                conn.commit()
                logger.info("Migrated SQLite database: added port column to monitor table.")
            if "keyword" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN keyword VARCHAR(255)"))
                conn.commit()
                logger.info("Migrated SQLite database: added keyword column to monitor table.")
            if "email_on_down" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN email_on_down BOOLEAN DEFAULT 0"))
                conn.commit()
                logger.info("Migrated SQLite database: added email_on_down column to monitor table.")
            if "down_emails" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN down_emails TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added down_emails column to monitor table.")
            if "ssl_expiry_alert_days" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN ssl_expiry_alert_days INTEGER"))
                conn.commit()
                logger.info("Migrated SQLite database: added ssl_expiry_alert_days column to monitor table.")
            if "ssl_expiry_alert_interval_days" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN ssl_expiry_alert_interval_days INTEGER"))
                conn.commit()
                logger.info("Migrated SQLite database: added ssl_expiry_alert_interval_days column to monitor table.")
            if "ssl_expiry_emails" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN ssl_expiry_emails TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added ssl_expiry_emails column to monitor table.")
            if "ssl_expiry_last_notified" not in mon_columns:
                conn.execute(text("ALTER TABLE monitor ADD COLUMN ssl_expiry_last_notified TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added ssl_expiry_last_notified column to monitor table.")

            # Migrate error
            err_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(error)")).fetchall()]
            if err_columns and "timestamp" not in err_columns:
                conn.execute(text("ALTER TABLE error ADD COLUMN timestamp TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added timestamp column to error table.")

            # Migrate monitor_tls_info
            tls_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(monitor_tls_info)")).fetchall()]
            if tls_columns and "timestamp" not in tls_columns:
                conn.execute(text("ALTER TABLE monitor_tls_info ADD COLUMN timestamp TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added timestamp column to monitor_tls_info table.")

            # Migrate notification
            notif_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(notification)")).fetchall()]
            if notif_columns and "timestamp" not in notif_columns:
                conn.execute(text("ALTER TABLE notification ADD COLUMN timestamp TEXT"))
                conn.commit()
                logger.info("Migrated SQLite database: added timestamp column to notification table.")
        except Exception as e:
            logger.error(f"Failed to auto-migrate database: {e}")
