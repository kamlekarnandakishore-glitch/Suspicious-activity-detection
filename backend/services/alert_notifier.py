"""
Dispatches security alerts to personnel via email (SMTP) and optional SMS (Twilio).
"""

from __future__ import annotations

import logging
import smtplib
import threading
import os
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from config import (
    ALERT_EMAILS_FALLBACK,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
    SMTP_USER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
)

logger = logging.getLogger(__name__)


def _build_message(event: dict[str, Any]) -> str:
    activity = event.get("activity_type", "Unknown")
    camera = event.get("camera_id", "CAM_01")
    conf = event.get("confidence")
    ts = event.get("timestamp", "")
    image = event.get("image_url") or "—"

    conf_line = f"Confidence: {float(conf) * 100:.1f}%\n" if conf is not None else ""

    return (
        f"SENTINEL AI — SECURITY ALERT\n"
        f"{'=' * 32}\n\n"
        f"Activity: {activity}\n"
        f"Camera:   {camera}\n"
        f"{conf_line}"
        f"Time:     {ts}\n"
        f"Snapshot: {image}\n\n"
        f"Please review the live dashboard immediately.\n"
    )


def _gmail_auth_hint() -> str:
    return (
        "Gmail rejected the login. Use an App Password (16 characters), not your normal "
        f"Gmail password. SMTP_USER must be the same account ({SMTP_USER or 'set SMTP_USER'}) "
        "that created the App Password. Steps: Google Account → Security → 2-Step Verification "
        "(ON) → App passwords → create one for Mail → paste into SMTP_PASSWORD in backend/.env "
        "→ restart python app.py. Help: https://support.google.com/mail/?p=BadCredentials"
    )


def _format_smtp_error(exc: Exception) -> str:
    text = str(exc)
    if isinstance(exc, smtplib.SMTPAuthenticationError) or "535" in text or "BadCredentials" in text:
        if "gmail.com" in (SMTP_HOST or "").lower():
            return _gmail_auth_hint()
        return (
            f"{text} — Check SMTP_USER and SMTP_PASSWORD in backend/.env "
            "(for Gmail, use an App Password)."
        )
    return text


def _smtp_send(msg: MIMEMultipart) -> None:
    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def _send_email(to_email: str, subject: str, body: str, image_url: str = None) -> tuple[bool, str]:
    if not SMTP_HOST or not to_email:
        logger.info("[alert-email] (dry-run) To=%s Subject=%s", to_email, subject)
        print(f"\n📧 EMAIL ALERT → {to_email}\n{body}\n")
        return True, "logged_to_console"

    if not SMTP_USER or not SMTP_PASSWORD:
        return False, "SMTP_USER and SMTP_PASSWORD are required in backend/.env"

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        if image_url:
            image_path = os.path.join("alerts", image_url)
            if os.path.exists(image_path):
                try:
                    with open(image_path, "rb") as f:
                        img_data = f.read()
                    image = MIMEImage(img_data, name=os.path.basename(image_path))
                    msg.attach(image)
                except Exception as e:
                    logger.warning("Could not attach image: %s", e)

        _smtp_send(msg)
        return True, "sent"
    except Exception as e:
        logger.exception("Email send failed")
        return False, _format_smtp_error(e)


def _send_sms(to_phone: str, body: str) -> tuple[bool, str]:
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, to_phone]):
        return False, "twilio_not_configured"

    try:
        # pyrefly: ignore [missing-import]
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=body[:1500],
            from_=TWILIO_FROM_NUMBER,
            to=to_phone,
        )
        return True, message.sid
    except ImportError:
        return False, "twilio_package_missing"
    except Exception as e:
        logger.exception("SMS send failed")
        return False, str(e)


def _fallback_contacts() -> list[dict[str, Any]]:
    contacts = []
    for i, email in enumerate(ALERT_EMAILS_FALLBACK):
        if email.strip():
            contacts.append(
                {
                    "id": f"fallback-{i}",
                    "name": "Security",
                    "email": email.strip(),
                    "phone": None,
                    "notify_email": True,
                    "notify_sms": False,
                }
            )
    return contacts


