"use client";

import { useEffect } from "react";
import Link from "next/link";
import Toolbar from "@/components/Toolbar";
import ClosetFloorPlan from "@/components/ClosetFloorPlan";
import { useDesignStore } from "@/store/designStore";
import type { ClosetShape } from "@/store/designStore";
import type { RoomFeature, RoomFeatureKind } from "@/types";

function ShapeButton({ label, sublabel, value, current, onClick }: {
  label: string; sublabel: string; value: ClosetShape; current: ClosetShape;
  onClick: (v: ClosetShape) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-md border px-3 py-2 text-left transition ${
        active
          ? "border-[#25302c] bg-[#25302c] text-white"
          : "border-[#cbd6ce] bg-white text-[#33413c] hover:bg-[#eef3ee]"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`text-[10px] ${active ? "text-white/70" : "text-[#8a9990]"}`}>{sublabel}</div>
    </button>
  );
}

const SHAPE_NAMES: Record<ClosetShape, string> = {
  straight: "Single-wall",
  left: "Left-wall room",
  right: "Right-wall room",
  u: "U-shaped room",
  "walk-in": "Walk-in Room",
};

const FEATURE_TOOLS: { kind: RoomFeatureKind; label: string; note: string }[] = [
  { kind: "column", label: "Column", note: "blocks placement" },
  { kind: "air-register", label: "Air Register", note: "do not cover" },
  { kind: "access-panel", label: "Access Panel", note: "keep open" },
];

function featurePlanSize(feature: RoomFeature) {
  return (feature.rotation ?? 0) === 90
    ? { width: feature.depth, depth: feature.width }
    : { width: feature.width, depth: feature.depth };
}

