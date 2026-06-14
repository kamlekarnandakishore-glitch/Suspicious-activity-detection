import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { BarChart3, Radio } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { useEvents } from "@/hooks/use-events";
import {
  analyticsSummary,
  buildActivityPie,
  buildCameraAlerts,
  buildMonthlySeries,
  buildWeeklySeries,
} from "@/lib/analytics";

const tooltipStyle = {
  background: "hsl(222, 44%, 9%)",
  border: "1px solid hsl(222, 30%, 18%)",
  borderRadius: "8px",
  fontSize: "11px",
  fontFamily: "JetBrains Mono",
};

const emptyTimePoint = { alerts: 0, normal: 0 };

export default function Analytics() {
  const { data: events = [], isLoading, isFetching } = useEvents(3000);
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);

  const weeklyData = useMemo(() => buildWeeklySeries(events), [events]);
  const monthlyData = useMemo(() => buildMonthlySeries(events), [events]);
  const pieData = useMemo(() => buildActivityPie(events), [events]);
  const cameraAlerts = useMemo(() => buildCameraAlerts(events), [events]);
  const summary = useMemo(() => analyticsSummary(events), [events]);

  const chartData = range === "weekly" ? weeklyData : monthlyData;
  const xKey = range === "weekly" ? "day" : "week";
  const hasEvents = events.length > 0;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          ANALYTICS DASHBOARD
          <span className="flex items-center gap-1 text-[10px] font-mono text-success font-normal">
            <Radio className={`w-3 h-3 ${isFetching ? "animate-pulse" : ""}`} />
            LIVE
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-mono text-muted-foreground">
            {summary.total} events · {summary.suspicious} alerts · {summary.normal} normal
          </p>
          <div className="flex items-center gap-2 bg-secondary rounded-lg p-0.5">
            {(["weekly", "monthly"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === r ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs font-mono text-muted-foreground">Loading analytics…</p>
      ) : !hasEvents ? (
        <p className="text-xs font-mono text-muted-foreground p-6 border border-dashed border-border rounded-lg text-center">
          No events yet. Start the backend with camera detection to populate real-time analytics.
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 space-y-3"
        >
          <h3 className="text-xs font-semibold text-foreground font-mono tracking-wider">
            ALERTS OVER TIME
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData.length ? chartData : [{ ...emptyTimePoint, [xKey]: "—" }]}>
              <defs>
                <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 85%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 85%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis
                dataKey={xKey}
                stroke="hsl(215, 20%, 55%)"
                fontSize={10}
                fontFamily="JetBrains Mono"
              />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={10} fontFamily="JetBrains Mono" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="alerts"
                stroke="hsl(0, 85%, 55%)"
                fill="url(#alertGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="normal"
                stroke="hsl(192, 95%, 55%)"
                fill="transparent"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 space-y-3"
        >
          <h3 className="text-xs font-semibold text-foreground font-mono tracking-wider">
            ACTIVITY DISTRIBUTION
          </h3>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono py-12 text-center">
              No suspicious activity recorded yet
            </p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(_, idx) =>
                      setSelectedSlice(
                        pieData[idx].name === selectedSlice ? null : pieData[idx].name
                      )
                    }
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        opacity={selectedSlice && selectedSlice !== entry.name ? 0.3 : 1}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1 max-h-[200px] overflow-y-auto scrollbar-thin">
                {pieData.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      setSelectedSlice(p.name === selectedSlice ? null : p.name)
                    }
                    className={`flex items-center justify-between w-full text-xs px-2 py-1 rounded transition-opacity ${
                      selectedSlice && selectedSlice !== p.name ? "opacity-40" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: p.color }}
                      />
                      <span className="text-muted-foreground truncate">{p.name}</span>
                    </span>
                    <span className="font-mono text-foreground shrink-0 ml-2">
                      {p.value}% ({p.count})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 space-y-3 lg:col-span-2"
        >
          <h3 className="text-xs font-semibold text-foreground font-mono tracking-wider">
            ALERTS BY CAMERA
          </h3>
          {cameraAlerts.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono py-12 text-center">
              No camera alert data yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cameraAlerts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                <XAxis
                  dataKey="camera"
                  stroke="hsl(215, 20%, 55%)"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                />
                <YAxis
                  stroke="hsl(215, 20%, 55%)"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="alerts" fill="hsl(192, 95%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
