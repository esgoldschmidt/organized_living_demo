"use client";
import { useEffect, useRef, useState } from "react";
import { useDesignStore } from "@/store/designStore";
import { Save, FolderOpen, Trash2, Download } from "lucide-react";
import { DesignSnapshot } from "@/types";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface SavedRevision {
  id: string;
  revisionNumber: number;
  name: string;
  createdAt: string;
  componentCount: number;
  totalPrice: number;
  snapshot: DesignSnapshot;
}

interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  revisions: SavedRevision[];
}

export default function Toolbar() {
  const {
    saveDesign,
    loadDesign,
    clearDesign,
    applySnapshot,
    components,
    dimensions,
    closetConfig,
    closetFootprint,
    enabledPieceIds,
    shelfPositions,
    pieceRotations,
    productBlocks,
    blockPositions,
    blockRotations,
    roomFeatures,
    projectId,
    persistenceState,
    persistenceMessage,
  } = useDesignStore();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const lastToastMessageRef = useRef<string | null>(null);

  const pushToast = (message: string, tone: ToastTone) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  useEffect(() => {
    void loadDesign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!persistenceMessage) {
      return;
    }

    const shouldToast =
      persistenceState === "saved" ||
      persistenceState === "error";

    if (!shouldToast || lastToastMessageRef.current === persistenceMessage) {
      return;
    }

    lastToastMessageRef.current = persistenceMessage;
    pushToast(
      persistenceMessage,
      persistenceState === "error" ? "error" : "success"
    );
  }, [persistenceMessage, persistenceState]);

  const exportJSON = () => {
    const data = JSON.stringify({ dimensions, components, closetConfig, closetFootprint, enabledPieceIds, shelfPositions, pieceRotations, productBlocks, blockPositions, blockRotations, roomFeatures }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "closet-design.json";
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Exported the current layout as JSON.", "success");
  };

  const openLoadModal = async () => {
    setShowLoadModal(true);
    setLoadingLayouts(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch saved layouts");
      }

      const data = (await response.json()) as { projects: SavedProject[] };
      setSavedProjects(data.projects);
    } catch (error) {
      console.error("Failed to fetch saved layouts", error);
      setLoadError("Couldn’t load saved layouts right now.");
    } finally {
      setLoadingLayouts(false);
    }
  };

  const handleLoadRevision = (savedProject: SavedProject, revision: SavedRevision) => {
    applySnapshot(revision.snapshot, {
      projectId: savedProject.id,
      message: `Loaded ${savedProject.name} · Revision ${revision.revisionNumber}.`,
    });
    setShowLoadModal(false);
    pushToast(`Loaded ${savedProject.name} · Revision ${revision.revisionNumber}.`, "success");
  };

  const handleClearConfirm = () => {
    clearDesign();
    setShowClearModal(false);
    pushToast("Canvas cleared.", "info");
  };

  return (
    <>
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-[var(--panel-border)] bg-[var(--panel-strong)] px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#4d8d60,#2f6841)] shadow-[0_10px_24px_rgba(47,104,65,0.28)]">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-white fill-current">
              <rect x="2" y="10" width="16" height="2" rx="1" />
              <rect x="4" y="4" width="12" height="2" rx="1" />
              <rect x="5" y="12" width="1.5" height="5" />
              <rect x="13.5" y="12" width="1.5" height="5" />
            </svg>
          </div>
          <div>
            <h1 className="leading-none text-sm font-bold text-stone-900">Design Tool</h1>
            <p className="mt-0.5 text-xs leading-none text-stone-500">Closet Planner</p>
          </div>
          <div className="ml-4 h-5 w-px bg-stone-200" />
          <span className="text-xs text-stone-500">
            {components.length} component{components.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            {dimensions.width}&quot; × {dimensions.height}&quot; closet
          </span>
          <div className="hidden rounded-full border border-stone-200 bg-white/70 px-2.5 py-1 text-[11px] text-stone-500 md:block">
            {projectId ? `Project ${projectId.slice(-6)}` : "Local draft"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void saveDesign()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-white"
          >
            <Save size={13} />
            Save
          </button>
          <button
            onClick={() => void openLoadModal()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-white"
          >
            <FolderOpen size={13} />
            Load
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-white"
          >
            <Download size={13} />
            Export
          </button>
          <div className="h-5 w-px bg-stone-200" />
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </header>

      {showClearModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(43,31,21,0.32)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-[rgba(255,250,245,0.96)] p-6 shadow-[0_28px_60px_rgba(50,34,20,0.28)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Clear Canvas
            </p>
            <h2 className="mt-3 text-xl font-semibold text-stone-900">
              Remove all placed components?
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              This will empty the current canvas. Your saved layouts will still be available from Load.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConfirm}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(43,31,21,0.32)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-[rgba(255,250,245,0.97)] p-6 shadow-[0_28px_60px_rgba(50,34,20,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Saved Layouts
                </p>
                <h2 className="mt-3 text-xl font-semibold text-stone-900">
                  Choose a saved revision to load
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Each save creates a revision. Pick the exact layout you want to bring back onto the canvas.
                </p>
              </div>
              <button
                onClick={() => setShowLoadModal(false)}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 max-h-[28rem] overflow-y-auto pr-1">
              {loadingLayouts && (
                <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-6 text-sm text-stone-500">
                  Loading saved layouts...
                </div>
              )}

              {!loadingLayouts && loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-4 text-sm text-red-700">
                  {loadError}
                </div>
              )}

              {!loadingLayouts && !loadError && savedProjects.length === 0 && (
                <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-6 text-sm text-stone-500">
                  No saved layouts yet. Save the canvas to create your first revision.
                </div>
              )}

              {!loadingLayouts && !loadError && savedProjects.length > 0 && (
                <div className="space-y-4">
                  {savedProjects.map((savedProject) => (
                    <div
                      key={savedProject.id}
                      className="rounded-3xl border border-stone-200 bg-white/80 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-stone-900">
                            {savedProject.name}
                          </h3>
                          <p className="mt-1 text-xs text-stone-500">
                            Updated {new Date(savedProject.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-500">
                          {savedProject.revisions.length} revision{savedProject.revisions.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {savedProject.revisions.map((revision) => (
                          <button
                            key={revision.id}
                            onClick={() => handleLoadRevision(savedProject, revision)}
                            className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-[rgba(252,249,245,0.9)] px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60"
                          >
                            <div>
                              <p className="text-sm font-medium text-stone-800">
                                Revision {revision.revisionNumber}
                                <span className="ml-2 text-stone-500">{revision.name}</span>
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {revision.componentCount} components · ${revision.totalPrice} · {new Date(revision.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
                              Load
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute right-5 top-20 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(62,44,28,0.18)] backdrop-blur-md ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                : toast.tone === "error"
                  ? "border-red-200 bg-red-50/95 text-red-900"
                  : "border-stone-200 bg-white/95 text-stone-800"
            }`}
          >
            <p className="text-sm font-medium leading-5">{toast.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
