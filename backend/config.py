import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env when the server starts (required for SMTP, ALERT_EMAILS, etc.)
load_dotenv(Path(__file__).resolve().parent / ".env")

_DEFAULT_SUPABASE_URL = "https://kmtxpvbwqhqawdbqtkjs.supabase.co"
_DEFAULT_SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdHhwdmJ3cWhxYXdkYnF0a2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODE2MDQsImV4cCI6MjA5NDc1NzYwNH0.7onflZGn73fGhc3kugdT9pv0fXfFnoR7Iw-sOAfy87g"
)


def _valid_supabase_url(url: str | None) -> bool:
    return bool(url and url.startswith("https://") and ".supabase.co" in url)


def _valid_supabase_key(key: str | None) -> bool:
    return bool(key and key.startswith("eyJ") and len(key) > 100)


_env_url = (os.getenv("SUPABASE_URL") or "").strip().strip('"')
_env_key = (os.getenv("SUPABASE_KEY") or "").strip().strip('"')

SUPABASE_URL = _env_url if _valid_supabase_url(_env_url) else _DEFAULT_SUPABASE_URL
SUPABASE_KEY = _env_key if _valid_supabase_key(_env_key) else _DEFAULT_SUPABASE_KEY

# Comma-separated fallback emails if security_contacts table is empty
ALERT_EMAILS_FALLBACK = [
    e.strip()
    for e in (os.getenv("ALERT_EMAILS") or "").split(",")
    if e.strip()
]

def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip().strip('"')


# SMTP — Gmail: smtp.gmail.com + App Password (https://myaccount.google.com/apppasswords)
SMTP_HOST = _env("SMTP_HOST")
SMTP_PORT = int(_env("SMTP_PORT", "587"))
SMTP_USER = _env("SMTP_USER").lower()  # must match the Google account that owns the App Password
# Gmail app passwords are often pasted with spaces — strip them
SMTP_PASSWORD = _env("SMTP_PASSWORD").replace(" ", "")
SMTP_FROM = _env("SMTP_FROM", SMTP_USER)
SMTP_USE_TLS = _env("SMTP_USE_TLS", "true").lower() == "true"
# Optional: port 465 + SSL instead of 587 + STARTTLS (set SMTP_USE_SSL=true)
SMTP_USE_SSL = _env("SMTP_USE_SSL", "false").lower() == "true"

# Twilio SMS (optional)
TWILIO_ACCOUNT_SID = _env("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = _env("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = _env("TWILIO_FROM_NUMBER")

# Admin dashboard login (set strong values in production)
ADMIN_EMAIL = _env("ADMIN_EMAIL", "admin@sentinel.local").lower()
ADMIN_PASSWORD = _env("ADMIN_PASSWORD")
JWT_SECRET = _env("JWT_SECRET", "change-this-jwt-secret-in-production")
JWT_EXPIRE_HOURS = int(_env("JWT_EXPIRE_HOURS", "24") or "24")