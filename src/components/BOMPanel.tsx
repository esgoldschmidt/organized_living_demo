"use client";
import { useDesignStore } from "@/store/designStore";
import { PALETTE_ITEMS } from "@/types";

export default function BOMPanel() {
  const components = useDesignStore((s) => s.components);

  // Group by type
  const grouped = components.reduce<Record<string, { label: string; count: number; price: number }>>((acc, c) => {
    const palette = PALETTE_ITEMS.find((p) => p.type === c.type)!;
    if (!acc[c.type]) {
      acc[c.type] = { label: palette.label, count: 0, price: palette.priceEach };
    }
    acc[c.type].count++;
    return acc;
  }, {});

  const lineItems = Object.values(grouped);
  const total = lineItems.reduce((sum, li) => sum + li.count * li.price, 0);

  return (
    <div className="border-t border-[var(--panel-border)] bg-[var(--panel-strong)] backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-stone-200/70 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Bill of Materials</h2>
        <span className="text-xs text-stone-400">{components.length} component{components.length !== 1 ? "s" : ""}</span>
      </div>

      {lineItems.length === 0 ? (
        <p className="px-4 py-3 text-xs text-stone-400">No components placed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/55">
                <th className="px-4 py-2 text-left font-medium text-stone-500">Component</th>
                <th className="px-4 py-2 text-center font-medium text-stone-500">Qty</th>
                <th className="px-4 py-2 text-right font-medium text-stone-500">Unit</th>
                <th className="px-4 py-2 text-right font-medium text-stone-500">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60">
              {lineItems.map((li) => (
                <tr key={li.label} className="hover:bg-white/45">
                  <td className="px-4 py-2 text-stone-700">{li.label}</td>
                  <td className="px-4 py-2 text-center text-stone-700">{li.count}</td>
                  <td className="px-4 py-2 text-right text-stone-500">${li.price}</td>
                  <td className="px-4 py-2 text-right font-medium text-stone-800">${li.count * li.price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-emerald-50/90">
                <td colSpan={3} className="px-4 py-2 font-semibold text-stone-700">Estimated Total</td>
                <td className="px-4 py-2 text-right font-bold text-emerald-700">${total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
