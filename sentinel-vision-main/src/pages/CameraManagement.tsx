import { useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Camera, Radio } from "lucide-react";
import { useBackendHealth } from "@/hooks/use-backend";
import { useEvents } from "@/hooks/use-events";
import { isSuspiciousActivity } from "@/lib/alerts";
import { Link } from "react-router-dom";

const PRIMARY_CAMERA = "CAM_01";

export default function CameraManagement() {
  const { data: backendUp } = useBackendHealth();
  const { data: events = [], isLoading } = useEvents(3000);

  const cameras = useMemo(() => {
    const map = new Map<
      string,
      { id: string; total: number; alerts: number; lastActivity?: string }
    >();

    map.set(PRIMARY_CAMERA, { id: PRIMARY_CAMERA, total: 0, alerts: 0 });

    for (const e of events) {
      const id = e.camera_id ?? PRIMARY_CAMERA;
      const row = map.get(id) ?? { id, total: 0, alerts: 0 };
      row.total += 1;
      if (isSuspiciousActivity(e.activity_type ?? "")) row.alerts += 1;
      if (e.timestamp && (!row.lastActivity || e.timestamp > row.lastActivity)) {
        row.lastActivity = e.timestamp;
      }
      map.set(id, row);
    }

    return [...map.values()].sort((a, b) => b.alerts - a.alerts || b.total - a.total);
  }, [events]);

  return (
    <DashboardLayout>
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" />
        CAMERAS — {cameras.length} DETECTED IN LOGS
      </h2>

      <p className="text-xs text-muted-foreground">
        Only <strong className="text-foreground">CAM-01</strong> has a live feed from the backend.
        Other IDs appear when events reference them.
      </p>

      {isLoading ? (
        <p className="text-xs font-mono text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cameras.map((cam, i) => {
            const isPrimary = cam.id === PRIMARY_CAMERA || cam.id === "CAM-01";
            const online = isPrimary && backendUp === true;

            return (
              <motion.div
                key={cam.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{cam.id}</p>
                  <span
                    className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      online
                        ? "bg-success/20 text-success"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {online && <Radio className="w-3 h-3" />}
                    {online ? "LIVE" : "LOGS ONLY"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="text-muted-foreground">Events</p>
                    <p className="text-foreground text-lg font-bold">{cam.total}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="text-muted-foreground">Alerts</p>
                    <p className="text-destructive text-lg font-bold">{cam.alerts}</p>
                  </div>
                </div>
                {cam.lastActivity && (
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    Last: {new Date(cam.lastActivity).toLocaleString()}
                  </p>
                )}
                {isPrimary && online && (
                  <Link
                    to="/monitoring"
                    className="block text-center text-xs text-primary hover:underline font-mono"
                  >
                    OPEN LIVE FEED →
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
