import { motion } from "framer-motion";
import { Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { LiveVideo } from "@/components/LiveVideo";
import { useBackendHealth } from "@/hooks/use-backend";
import { useEvents } from "@/hooks/use-events";
import { isAlertRecent } from "@/lib/alerts";

export function LiveFeedPanel() {
  const { data: backendUp } = useBackendHealth();
  const { uiAlerts } = useEvents();
  const latest = uiAlerts[0];
  const showOverlay = latest && isAlertRecent(latest, 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-pulse-glow" />
          LIVE SURVEILLANCE
        </h2>
        <Link
          to="/monitoring"
          className="text-[10px] font-mono text-primary hover:underline"
        >
          FULL SCREEN →
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative aspect-video rounded-lg overflow-hidden border ${
          showOverlay ? "border-destructive/50 glow-danger" : "border-border"
        } bg-secondary/50`}
      >
        <div className="relative w-full h-full min-h-[240px]">
          <LiveVideo offline={backendUp === false} label="CAM-01" />
          {showOverlay && (
            <div className="absolute bottom-12 left-3 bg-destructive text-destructive-foreground text-[9px] font-mono px-1.5 py-0.5 rounded z-10 transition-opacity">
              {latest.type}
              {latest.confidence !== undefined
                ? ` • ${(latest.confidence * 100).toFixed(0)}%`
                : ""}
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent">
          <span className="text-[10px] font-mono text-muted-foreground">
            CAM-01 — {backendUp ? "Live" : "Backend offline"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
