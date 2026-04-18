import { create } from "zustand";
import {
  ClosetComponent,
  ClosetDimensions,
  ComponentType,
  DesignSnapshot,
  MeasuredFootprint,
  PALETTE_ITEMS,
} from "@/types";

export type ClosetShape = "straight" | "left" | "right" | "u" | "walk-in";
export type ShelfPositions = Record<string, [number, number, number]>;

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
  shape: "walk-in",
};

export function buildFootprintFromConfig(config: ClosetConfig, source: MeasuredFootprint["source"] = "preset"): MeasuredFootprint {
  const openingWidth = config.shape === "walk-in"
    ? Math.max(24, config.width - config.frontStubDepth * 2)
    : config.width;
  const leftJambX = config.shape === "walk-in" ? config.frontStubDepth : 0;
  const rightJambX = config.shape === "walk-in" ? config.width - config.frontStubDepth : config.width;
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
  const points: MeasuredFootprint["points"] = [
    { id: "left-jamb", x: config.frontStubDepth, y: config.depth, type: "left-jamb" },
    { id: "front-left", x: 0, y: config.depth, type: "corner" },
    { id: "left-back", x: 0, y: 0, type: "corner" },
    { id: "jog-in", x: 42, y: 0, type: "inside-corner" },
    { id: "column-face", x: 42, y: 14, type: "column" },
    { id: "jog-out", x: 58, y: 14, type: "inside-corner" },
    { id: "back-right", x: config.width, y: 0, type: "corner" },
    { id: "front-right", x: config.width, y: config.depth, type: "corner" },
    { id: "right-jamb", x: config.width - config.frontStubDepth, y: config.depth, type: "right-jamb" },
  ];

  return {
    source: "mock-ar",
    units: "in",
    points,
    walls: points.slice(0, -1).map((point, index) => ({
      from: point.id,
      to: points[index + 1].id,
      label: index === 2 || index === 4 ? "column jog" : index === 5 ? "back wall" : "measured wall",
    })),
    opening: {
      leftJambId: "left-jamb",
      rightJambId: "right-jamb",
      width: Math.round(config.width - config.frontStubDepth * 2),
    },
    confidence: 0.84,
  };
}
const DEFAULT_ENABLED_PIECE_IDS = [
  "back-left-tower",
  "back-right-tower",
  "center-drawers",
  "center-shelves",
  "left-rod",
  "left-shelves",
  "right-double-rod",
  "right-shelves",
];

const LOCAL_STORAGE_DESIGN_KEY = "closet-design";
const LOCAL_STORAGE_PROJECT_KEY = "closet-project-id";

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
}

function buildSnapshot(
  dimensions: ClosetDimensions,
  components: ClosetComponent[],
  closetConfig: ClosetConfig,
  closetFootprint: MeasuredFootprint,
  enabledPieceIds: string[],
  shelfPositions: ShelfPositions
): DesignSnapshot {
  return { dimensions, components, closetConfig, closetFootprint, enabledPieceIds, shelfPositions };
}

function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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

  closetConfig: DEFAULT_CLOSET_CONFIG,
  setClosetConfig: (update) => set((s) => {
    const closetConfig = { ...s.closetConfig, ...update };
    const shouldRegenerateFootprint =
      update.shape !== undefined ||
      update.width !== undefined ||
      update.depth !== undefined ||
      update.frontStubDepth !== undefined;

    return {
      closetConfig,
      closetFootprint: shouldRegenerateFootprint
        ? buildFootprintFromConfig(closetConfig)
        : s.closetFootprint,
    };
  }),
  closetFootprint: buildFootprintFromConfig(DEFAULT_CLOSET_CONFIG),
  setClosetFootprint: (footprint) => set((s) => {
    const xs = footprint.points.map((point) => point.x);
    const ys = footprint.points.map((point) => point.y);
    const width = Math.max(60, Math.round(Math.max(...xs) - Math.min(...xs)));
    const depth = Math.max(20, Math.round(Math.max(...ys) - Math.min(...ys)));

    return {
      closetFootprint: footprint,
      closetConfig: {
        ...s.closetConfig,
        width,
        depth,
        shape: "walk-in",
      },
    };
  }),
  enabledPieceIds: DEFAULT_ENABLED_PIECE_IDS,
  setEnabledPieceIds: (ids) => set({ enabledPieceIds: ids }),
  shelfPositions: {},
  setShelfPositions: (positions) => set({ shelfPositions: positions }),

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

  syncCurrentDesign: (snapshot) =>
    set((state) => {
      const nextEnabledPieceIds = snapshot.enabledPieceIds ?? state.enabledPieceIds;

      return {
        dimensions: snapshot.dimensions,
        components: snapshot.components,
        closetConfig: snapshot.closetConfig ?? state.closetConfig,
        closetFootprint: snapshot.closetFootprint ?? state.closetFootprint,
        enabledPieceIds: sameStringArray(state.enabledPieceIds, nextEnabledPieceIds)
          ? state.enabledPieceIds
          : nextEnabledPieceIds,
        shelfPositions: snapshot.shelfPositions ?? state.shelfPositions,
        selectedId: null,
      };
    }),

  applySnapshot: (snapshot, options) => {
    if (options?.projectId) {
      localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, options.projectId);
    }

    localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(snapshot));
    set({
      projectId: options?.projectId ?? get().projectId,
      dimensions: snapshot.dimensions,
      components: snapshot.components,
      closetConfig: snapshot.closetConfig ?? get().closetConfig,
      closetFootprint: snapshot.closetFootprint ?? get().closetFootprint,
      enabledPieceIds: snapshot.enabledPieceIds ?? get().enabledPieceIds,
      shelfPositions: snapshot.shelfPositions ?? get().shelfPositions,
      selectedId: null,
      persistenceState: "saved",
      persistenceMessage: options?.message ?? "Loaded saved layout.",
    });
  },

  saveDesign: async () => {
    const { dimensions, components, projectId, closetConfig, closetFootprint, enabledPieceIds, shelfPositions } = get();
    const snapshot = buildSnapshot(dimensions, components, closetConfig, closetFootprint, enabledPieceIds, shelfPositions);

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
        closetConfig: DEFAULT_CLOSET_CONFIG,
        closetFootprint: buildFootprintFromConfig(DEFAULT_CLOSET_CONFIG),
        enabledPieceIds: DEFAULT_ENABLED_PIECE_IDS,
        shelfPositions: {},
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
      const emptySnapshot = buildSnapshot(get().dimensions, [], get().closetConfig, get().closetFootprint, [], {});
      localStorage.setItem(LOCAL_STORAGE_DESIGN_KEY, JSON.stringify(emptySnapshot));
      set({
        components: [],
        enabledPieceIds: [],
        shelfPositions: {},
        selectedId: null,
        persistenceState: "idle",
        persistenceMessage: "Canvas cleared.",
      });
    },
}));
