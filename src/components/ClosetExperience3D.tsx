"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const CLOSET_WIDTH = 96;
const CLOSET_HEIGHT = 96;
const CLOSET_DEPTH = 30;
const SHELF_DEPTH = 14;
const SHELF_THICKNESS = 1.5;
const SHELF_HEIGHT = 72;
const LEFT_RETURN = 36;
const RIGHT_RETURN = 36;
const WALL_THICKNESS = 0.75;

type ViewMode = "closet" | "ar" | "inspection";
type ValidationStatus = "valid" | "warning" | "error";

interface ShelfValidation {
  status: ValidationStatus;
  message: string;
  detail: string;
}

interface ShelfComponent {
  id: string;
  name: string;
  validation: ShelfValidation;
  position: [number, number, number];
  dimensions: [number, number, number];
}

const statusCopy: Record<ValidationStatus, { label: string; color: string; soft: string }> = {
  valid: { label: "Recommended", color: "#1f9d72", soft: "rgba(31,157,114,0.12)" },
  warning: { label: "Watch", color: "#c88a18", soft: "rgba(200,138,24,0.14)" },
  error: { label: "Adjust", color: "#d94b45", soft: "rgba(217,75,69,0.14)" },
};

const shelves: ShelfComponent[] = [
  {
    id: "back",
    name: "Back Shelf",
    validation: {
      status: "valid",
      message: "Recommended placement",
      detail: "12 in storage clearance preserved",
    },
    position: [0, SHELF_HEIGHT, -CLOSET_DEPTH / 2 + SHELF_DEPTH / 2],
    dimensions: [CLOSET_WIDTH - 4, SHELF_THICKNESS, SHELF_DEPTH],
  },
  {
    id: "left",
    name: "Left Return",
    validation: {
      status: "warning",
      message: "Clearance is tight",
      detail: "Passes, but upper storage feels constrained",
    },
    position: [-CLOSET_WIDTH / 2 + LEFT_RETURN / 2, SHELF_HEIGHT, 0],
    dimensions: [LEFT_RETURN, SHELF_THICKNESS, SHELF_DEPTH],
  },
  {
    id: "right",
    name: "Right Return",
    validation: {
      status: "error",
      message: "Off grid by 2 in",
      detail: "Move to the next 6 in planning grid",
    },
    position: [CLOSET_WIDTH / 2 - RIGHT_RETURN / 2 + 2, SHELF_HEIGHT, 0],
    dimensions: [RIGHT_RETURN, SHELF_THICKNESS, SHELF_DEPTH],
  },
];

function getStatus(status: ValidationStatus) {
  return statusCopy[status];
}

