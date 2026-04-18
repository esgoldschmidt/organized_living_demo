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
  shape: SnapshotClosetShape;
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

export interface DesignSnapshot {
  dimensions: ClosetDimensions;
  components: ClosetComponent[];
  closetConfig?: SnapshotClosetConfig;
  enabledPieceIds?: string[];
  shelfPositions?: Record<string, [number, number, number]>;
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
  shape: z.enum(["straight", "left", "right", "u", "walk-in"]),
});

export const DesignSnapshotSchema = z.object({
  dimensions: ClosetDimensionsSchema,
  components: z.array(ClosetComponentSchema),
  closetConfig: SnapshotClosetConfigSchema.optional(),
  enabledPieceIds: z.array(z.string()).optional(),
  shelfPositions: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])).optional(),
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
