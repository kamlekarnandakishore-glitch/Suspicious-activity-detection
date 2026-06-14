"""Violence sequence model (violence_detection_model.h5)."""

from __future__ import annotations

import os
from collections import deque
from dataclasses import dataclass, field

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

SEQUENCE_LENGTH = 20
IMG_SIZE = 112
VIOLENCE_CLASS_INDEX = 1
VIOLENCE_THRESHOLD = float(os.getenv("VIOLENCE_THRESHOLD", "0.65"))


@dataclass
class ViolenceState:
    frames: deque = field(default_factory=lambda: deque(maxlen=SEQUENCE_LENGTH))
    pred_hist: list = field(default_factory=list)


def predict_violence(frame: np.ndarray, model, state: ViolenceState) -> tuple[str, float | None]:
    resized = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    processed = preprocess_input(rgb.astype(np.float32))
    state.frames.append(processed)

    if len(state.frames) < SEQUENCE_LENGTH:
        return "Collecting...", None

    batch = np.expand_dims(np.array(state.frames), axis=0)
    pred = model.predict(batch, verbose=0)[0]

    state.pred_hist.append(pred)
    if len(state.pred_hist) > 5:
        state.pred_hist.pop(0)

    smoothed = np.mean(np.array(state.pred_hist), axis=0)
    class_id = int(np.argmax(smoothed))
    conf = float(smoothed[class_id])

    if class_id == VIOLENCE_CLASS_INDEX and conf >= VIOLENCE_THRESHOLD:
        return "Violence", conf
    return "NonViolence", float(smoothed[0])
