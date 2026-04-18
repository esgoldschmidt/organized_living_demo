"use client";

import Link from "next/link";
import Toolbar from "@/components/Toolbar";
import ClosetFloorPlan from "@/components/ClosetFloorPlan";
import { buildMockArFootprint, useDesignStore } from "@/store/designStore";
import type { ClosetShape } from "@/store/designStore";

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

function Slider({ label, value, min, max, step, suffix = "in", onChange }: {
  label: string; value: number; min: number; max: number;
  step: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold text-[#51615b]">
        <span>{label}</span>
        <span className="text-[#25302c]">{value} {suffix}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#25302c]"
      />
    </label>
  );
}

const SHAPE_NAMES: Record<ClosetShape, string> = {
  straight: "Straight",
  left: "Left L",
  right: "Right L",
  u: "U-Shape",
  "walk-in": "Walk-in Room",
};

export default function Home() {
  const {
    closetConfig: config,
    closetFootprint,
    setClosetConfig,
    setClosetFootprint,
  } = useDesignStore();

  return (
    <div className="min-h-screen bg-[#dfe7e0]">
      <Toolbar />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 xl:flex-row xl:items-start xl:gap-8">

        {/* ── Floor plan canvas (hero) ── */}
        <div className="flex-1 rounded-xl border border-[#cdd8d0] bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48645a]">Floor plan · top view</div>
              <h1 className="mt-0.5 text-xl font-semibold text-[#1f2824]">{SHAPE_NAMES[config.shape]} closet</h1>
              <p className="mt-1 text-xs text-[#6f7d76]">
                {closetFootprint.points.length} measured points · {Math.round(closetFootprint.opening.width)}&quot; opening · {Math.round(closetFootprint.confidence * 100)}% confidence
              </p>
            </div>
            <div className="text-right text-xs text-[#6f7d76]">
              <div className="font-semibold text-[#1f2824] text-sm">{config.width}&quot; x {config.depth}&quot;</div>
              <div>{config.height}&quot; ceiling</div>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-lg bg-[#f0ece5] px-2 py-4">
            <ClosetFloorPlan
              config={config}
              footprint={closetFootprint}
              onChange={setClosetConfig}
              onFootprintChange={setClosetFootprint}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-[#6f7d76]">
            Drag wall handles for clean presets, or drag the round measured points to mimic an AR clockwise wall trace.
          </p>
        </div>

        {/* ── Controls ── */}
        <aside className="w-full xl:w-[280px] flex flex-col gap-4">

          {/* Shape */}
          <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Layout</h2>
            <p className="mt-1 text-xs text-[#6f7d76]">Sets which walls your closet has.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ShapeButton label="Straight" sublabel="back wall only" value="straight" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Left L" sublabel="back + left" value="left" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Right L" sublabel="back + right" value="right" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="U-Shape" sublabel="back + both sides" value="u" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
              <ShapeButton label="Walk-in Room" sublabel="3 walls + entry" value="walk-in" current={config.shape} onClick={(s) => setClosetConfig({ shape: s })} />
            </div>
          </div>

          <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Measure space</h2>
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
          </div>

          {/* Height */}
          <div className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1f2824]">Ceiling height</h2>
            <p className="mt-1 text-xs text-[#6f7d76]">Not visible in the top-down view.</p>
            <div className="mt-3">
              <Slider label="Height" value={config.height} min={84} max={120} step={6}
                onChange={(height) => setClosetConfig({ height })} />
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/preview"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25302c] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2420]"
          >
            Continue to 3D view
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
