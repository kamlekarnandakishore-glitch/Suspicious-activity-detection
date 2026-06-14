# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, Response, send_from_directory, request
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from werkzeug.utils import secure_filename

# pyrefly: ignore [missing-import]
import cv2
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# pyrefly: ignore [missing-import]
from ultralytics import YOLO
# pyrefly: ignore [missing-import]
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_KEY
from services.alert_notifier import dispatch_alert_async
from services.detection_pipeline import PipelineState, process_frame, reset_pipeline_state
from services.model_paths import PERSON_MODEL_PATH, VIOLENCE_MODEL_PATH, WEAPON_MODEL_PATH
from services.video_source import UPLOAD_DIR, video_source
from services.restricted_zone import zone_manager
from services.auth import (
    admin_configured,
    create_access_token,
    decode_token,
    require_admin,
    token_from_request,
    verify_admin_credentials,
)

# pyrefly: ignore [missing-import]
import numpy as np
import tensorflow as tf

# ============================================
# FLASK APP
# ============================================
app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type"],
)

# ============================================
# SUPABASE
# ============================================
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

# ============================================
# MODELS
# ============================================
person_model = YOLO(str(PERSON_MODEL_PATH if PERSON_MODEL_PATH.exists() else "yolov8s.pt"))
weapon_model = YOLO(str(WEAPON_MODEL_PATH))
violence_model = tf.keras.models.load_model(str(VIOLENCE_MODEL_PATH), safe_mode=False)
print(f"✓ Violence model: {VIOLENCE_MODEL_PATH.name}")
print(f"✓ Weapon model: {WEAPON_MODEL_PATH.name}")

CAMERA_ID = os.getenv("CAMERA_ID", "CAM_01")

_pipeline_state = PipelineState()

if not video_source.status()["webcam_available"]:
    print("⚠️ Webcam not accessible — upload a video file to analyze")

# ============================================
# ALERT LOGGING
# ============================================
def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(activity_type: str, confidence: float | None = None, image_url: str | None = None, severity: str = "LOW"):
    """Log one event; rate limiting is handled by IncidentAlertGate in the detection pipeline."""
    data = {
        "person_id": "unknown",
        "activity_type": activity_type,
        "confidence": float(confidence) if confidence is not None else None,
        "image_url": image_url,
        "camera_id": CAMERA_ID,
        "timestamp": _utc_iso(),
        "severity": severity,
    }

    try:
        response = supabase.table("events").insert(data).execute()
        event_row = response.data[0] if response.data else {**data}
        dispatch_alert_async(supabase, event_row)
        print(f"🚨 [{severity}] Alert logged: {activity_type}")
        return event_row
    except Exception as e:
        # If the 'severity' column doesn't exist yet, retry without it
        if "severity" in str(e):
            data.pop("severity", None)
            try:
                response = supabase.table("events").insert(data).execute()
                event_row = response.data[0] if response.data else {**data}
                event_row["severity"] = severity
                dispatch_alert_async(supabase, event_row)
                print(f"🚨 [{severity}] Alert logged: {activity_type}")
                return event_row
            except Exception as e2:
                print("❌ Supabase insert failed:", e2)
                return None
        print("❌ Supabase insert failed:", e)
        return None


# ============================================
# HOME ROUTE
# ============================================
@app.route("/")
def home():

    return jsonify({
        "message": "AI Surveillance Backend Running"
    })


# ============================================
# ADMIN AUTH
# ============================================
@app.route("/auth/login", methods=["POST"])
def auth_login():
    if not admin_configured():
        return (
            jsonify(
                {
                    "error": "Admin login not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and JWT_SECRET in backend/.env",
                }
            ),
            503,
        )

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if not verify_admin_credentials(email, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(email)
    return jsonify(
        {
            "token": token,
            "user": {"email": email.lower(), "role": "admin"},
        }
    )


@app.route("/auth/me", methods=["GET"])
def auth_me():
    token = token_from_request()
    payload = decode_token(token) if token else None
    if not payload or payload.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"email": payload.get("sub"), "role": "admin"})


# ============================================
# GET EVENTS
# ============================================
@app.route("/events")
@require_admin
def get_events():

    try:

        response = supabase.table("events") \
            .select("*") \
            .order("timestamp", desc=True) \
            .execute()

        return jsonify(response.data)

    except Exception as e:

        return jsonify({
            "error": str(e)
        })

# ============================================
# VIDEO STREAM GENERATOR
# ============================================
def _reset_pipeline_state() -> None:
    global _pipeline_state
    _pipeline_state = PipelineState()
    reset_pipeline_state(_pipeline_state)


def generate_frames():
    global _pipeline_state

    while True:
        success, frame = video_source.read()

        if not success or frame is None:
            print("❌ Failed to read frame from active source")
            time.sleep(0.5)
            continue

        annotated_frame = process_frame(
            frame,
            _pipeline_state,
            person_model=person_model,
            weapon_model=weapon_model,
            violence_model=violence_model,
            log_event_fn=log_event,
        )

        ret, buffer = cv2.imencode(".jpg", annotated_frame)
        if not ret:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )

# ============================================
# VIDEO FEED ROUTE
# ============================================
@app.route("/video_feed")
@require_admin
def video_feed():

    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


# ============================================
# VIDEO SOURCE (webcam vs uploaded file)
# ============================================
@app.route("/analysis/status", methods=["GET"])
@require_admin
def analysis_status():
    return jsonify(video_source.status())


