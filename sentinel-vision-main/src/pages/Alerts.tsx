import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  Download,
  CheckCircle,
  Play,
  X,
  Filter,
  Camera,
  ChevronDown,
  Radio,
} from "lucide-react";
import { useEvents } from "@/hooks/use-events";
import { alertImageUrl } from "@/lib/api";
import { severityStyles, type Severity, type UiAlert } from "@/lib/alerts";
import { useNotifications } from "@/contexts/NotificationsContext";

export default function Alerts() {
  const { uiAlerts, isLoading, isError, dataUpdatedAt } = useEvents(1500);
  const { notifications, markAllRead } = useNotifications();

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<UiAlert | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const alerts = useMemo(() => {
    const merged = new Map<string, UiAlert>();
    for (const a of uiAlerts) merged.set(a.id, a);
    for (const n of notifications) {
      if (!merged.has(n.id)) {
        merged.set(n.id, {
          id: n.id,
          type: n.type,
          camera: n.camera,
          time: n.time,
          timestamp: n.timestamp,
          severity: n.severity,
          confidence: n.confidence,
          imageUrl: n.imageUrl,
          description: n.description,
          reviewed: n.read,
        });
      }
    }
    return Array.from(merged.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((a) => ({
        ...a,
        reviewed: reviewedIds.has(a.id),
      }));
  }, [uiAlerts, notifications, reviewedIds]);

  useEffect(() => {
    if (alerts.length > 0 && !selectedAlert) {
      setSelectedAlert(alerts[0]);
    }
  }, [alerts, selectedAlert]);

  const filteredAlerts = alerts.filter(
    (a) => severityFilter === "all" || a.severity === severityFilter
  );

  const markReviewed = (id: string) => {
    setReviewedIds((prev) => new Set(prev).add(id));
    if (selectedAlert?.id === id) {
      setSelectedAlert((prev) => (prev ? { ...prev, reviewed: true } : null));
    }
  };

  const downloadEvidence = (alert: UiAlert) => {
    const data = `Alert Report\n============\nType: ${alert.type}\nCamera: ${alert.camera}\nTimestamp: ${alert.timestamp}\nSeverity: ${alert.severity}\nDescription: ${alert.description}`;
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alert-${alert.id}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const snapshotUrl = selectedAlert ? alertImageUrl(selectedAlert.imageUrl) : null;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          ALERTS — {filteredAlerts.length} EVENTS
          <span className="flex items-center gap-1 text-[10px] font-mono text-destructive ml-2">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE
          </span>
        </h2>
        {dataUpdatedAt > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
            Synced {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-3 h-3" />
            {severityFilter === "all"
              ? "All Severity"
              : severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterMenu && (
            <div className="absolute right-0 top-9 glass-card border border-border rounded-lg shadow-xl overflow-hidden z-10">
              {(["all", "high", "medium", "low"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSeverityFilter(s);
                    setShowFilterMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-xs hover:bg-secondary/80 transition-colors ${
                    severityFilter === s ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {s === "all" ? "All Severity" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-xs font-mono text-muted-foreground">Loading alerts from Supabase…</p>
      )}
      {isError && (
        <p className="text-xs font-mono text-destructive">
          Could not load alerts. Is the backend running on port 5000?
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {filteredAlerts.length === 0 && !isLoading ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              No alerts recorded yet.
            </div>
          ) : (
            filteredAlerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedAlert(alert)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${severityStyles[alert.severity]} ${
                  selectedAlert?.id === alert.id ? "ring-1 ring-primary/50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        alert.severity === "high"
                          ? "text-destructive"
                          : alert.severity === "medium"
                            ? "text-warning"
                            : "text-primary"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold">{alert.type}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono opacity-70">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {alert.camera}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.reviewed && <CheckCircle className="w-3.5 h-3.5 text-success" />}
                    <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-current/10">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="glass-card p-4 space-y-4 h-fit sticky top-6">
          {selectedAlert ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Alert Details</h3>
                <button onClick={() => setSelectedAlert(null)}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              </div>

              <div className="aspect-video rounded-lg bg-secondary/50 border border-border flex items-center justify-center relative overflow-hidden">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt="Alert snapshot"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage:
                          "linear-gradient(hsl(192 95% 55% / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(192 95% 55% / 0.1) 1px, transparent 1px)",
                        backgroundSize: "15px 15px",
                      }}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      NO SNAPSHOT — {selectedAlert.camera}
                    </span>
                  </>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground font-medium">{selectedAlert.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Camera</span>
                  <span className="text-foreground font-mono">{selectedAlert.camera}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="text-foreground font-mono">{selectedAlert.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Severity</span>
                  <span
                    className={`font-mono uppercase ${
                      selectedAlert.severity === "high"
                        ? "text-destructive"
                        : selectedAlert.severity === "medium"
                          ? "text-warning"
                          : "text-primary"
                    }`}
                  >
                    {selectedAlert.severity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={selectedAlert.reviewed ? "text-success" : "text-warning"}>
                    {selectedAlert.reviewed ? "Reviewed" : "Pending"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedAlert.description}
              </p>

              <div className="flex flex-col gap-2">
                {!selectedAlert.reviewed && (
                  <button
                    onClick={() => markReviewed(selectedAlert.id)}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Mark as Reviewed
                  </button>
                )}
                <button
                  onClick={() => downloadEvidence(selectedAlert)}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download Report
                </button>
                <button className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                  <Play className="w-3.5 h-3.5" /> Replay Clip
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">Select an alert to view details</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
