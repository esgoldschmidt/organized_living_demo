import { create } from "zustand";
import {
  ClosetComponent,
  ClosetDimensions,
  ComponentType,
  DesignSnapshot,
  MaterialLine,
  MeasuredFootprint,
  PALETTE_ITEMS,
  ProductBlock,
  ProductBlockKind,
  ProductLine,
  RoomFeature,
  RoomFeatureKind,
} from "@/types";

export type ClosetShape = "straight" | "left" | "right" | "u" | "walk-in";
export type ShelfPositions = Record<string, [number, number, number]>;
type QuarterRotation = 0 | 90 | 180 | 270;

export interface ClosetConfig {
  width: number;
  height: number;
  depth: number;
  shelfDepth: number;
  shelfHeight: number;
  leftReturn: number;
  rightReturn: number;
  rightOffset: number;
  frontStubDepth: number;
  frontLeftStubDepth: number;
  frontRightStubDepth: number;
  shape: ClosetShape;
}

const DEFAULT_CLOSET_CONFIG: ClosetConfig = {
  width: 120,
  height: 96,
  depth: 84,
  shelfDepth: 14,
  shelfHeight: 72,
  leftReturn: 36,
  rightReturn: 36,
  rightOffset: 0,
  frontStubDepth: 36,
  frontLeftStubDepth: 36,
  frontRightStubDepth: 36,
  shape: "walk-in",
};

function entryLeftStub(config: ClosetConfig) {
  return config.frontLeftStubDepth ?? config.frontStubDepth;
}

function entryRightStub(config: ClosetConfig) {
  return config.frontRightStubDepth ?? config.frontStubDepth;
}

function normalizeClosetConfig(config: Partial<ClosetConfig>): ClosetConfig {
  const next = { ...DEFAULT_CLOSET_CONFIG, ...config };
  return {
    ...next,
    frontLeftStubDepth: next.frontLeftStubDepth ?? next.frontStubDepth,
    frontRightStubDepth: next.frontRightStubDepth ?? next.frontStubDepth,
  };
}

export function buildFootprintFromConfig(config: ClosetConfig, source: MeasuredFootprint["source"] = "preset"): MeasuredFootprint {
  const leftStub = entryLeftStub(config);
  const rightStub = entryRightStub(config);
  const openingWidth = config.shape === "walk-in"
    ? Math.max(24, config.width - leftStub - rightStub)
    : config.width;
  const leftJambX = config.shape === "walk-in" ? leftStub : 0;
  const rightJambX = config.shape === "walk-in" ? config.width - rightStub : config.width;
  const points: MeasuredFootprint["points"] = [
    { id: "left-jamb", x: leftJambX, y: config.depth, type: "left-jamb" },
    { id: "front-left", x: 0, y: config.depth, type: "corner" },
    { id: "back-left", x: 0, y: 0, type: "corner" },
    { id: "back-right", x: config.width, y: 0, type: "corner" },
    { id: "front-right", x: config.width, y: config.depth, type: "corner" },
    { id: "right-jamb", x: rightJambX, y: config.depth, type: "right-jamb" },
  ];

  if (config.shape !== "walk-in") {
    points.splice(1, 1);
    points.splice(points.length - 2, 1);
  }

  return {
    source,
    units: "in",
    points,
    walls: points.slice(0, -1).map((point, index) => ({
      from: point.id,
      to: points[index + 1].id,
      label: index === 0 ? "left entry wall" : index === 2 ? "back wall" : "wall run",
    })),
    opening: {
      leftJambId: "left-jamb",
      rightJambId: "right-jamb",
      width: Math.round(openingWidth),
    },
    confidence: source === "preset" ? 1 : 0.86,
  };
}

export function buildMockArFootprint(config: ClosetConfig): MeasuredFootprint {
  const leftStub = entryLeftStub(config);
  const rightStub = entryRightStub(config);
  const columnLeft = Math.round(config.width * 0.48);
  const columnRight = columnLeft + 18;
  const columnDepth = 14;
  const points: MeasuredFootprint["points"] = [
    { id: "left-jamb", x: leftStub, y: config.depth, type: "left-jamb" },
    { id: "front-left", x: 0, y: config.depth, type: "corner" },
    { id: "left-back", x: 0, y: 0, type: "corner" },
    { id: "column-left-back", x: columnLeft, y: 0, type: "inside-corner" },
    { id: "column-left-face", x: columnLeft, y: columnDepth, type: "column" },
    { id: "column-right-face", x: columnRight, y: columnDepth, type: "column" },
    { id: "column-right-back", x: columnRight, y: 0, type: "inside-corner" },
    { id: "back-right", x: config.width, y: 0, type: "corner" },
    { id: "front-right", x: config.width, y: config.depth, type: "corner" },
    { id: "right-jamb", x: config.width - rightStub, y: config.depth, type: "right-jamb" },
  ];

  return {
    source: "mock-ar",
    units: "in",
    points,
    walls: points.slice(0, -1).map((point, index) => ({
      from: point.id,
      to: points[index + 1].id,
      label: index >= 2 && index <= 5 ? "column jog" : index === 6 ? "back wall" : "measured wall",
    })),
    opening: {
      leftJambId: "left-jamb",
      rightJambId: "right-jamb",
      width: Math.round(config.width - leftStub - rightStub),
    },
    confidence: 0.84,
  };
}

