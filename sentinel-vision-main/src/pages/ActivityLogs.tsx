import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import {
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
} from "lucide-react";
import { useEvents } from "@/hooks/use-events";
import { activityToSeverity, type Severity } from "@/lib/alerts";

interface LogEntry {
  id: string;
  activityType: string;
  personId: string;
  timestamp: string;
  camera: string;
  severity: Severity;
  details: string;
}

type SortKey = "id" | "activityType" | "timestamp" | "camera" | "severity";

export default function ActivityLogs() {
  const { data: events, isLoading, isError } = useEvents();

  const allLogs: LogEntry[] = useMemo(() => {
    return (events ?? []).map((e, i) => ({
      id: String(e.id ?? `EVT-${1000 + i}`),
      activityType: e.activity_type ?? "Unknown",
      personId: e.person_id ?? "unknown",
      timestamp: e.timestamp
        ? new Date(e.timestamp).toLocaleString()
        : "—",
      camera: e.camera_id ?? "CAM_01",
      severity: activityToSeverity(e.activity_type ?? ""),
      details: `Detected ${e.activity_type ?? "activity"} on ${e.camera_id ?? "CAM_01"}${
        typeof e.confidence === "number"
          ? ` with AI confidence ${(e.confidence * 100).toFixed(1)}%.`
          : "."
      }`,
    }));
  }, [events]);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const perPage = 10;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allLogs
      .filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          l.activityType.toLowerCase().includes(q) ||
          l.camera.toLowerCase().includes(q) ||
          l.personId.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
  }, [allLogs, search, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const exportCsv = () => {
    const header = "Event ID,Activity Type,Person ID,Timestamp,Camera ID,Severity\n";
    const rows = filtered
      .map(
        (l) =>
          `${l.id},${l.activityType},${l.personId},${l.timestamp},${l.camera},${l.severity}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  const sevColor = { high: "text-destructive", medium: "text-warning", low: "text-primary" };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          ACTIVITY LOGS — {filtered.length} RECORDS
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search logs..."
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-40"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
          >
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="text-xs font-mono text-muted-foreground">Loading logs…</p>
      )}
      {isError && (
        <p className="text-xs font-mono text-destructive">Failed to load logs from backend.</p>
      )}

      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {(
                  [
                    ["id", "Event ID"],
                    ["activityType", "Activity"],
                    ["personId", "Person ID"],
                    ["timestamp", "Timestamp"],
                    ["camera", "Camera"],
                    ["severity", "Severity"],
                  ] as [SortKey | "personId", string][]
                ).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => key !== "personId" && toggleSort(key as SortKey)}
                    className={`px-4 py-3 text-left font-mono text-muted-foreground tracking-wider uppercase ${
                      key !== "personId" ? "cursor-pointer hover:text-foreground" : ""
                    }`}
                  >
                    {label}
                    {key !== "personId" && <SortIcon col={key as SortKey} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No log entries
                  </td>
                </tr>
              ) : (
                paged.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedLog(log)}
                    className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-primary">{log.id}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{log.activityType}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{log.personId}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{log.timestamp}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{log.camera}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono uppercase ${sevColor[log.severity]}`}>
                        {log.severity}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-[10px] font-mono text-muted-foreground">
            Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1}–
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3 h-3 text-muted-foreground" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded text-[10px] font-mono transition-colors ${
                  page === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="glass-card border border-border rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Event Details</h3>
              <button onClick={() => setSelectedLog(null)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {(
                [
                  ["Event ID", selectedLog.id],
                  ["Activity", selectedLog.activityType],
                  ["Person ID", selectedLog.personId],
                  ["Timestamp", selectedLog.timestamp],
                  ["Camera", selectedLog.camera],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-foreground font-mono">{v}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Severity</span>
                <span className={`font-mono uppercase ${sevColor[selectedLog.severity]}`}>
                  {selectedLog.severity}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{selectedLog.details}</p>
          </motion.div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
