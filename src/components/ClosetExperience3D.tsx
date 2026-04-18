"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, Line, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import Link from "next/link";
import { useDesignStore } from "@/store/designStore";
import type { ClosetConfig, ClosetShape } from "@/store/designStore";
import type { ClosetComponent } from "@/types";

const SHELF_THICKNESS = 2.5;
const WALL_THICKNESS = 8;

type ViewMode = "closet" | "open" | "inspection";
type CameraView = "corner" | "front" | "top" | "detail";
type WallVisibility = "full" | "smart" | "open";
type ValidationStatus = "valid" | "warning" | "error";
type ShelfPositions = Record<string, [number, number, number]>;
type DesignConfig = ClosetConfig;

interface ShelfValidation {
  status: ValidationStatus;
  message: string;
  detail: string;
}

interface ShelfComponent {
  id: string;
  name: string;
  validation: ShelfValidation;
  basePosition: [number, number, number];
  position: [number, number, number];
  dimensions: [number, number, number];
}

const statusCopy: Record<ValidationStatus, { label: string; color: string; soft: string }> = {
  valid: { label: "Good", color: "#8c9994", soft: "rgba(140,153,148,0.08)" },
  warning: { label: "Note", color: "#a0866c", soft: "rgba(160,134,108,0.12)" },
  error: { label: "Adjust", color: "#a06858", soft: "rgba(160,104,88,0.14)" },
};

function getStatus(status: ValidationStatus) {
  return statusCopy[status];
}

function includesLeft(shape: ClosetShape) {
  return shape === "left" || shape === "u" || shape === "walk-in";
}

function includesRight(shape: ClosetShape) {
  return shape === "right" || shape === "u" || shape === "walk-in";
}

function offGridAmount(position: [number, number, number], basePosition: [number, number, number]) {
  const deltas = position.map((value, index) => value - basePosition[index]);
  const largest = deltas.reduce((max, delta) => {
    const remainder = Math.abs(delta % 6);
    const offBy = Math.min(remainder, 6 - remainder);
    return offBy > max ? offBy : max;
  }, 0);

  return Math.round(largest);
}

function validateShelf(
  id: string,
  config: DesignConfig,
  position: [number, number, number],
  basePosition: [number, number, number]
): ShelfValidation {
  const clearance = config.height - position[1] - SHELF_THICKNESS;
  const gridMiss = offGridAmount(position, basePosition);

  if ((id === "right" && config.rightOffset !== 0) || gridMiss > 0) {
    return {
      status: "error",
      message: `Off grid by ${Math.max(Math.abs(config.rightOffset), gridMiss)} in`,
      detail: "Snap the return to the 6 in planning grid",
    };
  }

  if (clearance < 18) {
    return {
      status: "warning",
      message: "Clearance is tight",
      detail: `${Math.round(clearance)} in above shelf limits useful storage`,
    };
  }

  if (config.shelfHeight % 6 !== 0) {
    return {
      status: "warning",
      message: "Not on preferred height",
      detail: "Move shelf height to the next 6 in interval",
    };
  }

  return {
    status: "valid",
    message: "Recommended placement",
    detail: `${Math.round(clearance)} in storage clearance preserved`,
  };
}

function applyShelfPosition(shelf: Omit<ShelfComponent, "validation" | "position">, positions: ShelfPositions) {
  const position = positions[shelf.id] ?? shelf.basePosition;

  return {
    ...shelf,
    position,
  };
}

function buildShelves(config: DesignConfig, positions: ShelfPositions): ShelfComponent[] {
  const baseShelves: Omit<ShelfComponent, "validation" | "position">[] = [
    {
      id: "back",
      name: "Back Shelf",
      basePosition: [0, config.shelfHeight, -config.depth / 2 + config.shelfDepth / 2],
      dimensions: [config.width - 4, SHELF_THICKNESS, config.shelfDepth],
    },
  ];

  if (includesLeft(config.shape)) {
    baseShelves.push({
      id: "left",
      name: "Left Return",
      basePosition: [-config.width / 2 + config.leftReturn / 2, config.shelfHeight, 0],
      dimensions: [config.leftReturn, SHELF_THICKNESS, config.shelfDepth],
    });
  }

  if (includesRight(config.shape)) {
    baseShelves.push({
      id: "right",
      name: "Right Return",
      basePosition: [config.width / 2 - config.rightReturn / 2 + config.rightOffset, config.shelfHeight, 0],
      dimensions: [config.rightReturn, SHELF_THICKNESS, config.shelfDepth],
    });
  }

  return baseShelves.map((baseShelf) => {
    const shelf = applyShelfPosition(baseShelf, positions);

    return {
      ...shelf,
      validation: validateShelf(shelf.id, config, shelf.position, shelf.basePosition),
    };
  });
}

type PieceId =
  | "back-left-tower"
  | "back-right-tower"
  | "center-drawers"
  | "center-shelves"
  | "left-rod"
  | "left-shelves"
  | "right-double-rod"
  | "right-shelves";

const PIECE_GROUPS: {
  zone: string;
  pieces: { id: PieceId; label: string; detail: string; price: number; qty: number }[];
  requires?: "left" | "right";
}[] = [
  { zone: "Back – Left", pieces: [{ id: "back-left-tower", label: "Tower Shelves", detail: "5 levels", price: 285, qty: 1 }] },
  {
    zone: "Back – Center",
    pieces: [
      { id: "center-drawers", label: "Drawer Unit", detail: "5 drawers", price: 395, qty: 1 },
      { id: "center-shelves", label: "Open Shelves", detail: "3 levels", price: 195, qty: 1 },
    ],
  },
  { zone: "Back – Right", pieces: [{ id: "back-right-tower", label: "Tower Shelves", detail: "5 levels", price: 285, qty: 1 }] },
  {
    zone: "Left Return",
    requires: "left",
    pieces: [
      { id: "left-rod", label: "Hanging Rod", detail: "single hang", price: 145, qty: 1 },
      { id: "left-shelves", label: "Shelves", detail: "3 levels", price: 175, qty: 1 },
    ],
  },
  {
    zone: "Right Return",
    requires: "right",
    pieces: [
      { id: "right-double-rod", label: "Double Hang", detail: "short × 2", price: 215, qty: 1 },
      { id: "right-shelves", label: "Shelves", detail: "3 levels", price: 175, qty: 1 },
    ],
  },
];

const DEFAULT_PIECES = new Set<PieceId>([
  "back-left-tower", "back-right-tower", "center-drawers", "center-shelves",
  "left-rod", "left-shelves", "right-double-rod", "right-shelves",
]);
const PIECE_IDS = new Set<PieceId>(DEFAULT_PIECES);

function isPieceId(id: string): id is PieceId {
  return PIECE_IDS.has(id as PieceId);
}

function getVisiblePieceGroups(config: DesignConfig) {
  return PIECE_GROUPS.filter((group) =>
    !group.requires ||
    (group.requires === "left" && includesLeft(config.shape)) ||
    (group.requires === "right" && includesRight(config.shape))
  );
}

function getActivePieces(config: DesignConfig, enabledPieces: Set<PieceId>) {
  return getVisiblePieceGroups(config)
    .flatMap((group) => group.pieces.map((piece) => ({ ...piece, zone: group.zone })))
    .filter((piece) => enabledPieces.has(piece.id));
}