function normalizeFootprintToOrigin(footprint: MeasuredFootprint) {
  const xs = footprint.points.map((point) => point.x);
  const ys = footprint.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  if (minX === 0 && minY === 0) return footprint;

  return {
    ...footprint,
    points: footprint.points.map((point) => ({
      ...point,
      x: point.x - minX,
      y: point.y - minY,
    })),
  };
}

function getFootprintSize(footprint: MeasuredFootprint) {
  const xs = footprint.points.map((point) => point.x);
  const ys = footprint.points.map((point) => point.y);

  return {
    width: Math.max(60, Math.round(Math.max(...xs) - Math.min(...xs))),
    depth: Math.max(20, Math.round(Math.max(...ys) - Math.min(...ys))),
  };
}
export function computeFeetOfProduct(blocks: ProductBlock[], config: ClosetConfig): number {
  if (blocks.length === 0) {
    return Math.round(config.width / 12 * 2);
  }
  const horizontalFt = blocks
    .flatMap((b) => b.parts)
    .filter((p) => p.type === "shelf" || p.type === "rod" || p.type === "rail" || p.type === "shoe-shelf")
    .reduce((sum, p) => sum + p.width / 12, 0);
  return Math.max(8, Math.ceil(horizontalFt));
}

const DEFAULT_ENABLED_PIECE_IDS = [
  "back-left-tower",
  "back-right-tower",
  "center-drawers",
  "center-shelves",
];

const LOCAL_STORAGE_DESIGN_KEY = "closet-design";
const LOCAL_STORAGE_PROJECT_KEY = "closet-project-id";

function priceProductBlock(kind: ProductBlockKind, productLine: ProductLine, width: number) {
  const baseByKind: Record<ProductBlockKind, number> = {
    "shelf-rod": 240,
    "double-hang": 280,
    "drawer-stack": 740,
    "shoe-tower": 520,
    "open-shelves": 390,
  };
  const lineMultiplier = productLine === "select" ? 1.34 : 1;
  return Math.round((baseByKind[kind] + width * 5.5) * lineMultiplier / 25) * 25;
}

function buildBlockParts(kind: ProductBlockKind, productLine: ProductLine, width: number, height: number, depth: number): ProductBlock["parts"] {
  const railDepth = productLine === "freedomRail" ? 1.2 : 0.75;
  const parts: ProductBlock["parts"] = [
    { id: "rail", type: "rail", label: productLine === "freedomRail" ? "Hanging Rail" : "Back Cleat", x: 0, y: height - 4, z: -depth / 2 + railDepth / 2, width, height: 2, depth: railDepth },
  ];

  if (productLine === "select") {
    parts.push(
      { id: "left-panel", type: "panel", label: "Left Panel", x: -width / 2 + 0.4, y: height / 2, z: 0, width: 0.75, height, depth },
      { id: "right-panel", type: "panel", label: "Right Panel", x: width / 2 - 0.4, y: height / 2, z: 0, width: 0.75, height, depth },
    );
  } else {
    parts.push(
      { id: "left-upright", type: "upright", label: "Upright", x: -width / 2 + 3, y: height / 2, z: -depth / 2 + 1.2, width: 1.2, height: height - 8, depth: 1 },
      { id: "right-upright", type: "upright", label: "Upright", x: width / 2 - 3, y: height / 2, z: -depth / 2 + 1.2, width: 1.2, height: height - 8, depth: 1 },
    );
  }

  if (kind === "shelf-rod") {
    parts.push(
      { id: "top-shelf", type: "shelf", label: "Shelf", x: 0, y: height - 16, z: 0, width, height: 1.25, depth },
      { id: "rod", type: "rod", label: "Rod", x: 0, y: height - 28, z: depth / 2 - 2.5, width: width - 4, height: 1, depth: 1 },
    );
  }

  if (kind === "double-hang") {
    parts.push(
      { id: "upper-shelf", type: "shelf", label: "Upper Shelf", x: 0, y: height - 15, z: 0, width, height: 1.25, depth },
      { id: "upper-rod", type: "rod", label: "Upper Rod", x: 0, y: height - 28, z: depth / 2 - 2.5, width: width - 4, height: 1, depth: 1 },
      { id: "lower-shelf", type: "shelf", label: "Lower Shelf", x: 0, y: height / 2 - 4, z: 0, width, height: 1.25, depth },
      { id: "lower-rod", type: "rod", label: "Lower Rod", x: 0, y: height / 2 - 17, z: depth / 2 - 2.5, width: width - 4, height: 1, depth: 1 },
    );
  }

  if (kind === "drawer-stack") {
    parts.push(
      { id: "top-shelf", type: "shelf", label: "Shelf", x: 0, y: height - 12, z: 0, width, height: 1.25, depth },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `drawer-${index + 1}`,
        type: "drawer" as const,
        label: "Soft-close Drawer",
        x: 0,
        y: 11 + index * 9,
        z: depth / 2 - 1.2,
        width: width - 3,
        height: 7,
        depth: 2,
      })),
    );
  }

  if (kind === "shoe-tower") {
    parts.push(...Array.from({ length: 5 }, (_, index) => ({
      id: `shoe-${index + 1}`,
      type: "shoe-shelf" as const,
      label: "Angled Shoe Shelf",
      x: 0,
      y: 10 + index * 11,
      z: 0,
      width: width - 2,
      height: 1.1,
      depth,
    })));
  }

  if (kind === "open-shelves") {
    parts.push(...Array.from({ length: 5 }, (_, index) => ({
      id: `shelf-${index + 1}`,
      type: "shelf" as const,
      label: "Adjustable Shelf",
      x: 0,
      y: 10 + index * ((height - 20) / 4),
      z: 0,
      width: width - 2,
      height: 1.25,
      depth,
    })));
  }

  return parts;
}

