import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Film, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAnalysisStatus,
  setAnalysisSource,
  uploadAnalysisVideo,
  type AnalysisSourceStatus,
} from "@/lib/analysis-source";

export function VideoSourcePanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["analysis-source"],
    queryFn: fetchAnalysisStatus,
    refetchInterval: 5000,
    retry: 1,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["analysis-source"] });
  };

  const switchMutation = useMutation({
    mutationFn: (source: "webcam" | "file") => setAnalysisSource(source),
    onSuccess: (s) => {
      invalidate();
      toast.success(s.mode === "webcam" ? "Using webcam" : `Analyzing: ${s.file_name ?? "video"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAnalysisVideo(file);
      invalidate();
      toast.success(`Analyzing ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const mode = status?.mode ?? "webcam";
  const busy = uploading || switchMutation.isPending;

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-semibold text-foreground font-mono tracking-wider">
        INPUT SOURCE
      </h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Use the live webcam or upload a recording (MP4, AVI, MOV, MKV). The same AI pipeline
        runs on both.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !status?.webcam_available}
          onClick={() => switchMutation.mutate("webcam")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            mode === "webcam"
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
          } disabled:opacity-40`}
        >
          <Camera className="w-3.5 h-3.5" />
          Webcam
        </button>
        <button
          type="button"
          disabled={busy || !status?.has_file}
          onClick={() => switchMutation.mutate("file")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            mode === "file"
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
          } disabled:opacity-40`}
        >
          <Film className="w-3.5 h-3.5" />
          Uploaded video
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/avi,video/quicktime,video/x-msvideo,video/webm,.mp4,.avi,.mov,.mkv"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 border border-border disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Uploading…" : "Upload video to analyze"}
      </button>

      <StatusLine status={status} />
    </div>
  );
}

function StatusLine({ status }: { status?: AnalysisSourceStatus }) {
  if (!status) {
    return <p className="text-[10px] font-mono text-muted-foreground">Loading source…</p>;
  }
  if (status.mode === "file" && status.file_name) {
    return (
      <p className="text-[10px] font-mono text-primary truncate">
        Active: {status.file_name}
        {!status.capture_open && " (stream unavailable)"}
      </p>
    );
  }
  if (status.mode === "webcam") {
    return (
      <p className="text-[10px] font-mono text-muted-foreground">
        Active: Webcam {status.webcam_available ? "" : "(not detected — upload a video)"}
      </p>
    );
  }
  return null;
}
