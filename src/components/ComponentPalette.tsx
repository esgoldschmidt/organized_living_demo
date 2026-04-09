"use client";
import { PALETTE_ITEMS, PaletteItem } from "@/types";

const ICONS: Record<string, React.ReactNode> = {
  shelf: (
    <svg viewBox="0 0 40 20" className="w-10 h-5">
      <rect x="0" y="8" width="40" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="12" width="2" height="6" fill="currentColor" opacity="0.5" />
      <rect x="36" y="12" width="2" height="6" fill="currentColor" opacity="0.5" />
    </svg>
  ),
  rod: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect x="0" y="6" width="40" height="3" rx="1.5" fill="currentColor" />
      <line x1="8" y1="9" x2="8" y2="32" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
      <line x1="20" y1="9" x2="20" y2="32" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
      <line x1="32" y1="9" x2="32" y2="32" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
    </svg>
  ),
  double: (
    <svg viewBox="0 0 40 48" className="w-10 h-12">
      <rect x="0" y="4" width="40" height="3" rx="1.5" fill="currentColor" />
      <rect x="0" y="26" width="40" height="3" rx="1.5" fill="currentColor" />
      <line x1="10" y1="7" x2="10" y2="24" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
      <line x1="30" y1="7" x2="30" y2="24" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
      <line x1="10" y1="29" x2="10" y2="44" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
      <line x1="30" y1="29" x2="30" y2="44" stroke="currentColor" strokeWidth="1" strokeDasharray="2,3" />
    </svg>
  ),
  drawers: (
    <svg viewBox="0 0 40 48" className="w-10 h-12">
      <rect x="1" y="1" width="38" height="46" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      {[8, 18, 28, 38].map((y, i) => (
        <g key={i}>
          <rect x="3" y={y - 5} width="34" height="9" rx="1" fill="currentColor" opacity="0.2" />
          <rect x="16" y={y - 1} width="8" height="2" rx="1" fill="currentColor" />
        </g>
      ))}
    </svg>
  ),
  shoes: (
    <svg viewBox="0 0 40 20" className="w-10 h-5">
      <line x1="0" y1="16" x2="40" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="0" y1="20" x2="40" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  tower: (
    <svg viewBox="0 0 32 72" className="w-8 h-18">
      <rect x="1" y="1" width="30" height="70" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      {[14, 28, 42, 56].map((y, i) => (
        <rect key={i} x="3" y={y} width="26" height="1.5" fill="currentColor" opacity="0.5" />
      ))}
    </svg>
  ),
};

export default function ComponentPalette() {
  const handleDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData("componentType", item.type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="flex w-60 flex-col border-r border-[var(--panel-border)] bg-[var(--panel-surface)] backdrop-blur-sm">
      <div className="border-b border-[var(--panel-border)] px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Components</h2>
        <p className="mt-1 text-xs text-stone-400">Drag pieces into the concept wall</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="group flex cursor-grab items-center gap-3 rounded-2xl border border-white/75 bg-[rgba(255,255,255,0.66)] p-3 shadow-[0_10px_26px_rgba(92,65,39,0.05)] transition-all hover:-translate-y-0.5 hover:border-emerald-400/55 hover:bg-white active:cursor-grabbing"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: item.color + "30", color: item.color }}
            >
              {ICONS[item.icon]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-stone-800">{item.label}</p>
              <p className="mt-0.5 text-xs leading-tight text-stone-400">{item.description}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">${item.priceEach}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