export function createProductBlock(
  kind: ProductBlockKind,
  options: Partial<Pick<ProductBlock, "id" | "name" | "productLine" | "finish" | "width" | "height" | "depth">> = {}
): ProductBlock {
  const productLine = options.productLine ?? (kind === "drawer-stack" ? "select" : "freedomRail");
  const width = options.width ?? (kind === "drawer-stack" ? 30 : kind === "open-shelves" ? 30 : 48);
  const height = options.height ?? (productLine === "select" ? 84 : 72);
  const depth = options.depth ?? (productLine === "select" ? 14 : 12);
  const nameByKind: Record<ProductBlockKind, string> = {
    "shelf-rod": "Shelf + Rod",
    "double-hang": "Double Hang",
    "drawer-stack": "Drawer Stack",
    "shoe-tower": "Shoe Tower",
    "open-shelves": "Open Shelves",
  };

  return {
    id: options.id ?? nanoidSimple(),
    name: options.name ?? nameByKind[kind],
    kind,
    productLine,
    finish: options.finish ?? (productLine === "select" ? "Snowdrift Live" : "White"),
    width,
    height,
    depth,
    parts: buildBlockParts(kind, productLine, width, height, depth),
    price: priceProductBlock(kind, productLine, width),
  };
}

function rebuildProductBlock(block: ProductBlock, update: Partial<ProductBlock>): ProductBlock {
  const next = { ...block, ...update };
  return {
    ...next,
    parts: buildBlockParts(next.kind, next.productLine, next.width, next.height, next.depth),
    price: priceProductBlock(next.kind, next.productLine, next.width),
  };
}

const DEFAULT_PRODUCT_BLOCKS: ProductBlock[] = [
  createProductBlock("shelf-rod", { id: "block-shelf-rod", width: 48 }),
  createProductBlock("drawer-stack", { id: "block-drawer-stack", width: 30 }),
];

function countBlockParts(blocks: ProductBlock[]) {
  return blocks.flatMap((block) => block.parts).reduce((counts, part) => {
    counts[part.type] = (counts[part.type] ?? 0) + 1;
    return counts;
  }, {} as Record<ProductBlock["parts"][number]["type"], number>);
}

