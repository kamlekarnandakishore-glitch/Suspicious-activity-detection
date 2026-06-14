"""One alert per frame; cooldown per incident type to avoid duplicate notifications."""

from __future__ import annotations

import os
import time
import threading
from typing import Callable

# Highest priority first
PRIORITY_ORDER = ("weapon", "trespassing", "restricted_loitering", "violence", "loitering")

# Severity mapping
SEVERITY_MAP: dict[str, str] = {
    "weapon": "HIGH",
    "trespassing": "HIGH",
    "restricted_loitering": "HIGH",
    "violence": "MEDIUM",
    "loitering": "LOW",
}

# Per-bucket cooldowns
DEFAULT_COOLDOWN_S = float(os.getenv("INCIDENT_ALERT_COOLDOWN_S", "60"))
BUCKET_COOLDOWN_S: dict[str, float] = {
    "weapon": DEFAULT_COOLDOWN_S,
    "violence": DEFAULT_COOLDOWN_S,
    "loitering": float(os.getenv("LOITERING_ALERT_COOLDOWN_S", "300")),  # 5 minutes
    "trespassing": float(os.getenv("TRESPASS_ALERT_COOLDOWN_S", "120")),  # 2 minutes
    "restricted_loitering": float(os.getenv("RESTRICTED_LOITER_COOLDOWN_S", "300")),  # 5 minutes
}


def _normalize_type(activity_type: str) -> str:
    lower = activity_type.lower()
    if "weapon" in lower or lower in {"knife", "gun"}:
        return "weapon"
    if "restricted area loiter" in lower or "restricted_loitering" in lower:
        return "restricted_loitering"
    if "trespass" in lower:
        return "trespassing"
    if "loiter" in lower:
        return "loitering"
    if "violence" in lower or "weaponized" in lower:
        return "violence"
    return lower.replace(" ", "_")[:48]


def get_severity(activity_type: str) -> str:
    """Return the severity level for a given activity type."""
    bucket = _normalize_type(activity_type)
    return SEVERITY_MAP.get(bucket, "LOW")


def _priority_key(activity_type: str) -> int:
    bucket = _normalize_type(activity_type)
    try:
        return PRIORITY_ORDER.index(bucket)
    except ValueError:
        return len(PRIORITY_ORDER)


class IncidentAlertGate:
    """Emit at most one Supabase/email alert per frame; debounce by incident category."""

    def __init__(self) -> None:
        self._last_emit: dict[str, float] = {}
        self._lock = threading.Lock()

    def maybe_emit(
        self,
        candidates: list[tuple[str, float | None]],
        frame,
        log_event_fn: Callable,
    ) -> str | None:
        """
        candidates: list of (activity_type, confidence) detected this frame.
        Returns the activity_type that was logged, or None.
        """
        if not candidates:
            return None

        now = time.time()
        ordered = sorted(candidates, key=lambda c: _priority_key(c[0]))

        target_activity = None
        target_confidence = None
        target_bucket = None

        with self._lock:
            for activity_type, confidence in ordered:
                bucket = _normalize_type(activity_type)
                cooldown = BUCKET_COOLDOWN_S.get(bucket, DEFAULT_COOLDOWN_S)
                last = self._last_emit.get(bucket, 0.0)
                if now - last < cooldown:
                    continue

                # Optimistically lock this bucket so other threads don't trigger it
                self._last_emit[bucket] = now
                target_activity = activity_type
                target_confidence = confidence
                target_bucket = bucket
                break  # Only one alert per frame

        if target_activity:
            import cv2
            os.makedirs("alerts", exist_ok=True)
            image_name = f"{target_bucket}_{int(now)}.jpg"
            cv2.imwrite(os.path.join("alerts", image_name), frame)

            severity = get_severity(target_activity)

            row = log_event_fn(
                activity_type=target_activity,
                confidence=target_confidence,
                image_url=image_name,
                severity=severity,
            )
            if row is None:
                # Revert if insert failed so it can naturally retry on next frame
                with self._lock:
                    self._last_emit[target_bucket] = 0.0
            return target_activity

        return None

    def reset(self) -> None:
        self._last_emit.clear()