function footprintSize(footprint: { points: { x: number; y: number }[] }) {
  const xs = footprint.points.map((point) => point.x);
  const ys = footprint.points.map((point) => point.y);

  return {
    width: Math.round(Math.max(...xs) - Math.min(...xs)),
    depth: Math.round(Math.max(...ys) - Math.min(...ys)),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

export default function Home() {
  const {
    closetConfig: config,
    closetFootprint,
    roomFeatures,
    setClosetConfig,
    setClosetFootprint,
    setRoomFeatures,
    addRoomFeature,
    updateRoomFeature,
    removeRoomFeature,
  } = useDesignStore();

  function adjustCeilingHeight(delta: number) {
    setClosetConfig({ height: Math.max(84, Math.min(120, config.height + delta)) });
  }

  useEffect(() => {
    const size = footprintSize(closetFootprint);
    const mismatched =
      Math.abs(size.width - config.width) > 1 ||
      Math.abs(size.depth - config.depth) > 1 ||
      Math.abs(size.minX) > 1 ||
      Math.abs(size.minY) > 1;

    if (mismatched) setClosetFootprint(closetFootprint);
  }, [closetFootprint, config.depth, config.width, setClosetFootprint]);

  function rotateRoomFeature(id: string) {
    const feature = roomFeatures.find((item) => item.id === id);
    if (!feature) return;

    const nextRotation = (feature.rotation ?? 0) === 0 ? 90 : 0;
    const nextWidth = nextRotation === 90 ? feature.depth : feature.width;
    const nextDepth = nextRotation === 90 ? feature.width : feature.depth;

    updateRoomFeature(id, {
      rotation: nextRotation,
      x: Math.min(feature.x, Math.max(0, config.width - nextWidth)),
      y: Math.min(feature.y, Math.max(0, config.depth - nextDepth)),
    });
  }

  return (
    <div className="min-h-screen bg-[#dfe7e0]">
      <Toolbar />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 xl:flex-row xl:items-start xl:gap-8">

        {/* ── Floor plan canvas (hero) ── */}
        <div className="flex-1 rounded-xl border border-[#cdd8d0] bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48645a]">Floor plan · top view</div>
              <h1 className="mt-0.5 text-xl font-semibold text-[#1f2824]">{SHAPE_NAMES[config.shape]}</h1>
              <p className="mt-1 text-xs text-[#6f7d76]">
                {closetFootprint.points.length} measured points · {Math.round(closetFootprint.opening.width)}&quot; opening · {Math.round(closetFootprint.confidence * 100)}% confidence
              </p>
            </div>
            <div className="text-right text-xs text-[#6f7d76]">
              <div className="font-semibold text-[#1f2824] text-sm">{config.width}&quot; x {config.depth}&quot;</div>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustCeilingHeight(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee] disabled:opacity-35"
                  disabled={config.height <= 84}
                  aria-label="Decrease ceiling height"
                  title="Decrease ceiling height"
                >
                  -
                </button>
                <div className="flex items-baseline gap-1">
                  <span className="inline-flex h-7 min-w-14 items-center justify-center rounded-md border border-[#cbd6ce] bg-white px-2 text-sm font-semibold text-[#25302c]">
                    {config.height}&quot;
                  </span>
                  <span>ceiling</span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustCeilingHeight(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee] disabled:opacity-35"
                  disabled={config.height >= 120}
                  aria-label="Increase ceiling height"
                  title="Increase ceiling height"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-lg bg-[#f0ece5] px-2 py-4">
            <ClosetFloorPlan
              config={config}
              footprint={closetFootprint}
              roomFeatures={roomFeatures}
              onChange={setClosetConfig}
              onFootprintChange={setClosetFootprint}
              onRoomFeaturesChange={setRoomFeatures}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-[#6f7d76]">
            Drag room handles for clean dimensions, or drag the round measured points to mimic an AR clockwise wall trace.
          </p>
        </div>

        {/* ── Controls ── */}
        <aside className="w-full xl:w-[280px] flex flex-col gap-4">

          {/* Shape */}
          <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Room shape</h2>
            <p className="mt-1 text-xs text-[#6f7d76]">Sets which walls were measured.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ShapeButton label="Single Wall" sublabel="back wall only" value="straight" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Left Wall" sublabel="back + left" value="left" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Right Wall" sublabel="back + right" value="right" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="U Room" sublabel="back + sides" value="u" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Walk-in Room" sublabel="walls + entry" value="walk-in" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
            </div>
          </div>

          <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Room features</h2>
            <p className="mt-1 text-xs text-[#6f7d76]">Add constraints the 3D layout should understand.</p>
            <div className="mt-3 space-y-2">
              {FEATURE_TOOLS.map((tool) => (
                <button
                  key={tool.kind}
                  type="button"
                  onClick={() => addRoomFeature(tool.kind)}
                  className="flex w-full items-center justify-between rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-left transition hover:bg-[#eef3ee]"
                >
                  <span className="text-sm font-semibold text-[#25302c]">{tool.label}</span>
                  <span className="text-[10px] text-[#8a9990]">{tool.note}</span>
                </button>
              ))}
            </div>
            {roomFeatures.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {roomFeatures.map((feature) => {
                  const plan = featurePlanSize(feature);

                  return (
                    <div key={feature.id} className="flex items-center justify-between rounded-md bg-[#f6f8f5] px-2.5 py-2">
                      <div>
                        <div className="text-xs font-semibold text-[#25302c]">{feature.label}</div>
                        <div className="text-[10px] text-[#6f7d76]">{plan.width}&quot; x {plan.depth}&quot; · {feature.behavior}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => rotateRoomFeature(feature.id)}
                          className="text-[10px] font-semibold text-[#48645a] hover:text-[#25302c]"
                        >
                          Rotate
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRoomFeature(feature.id)}
                          className="text-[10px] font-semibold text-[#a06858] hover:text-[#7e4e40]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Measure space using your phone</h2>
            <p className="mt-1 text-xs leading-5 text-[#6f7d76]">
              Prototype for the AR path: start at the left jamb, trace clockwise, then confirm the generated 2D shape.
            </p>
            <button
              type="button"
              onClick={() => setClosetFootprint(buildMockArFootprint(config))}
              className="mt-3 w-full rounded-md border border-[#25302c] bg-[#25302c] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2420]"
            >
              Mock AR scan with jog
            </button>
            <p className="mt-2 text-[11px] leading-4 text-[#8a9990]">
              The scan output is saved as polygon points, not just width and depth.
            </p>
          </div> */}

          {/* CTA */}
          <Link
            href="/blocks"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25302c] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2420]"
          >
            Build product blocks
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <p className="text-center text-xs text-[#8a9990]">
            {config.width}&quot; wide · {config.depth}&quot; deep · {config.height}&quot; tall
          </p>
        </aside>
      </main>
    </div>
  );
}