export function buildMaterialList(blocks: ProductBlock[], config: ClosetConfig): MaterialLine[] {
  const counts = countBlockParts(blocks);
  const railFootage = Math.ceil(blocks.reduce((sum, block) => {
    const railWidth = block.parts
      .filter((part) => part.type === "rail")
      .reduce((partSum, part) => partSum + part.width, 0);
    return sum + railWidth / 12;
  }, 0));
  const shelfCount = (counts.shelf ?? 0) + (counts["shoe-shelf"] ?? 0);
  const rodCount = counts.rod ?? 0;
  const drawerCount = counts.drawer ?? 0;
  const panelCount = counts.panel ?? 0;
  const uprightCount = counts.upright ?? 0;
  const railCount = counts.rail ?? 0;
  const blockCount = blocks.length;
  const screwEach = Math.max(0, Math.ceil((railCount * 8 + shelfCount * 4 + drawerCount * 6 + panelCount * 8 + uprightCount * 3) / 25) * 25);
  const anchorEach = Math.max(0, railCount * 4 + Math.ceil(config.width / 24));
  const supportEach = shelfCount * 4;

  const lines: MaterialLine[] = [];
  const add = (line: Omit<MaterialLine, "id">) => {
    if (line.qty <= 0) return;
    lines.push({ ...line, id: line.sku.toLowerCase() });
  };

  add({
    sku: "OL-RAIL-FT",
    name: "Wall rail / cleat length",
    category: "manufactured",
    qty: railFootage,
    unit: "ft",
    unitPrice: 9,
    note: `${railCount} rail section${railCount === 1 ? "" : "s"} cut to block widths`,
  });
  add({
    sku: "OL-UPRIGHT",
    name: "Vertical uprights",
    category: "manufactured",
    qty: uprightCount,
    unit: "each",
    unitPrice: 18,
    note: "Mock freedomRail upright count from block parts",
  });
  add({
    sku: "OL-SHELF",
    name: "Shelves",
    category: "manufactured",
    qty: shelfCount,
    unit: "each",
    unitPrice: 42,
    note: "Includes flat and angled shoe shelves",
  });
  add({
    sku: "OL-ROD",
    name: "Hanging rods",
    category: "manufactured",
    qty: rodCount,
    unit: "each",
    unitPrice: 22,
    note: "Cut per block width",
  });
  add({
    sku: "OL-DRAWER",
    name: "Drawer boxes/fronts",
    category: "manufactured",
    qty: drawerCount,
    unit: "each",
    unitPrice: 85,
    note: "Mock Select drawer assemblies",
  });
  add({
    sku: "OL-PANEL",
    name: "Side panels",
    category: "manufactured",
    qty: panelCount,
    unit: "each",
    unitPrice: 96,
    note: "Required when a block has exposed construction sides",
  });
  add({
    sku: "HW-RAIL-SCREW-PACK",
    name: "Rail fastener packs",
    category: "hardware",
    qty: Math.ceil(Math.max(railFootage, 1) / 4),
    unit: "pack",
    unitPrice: 12,
    note: "Mock pack count: one pack per 4 ft of wall rail",
  });
  add({
    sku: "HW-SCREW-8",
    name: "#8 installation screws",
    category: "hardware",
    qty: screwEach,
    unit: "each",
    unitPrice: 0.12,
    note: "Screws for rails, panels, shelves, and drawer hardware",
  });
  add({
    sku: "HW-ANCHOR",
    name: "Wall anchors",
    category: "hardware",
    qty: anchorEach,
    unit: "each",
    unitPrice: 0.35,
    note: "Used where rail fasteners do not hit framing",
  });
  add({
    sku: "HW-SHELF-SUPPORT",
    name: "Shelf supports",
    category: "hardware",
    qty: supportEach,
    unit: "each",
    unitPrice: 0.65,
    note: "Four supports per shelf in this mock BOM",
  });
  add({
    sku: "HW-ROD-CUP",
    name: "Rod cups",
    category: "hardware",
    qty: rodCount * 2,
    unit: "each",
    unitPrice: 3,
    note: "One pair per hanging rod",
  });
  add({
    sku: "INSTALL-KIT",
    name: "Installer consumables kit",
    category: "install",
    qty: Math.max(1, Math.ceil(blockCount / 3)),
    unit: "set",
    unitPrice: 28,
    note: "Touch-up caps, shims, labels, and small consumables",
  });

  return lines;
}

function createRoomFeature(kind: RoomFeatureKind, config: ClosetConfig): RoomFeature {
  const defaults: Record<RoomFeatureKind, Omit<RoomFeature, "id" | "x" | "y">> = {
    column: {
      kind: "column",
      label: "Column",
      width: 18,
      depth: 14,
      height: config.height,
      elevation: 0,
      rotation: 0,
      behavior: "obstruction",
    },
    "air-register": {
      kind: "air-register",
      label: "Air Register",
      width: 14,
      depth: 6,
      height: 1,
      elevation: 0,
      rotation: 0,
      behavior: "clearance-zone",
    },
    "access-panel": {
      kind: "access-panel",
      label: "Access Panel",
      width: 18,
      depth: 2,
      height: 18,
      elevation: 36,
      rotation: 0,
      behavior: "clearance-zone",
    },
  };

  const feature = defaults[kind];
  return {
    id: nanoidSimple(),
    ...feature,
    x: Math.round(config.width / 2 - feature.width / 2),
    y: kind === "access-panel" ? 0 : Math.round(config.depth / 2 - feature.depth / 2),
  };
}

const SAMPLE_DIMENSIONS: ClosetDimensions = {
  width: 120,
  height: 96,
};

