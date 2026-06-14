import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEvents } from "@/hooks/use-events";
import { buildHourlyActivity } from "@/lib/analytics";

const tooltipStyle = {
  background: "hsl(222, 44%, 9%)",
  border: "1px solid hsl(222, 30%, 18%)",
  borderRadius: "8px",
  fontSize: "11px",
  fontFamily: "JetBrains Mono",
};

export function ActivityChart() {
  const { data: events = [], isLoading } = useEvents(3000);
  const data = useMemo(() => buildHourlyActivity(events), [events]);
  const hasData = data.some((d) => d.normal > 0 || d.suspicious > 0);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">ACTIVITY OVERVIEW</h3>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="text-muted-foreground">Last 24h · live</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" /> Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive" /> Suspicious
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs font-mono text-muted-foreground h-[200px] flex items-center justify-center">
          Loading…
        </p>
      ) : !hasData ? (
        <p className="text-xs font-mono text-muted-foreground h-[200px] flex items-center justify-center">
          Waiting for detection events…
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(192, 95%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(192, 95%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="suspiciousGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 85%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 85%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
            <XAxis
              dataKey="time"
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
            <Area
              type="monotone"
              dataKey="normal"
              stroke="hsl(192, 95%, 55%)"
              fill="url(#normalGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="suspicious"
              stroke="hsl(0, 85%, 55%)"
              fill="url(#suspiciousGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
