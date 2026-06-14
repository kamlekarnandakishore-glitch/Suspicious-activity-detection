import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LiveVideo } from "@/components/LiveVideo";
import { VideoSourcePanel } from "@/components/VideoSourcePanel";
import { useBackendHealth } from "@/hooks/use-backend";
import { useEvents } from "@/hooks/use-events";
import { useQuery } from "@tanstack/react-query";
import { fetchAnalysisStatus } from "@/lib/analysis-source";
import { motion, AnimatePresence } from "framer-motion";
import { Circle, Maximize2, Minimize2, X } from "lucide-react";
import { RestrictedZonesPanel } from "@/components/RestrictedZonesPanel";
import { useZones } from "@/hooks/use-zones";
import { isAlertRecent } from "@/lib/alerts";

export default function LiveMonitoring() {
  const { data: backendUp } = useBackendHealth();
  const { data: source } = useQuery({
    queryKey: ["analysis-source"],
    queryFn: fetchAnalysisStatus,
    refetchInterval: 5000,
    enabled: backendUp === true,
  });
  const { uiAlerts } = useEvents();
  const latest = uiAlerts[0];
  const showOverlay = latest && isAlertRecent(latest, 15);
  const [expanded, setExpanded] = useState(false);

  // Restricted zone drawing state
  const { data: zones = [], createZone } = useZones();
  const [drawingMode, setDrawingMode] = useState(false);
  const [newZonePoints, setNewZonePoints] = useState<number[][]>([]);
  
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setNewZonePoints([...newZonePoints, [x, y]]);
  };

  const handleStartDrawing = () => {
    setDrawingMode(true);
    setNewZonePoints([]);
  };

  const handleCancelDrawing = () => {
    setDrawingMode(false);
    setNewZonePoints([]);
  };

  const handleSaveDrawing = async (name: string, trespassDelay: number, loiterDelay: number) => {
    if (newZonePoints.length < 3) {
      alert("Please draw at least 3 points for a valid zone.");
      return;
    }
    await createZone({
      name,
      points: newZonePoints,
      enabled: true,
      trespass_delay_s: trespassDelay,
      loiter_delay_s: loiterDelay,
    });
    setDrawingMode(false);
    setNewZonePoints([]);
  };

  const sourceLabel =
    !backendUp
      ? "OFFLINE"
      : source?.mode === "file"
        ? `VIDEO: ${source.file_name ?? "file"}`
        : source?.webcam_available
          ? "WEBCAM"
          : "UPLOAD VIDEO";

  return (
    <DashboardLayout>
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-pulse-glow" />
        LIVE MONITORING — {sourceLabel}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative aspect-video rounded-xl overflow-hidden border group ${
              showOverlay ? "border-destructive/50 glow-danger" : "border-border"
            } bg-secondary/50`}
          >
            <div className="relative w-full h-full min-h-[360px]">
              <LiveVideo offline={backendUp === false} />
              
              {/* SVG Overlay for Zones */}
              <svg 
                className={`absolute inset-0 w-full h-full ${drawingMode ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"} z-20`}
                onClick={handleSvgClick}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Draw existing zones */}
                {!drawingMode && zones.filter(z => z.enabled).map(zone => {
                  return (
                    <polygon
                      key={zone.id}
                      points={zone.points.map(p => `${p[0] * 100},${p[1] * 100}`).join(" ")}
                      style={{
                        stroke: 'rgba(0, 255, 255, 0.5)',
                        strokeWidth: 0.5,
                        fill: 'rgba(0, 255, 255, 0.15)',
                        vectorEffect: "non-scaling-stroke"
                      }}
                    />
                  );
                })}
                
                {/* Draw new zone points */}
                {drawingMode && newZonePoints.length > 0 && (
                  <>
                    <polyline
                      points={newZonePoints.map(p => `${p[0] * 100},${p[1] * 100}`).join(" ")}
                      fill="none"
                      stroke="rgba(255, 255, 0, 0.8)"
                      strokeWidth="0.5"
                      style={{ vectorEffect: "non-scaling-stroke" }}
                    />
                    {newZonePoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p[0] * 100}
                        cy={p[1] * 100}
                        r="0.8"
                        fill="rgba(255, 255, 0, 1)"
                      />
                    ))}
                    {/* Closing line if >= 3 points */}
                    {newZonePoints.length >= 3 && (
                      <line
                        x1={newZonePoints[newZonePoints.length - 1][0] * 100}
                        y1={newZonePoints[newZonePoints.length - 1][1] * 100}
                        x2={newZonePoints[0][0] * 100}
                        y2={newZonePoints[0][1] * 100}
                        stroke="rgba(255, 255, 0, 0.4)"
                        strokeDasharray="1,1"
                        strokeWidth="0.5"
                        style={{ vectorEffect: "non-scaling-stroke" }}
                      />
                    )}
                  </>
                )}
              </svg>
              {showOverlay && (
                <div className="absolute bottom-14 left-3 z-10 bg-destructive text-destructive-foreground text-[10px] font-mono px-2 py-1 rounded">
                  {latest.type}
                  {latest.confidence !== undefined
                    ? ` • ${(latest.confidence * 100).toFixed(0)}%`
                    : ""}
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/90 to-transparent flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[70%]">
                {sourceLabel}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors shrink-0"
                aria-label="Fullscreen"
              >
                <Maximize2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        </div>
        <div className="space-y-6">
          <RestrictedZonesPanel 
            onStartDrawing={handleStartDrawing}
            drawingMode={drawingMode}
            cancelDrawing={handleCancelDrawing}
            saveDrawing={handleSaveDrawing}
          />
          <VideoSourcePanel />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-8"
            onClick={() => setExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-5xl aspect-video rounded-xl border border-border bg-secondary/50 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full min-h-[400px]">
                <LiveVideo offline={backendUp === false} />
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-secondary/80 hover:bg-secondary transition-colors z-20"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-lg bg-background/80 z-20"
              >
                <Minimize2 className="w-4 h-4 text-foreground" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
