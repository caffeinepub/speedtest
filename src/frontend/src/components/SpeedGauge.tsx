import { useEffect, useRef } from "react";

const RADIUS = 112;
const CX = 140;
const CY = 140;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 270 / 360;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;
const MAX_SPEED = 500;

const TICKS = Array.from({ length: 11 }, (_, i) => {
  const angle = -225 + (i / 10) * 270;
  const rad = (angle * Math.PI) / 180;
  return {
    id: `tick-${i}`,
    i,
    x1: CX + 94 * Math.cos(rad),
    y1: CY + 94 * Math.sin(rad),
    x2: CX + 104 * Math.cos(rad),
    y2: CY + 104 * Math.sin(rad),
    major: i % 5 === 0,
    fraction: i / 10,
  };
});

interface SpeedGaugeProps {
  speed: number;
  phase: "idle" | "ping" | "download" | "upload" | "done";
  isRunning: boolean;
}

function getGaugeColor(phase: SpeedGaugeProps["phase"]) {
  switch (phase) {
    case "ping":
      return "#f59e0b";
    case "upload":
      return "#818cf8";
    default:
      return "#22d3ee";
  }
}

function getGaugeShadow(phase: SpeedGaugeProps["phase"]) {
  switch (phase) {
    case "ping":
      return "drop-shadow(0 0 16px rgba(245,158,11,0.7))";
    case "upload":
      return "drop-shadow(0 0 16px rgba(129,140,248,0.7))";
    case "idle":
      return "none";
    default:
      return "drop-shadow(0 0 16px rgba(34,211,238,0.7))";
  }
}

export function SpeedGauge({ speed, phase, isRunning }: SpeedGaugeProps) {
  const fillRef = useRef<SVGCircleElement>(null);

  const clampedSpeed = Math.min(speed, MAX_SPEED);
  const progress = clampedSpeed / MAX_SPEED;
  const dashFill = progress * ARC_LENGTH;

  useEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.strokeDasharray = `${dashFill} ${CIRCUMFERENCE}`;
    }
  }, [dashFill]);

  const color = getGaugeColor(phase);
  const shadow = getGaugeShadow(phase);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width="280"
        height="280"
        viewBox="0 0 280 280"
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Outer decorative ring */}
        <circle
          cx={CX}
          cy={CY}
          r={130}
          fill="none"
          stroke="oklch(0.2 0.04 255)"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Track arc */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="oklch(0.18 0.04 255)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          transform={`rotate(135, ${CX}, ${CY})`}
        />

        {/* Fill arc */}
        <circle
          ref={fillRef}
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dashFill} ${CIRCUMFERENCE}`}
          transform={`rotate(135, ${CX}, ${CY})`}
          style={{
            transition: "stroke-dasharray 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: shadow,
          }}
        />

        {/* Tick marks */}
        {TICKS.map((tick) => (
          <line
            key={tick.id}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.fraction <= progress ? color : "oklch(0.3 0.04 255)"}
            strokeWidth={tick.major ? "2.5" : "1.5"}
            strokeLinecap="round"
            style={{ transition: "stroke 0.35s ease" }}
          />
        ))}

        {/* Speed value */}
        <text
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          fill="white"
          fontSize="52"
          fontWeight="700"
          fontFamily="BricolageGrotesque, sans-serif"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {phase === "ping" ? Math.round(speed) : speed.toFixed(1)}
        </text>
        <text
          x={CX}
          y={CY + 22}
          textAnchor="middle"
          fill={color}
          fontSize="14"
          fontWeight="600"
          fontFamily="Satoshi, sans-serif"
          letterSpacing="2"
          style={{ textTransform: "uppercase" }}
        >
          {phase === "ping" ? "ms" : "Mbps"}
        </text>

        {/* Pulse dot when running */}
        {isRunning && (
          <circle cx={CX} cy={CY + 46} r="6" fill={color} opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Scale labels */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between px-8 text-xs font-mono text-muted-foreground">
        <span>0</span>
        <span>250</span>
        <span>500</span>
      </div>
    </div>
  );
}
