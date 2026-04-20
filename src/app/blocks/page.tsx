"use client";

import { useState } from "react";
import Link from "next/link";
import Toolbar from "@/components/Toolbar";
import { buildMaterialList, useDesignStore } from "@/store/designStore";
import type { ProductBlock, ProductBlockKind, ProductLine, RoomFeature } from "@/types";

const TEMPLATES: { kind: ProductBlockKind; name: string; detail: string }[] = [
  { kind: "shelf-rod", name: "Shelf + Rod", detail: "Rail, shelf, single hang" },
  { kind: "double-hang", name: "Double Hang", detail: "Two hanging zones" },
  { kind: "drawer-stack", name: "Drawer Stack", detail: "Select-style drawers and shelf" },
  { kind: "shoe-tower", name: "Shoe Tower", detail: "Angled shoe shelves" },
  { kind: "open-shelves", name: "Open Shelves", detail: "Adjustable shelves" },
];

const FINISHES: Record<ProductLine, string[]> = {
  freedomRail: ["White", "Driftwood Live", "Snowdrift Live", "Chocolate Pear", "Century Gray"],
  select: ["Snowdrift Live", "White", "Driftwood Live", "Whiskey Walnut", "Blonde Oak"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatLine(line: ProductLine) {
  return line === "freedomRail" ? "freedomRail" : "Select";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function featurePlanSize(feature: RoomFeature) {
  return (feature.rotation ?? 0) === 90
    ? { width: feature.depth, depth: feature.width }
    : { width: feature.width, depth: feature.depth };
}

function BlockElevation({ block }: { block: ProductBlock }) {
  const scale = 3.2;
  const pad = 42;
  const w = block.width * scale;
  const h = block.height * scale;
  const svgW = w + pad * 2;
  const svgH = h + pad * 2;
  const baseY = pad + h;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-full max-h-[560px] w-full">
      <defs>
        <pattern id="blockGrid" width={6 * scale} height={6 * scale} patternUnits="userSpaceOnUse">
          <path d={`M ${6 * scale} 0 L 0 0 0 ${6 * scale}`} fill="none" stroke="#dde2dc" strokeWidth={0.6} />
        </pattern>
      </defs>
      <rect x={pad} y={pad} width={w} height={h} fill="url(#blockGrid)" />
      <rect x={pad} y={pad} width={w} height={h} fill="#f8f8f4" opacity={0.72} stroke="#cbd6ce" strokeWidth={1.2} />
      {block.parts.map((part) => {
        const x = pad + w / 2 + (part.x - part.width / 2) * scale;
        const y = baseY - (part.y + part.height / 2) * scale;
        const partW = part.width * scale;
        const partH = Math.max(2, part.height * scale);
        const fill =
          part.type === "rod"
            ? "#4e504d"
            : part.type === "drawer"
              ? "#d8d1c8"
              : part.type === "rail" || part.type === "upright"
                ? "#8d9690"
                : part.type === "panel"
                  ? "#eeeae3"
                  : "#f0eee8";

        if (part.type === "rod") {
          return (
            <line
              key={part.id}
              x1={x}
              x2={x + partW}
              y1={y + partH / 2}
              y2={y + partH / 2}
              stroke={fill}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        }

        return (
          <rect
            key={part.id}
            x={x}
            y={y}
            width={partW}
            height={partH}
            rx={3}
            fill={fill}
            stroke="#c8c0b7"
            strokeWidth={0.8}
          />
        );
      })}
      <text x={pad} y={pad - 12} fill="#53635d" fontSize={12} fontFamily="system-ui,sans-serif">
        {block.width}&quot; W x {block.height}&quot; H x {block.depth}&quot; D
      </text>
    </svg>
  );
}

export default function BlocksPage() {
  const {
    closetConfig,
    productBlocks,
    selectedBlockId,
    setSelectedBlockId,
    addProductBlock,
    updateProductBlock,
    removeProductBlock,
    createAssembly,
    dissolveAssembly,
    roomFeatures,
    updateRoomFeature,
  } = useDesignStore();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const selectedBlock = productBlocks.find((block) => block.id === selectedBlockId) ?? productBlocks[0] ?? null;

  const groups = Array.from(
    productBlocks.reduce((map, block) => {
      if (block.groupId) {
        map.set(block.groupId, [...(map.get(block.groupId) ?? []), block]);
      }
      return map;
    }, new Map<string, typeof productBlocks>())
  );
  const looseBlocks = productBlocks.filter((block) => !block.groupId);
  const effectiveChecked = new Set([...checkedIds].filter((id) => looseBlocks.some((b) => b.id === id)));
  const materialScopeBlocks = selectedBlock ? [selectedBlock] : [];
  const materialLines = buildMaterialList(materialScopeBlocks, closetConfig);
  const materialSubtotal = materialLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const materialsByCategory = {
    manufactured: materialLines.filter((line) => line.category === "manufactured"),
    hardware: materialLines.filter((line) => line.category === "hardware"),
    install: materialLines.filter((line) => line.category === "install"),
  };

  function updateSelected(update: Partial<ProductBlock>) {
    if (!selectedBlock) return;
    updateProductBlock(selectedBlock.id, update);
  }

  function adjustSelected(key: "width" | "height" | "depth", delta: number, min: number, max: number) {
    if (!selectedBlock) return;
    updateSelected({ [key]: clamp(selectedBlock[key] + delta, min, max) } as Partial<ProductBlock>);
  }

  function rotateRoomFeature(feature: RoomFeature) {
    const nextRotation = (feature.rotation ?? 0) === 0 ? 90 : 0;
    const nextSize = nextRotation === 90
      ? { width: feature.depth, depth: feature.width }
      : { width: feature.width, depth: feature.depth };

    updateRoomFeature(feature.id, {
      rotation: nextRotation,
      x: Math.min(feature.x, Math.max(0, closetConfig.width - nextSize.width)),
      y: Math.min(feature.y, Math.max(0, closetConfig.depth - nextSize.depth)),
    });
  }

  return (
    <div className="min-h-screen bg-[#dfe7e0]">
      <Toolbar />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48645a]">Step 2</div>
          <h1 className="mt-1 text-xl font-semibold text-[#1f2824]">Build storage blocks</h1>
          <p className="mt-2 text-sm leading-6 text-[#5f6d67]">
            Create the product assemblies first. Each block moves as one piece in the room.
          </p>

          <div className="mt-5 space-y-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.kind}
                type="button"
                onClick={() => addProductBlock(template.kind)}
                className="w-full rounded-md border border-[#d8dfd8] bg-[#fbfcfb] px-3 py-2.5 text-left transition hover:border-[#25302c] hover:bg-[#f6f8f5]"
              >
                <div className="text-sm font-semibold text-[#25302c]">{template.name}</div>
                <div className="mt-0.5 text-xs text-[#6f7d76]">{template.detail}</div>
              </button>
            ))}
          </div>

          <Link
            href="/"
            className="mt-5 flex w-full items-center justify-center rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
          >
            Back to room
          </Link>

          {roomFeatures.length > 0 && (
            <div className="mt-5 border-t border-[#e3e9e3] pt-5">
              <h2 className="text-sm font-semibold text-[#1f2824]">Room constraints</h2>
              <p className="mt-1 text-xs leading-5 text-[#6f7d76]">Rotate measured features before placing blocks.</p>
              <div className="mt-3 space-y-2">
                {roomFeatures.map((feature) => {
                  const plan = featurePlanSize(feature);

                  return (
                    <div key={feature.id} className="rounded-md border border-[#d8dfd8] bg-[#fbfcfb] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-[#25302c]">{feature.label}</div>
                          <div className="mt-0.5 text-[10px] text-[#6f7d76]">
                            {plan.width}&quot; x {plan.depth}&quot; · {(feature.rotation ?? 0)} deg
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => rotateRoomFeature(feature)}
                          className="rounded-md border border-[#cbd6ce] bg-white px-2 py-1 text-[10px] font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
                        >
                          Rotate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <section className="min-h-[620px] rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
          {selectedBlock ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e3e9e3] pb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48645a]">{formatLine(selectedBlock.productLine)}</div>
                  <h2 className="mt-1 text-2xl font-semibold text-[#1f2824]">{selectedBlock.name}</h2>
                  <p className="mt-1 text-sm text-[#6f7d76]">{selectedBlock.finish} · {selectedBlock.parts.length} manufactured parts</p>
                </div>
                <div className="rounded-md bg-[#f0f4f0] px-3 py-2 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">Block estimate</div>
                  <div className="text-xl font-semibold text-[#1f2824]">${selectedBlock.price.toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-4 flex min-h-[520px] items-center justify-center rounded-lg bg-[#f4f2ec] p-4">
                <BlockElevation block={selectedBlock} />
              </div>
              <div className="mt-4 rounded-lg border border-[#d8dfd8] bg-[#fbfcfb] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#25302c]">Selected block materials</h3>
                    <p className="mt-1 text-xs leading-5 text-[#6f7d76]">
                      Mock cost basis for this block. The block estimate is the sell price; this list explains the parts and install hardware behind it.
                    </p>
                  </div>
                  <div className="rounded-md bg-[#f0f4f0] px-3 py-2 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">Cost basis</div>
                    <div className="text-lg font-semibold text-[#1f2824]">{formatCurrency(materialSubtotal)}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {([
                    ["manufactured", "Manufactured"],
                    ["hardware", "Hardware"],
                    ["install", "Install kit"],
                  ] as const).map(([category, label]) => (
                    <div key={category} className="rounded-md border border-[#e3e9e3] bg-white p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">{label}</div>
                      <div className="mt-2 space-y-1.5">
                        {materialsByCategory[category].slice(0, 4).map((line) => (
                          <div key={line.id} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-[#53635d]">{line.name}</span>
                            <span className="shrink-0 font-semibold text-[#25302c]">{line.qty} {line.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[520px] items-center justify-center rounded-lg bg-[#f4f2ec] p-8 text-center text-sm text-[#6f7d76]">
              Add a storage block to begin.
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-[#cdd8d0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1f2824]">Block library</h2>

          {/* Assemblies */}
          {groups.length > 0 && (
            <div className="mt-3 space-y-2">
              {groups.map(([groupId, blocks], index) => {
                const runWidth = blocks.reduce((sum, b) => sum + b.width, 0);
                return (
                  <div key={groupId} className="rounded-md border border-[#cbd6ce] bg-[#f6f8f5] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#25302c]">
                        Assembly {index + 1} · {blocks.length} blocks · {runWidth}&quot;
                      </div>
                      <button
                        type="button"
                        onClick={() => dissolveAssembly(groupId)}
                        className="text-[10px] font-semibold text-[#a06858] hover:text-[#7e3c2c]"
                      >
                        Dissolve
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {blocks.map((b) => (
                        <span key={b.id} className="rounded border border-[#d8dfd8] bg-white px-1.5 py-0.5 text-[10px] text-[#53635d]">
                          {b.name} {b.width}&quot;
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loose blocks with checkboxes */}
          {looseBlocks.length > 0 && (
            <>
              <div className="mt-3 space-y-1.5">
                {looseBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`flex items-center gap-2 rounded-md border p-2.5 transition ${
                      selectedBlock?.id === block.id ? "border-[#25302c] bg-[#f6f8f5]" : "border-[#d8dfd8] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={effectiveChecked.has(block.id)}
                      onChange={(e) => {
                        const next = new Set(checkedIds);
                        if (e.target.checked) next.add(block.id);
                        else next.delete(block.id);
                        setCheckedIds(next);
                      }}
                      className="h-3.5 w-3.5 accent-[#25302c]"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedBlockId(block.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#25302c]">{block.name}</span>
                        <span className="rounded bg-[#eef3ee] px-1.5 py-0.5 text-[10px] font-semibold text-[#53635d]">{formatLine(block.productLine)}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#6f7d76]">{block.width}&quot; × {block.height}&quot; × {block.depth}&quot;</div>
                    </button>
                  </div>
                ))}
              </div>
              {effectiveChecked.size >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    createAssembly(Array.from(effectiveChecked));
                    setCheckedIds(new Set());
                  }}
                  className="mt-2 w-full rounded-md border border-[#25302c] bg-[#25302c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1a2320]"
                >
                  Link {effectiveChecked.size} selected edge-to-edge
                </button>
              )}
            </>
          )}

          {productBlocks.length === 0 && (
            <p className="mt-3 text-xs text-[#6f7d76]">Add blocks from the left panel.</p>
          )}

          {selectedBlock && (
            <div className="mt-5 space-y-4 border-t border-[#e3e9e3] pt-5">
              <label className="block">
                <span className="text-xs font-semibold text-[#51615b]">Product line</span>
                <select
                  value={selectedBlock.productLine}
                  onChange={(event) => updateSelected({ productLine: event.target.value as ProductLine, finish: FINISHES[event.target.value as ProductLine][0] })}
                  className="mt-1 w-full rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm text-[#25302c]"
                >
                  <option value="freedomRail">freedomRail</option>
                  <option value="select">Select</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#51615b]">Finish</span>
                <select
                  value={selectedBlock.finish}
                  onChange={(event) => updateSelected({ finish: event.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm text-[#25302c]"
                >
                  {FINISHES[selectedBlock.productLine].map((finish) => (
                    <option key={finish} value={finish}>{finish}</option>
                  ))}
                </select>
              </label>

              {[
                ["Width", "width", 18, Math.min(84, closetConfig.width), 6] as const,
                ["Height", "height", 36, closetConfig.height, 6] as const,
                ["Depth", "depth", 10, Math.min(24, closetConfig.depth), 1] as const,
              ].map(([label, key, min, max, step]) => (
                <div key={key}>
                  <div className="mb-1 text-xs font-semibold text-[#51615b]">{label}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustSelected(key, -step, min, max)}
                      disabled={selectedBlock[key] <= min}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee] disabled:opacity-35"
                    >
                      -
                    </button>
                    <div className="flex h-8 flex-1 items-center justify-center rounded-md border border-[#cbd6ce] bg-[#fbfcfb] text-sm font-semibold text-[#25302c]">
                      {selectedBlock[key]}&quot;
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustSelected(key, step, min, max)}
                      disabled={selectedBlock[key] >= max}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee] disabled:opacity-35"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-md border border-[#d8dfd8] bg-[#f6f8f5] p-3">
                <div className="text-xs font-semibold text-[#25302c]">Manufactured parts</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedBlock.parts.map((part) => (
                    <span key={part.id} className="rounded border border-[#d8dfd8] bg-white px-1.5 py-0.5 text-[10px] text-[#53635d]">
                      {part.label}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeProductBlock(selectedBlock.id)}
                className="w-full rounded-md border border-[#d8dfd8] bg-white px-3 py-2 text-sm font-semibold text-[#a06858] transition hover:bg-[#fdf5f3]"
              >
                Remove block
              </button>
            </div>
          )}

          <Link
            href="/preview"
            className="mt-5 flex w-full items-center justify-center rounded-md bg-[#25302c] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2420]"
          >
            Place blocks in 3D
          </Link>
        </aside>
      </main>
    </div>
  );
}
