"""Per-frame: YOLO track + violence H5 + loitering + weapon ONNX; one alert per incident."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np

from services.incident_alerts import IncidentAlertGate
from services.loitering_detector import LoiteringDetector, LoiteringState
from services.violence_detector import ViolenceState, predict_violence
from services.restricted_zone import zone_manager
from services.trespass_detector import TrespassState, check_restricted_zones

WEAPON_CONF_THRESHOLD = float(os.getenv("WEAPON_CONF_THRESHOLD", "0.65"))

_loitering = LoiteringDetector()


@dataclass
class PipelineState:
    violence: ViolenceState = field(default_factory=ViolenceState)
    loitering: LoiteringState = field(default_factory=LoiteringState)
    trespass: TrespassState = field(default_factory=TrespassState)
    alert_gate: IncidentAlertGate = field(default_factory=IncidentAlertGate)
    frame_count: int = 0
    last_weapon: tuple[str | None, float | None] = (None, None)
    last_violence: tuple[str, float | None] = ("NonViolence", None)


def _detect_weapon(frame, weapon_model) -> tuple[str | None, float | None]:
    results = weapon_model(frame, verbose=False)
    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return None, None

    best_name = None
    best_conf = 0.0
    for box in boxes:
        conf = float(box.conf[0])
        if conf < WEAPON_CONF_THRESHOLD:
            continue
        cls = int(box.cls[0])
        name = weapon_model.names.get(cls, str(cls))
        
        if name.lower() == "weapon":
            name = "Gun"

        if conf > best_conf:
            best_name, best_conf = name, conf

    if best_name is None:
        return None, None
    return f"Weapon: {best_name.title()}", best_conf


def process_frame(
    frame: np.ndarray,
    state: PipelineState,
    *,
    person_model,
    weapon_model,
    violence_model,
    log_event_fn,
) -> np.ndarray:
    state.frame_count += 1
    
    # Run tracking every frame (ByteTrack needs contiguous frames)
    results_person = person_model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        classes=[0],
        conf=0.35,
        iou=0.5,
        verbose=False,
    )
    annotated = results_person[0].plot()

    loiter_result = _loitering.update(annotated, results_person[0], state.loitering)
    
    # Check restricted zones
    zones = zone_manager.get_enabled_zones()
    zone_candidates = check_restricted_zones(frame, annotated, results_person[0], zones, state.trespass)
    
    # Run heavy models every 3 frames
    if state.frame_count % 3 == 0:
        state.last_violence = predict_violence(frame, violence_model, state.violence)
        state.last_weapon = _detect_weapon(frame, weapon_model)

    violence_label, violence_conf = state.last_violence
    weapon_type, weapon_conf = state.last_weapon

    # Dynamically scale HUD based on frame width (baseline 1280px)
    h, w = frame.shape[:2]
    scale = max(0.5, w / 1280.0)
    font_scale = 0.7 * scale
    thickness = max(1, int(2 * scale))
    line_spacing = int(35 * scale)
    x_offset = int(15 * scale)
    y_start = int(40 * scale)

    hud_lines = []
    
    if weapon_type:
        hud_lines.append((f"{weapon_type} ({weapon_conf:.2f})", (0, 0, 255)))

    vcolor = (0, 255, 0) if violence_label == "NonViolence" else (0, 0, 255)
    conf_txt = f" ({violence_conf * 100:.1f}%)" if violence_conf is not None else ""
    hud_lines.append((f"VIOLENCE: {violence_label}{conf_txt}", vcolor))

    if loiter_result.frame_has_loitering:
        hud_lines.append((f"LOITERING: {len(loiter_result.track_ids)} person(s)", (0, 0, 255)))

    # Ensure the background rectangle fits perfectly around the text
    max_text_width = 0
    for text, _ in hud_lines:
        (tw, _), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        if tw > max_text_width:
            max_text_width = tw

    bg_width = max_text_width + int(30 * scale)
    bg_height = int(10 * scale) + (len(hud_lines) * line_spacing)
    
    cv2.rectangle(
        annotated, 
        (int(10 * scale), int(10 * scale)), 
        (int(10 * scale) + bg_width, int(10 * scale) + bg_height), 
        (0, 0, 0), 
        -1
    )

    for i, (text, color) in enumerate(hud_lines):
        cv2.putText(
            annotated,
            text,
            (x_offset, y_start + i * line_spacing),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            color,
            thickness,
        )

    candidates: list[tuple[str, float | None]] = []
    if weapon_type:
        candidates.append((weapon_type, weapon_conf))
    if violence_label == "Violence" and violence_conf is not None:
        candidates.append(("Violence", violence_conf))
    if loiter_result.frame_has_loitering:
        score = loiter_result.best_score / 100.0 if loiter_result.best_score else 0.85
        candidates.append(("Loitering", min(score, 0.99)))

    # Add zone candidates (trespassing, restricted loitering)
    candidates.extend(zone_candidates)

    # Single alert per frame; 60s cooldown per incident type (weapon > violence > loitering)
    state.alert_gate.maybe_emit(candidates, frame, log_event_fn)

    return annotated


def reset_pipeline_state(state: PipelineState) -> None:
    state.violence = ViolenceState()
    state.loitering = LoiteringState()
    state.trespass = TrespassState()
    state.alert_gate.reset()
    state.frame_count = 0
    state.last_weapon = (None, None)
    state.last_violence = ("NonViolence", None)