const SAMPLE_COMPONENTS: ClosetComponent[] = [
  {
    id: "sample-double-hang-left",
    type: "double-hang",
    label: "Double Hang",
    x: 0,
    y: 24,
    w: 36,
    h: 72,
    color: "#7bc4e2",
    priceEach: 110,
  },
  {
    id: "sample-shelf-top-left",
    type: "shelf",
    label: "Shelf",
    x: 0,
    y: 0,
    w: 36,
    h: 2,
    color: "#d4a96a",
    priceEach: 45,
  },
  {
    id: "sample-drawer-center",
    type: "drawer-unit",
    label: "Drawer Unit",
    x: 42,
    y: 60,
    w: 24,
    h: 36,
    color: "#b5a0d4",
    priceEach: 195,
  },
  {
    id: "sample-shelf-center-top",
    type: "shelf",
    label: "Shelf",
    x: 36,
    y: 12,
    w: 36,
    h: 2,
    color: "#d4a96a",
    priceEach: 45,
  },
  {
    id: "sample-shoe-right-bottom",
    type: "shoe-rack",
    label: "Shoe Rack",
    x: 66,
    y: 84,
    w: 24,
    h: 12,
    color: "#f4a460",
    priceEach: 55,
  },
  {
    id: "sample-corner-right",
    type: "corner-shelf",
    label: "Corner Tower",
    x: 96,
    y: 24,
    w: 24,
    h: 72,
    color: "#8fbc8f",
    priceEach: 245,
  },
  {
    id: "sample-hang-right-top",
    type: "hanging-rod",
    label: "Hanging Rod",
    x: 72,
    y: 24,
    w: 24,
    h: 36,
    color: "#6b9fd4",
    priceEach: 65,
  },
  {
    id: "1x2a1meo",
    type: "shoe-rack",
    label: "Shoe Rack",
    x: 66,
    y: 72,
    w: 24,
    h: 12,
    color: "#f4a460",
    priceEach: 55,
  },
];

const SAMPLE_SNAPSHOT: DesignSnapshot = {
  dimensions: SAMPLE_DIMENSIONS,
  components: SAMPLE_COMPONENTS,
};

function nanoidSimple() {
  return Math.random().toString(36).slice(2, 10);
}

interface DesignStore {
  projectId: string | null;
  dimensions: ClosetDimensions;
  components: ClosetComponent[];
  selectedId: string | null;
  persistenceState: "idle" | "saving" | "saved" | "loading" | "error";
  persistenceMessage: string | null;

  setDimensions: (d: Partial<ClosetDimensions>) => void;
  addComponent: (type: ComponentType, x: number, y: number) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  resizeComponent: (id: string, w: number, h: number) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  syncCurrentDesign: (snapshot: DesignSnapshot) => void;
  applySnapshot: (
    snapshot: DesignSnapshot,
    options?: { projectId?: string | null; message?: string | null }
  ) => void;
  saveDesign: () => Promise<void>;
  loadDesign: () => Promise<void>;
  clearDesign: () => void;

  closetConfig: ClosetConfig;
  setClosetConfig: (update: Partial<ClosetConfig>) => void;
  closetFootprint: MeasuredFootprint;
  setClosetFootprint: (footprint: MeasuredFootprint) => void;
  enabledPieceIds: string[];
  setEnabledPieceIds: (ids: string[]) => void;
  shelfPositions: ShelfPositions;
  setShelfPositions: (positions: ShelfPositions) => void;
  pieceRotations: Record<string, 0 | 90 | 180 | 270>;
  setPieceRotations: (rotations: Record<string, 0 | 90 | 180 | 270>) => void;
  productBlocks: ProductBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  addProductBlock: (kind: ProductBlockKind) => void;
  updateProductBlock: (id: string, update: Partial<ProductBlock>) => void;
  removeProductBlock: (id: string) => void;
  setProductBlocks: (blocks: ProductBlock[]) => void;
  createAssembly: (blockIds: string[]) => void;
  dissolveAssembly: (groupId: string) => void;
  blockPositions: ShelfPositions;
  setBlockPositions: (positions: ShelfPositions) => void;
  blockRotations: Record<string, QuarterRotation>;
  setBlockRotations: (rotations: Record<string, QuarterRotation>) => void;
  roomFeatures: RoomFeature[];
  setRoomFeatures: (features: RoomFeature[]) => void;
  addRoomFeature: (kind: RoomFeatureKind) => void;
  updateRoomFeature: (id: string, update: Partial<RoomFeature>) => void;
  removeRoomFeature: (id: string) => void;

  projectName: string;
  setProjectName: (name: string) => void;
  materialMarkupPct: number;
  setMaterialMarkupPct: (pct: number) => void;
  laborRatePerFt: number;
  setLaborRatePerFt: (rate: number) => void;
  laborMarkupPct: number;
  setLaborMarkupPct: (pct: number) => void;
}

function buildSnapshot(
  dimensions: ClosetDimensions,
  components: ClosetComponent[],
  closetConfig: ClosetConfig,
  closetFootprint: MeasuredFootprint,
  enabledPieceIds: string[],
  shelfPositions: ShelfPositions,
  pieceRotations: Record<string, 0 | 90 | 180 | 270>,
  productBlocks: ProductBlock[],
  blockPositions: ShelfPositions,
  blockRotations: Record<string, QuarterRotation>,
  roomFeatures: RoomFeature[]
): DesignSnapshot {
  return { dimensions, components, closetConfig, closetFootprint, enabledPieceIds, shelfPositions, pieceRotations, productBlocks, blockPositions, blockRotations, roomFeatures };
}

function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function createRemoteProject(snapshot: DesignSnapshot) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    throw new Error("Failed to create remote project");
  }

  return response.json() as Promise<{ projectId: string }>;
}

