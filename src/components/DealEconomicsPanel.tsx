"use client";

import { useState } from "react";
import { computeFeetOfProduct, useDesignStore } from "@/store/designStore";

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function fmtDecimals(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function MarkupInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);

  return (
    <input
      type="number"
      min={0}
      max={200}
      step={1}
      value={raw ?? value}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const parsed = parseFloat(raw ?? "");
        if (!isNaN(parsed)) onChange(Math.max(0, Math.min(200, parsed)));
        setRaw(null);
      }}
      className="w-14 rounded border border-[#d8dfd8] bg-white px-1.5 py-0.5 text-center text-xs font-semibold text-[#25302c] focus:border-[#25302c] focus:outline-none"
    />
  );
}

function RateInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);

  return (
    <input
      type="number"
      min={0}
      max={50}
      step={0.01}
      value={raw ?? value}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const parsed = parseFloat(raw ?? "");
        if (!isNaN(parsed)) onChange(Math.max(0, Math.min(50, parsed)));
        setRaw(null);
      }}
      className="w-16 rounded border border-[#d8dfd8] bg-white px-1.5 py-0.5 text-center text-xs font-semibold text-[#25302c] focus:border-[#25302c] focus:outline-none"
    />
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-[#8c9994]" : "text-[#53635d]"}>{label}</span>
      <span className={bold ? "font-bold text-[#1f2824]" : "font-semibold text-[#25302c]"}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6f8c76]">{children}</div>
  );
}

export default function DealEconomicsPanel({ materialCost }: { materialCost: number }) {
  const {
    closetConfig,
    productBlocks,
    projectName,
    setProjectName,
    materialMarkupPct,
    setMaterialMarkupPct,
    laborRatePerFt,
    setLaborRatePerFt,
    laborMarkupPct,
    setLaborMarkupPct,
  } = useDesignStore();

  const feetOfProduct = computeFeetOfProduct(productBlocks, closetConfig);

  const materialMarkup = materialCost * (materialMarkupPct / 100);
  const totalMaterialPrice = materialCost + materialMarkup;

  const laborCost = feetOfProduct * laborRatePerFt;
  const laborMarkup = laborCost * (laborMarkupPct / 100);
  const laborChargePft = laborRatePerFt * (1 + laborMarkupPct / 100);
  const totalLaborPrice = laborCost + laborMarkup;

  const projectTotal = totalMaterialPrice + totalLaborPrice;
  const gmDollars = projectTotal - materialCost - laborCost;
  const gmPct = projectTotal > 0 ? (gmDollars / projectTotal) * 100 : 0;

  const gmColor = gmPct >= 35 ? "#3a7d5a" : gmPct >= 25 ? "#6f8c76" : "#a06858";

  return (
    <div className="rounded-md border border-[#d8dfd8] bg-white text-xs">
      {/* Project header */}
      <div className="border-b border-[#e8ede8] px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f8c76]">Deal Economics</div>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-[#1f2824] placeholder-[#aab8b0] focus:outline-none"
          placeholder="Project name"
        />
      </div>

      <div className="divide-y divide-[#f0f4f0]">
        {/* Material */}
        <div className="px-4 py-3">
          <SectionLabel>Material</SectionLabel>
          <div className="space-y-1.5">
            <Row label="Cost on project" value={fmt(materialCost)} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#53635d]">Material markup</span>
              <div className="flex items-center gap-1.5">
                <MarkupInput value={materialMarkupPct} onChange={setMaterialMarkupPct} />
                <span className="text-[#8c9994]">% = {fmt(materialMarkup)}</span>
              </div>
            </div>
            <Row label="Total material price" value={fmt(totalMaterialPrice)} bold />
          </div>
        </div>

        {/* Labor */}
        <div className="px-4 py-3">
          <SectionLabel>Labor</SectionLabel>
          <div className="space-y-1.5">
            <Row label="Total ft of product" value={`${feetOfProduct} ft`} muted />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#53635d]">Cost per foot</span>
              <div className="flex items-center gap-1.5">
                <RateInput value={laborRatePerFt} onChange={setLaborRatePerFt} />
                <span className="text-[#8c9994]">/ft</span>
              </div>
            </div>
            <Row label="Total labor cost" value={fmtDecimals(laborCost)} muted />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#53635d]">Labor markup</span>
              <div className="flex items-center gap-1.5">
                <MarkupInput value={laborMarkupPct} onChange={setLaborMarkupPct} />
                <span className="text-[#8c9994]">% = {fmtDecimals(laborMarkup)}</span>
              </div>
            </div>
            <Row label="Labor charge" value={`${fmtDecimals(laborChargePft)}/ft`} muted />
            <Row label="Total labor price" value={fmtDecimals(totalLaborPrice)} bold />
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 py-3">
          <div className="space-y-1.5">
            <Row label="Project total" value={fmt(projectTotal)} bold />
            <Row label="GM dollars" value={fmt(gmDollars)} />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md px-3 py-2.5" style={{ backgroundColor: `${gmColor}14` }}>
            <span className="text-sm font-semibold" style={{ color: gmColor }}>GM Percentage</span>
            <span className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: gmColor }}>
              {gmPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
