"""Paths to detection model files (defaults under backend/test/)."""

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
VIOLENCE_MODEL_PATH = BACKEND_DIR / "violence_detection_model.h5"
WEAPON_MODEL_PATH = BACKEND_DIR / "best (1).onnx"
PERSON_MODEL_PATH = BACKEND_DIR / "yolov8s.pt"
