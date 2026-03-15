import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HistoryList } from "./components/HistoryList";
import { SpeedGauge } from "./components/SpeedGauge";
import { useAddResult, useGetResults } from "./hooks/useQueries";

type Phase = "idle" | "ping" | "download" | "upload" | "done";

const PHASES: Phase[] = ["ping", "download", "upload"];

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready",
  ping: "Testing Ping...",
  download: "Testing Download...",
  upload: "Testing Upload...",
  done: "Test Complete",
};

const PHASE_COLORS: Record<string, string> = {
  ping: "text-amber-400",
  download: "text-cyan-400",
  upload: "text-indigo-400",
  done: "text-primary",
  idle: "text-muted-foreground",
};

async function measurePing(): Promise<number> {
  const times: number[] = [];
  const endpoints = ["https://1.1.1.1/", "https://www.cloudflare.com/"];
  for (let i = 0; i < 5; i++) {
    const url = endpoints[i % endpoints.length];
    const start = performance.now();
    try {
      await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store" });
      times.push(performance.now() - start);
    } catch {
      times.push(performance.now() - start);
    }
  }
  const sorted = times.sort((a, b) => a - b).slice(1, 4);
  return sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

async function measureDownload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const url = "https://speed.cloudflare.com/__down?bytes=25000000";
  const startTime = performance.now();
  let loaded = 0;

  try {
    const response = await fetch(url, { cache: "no-store" });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      const elapsed = (performance.now() - startTime) / 1000;
      const mbps = (loaded * 8) / (elapsed * 1_000_000);
      onProgress(mbps);
    }

    const totalTime = (performance.now() - startTime) / 1000;
    return (loaded * 8) / (totalTime * 1_000_000);
  } catch {
    const totalTime = (performance.now() - startTime) / 1000;
    if (totalTime > 0 && loaded > 0) {
      return (loaded * 8) / (totalTime * 1_000_000);
    }
    throw new Error("Download failed");
  }
}

async function measureUpload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const SIZE = 5_000_000;
  const data = new Uint8Array(SIZE);
  crypto.getRandomValues(data.slice(0, Math.min(SIZE, 65536)));

  const startTime = performance.now();

  try {
    await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body: data,
      cache: "no-store",
    });

    const totalTime = (performance.now() - startTime) / 1000;
    const mbps = (SIZE * 8) / (totalTime * 1_000_000);
    onProgress(mbps);
    return mbps;
  } catch {
    const totalTime = (performance.now() - startTime) / 1000;
    if (totalTime > 0) {
      const mbps = (SIZE * 8) / (totalTime * 1_000_000);
      onProgress(mbps);
      return mbps;
    }
    throw new Error("Upload failed");
  }
}

interface TestResults {
  ping: number;
  download: number;
  upload: number;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  const { data: history, isLoading: historyLoading } = useGetResults();
  const addResult = useAddResult();

  const isRunning = phase !== "idle" && phase !== "done";

