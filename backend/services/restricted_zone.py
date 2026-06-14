"""In-memory restricted zone manager with thread-safe CRUD."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RestrictedZone:
    id: str
    name: str
    # Polygon points as list of [x_fraction, y_fraction] where 0..1 = percentage of frame
    points: list[list[float]]
    enabled: bool = True
    trespass_delay_s: float = 3.0  # seconds before triggering trespass alert
    loiter_delay_s: float = 30.0   # seconds before escalating to restricted-area loitering

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "points": self.points,
            "enabled": self.enabled,
            "trespass_delay_s": self.trespass_delay_s,
            "loiter_delay_s": self.loiter_delay_s,
        }


class RestrictedZoneManager:
    """Thread-safe CRUD for restricted zones stored in memory."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._zones: dict[str, RestrictedZone] = {}

    def list_zones(self) -> list[dict[str, Any]]:
        with self._lock:
            return [z.to_dict() for z in self._zones.values()]

    def get_zone(self, zone_id: str) -> dict[str, Any] | None:
        with self._lock:
            z = self._zones.get(zone_id)
            return z.to_dict() if z else None

    def add_zone(
        self,
        name: str,
        points: list[list[float]],
        enabled: bool = True,
        trespass_delay_s: float = 3.0,
        loiter_delay_s: float = 30.0,
    ) -> dict[str, Any]:
        zone_id = uuid.uuid4().hex[:12]
        zone = RestrictedZone(
            id=zone_id,
            name=name,
            points=points,
            enabled=enabled,
            trespass_delay_s=trespass_delay_s,
            loiter_delay_s=loiter_delay_s,
        )
        with self._lock:
            self._zones[zone_id] = zone
        return zone.to_dict()

    def update_zone(self, zone_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            zone = self._zones.get(zone_id)
            if zone is None:
                return None
            if "name" in updates:
                zone.name = updates["name"]
            if "points" in updates:
                zone.points = updates["points"]
            if "enabled" in updates:
                zone.enabled = bool(updates["enabled"])
            if "trespass_delay_s" in updates:
                zone.trespass_delay_s = float(updates["trespass_delay_s"])
            if "loiter_delay_s" in updates:
                zone.loiter_delay_s = float(updates["loiter_delay_s"])
            return zone.to_dict()

    def delete_zone(self, zone_id: str) -> bool:
        with self._lock:
            return self._zones.pop(zone_id, None) is not None

    def get_enabled_zones(self) -> list[RestrictedZone]:
        """Return only enabled zones (for use by the detection pipeline)."""
        with self._lock:
            return [z for z in self._zones.values() if z.enabled]


# Global singleton
zone_manager = RestrictedZoneManager()