function ClosetRoom({ mode }: { mode: ViewMode }) {
  const wallOpacity = mode === "ar" ? 0.08 : mode === "inspection" ? 0.34 : 0.72;
  const ceilingOpacity = mode === "ar" ? 0.04 : 0.42;

  return (
    <group>
      <mesh position={[0, CLOSET_HEIGHT / 2, -CLOSET_DEPTH / 2 - WALL_THICKNESS / 2]} receiveShadow>
        <boxGeometry args={[CLOSET_WIDTH, CLOSET_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#f1f4f0" opacity={wallOpacity} transparent roughness={0.82} />
      </mesh>

      <mesh position={[-CLOSET_WIDTH / 2 - WALL_THICKNESS / 2, CLOSET_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, CLOSET_HEIGHT, CLOSET_DEPTH]} />
        <meshStandardMaterial color="#e7ece8" opacity={wallOpacity} transparent roughness={0.86} />
      </mesh>

      <mesh position={[CLOSET_WIDTH / 2 + WALL_THICKNESS / 2, CLOSET_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, CLOSET_HEIGHT, CLOSET_DEPTH]} />
        <meshStandardMaterial color="#e7ece8" opacity={wallOpacity} transparent roughness={0.86} />
      </mesh>

      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[CLOSET_WIDTH + 2, 0.5, CLOSET_DEPTH + 2]} />
        <meshStandardMaterial color="#d7ddd7" roughness={0.9} />
      </mesh>

      <mesh position={[0, CLOSET_HEIGHT + 0.25, 0]}>
        <boxGeometry args={[CLOSET_WIDTH + 2, 0.5, CLOSET_DEPTH + 2]} />
        <meshStandardMaterial color="#f5f7f4" opacity={ceilingOpacity} transparent roughness={0.8} />
      </mesh>
    </group>
  );
}

function Shelf({
  shelf,
  selected,
  onSelect,
}: {
  shelf: ShelfComponent;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = getStatus(shelf.validation.status).color;
  const intensity = selected || hovered ? 0.38 : 0.14;

  return (
    <group position={shelf.position}>
      <mesh
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect(shelf.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={shelf.dimensions} />
        <meshStandardMaterial color={selected || hovered ? "#77887f" : "#63756d"} roughness={0.64} />
      </mesh>

      <mesh position={[0, shelf.dimensions[1] / 2 + 0.11, 0]}>
        <boxGeometry args={[shelf.dimensions[0], 0.22, shelf.dimensions[2]]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={intensity} transparent opacity={0.82} />
      </mesh>

      <mesh position={[-shelf.dimensions[0] / 2 + 5, -8, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 15, 1.2]} />
        <meshStandardMaterial color="#3d4842" roughness={0.72} />
      </mesh>
      <mesh position={[shelf.dimensions[0] / 2 - 5, -8, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 15, 1.2]} />
        <meshStandardMaterial color="#3d4842" roughness={0.72} />
      </mesh>
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
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end}>
        <sphereGeometry args={[0.6, 12, 12]} />
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
        style={{
          borderColor: status.color,
          background: "rgba(255,255,255,0.88)",
          color: "#1e2522",
        }}
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
  selectedShelf,
  showMeasurements,
  onSelectShelf,
}: {
  mode: ViewMode;
  selectedShelf: string | null;
  showMeasurements: boolean;
  onSelectShelf: (id: string | null) => void;
}) {
  const selected = shelves.find((shelf) => shelf.id === selectedShelf);
  const showDetail = showMeasurements && mode !== "ar";
  const showEssential = showMeasurements && mode === "ar";

  return (
    <group onPointerMissed={() => onSelectShelf(null)}>
      {shelves.map((shelf) => (
        <Shelf key={shelf.id} shelf={shelf} selected={selectedShelf === shelf.id} onSelect={onSelectShelf} />
      ))}

      {shelves.map((shelf) => (
        <ValidationBadge
          key={`${shelf.id}-badge`}
          shelf={shelf}
          visible={mode === "inspection" || selectedShelf === shelf.id}
        />
      ))}

      {(showDetail || showEssential) && (
        <>
          <MeasurementLine
            start={[-CLOSET_WIDTH / 2 - 7, 0, -CLOSET_DEPTH / 2 - 3]}
            end={[-CLOSET_WIDTH / 2 - 7, CLOSET_HEIGHT, -CLOSET_DEPTH / 2 - 3]}
            label="96 in floor to ceiling"
            labelOffset={[-7, 0, 0]}
          />
          <MeasurementLine
            start={[-CLOSET_WIDTH / 2 + 2, SHELF_HEIGHT + 4, -CLOSET_DEPTH / 2 + SHELF_DEPTH / 2]}
            end={[CLOSET_WIDTH / 2 - 2, SHELF_HEIGHT + 4, -CLOSET_DEPTH / 2 + SHELF_DEPTH / 2]}
            label="92 in edge to edge"
          />
          <MeasurementLine
            start={[CLOSET_WIDTH / 2 + 5, SHELF_HEIGHT, -CLOSET_DEPTH / 2]}
            end={[CLOSET_WIDTH / 2 + 5, SHELF_HEIGHT, -CLOSET_DEPTH / 2 + SHELF_DEPTH]}
            label="14 in shelf depth"
            labelOffset={[7, 0, 0]}
          />
        </>
      )}

      {showDetail && (
        <>
          <MeasurementLine
            start={[-CLOSET_WIDTH / 2 - 1, 0, -CLOSET_DEPTH / 2 + 4]}
            end={[-CLOSET_WIDTH / 2 - 1, SHELF_HEIGHT, -CLOSET_DEPTH / 2 + 4]}
            label="72 in shelf height"
            color="#48544f"
            labelOffset={[-8, 0, 0]}
          />
          <MeasurementLine
            start={[0, SHELF_HEIGHT + SHELF_THICKNESS / 2, 2]}
            end={[0, CLOSET_HEIGHT, 2]}
            label="24 in open storage"
            color="#1f9d72"
            labelOffset={[0, 0, 5]}
          />
          <MeasurementLine
            start={[-CLOSET_WIDTH / 2, SHELF_HEIGHT + 7, 1.5]}
            end={[-CLOSET_WIDTH / 2 + LEFT_RETURN, SHELF_HEIGHT + 7, 1.5]}
            label="36 in left return"
            color="#c88a18"
          />
          <MeasurementLine
            start={[CLOSET_WIDTH / 2 - RIGHT_RETURN + 2, SHELF_HEIGHT + 7, 1.5]}
            end={[CLOSET_WIDTH / 2 + 2, SHELF_HEIGHT + 7, 1.5]}
            label="36 in right return"
            color="#d94b45"
          />
          <MeasurementLine
            start={[CLOSET_WIDTH / 2 + 7, SHELF_HEIGHT - SHELF_THICKNESS / 2, 0]}
            end={[CLOSET_WIDTH / 2 + 7, SHELF_HEIGHT + SHELF_THICKNESS / 2, 0]}
            label="1.5 in shelf"
            color="#48544f"
            labelOffset={[7, 0, 0]}
          />
        </>
      )}

      {mode === "inspection" && selected && (
        <Html position={[0, 44, 18]} center distanceFactor={20}>
          <div className="w-60 rounded-md border border-[#d8dfd8] bg-white/90 p-3 text-xs text-[#25302c] shadow-xl backdrop-blur-md">
            <div className="mb-1 text-sm font-semibold">{selected.name}</div>
            <div>{selected.validation.detail}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraRig({ mode, selectedShelf }: { mode: ViewMode; selectedShelf: string | null }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const selected = shelves.find((shelf) => shelf.id === selectedShelf);

    if (selected && mode === "inspection") {
      target.set(selected.position[0], selected.position[1] + 3, selected.position[2]);
      destination.set(selected.position[0] + 44, selected.position[1] - 10, selected.position[2] + 58);
    } else if (mode === "ar") {
      target.set(0, 56, -2);
      destination.set(78, 58, 96);
    } else if (mode === "inspection") {
      target.set(0, SHELF_HEIGHT, -4);
      destination.set(52, 58, 78);
    } else {
      target.set(0, 54, -3);
      destination.set(112, 82, 122);
    }

    camera.position.lerp(destination, 0.035);
    camera.lookAt(target);
  });

  useEffect(() => {
    camera.position.set(112, 82, 122);
    camera.lookAt(0, 54, -3);
  }, [camera]);

  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.58} />
      <directionalLight
        position={[40, 120, 70]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-42, 70, 32]} intensity={0.42} color="#f7fff7" />
      <pointLight position={[56, 44, 48]} intensity={0.28} color="#fff4ee" />
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
  children: React.ReactNode;
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

export default function ClosetExperience3D() {
  const [mode, setMode] = useState<ViewMode>("closet");
  const [selectedShelf, setSelectedShelf] = useState<string | null>("back");
  const [showMeasurements, setShowMeasurements] = useState(true);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#f6f8f5] text-[#1f2824]">
      <div className="flex flex-col gap-4 border-b border-[#d8dfd8] bg-white/86 px-4 py-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex rounded-md border border-[#cbd6ce] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#48645a]">
            Premium 3D Design Concept
          </div>
          <h1 className="text-xl font-semibold leading-tight text-[#1f2824] md:text-2xl">U-shaped shelf system</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#53635d]">
            Measurements, clearance, and planning-grid feedback stay tied to the model while the room shifts from closet to AR view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#d8dfd8] bg-[#eef3ee] p-1">
            <ModeButton mode="closet" current={mode} onClick={setMode}>
              Closet
            </ModeButton>
            <ModeButton mode="ar" current={mode} onClick={setMode}>
              AR
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <div className="relative min-h-[520px] flex-1 overflow-hidden bg-[#e9efea]">
          <Canvas shadows camera={{ position: [112, 82, 122], fov: 46 }} dpr={[1, 1.7]}>
            <color attach="background" args={["#e9efea"]} />
            <fog attach="fog" args={["#e9efea", 135, 260]} />
            <Lights />
            <CameraRig mode={mode} selectedShelf={selectedShelf} />
            <ClosetRoom mode={mode} />
            <ShelfSystem
              mode={mode}
              selectedShelf={selectedShelf}
              showMeasurements={showMeasurements}
              onSelectShelf={setSelectedShelf}
            />
            <OrbitControls
              enableDamping
              dampingFactor={0.08}
              makeDefault
              minDistance={52}
              maxDistance={190}
              minPolarAngle={Math.PI / 5}
              maxPolarAngle={Math.PI / 2.05}
              rotateSpeed={0.38}
              zoomSpeed={0.55}
              panSpeed={0.4}
              target={[0, 54, -3]}
            />
            <gridHelper args={[150, 25, "#aab7ae", "#d4ded6"]} position={[0, -0.48, 0]} />
          </Canvas>

          <div className="pointer-events-none absolute left-4 top-4 max-w-sm rounded-md border border-white/60 bg-white/78 p-3 text-xs leading-5 text-[#41504a] shadow-lg backdrop-blur-md">
            <span className="font-semibold text-[#1f2824]">Slow orbit enabled.</span> Drag to turn the model, scroll to zoom, or choose Inspect for component-level feedback.
          </div>
        </div>

        <aside className="w-full border-t border-[#d8dfd8] bg-white p-5 xl:w-86 xl:border-l xl:border-t-0">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#1f2824]">Design intelligence</h2>
            <p className="mt-1 text-sm leading-6 text-[#5b6a64]">
              Rules read as quiet guidance: grid fit, useful upper clearance, and recommended placement.
            </p>
          </div>

          <div className="space-y-3">
            {shelves.map((shelf) => {
              const status = getStatus(shelf.validation.status);
              const active = selectedShelf === shelf.id;

              return (
                <button
                  type="button"
                  key={shelf.id}
                  onClick={() => {
                    setSelectedShelf(shelf.id);
                    setMode("inspection");
                  }}
                  className={`w-full rounded-md border p-4 text-left transition ${
                    active ? "border-[#25302c] bg-[#f6f8f5]" : "border-[#d8dfd8] bg-white hover:bg-[#f6f8f5]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#25302c]">{shelf.name}</span>
                    <span
                      className="rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{ color: status.color, backgroundColor: status.soft }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#53635d]">{shelf.validation.message}</p>
                  <p className="mt-1 text-xs text-[#6f7d76]">{shelf.validation.detail}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-[#d8dfd8] bg-[#f6f8f5] p-4">
            <h3 className="text-sm font-semibold text-[#25302c]">Key dimensions</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[#6f7d76]">Room</dt>
                <dd className="font-semibold text-[#25302c]">96 x 96 x 30 in</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Shelf depth</dt>
                <dd className="font-semibold text-[#25302c]">14 in</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Shelf height</dt>
                <dd className="font-semibold text-[#25302c]">72 in</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6f7d76]">Clearance</dt>
                <dd className="font-semibold text-[#25302c]">24 in</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
