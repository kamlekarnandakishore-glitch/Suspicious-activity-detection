"""Detect persons entering restricted zones using YOLO track results."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np

from services.restricted_zone import RestrictedZone


@dataclass
class TrespassState:
    """Per-track-id entry timestamps inside each zone."""
    # {track_id: {zone_id: first_entered_timestamp}}
    zone_entry_times: dict[int, dict[str, float]] = field(default_factory=dict)
    # {(track_id, zone_id)} already alerted for trespass
    trespass_alerted: set[tuple[int, str]] = field(default_factory=set)
    # {(track_id, zone_id)} already alerted for restricted-area loitering
    loiter_alerted: set[tuple[int, str]] = field(default_factory=set)
    # {track_id: last_seen_timestamp}
    last_seen: dict[int, float] = field(default_factory=dict)


def _point_in_polygon(px: float, py: float, polygon: list[list[float]]) -> bool:
    """Ray-casting algorithm for point-in-polygon test."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _draw_zone_polygon(frame: np.ndarray, zone: RestrictedZone, color: tuple, thickness: int = 2):
    """Draw a zone polygon on the frame."""
    h, w = frame.shape[:2]
    pts = np.array(
        [[int(p[0] * w), int(p[1] * h)] for p in zone.points],
        dtype=np.int32,
    )
    # Semi-transparent fill
    overlay = frame.copy()
    cv2.fillPoly(overlay, [pts], color)
    cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)
    # Border
    cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=thickness)


def check_restricted_zones(
    frame: np.ndarray,
    annotated: np.ndarray,
    track_result,
    zones: list[RestrictedZone],
    state: TrespassState,
) -> list[tuple[str, float | None]]:
    """
    Check if tracked persons are inside restricted zones.
    Returns list of (activity_type, confidence) candidates for the alert gate.
    Also draws zone overlays and labels on the annotated frame.
    """
    candidates: list[tuple[str, float | None]] = []
    now = time.time()
    h, w = frame.shape[:2]
    scale = max(0.5, w / 1280.0)

    if not zones:
        return candidates

    boxes = track_result.boxes
    if boxes is None or boxes.id is None:
        # Still draw zones even without detections
        for zone in zones:
            _draw_zone_polygon(annotated, zone, (0, 255, 255))
            _draw_zone_label(annotated, zone, scale)
        return candidates

    ids = boxes.id.cpu().numpy()
    xyxy = boxes.xyxy.cpu().numpy()

    active_track_zone_pairs: set[tuple[int, str]] = set()

    for zone in zones:
        # Draw zone on frame
        is_breached = False

        for box, track_id in zip(xyxy, ids):
            x1, y1, x2, y2 = map(int, box)
            track_id = int(track_id)
            # Use foot center (bottom-center of bounding box) for zone check
            foot_x = (x1 + x2) / 2.0 / w
            foot_y = y2 / h

            in_zone = _point_in_polygon(foot_x, foot_y, zone.points)
            pair = (track_id, zone.id)
            active_track_zone_pairs.add(pair)
            state.last_seen[track_id] = now

            if in_zone:
                is_breached = True
                # Record entry timestamp
                if track_id not in state.zone_entry_times:
                    state.zone_entry_times[track_id] = {}
                if zone.id not in state.zone_entry_times[track_id]:
                    state.zone_entry_times[track_id][zone.id] = now

                dwell = now - state.zone_entry_times[track_id][zone.id]

                # Check for restricted-area loitering (higher severity, longer dwell)
                if dwell >= zone.loiter_delay_s and pair not in state.loiter_alerted:
                    state.loiter_alerted.add(pair)
                    candidates.append((f"Restricted Area Loitering: {zone.name}", 0.95))
                    # Draw red box around person
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 3)
                    _draw_person_label(annotated, x1, y1, track_id, f"ZONE LOITER {dwell:.0f}s", (0, 0, 255), scale)

                # Check for trespass (shorter dwell)
                elif dwell >= zone.trespass_delay_s and pair not in state.trespass_alerted:
                    state.trespass_alerted.add(pair)
                    candidates.append((f"Trespassing Detected: {zone.name}", 0.90))
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 165, 255), 3)
                    _draw_person_label(annotated, x1, y1, track_id, f"TRESPASS {dwell:.0f}s", (0, 165, 255), scale)

                elif dwell > 0.5:
                    # Person is in zone but hasn't triggered alert yet — show warning
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 255), 2)
                    _draw_person_label(annotated, x1, y1, track_id, f"IN ZONE {dwell:.0f}s", (0, 255, 255), scale)

            else:
                # Person left the zone — clear their entry time for this zone
                if track_id in state.zone_entry_times and zone.id in state.zone_entry_times[track_id]:
                    del state.zone_entry_times[track_id][zone.id]

        zone_color = (0, 0, 255) if is_breached else (0, 255, 255)
        _draw_zone_polygon(annotated, zone, zone_color)
        _draw_zone_label(annotated, zone, scale, breached=is_breached)

    # Cleanup stale track IDs that haven't been seen for 10 seconds
    stale_ids = [tid for tid, last in state.last_seen.items() if now - last > 10.0]
    for tid in stale_ids:
        state.zone_entry_times.pop(tid, None)
        state.last_seen.pop(tid, None)
        # Remove from alerted sets so if they return after 10s it triggers again
        state.trespass_alerted = {p for p in state.trespass_alerted if p[0] != tid}
        state.loiter_alerted = {p for p in state.loiter_alerted if p[0] != tid}

    return candidates


def _draw_zone_label(frame: np.ndarray, zone: RestrictedZone, scale: float, breached: bool = False):
    """Draw zone name label at top-left of the polygon."""
    h, w = frame.shape[:2]
    if not zone.points:
        return
    # Find top-left point
    min_x = int(min(p[0] for p in zone.points) * w)
    min_y = int(min(p[1] for p in zone.points) * h)

    font_scale = 0.5 * scale
    thickness = max(1, int(1.5 * scale))
    label = f"RESTRICTED: {zone.name}"
    color = (0, 0, 255) if breached else (0, 255, 255)

    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    cv2.rectangle(frame, (min_x, min_y - th - 8), (min_x + tw + 8, min_y), (0, 0, 0), -1)
    cv2.putText(frame, label, (min_x + 4, min_y - 4), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)


def _draw_person_label(frame: np.ndarray, x: int, y: int, track_id: int, text: str, color: tuple, scale: float):
    """Draw a label above a person's bounding box."""
    font_scale = 0.45 * scale
    thickness = max(1, int(1.5 * scale))
    label = f"ID:{track_id} {text}"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    cv2.rectangle(frame, (x, max(y - th - 10, 0)), (x + tw + 6, max(y - 2, th + 2)), (0, 0, 0), -1)
    cv2.putText(frame, label, (x + 3, max(y - 5, th + 5)), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)
