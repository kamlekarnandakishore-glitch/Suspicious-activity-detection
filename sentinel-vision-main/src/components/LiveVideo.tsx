import { useQuery } from "@tanstack/react-query";
import { fetchAnalysisStatus, videoFeedUrlWithRevision } from "@/lib/analysis-source";

interface LiveVideoProps {
  className?: string;
  label?: string;
  offline?: boolean;
}

export function LiveVideo({ className = "", label, offline }: LiveVideoProps) {
  const { data: source } = useQuery({
    queryKey: ["analysis-source"],
    queryFn: fetchAnalysisStatus,
    refetchInterval: 5000,
    retry: 1,
    enabled: !offline,
  });

  if (offline) {
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary ${className}`}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(hsl(192 95% 55% / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(192 95% 55% / 0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <p className="text-xs font-mono text-muted-foreground">BACKEND OFFLINE</p>
        <p className="text-[10px] text-muted-foreground mt-1">Start Flask to view live feed</p>
      </div>
    );
  }

  const revision = source?.revision ?? 0;
  const feedUrl = videoFeedUrlWithRevision(revision);
  const badge =
    source?.mode === "file"
      ? "VIDEO"
      : source?.webcam_available
        ? "LIVE"
        : "NO INPUT";

  return (
    <>
      <img
        key={feedUrl}
        src={feedUrl}
        alt={label ?? "Surveillance feed"}
        className={`absolute inset-0 w-full h-full object-contain ${className}`}
      />
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/70 px-1.5 py-0.5 rounded z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse-glow" />
        <span className="text-[8px] font-mono text-destructive">{badge}</span>
      </div>
    </>
  );
}
