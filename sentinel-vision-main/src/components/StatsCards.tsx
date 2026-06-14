import { motion } from "framer-motion";
import { Shield, AlertTriangle, Camera, Activity } from "lucide-react";
import { useEvents } from "@/hooks/use-events";
import { useBackendHealth } from "@/hooks/use-backend";

export function StatsCards() {
  const { uiAlerts } = useEvents();
  const { data: backendUp } = useBackendHealth();

  const today = new Date().toDateString();
  const alertsToday = uiAlerts.filter((a) => {
    const d = new Date(a.timestamp);
    return !Number.isNaN(d.getTime()) && d.toDateString() === today;
  }).length;

  const highToday = uiAlerts.filter((a) => {
    if (a.severity !== "high") return false;
    const d = new Date(a.timestamp);
    return !Number.isNaN(d.getTime()) && d.toDateString() === today;
  }).length;

  const avgConf =
    uiAlerts.length > 0
      ? (
          (uiAlerts.reduce((s, a) => s + (a.confidence ?? 0), 0) / uiAlerts.length) *
          100
        ).toFixed(1)
      : "—";

  const stats = [
    {
      label: "Active Cameras",
      value: backendUp ? "1" : "0",
      change: backendUp ? "CAM-01 online" : "offline",
      icon: Camera,
      color: "text-primary",
    },
    {
      label: "Alerts Today",
      value: String(alertsToday),
      change: `${uiAlerts.length} total`,
      icon: AlertTriangle,
      color: "text-destructive",
    },
    {
      label: "Critical Today",
      value: String(highToday),
      change: "high severity",
      icon: Shield,
      color: "text-success",
    },
    {
      label: "Avg Confidence",
      value: avgConf === "—" ? "—" : `${avgConf}%`,
      change: "from logs",
      icon: Activity,
      color: "text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="glass-card p-4 group hover:border-primary/30 transition-all duration-300"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">
                {stat.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
            <stat.icon
              className={`w-5 h-5 ${stat.color} opacity-50 group-hover:opacity-100 transition-opacity`}
            />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 truncate">
            {stat.change}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
