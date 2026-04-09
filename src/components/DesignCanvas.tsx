"use client";
import { useRef, useState } from "react";
import { useDesignStore } from "@/store/designStore";
import { ClosetComponent, ComponentType } from "@/types";

const SCALE = 5; // px per inch
const GRID = 6;  // snap grid in inches

function snapTo(val: number, grid: number) {
  return Math.round(val / grid) * grid;
}

function PlacedComponent({
  comp,
  scale,
  selected,
  onSelect,
  onDragEnd,
}: {
  comp: ClosetComponent;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const dragStart = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: comp.x, y: comp.y });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: comp.x, cy: comp.y };
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.mx) / scale;
      const dy = (ev.clientY - dragStart.current.my) / scale;
      setPos({
        x: snapTo(dragStart.current.cx + dx, GRID),
        y: snapTo(dragStart.current.cy + dy, GRID),
      });
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.mx) / scale;
      const dy = (ev.clientY - dragStart.current.my) / scale;
      onDragEnd(
        Math.max(0, snapTo(dragStart.current.cx + dx, GRID)),
        Math.max(0, snapTo(dragStart.current.cy + dy, GRID))
      );
      setDragging(false);
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: (dragging ? pos.x : comp.x) * scale,
        top: (dragging ? pos.y : comp.y) * scale,
        width: comp.w * scale,
        height: comp.h * scale,
        backgroundColor: comp.color + "55",
        border: `2px solid ${selected ? "#16a34a" : comp.color}`,
        borderRadius: 4,
        cursor: dragging ? "grabbing" : "grab",
        boxShadow: selected ? `0 0 0 2px #16a34a44` : undefined,
        zIndex: selected ? 10 : 1,
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* Inner detail lines based on type */}
      {comp.type === "shelf" && (
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(90deg, ${comp.color}22 0, ${comp.color}22 1px, transparent 1px, transparent ${GRID * scale}px)` }} />
      )}
      {(comp.type === "hanging-rod" || comp.type === "double-hang") && (
        <div style={{ position: "absolute", top: 3, left: 4, right: 4, height: 2, backgroundColor: comp.color, borderRadius: 1 }} />
      )}
      {comp.type === "double-hang" && (
        <div style={{ position: "absolute", top: "50%", left: 4, right: 4, height: 2, backgroundColor: comp.color, borderRadius: 1 }} />
      )}
      {/* Label */}
      <div style={{
        position: "absolute",
        bottom: 2,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: Math.max(9, Math.min(12, comp.h * scale / 5)),
        fontWeight: 600,
        color: comp.color,
        opacity: 0.9,
        lineHeight: 1.1,
        padding: "0 2px",
      }}>
        {comp.label}
        <br />
        <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.7 }}>{comp.w}&quot; × {comp.h}&quot;</span>
      </div>
    </div>
  );
}

export default function DesignCanvas() {
  const { dimensions, components, selectedId, addComponent, moveComponent, selectComponent } =
    useDesignStore();

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("componentType") as ComponentType;
    if (!type || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xInches = snapTo((e.clientX - rect.left) / SCALE, GRID);
    const yInches = snapTo((e.clientY - rect.top) / SCALE, GRID);
    addComponent(type, Math.max(0, xInches), Math.max(0, yInches));
  };

  const canvasW = dimensions.width * SCALE;
  const canvasH = dimensions.height * SCALE;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[linear-gradient(180deg,rgba(255,251,246,0.3),rgba(203,179,150,0.14))] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-8 top-8 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-100/20 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-8">
          
        </div>

        {/* Shadow / floor line */}
        <div
          style={{ width: canvasW + 24, height: 8, marginLeft: 12, background: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)", borderRadius: "0 0 4px 4px" }}
          className="absolute -bottom-2"
        />

        {/* Wall background */}
        <div
          ref={canvasRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => selectComponent(null)}
          style={{
            width: canvasW,
            height: canvasH,
            position: "relative",
            backgroundColor: "#f8f4ee",
            backgroundImage: `
              radial-gradient(circle at top, rgba(255,255,255,0.7), transparent 52%),
              linear-gradient(rgba(90,67,49,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(90,67,49,0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID * SCALE}px ${GRID * SCALE}px`,
            border: "3px solid #b8a089",
            borderBottom: "7px solid #8d6f56",
            borderRadius: 18,
            boxShadow: "inset 0 0 55px rgba(100,77,56,0.08), 0 18px 46px rgba(61,42,26,0.17)",
            overflow: "hidden",
            cursor: "crosshair",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.18), transparent 38%, rgba(172,134,99,0.06) 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Dimension labels */}
          <div style={{
            position: "absolute", top: 4, left: 0, right: 0, textAlign: "center",
            fontSize: 10, color: "#9d8268", fontWeight: 600, pointerEvents: "none"
          }}>
            {dimensions.width}&quot;W × {dimensions.height}&quot;H
          </div>

          {/* Drop hint */}
          {components.length === 0 && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", pointerEvents: "none"
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2 }}>
                <rect x="8" y="20" width="32" height="4" rx="2" fill="#7c624d" />
                <path d="M24 8v12M24 40V28" stroke="#7c624d" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 16l8-8 8 8M16 32l8 8 8-8" stroke="#7c624d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ fontSize: 13, color: "#8b735c", marginTop: 8 }}>Drag components from the left panel to sketch the reveal</p>
            </div>
          )}

          {components.map((comp) => (
            <PlacedComponent
              key={comp.id}
              comp={comp}
              scale={SCALE}
              selected={comp.id === selectedId}
              onSelect={() => selectComponent(comp.id)}
              onDragEnd={(x, y) => moveComponent(comp.id, x, y)}
            />
          ))}
        </div>

        {/* Ruler - bottom */}
        <div style={{ display: "flex", width: canvasW, marginTop: 4 }}>
          {Array.from({ length: Math.floor(dimensions.width / 12) + 1 }).map((_, i) => (
            <div key={i} style={{ flex: i < Math.floor(dimensions.width / 12) ? "0 0 " + 12 * SCALE + "px" : "0 0 auto", fontSize: 9, color: "#9d8268", borderLeft: "1px solid #dbc8b4", paddingLeft: 2 }}>
              {i * 12}&quot;
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
