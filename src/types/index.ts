import { z } from "zod";

export type ComponentType =
  | "shelf"
  | "hanging-rod"
  | "double-hang"
  | "drawer-unit"
  | "shoe-rack"
  | "corner-shelf";

export interface ClosetComponent {
  id: string;
  type: ComponentType;
  label: string;
  x: number; // grid col (inches from left)
  y: number; // grid row (inches from top)
  w: number; // width in inches
  h: number; // height in inches
  color: string;
  priceEach?: number;
}

export interface ClosetDimensions {
  width: number;  // inches
  height: number; // inches
}

export type SnapshotClosetShape = "straight" | "left" | "right" | "u" | "walk-in";

export interface SnapshotClosetConfig {
  width: number;
  height: number;
  depth: number;
  shelfDepth: number;
  shelfHeight: number;
  leftReturn: number;
  rightReturn: number;
  rightOffset: number;
  frontStubDepth: number;
  frontLeftStubDepth?: number;
  frontRightStubDepth?: number;
  shape: SnapshotClosetShape;
}

export type FootprintPointType =
  | "left-jamb"
  | "right-jamb"
  | "corner"
  | "inside-corner"
  | "column";

export interface FootprintPoint {
  id: string;
  x: number;
  y: number;
  type: FootprintPointType;
}

export interface FootprintWall {
  from: string;
  to: string;
  label: string;
}

export interface MeasuredFootprint {
  source: "preset" | "manual" | "mock-ar" | "ar";
  units: "in";
  points: FootprintPoint[];
  walls: FootprintWall[];
  opening: {
    leftJambId: string;
    rightJambId: string;
    width: number;
  };
  confidence: number;
}

export type RoomFeatureKind = "column" | "air-register" | "access-panel";
export type RoomFeatureBehavior = "obstruction" | "clearance-zone" | "mountable-surface";

export interface RoomFeature {
  id: string;
  kind: RoomFeatureKind;
  label: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  rotation: 0 | 90;
  behavior: RoomFeatureBehavior;
}

export interface PaletteItem {
  type: ComponentType;
  label: string;
  defaultW: number;
  defaultH: number;
  color: string;
  icon: string;
  description: string;
  priceEach: number;
}

export type ProductLine = "freedomRail" | "select";
export type ProductBlockKind = "shelf-rod" | "double-hang" | "drawer-stack" | "shoe-tower" | "open-shelves";
export type ProductBlockPartType = "rail" | "upright" | "shelf" | "rod" | "drawer" | "shoe-shelf" | "panel";

export interface ProductBlockPart {
  id: string;
  type: ProductBlockPartType;
  label: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export interface ProductBlock {
  id: string;
  groupId?: string;
  name: string;
  kind: ProductBlockKind;
  productLine: ProductLine;
  finish: string;
  width: number;
  height: number;
  depth: number;
  parts: ProductBlockPart[];
  price: number;
}

export type MaterialLineCategory = "manufactured" | "hardware" | "install";

export interface MaterialLine {
  id: string;
  sku: string;
  name: string;
  category: MaterialLineCategory;
  qty: number;
  unit: "each" | "ft" | "pack" | "set";
  unitPrice: number;
  note: string;
}

export interface DesignSnapshot {
  dimensions: ClosetDimensions;
  components: ClosetComponent[];
  closetConfig?: SnapshotClosetConfig;
  closetFootprint?: MeasuredFootprint;
  enabledPieceIds?: string[];
  shelfPositions?: Record<string, [number, number, number]>;
  pieceRotations?: Record<string, 0 | 90 | 180 | 270>;
  productBlocks?: ProductBlock[];
  blockPositions?: Record<string, [number, number, number]>;
  blockRotations?: Record<string, 0 | 90 | 180 | 270>;
  roomFeatures?: RoomFeature[];
}

export const ComponentTypeSchema = z.enum([
  "shelf",
  "hanging-rod",
  "double-hang",
  "drawer-unit",
  "shoe-rack",
  "corner-shelf",
]);

export const ClosetComponentSchema = z.object({
  id: z.string(),
  type: ComponentTypeSchema,
  label: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  color: z.string(),
  priceEach: z.number().optional(),
});

export const ClosetDimensionsSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const SnapshotClosetConfigSchema = z.object({
  width: z.number(),
  height: z.number(),
  depth: z.number(),
  shelfDepth: z.number(),
  shelfHeight: z.number(),
  leftReturn: z.number(),
  rightReturn: z.number(),
  rightOffset: z.number(),
  frontStubDepth: z.number(),
  frontLeftStubDepth: z.number().optional(),
  frontRightStubDepth: z.number().optional(),
  shape: z.enum(["straight", "left", "right", "u", "walk-in"]),
});

export const FootprintPointSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  type: z.enum(["left-jamb", "right-jamb", "corner", "inside-corner", "column"]),
});

