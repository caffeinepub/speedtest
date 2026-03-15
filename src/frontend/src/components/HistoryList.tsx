import { Activity, ArrowDown, ArrowUp, Clock } from "lucide-react";
import type { SpeedTestResult } from "../backend.d";

interface HistoryListProps {
  results: SpeedTestResult[];
  isLoading: boolean;
}

function formatDate(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  const date = new Date(ms);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SpeedBadge({
  value,
  type,
}: { value: number; type: "download" | "upload" }) {
  const isDownload = type === "download";
  return (
    <div
      className={`flex items-center gap-1.5 ${
        isDownload ? "text-cyan-400" : "text-indigo-400"
      }`}
    >
      {isDownload ? (
        <ArrowDown className="w-3.5 h-3.5" />
      ) : (
        <ArrowUp className="w-3.5 h-3.5" />
      )}
      <span className="font-mono font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">Mbps</span>
    </div>
  );
}

export function HistoryList({ results, isLoading }: HistoryListProps) {
  if (isLoading) {
    return (
      <div data-ocid="history.loading_state" className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        data-ocid="history.empty_state"
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Activity className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium">No tests yet</p>
        <p className="text-muted-foreground text-sm mt-1">
          Run your first speed test above
        </p>
      </div>
    );
  }

  return (
    <div data-ocid="history.list" className="space-y-2.5">
      {results.map((result, index) => (
        <div
          key={`${result.timestamp}-${index}`}
          data-ocid={`history.item.${index + 1}`}
          className="
            flex items-center justify-between
            rounded-xl px-4 py-3.5
            bg-navy-card border border-border/50
            hover:border-primary/20 hover:bg-[oklch(0.15_0.04_255)]
            transition-all duration-200
          "
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-bold font-mono">
                #{index + 1}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDate(result.timestamp)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SpeedBadge value={result.downloadSpeed} type="download" />
            <SpeedBadge value={result.uploadSpeed} type="upload" />
            <div className="flex items-center gap-1.5 text-amber-400">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-mono font-semibold tabular-nums">
                {Number(result.ping)}
              </span>
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
