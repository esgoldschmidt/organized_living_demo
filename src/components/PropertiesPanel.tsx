"use client";
import { useDesignStore } from "@/store/designStore";
import { PALETTE_ITEMS } from "@/types";
import { Trash2 } from "lucide-react";

export default function PropertiesPanel() {
  const { components, selectedId, dimensions, setDimensions, resizeComponent, removeComponent, selectComponent } =
    useDesignStore();

  const selected = components.find((c) => c.id === selectedId);
  const palette = selected ? PALETTE_ITEMS.find((p) => p.type === selected.type) : null;

  return (
    <aside className="flex w-64 flex-col overflow-y-auto border-l border-[var(--panel-border)] bg-[var(--panel-surface)] backdrop-blur-sm">
      {/* Closet Dimensions */}
      <div className="border-b border-[var(--panel-border)] px-4 py-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Closet Size</h2>
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-stone-500">Width (inches)</span>
            <input
              type="number"
              min={24}
              max={240}
              value={dimensions.width}
              onChange={(e) => setDimensions({ width: Number(e.target.value) })}
              className="mt-1 block w-full rounded-xl border border-stone-200 bg-white/85 px-3 py-2 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Height (inches)</span>
            <input
              type="number"
              min={48}
              max={120}
              value={dimensions.height}
              onChange={(e) => setDimensions({ height: Number(e.target.value) })}
              className="mt-1 block w-full rounded-xl border border-stone-200 bg-white/85 px-3 py-2 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        </div>
      </div>

      {/* Selected Component */}
      <div className="px-4 py-3 flex-1">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {selected ? "Selected Component" : "Properties"}
        </h2>

        {!selected && (
          <p className="text-xs text-stone-400">Click a component on the canvas to edit its properties.</p>
        )}

        {selected && palette && (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 rounded-2xl p-3"
              style={{ backgroundColor: selected.color + "22" }}
            >
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: selected.color }} />
              <span className="text-sm font-semibold text-stone-800">{selected.label}</span>
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-stone-500">Width (inches)</span>
                <input
                  type="number"
                  min={6}
                  max={dimensions.width}
                  step={6}
                  value={selected.w}
                  onChange={(e) => resizeComponent(selected.id, Number(e.target.value), selected.h)}
                  className="mt-1 block w-full rounded-xl border border-stone-200 bg-white/85 px-3 py-2 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Height (inches)</span>
                <input
                  type="number"
                  min={2}
                  max={dimensions.height}
                  step={2}
                  value={selected.h}
                  onChange={(e) => resizeComponent(selected.id, selected.w, Number(e.target.value))}
                  className="mt-1 block w-full rounded-xl border border-stone-200 bg-white/85 px-3 py-2 text-sm text-stone-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
            </div>

            <div className="border-t border-stone-200/70 pt-1">
              <div className="mb-1 flex justify-between text-xs text-stone-500">
                <span>Position</span>
                <span>{selected.x}&quot; from left, {selected.y}&quot; from top</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Unit price</span>
                <span className="font-semibold text-emerald-700">${palette.priceEach}</span>
              </div>
            </div>

            <button
              onClick={() => { removeComponent(selected.id); selectComponent(null); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
