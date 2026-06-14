"""Adaptive loitering detection, runs on YOLO track results."""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np

SEQUENCE_LENGTH = 70
LOITERING_THRESHOLD = 85
SMOOTHING_WINDOW = 5
MIN_TRACK_CONF = 0.5


def _displacement(points):
    if len(points) < 2:
        return 0
    x1, y1 = points[0]
    xn, yn = points[-1]
    return math.hypot(xn - x1, yn - y1)


def _total_distance(points):
    dist = 0.0
    for i in range(1, len(points)):
        x1, y1 = points[i - 1]
        x2, y2 = points[i]
        dist += math.hypot(x2 - x1, y2 - y1)
    return dist


def _speed_variance(points):
    speeds = []
    for i in range(1, len(points)):
        x1, y1 = points[i - 1]
        x2, y2 = points[i]
        speeds.append(math.hypot(x2 - x1, y2 - y1))
    return float(np.var(speeds)) if len(speeds) >= 2 else 0.0


def _direction_reversals(points):
    reversals = 0
    previous_angle = None
    for i in range(1, len(points)):
        x1, y1 = points[i - 1]
        x2, y2 = points[i]
        angle = math.atan2(y2 - y1, x2 - x1)
        if previous_angle is not None and abs(angle - previous_angle) > 2.0:
            reversals += 1
        previous_angle = angle
    return reversals


def _motion_entropy(points):
    if len(points) < 5:
        return 0.0
    directions = []
    for i in range(1, len(points)):
        x1, y1 = points[i - 1]
        x2, y2 = points[i]
        angle = int(math.degrees(math.atan2(y2 - y1, x2 - x1)) / 30)
        directions.append(angle)
    _, counts = np.unique(directions, return_counts=True)
    probs = counts / len(directions)
    return float(-np.sum(probs * np.log2(probs)))


def _occupied_area(points):
    if len(points) < 2:
        return 0
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def _adaptive_loiter_time(reversals, entropy, speed_var, area, displacement_value, people_count):
    base_time = 30
    if reversals > 8:
        base_time -= 10
    if entropy > 2:
        base_time -= 5
    if area < 15000:
        base_time -= 5
    if displacement_value < 100:
        base_time += 10
    if speed_var < 5:
        base_time += 5
    if people_count > 10:
        base_time += 15
    return max(10, min(60, base_time))


def _suspicious_score(dwell_time, reversals, entropy, area, displacement_value, speed_var):
    score = (
        (dwell_time * 1.8)
        + (reversals * 12)
        + (entropy * 18)
        + (speed_var * 0.04)
    ) - ((displacement_value * 0.03) + (area * 0.00003))
    return max(score, 0)


def _smooth_trajectory(points):
    if len(points) < SMOOTHING_WINDOW:
        return points
    smoothed = []
    for i in range(len(points)):
        start = max(0, i - SMOOTHING_WINDOW)
        chunk = points[start : i + 1]
        avg_x = int(np.mean([p[0] for p in chunk]))
        avg_y = int(np.mean([p[1] for p in chunk]))
        smoothed.append((avg_x, avg_y))
    return smoothed


@dataclass
class LoiteringState:
    track_history: dict[int, deque] = field(default_factory=dict)
    track_times: dict[int, float] = field(default_factory=dict)
    suspicion_memory: dict[int, float] = field(default_factory=dict)
    alerted_ids: set[int] = field(default_factory=set)
    last_seen: dict[int, float] = field(default_factory=dict)


@dataclass
class LoiteringResult:
    frame_has_loitering: bool = False
    best_score: float = 0.0
    track_ids: list[int] = field(default_factory=list)


class LoiteringDetector:
    """Process YOLO person tracks; full-frame analysis."""

    def update(self, frame: np.ndarray, track_result, state: LoiteringState) -> LoiteringResult:
        out = LoiteringResult()
        current_time = time.time()

        # Cleanup stale tracks (10s threshold)
        stale_ids = [tid for tid, last in state.last_seen.items() if current_time - last > 10.0]
        for tid in stale_ids:
            state.track_history.pop(tid, None)
            state.track_times.pop(tid, None)
            state.suspicion_memory.pop(tid, None)
            state.alerted_ids.discard(tid)
            state.last_seen.pop(tid, None)

        boxes = track_result.boxes
        if boxes is None or boxes.id is None:
            return out

        ids = boxes.id.cpu().numpy()
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy() if boxes.conf is not None else None
        people_count = len(ids)

        for idx, (box, track_id) in enumerate(zip(xyxy, ids)):
            if confs is not None and float(confs[idx]) < MIN_TRACK_CONF:
                continue

            x1, y1, x2, y2 = map(int, box)
            track_id = int(track_id)
            center = (int((x1 + x2) / 2), int((y1 + y2) / 2))

            if track_id not in state.track_history:
                state.track_history[track_id] = deque(maxlen=SEQUENCE_LENGTH)
                state.track_times[track_id] = current_time
                state.suspicion_memory[track_id] = 0.0
            
            state.last_seen[track_id] = current_time
            state.track_history[track_id].append(center)
            points = _smooth_trajectory(list(state.track_history[track_id]))

            dwell_time = current_time - state.track_times[track_id]
            disp = _displacement(points)
            area = _occupied_area(points)
            reversals = _direction_reversals(points)
            entropy = _motion_entropy(points)
            speed_var = _speed_variance(points)

            score = _suspicious_score(dwell_time, reversals, entropy, area, disp, speed_var)
            state.suspicion_memory[track_id] = (
                state.suspicion_memory[track_id] * 0.97 + score * 0.03
            )
            final_score = state.suspicion_memory[track_id]

            required_time = _adaptive_loiter_time(
                reversals, entropy, speed_var, area, disp, people_count
            )

            is_loitering = (
                final_score > LOITERING_THRESHOLD
                and dwell_time > required_time
                and reversals > 2
                and track_id not in state.alerted_ids
            )

            if is_loitering:
                state.alerted_ids.add(track_id)
                out.frame_has_loitering = True
                out.track_ids.append(track_id)
                out.best_score = max(out.best_score, final_score)

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                cv2.putText(
                    frame,
                    f"LOITERING ID:{track_id} {final_score:.0f}",
                    (x1, max(y1 - 8, 12)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 0, 255),
                    2,
                )
        return out
