import { create } from "zustand";
import {
  ClosetComponent,
  ClosetDimensions,
  ComponentType,
  DesignSnapshot,
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
  enabledPieceIds: string[];
  setEnabledPieceIds: (ids: string[]) => void;
  shelfPositions: ShelfPositions;
  setShelfPositions: (positions: ShelfPositions) => void;
}

function buildSnapshot(
  dimensions: ClosetDimensions,
  components: ClosetComponent[],
  closetConfig: ClosetConfig,
  enabledPieceIds: string[],
  shelfPositions: ShelfPositions
): DesignSnapshot {
  return { dimensions, components, closetConfig, enabledPieceIds, shelfPositions };
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
  setClosetConfig: (update) => set((s) => ({ closetConfig: { ...s.closetConfig, ...update } })),
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
      enabledPieceIds: snapshot.enabledPieceIds ?? get().enabledPieceIds,
      shelfPositions: snapshot.shelfPositions ?? get().shelfPositions,
      selectedId: null,
      persistenceState: "saved",
      persistenceMessage: options?.message ?? "Loaded saved layout.",
    });
  },

  saveDesign: async () => {
    const { dimensions, components, projectId, closetConfig, enabledPieceIds, shelfPositions } = get();
    const snapshot = buildSnapshot(dimensions, components, closetConfig, enabledPieceIds, shelfPositions);

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
      const emptySnapshot = buildSnapshot(get().dimensions, [], get().closetConfig, [], {});
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
