"use client";

import { useRef, useState } from "react";
import type { ClosetConfig, ClosetShape } from "@/store/designStore";
import type { MeasuredFootprint, RoomFeature } from "@/types";

const I = 3.0;      // SVG units per inch
const WALL = 14;    // wall thickness in SVG units
const PAD_X = 72;
const PAD_Y = 60;
const DIM_COLOR = "#6b6058";
const DIM_TICK = 5;
const HANDLE_R = 8;

type Handle = "width" | "depth" | "frontLeftStub" | "frontRightStub";
const HORIZ_HANDLES: Handle[] = ["width", "frontLeftStub", "frontRightStub"];

interface ActiveDrag {
  id: Handle;
  startX: number;
  startY: number;
  startWidth: number;
  startDepth: number;
}

interface ActiveFeatureDrag {
  id: string;
  startX: number;
  startY: number;
  startFeatureX: number;
  startFeatureY: number;
}

function snapTo(v: number, step: number) { return Math.round(v / step) * step; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function hasLeft(s: ClosetShape) { return s === "left" || s === "u" || s === "walk-in"; }
function hasRight(s: ClosetShape) { return s === "right" || s === "u" || s === "walk-in"; }
function hasFrontStubs(s: ClosetShape) { return s === "walk-in"; }
function featurePlanSize(feature: RoomFeature) {
  return (feature.rotation ?? 0) === 90
    ? { width: feature.depth, depth: feature.width }
    : { width: feature.width, depth: feature.depth };
}

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
  roomFeatures: RoomFeature[];
  onChange: (u: Partial<ClosetConfig>) => void;
  onFootprintChange: (footprint: MeasuredFootprint) => void;
  onRoomFeaturesChange: (features: RoomFeature[]) => void;
}