  const runTest = useCallback(async () => {
    abortRef.current = false;
    setError(null);
    setResults(null);
    setCurrentSpeed(0);

    try {
      // Phase 1: Ping
      setPhase("ping");
      setCurrentSpeed(0);
      const ping = await measurePing();
      setCurrentSpeed(Math.round(ping));
      await new Promise((r) => setTimeout(r, 600));

      if (abortRef.current) return;

      // Phase 2: Download
      setPhase("download");
      setCurrentSpeed(0);
      const download = await measureDownload((mbps) => {
        setCurrentSpeed(Math.round(mbps * 10) / 10);
      });

      if (abortRef.current) return;

      // Phase 3: Upload
      setPhase("upload");
      setCurrentSpeed(0);

      // Simulate progressive upload progress
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        simulatedProgress = Math.min(
          simulatedProgress + Math.random() * 15,
          85,
        );
        setCurrentSpeed(Math.round(simulatedProgress * 10) / 10);
      }, 200);

      const upload = await measureUpload((mbps) => {
        clearInterval(progressInterval);
        setCurrentSpeed(Math.round(mbps * 10) / 10);
      });
      clearInterval(progressInterval);

      if (abortRef.current) return;

      // Done
      const testResults = { ping: Math.round(ping), download, upload };
      setResults(testResults);
      setPhase("done");
      setCurrentSpeed(Math.round(download * 10) / 10);

      // Save to backend
      try {
        await addResult.mutateAsync({
          downloadSpeed: download,
          uploadSpeed: upload,
          ping: BigInt(Math.round(ping)),
        });
        toast.success("Result saved to history");
      } catch {
        toast.error("Could not save result");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
      setPhase("idle");
      setCurrentSpeed(0);
    }
  }, [addResult]);

  const resetTest = useCallback(() => {
    abortRef.current = true;
    setPhase("idle");
    setCurrentSpeed(0);
    setResults(null);
    setError(null);
  }, []);

  // Connection info
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
    }
  ).connection;
  const isp = connection?.effectiveType
    ? `${connection.effectiveType.toUpperCase()} connection`
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster theme="dark" />

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Wifi className="w-4.5 h-4.5 text-primary" size={18} />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              SpeedCheck
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {isp || "Network Speed Test"}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-10">
        {/* Hero speed test area */}
        <section className="flex flex-col items-center gap-6">
          {/* Gauge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative"
          >
            <SpeedGauge
              speed={currentSpeed}
              phase={phase}
              isRunning={isRunning}
            />
          </motion.div>

          {/* Phase indicator */}
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={`text-sm font-semibold tracking-widest uppercase ${
                PHASE_COLORS[phase]
              }`}
            >
              {PHASE_LABELS[phase]}
            </motion.div>
          </AnimatePresence>

          {/* Phase steps */}
          <div className="flex items-center gap-2">
            {PHASES.map((p, i) => {
              const phaseIndex = PHASES.indexOf(
                phase as (typeof PHASES)[number],
              );
              const isDone = phase === "done" || phaseIndex > i;
              const isActive = phase === p;
              const label = p.charAt(0).toUpperCase() + p.slice(1);

              return (
                <div key={p} className="flex items-center gap-2">
                  <div
                    className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                    transition-all duration-300
                    ${
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : isDone
                          ? "bg-muted text-muted-foreground border border-border"
                          : "border border-border/30 text-muted-foreground/50"
                    }
                  `}
                  >
                    {isDone && !isActive ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isActive ? (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                    {label}
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className={`w-8 h-px ${
                        phaseIndex > i || phase === "done"
                          ? "bg-border"
                          : "bg-border/30"
                      } transition-colors duration-300`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center gap-3">
            {!isRunning && phase !== "done" && (
              <Button
                data-ocid="speedtest.start_button"
                size="lg"
                onClick={runTest}
                disabled={isRunning}
                className="
                  relative h-14 px-12 text-base font-bold font-display
                  bg-primary text-primary-foreground
                  hover:shadow-glow hover:scale-105
                  active:scale-95
                  transition-all duration-200
                  rounded-2xl
                "
              >
                <Wifi className="mr-2 w-5 h-5" />
                Start Speed Test
              </Button>
            )}

            {isRunning && (
              <div
                data-ocid="speedtest.loading_state"
                className="flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-muted border border-border">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-sm font-medium">
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
              </div>
            )}

            {phase === "done" && results && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetTest}
                className="rounded-xl border-border/50 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="mr-2 w-4 h-4" />
                Run Again
              </Button>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div
              data-ocid="speedtest.error_state"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Results Card */}
        <AnimatePresence>
          {results && phase === "done" && (
            <motion.section
              data-ocid="speedtest.success_state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="
                grid grid-cols-3 gap-3 sm:gap-4
                rounded-2xl p-4 sm:p-6
                bg-navy-card border border-border/50
                shadow-card
              "
            >
              {/* Download */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 text-primary">
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Download
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold font-display tabular-nums text-foreground">
                  {results.download.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">Mbps</span>
              </div>

              {/* Upload */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Upload
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold font-display tabular-nums text-foreground">
                  {results.upload.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">Mbps</span>
              </div>

              {/* Ping */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Ping
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold font-display tabular-nums text-foreground">
                  {results.ping}
                </span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* History Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Test History</h2>
            <span className="text-xs text-muted-foreground">
              Last 10 results
            </span>
          </div>
          <HistoryList results={history ?? []} isLoading={historyLoading} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
