"""SQLAlchemy engine + session for the hotel reservation system (PostgreSQL)."""

import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

PGHOST = os.getenv("PGHOST", "localhost")
PGDATABASE = os.getenv("PGDATABASE", "hoteldb")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "Gautham@123")
PGPORT = os.getenv("PGPORT", "5432")

# URL-encode user/password so special chars (e.g. '@' in the password) don't break the URL.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg2://{quote_plus(PGUSER)}:{quote_plus(PGPASSWORD)}@{PGHOST}:{PGPORT}/{PGDATABASE}",
)

# pool_pre_ping recycles dead connections (enterprise hygiene).
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_session():
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