export default function ClosetFloorPlan({ config, footprint, roomFeatures, onChange, onFootprintChange, onRoomFeaturesChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [pointDrag, setPointDrag] = useState<string | null>(null);
  const [featureDrag, setFeatureDrag] = useState<ActiveFeatureDrag | null>(null);
  const [hover, setHover] = useState<Handle | null>(null);

  const hl = hasLeft(config.shape);
  const hr = hasRight(config.shape);
  const hfs = hasFrontStubs(config.shape);
  const W = config.width * I;
  const D = config.depth * I;
  const leftFsdIn = config.frontLeftStubDepth ?? config.frontStubDepth;
  const rightFsdIn = config.frontRightStubDepth ?? config.frontStubDepth;
  const leftFsd = leftFsdIn * I;
  const rightFsd = rightFsdIn * I;
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
    if (featureDrag) {
      onRoomFeaturesChange(roomFeatures.map((feature) =>
        feature.id === featureDrag.id
          ? {
              ...feature,
              x: clamp(snapTo(featureDrag.startFeatureX + (x - featureDrag.startX) / I, 3), 0, config.width - featurePlanSize(feature).width),
              y: clamp(snapTo(featureDrag.startFeatureY + (y - featureDrag.startY) / I, 3), 0, config.depth - featurePlanSize(feature).depth),
            }
          : feature
      ));
      return;
    }

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
    if (drag.id === "width") {
      onChange({ width: clamp(snapTo(drag.startWidth + (x - drag.startX) / I, 6), 60, 240) });
    } else if (drag.id === "depth") {
      onChange({ depth: clamp(snapTo(drag.startDepth - (y - drag.startY) / I, 6), 20, 180) });
    } else if (drag.id === "frontLeftStub") {
      const maxLeft = Math.max(12, config.width - rightFsdIn - 24);
      onChange({ frontLeftStubDepth: clamp(snapTo((x - ix) / I, 6), 12, maxLeft) });
    } else if (drag.id === "frontRightStub") {
      const maxRight = Math.max(12, config.width - leftFsdIn - 24);
      onChange({ frontRightStubDepth: clamp(snapTo((rx - x) / I, 6), 12, maxRight) });
    }
  }

  function startDrag(e: React.PointerEvent<SVGCircleElement>, h: Handle) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      id: h,
      startX: toSvgX(e.clientX),
      startY: toSvgY(e.clientY),
      startWidth: config.width,
      startDepth: config.depth,
    });
  }

  function startPointDrag(e: React.PointerEvent<SVGCircleElement>, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setPointDrag(id);
  }

  function startFeatureDrag(e: React.PointerEvent<SVGRectElement>, feature: RoomFeature) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setFeatureDrag({
      id: feature.id,
      startX: toSvgX(e.clientX),
      startY: toSvgY(e.clientY),
      startFeatureX: feature.x,
      startFeatureY: feature.y,
    });
  }

  const dimY = iy + D + extraBottom + 30;
  const widthDimY = hfs ? oy - 14 : dimY;
  const dimX = ox - 22;
  const depthActive = drag?.id === "depth" || hover === "depth";

  const handleProps = (id: Handle) => ({
    active: drag?.id === id || hover === id,
    onStart: startDrag,
    onHover: setHover,
    onLeave: (handle: Handle) => { if (drag?.id !== handle) setHover(null); },
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
      onPointerUp={() => { setDrag(null); setPointDrag(null); setFeatureDrag(null); setHover(null); }}
      onPointerLeave={() => { setDrag(null); setPointDrag(null); setFeatureDrag(null); setHover(null); }}
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
        <rect x={ix + leftFsd} y={iy + D + WALL}
              width={W - leftFsd - rightFsd} height={40}
              fill="#d4cec6" opacity={0.45} />
      )}

      {/* ── Closet interior fill ── */}
      <rect x={ix} y={iy} width={W} height={D} fill="#eeebe4" fillOpacity={0.7} />

      {/* ── Measured footprint from manual/AR points ── */}
      <polygon points={footprintPath} fill="#dfe7e0" fillOpacity={0.34} stroke="#48645a" strokeWidth={1.5} strokeLinejoin="round" />

      {/* ── Room features and constraints ── */}
      {roomFeatures.map((feature) => {
        const planSize = featurePlanSize(feature);
        const x = ix + feature.x * I;
        const y = iy + feature.y * I;
        const w = planSize.width * I;
        const h = planSize.depth * I;
        const isColumn = feature.kind === "column";
        const isRegister = feature.kind === "air-register";

        return (
          <g key={feature.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={isColumn ? 2 : 4}
              fill={isColumn ? "#5d625d" : isRegister ? "#d8e5e4" : "#efe7dd"}
              fillOpacity={isColumn ? 0.72 : 0.92}
              stroke={isColumn ? "#25302c" : isRegister ? "#5d7f82" : "#9a7b62"}
              strokeWidth={1.3}
              strokeDasharray={feature.behavior === "clearance-zone" ? "4 3" : undefined}
              style={{ cursor: "grab" }}
              onPointerDown={(event) => startFeatureDrag(event, feature)}
            />
            <text
              x={x + w / 2}
              y={y + h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isColumn ? "#fff" : "#25302c"}
              fontSize={8}
              fontFamily="system-ui,sans-serif"
              fontWeight={700}
              pointerEvents="none"
            >
              {feature.kind === "air-register" ? "AIR" : feature.kind === "access-panel" ? "ACCESS" : "COLUMN"}
            </text>
          </g>
        );
      })}

      {/* ── Back wall ── */}
      <rect x={ox} y={oy} width={WALL * 2 + W} height={WALL} fill="#2c2824" />

      {/* ── Side walls ── */}
      {hl && <rect x={ox} y={oy} width={WALL} height={WALL + D} fill="#2c2824" />}
      {hr && <rect x={rx} y={oy} width={WALL} height={WALL + D} fill="#2c2824" />}

      {/* ── Front stubs (walk-in) ── */}
      {hfs && <rect x={ox} y={iy + D} width={WALL + leftFsd} height={WALL} fill="#2c2824" />}
      {hfs && <rect x={rx - rightFsd} y={iy + D} width={rightFsd + WALL} height={WALL} fill="#2c2824" />}

      {/* ── Wall labels ── */}
      <text x={ix + W / 2} y={oy + WALL / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill="#c4beb8" fontFamily="system-ui,sans-serif" letterSpacing="0.1em">BACK WALL</text>
      {hfs && (
        <>
          <text x={ox + (WALL + leftFsd) / 2} y={iy + D + WALL / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#c4beb8" fontFamily="system-ui,sans-serif">{leftFsdIn}&quot;</text>
          <text x={rx - rightFsd / 2} y={iy + D + WALL / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#c4beb8" fontFamily="system-ui,sans-serif">{rightFsdIn}&quot;</text>
        </>
      )}

      {/* ── Dimension annotations ── */}
      <HDim x1={ix} x2={rx} y={widthDimY} label={`${config.width}" wide`} />
      <VDim y1={iy} y2={iy + D} x={dimX} label={`${config.depth}"`} active={depthActive} />
      {hfs && (
        <HDim x1={ix + leftFsd} x2={rx - rightFsd}
              y={dimY}
              label={`${config.width - leftFsdIn - rightFsdIn}" opening`} />
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
      {hfs && <DragHandle cx={ix + leftFsd} cy={iy + D + WALL / 2} id="frontLeftStub" cursor="ew-resize" quiet {...handleProps("frontLeftStub")} />}
      {hfs && <DragHandle cx={rx - rightFsd} cy={iy + D + WALL / 2} id="frontRightStub" cursor="ew-resize" quiet {...handleProps("frontRightStub")} />}

      {/* ── Handle tooltip labels ── */}
      {(drag?.id === "width" || hover === "width") && (
        <text x={rx + HANDLE_R + 10} y={iy + D / 2} dominantBaseline="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">width</text>
      )}
      {(drag?.id === "frontLeftStub" || hover === "frontLeftStub") && (
        <text x={ix + leftFsd} y={iy + D + WALL + 16} textAnchor="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">entry wall</text>
      )}
      {(drag?.id === "frontRightStub" || hover === "frontRightStub") && (
        <text x={rx - rightFsd} y={iy + D + WALL + 16} textAnchor="middle"
              fontSize={9} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">entry wall</text>
      )}
      {(pointDrag || featureDrag) && (
        <text x={ix + W / 2} y={iy + D + extraBottom + 48} textAnchor="middle"
              fontSize={10} fill="#25302c" fontFamily="system-ui,sans-serif" fontWeight="600">
          {featureDrag ? "editing room feature" : "editing measured AR-style footprint point"}
        </text>
      )}
    </svg>
  );
}