function getComponentsSubtotal(config: DesignConfig, enabledPieces: Set<PieceId>) {
  return getActivePieces(config, enabledPieces).reduce((sum, piece) => sum + piece.price * piece.qty, 0);
}

function getProjectAllowances(config: DesignConfig) {
  const linearRun = config.width + (includesLeft(config.shape) ? config.leftReturn : 0) + (includesRight(config.shape) ? config.rightReturn : 0);
  const materialAllowance = Math.round((linearRun * 4 + Math.max(0, config.height - 96) * 12) / 25) * 25;
  const installAllowance = 1600 + (config.shape === "walk-in" ? 250 : 0);
  return { materialAllowance, installAllowance, linearRun };
}

function getSystemPrice(config: DesignConfig, enabledPieces: Set<PieceId>) {
  const { materialAllowance, installAllowance } = getProjectAllowances(config);
  return Math.round((getComponentsSubtotal(config, enabledPieces) + materialAllowance + installAllowance) / 50) * 50;
}

function getStorageStats(config: DesignConfig, enabledPieces: Set<PieceId>, shelves: ShelfComponent[]) {
  const activePieces = getActivePieces(config, enabledPieces);
  const shelfLevels =
    shelves.length +
    (enabledPieces.has("back-left-tower") ? 5 : 0) +
    (enabledPieces.has("back-right-tower") ? 5 : 0) +
    (enabledPieces.has("center-shelves") ? 3 : 0) +
    (enabledPieces.has("left-shelves") && includesLeft(config.shape) ? 4 : 0) +
    (enabledPieces.has("right-shelves") && includesRight(config.shape) ? 3 : 0);
  const drawerCount = enabledPieces.has("center-drawers") ? 5 : 0;
  const rodFeet =
    (enabledPieces.has("left-rod") && includesLeft(config.shape) ? config.leftReturn : 0) +
    (enabledPieces.has("right-double-rod") && includesRight(config.shape) ? config.rightReturn * 2 : 0);
  const shelfFeet = Math.round(
    (shelves.reduce((sum, shelf) => sum + shelf.dimensions[0], 0) +
      (enabledPieces.has("back-left-tower") ? (config.width / 3) * 5 : 0) +
      (enabledPieces.has("back-right-tower") ? (config.width / 3) * 5 : 0) +
      (enabledPieces.has("center-shelves") ? (config.width / 3) * 3 : 0) +
      (enabledPieces.has("left-shelves") && includesLeft(config.shape) ? config.leftReturn * 4 : 0) +
      (enabledPieces.has("right-shelves") && includesRight(config.shape) ? config.rightReturn * 3 : 0)) /
      12
  );
  const activeWarnings = shelves.filter((shelf) => shelf.validation.status !== "valid");

  return {
    activePieceCount: activePieces.length,
    shelfFeet,
    shelfLevels,
    drawerCount,
    rodFeet: Math.round(rodFeet / 12),
    warnings: activeWarnings.length,
  };
}

// ClosetBuiltIn — fixed shell that priced modules snap into
function ClosetBuiltIn({ config }: { config: DesignConfig }) {
  const T = 0.75;
  const plinthH = 4;
  const crownH = 4;
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const sD = config.shelfDepth;
  const bZ = -halfD + sD / 2;
  const topY = config.height - crownH;
  const zoneW = config.width / 3;

  function wb(x: number, y: number, z: number, w: number, h: number, d: number, k: string) {
    return (
      <RoundedBox key={k} args={[w, h, d]} radius={Math.min(0.35, w / 20, d / 20)} smoothness={3} position={[x, y, z]} castShadow receiveShadow>
        <meshStandardMaterial color="#f6f5f1" roughness={0.17} metalness={0.0} />
      </RoundedBox>
    );
  }

  return (
    <group>
      {/* ── BACK WALL: plinth + crown ── */}
      {wb(0, plinthH / 2, bZ, config.width - T * 2, plinthH, sD, "bp")}
      {wb(0, topY + crownH / 2, bZ, config.width - T * 2, crownH, sD, "bc")}

      {/* ── BACK WALL: zone dividers ── */}
      {wb(-halfW + zoneW, config.height / 2, bZ, T, config.height - plinthH - crownH, sD, "dl")}
      {wb(halfW - zoneW, config.height / 2, bZ, T, config.height - plinthH - crownH, sD, "dr")}

      {/* ── LEFT RETURN ── */}
      {includesLeft(config.shape) && (() => {
        const rW = config.leftReturn - T * 2;
        const rX = -halfW + config.leftReturn / 2;
        return (
          <>
            {wb(rX, plinthH / 2, 0, rW, plinthH, sD, "lrp")}
            {wb(rX, topY + crownH / 2, 0, rW, crownH, sD, "lrc")}
            {wb(-halfW + config.leftReturn + T / 2, config.height / 2, 0, T, config.height, sD, "lrd")}
          </>
        );
      })()}

      {/* ── RIGHT RETURN ── */}
      {includesRight(config.shape) && (() => {
        const rW = config.rightReturn - T * 2;
        const rX = halfW - config.rightReturn / 2;
        return (
          <>
            {wb(rX, plinthH / 2, 0, rW, plinthH, sD, "rrp")}
            {wb(rX, topY + crownH / 2, 0, rW, crownH, sD, "rrc")}
            {wb(halfW - config.rightReturn - T / 2, config.height / 2, 0, T, config.height, sD, "rrd")}
          </>
        );
      })()}
    </group>
  );
}

interface PieceModule {
  id: PieceId;
  label: string;
  detail: string;
  price: number;
  zone: string;
  basePosition: [number, number, number];
  position: [number, number, number];
  dimensions: [number, number, number];
}

