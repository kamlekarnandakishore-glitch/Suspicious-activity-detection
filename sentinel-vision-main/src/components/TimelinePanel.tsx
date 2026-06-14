import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useEvents } from "@/hooks/use-events";
import { formatClock } from "@/lib/alerts";
import type { Severity } from "@/lib/alerts";

const dotColor: Record<Severity, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-primary",
};

export function TimelinePanel() {
  const { uiAlerts } = useEvents();
  const events = uiAlerts.slice(0, 8);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          EVENT TIMELINE
        </h3>
        <Link to="/logs" className="text-[10px] font-mono text-muted-foreground hover:text-primary">
          ALL LOGS →
        </Link>
      </div>

      <div className="space-y-0 max-h-64 overflow-y-auto scrollbar-thin">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono py-4">No events yet</p>
        ) : (
          events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 py-2 group cursor-pointer hover:bg-secondary/30 rounded-lg px-2 transition-colors"
            >
              <div className="flex flex-col items-center mt-1">
                <span className={`w-2 h-2 rounded-full ${dotColor[event.severity]}`} />
                {i < events.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{event.type}</p>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatClock(event.timestamp)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{event.camera}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