@app.route("/analysis/source", methods=["POST"])
@require_admin
def set_analysis_source():
    body = request.get_json(silent=True) or {}
    source = (body.get("source") or "").strip().lower()

    if source == "webcam":
        video_source.use_webcam()
        _reset_pipeline_state()
        return jsonify({"ok": True, **video_source.status()})

    if source == "file":
        if not video_source.has_file():
            return jsonify({"error": "Upload a video first"}), 400
        try:
            video_source.reopen_current_file()
            _reset_pipeline_state()
            return jsonify({"ok": True, **video_source.status()})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if source == "ip_cam":
        url = (body.get("url") or "").strip()
        if not url:
            return jsonify({"error": "Stream URL is required"}), 400
        try:
            video_source.use_ip_cam(url)
            _reset_pipeline_state()
            return jsonify({"ok": True, **video_source.status()})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    return jsonify({"error": "source must be 'webcam', 'file', or 'ip_cam'"}), 400


@app.route("/analysis/upload", methods=["POST"])
@require_admin
def upload_analysis_video():
    if "video" not in request.files:
        return jsonify({"error": "Missing 'video' file in form data"}), 400

    upload = request.files["video"]
    if not upload.filename:
        return jsonify({"error": "Empty filename"}), 400

    original = secure_filename(upload.filename)
    ext = Path(original).suffix.lower()
    if ext not in {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}:
        return jsonify({"error": "Unsupported video format"}), 400

    saved_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / saved_name
    upload.save(dest)

    try:
        video_source.use_file(dest, original)
        _reset_pipeline_state()
    except ValueError as e:
        dest.unlink(missing_ok=True)
        return jsonify({"error": str(e)}), 400

    return jsonify(
        {
            "ok": True,
            "message": "Video loaded for analysis",
            "original_name": original,
            **video_source.status(),
        }
    )

# ============================================
# RESTRICTED ZONES API
# ============================================
@app.route("/zones", methods=["GET"])
@require_admin
def list_zones():
    return jsonify(zone_manager.list_zones())

@app.route("/zones", methods=["POST"])
@require_admin
def create_zone():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "New Zone")
    points = body.get("points", [])
    if not points:
        return jsonify({"error": "points are required"}), 400
    
    zone = zone_manager.add_zone(
        name=name,
        points=points,
        enabled=body.get("enabled", True),
        trespass_delay_s=body.get("trespass_delay_s", 3.0),
        loiter_delay_s=body.get("loiter_delay_s", 10.0),
    )
    return jsonify(zone), 201

@app.route("/zones/<zone_id>", methods=["PUT"])
@require_admin
def update_zone_endpoint(zone_id):
    body = request.get_json(silent=True) or {}
    updated = zone_manager.update_zone(zone_id, body)
    if not updated:
        return jsonify({"error": "Zone not found"}), 404
    return jsonify(updated)

@app.route("/zones/<zone_id>", methods=["DELETE"])
@require_admin
def delete_zone_endpoint(zone_id):
    if zone_manager.delete_zone(zone_id):
        return jsonify({"ok": True})
    return jsonify({"error": "Zone not found"}), 404

# ============================================
# ALERT SNAPSHOTS
# ============================================
@app.route("/alerts/<path:filename>")
@require_admin
def alert_snapshot(filename):

    return send_from_directory("alerts", filename)


# ============================================
# SECURITY PERSONNEL API
# ============================================
@app.route("/security/contacts", methods=["GET"])
@require_admin
def list_security_contacts():
    try:
        res = (
            supabase.table("security_contacts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return jsonify(res.data or [])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/security/contacts", methods=["POST"])
@require_admin
def add_security_contact():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    row = {
        "name": name,
        "email": body.get("email") or None,
        "phone": body.get("phone") or None,
        "role": body.get("role") or "security",
        "notify_email": bool(body.get("notify_email", True)),
        "notify_sms": bool(body.get("notify_sms", False)),
        "active": True,
    }
    try:
        res = supabase.table("security_contacts").insert(row).execute()
        return jsonify(res.data[0] if res.data else row), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/security/contacts/<contact_id>", methods=["DELETE"])
@require_admin
def delete_security_contact(contact_id):
    try:
        supabase.table("security_contacts").delete().eq("id", contact_id).execute()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/security/dispatches", methods=["GET"])
@require_admin
def list_alert_dispatches():
    try:
        res = (
            supabase.table("alert_dispatches")
            .select("*")
            .order("sent_at", desc=True)
            .limit(50)
            .execute()
        )
        return jsonify(res.data or [])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/security/test-alert", methods=["POST"])
@require_admin
def test_security_alert():
    """Send a test alert to all configured security personnel."""
    from services.alert_notifier import dispatch_alert_to_security, smtp_configured

    test_event = {
        "activity_type": "TEST ALERT",
        "confidence": 0.99,
        "camera_id": CAMERA_ID,
        "timestamp": _utc_iso(),
        "image_url": None,
    }
    try:
        if not smtp_configured():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env and restart the server.",
                    }
                ),
                400,
            )
        results = dispatch_alert_to_security(supabase, test_event)
        if not results:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "No recipients. Add security contacts in Settings or ALERT_EMAILS in .env",
                    }
                ),
                400,
            )
        failed = [r for r in results if r.get("status") != "sent"]
        if failed:
            return jsonify({"ok": False, "results": results, "error": failed[0].get("detail")}), 502
        return jsonify({"ok": True, "message": "Test alert sent", "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# HEALTH CHECK
# ============================================
@app.route("/health")
def health():

    return jsonify({
        "status": "healthy"
    })

# ============================================
# RUN SERVER
# ============================================
if __name__ == "__main__":

    app.run(
        debug=True,
        use_reloader=False,
        host="0.0.0.0",
        port=5000
    )