function buildPieceModules(config: DesignConfig, enabledPieces: Set<PieceId>, positions: ShelfPositions): PieceModule[] {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const zoneW = config.width / 3;
  const bZ = -halfD + config.shelfDepth / 2;
  const modules: Record<PieceId, Omit<PieceModule, "position">> = {
    "back-left-tower": {
      id: "back-left-tower",
      label: "Tower Shelves",
      detail: "5 levels",
      price: 285,
      zone: "Back - Left",
      basePosition: [-halfW + zoneW / 2, 39, bZ],
      dimensions: [zoneW - 2, 66, config.shelfDepth],
    },
    "back-right-tower": {
      id: "back-right-tower",
      label: "Tower Shelves",
      detail: "5 levels",
      price: 285,
      zone: "Back - Right",
      basePosition: [halfW - zoneW / 2, 39, bZ],
      dimensions: [zoneW - 2, 66, config.shelfDepth],
    },
    "center-drawers": {
      id: "center-drawers",
      label: "Drawer Unit",
      detail: "5 drawers",
      price: 395,
      zone: "Back - Center",
      basePosition: [0, 19, bZ + config.shelfDepth / 2 + 0.8],
      dimensions: [zoneW - 2, 30, 2.4],
    },
    "center-shelves": {
      id: "center-shelves",
      label: "Open Shelves",
      detail: "3 levels",
      price: 195,
      zone: "Back - Center",
      basePosition: [0, 57, bZ],
      dimensions: [zoneW - 2, 38, config.shelfDepth],
    },
    "left-rod": {
      id: "left-rod",
      label: "Hanging Rod",
      detail: "single hang",
      price: 145,
      zone: "Left Return",
      basePosition: [-halfW + config.leftReturn / 2, 42, 0],
      dimensions: [Math.max(8, config.leftReturn - 2), 8, 3],
    },
    "left-shelves": {
      id: "left-shelves",
      label: "Shelves",
      detail: "3 levels",
      price: 175,
      zone: "Left Return",
      basePosition: [-halfW + config.leftReturn / 2, 58, 0],
      dimensions: [Math.max(8, config.leftReturn - 2), 42, config.shelfDepth],
    },
    "right-double-rod": {
      id: "right-double-rod",
      label: "Double Hang",
      detail: "short x 2",
      price: 215,
      zone: "Right Return",
      basePosition: [halfW - config.rightReturn / 2, 52, 0],
      dimensions: [Math.max(8, config.rightReturn - 2), 38, 3],
    },
    "right-shelves": {
      id: "right-shelves",
      label: "Shelves",
      detail: "3 levels",
      price: 175,
      zone: "Right Return",
      basePosition: [halfW - config.rightReturn / 2, 57, 0],
      dimensions: [Math.max(8, config.rightReturn - 2), 38, config.shelfDepth],
    },
  };

  return getActivePieces(config, enabledPieces).map((piece) => {
    const pieceModule = modules[piece.id];
    return {
      ...pieceModule,
      label: piece.label,
      detail: piece.detail,
      price: piece.price,
      zone: piece.zone,
      position: positions[piece.id] ?? pieceModule.basePosition,
    };
  });
}

