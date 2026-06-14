"""Verify Gmail SMTP credentials. Run from backend folder:
    ..\\venv\\Scripts\\python.exe scripts\\test_smtp.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER, SMTP_USE_SSL, SMTP_USE_TLS
from services.alert_notifier import _send_email, smtp_configured


def main() -> int:
    print("SMTP configured:", smtp_configured())
    print("Host:", SMTP_HOST, "Port:", SMTP_PORT, "SSL:", SMTP_USE_SSL, "TLS:", SMTP_USE_TLS)
    print("User:", SMTP_USER)
    print("From:", SMTP_FROM)
    print("Password length:", len(SMTP_PASSWORD), "(expect 16 for Gmail App Password)")

    if not smtp_configured():
        print("Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env")
        return 1

    to = input("Send test email to (your inbox): ").strip()
    if not to:
        print("No address given.")
        return 1

    ok, detail = _send_email(to, "Sentinel SMTP test", "If you see this, SMTP is working.")
    print("Result:", "OK" if ok else "FAILED")
    print(detail)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
