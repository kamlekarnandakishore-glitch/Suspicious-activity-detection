"""Webcam vs uploaded video file — single active capture for the live feed."""

from __future__ import annotations

import threading
from pathlib import Path

import cv2

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


class VideoSourceManager:
    def __init__(self, webcam_index: int = 0) -> None:
        self._lock = threading.Lock()
        self._webcam_index = webcam_index
        self._mode: str = "webcam"
        self._capture: cv2.VideoCapture | None = None
        self._file_path: Path | None = None
        self._file_name: str | None = None
        self._ip_url: str | None = None
        self._revision = 0
        self._webcam_available = False
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self._open_webcam()

    def _bump(self) -> None:
        self._revision += 1

    def _open_webcam(self) -> None:
        with self._lock:
            if self._capture is not None:
                self._capture.release()
            cap = cv2.VideoCapture(self._webcam_index)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self._capture = cap
            self._mode = "webcam"
            self._file_path = None
            self._file_name = None
            self._ip_url = None
            self._webcam_available = cap.isOpened()
            self._bump()

    def use_webcam(self) -> None:
        self._open_webcam()

    def use_file(self, path: Path, display_name: str) -> None:
        path = path.resolve()
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported format. Use: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        with self._lock:
            if self._capture is not None:
                self._capture.release()
            cap = cv2.VideoCapture(str(path))
            if not cap.isOpened():
                raise ValueError("Could not open video file")
            self._capture = cap
            self._mode = "file"
            self._file_path = path
            self._file_name = display_name
            self._ip_url = None
            self._bump()

    def use_ip_cam(self, url: str) -> None:
        with self._lock:
            if self._capture is not None:
                self._capture.release()
            cap = cv2.VideoCapture(url)
            if not cap.isOpened():
                raise ValueError("Could not open IP Camera stream")
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self._capture = cap
            self._mode = "ip_cam"
            self._file_path = None
            self._file_name = None
            self._ip_url = url
            self._bump()

    def reopen_current_file(self) -> None:
        with self._lock:
            if self._mode != "file" or not self._file_path:
                raise ValueError("No video file loaded")
            name = self._file_name or self._file_path.name
            path = self._file_path
        self.use_file(path, name)

    def has_file(self) -> bool:
        return self._file_path is not None and self._file_path.exists()

    def read(self) -> tuple[bool, object | None]:
        with self._lock:
            cap = self._capture
            if cap is None or not cap.isOpened():
                return False, None

            ok, frame = cap.read()
            if ok:
                return True, frame

            if self._mode == "file":
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                return cap.read()

            return False, None

    def status(self) -> dict:
        with self._lock:
            opened = self._capture is not None and self._capture.isOpened()
            return {
                "mode": self._mode,
                "revision": self._revision,
                "webcam_available": self._webcam_available,
                "capture_open": opened,
                "file_name": self._file_name,
                "ip_url": self._ip_url,
                "has_file": self.has_file(),
            }


video_source = VideoSourceManager(webcam_index=0)