function ModuleGeometry({ pieceModule, selected }: { pieceModule: PieceModule; selected: boolean }) {
  const T = 0.75;
  const [w, h, d] = pieceModule.dimensions;
  const shelfYs = [-h / 2 + 8, -h / 2 + 20, -h / 2 + 32, -h / 2 + 44, h / 2 - 8].filter((y) => y > -h / 2 + 3 && y < h / 2 - 3);
  const panelColor = selected ? "#ffffff" : "#f6f5f1";

  if (pieceModule.id === "center-drawers") {
    return (
      <>
        {Array.from({ length: 5 }, (_, i) => {
          const drawerH = h / 5 - 0.45;
          const y = -h / 2 + drawerH / 2 + i * (h / 5);
          return (
            <group key={i}>
              <mesh position={[0, y, d / 2]} castShadow>
                <boxGeometry args={[w, drawerH, T]} />
                <meshStandardMaterial color={panelColor} roughness={0.18} />
              </mesh>
              <mesh position={[0, y, d / 2 + 0.55]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.24, 0.24, Math.max(5, w * 0.22), 10]} />
                <meshStandardMaterial color="#c4a46a" roughness={0.22} metalness={0.72} />
              </mesh>
            </group>
          );
        })}
      </>
    );
  }

  if (pieceModule.id === "left-rod" || pieceModule.id === "right-double-rod") {
    const rods = pieceModule.id === "right-double-rod" ? [-h / 2 + 10, h / 2 - 10] : [0];
    return (
      <>
        {rods.map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.45, 0.45, w, 16]} />
            <meshStandardMaterial color={selected ? "#d8d1c8" : "#cac4be"} roughness={0.2} metalness={0.68} />
          </mesh>
        ))}
      </>
    );
  }

  return (
    <>
      {shelfYs.map((y, i) => (
        <RoundedBox key={i} args={[w, T, d]} radius={0.35} smoothness={3} position={[0, y, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={panelColor} roughness={0.17} />
        </RoundedBox>
      ))}
      {(pieceModule.id.includes("tower") || pieceModule.id.includes("shelves")) && (
        <>
          <RoundedBox args={[T, h, d]} radius={0.3} smoothness={3} position={[-w / 2 + T / 2, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={panelColor} roughness={0.18} />
          </RoundedBox>
          <RoundedBox args={[T, h, d]} radius={0.3} smoothness={3} position={[w / 2 - T / 2, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={panelColor} roughness={0.18} />
          </RoundedBox>
        </>
      )}
    </>
  );
}

function DraggableModule({
  pieceModule,
  selected,
  cameraView,
  config,
  onSelect,
  onMove,
}: {
  pieceModule: PieceModule;
  selected: boolean;
  cameraView: CameraView;
  config: DesignConfig;
  onSelect: (id: PieceId) => void;
  onMove: (id: PieceId, position: [number, number, number]) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    plane: THREE.Plane;
    offset: THREE.Vector3;
    hit: THREE.Vector3;
  } | null>(null);
  const [w, h, d] = pieceModule.dimensions;

  function getDragPlane() {
    const point = new THREE.Vector3(...pieceModule.position);
    if (cameraView === "top") return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), point);
    if (cameraView === "front") return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    if (pieceModule.id.startsWith("back") || pieceModule.id.startsWith("center")) return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), point);
  }

  function constrainPosition(next: THREE.Vector3): [number, number, number] {
    const clamped = next.clone();
    const base = new THREE.Vector3(...pieceModule.basePosition);

    if (cameraView === "top") clamped.y = pieceModule.position[1];
    if (cameraView === "front") clamped.z = pieceModule.position[2];
    if (cameraView === "corner" || cameraView === "detail") {
      if (pieceModule.id.startsWith("back") || pieceModule.id.startsWith("center")) clamped.z = pieceModule.position[2];
      if (pieceModule.id.startsWith("left") || pieceModule.id.startsWith("right")) clamped.x = pieceModule.position[0];
    }

    clamped.x = Math.max(-config.width / 2 + w / 2, Math.min(config.width / 2 - w / 2, clamped.x));
    clamped.y = Math.max(h / 2, Math.min(config.height - h / 2, clamped.y));
    clamped.z = Math.max(-config.depth / 2 + d / 2, Math.min(config.depth / 2 - d / 2, clamped.z));

    const gridMiss = offGridAmount([clamped.x, clamped.y, clamped.z], [base.x, base.y, base.z]);
    if (gridMiss <= 1) {
      clamped.x = Math.round(clamped.x);
      clamped.y = Math.round(clamped.y);
      clamped.z = Math.round(clamped.z);
    }

    return [Number(clamped.x.toFixed(1)), Number(clamped.y.toFixed(1)), Number(clamped.z.toFixed(1))];
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onSelect(pieceModule.id);
    const plane = getDragPlane();
    const hit = new THREE.Vector3();
    event.ray.intersectPlane(plane, hit);
    dragRef.current = {
      pointerId: event.pointerId,
      plane,
      offset: new THREE.Vector3(...pieceModule.position).sub(hit),
      hit,
    };
    (event.target as Element | null)?.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (!event.ray.intersectPlane(dragRef.current.plane, dragRef.current.hit)) return;
    onMove(pieceModule.id, constrainPosition(dragRef.current.hit.clone().add(dragRef.current.offset)));
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    (event.target as Element | null)?.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    document.body.style.cursor = hovered ? "grab" : "";
  }

  return (
    <group
      position={pieceModule.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh>
        <boxGeometry args={pieceModule.dimensions} />
        <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
      </mesh>
      {(selected || hovered) && (
        <RoundedBox args={[w + 1.6, h + 1.6, d + 1.6]} radius={0.8} smoothness={4}>
          <meshBasicMaterial color={selected ? "#8c9994" : "#c9d3cd"} transparent opacity={0.18} />
        </RoundedBox>
      )}
      <ModuleGeometry pieceModule={pieceModule} selected={selected || hovered} />
    </group>
  );
}

function ConfigurableModules({
  modules,
  selectedPiece,
  cameraView,
  config,
  onSelect,
  onMove,
}: {
  modules: PieceModule[];
  selectedPiece: PieceId | null;
  cameraView: CameraView;
  config: DesignConfig;
  onSelect: (id: PieceId) => void;
  onMove: (id: PieceId, position: [number, number, number]) => void;
}) {
  return (
    <group>
      {modules.map((pieceModule) => (
        <DraggableModule
          key={pieceModule.id}
          pieceModule={pieceModule}
          selected={selectedPiece === pieceModule.id}
          cameraView={cameraView}
          config={config}
          onSelect={onSelect}
          onMove={onMove}
        />
      ))}
    </group>
  );
}

function ClosetRoom({
  mode,
  cameraView,
  wallVisibility,
  config,
}: {
  mode: ViewMode;
  cameraView: CameraView;
  wallVisibility: WallVisibility;
  config: DesignConfig;
}) {
  const forceOpen = mode === "open" || wallVisibility === "open";
  const smartCutaway = wallVisibility === "smart" && (cameraView === "front" || cameraView === "detail" || mode === "inspection");
  const smartTransparency = wallVisibility === "smart" && cameraView === "top";
  const hideFrontWallMass = forceOpen || wallVisibility === "smart";
  const backOpacity = forceOpen ? 0 : mode === "inspection" ? 0.38 : smartTransparency ? 0.66 : 1.0;
  const sideOpacity = forceOpen ? 0 : smartCutaway ? 0.14 : mode === "inspection" ? 0.28 : smartTransparency ? 0.42 : 0.88;
  const frontOpacity = hideFrontWallMass ? 0 : sideOpacity;
  const doorwayContextOpacity = forceOpen ? 0 : wallVisibility === "smart" ? 0.34 : 0.78;
  const ceilingOpacity = cameraView === "top" || smartCutaway ? 0 : forceOpen ? 0.03 : mode === "inspection" ? 0.28 : 0.88;
  const flangeW = 56;
  const doorOpeningWidth = Math.min(48, Math.max(34, config.width * 0.42));
  const frontWallRun = (config.width - doorOpeningWidth) / 2;
  const frontWallZ = config.depth / 2 + WALL_THICKNESS / 2;
  const roomWallExtension = 64;
  const leftFrontWallX = -config.width / 2 + frontWallRun / 2;
  const rightFrontWallX = config.width / 2 - frontWallRun / 2;
  const leftDoorJambX = -doorOpeningWidth / 2 - WALL_THICKNESS / 2;
  const rightDoorJambX = doorOpeningWidth / 2 + WALL_THICKNESS / 2;
  const leftRoomWallX = -doorOpeningWidth / 2 - WALL_THICKNESS - roomWallExtension / 2;
  const rightRoomWallX = doorOpeningWidth / 2 + WALL_THICKNESS + roomWallExtension / 2;
  const leftCornerX = -config.width / 2 - WALL_THICKNESS / 2;
  const rightCornerX = config.width / 2 + WALL_THICKNESS / 2;

  const showWalls = !forceOpen;
  const showFrontWalls = showWalls && frontOpacity > 0;
  const showDoorwayContext = showWalls && doorwayContextOpacity > 0;

  return (
    <group>
      {/* back wall */}
      {showWalls && (
        <mesh position={[0, config.height / 2, -config.depth / 2 - WALL_THICKNESS / 2]} receiveShadow>
          <boxGeometry args={[config.width + WALL_THICKNESS * 2, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
          <meshStandardMaterial color="#ede8e2" opacity={backOpacity} transparent={backOpacity < 1} roughness={0.9} />
        </mesh>
      )}

      {/* niche side walls — span only the closet depth */}
      {showWalls && (
        <>
          <mesh position={[-config.width / 2 - WALL_THICKNESS / 2, config.height / 2, 0]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, config.depth]} />
            <meshStandardMaterial color="#e9e3dd" opacity={sideOpacity} transparent={sideOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[config.width / 2 + WALL_THICKNESS / 2, config.height / 2, 0]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, config.depth]} />
            <meshStandardMaterial color="#e9e3dd" opacity={sideOpacity} transparent={sideOpacity < 1} roughness={0.9} />
          </mesh>
        </>
      )}

      {/* room wall flanking panels — inner edge flush with niche interior (L-joint) */}
      {showFrontWalls && (
        <>
          <mesh position={[leftFrontWallX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[frontWallRun, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e9e3dd" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[rightFrontWallX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[frontWallRun, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e9e3dd" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[leftDoorJambX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e6e0da" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[rightDoorJambX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e6e0da" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[leftCornerX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e4ded8" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
          <mesh position={[rightCornerX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e4ded8" opacity={frontOpacity} transparent={frontOpacity < 1} roughness={0.9} />
          </mesh>
        </>
      )}

      {/* doorway wall extensions — light room context without closing off the product view */}
      {showDoorwayContext && (
        <>
          <mesh position={[leftRoomWallX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[roomWallExtension, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e7e1db" opacity={doorwayContextOpacity} transparent roughness={0.9} />
          </mesh>
          <mesh position={[rightRoomWallX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[roomWallExtension, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e7e1db" opacity={doorwayContextOpacity} transparent roughness={0.9} />
          </mesh>
          <mesh position={[leftDoorJambX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e5ded7" opacity={doorwayContextOpacity} transparent roughness={0.9} />
          </mesh>
          <mesh position={[rightDoorJambX, config.height / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e5ded7" opacity={doorwayContextOpacity} transparent roughness={0.9} />
          </mesh>
          <mesh position={[0, config.height + WALL_THICKNESS / 2, frontWallZ]} receiveShadow>
            <boxGeometry args={[doorOpeningWidth + WALL_THICKNESS * 2, WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#f0ebe5" opacity={doorwayContextOpacity * 0.9} transparent roughness={0.9} />
          </mesh>
          <mesh position={[0, 1, frontWallZ + 1]}>
            <boxGeometry args={[doorOpeningWidth, 2, 5]} />
            <meshStandardMaterial color="#c9c1b7" opacity={doorwayContextOpacity} transparent roughness={0.86} />
          </mesh>
        </>
      )}

      {/* floor — extends into the room in front of opening */}
      <mesh position={[0, -0.25, config.depth / 4 + 8]} receiveShadow>
        <boxGeometry args={[config.width + (WALL_THICKNESS + flangeW) * 2, 0.5, config.depth + flangeW + WALL_THICKNESS * 2]} />
        <meshStandardMaterial color="#d4cec4" roughness={0.88} />
      </mesh>

      {/* ceiling */}
      <mesh position={[0, config.height + WALL_THICKNESS / 2, config.depth / 4 + 8]}>
        <boxGeometry args={[config.width + (WALL_THICKNESS + flangeW) * 2, WALL_THICKNESS, config.depth + flangeW]} />
        <meshStandardMaterial color="#f5f1ec" opacity={ceilingOpacity} transparent={ceilingOpacity < 1} roughness={0.88} />
      </mesh>
    </group>
  );
}

function Shelf({
  shelf,
  selected,
  cameraView,
  onSelect,
  onMove,
}: {
  shelf: ShelfComponent;
  selected: boolean;
  cameraView: CameraView;
  onSelect: (id: string) => void;
  onMove: (id: string, position: [number, number, number]) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    plane: THREE.Plane;
    offset: THREE.Vector3;
    hit: THREE.Vector3;
  } | null>(null);

  function getDragPlane() {
    const point = new THREE.Vector3(...shelf.position);

    if (cameraView === "top") {
      return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), point);
    }

    if (cameraView === "front") {
      return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    }

    if (shelf.id === "back") {
      return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    }

    return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), point);
  }

  function constrainPosition(next: THREE.Vector3): [number, number, number] {
    const minY = 42;
    const maxY = 112;
    const clamped = next.clone();

    if (cameraView === "top") {
      clamped.y = shelf.position[1];
    }

    if (cameraView === "front") {
      clamped.z = shelf.position[2];
    }

    if (cameraView === "corner" || cameraView === "detail") {
      if (shelf.id === "back") {
        clamped.z = shelf.position[2];
      } else {
        clamped.x = shelf.position[0];
      }
    }

    clamped.y = Math.max(minY, Math.min(maxY, clamped.y));

    return [Number(clamped.x.toFixed(1)), Number(clamped.y.toFixed(1)), Number(clamped.z.toFixed(1))];
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onSelect(shelf.id);

    const plane = getDragPlane();
    const hit = new THREE.Vector3();
    event.ray.intersectPlane(plane, hit);
    dragRef.current = {
      pointerId: event.pointerId,
      plane,
      offset: new THREE.Vector3(...shelf.position).sub(hit),
      hit,
    };
    (event.target as Element | null)?.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;

    event.stopPropagation();
    if (!event.ray.intersectPlane(dragRef.current.plane, dragRef.current.hit)) return;

    const next = dragRef.current.hit.clone().add(dragRef.current.offset);
    onMove(shelf.id, constrainPosition(next));
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;

    event.stopPropagation();
    (event.target as Element | null)?.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    document.body.style.cursor = hovered ? "grab" : "";
  }

  const postHeight = shelf.position[1];
  const postY = -postHeight / 2;

  return (
    <group position={shelf.position}>
      <RoundedBox
        args={shelf.dimensions}
        radius={0.5}
        smoothness={4}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <meshStandardMaterial color={selected || hovered ? "#ffffff" : "#f6f5f2"} roughness={0.18} metalness={0.0} />
      </RoundedBox>

      {/* posts — run from floor to underside of shelf */}
      <RoundedBox args={[1.4, postHeight, 1.4]} radius={0.3} smoothness={3} position={[-shelf.dimensions[0] / 2 + 6, postY, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#eeece8" roughness={0.22} metalness={0.0} />
      </RoundedBox>
      <RoundedBox args={[1.4, postHeight, 1.4]} radius={0.3} smoothness={3} position={[shelf.dimensions[0] / 2 - 6, postY, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#eeece8" roughness={0.22} metalness={0.0} />
      </RoundedBox>
    </group>
  );
}

function MeasurementLine({
  start,
  end,
  label,
  color = "#2f3a35",
  labelOffset = [0, 3, 0],
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  color?: string;
  labelOffset?: [number, number, number];
}) {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2 + labelOffset[0],
    (start[1] + end[1]) / 2 + labelOffset[1],
    (start[2] + end[2]) / 2 + labelOffset[2],
  ];

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1.15} transparent opacity={0.74} />
      <mesh position={start}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text
        position={mid}
        fontSize={2.2}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#ffffff"
      >
        {label}
      </Text>
    </group>
  );
}

function ValidationBadge({ shelf, visible }: { shelf: ShelfComponent; visible: boolean }) {
  if (!visible) return null;

  const status = getStatus(shelf.validation.status);

  return (
    <Html position={[shelf.position[0], shelf.position[1] + 7, shelf.position[2] + 2]} center distanceFactor={18}>
      <div
        className="whitespace-nowrap rounded-md border px-3 py-2 text-[11px] shadow-lg backdrop-blur-md"
        style={{ borderColor: status.color, background: "rgba(255,255,255,0.9)", color: "#1e2522" }}
      >
        <div className="font-semibold" style={{ color: status.color }}>
          {status.label}
        </div>
        <div>{shelf.validation.message}</div>
      </div>
    </Html>
  );
}

function ShelfSystem({
  mode,
  cameraView,
  selectedShelf,
  showMeasurements,
  onSelectShelf,
  onMoveShelf,
  config,
  shelves,
}: {
  mode: ViewMode;
  cameraView: CameraView;
  selectedShelf: string | null;
  showMeasurements: boolean;
  onSelectShelf: (id: string | null) => void;
  onMoveShelf: (id: string, position: [number, number, number]) => void;
  config: DesignConfig;
  shelves: ShelfComponent[];
}) {
  const selected = shelves.find((shelf) => shelf.id === selectedShelf);
  const showDetail = showMeasurements && mode !== "open";
  const showEssential = showMeasurements && mode === "open";
  const backShelfWidth = config.width - 4;
  const clearance = Math.round(config.height - config.shelfHeight - SHELF_THICKNESS);

  return (
    <group onPointerMissed={() => onSelectShelf(null)}>
      {shelves.map((shelf) => (
        <Shelf
          key={shelf.id}
          shelf={shelf}
          selected={selectedShelf === shelf.id}
          cameraView={cameraView}
          onSelect={onSelectShelf}
          onMove={onMoveShelf}
        />
      ))}

      {shelves.map((shelf) => (
        <ValidationBadge
          key={`${shelf.id}-badge`}
          shelf={shelf}
          visible={mode === "inspection" && selectedShelf === shelf.id}
        />
      ))}

      {(showDetail || showEssential) && (
        <>
          <MeasurementLine
            start={[-config.width / 2 - 7, 0, -config.depth / 2 - 3]}
            end={[-config.width / 2 - 7, config.height, -config.depth / 2 - 3]}
            label={`${config.height} in floor to ceiling`}
            labelOffset={[-8, 0, 0]}
          />
          <MeasurementLine
            start={[-backShelfWidth / 2, config.shelfHeight + 4, -config.depth / 2 + config.shelfDepth / 2]}
            end={[backShelfWidth / 2, config.shelfHeight + 4, -config.depth / 2 + config.shelfDepth / 2]}
            label={`${backShelfWidth} in edge to edge`}
          />
          <MeasurementLine
            start={[config.width / 2 + 5, config.shelfHeight, -config.depth / 2]}
            end={[config.width / 2 + 5, config.shelfHeight, -config.depth / 2 + config.shelfDepth]}
            label={`${config.shelfDepth} in shelf depth`}
            labelOffset={[8, 0, 0]}
          />
        </>
      )}

      {showDetail && (
        <>
          <MeasurementLine
            start={[-config.width / 2 - 1, 0, -config.depth / 2 + 4]}
            end={[-config.width / 2 - 1, selected?.position[1] ?? config.shelfHeight, -config.depth / 2 + 4]}
            label={`${Math.round(selected?.position[1] ?? config.shelfHeight)} in shelf height`}
            color="#48544f"
            labelOffset={[-8, 0, 0]}
          />
          <MeasurementLine
            start={[0, (selected?.position[1] ?? config.shelfHeight) + SHELF_THICKNESS / 2, 2]}
            end={[0, config.height, 2]}
            label={`${Math.round(config.height - (selected?.position[1] ?? config.shelfHeight) - SHELF_THICKNESS)} in open storage`}
            color={clearance < 18 ? "#a0866c" : "#8c9994"}
            labelOffset={[0, 0, 5]}
          />
          {includesLeft(config.shape) && (
            <MeasurementLine
              start={[-config.width / 2, config.shelfHeight + 7, 1.5]}
              end={[-config.width / 2 + config.leftReturn, config.shelfHeight + 7, 1.5]}
              label={`${config.leftReturn} in left return`}
              color="#48544f"
            />
          )}
          {includesRight(config.shape) && (
            <MeasurementLine
              start={[config.width / 2 - config.rightReturn + config.rightOffset, config.shelfHeight + 7, 1.5]}
              end={[config.width / 2 + config.rightOffset, config.shelfHeight + 7, 1.5]}
              label={`${config.rightReturn} in right return`}
              color={config.rightOffset === 0 ? "#48544f" : "#a06858"}
            />
          )}
          <MeasurementLine
            start={[config.width / 2 + 7, config.shelfHeight - SHELF_THICKNESS / 2, 0]}
            end={[config.width / 2 + 7, config.shelfHeight + SHELF_THICKNESS / 2, 0]}
            label={`${SHELF_THICKNESS} in shelf`}
            color="#48544f"
            labelOffset={[7, 0, 0]}
          />
        </>
      )}

      {mode === "inspection" && selected && (
        <Html position={[0, Math.max(36, config.shelfHeight - 28), 18]} center distanceFactor={20}>
          <div className="w-60 rounded-md border border-[#d8dfd8] bg-white/92 p-3 text-xs text-[#25302c] shadow-xl backdrop-blur-md">
            <div className="mb-1 text-sm font-semibold">{selected.name}</div>
            <div>{selected.validation.detail}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraRig({
  mode,
  cameraView,
  focusPosition,
  config,
  zoom,
}: {
  mode: ViewMode;
  cameraView: CameraView;
  focusPosition: [number, number, number] | null;
  config: DesignConfig;
  zoom: number;
}) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const focusX = focusPosition && mode === "inspection" ? focusPosition[0] : 0;
    const focusY = focusPosition && mode === "inspection" ? focusPosition[1] : config.shelfHeight - 16;
    const focusZ = focusPosition && mode === "inspection" ? focusPosition[2] : -3;

    target.set(focusX, focusY, focusZ);

    if (cameraView === "front") {
      destination.set(0, config.height * 0.58, config.depth + 110);
    } else if (cameraView === "top") {
      destination.set(0, config.height + 95, config.depth + 8);
      target.set(0, config.shelfHeight, -2);
    } else if (cameraView === "detail" || mode === "inspection") {
      destination.set(focusX + 42, focusY + 5, focusZ + 58);
    } else if (mode === "open") {
      destination.set(config.width * 0.78, config.height * 0.62, config.depth + 82);
    } else {
      destination.set(config.width * 0.76, config.height * 0.52, config.depth + 68);
    }

    const zoomed = destination.clone().sub(lookTarget).multiplyScalar(zoom).add(lookTarget);
    camera.position.lerp(zoomed, 0.045);
    lookTarget.lerp(target, 0.045);
    camera.lookAt(lookTarget);
  });

  useEffect(() => {
    camera.position.set(config.width * 0.76, config.height * 0.52, config.depth + 68);
    camera.lookAt(0, config.shelfHeight - 16, -3);
  }, [camera, config.depth, config.height, config.shelfHeight, config.width]);

  return null;
}

function FloorShadow({ cameraView }: { cameraView: CameraView }) {
  if (cameraView === "top") return null;
  return (
    <>
      <ContactShadows position={[0, -0.01, 0]} opacity={0.44} scale={200} blur={1.1} far={18} color="#2a2018" />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.18} scale={200} blur={3.5} far={18} color="#2a2018" />
    </>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#fff8f0", "#d8d0c4", 1.1]} />
      <directionalLight
        position={[60, 130, 80]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-40, 60, 50]} intensity={0.45} color="#fffaf6" />
    </>
  );
}

function ModeButton({
  mode,
  current,
  children,
  onClick,
}: {
  mode: ViewMode;
  current: ViewMode;
  children: ReactNode;
  onClick: (mode: ViewMode) => void;
}) {
  const active = mode === current;

  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-[#25302c] text-white shadow-sm" : "text-[#33413c] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
        active ? "border-[#25302c] bg-[#25302c] text-white" : "border-[#cbd6ce] bg-white text-[#33413c] hover:bg-[#eef3ee]"
      }`}
    >
      {children}
    </button>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function allocatePrices(count: number, total: number) {
  if (count === 0) return [];

  const base = Math.floor(total / count);
  const prices = Array.from({ length: count }, () => base);
  prices[prices.length - 1] += total - base * count;
  return prices;
}

function buildPersistenceComponents(config: DesignConfig, modules: PieceModule[], enabledPieces: Set<PieceId>): ClosetComponent[] {
  const components: Omit<ClosetComponent, "priceEach">[] = modules.map((pieceModule) => {
    const [w, h] = pieceModule.dimensions;
    const type: ClosetComponent["type"] =
      pieceModule.id === "center-drawers"
        ? "drawer-unit"
        : pieceModule.id.includes("rod")
          ? "hanging-rod"
          : "shelf";

    return {
      id: `3d-${pieceModule.id}`,
      type,
      label: `${pieceModule.zone}: ${pieceModule.label}`,
      x: Math.round(pieceModule.position[0] + config.width / 2 - w / 2),
      y: Math.round(config.height - pieceModule.position[1] - h / 2),
      w: Math.round(w),
      h: Math.round(h),
      color: type === "hanging-rod" ? "#cac4be" : "#f6f5f1",
    };
  });

  components.push({
    id: "3d-panels-trim-install",
    type: "corner-shelf",
    label: "Panels, dividers, trim, and installation kit",
    x: 0,
    y: 0,
    w: config.width,
    h: config.height,
    color: "#ede8e2",
  });

  const prices = allocatePrices(components.length, getSystemPrice(config, enabledPieces));

  return components.map((component, index) => ({
    ...component,
    priceEach: prices[index],
  }));
}

export default function ClosetExperience3D() {
  const {
    syncCurrentDesign,
    closetConfig: config,
    enabledPieceIds,
    setEnabledPieceIds,
    shelfPositions,
    setShelfPositions,
  } = useDesignStore();
  const [mode, setMode] = useState<ViewMode>("closet");
  const [cameraView, setCameraView] = useState<CameraView>("corner");
  const [selectedPiece, setSelectedPiece] = useState<PieceId | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [wallVisibility, setWallVisibility] = useState<WallVisibility>("smart");

  const enabledPieces = useMemo(() => new Set(enabledPieceIds.filter(isPieceId)), [enabledPieceIds]);
  const shelves = useMemo(() => buildShelves(config, shelfPositions), [config, shelfPositions]);
  const modules = useMemo(() => buildPieceModules(config, enabledPieces, shelfPositions), [config, enabledPieces, shelfPositions]);
  const effectiveSelectedPiece = modules.some((pieceModule) => pieceModule.id === selectedPiece) ? selectedPiece : modules[0]?.id ?? null;
  const selectedModule = modules.find((pieceModule) => pieceModule.id === effectiveSelectedPiece) ?? null;
  const clearance = Math.round(config.height - config.shelfHeight - SHELF_THICKNESS);
  const minZoom = cameraView === "top" ? 0.72 : cameraView === "front" ? 0.76 : cameraView === "detail" ? 0.42 : 0.52;
  const maxZoom = cameraView === "top" ? 1.38 : cameraView === "front" ? 1.08 : cameraView === "detail" ? 2.05 : 1.7;
  const effectiveZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
  const activePieces = useMemo(() => getActivePieces(config, enabledPieces), [config, enabledPieces]);
  const visibleGroups = useMemo(() => getVisiblePieceGroups(config), [config]);
  const componentsSubtotal = useMemo(() => getComponentsSubtotal(config, enabledPieces), [config, enabledPieces]);
  const allowances = useMemo(() => getProjectAllowances(config), [config]);
  const systemPrice = useMemo(() => getSystemPrice(config, enabledPieces), [config, enabledPieces]);
  const storageStats = useMemo(() => getStorageStats(config, enabledPieces, shelves), [config, enabledPieces, shelves]);

  useEffect(() => {
    syncCurrentDesign({
      dimensions: {
        width: config.width,
        height: config.height,
      },
      components: buildPersistenceComponents(config, modules, enabledPieces),
      closetConfig: config,
      enabledPieceIds: Array.from(enabledPieces),
      shelfPositions,
    });
  }, [config, enabledPieces, modules, shelfPositions, syncCurrentDesign]);

  function togglePiece(id: PieceId) {
    const next = new Set(enabledPieces);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabledPieceIds(Array.from(next));
    if (selectedPiece === id) setSelectedPiece(null);
  }

  function handleMovePiece(id: PieceId, position: [number, number, number]) {
    setShelfPositions({
      ...shelfPositions,
      [id]: position,
    });
  }

  return (
    <section className="bg-[#f6f8f5] text-[#1f2824]">
      <div className="flex flex-col gap-4 border-b border-[#d8dfd8] bg-white/86 px-4 py-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex rounded-md border border-[#cbd6ce] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#48645a]">
            Premium 3D Design Concept
          </div>
          <h1 className="text-xl font-semibold leading-tight text-[#1f2824] md:text-2xl">Editable closet system</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#53635d]">
            Guided camera moves replace free spinning. Desktop uses Open Room view; true AR can stay mobile-first later.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#d8dfd8] bg-[#eef3ee] p-1">
            <ModeButton mode="closet" current={mode} onClick={setMode}>
              Closet
            </ModeButton>
            <ModeButton mode="open" current={mode} onClick={setMode}>
              Open Room
            </ModeButton>
            <ModeButton mode="inspection" current={mode} onClick={setMode}>
              Inspect
            </ModeButton>
          </div>
          <button
            type="button"
            onClick={() => setShowMeasurements((value) => !value)}
            className="rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
          >
            {showMeasurements ? "Hide Measurements" : "Show Measurements"}
          </button>
        </div>
      </div>

      <div className="grid overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[58vh] min-h-[380px] overflow-hidden bg-[#ebe5dc] md:h-[62vh] md:min-h-[500px] xl:h-[calc(100vh-210px)] xl:min-h-[560px]">
          <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [112, 82, 124], fov: 38 }} dpr={[1, 1.7]} style={{ touchAction: "pan-y" }}>
            <color attach="background" args={["#ebe5dc"]} />
            <fog attach="fog" args={["#ebe5dc", 160, 300]} />
            <Lights />
            <FloorShadow cameraView={cameraView} />
            <CameraRig mode={mode} cameraView={cameraView} focusPosition={selectedModule?.position ?? null} config={config} zoom={effectiveZoom} />
            <ClosetRoom mode={mode} cameraView={cameraView} wallVisibility={wallVisibility} config={config} />
            <ClosetBuiltIn config={config} />
            <ConfigurableModules
              modules={modules}
              selectedPiece={effectiveSelectedPiece}
              cameraView={cameraView}
              config={config}
              onSelect={(id) => {
                setSelectedPiece(id);
                if (mode === "inspection") setCameraView("detail");
              }}
              onMove={handleMovePiece}
            />
            {showMeasurements && (
              <ShelfSystem
                mode={mode}
                cameraView={cameraView}
                selectedShelf={null}
                showMeasurements={showMeasurements}
                onSelectShelf={() => undefined}
                onMoveShelf={() => undefined}
                config={config}
                shelves={[]}
              />
            )}
          </Canvas>

          <div className="absolute left-4 top-4 max-w-sm rounded-md border border-white/60 bg-white/80 p-3 text-xs leading-5 text-[#41504a] shadow-lg backdrop-blur-md">
            <span className="font-semibold text-[#1f2824]">Guided camera.</span> Drag a priced module directly, or select it from the list.
          </div>

          <div className="absolute right-4 top-4 rounded-md border border-white/60 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#7a8a82]">This set</div>
            <div className="mt-0.5 text-2xl font-semibold tracking-tight text-[#1f2824]">{formatCurrency(systemPrice)}</div>
            <div className="mt-0.5 text-[10px] text-[#9aa89f]">updates with selected pieces</div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(["corner", "front", "top", "detail"] as CameraView[]).map((view) => (
                <ChoiceButton key={view} active={cameraView === view} onClick={() => setCameraView(view)}>
                  {view === "corner" ? "Corner" : view === "front" ? "Front" : view === "top" ? "Top" : "Detail"}
                </ChoiceButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["full", "smart", "open"] as WallVisibility[]).map((visibility) => (
                <ChoiceButton key={visibility} active={wallVisibility === visibility} onClick={() => setWallVisibility(visibility)}>
                  {visibility === "full" ? "Full Walls" : visibility === "smart" ? "Smart Cutaway" : "Hide Walls"}
                </ChoiceButton>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(maxZoom, Math.max(minZoom, z) + 0.14))}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-lg font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
              >−</button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z) - 0.14))}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cbd6ce] bg-white text-lg font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
              >+</button>
            </div>
          </div>
        </div>

        <aside className="w-full overflow-y-auto border-t border-[#d8dfd8] bg-white p-5 xl:border-l xl:border-t-0">

          {/* ── Back to plan ── */}
          <Link
            href="/"
            className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-[#48645a] hover:text-[#25302c]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit floor plan
          </Link>

          {/* ── Closet summary ── */}
          <div className="mb-4 rounded-md border border-[#d8dfd8] bg-[#f6f8f5] px-3 py-2.5 text-xs text-[#53635d]">
            <span className="font-semibold text-[#1f2824]">
              {config.shape === "walk-in" ? "Walk-in" : config.shape === "u" ? "U-Shape" : config.shape === "left" ? "Left L" : config.shape === "right" ? "Right L" : "Straight"}
            </span>
            {" · "}{config.width}&quot; wide · {config.depth}&quot; deep · {config.height}&quot; tall
          </div>

          <div className="mb-5 rounded-md border border-[#d8dfd8] bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">Estimated installed total</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-[#1f2824]">{formatCurrency(systemPrice)}</div>
              </div>
              <div className="rounded-md bg-[#f0f4f0] px-2 py-1 text-[10px] font-semibold text-[#53635d]">
                {activePieces.length} active pieces
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-[#6f7d76]">Components</dt>
                <dd className="font-semibold text-[#25302c]">{formatCurrency(componentsSubtotal)}</dd>
              </div>
              <div>
                <dt className="text-[#6f7d76]">Materials</dt>
                <dd className="font-semibold text-[#25302c]">{formatCurrency(allowances.materialAllowance)}</dd>
              </div>
              <div>
                <dt className="text-[#6f7d76]">Install</dt>
                <dd className="font-semibold text-[#25302c]">{formatCurrency(allowances.installAllowance)}</dd>
              </div>
            </dl>
          </div>

          {/* ── Component list ── */}
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1f2824]">In this closet</h2>
            <button
              type="button"
              onClick={() => setEnabledPieceIds(Array.from(DEFAULT_PIECES))}
              className="text-[10px] font-semibold text-[#48645a] hover:text-[#25302c]"
            >
              Restore all
            </button>
          </div>

          <div className="space-y-3">
            {visibleGroups.map((group) => (
              <div key={group.zone} className="rounded-md border border-[#e4ece4] bg-[#f9fbf9] p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">{group.zone}</div>
                <div className="space-y-1.5">
                  {group.pieces.map((piece) => {
                    const on = enabledPieces.has(piece.id);
                    const selected = effectiveSelectedPiece === piece.id;
                    const inspecting = selected && mode === "inspection";
                    return (
                      <div
                        key={piece.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!on) return;
                          setSelectedPiece(piece.id);
                          setMode("inspection");
                          setCameraView("detail");
                        }}
                        onKeyDown={(event) => {
                          if (!on || (event.key !== "Enter" && event.key !== " ")) return;
                          event.preventDefault();
                          setSelectedPiece(piece.id);
                          setMode("inspection");
                          setCameraView("detail");
                        }}
                        className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left transition ${
                          inspecting
                            ? "border-[#25302c] bg-[#e9f0ea] shadow-[inset_3px_0_0_#25302c]"
                            : selected
                              ? "border-[#25302c] bg-[#f6f8f5]"
                            : on
                              ? "border-transparent bg-white hover:border-[#d8dfd8]"
                              : "border-transparent opacity-40"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#25302c]">{piece.label}</span>
                            {inspecting && (
                              <span className="rounded bg-[#25302c] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                Inspecting
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#6f7d76]">{piece.detail}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-[#25302c]">{formatCurrency(piece.price)}</div>
                          <div className="text-[10px] text-[#6f7d76]">qty {piece.qty}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePiece(piece.id);
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs transition ${
                            on
                              ? "border-[#d8dfd8] bg-white text-[#a06858] hover:bg-[#fdf5f3]"
                              : "border-[#a0c0a8] bg-[#eef5ef] text-[#48645a] hover:bg-[#ddeede]"
                          }`}
                          title={on ? "Remove" : "Restore"}
                        >
                          {on ? "x" : "+"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border border-[#d8dfd8] bg-[#f0f4f0] px-3 py-2.5">
            <span className="text-xs font-semibold text-[#53635d]">Components subtotal</span>
            <span className="text-sm font-bold text-[#1f2824]">{formatCurrency(componentsSubtotal)}</span>
          </div>

          <div className="mt-5 rounded-md border border-[#d8dfd8] bg-[#fbfcfb] p-4">
            <h3 className="text-sm font-semibold text-[#25302c]">Storage intelligence</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[#6f7d76]">Shelf footage</dt>
                <dd className="font-semibold text-[#25302c]">{storageStats.shelfFeet} linear ft</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Shelf levels</dt>
                <dd className="font-semibold text-[#25302c]">{storageStats.shelfLevels}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Hanging</dt>
                <dd className="font-semibold text-[#25302c]">{storageStats.rodFeet} linear ft</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Drawers</dt>
                <dd className="font-semibold text-[#25302c]">{storageStats.drawerCount}</dd>
              </div>
            </dl>
            <div className="mt-3 rounded-md bg-[#f4f6f4] px-3 py-2 text-xs leading-5 text-[#53635d]">
              {storageStats.warnings > 0
                ? `${storageStats.warnings} placement note${storageStats.warnings === 1 ? "" : "s"} need review before proposal.`
                : "No placement conflicts detected in this mock validation pass."}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-base font-semibold text-[#1f2824]">Module placement</h2>
            <p className="mt-1 text-sm leading-6 text-[#5b6a64]">
              Drag the same priced modules you remove or restore above. Detail view keeps wall context out of the way.
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {modules.map((pieceModule) => {
              const active = effectiveSelectedPiece === pieceModule.id;
              const gridMiss = offGridAmount(pieceModule.position, pieceModule.basePosition);
              const moved = pieceModule.position.some((value, index) => Math.abs(value - pieceModule.basePosition[index]) > 0.5);

              return (
                <button
                  type="button"
                  key={pieceModule.id}
                  onClick={() => {
                    setSelectedPiece(pieceModule.id);
                    setMode("inspection");
                    setCameraView("detail");
                  }}
                  className={`w-full rounded-md border p-4 text-left transition ${
                    active ? "border-[#25302c] bg-[#f6f8f5]" : "border-[#d8dfd8] bg-white hover:bg-[#f6f8f5]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#25302c]">{pieceModule.label}</span>
                    <span className="rounded-md bg-[#f0f4f0] px-2 py-1 text-[11px] font-semibold text-[#53635d]">
                      {formatCurrency(pieceModule.price)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#53635d]">{pieceModule.zone} · {pieceModule.detail}</p>
                  <p className="mt-1 text-xs text-[#6f7d76]">
                    {moved
                      ? `Moved to ${Math.round(pieceModule.position[0])}, ${Math.round(pieceModule.position[1])}, ${Math.round(pieceModule.position[2])} in${gridMiss > 1 ? ` · ${gridMiss} in off grid` : ""}`
                      : "At recommended location"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-[#d8dfd8] bg-[#f6f8f5] p-4">
            <h3 className="text-sm font-semibold text-[#25302c]">Key dimensions</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[#6f7d76]">Room</dt>
                <dd className="font-semibold text-[#25302c]">
                  {config.width} x {config.height} x {config.depth} in
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Shape</dt>
                <dd className="font-semibold text-[#25302c]">{config.shape === "walk-in" ? "Walk-in" : config.shape === "u" ? "U shape" : config.shape}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Shelf depth</dt>
                <dd className="font-semibold text-[#25302c]">{config.shelfDepth} in</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Clearance</dt>
                <dd className="font-semibold text-[#25302c]">{clearance} in</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
