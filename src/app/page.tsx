"use client";
import ComponentPalette from "@/components/ComponentPalette";
import DesignCanvas from "@/components/DesignCanvas";
import PropertiesPanel from "@/components/PropertiesPanel";
import BOMPanel from "@/components/BOMPanel";
import Toolbar from "@/components/Toolbar";

export default function Home() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--page-base)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient-pan absolute inset-0 bg-[url('/i-m-zion-c9JXaee_FdU-unsplash.jpg')] bg-cover bg-center opacity-65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(180,140,103,0.22),transparent_24%),linear-gradient(180deg,rgba(255,250,244,0.28),rgba(104,76,52,0.2))]" />
        <div className="ambient-float absolute -left-24 top-18 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="ambient-float absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-amber-100/25 blur-3xl [animation-delay:1.6s]" />
      </div>

      <div className="relative flex flex-1 flex-col p-3 md:p-5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-white/45 bg-[rgba(248,243,236,0.72)] shadow-[0_24px_70px_rgba(68,44,25,0.18)] backdrop-blur-md">
          <Toolbar />
          <div className="flex flex-1 overflow-hidden">
            <ComponentPalette />
            <main className="flex flex-1 flex-col overflow-hidden">
              <div className="border-y border-[var(--panel-border)] bg-white/35 px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/70 bg-[rgba(130,95,66,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-900/80">
                    Mobile Capture + Desktop Design
                  </span>
                  <p className="text-sm text-stone-700/80">
                    Homeowners measure and photograph the space on phone, then sales and design teams turn that scan into a proposal-ready closet concept here.
                  </p>
                </div>
              </div>
              <DesignCanvas />
              <BOMPanel />
            </main>
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