export const FootprintWallSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

export const MeasuredFootprintSchema = z.object({
  source: z.enum(["preset", "manual", "mock-ar", "ar"]),
  units: z.literal("in"),
  points: z.array(FootprintPointSchema),
  walls: z.array(FootprintWallSchema),
  opening: z.object({
    leftJambId: z.string(),
    rightJambId: z.string(),
    width: z.number(),
  }),
  confidence: z.number(),
});

export const RoomFeatureSchema = z.object({
  id: z.string(),
  kind: z.enum(["column", "air-register", "access-panel"]),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  depth: z.number(),
  height: z.number(),
  elevation: z.number(),
  rotation: z.union([z.literal(0), z.literal(90)]).optional().default(0),
  behavior: z.enum(["obstruction", "clearance-zone", "mountable-surface"]),
});

export const ProductBlockPartSchema = z.object({
  id: z.string(),
  type: z.enum(["rail", "upright", "shelf", "rod", "drawer", "shoe-shelf", "panel"]),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  width: z.number(),
  height: z.number(),
  depth: z.number(),
});

export const ProductBlockSchema = z.object({
  id: z.string(),
  groupId: z.string().optional(),
  name: z.string(),
  kind: z.enum(["shelf-rod", "double-hang", "drawer-stack", "shoe-tower", "open-shelves"]),
  productLine: z.enum(["freedomRail", "select"]),
  finish: z.string(),
  width: z.number(),
  height: z.number(),
  depth: z.number(),
  parts: z.array(ProductBlockPartSchema),
  price: z.number(),
});

export const DesignSnapshotSchema = z.object({
  dimensions: ClosetDimensionsSchema,
  components: z.array(ClosetComponentSchema),
  closetConfig: SnapshotClosetConfigSchema.optional(),
  closetFootprint: MeasuredFootprintSchema.optional(),
  enabledPieceIds: z.array(z.string()).optional(),
  shelfPositions: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])).optional(),
  pieceRotations: z.record(z.string(), z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])).optional(),
  productBlocks: z.array(ProductBlockSchema).optional(),
  blockPositions: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])).optional(),
  blockRotations: z.record(z.string(), z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])).optional(),
  roomFeatures: z.array(RoomFeatureSchema).optional(),
});

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: "shelf",
    label: "Shelf",
    defaultW: 36,
    defaultH: 2,
    color: "#d4a96a",
    icon: "shelf",
    description: "Adjustable wood shelf",
    priceEach: 45,
  },
  {
    type: "hanging-rod",
    label: "Hanging Rod",
    defaultW: 36,
    defaultH: 36,
    color: "#6b9fd4",
    icon: "rod",
    description: "Single hang section",
    priceEach: 65,
  },
  {
    type: "double-hang",
    label: "Double Hang",
    defaultW: 36,
    defaultH: 72,
    color: "#7bc4e2",
    icon: "double",
    description: "Two-tier hanging section",
    priceEach: 110,
  },
  {
    type: "drawer-unit",
    label: "Drawer Unit",
    defaultW: 24,
    defaultH: 36,
    color: "#b5a0d4",
    icon: "drawers",
    description: "4-drawer organizer unit",
    priceEach: 195,
  },
  {
    type: "shoe-rack",
    label: "Shoe Rack",
    defaultW: 24,
    defaultH: 12,
    color: "#f4a460",
    icon: "shoes",
    description: "Angled shoe shelf",
    priceEach: 55,
  },
  {
    type: "corner-shelf",
    label: "Corner Tower",
    defaultW: 24,
    defaultH: 72,
    color: "#8fbc8f",
    icon: "tower",
    description: "Tall corner tower unit",
    priceEach: 245,
  },
];
