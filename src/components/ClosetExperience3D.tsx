"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, Line, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import Link from "next/link";
import { buildMaterialList, useDesignStore } from "@/store/designStore";
import DealEconomicsPanel from "@/components/DealEconomicsPanel";
import type { ClosetConfig, ClosetShape } from "@/store/designStore";
import type { ClosetComponent, MeasuredFootprint, ProductBlock, ProductBlockPart, ProductLine, RoomFeature } from "@/types";

const SHELF_THICKNESS = 2.5;
const WALL_THICKNESS = 8;

type ViewMode = "closet" | "inspection";
type CameraView = "corner" | "front" | "top" | "detail";
type WallVisibility = "full" | "smart" | "open";
type ValidationStatus = "valid" | "warning" | "error";
type ShelfPositions = Record<string, [number, number, number]>;
type ModuleRotation = 0 | 90 | 180 | 270;
type PieceRotations = Record<string, ModuleRotation>;
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
      name: "Left Wall Shelf",
      basePosition: [-config.width / 2 + config.leftReturn / 2, config.shelfHeight, 0],
      dimensions: [config.leftReturn, SHELF_THICKNESS, config.shelfDepth],
    });
  }

  if (includesRight(config.shape)) {
    baseShelves.push({
      id: "right",
      name: "Right Wall Shelf",
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
    zone: "Side Modules",
    pieces: [
      { id: "left-rod", label: "Hanging Rod", detail: "single hang", price: 145, qty: 1 },
      { id: "left-shelves", label: "Shelves", detail: "3 levels", price: 175, qty: 1 },
    ],
  },
  {
    zone: "Additional Side Modules",
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

function getVisiblePieceGroups() {
  return PIECE_GROUPS;
}

function getActivePieces(_config: DesignConfig, enabledPieces: Set<PieceId>) {
  return getVisiblePieceGroups()
    .flatMap((group) => group.pieces.map((piece) => ({ ...piece, zone: group.zone })))
    .filter((piece) => enabledPieces.has(piece.id));
}

function getComponentsSubtotal(config: DesignConfig, enabledPieces: Set<PieceId>) {
  return getActivePieces(config, enabledPieces).reduce((sum, piece) => sum + piece.price * piece.qty, 0);
}

function getProjectAllowances(config: DesignConfig) {
  const linearRun = config.width;
  const materialAllowance = Math.round((linearRun * 4 + Math.max(0, config.height - 96) * 12) / 25) * 25;
  const installAllowance = 1600;
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
    (enabledPieces.has("left-shelves") ? 4 : 0) +
    (enabledPieces.has("right-shelves") ? 3 : 0);
  const drawerCount = enabledPieces.has("center-drawers") ? 5 : 0;
  const rodFeet =
    (enabledPieces.has("left-rod") ? config.leftReturn : 0) +
    (enabledPieces.has("right-double-rod") ? config.rightReturn * 2 : 0);
  const shelfFeet = Math.round(
    (shelves.reduce((sum, shelf) => sum + shelf.dimensions[0], 0) +
      (enabledPieces.has("back-left-tower") ? (config.width / 3) * 5 : 0) +
      (enabledPieces.has("back-right-tower") ? (config.width / 3) * 5 : 0) +
      (enabledPieces.has("center-shelves") ? (config.width / 3) * 3 : 0) +
      (enabledPieces.has("left-shelves") ? config.leftReturn * 4 : 0) +
      (enabledPieces.has("right-shelves") ? config.rightReturn * 3 : 0)) /
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

interface PieceModule {
  id: string;
  label: string;
  detail: string;
  price: number;
  zone: string;
  basePosition: [number, number, number];
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation: ModuleRotation;
  panels: ResolvedPanels;
  productLine?: ProductLine;
  finish?: string;
  parts?: ProductBlockPart[];
}

interface ResolvedPanels {
  left: boolean;
  right: boolean;
  back: boolean;
  coveredBy: Partial<Record<"left" | "right" | "back", string>>;
}

interface PlanBounds {
  left: number;
  right: number;
  back: number;
  front: number;
}

function getRoomWorldBounds(config: DesignConfig, footprint?: MeasuredFootprint): PlanBounds {
  if (footprint?.points.length) {
    const xs = footprint.points.map((point) => point.x - config.width / 2);
    const zs = footprint.points.map((point) => point.y - config.depth / 2);

    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      back: Math.min(...zs),
      front: Math.max(...zs),
    };
  }

  return {
    left: -config.width / 2,
    right: config.width / 2,
    back: -config.depth / 2,
    front: config.depth / 2,
  };
}

function getPlanDimensions(dimensions: [number, number, number], rotation: ModuleRotation) {
  const [w, , d] = dimensions;
  return rotation === 90 || rotation === 270 ? { width: d, depth: w } : { width: w, depth: d };
}

function rotateLocalPlanVector(x: number, z: number, rotation: ModuleRotation) {
  const radians = THREE.MathUtils.degToRad(rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: x * cos + z * sin,
    z: -x * sin + z * cos,
  };
}

function getFaceWorldInfo(module: Pick<PieceModule, "position" | "dimensions" | "rotation">, face: "left" | "right" | "back") {
  const [w, , d] = module.dimensions;
  const local =
    face === "left"
      ? { normal: [-1, 0] as const, offset: [-w / 2, 0] as const }
      : face === "right"
        ? { normal: [1, 0] as const, offset: [w / 2, 0] as const }
        : { normal: [0, -1] as const, offset: [0, -d / 2] as const };
  const normal = rotateLocalPlanVector(local.normal[0], local.normal[1], module.rotation);
  const offset = rotateLocalPlanVector(local.offset[0], local.offset[1], module.rotation);

  return {
    normal,
    center: {
      x: module.position[0] + offset.x,
      z: module.position[2] + offset.z,
    },
  };
}

function getWallCoverForFace(config: DesignConfig, module: Pick<PieceModule, "position" | "dimensions" | "rotation">, face: "left" | "right" | "back") {
  const tolerance = 1.5;
  const info = getFaceWorldInfo(module, face);
  const leftWall = -config.width / 2;
  const rightWall = config.width / 2;
  const backWall = -config.depth / 2;

  if (Math.abs(info.center.z - backWall) <= tolerance && info.normal.z < -0.72) return "back wall";
  if (includesLeft(config.shape) && Math.abs(info.center.x - leftWall) <= tolerance && info.normal.x < -0.72) return "left wall";
  if (includesRight(config.shape) && Math.abs(info.center.x - rightWall) <= tolerance && info.normal.x > 0.72) return "right wall";

  return null;
}

function resolvePanels(config: DesignConfig, module: Pick<PieceModule, "position" | "dimensions" | "rotation">): ResolvedPanels {
  const coveredBy: ResolvedPanels["coveredBy"] = {};
  (["left", "right", "back"] as const).forEach((face) => {
    const wall = getWallCoverForFace(config, module, face);
    if (wall) coveredBy[face] = wall;
  });

  return {
    left: !coveredBy.left,
    right: !coveredBy.right,
    back: !coveredBy.back,
    coveredBy,
  };
}

function getPanelCount(panels: ResolvedPanels) {
  return Number(panels.left) + Number(panels.right) + Number(panels.back);
}

function getModulePlanBounds(module: Pick<PieceModule, "position" | "dimensions" | "rotation">): PlanBounds {
  const plan = getPlanDimensions(module.dimensions, module.rotation);

  return {
    left: module.position[0] - plan.width / 2,
    right: module.position[0] + plan.width / 2,
    back: module.position[2] - plan.depth / 2,
    front: module.position[2] + plan.depth / 2,
  };
}

function getFeaturePlanBounds(config: DesignConfig, feature: RoomFeature): PlanBounds {
  const center = getFeatureWorldPosition(config, feature);
  const plan = getFeaturePlanSize(feature);

  return {
    left: center[0] - plan.width / 2,
    right: center[0] + plan.width / 2,
    back: center[2] - plan.depth / 2,
    front: center[2] + plan.depth / 2,
  };
}

function boundsOverlap(a: PlanBounds, b: PlanBounds, gap = 0) {
  return a.left < b.right - gap && a.right > b.left + gap && a.back < b.front - gap && a.front > b.back + gap;
}

function getFeatureWorldPosition(config: DesignConfig, feature: RoomFeature): [number, number, number] {
  const plan = getFeaturePlanSize(feature);

  return [
    feature.x + plan.width / 2 - config.width / 2,
    feature.elevation + feature.height / 2,
    feature.y + plan.depth / 2 - config.depth / 2,
  ];
}

function getFeaturePlanSize(feature: RoomFeature) {
  return (feature.rotation ?? 0) === 90
    ? { width: feature.depth, depth: feature.width }
    : { width: feature.width, depth: feature.depth };
}

function getFeatureBlockMessage(feature: RoomFeature, module: PieceModule) {
  if (feature.kind === "access-panel") {
    return `${module.label} blocks ${feature.label.toLowerCase()}. Keep service panels fully clear.`;
  }

  if (feature.kind === "air-register") {
    return `${module.label} sits on ${feature.label.toLowerCase()}. Floor registers cannot be covered.`;
  }

  return `${module.label} intersects ${feature.label.toLowerCase()}.`;
}

function getFeaturePlacementNotes(config: DesignConfig, modules: PieceModule[], features: RoomFeature[]) {
  return features.flatMap((feature) => {
    const featureBounds = getFeaturePlanBounds(config, feature);
    const touchedModules = modules.filter((module) => boundsOverlap(getModulePlanBounds(module), featureBounds));

    return touchedModules.map((module) => ({
      id: `${feature.id}-${module.id}`,
      feature,
      module,
      severity: "error" as const,
      message: getFeatureBlockMessage(feature, module),
    }));
  });
}

function verticalOverlap(a: PieceModule, b: PieceModule) {
  const aBottom = a.position[1] - a.dimensions[1] / 2;
  const aTop = a.position[1] + a.dimensions[1] / 2;
  const bBottom = b.position[1] - b.dimensions[1] / 2;
  const bTop = b.position[1] + b.dimensions[1] / 2;

  return aBottom < bTop && aTop > bBottom;
}

function getModuleOverlapNotes(modules: PieceModule[]) {
  const notes: { id: string; modules: [PieceModule, PieceModule]; message: string }[] = [];

  modules.forEach((module, index) => {
    modules.slice(index + 1).forEach((other) => {
      if (!verticalOverlap(module, other)) return;
      if (!boundsOverlap(getModulePlanBounds(module), getModulePlanBounds(other), 1.5)) return;

      notes.push({
        id: `${module.id}-${other.id}`,
        modules: [module, other],
        message: `${module.label} intersects ${other.label}. Move one block along its wall or rotate it.`,
      });
    });
  });

  return notes;
}

function formatRotation(rotation: ModuleRotation) {
  return `${rotation} deg`;
}

function getNextRotation(rotation: ModuleRotation): ModuleRotation {
  return ((rotation + 90) % 360) as ModuleRotation;
}

function getDefaultRotation(id: string): ModuleRotation {
  if (id.startsWith("left")) return 90;
  if (id.startsWith("right")) return 270;
  return 0;
}

function getDefaultBlockPosition(config: DesignConfig, block: ProductBlock): [number, number, number] {
  const layout = getDefaultBlockLayout(config, [block], {})[block.id];
  return layout?.position ?? [0, block.height / 2, -config.depth / 2 + block.depth / 2];
}

function getDefaultBlockLayout(
  config: DesignConfig,
  blocks: ProductBlock[],
  savedRotations: PieceRotations
): Record<string, { position: [number, number, number]; rotation: ModuleRotation }> {
  const spacing = 4;
  const cornerGap = 14;
  const sideWallDepth = blocks.reduce((max, block) => Math.max(max, block.depth), 0);
  const backWallDepth = blocks.reduce((max, block) => Math.max(max, block.depth), 0);
  const sideCornerClearance = Math.min(config.depth / 2, backWallDepth + cornerGap);
  const backCornerClearance = Math.min(config.width / 4, sideWallDepth + cornerGap);
  type WallRun = { wall: "back" | "left" | "right"; length: number; cursor: number; offset: number; rotation: ModuleRotation };
  const backRun: WallRun = {
    wall: "back",
    length: Math.max(18, config.width - backCornerClearance * 2),
    cursor: 0,
    offset: backCornerClearance,
    rotation: 0,
  };
  const runs = [backRun];

  if (includesLeft(config.shape)) {
    runs.push({
      wall: "left",
      length: Math.max(18, config.depth - sideCornerClearance),
      cursor: 0,
      offset: sideCornerClearance,
      rotation: 90,
    });
  }
  if (includesRight(config.shape)) {
    runs.push({
      wall: "right",
      length: Math.max(18, config.depth - sideCornerClearance),
      cursor: 0,
      offset: sideCornerClearance,
      rotation: 270,
    });
  }

  const layout: Record<string, { position: [number, number, number]; rotation: ModuleRotation }> = {};

  blocks.forEach((block) => {
    let run = runs.find((candidate) => candidate.cursor + block.width <= candidate.length);
    if (!run) run = runs.reduce((shortest, candidate) => candidate.cursor < shortest.cursor ? candidate : shortest, runs[0]);

    const rotation = savedRotations[block.id] ?? run.rotation;
    const along = run.offset + Math.min(run.length - block.width / 2, run.cursor + block.width / 2);
    const rawPosition: [number, number, number] =
      run.wall === "back"
        ? [-config.width / 2 + along, block.height / 2, -config.depth / 2 + block.depth / 2]
        : run.wall === "left"
          ? [-config.width / 2 + block.depth / 2, block.height / 2, -config.depth / 2 + along]
          : [config.width / 2 - block.depth / 2, block.height / 2, -config.depth / 2 + along];

    layout[block.id] = {
      position: clampModulePosition(config, [block.width, block.height, block.depth], rotation, rawPosition),
      rotation,
    };
    run.cursor += block.width + spacing;
  });

  return layout;
}

function buildProductBlockModules(
  config: DesignConfig,
  productBlocks: ProductBlock[],
  positions: ShelfPositions,
  rotations: PieceRotations
): PieceModule[] {
  const groupedBlocks = new Map<string, ProductBlock[]>();
  const looseBlocks: ProductBlock[] = [];

  productBlocks.forEach((block) => {
    if (!block.groupId) {
      looseBlocks.push(block);
      return;
    }
    groupedBlocks.set(block.groupId, [...(groupedBlocks.get(block.groupId) ?? []), block]);
  });

  const layoutBlocks: ProductBlock[] = [
    ...Array.from(groupedBlocks.entries()).map(([groupId, blocks]) => ({
      ...blocks[0],
      id: groupId,
      name: "Linked Block Run",
      width: blocks.reduce((sum, block) => sum + block.width, 0),
      height: Math.max(...blocks.map((block) => block.height)),
      depth: Math.max(...blocks.map((block) => block.depth)),
      price: blocks.reduce((sum, block) => sum + block.price, 0),
      parts: [],
    })),
    ...looseBlocks,
  ];
  const defaultLayout = getDefaultBlockLayout(config, layoutBlocks, rotations);

  const groupedModules = Array.from(groupedBlocks.entries()).map(([groupId, blocks]) => {
    const width = blocks.reduce((sum, block) => sum + block.width, 0);
    const height = Math.max(...blocks.map((block) => block.height));
    const depth = Math.max(...blocks.map((block) => block.depth));
    const price = blocks.reduce((sum, block) => sum + block.price, 0);
    const fallback = defaultLayout[groupId] ?? { position: [0, height / 2, -config.depth / 2 + depth / 2] as [number, number, number], rotation: 0 as ModuleRotation };
    const rotation = rotations[groupId] ?? fallback.rotation;
    const position = positions[groupId] ?? fallback.position;
    let cursor = -width / 2;
    const parts = blocks.flatMap((block) => {
      const blockLeft = cursor;
      cursor += block.width;
      const blockCenterOffset = blockLeft + block.width / 2;
      return block.parts.map((part) => ({
        ...part,
        id: `${block.id}-${part.id}`,
        label: `${block.name}: ${part.label}`,
        x: part.x + blockCenterOffset,
      }));
    });
    const dimensions: [number, number, number] = [width, height, depth];

    return {
      id: groupId,
      label: "Linked Block Run",
      detail: `${blocks.length} stitched blocks · ${blocks.map((block) => block.name).join(" + ")}`,
      price,
      zone: "Built Assembly",
      basePosition: fallback.position,
      position,
      dimensions,
      rotation,
      panels: resolvePanels(config, { position, dimensions, rotation }),
      productLine: blocks.every((block) => block.productLine === blocks[0].productLine) ? blocks[0].productLine : undefined,
      finish: blocks.every((block) => block.finish === blocks[0].finish) ? blocks[0].finish : "Mixed finishes",
      parts,
    };
  });

  const looseModules = looseBlocks.map((block) => {
    const fallback = defaultLayout[block.id] ?? { position: getDefaultBlockPosition(config, block), rotation: 0 as ModuleRotation };
    const rotation = rotations[block.id] ?? fallback.rotation;
    const position = positions[block.id] ?? fallback.position;
    const dimensions: [number, number, number] = [block.width, block.height, block.depth];

    return {
      id: block.id,
      label: block.name,
      detail: `${block.productLine === "freedomRail" ? "freedomRail" : "Select"} · ${block.finish} · ${block.parts.length} parts`,
      price: block.price,
      zone: "Built Block",
      basePosition: fallback.position,
      position,
      dimensions,
      rotation,
      panels: resolvePanels(config, { position, dimensions, rotation }),
      productLine: block.productLine,
      finish: block.finish,
      parts: block.parts,
    };
  });

  return [...groupedModules, ...looseModules];
}

function clampModulePosition(
  config: DesignConfig,
  dimensions: [number, number, number],
  rotation: ModuleRotation,
  position: [number, number, number],
  footprint?: MeasuredFootprint
): [number, number, number] {
  const { width, depth } = getPlanDimensions(dimensions, rotation);
  const [, h] = dimensions;
  const wallInset = WALL_THICKNESS / 2;
  const bounds = getRoomWorldBounds(config, footprint);

  return [
    Number(Math.max(bounds.left + wallInset + width / 2, Math.min(bounds.right - wallInset - width / 2, position[0])).toFixed(1)),
    Number(Math.max(h / 2, Math.min(config.height - h / 2, position[1])).toFixed(1)),
    Number(Math.max(bounds.back + wallInset + depth / 2, Math.min(bounds.front - wallInset - depth / 2, position[2])).toFixed(1)),
  ];
}

const EDGE_SNAP_THRESHOLD = 9;

function snapModulePosition(
  position: [number, number, number],
  dimensions: [number, number, number],
  rotation: ModuleRotation,
  otherModules: PieceModule[],
  config: DesignConfig,
  footprint?: MeasuredFootprint
): [number, number, number] {
  const { width: w, depth: d } = getPlanDimensions(dimensions, rotation);
  let [x, , z] = position;

  const myL = x - w / 2;
  const myR = x + w / 2;
  const myB = z - d / 2;
  const myF = z + d / 2;

  // Wall edges
  const wallInset = WALL_THICKNESS / 2;
  const bounds = getRoomWorldBounds(config, footprint);
  const wallL = bounds.left + wallInset + w / 2;
  const wallR = bounds.right - wallInset - w / 2;
  const wallB = bounds.back + wallInset + d / 2;
  const wallF = bounds.front - wallInset - d / 2;

  if (Math.abs(x - wallL) < EDGE_SNAP_THRESHOLD) x = wallL;
  else if (Math.abs(x - wallR) < EDGE_SNAP_THRESHOLD) x = wallR;
  if (Math.abs(z - wallB) < EDGE_SNAP_THRESHOLD) z = wallB;
  else if (Math.abs(z - wallF) < EDGE_SNAP_THRESHOLD) z = wallF;

  // Block-to-block edges
  for (const other of otherModules) {
    const { width: ow, depth: od } = getPlanDimensions(other.dimensions, other.rotation);
    const [ox, , oz] = other.position;
    const oL = ox - ow / 2;
    const oR = ox + ow / 2;
    const oB = oz - od / 2;
    const oF = oz + od / 2;

    if (Math.abs(myR - oL) < EDGE_SNAP_THRESHOLD) x = oL - w / 2;
    else if (Math.abs(myL - oR) < EDGE_SNAP_THRESHOLD) x = oR + w / 2;
    if (Math.abs(myF - oB) < EDGE_SNAP_THRESHOLD) z = oB - d / 2;
    else if (Math.abs(myB - oF) < EDGE_SNAP_THRESHOLD) z = oF + d / 2;
  }

  return [x, position[1], z];
}

function buildPieceModules(config: DesignConfig, enabledPieces: Set<PieceId>, positions: ShelfPositions, rotations: PieceRotations): PieceModule[] {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const zoneW = config.width / 3;
  const bZ = -halfD + config.shelfDepth / 2;
  const modules: Record<PieceId, Omit<PieceModule, "position" | "rotation" | "panels">> = {
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
      zone: "Side Modules",
      basePosition: [-halfW + 1.5, 42, -halfD + config.leftReturn / 2],
      dimensions: [Math.max(8, config.leftReturn - 2), 8, 3],
    },
    "left-shelves": {
      id: "left-shelves",
      label: "Shelves",
      detail: "3 levels",
      price: 175,
      zone: "Side Modules",
      basePosition: [-halfW + config.shelfDepth / 2, 58, -halfD + config.leftReturn / 2],
      dimensions: [Math.max(8, config.leftReturn - 2), 42, config.shelfDepth],
    },
    "right-double-rod": {
      id: "right-double-rod",
      label: "Double Hang",
      detail: "short x 2",
      price: 215,
      zone: "Additional Side Modules",
      basePosition: [halfW - 1.5, 52, -halfD + config.rightReturn / 2],
      dimensions: [Math.max(8, config.rightReturn - 2), 38, 3],
    },
    "right-shelves": {
      id: "right-shelves",
      label: "Shelves",
      detail: "3 levels",
      price: 175,
      zone: "Additional Side Modules",
      basePosition: [halfW - config.shelfDepth / 2, 57, -halfD + config.rightReturn / 2],
      dimensions: [Math.max(8, config.rightReturn - 2), 38, config.shelfDepth],
    },
  };

  return getActivePieces(config, enabledPieces).map((piece) => {
    const pieceModule = modules[piece.id];
    const rotation = rotations[piece.id] ?? getDefaultRotation(piece.id);
    const position = positions[piece.id] ?? pieceModule.basePosition;
    const partialModule = {
      position,
      dimensions: pieceModule.dimensions,
      rotation,
    };

    return {
      ...pieceModule,
      label: piece.label,
      detail: piece.detail,
      price: piece.price,
      zone: piece.zone,
      position,
      rotation,
      panels: resolvePanels(config, partialModule),
    };
  });
}

function ModuleGeometry({ pieceModule, selected }: { pieceModule: PieceModule; selected: boolean }) {
  const T = 0.75;
  const [w, h, d] = pieceModule.dimensions;
  const shelfYs = [-h / 2 + 8, -h / 2 + 20, -h / 2 + 32, -h / 2 + 44, h / 2 - 8].filter((y) => y > -h / 2 + 3 && y < h / 2 - 3);
  const panelColor = pieceModule.productLine === "select" ? (selected ? "#ffffff" : "#eeeae3") : selected ? "#ffffff" : "#f6f5f1";

  if (pieceModule.parts) {
    return (
      <>
        {pieceModule.parts.map((part) => {
          if (part.type === "rod") {
            return (
              <mesh key={part.id} position={[part.x, part.y - h / 2, part.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.42, 0.42, part.width, 16]} />
                <meshStandardMaterial color={selected ? "#d8d1c8" : "#4e504d"} roughness={0.22} metalness={0.62} />
              </mesh>
            );
          }

          const color =
            part.type === "rail" || part.type === "upright"
              ? "#929a94"
              : part.type === "drawer"
                ? "#d8d1c8"
                : part.type === "panel"
                  ? panelColor
                  : "#f3f1ec";

          return (
            <RoundedBox
              key={part.id}
              args={[part.width, part.height, part.depth]}
              radius={Math.min(0.35, part.width / 16, part.depth / 12)}
              smoothness={3}
              position={[part.x, part.y - h / 2, part.z]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={color} roughness={0.2} metalness={part.type === "rail" || part.type === "upright" ? 0.18 : 0} />
            </RoundedBox>
          );
        })}
      </>
    );
  }

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

function ResolvedPanelIndicators({ pieceModule }: { pieceModule: PieceModule }) {
  const [w, h, d] = pieceModule.dimensions;
  const color = "#86a98f";
  const opacity = 0.32;

  return (
    <>
      {pieceModule.panels.left && (
        <mesh position={[-w / 2 - 0.18, 0, 0]}>
          <boxGeometry args={[0.36, h, d]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {pieceModule.panels.right && (
        <mesh position={[w / 2 + 0.18, 0, 0]}>
          <boxGeometry args={[0.36, h, d]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {pieceModule.panels.back && (
        <mesh position={[0, 0, -d / 2 - 0.18]}>
          <boxGeometry args={[w, h, 0.36]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
    </>
  );
}

function DraggableModule({
  pieceModule,
  selected,
  invalid,
  cameraView,
  config,
  footprint,
  onSelect,
  onMove,
}: {
  pieceModule: PieceModule;
  selected: boolean;
  invalid: boolean;
  cameraView: CameraView;
  config: DesignConfig;
  footprint: MeasuredFootprint;
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
  const [w, h, d] = pieceModule.dimensions;

  function getDragPlane() {
    const point = new THREE.Vector3(...pieceModule.position);
    if (cameraView === "top") return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), point);
    if (cameraView === "front") return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    if (pieceModule.parts) return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), point);
    if (pieceModule.id.startsWith("back") || pieceModule.id.startsWith("center")) return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), point);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), point);
  }

  function constrainPosition(next: THREE.Vector3): [number, number, number] {
    const clamped = next.clone();
    const base = new THREE.Vector3(...pieceModule.basePosition);

    if (pieceModule.parts || cameraView === "top") clamped.y = pieceModule.position[1];
    if (cameraView === "front") clamped.z = pieceModule.position[2];
    if (cameraView === "corner" || cameraView === "detail") {
      if (!pieceModule.parts && (pieceModule.id.startsWith("back") || pieceModule.id.startsWith("center"))) clamped.z = pieceModule.position[2];
      if (!pieceModule.parts && (pieceModule.id.startsWith("left") || pieceModule.id.startsWith("right"))) clamped.x = pieceModule.position[0];
    }

    const plan = getPlanDimensions(pieceModule.dimensions, pieceModule.rotation);

    const wallInset = WALL_THICKNESS / 2;
    const bounds = getRoomWorldBounds(config, footprint);
    clamped.x = Math.max(bounds.left + wallInset + plan.width / 2, Math.min(bounds.right - wallInset - plan.width / 2, clamped.x));
    clamped.y = Math.max(h / 2, Math.min(config.height - h / 2, clamped.y));
    clamped.z = Math.max(bounds.back + wallInset + plan.depth / 2, Math.min(bounds.front - wallInset - plan.depth / 2, clamped.z));

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
      rotation={[0, THREE.MathUtils.degToRad(pieceModule.rotation), 0]}
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
      {(selected || invalid) && (
        <RoundedBox args={[w + 1.6, h + 1.6, d + 1.6]} radius={0.8} smoothness={4}>
          <meshBasicMaterial color={invalid ? "#b45643" : selected ? "#8c9994" : "#c9d3cd"} transparent opacity={invalid ? 0.24 : 0.18} />
        </RoundedBox>
      )}
      <ModuleGeometry pieceModule={pieceModule} selected={selected} />
      {selected && <ResolvedPanelIndicators pieceModule={pieceModule} />}
    </group>
  );
}

function ConfigurableModules({
  modules,
  selectedPiece,
  invalidModuleIds,
  cameraView,
  config,
  footprint,
  onSelect,
  onMove,
}: {
  modules: PieceModule[];
  selectedPiece: string | null;
  invalidModuleIds: Set<string>;
  cameraView: CameraView;
  config: DesignConfig;
  footprint: MeasuredFootprint;
  onSelect: (id: string) => void;
  onMove: (id: string, position: [number, number, number]) => void;
}) {
  return (
    <group>
      {modules.map((pieceModule) => (
        <DraggableModule
          key={pieceModule.id}
          pieceModule={pieceModule}
          selected={selectedPiece === pieceModule.id}
          invalid={invalidModuleIds.has(pieceModule.id)}
          cameraView={cameraView}
          config={config}
          footprint={footprint}
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
  footprint,
}: {
  mode: ViewMode;
  cameraView: CameraView;
  wallVisibility: WallVisibility;
  config: DesignConfig;
  footprint: MeasuredFootprint;
}) {
  const forceOpen = wallVisibility === "open";
  const smartCutaway = wallVisibility === "smart" && (cameraView === "front" || cameraView === "detail" || mode === "inspection");
  const smartTransparency = wallVisibility === "smart" && cameraView === "top";
  const hideFrontWallMass = forceOpen || wallVisibility === "smart";
  const backOpacity = forceOpen ? 0 : mode === "inspection" ? 0.38 : smartTransparency ? 0.66 : 1.0;
  const sideOpacity = forceOpen ? 0 : smartCutaway ? 0.14 : mode === "inspection" ? 0.28 : smartTransparency ? 0.42 : 0.88;
  const frontOpacity = hideFrontWallMass ? 0 : sideOpacity;
  const doorwayContextOpacity = forceOpen ? 0 : wallVisibility === "smart" ? 0.34 : 0.78;
  const ceilingOpacity = cameraView === "top" || smartCutaway ? 0 : forceOpen ? 0.03 : mode === "inspection" ? 0.28 : 0.88;
  const flangeW = 56;
  const pointById = useMemo(() => new Map(footprint.points.map((point) => [point.id, point])), [footprint.points]);
  const footprintPoints = useMemo(() => footprint.points.map((point) => ({
    id: point.id,
    type: point.type,
    x: point.x - config.width / 2,
    z: point.y - config.depth / 2,
  })), [config.depth, config.width, footprint.points]);
  const floorShape = useMemo(() => {
    const shape = new THREE.Shape();
    footprintPoints.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.z);
      else shape.lineTo(point.x, point.z);
    });
    shape.closePath();
    return shape;
  }, [footprintPoints]);
  const leftJamb = pointById.get(footprint.opening.leftJambId);
  const rightJamb = pointById.get(footprint.opening.rightJambId);
  const doorOpeningWidth = Math.max(24, footprint.opening.width);
  const frontWallZ = ((leftJamb?.y ?? config.depth) + (rightJamb?.y ?? config.depth)) / 2 - config.depth / 2 + WALL_THICKNESS / 2;
  const roomWallExtension = 64;
  const leftDoorJambX = (leftJamb?.x ?? (config.frontLeftStubDepth ?? config.frontStubDepth)) - config.width / 2 - WALL_THICKNESS / 2;
  const rightDoorJambX = (rightJamb?.x ?? config.width - (config.frontRightStubDepth ?? config.frontStubDepth)) - config.width / 2 + WALL_THICKNESS / 2;
  const leftRoomWallX = -doorOpeningWidth / 2 - WALL_THICKNESS - roomWallExtension / 2;
  const rightRoomWallX = doorOpeningWidth / 2 + WALL_THICKNESS + roomWallExtension / 2;
  const measuredWalls = footprint.walls
    .map((wall) => {
      const start = pointById.get(wall.from);
      const end = pointById.get(wall.to);
      if (!start || !end) return null;

      const sx = start.x - config.width / 2;
      const sz = start.y - config.depth / 2;
      const ex = end.x - config.width / 2;
      const ez = end.y - config.depth / 2;
      const dx = ex - sx;
      const dz = ez - sz;
      const length = Math.hypot(dx, dz);
      const isFront = start.y > config.depth - 2 && end.y > config.depth - 2;
      const isBack = start.y < 2 && end.y < 2;

      return {
        ...wall,
        midpoint: [(sx + ex) / 2, config.height / 2, (sz + ez) / 2] as [number, number, number],
        length,
        rotationY: -Math.atan2(dz, dx),
        opacity: isFront ? frontOpacity : isBack ? backOpacity : sideOpacity,
        color: isBack ? "#ede8e2" : isFront ? "#e6e0da" : "#e9e3dd",
      };
    })
    .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall));

  const showWalls = !forceOpen;
  const showDoorwayContext = showWalls && doorwayContextOpacity > 0;

  return (
    <group>
      {showWalls && measuredWalls.map((wall) => (
        wall.opacity <= 0 ? null : (
          <mesh key={`${wall.from}-${wall.to}`} position={wall.midpoint} rotation={[0, wall.rotationY, 0]} receiveShadow={wall.opacity >= 1}>
            <boxGeometry args={[wall.length + WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color={wall.color} opacity={wall.opacity} transparent={wall.opacity < 1} roughness={0.9} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
          </mesh>
        )
      ))}

      {/* doorway wall extensions — light room context without closing off the product view */}
      {showDoorwayContext && (
        <>
          <mesh position={[leftRoomWallX, config.height / 2, frontWallZ]} receiveShadow={doorwayContextOpacity >= 1}>
            <boxGeometry args={[roomWallExtension, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e7e1db" opacity={doorwayContextOpacity} transparent roughness={0.9} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
          </mesh>
          <mesh position={[rightRoomWallX, config.height / 2, frontWallZ]} receiveShadow={doorwayContextOpacity >= 1}>
            <boxGeometry args={[roomWallExtension, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e7e1db" opacity={doorwayContextOpacity} transparent roughness={0.9} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
          </mesh>
          <mesh position={[leftDoorJambX, config.height / 2, frontWallZ]} receiveShadow={doorwayContextOpacity >= 1}>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e5ded7" opacity={doorwayContextOpacity} transparent roughness={0.9} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
          </mesh>
          <mesh position={[rightDoorJambX, config.height / 2, frontWallZ]} receiveShadow={doorwayContextOpacity >= 1}>
            <boxGeometry args={[WALL_THICKNESS, config.height + WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#e5ded7" opacity={doorwayContextOpacity} transparent roughness={0.9} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
          </mesh>
          <mesh position={[0, config.height + WALL_THICKNESS / 2, frontWallZ]} receiveShadow={doorwayContextOpacity >= 1}>
            <boxGeometry args={[doorOpeningWidth + WALL_THICKNESS * 2, WALL_THICKNESS, WALL_THICKNESS]} />
            <meshStandardMaterial color="#f0ebe5" opacity={doorwayContextOpacity * 0.9} transparent roughness={0.9} />
          </mesh>
          <mesh position={[0, 1, frontWallZ + 1]}>
            <boxGeometry args={[doorOpeningWidth, 2, 5]} />
            <meshStandardMaterial color="#c9c1b7" opacity={doorwayContextOpacity} transparent roughness={0.86} />
          </mesh>
        </>
      )}

      {/* room floor context plus measured closet footprint */}
      <mesh position={[0, -0.32, config.depth / 4 + 8]} receiveShadow>
        <boxGeometry args={[config.width + (WALL_THICKNESS + flangeW) * 2, 0.35, config.depth + flangeW + WALL_THICKNESS * 2]} />
        <meshStandardMaterial color="#cfc8be" roughness={0.88} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color="#d8d2c8" roughness={0.88} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
      </mesh>

      {/* ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, config.height + WALL_THICKNESS / 2, 0]}>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color="#f5f1ec" opacity={ceilingOpacity} transparent={ceilingOpacity < 1} roughness={0.88} />
      </mesh>
    </group>
  );
}

function RoomFeatures3D({
  config,
  features,
  wallVisibility,
  blockedFeatureIds,
}: {
  config: DesignConfig;
  features: RoomFeature[];
  wallVisibility: WallVisibility;
  blockedFeatureIds: Set<string>;
}) {
  if (features.length === 0) return null;

  return (
    <group>
      {features.map((feature) => {
        const position = getFeatureWorldPosition(config, feature);
        const plan = getFeaturePlanSize(feature);
        const isColumn = feature.kind === "column";
        const isRegister = feature.kind === "air-register";
        const isBlocked = blockedFeatureIds.has(feature.id);
        if (isColumn && wallVisibility === "open") return null;

        const columnOpacity = wallVisibility === "smart" ? 0.56 : 0.9;
        const color = isColumn ? "#e7e1db" : isBlocked ? "#b45643" : isRegister ? "#6f9998" : "#a98a6c";
        const opacity = isColumn ? columnOpacity : isBlocked ? 0.76 : 0.58;
        const height = Math.max(feature.height, isRegister ? 0.45 : 1);
        const y = isRegister ? 0.24 : position[1];

        return (
          <group key={feature.id}>
            <RoundedBox
              args={[plan.width, height, plan.depth]}
              radius={isColumn ? 0.7 : 0.35}
              smoothness={4}
              position={[position[0], y, position[2]]}
              castShadow={isColumn}
              receiveShadow
            >
              <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={isColumn ? 0.9 : 0.68} metalness={isRegister ? 0.18 : 0} />
            </RoundedBox>
            {feature.kind === "access-panel" && (
              <Line
                points={[
                  [position[0] - plan.width / 2, feature.elevation, position[2] - plan.depth / 2],
                  [position[0] + plan.width / 2, feature.elevation, position[2] - plan.depth / 2],
                  [position[0] + plan.width / 2, feature.elevation + feature.height, position[2] - plan.depth / 2],
                  [position[0] - plan.width / 2, feature.elevation + feature.height, position[2] - plan.depth / 2],
                  [position[0] - plan.width / 2, feature.elevation, position[2] - plan.depth / 2],
                ]}
                color={isBlocked ? "#b45643" : "#7f624d"}
                lineWidth={isBlocked ? 2 : 1.2}
                transparent
                opacity={isBlocked ? 1 : 0.78}
              />
            )}
            <Html position={[position[0], isRegister ? 3 : Math.min(config.height - 4, feature.elevation + height + 4), position[2]]} center distanceFactor={22}>
              <div className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[10px] font-semibold shadow-md backdrop-blur-md ${
                isBlocked ? "border-[#dec8c0] bg-[#fbf2ef]/92 text-[#7e4e40]" : "border-white/70 bg-white/86 text-[#25302c]"
              }`}>
                {feature.label}{isBlocked ? " blocked" : ""}
              </div>
            </Html>
          </group>
        );
      })}
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

function SelectedModuleMeasurements({ module }: { module: PieceModule }) {
  const [w, h, d] = module.dimensions;
  const bottom = -h / 2;
  const top = h / 2;
  const back = -d / 2;
  const front = d / 2;
  const lineColor = "#48645a";

  return (
    <group position={module.position} rotation={[0, THREE.MathUtils.degToRad(module.rotation), 0]}>
      <MeasurementLine
        start={[-w / 2, top + 5, front + 4]}
        end={[w / 2, top + 5, front + 4]}
        label={`${Math.round(w)} in wide`}
        color={lineColor}
      />
      <MeasurementLine
        start={[w / 2 + 5, bottom, front + 2]}
        end={[w / 2 + 5, top, front + 2]}
        label={`${Math.round(h)} in tall`}
        color={lineColor}
        labelOffset={[5, 0, 0]}
      />
      <MeasurementLine
        start={[-w / 2 - 5, top + 2, back]}
        end={[-w / 2 - 5, top + 2, front]}
        label={`${Math.round(d)} in deep`}
        color={lineColor}
        labelOffset={[-5, 0, 0]}
      />
      <Html position={[0, top + 12, front + 6]} center distanceFactor={20}>
        <div className="whitespace-nowrap rounded-md border border-[#cbd6ce] bg-white/92 px-3 py-2 text-[11px] font-semibold text-[#25302c] shadow-lg backdrop-blur-md">
          {module.label}: {Math.round(w)} x {Math.round(h)} x {Math.round(d)} in · {getPanelCount(module.panels)} finish panels
        </div>
      </Html>
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
  selectedModule,
  selectedShelf,
  showMeasurements,
  onSelectShelf,
  onMoveShelf,
  config,
  shelves,
}: {
  mode: ViewMode;
  cameraView: CameraView;
  selectedModule: PieceModule | null;
  selectedShelf: string | null;
  showMeasurements: boolean;
  onSelectShelf: (id: string | null) => void;
  onMoveShelf: (id: string, position: [number, number, number]) => void;
  config: DesignConfig;
  shelves: ShelfComponent[];
}) {
  const selected = shelves.find((shelf) => shelf.id === selectedShelf);
  const showDetail = showMeasurements;
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

      {showDetail && (
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
          <MeasurementLine
            start={[config.width / 2 + 7, config.shelfHeight - SHELF_THICKNESS / 2, 0]}
            end={[config.width / 2 + 7, config.shelfHeight + SHELF_THICKNESS / 2, 0]}
            label={`${SHELF_THICKNESS} in shelf`}
            color="#48544f"
            labelOffset={[7, 0, 0]}
          />
        </>
      )}

      {showMeasurements && selectedModule && <SelectedModuleMeasurements module={selectedModule} />}

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
      const span = Math.max(config.width, config.depth);
      const topH = Math.max(config.height + 140, span * 2.25);
      destination.set(0, topH, 0.01);
      target.set(0, 0, 0);
    } else if (cameraView === "detail" || mode === "inspection") {
      destination.set(focusX + 42, focusY + 5, focusZ + 58);
    } else {
      destination.set(config.width * 0.52 + 36, config.height * 0.52, config.depth + config.width * 0.28 + 40);
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

function Lights({ config }: { config: DesignConfig }) {
  const shadowSpan = Math.max(config.width, config.depth) + 120;

  return (
    <>
      <hemisphereLight args={["#fff8f0", "#d8d0c4", 1.1]} />
      <directionalLight
        position={[60, 130, 80]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowSpan / 2}
        shadow-camera-right={shadowSpan / 2}
        shadow-camera-top={shadowSpan / 2}
        shadow-camera-bottom={-shadowSpan / 2}
        shadow-camera-near={1}
        shadow-camera-far={500}
      />
      <directionalLight position={[-40, 60, 50]} intensity={0.45} color="#fffaf6" />
    </>
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

function buildPersistenceComponents(config: DesignConfig, modules: PieceModule[], totalPrice: number): ClosetComponent[] {
  const components: Omit<ClosetComponent, "priceEach">[] = modules.map((pieceModule) => {
    const [, h] = pieceModule.dimensions;
    const plan = getPlanDimensions(pieceModule.dimensions, pieceModule.rotation);
    const type: ClosetComponent["type"] =
      pieceModule.id === "center-drawers"
        ? "drawer-unit"
        : pieceModule.id.includes("rod")
          ? "hanging-rod"
          : "shelf";

    return {
      id: `3d-${pieceModule.id}`,
      type,
      label: `${pieceModule.zone}: ${pieceModule.label} · ${formatRotation(pieceModule.rotation)} · ${getPanelCount(pieceModule.panels)} finish panels`,
      x: Math.round(pieceModule.position[0] + config.width / 2 - plan.width / 2),
      y: Math.round(config.height - pieceModule.position[1] - h / 2),
      w: Math.round(plan.width),
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

  const prices = allocatePrices(components.length, totalPrice);

  return components.map((component, index) => ({
    ...component,
    priceEach: prices[index],
  }));
}

export default function ClosetExperience3D() {
  const {
    syncCurrentDesign,
    closetConfig: config,
    closetFootprint,
    enabledPieceIds,
    setEnabledPieceIds,
    shelfPositions,
    setShelfPositions,
    pieceRotations,
    setPieceRotations,
    productBlocks,
    blockPositions,
    setBlockPositions,
    blockRotations,
    setBlockRotations,
    roomFeatures,
  } = useDesignStore();
  const [mode, setMode] = useState<ViewMode>("closet");
  const [cameraView, setCameraView] = useState<CameraView>("corner");
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [wallVisibility, setWallVisibility] = useState<WallVisibility>("smart");

  const enabledPieces = useMemo(() => new Set(enabledPieceIds.filter(isPieceId)), [enabledPieceIds]);
  const shelves = useMemo(() => buildShelves(config, shelfPositions), [config, shelfPositions]);
  const modules = useMemo(
    () => productBlocks.length > 0
      ? buildProductBlockModules(config, productBlocks, blockPositions, blockRotations)
      : buildPieceModules(config, enabledPieces, shelfPositions, pieceRotations),
    [blockPositions, blockRotations, config, enabledPieces, pieceRotations, productBlocks, shelfPositions]
  );
  const effectiveSelectedPiece = modules.some((pieceModule) => pieceModule.id === selectedPiece) ? selectedPiece : modules[0]?.id ?? null;
  const selectedModule = modules.find((pieceModule) => pieceModule.id === effectiveSelectedPiece) ?? null;
  const clearance = Math.round(config.height - config.shelfHeight - SHELF_THICKNESS);
  const minZoom = cameraView === "top" ? 0.72 : cameraView === "front" ? 0.76 : cameraView === "detail" ? 0.42 : 0.52;
  const maxZoom = cameraView === "top" ? 1.38 : cameraView === "front" ? 1.08 : cameraView === "detail" ? 2.05 : 1.24;
  const effectiveZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
  const visibleGroups = useMemo(() => getVisiblePieceGroups(), []);
  const componentsSubtotal = useMemo(
    () => productBlocks.length > 0 ? productBlocks.reduce((sum, block) => sum + block.price, 0) : getComponentsSubtotal(config, enabledPieces),
    [config, enabledPieces, productBlocks]
  );
  const allowances = useMemo(() => getProjectAllowances(config), [config]);
  const systemPrice = useMemo(
    () => productBlocks.length > 0 ? Math.round((componentsSubtotal + allowances.materialAllowance + allowances.installAllowance) / 50) * 50 : getSystemPrice(config, enabledPieces),
    [allowances.installAllowance, allowances.materialAllowance, componentsSubtotal, config, enabledPieces, productBlocks.length]
  );
  const storageStats = useMemo(() => getStorageStats(config, enabledPieces, shelves), [config, enabledPieces, shelves]);
  const materialLines = useMemo(() => buildMaterialList(productBlocks, config), [config, productBlocks]);
  const materialSubtotal = useMemo(
    () => materialLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [materialLines]
  );
  const featurePlacementNotes = useMemo(
    () => getFeaturePlacementNotes(config, modules, roomFeatures),
    [config, modules, roomFeatures]
  );
  const moduleOverlapNotes = useMemo(() => getModuleOverlapNotes(modules), [modules]);
  const selectedFeatureNotes = useMemo(
    () => selectedModule ? featurePlacementNotes.filter((note) => note.module.id === selectedModule.id) : [],
    [featurePlacementNotes, selectedModule]
  );
  const selectedModuleOverlapNotes = useMemo(
    () => selectedModule ? moduleOverlapNotes.filter((note) => note.modules.some((module) => module.id === selectedModule.id)) : [],
    [moduleOverlapNotes, selectedModule]
  );
  const blockedFeatureIds = useMemo(
    () => new Set(featurePlacementNotes.map((note) => note.feature.id)),
    [featurePlacementNotes]
  );
  const invalidModuleIds = useMemo(
    () => new Set([
      ...featurePlacementNotes.map((note) => note.module.id),
      ...moduleOverlapNotes.flatMap((note) => note.modules.map((module) => module.id)),
    ]),
    [featurePlacementNotes, moduleOverlapNotes]
  );

  useEffect(() => {
    syncCurrentDesign({
      dimensions: {
        width: config.width,
        height: config.height,
      },
      components: buildPersistenceComponents(config, modules, systemPrice),
      closetConfig: config,
      closetFootprint,
      enabledPieceIds: Array.from(enabledPieces),
      shelfPositions,
      pieceRotations,
      productBlocks,
      blockPositions,
      blockRotations,
      roomFeatures,
    });
  }, [blockPositions, blockRotations, closetFootprint, config, enabledPieces, modules, pieceRotations, productBlocks, roomFeatures, shelfPositions, syncCurrentDesign, systemPrice]);

  function togglePiece(id: PieceId) {
    const next = new Set(enabledPieces);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabledPieceIds(Array.from(next));
    if (selectedPiece === id) setSelectedPiece(null);
  }

  function handleMovePiece(id: string, position: [number, number, number]) {
    const pieceModule = modules.find((m) => m.id === id);
    if (!pieceModule) return;

    const otherModules = modules.filter((m) => m.id !== id);
    const snapped = snapModulePosition(position, pieceModule.dimensions, pieceModule.rotation, otherModules, config, closetFootprint);
    const clamped = clampModulePosition(config, pieceModule.dimensions, pieceModule.rotation, snapped, closetFootprint);

    if (pieceModule.parts) {
      setBlockPositions({ ...blockPositions, [id]: clamped });
    } else {
      setShelfPositions({ ...shelfPositions, [id]: clamped });
    }
  }

  function handleRotatePiece(id: string) {
    const pieceModule = modules.find((module) => module.id === id);
    if (!pieceModule) return;

    const nextRotation = getNextRotation(pieceModule.rotation);
    if (pieceModule.parts) {
      setBlockRotations({ ...blockRotations, [id]: nextRotation });
      setBlockPositions({ ...blockPositions, [id]: clampModulePosition(config, pieceModule.dimensions, nextRotation, pieceModule.position, closetFootprint) });
    } else {
      setPieceRotations({ ...pieceRotations, [id]: nextRotation });
      setShelfPositions({ ...shelfPositions, [id]: clampModulePosition(config, pieceModule.dimensions, nextRotation, pieceModule.position, closetFootprint) });
    }
    setSelectedPiece(id);
    setMode("inspection");
  }

  function handleCameraViewChange(view: CameraView) {
    setCameraView(view);
    setMode(view === "detail" ? "inspection" : "closet");
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
            Guided views keep the closet easy to review without free spinning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [112, 82, 124], fov: 38 }} dpr={[1, 2]} style={{ touchAction: "pan-y" }}>
            <color attach="background" args={["#ebe5dc"]} />
            <fog attach="fog" args={["#ebe5dc", 160, 300]} />
            <Lights config={config} />
            <FloorShadow cameraView={cameraView} />
            <CameraRig mode={mode} cameraView={cameraView} focusPosition={selectedModule?.position ?? null} config={config} zoom={effectiveZoom} />
            <ClosetRoom mode={mode} cameraView={cameraView} wallVisibility={wallVisibility} config={config} footprint={closetFootprint} />
            <RoomFeatures3D config={config} features={roomFeatures} wallVisibility={wallVisibility} blockedFeatureIds={blockedFeatureIds} />
            <ConfigurableModules
              modules={modules}
              selectedPiece={effectiveSelectedPiece}
              invalidModuleIds={invalidModuleIds}
              cameraView={cameraView}
              config={config}
              footprint={closetFootprint}
              onSelect={(id) => {
                setSelectedPiece(id);
                setMode("inspection");
              }}
              onMove={handleMovePiece}
            />
            {showMeasurements && (
              <ShelfSystem
                mode={mode}
                cameraView={cameraView}
                selectedModule={selectedModule}
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
                <ChoiceButton key={view} active={cameraView === view} onClick={() => handleCameraViewChange(view)}>
                  {view === "corner" ? "Corner" : view === "front" ? "Front" : view === "top" ? "Top" : "Detail"}
                </ChoiceButton>
              ))}
            </div>
            {selectedModule && (
              <button
                type="button"
                onClick={() => handleRotatePiece(selectedModule.id)}
                className="rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
              >
                Rotate Selected
              </button>
            )}
            {productBlocks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBlockPositions({});
                  setBlockRotations({});
                }}
                className="rounded-md border border-[#cbd6ce] bg-white px-3 py-2 text-sm font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
              >
                Reflow Blocks
              </button>
            )}
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

          {/* ── Back to block builder ── */}
          <Link
            href="/blocks"
            className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-[#48645a] hover:text-[#25302c]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit building blocks
          </Link>

          {/* ── Closet summary ── */}
          <div className="mb-4 rounded-md border border-[#d8dfd8] bg-[#f6f8f5] px-3 py-2.5 text-xs text-[#53635d]">
            <span className="font-semibold text-[#1f2824]">
              {config.shape === "walk-in" ? "Walk-in" : config.shape === "u" ? "U-Shape" : config.shape === "left" ? "Left L" : config.shape === "right" ? "Right L" : "Straight"}
            </span>
            {" room · "}{config.width}&quot; wide · {config.depth}&quot; deep · {config.height}&quot; tall
            {roomFeatures.length > 0 && (
              <span>{" · "}{roomFeatures.length} room feature{roomFeatures.length === 1 ? "" : "s"}</span>
            )}
          </div>

          <div className="mb-5">
            <DealEconomicsPanel materialCost={materialSubtotal} />
          </div>

          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1f2824]">Built product blocks</h2>
            <Link href="/blocks" className="text-[10px] font-semibold text-[#48645a] hover:text-[#25302c]">
              Edit blocks
            </Link>
          </div>

          <div className="space-y-3">
            {productBlocks.length > 0 ? productBlocks.map((block) => (
              <div key={block.id} className="rounded-md border border-[#e4ece4] bg-[#f9fbf9] p-3">
                <div className="text-xs font-semibold text-[#25302c]">{block.name}</div>
                <div className="mt-1 text-[10px] text-[#6f7d76]">
                  {block.productLine === "freedomRail" ? "freedomRail" : "Select"} · {block.finish} · {block.width}&quot; wide
                </div>
              </div>
            )) : visibleGroups.map((group) => (
              <div key={group.zone} className="rounded-md border border-[#e4ece4] bg-[#f9fbf9] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">{group.zone}</div>
                  <button type="button" onClick={() => setEnabledPieceIds(Array.from(DEFAULT_PIECES))} className="text-[10px] font-semibold text-[#48645a] hover:text-[#25302c]">Add all</button>
                </div>
                <div className="space-y-1.5">
                  {group.pieces.map((piece) => {
                    const on = enabledPieces.has(piece.id);
                    return (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => togglePiece(piece.id)}
                        className="flex w-full items-center justify-between rounded border border-transparent bg-white px-2 py-1.5 text-left text-xs text-[#25302c] transition hover:border-[#d8dfd8]"
                      >
                        <span>{piece.label}</span>
                        <span className="text-[#6f7d76]">{on ? "active" : "add"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>


          {materialLines.length > 0 && (
            <div className="mt-5 rounded-md border border-[#d8dfd8] bg-[#fbfcfb] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#25302c]">Mock materials</h3>
                  <p className="mt-1 text-xs leading-5 text-[#6f7d76]">Manufactured parts plus install hardware.</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">Takeoff</div>
                  <div className="text-sm font-bold text-[#1f2824]">{formatCurrency(materialSubtotal)}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {materialLines.slice(0, 6).map((line) => (
                  <div key={line.id} className="flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-[#25302c]">{line.name}</div>
                      <div className="text-[10px] text-[#7a8a82]">{line.sku}</div>
                    </div>
                    <div className="shrink-0 text-right font-semibold text-[#53635d]">
                      {line.qty} {line.unit}
                    </div>
                  </div>
                ))}
              </div>
              {materialLines.length > 6 && (
                <div className="mt-2 text-[10px] text-[#7a8a82]">
                  + {materialLines.length - 6} more hardware/material line{materialLines.length - 6 === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )}

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
              {moduleOverlapNotes.length > 0
                ? `${moduleOverlapNotes.length} product overlap${moduleOverlapNotes.length === 1 ? "" : "s"} must be resolved before proposal.`
                : featurePlacementNotes.length > 0
                ? `${featurePlacementNotes.length} blocked room feature${featurePlacementNotes.length === 1 ? "" : "s"} must be cleared before proposal.`
                : storageStats.warnings > 0
                ? `${storageStats.warnings} placement note${storageStats.warnings === 1 ? "" : "s"} need review before proposal.`
                : "No placement conflicts detected in this mock validation pass."}
            </div>
            {moduleOverlapNotes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {moduleOverlapNotes.slice(0, 3).map((note) => (
                  <div key={note.id} className="rounded-md border border-[#dec8c0] bg-[#fbf2ef] px-2.5 py-2 text-[11px] leading-4 text-[#7e4e40]">
                    {note.message}
                  </div>
                ))}
              </div>
            )}
            {featurePlacementNotes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {featurePlacementNotes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-md border px-2.5 py-2 text-[11px] leading-4 ${
                      note.severity === "error"
                        ? "border-[#dec8c0] bg-[#fbf2ef] text-[#7e4e40]"
                        : "border-[#d9d0bd] bg-[#fbf8ef] text-[#6c5c43]"
                    }`}
                  >
                    {note.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-base font-semibold text-[#1f2824]">Module placement</h2>
            <p className="mt-1 text-sm leading-6 text-[#5b6a64]">
              Drag and rotate locked product blocks. The app resolves exposed panels from the room walls.
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {modules.map((pieceModule) => {
              const active = effectiveSelectedPiece === pieceModule.id;
              const gridMiss = offGridAmount(pieceModule.position, pieceModule.basePosition);
              const moved = pieceModule.position.some((value, index) => Math.abs(value - pieceModule.basePosition[index]) > 0.5);
              const panelCount = getPanelCount(pieceModule.panels);
              const panelSummary = panelCount === 0 ? "All construction edges are wall-covered" : `${panelCount} finished panel${panelCount === 1 ? "" : "s"} needed`;

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={pieceModule.id}
                  onClick={() => {
                    setSelectedPiece(pieceModule.id);
                    setMode("inspection");
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setSelectedPiece(pieceModule.id);
                    setMode("inspection");
                  }}
                  className={`w-full rounded-md border p-4 text-left transition ${
                    active ? "border-[#25302c] bg-[#f6f8f5]" : "border-[#d8dfd8] bg-white hover:bg-[#f6f8f5]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-[#25302c]">{pieceModule.label}</span>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#6f8c76]">
                        Rotation {formatRotation(pieceModule.rotation)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#f0f4f0] px-2 py-1 text-[11px] font-semibold text-[#53635d]">
                        {formatCurrency(pieceModule.price)}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRotatePiece(pieceModule.id);
                        }}
                        className="rounded-md border border-[#cbd6ce] bg-white px-2 py-1 text-[11px] font-semibold text-[#33413c] transition hover:bg-[#eef3ee]"
                      >
                        Rotate
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[#53635d]">{pieceModule.zone} · {pieceModule.detail}</p>
                  <p className="mt-1 text-xs text-[#6f7d76]">
                    {moved
                      ? `Moved to ${Math.round(pieceModule.position[0])}, ${Math.round(pieceModule.position[1])}, ${Math.round(pieceModule.position[2])} in${gridMiss > 1 ? ` · ${gridMiss} in off grid` : ""}`
                      : "At recommended location"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#48645a]">{panelSummary}</p>
                  {active && selectedFeatureNotes.length > 0 && (
                    <div className="mt-2 rounded-md border border-[#dec8c0] bg-[#fbf2ef] px-2.5 py-2 text-[11px] leading-4 text-[#7e4e40]">
                      {selectedFeatureNotes[0].message}
                    </div>
                  )}
                  {active && selectedModuleOverlapNotes.length > 0 && (
                    <div className="mt-2 rounded-md border border-[#dec8c0] bg-[#fbf2ef] px-2.5 py-2 text-[11px] leading-4 text-[#7e4e40]">
                      {selectedModuleOverlapNotes[0].message}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    {(["left", "right", "back"] as const).map((face) => (
                      <span
                        key={face}
                        className={`rounded border px-1.5 py-0.5 ${
                          pieceModule.panels[face]
                            ? "border-[#a0c0a8] bg-[#eef5ef] text-[#48645a]"
                            : "border-[#d8dfd8] bg-white text-[#7a8a82]"
                        }`}
                      >
                        {face} {pieceModule.panels[face] ? "panel" : pieceModule.panels.coveredBy[face] ?? "covered"}
                      </span>
                    ))}
                  </div>
                </div>
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