async function createRemoteRevision(projectId: string, snapshot: DesignSnapshot) {
  const response = await fetch(`/api/projects/${projectId}/revisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    throw new Error("Failed to create remote revision");
  }
}

async function loadRemoteProject(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}`);

  if (!response.ok) {
    throw new Error("Failed to load remote project");
  }

  return response.json() as Promise<{
    latestRevision: { snapshot: DesignSnapshot } | null;
  }>;
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  projectId: null,
  dimensions: SAMPLE_SNAPSHOT.dimensions,
  components: SAMPLE_SNAPSHOT.components,
  selectedId: null,
  persistenceState: "idle",
  persistenceMessage: "Default layout loaded for walkthrough.",

  closetConfig: normalizeClosetConfig(DEFAULT_CLOSET_CONFIG),
  setClosetConfig: (update) => set((s) => {
    const closetConfig = normalizeClosetConfig({ ...s.closetConfig, ...update });
    const shouldRegenerateFootprint =
      update.shape !== undefined ||
      update.width !== undefined ||
      update.depth !== undefined ||
      update.frontStubDepth !== undefined ||
      update.frontLeftStubDepth !== undefined ||
      update.frontRightStubDepth !== undefined;

    return {
      closetConfig,
      closetFootprint: shouldRegenerateFootprint
        ? buildFootprintFromConfig(closetConfig)
        : s.closetFootprint,
    };
  }),
  closetFootprint: buildFootprintFromConfig(normalizeClosetConfig(DEFAULT_CLOSET_CONFIG)),
  setClosetFootprint: (footprint) => set((s) => {
    const normalizedFootprint = normalizeFootprintToOrigin(footprint);
    const { width, depth } = getFootprintSize(normalizedFootprint);
    const leftJamb = normalizedFootprint.points.find((point) => point.id === normalizedFootprint.opening.leftJambId);
    const rightJamb = normalizedFootprint.points.find((point) => point.id === normalizedFootprint.opening.rightJambId);
    const leftStub = leftJamb ? Math.round(leftJamb.x) : undefined;
    const rightStub = rightJamb ? Math.round(width - rightJamb.x) : undefined;

    return {
      closetFootprint: normalizedFootprint,
      closetConfig: {
        ...normalizeClosetConfig(s.closetConfig),
        width,
        depth,
        shape: "walk-in",
        ...(leftStub !== undefined ? { frontLeftStubDepth: leftStub } : {}),
        ...(rightStub !== undefined ? { frontRightStubDepth: rightStub } : {}),
      },
    };
  }),
  enabledPieceIds: DEFAULT_ENABLED_PIECE_IDS,
  setEnabledPieceIds: (ids) => set({ enabledPieceIds: ids }),
  shelfPositions: {},
  setShelfPositions: (positions) => set({ shelfPositions: positions }),
  pieceRotations: {},
  setPieceRotations: (rotations) => set({ pieceRotations: rotations }),
  productBlocks: DEFAULT_PRODUCT_BLOCKS,
  selectedBlockId: DEFAULT_PRODUCT_BLOCKS[0]?.id ?? null,
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  addProductBlock: (kind) => set((state) => {
    const block = createProductBlock(kind);
    return {
      productBlocks: [...state.productBlocks, block],
      selectedBlockId: block.id,
      blockPositions: {},
      blockRotations: {},
    };
  }),
  updateProductBlock: (id, update) => set((state) => {
    const current = state.productBlocks.find((block) => block.id === id);
    const shouldResetPlacement = Boolean(
      current &&
      ((update.width !== undefined && update.width !== current.width) ||
        (update.height !== undefined && update.height !== current.height) ||
        (update.depth !== undefined && update.depth !== current.depth) ||
        (update.productLine !== undefined && update.productLine !== current.productLine))
    );

    return {
      productBlocks: state.productBlocks.map((block) => block.id === id ? rebuildProductBlock(block, update) : block),
      blockPositions: shouldResetPlacement
        ? Object.fromEntries(Object.entries(state.blockPositions).filter(([blockId]) => blockId !== id))
        : state.blockPositions,
      blockRotations: shouldResetPlacement
        ? Object.fromEntries(Object.entries(state.blockRotations).filter(([blockId]) => blockId !== id)) as Record<string, QuarterRotation>
        : state.blockRotations,
    };
  }),
  removeProductBlock: (id) => set((state) => ({
    productBlocks: state.productBlocks.filter((block) => block.id !== id),
    selectedBlockId: state.selectedBlockId === id ? state.productBlocks.find((block) => block.id !== id)?.id ?? null : state.selectedBlockId,
    blockPositions: Object.fromEntries(Object.entries(state.blockPositions).filter(([blockId]) => blockId !== id)),
    blockRotations: Object.fromEntries(Object.entries(state.blockRotations).filter(([blockId]) => blockId !== id)) as Record<string, QuarterRotation>,
  })),
  setProductBlocks: (blocks) => set({ productBlocks: blocks, selectedBlockId: blocks[0]?.id ?? null }),
  createAssembly: (blockIds) => {
    const groupId = `assembly-${nanoidSimple()}`;
    set((state) => ({
      productBlocks: state.productBlocks.map((block) =>
        blockIds.includes(block.id) ? { ...block, groupId } : block
      ),
      blockPositions: {},
      blockRotations: {},
    }));
  },
  dissolveAssembly: (groupId) => set((state) => ({
    productBlocks: state.productBlocks.map((block) => {
      if (block.groupId !== groupId) return block;
      const next = { ...block };
      delete next.groupId;
      return next;
    }),
    blockPositions: Object.fromEntries(
      Object.entries(state.blockPositions).filter(([id]) => id !== groupId)
    ),
    blockRotations: Object.fromEntries(
      Object.entries(state.blockRotations).filter(([id]) => id !== groupId)
    ) as Record<string, QuarterRotation>,
  })),
  blockPositions: {},
  setBlockPositions: (positions) => set({ blockPositions: positions }),
  blockRotations: {},
  setBlockRotations: (rotations) => set({ blockRotations: rotations }),
  roomFeatures: [],
  setRoomFeatures: (features) => set({ roomFeatures: features }),
  addRoomFeature: (kind) => set((state) => ({ roomFeatures: [...state.roomFeatures, createRoomFeature(kind, state.closetConfig)] })),
  updateRoomFeature: (id, update) => set((state) => ({
    roomFeatures: state.roomFeatures.map((feature) => feature.id === id ? { ...feature, ...update } : feature),
  })),
  removeRoomFeature: (id) => set((state) => ({
    roomFeatures: state.roomFeatures.filter((feature) => feature.id !== id),
  })),

  projectName: "Master Walk-In Closet",
  setProjectName: (name) => set({ projectName: name }),
  materialMarkupPct: 45,
  setMaterialMarkupPct: (pct) => set({ materialMarkupPct: pct }),
  laborRatePerFt: 2.92,
  setLaborRatePerFt: (rate) => set({ laborRatePerFt: rate }),
  laborMarkupPct: 50,
  setLaborMarkupPct: (pct) => set({ laborMarkupPct: pct }),

  setDimensions: (d) =>
    set((s) => ({ dimensions: { ...s.dimensions, ...d } })),

  addComponent: (type, x, y) => {
    const palette = PALETTE_ITEMS.find((p) => p.type === type)!;
    const component: ClosetComponent = {
      id: nanoidSimple(),
      type,
      label: palette.label,
      x,
      y,
      w: palette.defaultW,
      h: palette.defaultH,
      color: palette.color,
      priceEach: palette.priceEach,
    };
    set((s) => ({ components: [...s.components, component] }));
  },

  moveComponent: (id, x, y) =>
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id ? { ...c, x, y } : c
      ),
    })),

  resizeComponent: (id, w, h) =>
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id ? { ...c, w, h } : c
      ),
    })),

  removeComponent: (id) =>
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  selectComponent: (id) => set({ selectedId: id }),

  syncCurrentDesign: (snapshot) => {
    const state = get();
    const nextEnabledPieceIds = snapshot.enabledPieceIds ?? state.enabledPieceIds;
    const nextState = {
      dimensions: snapshot.dimensions,
      components: snapshot.components,
      closetConfig: normalizeClosetConfig(snapshot.closetConfig ?? state.closetConfig),
      closetFootprint: snapshot.closetFootprint ?? state.closetFootprint,
      enabledPieceIds: sameStringArray(state.enabledPieceIds, nextEnabledPieceIds)
        ? state.enabledPieceIds
        : nextEnabledPieceIds,
      shelfPositions: snapshot.shelfPositions ?? state.shelfPositions,
      pieceRotations: snapshot.pieceRotations ?? state.pieceRotations,
      productBlocks: snapshot.productBlocks ?? state.productBlocks,
      blockPositions: snapshot.blockPositions ?? state.blockPositions,
      blockRotations: snapshot.blockRotations ?? state.blockRotations,
      roomFeatures: snapshot.roomFeatures ?? state.roomFeatures,
      selectedId: null,
    };

    const unchanged =
      sameJson(state.dimensions, nextState.dimensions) &&
      sameJson(state.components, nextState.components) &&
      sameJson(state.closetConfig, nextState.closetConfig) &&
      sameJson(state.closetFootprint, nextState.closetFootprint) &&
      sameStringArray(state.enabledPieceIds, nextState.enabledPieceIds) &&
      sameJson(state.shelfPositions, nextState.shelfPositions) &&
      sameJson(state.pieceRotations, nextState.pieceRotations) &&
      sameJson(state.productBlocks, nextState.productBlocks) &&
      sameJson(state.blockPositions, nextState.blockPositions) &&
      sameJson(state.blockRotations, nextState.blockRotations) &&
      sameJson(state.roomFeatures, nextState.roomFeatures) &&
      state.selectedId === null;

    if (unchanged) return;

    localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(snapshot));
    set(nextState);
  },

  applySnapshot: (snapshot, options) => {
    if (options?.projectId) {
      localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, options.projectId);
    }

    localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(snapshot));
    set({
      projectId: options?.projectId ?? get().projectId,
      dimensions: snapshot.dimensions,
      components: snapshot.components,
      closetConfig: normalizeClosetConfig(snapshot.closetConfig ?? get().closetConfig),
      closetFootprint: snapshot.closetFootprint ?? get().closetFootprint,
      enabledPieceIds: snapshot.enabledPieceIds ?? get().enabledPieceIds,
      shelfPositions: snapshot.shelfPositions ?? get().shelfPositions,
      pieceRotations: snapshot.pieceRotations ?? get().pieceRotations,
      productBlocks: snapshot.productBlocks ?? get().productBlocks,
      selectedBlockId: snapshot.productBlocks?.[0]?.id ?? get().selectedBlockId,
      blockPositions: snapshot.blockPositions ?? get().blockPositions,
      blockRotations: snapshot.blockRotations ?? get().blockRotations,
      roomFeatures: snapshot.roomFeatures ?? get().roomFeatures,
      selectedId: null,
      persistenceState: "saved",
      persistenceMessage: options?.message ?? "Loaded saved layout.",
    });
  },

  saveDesign: async () => {
    const { dimensions, components, projectId, closetConfig, closetFootprint, enabledPieceIds, shelfPositions, pieceRotations, productBlocks, blockPositions, blockRotations, roomFeatures } = get();
    const snapshot = buildSnapshot(dimensions, components, closetConfig, closetFootprint, enabledPieceIds, shelfPositions, pieceRotations, productBlocks, blockPositions, blockRotations, roomFeatures);

    set({
      persistenceState: "saving",
      persistenceMessage: "Saving design revision...",
    });

    localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(snapshot));

    try {
      if (projectId) {
        await createRemoteRevision(projectId, snapshot);
        set({
          persistenceState: "saved",
          persistenceMessage: "Saved to project history.",
        });
        return;
      }

      const created = await createRemoteProject(snapshot);
      localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, created.projectId);
      set({
        projectId: created.projectId,
        persistenceState: "saved",
        persistenceMessage: "Saved and created a persistent project.",
      });
    } catch (error) {
      console.error("Remote save failed, keeping local draft", error);
      set({
        persistenceState: "error",
        persistenceMessage: "Saved locally. Add DATABASE_URL to persist revisions.",
      });
    }
  },

  loadDesign: async () => {
    set({
      persistenceState: "loading",
      persistenceMessage: "Loading latest design...",
    });

    const storedProjectId =
      get().projectId ?? localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY);

    if (storedProjectId) {
      try {
        const project = await loadRemoteProject(storedProjectId);
        if (project.latestRevision?.snapshot) {
          localStorage.setItem(
            LOCAL_STORAGE_DESIGN_KEY,
            JSON.stringify(project.latestRevision.snapshot)
          );
          get().applySnapshot(project.latestRevision.snapshot, {
            projectId: storedProjectId,
            message: "Loaded from project history.",
          });
          return;
        }
      } catch (error) {
        console.error("Remote load failed, trying local draft", error);
      }
    }

    const raw = localStorage.getItem(LOCAL_STORAGE_DESIGN_KEY);
    if (!raw) {
      set({
        dimensions: SAMPLE_SNAPSHOT.dimensions,
        components: SAMPLE_SNAPSHOT.components,
        closetConfig: normalizeClosetConfig(DEFAULT_CLOSET_CONFIG),
        closetFootprint: buildFootprintFromConfig(normalizeClosetConfig(DEFAULT_CLOSET_CONFIG)),
        enabledPieceIds: DEFAULT_ENABLED_PIECE_IDS,
        shelfPositions: {},
        pieceRotations: {},
        productBlocks: DEFAULT_PRODUCT_BLOCKS,
        selectedBlockId: DEFAULT_PRODUCT_BLOCKS[0]?.id ?? null,
        blockPositions: {},
        blockRotations: {},
        roomFeatures: [],
        selectedId: null,
        persistenceState: "idle",
        persistenceMessage: "Loaded the default walkthrough layout.",
      });
      return;
    }

    const snapshot = JSON.parse(raw) as DesignSnapshot;
    get().applySnapshot(snapshot, {
      message: "Loaded local draft.",
    });
  },

  clearDesign: () =>
    {
      const emptySnapshot = buildSnapshot(get().dimensions, [], get().closetConfig, get().closetFootprint, [], {}, {}, [], {}, {}, []);
      localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(emptySnapshot));
      set({
        components: [],
        enabledPieceIds: [],
        shelfPositions: {},
        pieceRotations: {},
        productBlocks: [],
        selectedBlockId: null,
        blockPositions: {},
        blockRotations: {},
        roomFeatures: [],
        selectedId: null,
        persistenceState: "idle",
        persistenceMessage: "Canvas cleared.",
      });
    },
}));