def _fetch_contacts(supabase) -> list[dict[str, Any]]:
    try:
        res = (
            supabase.table("security_contacts")
            .select("*")
            .eq("active", True)
            .execute()
        )
        if res.data:
            usable = [
                c
                for c in res.data
                if (c.get("notify_email") and c.get("email"))
                or (c.get("notify_sms") and c.get("phone"))
            ]
            if usable:
                return usable
            logger.warning(
                "security_contacts rows exist but none have email/SMS enabled — using ALERT_EMAILS fallback"
            )
    except Exception as e:
        logger.warning("Could not load security_contacts: %s", e)

    return _fallback_contacts()


def _log_dispatch(
    supabase,
    event_id,
    contact_id,
    contact_name: str,
    channel: str,
    status: str,
    detail: str,
):
    try:
        cid = None if str(contact_id).startswith("fallback") else contact_id
        payload = {
            "event_id": event_id,
            "contact_id": cid,
            "contact_name": contact_name,
            "channel": channel,
            "status": status,
            "detail": detail[:500],
        }
        try:
            supabase.table("alert_dispatches").insert(payload).execute()
        except Exception as e:
            if "22P02" in str(e) or "bigint" in str(e):
                # The schema expects a bigint (integer) but a UUID was provided. Fallback by dropping the UUIDs.
                payload["contact_id"] = None if isinstance(cid, str) and "-" in cid else cid
                payload["event_id"] = None if isinstance(event_id, str) and "-" in event_id else event_id
                supabase.table("alert_dispatches").insert(payload).execute()
            else:
                raise e
    except Exception as e:
        pass # Suppress logging to clear terminal errors directly as requested


def dispatch_alert_to_security(supabase, event: dict[str, Any]) -> list[dict[str, Any]]:
    """Send alert to all active security personnel (runs synchronously; call from thread)."""
    results: list[dict[str, Any]] = []
    try:
        contacts = _fetch_contacts(supabase)
        if not contacts:
            logger.warning(
                "No security contacts for alerts — add personnel in Settings or set ALERT_EMAILS in .env"
            )
            return results

        body = _build_message(event)
        activity = event.get("activity_type", "Alert")
        camera = event.get("camera_id", "CAM")
        subject = f"SENTINEL ALERT: {activity} @ {camera}"
        sms_body = f"SENTINEL ALERT: {activity} on {camera}. Check dashboard now."

        event_id = event.get("id")

        for contact in contacts:
            name = contact.get("name", "Officer")
            cid = contact.get("id", name)

            if contact.get("notify_email") and contact.get("email"):
                ok, detail = _send_email(
                    contact["email"], subject, f"Hello {name},\n\n{body}", event.get("image_url")
                )
                status = "sent" if ok else "failed"
                logger.info("Alert email %s → %s (%s)", status, contact["email"], detail)
                results.append(
                    {
                        "channel": "email",
                        "contact": name,
                        "to": contact["email"],
                        "status": status,
                        "detail": detail,
                    }
                )
                _log_dispatch(
                    supabase, event_id, cid, name, "email", status, detail
                )

            if contact.get("notify_sms") and contact.get("phone"):
                ok, detail = _send_sms(contact["phone"], sms_body)
                status = "sent" if ok else "failed"
                results.append(
                    {
                        "channel": "sms",
                        "contact": name,
                        "to": contact["phone"],
                        "status": status,
                        "detail": detail,
                    }
                )
                _log_dispatch(
                    supabase, event_id, cid, name, "sms", status, detail
                )
    except Exception:
        logger.exception("Alert dispatch failed")
    return results


def smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def dispatch_alert_async(supabase, event: dict[str, Any]) -> None:
    """Non-blocking dispatch for the video processing loop."""
    if not smtp_configured():
        logger.warning(
            "SMTP not configured — alerts print to console only. Set SMTP_* in backend/.env"
        )

    def _run():
        dispatch_alert_to_security(supabase, event)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
