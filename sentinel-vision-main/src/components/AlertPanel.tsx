import { motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useEvents } from "@/hooks/use-events";
import { severityStyles } from "@/lib/alerts";

export function AlertPanel() {
  const { uiAlerts, isLoading, isError } = useEvents(1500);
  const alerts = uiAlerts.slice(0, 6);
  const critical = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="glass-card p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          RECENT ALERTS
        </h3>
        <Link to="/alerts" className="text-[10px] font-mono text-destructive hover:underline">
          {critical > 0 ? `${critical} CRITICAL` : "VIEW ALL"}
        </Link>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
        {isLoading && (
          <p className="text-xs text-muted-foreground font-mono">Loading alerts…</p>
        )}
        {isError && (
          <p className="text-xs text-destructive font-mono">Could not load events</p>
        )}
        {!isLoading && !isError && alerts.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono">No alerts yet</p>
        )}
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${severityStyles[alert.severity]}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold">{alert.type}</p>
                <p className="text-[10px] opacity-70 font-mono mt-0.5">{alert.camera}</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] opacity-60">
                <Clock className="w-3 h-3" />
                {alert.time}
              </div>
            </div>
            <div className="mt-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-current/10">
                {alert.severity}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
