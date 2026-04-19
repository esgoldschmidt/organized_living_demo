"use client";

import { useRef, useState } from "react";
import type { ClosetConfig, ClosetShape } from "@/store/designStore";
import type { MeasuredFootprint } from "@/types";

const I = 3.0;      // SVG units per inch
const WALL = 14;    // wall thickness in SVG units
const PAD_X = 72;
const PAD_Y = 60;
const DIM_COLOR = "#6b6058";
const DIM_TICK = 5;
const HANDLE_R = 8;

type Handle = "width" | "depth" | "leftZone" | "rightZone" | "frontLeftStub" | "frontRightStub";
const HORIZ_HANDLES: Handle[] = ["width", "leftZone", "rightZone", "frontLeftStub", "frontRightStub"];

function snapTo(v: number, step: number) { return Math.round(v / step) * step; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function hasLeft(s: ClosetShape) { return s === "left" || s === "u" || s === "walk-in"; }
function hasRight(s: ClosetShape) { return s === "right" || s === "u" || s === "walk-in"; }
function hasFrontStubs(s: ClosetShape) { return s === "walk-in"; }

function HDim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mx = (x1 + x2) / 2;
  return (
    <g fill="none" stroke={DIM_COLOR} strokeWidth={1}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - DIM_TICK} x2={x1} y2={y + DIM_TICK} />
      <line x1={x2} y1={y - DIM_TICK} x2={x2} y2={y + DIM_TICK} />
      <text x={mx} y={y - 6} textAnchor="middle" stroke="none" fill={DIM_COLOR}
            fontSize={10} fontFamily="system-ui,sans-serif">{label}</text>
    </g>
  );
}

function VDim({
  y1,
  y2,
  x,
  label,
  active = false,
}: {
  y1: number;
  y2: number;
  x: number;
  label: string;
  active?: boolean;
}) {
  const my = (y1 + y2) / 2;
  const color = active ? "#25302c" : DIM_COLOR;
  return (
    <g fill="none" stroke={color} strokeWidth={active ? 1.6 : 1}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - DIM_TICK} y1={y1} x2={x + DIM_TICK} y2={y1} />
      <line x1={x - DIM_TICK} y1={y2} x2={x + DIM_TICK} y2={y2} />
      <text x={x - 22} y={my} textAnchor="end" dominantBaseline="middle"
            stroke="none" fill={color} fontSize={10} fontFamily="system-ui,sans-serif"
            fontWeight={active ? 700 : 400}>{label}</text>
    </g>
  );
}

function DragHandle({
  cx,
  cy,
  id,
  cursor,
  active,
  quiet = false,
  onStart,
  onHover,
  onLeave,
}: {
  cx: number;
  cy: number;
  id: Handle;
  cursor: string;
  active: boolean;
  quiet?: boolean;
  onStart: (event: React.PointerEvent<SVGCircleElement>, handle: Handle) => void;
  onHover: (handle: Handle) => void;
  onLeave: (handle: Handle) => void;
}) {
  const isHoriz = HORIZ_HANDLES.includes(id);
  const opacity = quiet && !active ? 0.34 : 1;
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={HANDLE_R + 6} fill="transparent"
        style={{ cursor }}
        onPointerDown={(e) => onStart(e, id)}
        onPointerEnter={() => onHover(id)}
        onPointerLeave={() => onLeave(id)}
      />
      <circle cx={cx} cy={cy} r={HANDLE_R}
        fill={active ? "#25302c" : "#fff"}
        stroke="#25302c" strokeWidth={2}
        style={{ cursor, pointerEvents: "none" }}
      />
      {isHoriz && (
        <g fill={active ? "#fff" : "#25302c"} style={{ pointerEvents: "none" }}>
          <path d={`M${cx - 4} ${cy} l4 -3 l0 6 Z`} />
          <path d={`M${cx + 4} ${cy} l-4 -3 l0 6 Z`} />
        </g>
      )}
      {id === "depth" && (
        <g fill={active ? "#fff" : "#25302c"} style={{ pointerEvents: "none" }}>
          <path d={`M${cx} ${cy - 4} l-3 4 l6 0 Z`} />
          <path d={`M${cx} ${cy + 4} l-3 -4 l6 0 Z`} />
        </g>
      )}
    </g>
  );
}

interface Props {
  config: ClosetConfig;
  footprint: MeasuredFootprint;
  onChange: (u: Partial<ClosetConfig>) => void;
  onFootprintChange: (footprint: MeasuredFootprint) => void;
}

export default function ClosetFloorPlan({ config, footprint, onChange, onFootprintChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Handle | null>(null);
  const [pointDrag, setPointDrag] = useState<string | null>(null);
  const [hover, setHover] = useState<Handle | null>(null);

  const hl = hasLeft(config.shape);
  const hr = hasRight(config.shape);
  const hfs = hasFrontStubs(config.shape);
  const W = config.width * I;
  const D = config.depth * I;
  const fsd = config.frontStubDepth * I;  // front stub SVG width
  const ox = PAD_X;
  const oy = PAD_Y;
  const ix = ox + WALL;   // interior left
  const iy = oy + WALL;   // interior top
  const rx = ix + W;      // interior right edge (= left edge of right wall)
  const svgW = ox + WALL * 2 + W + PAD_X;
  const extraBottom = hfs ? WALL : 0;
  const svgH = oy + WALL + D + extraBottom + PAD_Y + 52;

  function toSvgX(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * svgW;
  }
  function toSvgY(clientY: number) {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    return ((clientY - r.top) / r.height) * svgH;
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const x = toSvgX(e.clientX);
    const y = toSvgY(e.clientY);
    if (pointDrag) {
      const nextPoints = footprint.points.map((point) =>
        point.id === pointDrag
          ? {
              ...point,
              x: clamp(snapTo((x - ix) / I, 3), 0, config.width),
              y: clamp(snapTo((y - iy) / I, 3), 0, config.depth),
            }
          : point,
      );
      const leftJamb = nextPoints.find((point) => point.id === footprint.opening.leftJambId);
      const rightJamb = nextPoints.find((point) => point.id === footprint.opening.rightJambId);
      const opening = leftJamb && rightJamb
        ? {
            ...footprint.opening,
            width: Math.round(Math.hypot(rightJamb.x - leftJamb.x, rightJamb.y - leftJamb.y)),
          }
        : footprint.opening;

      onFootprintChange({
        ...footprint,
        source: footprint.source === "ar" ? "ar" : "manual",
        points: nextPoints,
        opening,
      });
      return;
    }

    if (!drag) return;
    if (drag === "width") {
      onChange({ width: clamp(snapTo((x - ix) / I, 6), 60, 240) });
    } else if (drag === "depth") {
      onChange({ depth: clamp(snapTo((y - iy) / I, 6), 20, 180) });
    } else if (drag === "leftZone") {
      onChange({ leftReturn: clamp(snapTo((x - ix) / I, 6), 24, config.width / 2 - 12) });
    } else if (drag === "rightZone") {
      onChange({ rightReturn: clamp(snapTo((rx - x) / I, 6), 24, config.width / 2 - 12) });
    } else if (drag === "frontLeftStub") {
      onChange({ frontStubDepth: clamp(snapTo((x - ix) / I, 6), 12, config.width / 2 - 24) });
    } else if (drag === "frontRightStub") {
      onChange({ frontStubDepth: clamp(snapTo((rx - x) / I, 6), 12, config.width / 2 - 24) });
    }
  }

  function startDrag(e: React.PointerEvent<SVGCircleElement>, h: Handle) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag(h);
  }

  function startPointDrag(e: React.PointerEvent<SVGCircleElement>, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setPointDrag(id);
  }

  const dimY = iy + D + extraBottom + 30;
  const widthDimY = hfs ? oy - 14 : dimY;
  const dimX = ox - 22;
  const lzX = ix + config.leftReturn * I;
  const rzX = rx - config.rightReturn * I;
  const centerZoneW = config.width - (hl ? config.leftReturn : 0) - (hr ? config.rightReturn : 0);
  const centerZoneCx = hl && hr ? (lzX + rzX) / 2 : hl ? (lzX + rx) / 2 : hr ? (ix + rzX) / 2 : ix + W / 2;
  const leftZoneActive = drag === "leftZone" || hover === "leftZone";
  const rightZoneActive = drag === "rightZone" || hover === "rightZone";
  const depthActive = drag === "depth" || hover === "depth";

  const handleProps = (id: Handle) => ({
    active: drag === id || hover === id,
    onStart: startDrag,
    onHover: setHover,
    onLeave: (handle: Handle) => { if (drag !== handle) setHover(null); },
  });

  // For walk-in, keep the depth handle out of the doorway controls.
  const depthHandleCx = hfs ? dimX : ix + W / 2;
  const depthHandleCy = hfs ? iy + D / 2 : iy + D;
  const measuredPoints = footprint.points.map((point) => ({
    ...point,
    sx: ix + point.x * I,
    sy: iy + point.y * I,
  }));
  const footprintPath = measuredPoints.map((point) => `${point.sx},${point.sy}`).join(" ");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full select-none"
      style={{ maxHeight: "calc(100vh - 220px)", touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={() => { setDrag(null); setPointDrag(null); setHover(null); }}
      onPointerLeave={() => { setDrag(null); setPointDrag(null); setHover(null); }}
    >
      {/* ── Background grid (6" cells) ── */}
      <defs>
        <pattern id="cpgrid" width={6 * I} height={6 * I} patternUnits="userSpaceOnUse" x={ix} y={iy}>
          <path d={`M ${6 * I} 0 L 0 0 0 ${6 * I}`} fill="none" stroke="#ddd8d0" strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect x={ix} y={iy} width={W} height={D} fill="url(#cpgrid)" />

      {/* ── Room floor context (outside opening) ── */}
      {!hfs && (
        <rect x={hl ? ix : ox} y={iy + D}
              width={W + (hl ? 0 : WALL) + (hr ? 0 : WALL)} height={40}
              fill="#d4cec6" opacity={0.45} />
      )}
      {hfs && (
        <rect x={ix + fsd} y={iy + D + WALL}
              width={W - 2 * fsd} height={40}
              fill="#d4cec6" opacity={0.45} />
      )}

      {/* ── Closet interior fill ── */}
      <rect x={ix} y={iy} width={W} height={D} fill="#eeebe4" fillOpacity={0.7} />

      {/* ── Measured footprint from manual/AR points ── */}
      <polygon points={footprintPath} fill="#dfe7e0" fillOpacity={0.34} stroke="#48645a" strokeWidth={1.5} strokeLinejoin="round" />

      {/* ── Back wall ── */}
      <rect x={ox} y={oy} width={WALL * 2 + W} height={WALL} fill="#2c2824" />

      {/* ── Side walls ── */}
      {hl && <rect x={ox} y={oy} width={WALL} height={WALL + D} fill="#2c2824" />}
      {hr && <rect x={rx} y={oy} width={WALL} height={WALL + D} fill="#2c2824" />}

      {/* ── Front stubs (walk-in) ── */}
      {hfs && <rect x={ox} y={iy + D} width={WALL + fsd} height={WALL} fill="#2c2824" />}
      {hfs && <rect x={rx - fsd} y={iy + D} width={fsd + WALL} height={WALL} fill="#2c2824" />}

      {/* ── Storage zones ── */}
      {hl && <line x1={lzX} y1={iy} x2={lzX} y2={iy + D} stroke={leftZoneActive ? "#25302c" : "#aaa49c"} strokeWidth={leftZoneActive ? 1.8 : 1.2} strokeDasharray="5 4" />}
      {hr && <line x1={rzX} y1={iy} x2={rzX} y2={iy + D} stroke={rightZoneActive ? "#25302c" : "#aaa49c"} strokeWidth={rightZoneActive ? 1.8 : 1.2} strokeDasharray="5 4" />}
      {hl && (
        <text x={(ix + lzX) / 2} y={iy + D / 2} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill="#7a7268" fontFamily="system-ui,sans-serif">Left {config.leftReturn}&quot;</text>
      )}
      <text x={centerZoneCx} y={iy + D / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#7a7268" fontFamily="system-ui,sans-serif">Back {centerZoneW}&quot;</text>
      {hr && (
        <text x={(rzX + rx) / 2} y={iy + D / 2} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill="#7a7268" fontFamily="system-ui,sans-serif">Right {config.rightReturn}&quot;</text>
      )}

      {/* ── Wall labels ── */}
      <text x={ix + W / 2} y={oy + WALL / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill="#c4beb8" fontFamily="system-ui,sans-serif" letterSpacing="0.1em">BACK WALL</text>
      {hfs && (
        <>
          <text x={ox + (WALL + fsd) / 2} y={iy + D + WALL / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#c4beb8" fontFamily="system-ui,sans-serif">{config.frontStubDepth}&quot;</text>
          <text x={rx - fsd / 2} y={iy + D + WALL / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#c4beb8" fontFamily="system-ui,sans-serif">{config.frontStubDepth}&quot;</text>
        </>
      )}

      {/* ── Dimension annotations ── */}
      <HDim x1={ix} x2={rx} y={widthDimY} label={`${config.width}" wide`} />
      <VDim y1={iy} y2={iy + D} x={dimX} label={`${config.depth}"`} active={depthActive} />
      {hfs && (
        <HDim x1={ix + fsd} x2={rx - fsd}
              y={dimY}
              label={`${config.width - 2 * config.frontStubDepth}" opening`} />
      )}

      {/* ── Drag handles ── */}
      {measuredPoints.map((point) => {
        const active = pointDrag === point.id;
        const isJamb = point.type === "left-jamb" || point.type === "right-jamb";
        const visualR = active ? 7 : isJamb ? 4.5 : 5.5;
        return (
          <g key={point.id}>
            <circle
              cx={point.sx}
              cy={point.sy}
              r={14}
              fill="transparent"
              style={{ cursor: "grab" }}
              onPointerDown={(event) => startPointDrag(event, point.id)}
            />
            <circle
              cx={point.sx}
              cy={point.sy}
              r={visualR}
              fill={active ? "#25302c" : isJamb ? "#f8f7f3" : "#fff"}
              stroke={isJamb ? "#8b735c" : "#48645a"}
              strokeWidth={active ? 2 : 1.5}
              pointerEvents="none"
            />
            <circle cx={point.sx} cy={point.sy} r={1.8} fill={active ? "#fff" : isJamb ? "#8b735c" : "#48645a"} pointerEvents="none" />
          </g>
        );
      })}
      <DragHandle cx={rx} cy={iy + D / 2} id="width" cursor="ew-resize" {...handleProps("width")} />
      <DragHandle cx={depthHandleCx} cy={depthHandleCy} id="depth" cursor="ns-resize" {...handleProps("depth")} />
      {hl && <DragHandle cx={lzX} cy={iy + D / 2} id="leftZone" cursor="ew-resize" quiet {...handleProps("leftZone")} />}
      {hr && <DragHandle cx={rzX} cy={iy + D / 2} id="rightZone" cursor="ew-resize" quiet {...handleProps("rightZone")} />}
      {hfs && <DragHandle cx={ix + fsd} cy={iy + D + WALL / 2} id="frontLeftStub" cursor="ew-resize" quiet {...handleProps("frontLeftStub")} />}
      {hfs && <DragHandle cx={rx - fsd} cy={iy + D + WALL / 2} id="frontRightStub" cursor="ew-resize" quiet {...handleProps("frontRightStub")} />}

      {/* ── Handle tooltip labels ── */}
      {(drag === "width" || hover === "width") && (
        <text x={rx + HANDLE_R + 10} y={iy + D / 2} dominantBaseline="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">width</text>
      )}
      {leftZoneActive && (
        <g>
          <rect x={lzX - 56} y={iy + D / 2 - 30} width={112} height={20} rx={4} fill="white" fillOpacity={0.94} />
          <text x={lzX} y={iy + D / 2 - 17} textAnchor="middle"
                fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">left storage zone</text>
        </g>
      )}
      {rightZoneActive && (
        <g>
          <rect x={rzX - 58} y={iy + D / 2 - 30} width={116} height={20} rx={4} fill="white" fillOpacity={0.94} />
          <text x={rzX} y={iy + D / 2 - 17} textAnchor="middle"
                fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">right storage zone</text>
        </g>
      )}
      {(drag === "frontLeftStub" || hover === "frontLeftStub") && (
        <text x={ix + fsd} y={iy + D + WALL + 16} textAnchor="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">entry wall</text>
      )}
      {(drag === "frontRightStub" || hover === "frontRightStub") && (
        <text x={rx - fsd} y={iy + D + WALL + 16} textAnchor="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">entry wall</text>
      )}
      {pointDrag && (
        <text x={ix + W / 2} y={iy + D + extraBottom + 48} textAnchor="middle"
              fontSize={10} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">
          editing measured AR-style footprint point
        </text>
      )}
    </svg>
  );
}
