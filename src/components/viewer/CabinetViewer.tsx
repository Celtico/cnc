import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Edges, Grid, Html, OrbitControls } from "@react-three/drei"
import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { LuPlus } from "react-icons/lu"
import { Group, Matrix4, Vector3 } from "three"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>
import type { Hole, Panel, PanelRole, RefObject } from "../../core/model"
import { useColorModeValue } from "../ui/color-mode"

/** Escala mm → m per a l'escena. */
const S = 0.001
/** Separació en vista explosionada (mm). */
const EXPLODE_MM = 160

const ROLE_COLOR: Record<PanelRole, string> = {
  side: "#e6cfa6",
  bottom: "#e6cfa6",
  top: "#e6cfa6",
  shelf: "#efdcb8",
  door: "#d6b076",
  back: "#c9b79a",
  divider: "#e6cfa6",
  fixedShelf: "#e6cfa6",
  plinth: "#b57a37",
  drawerFront: "#d6b076",
  drawerSide: "#efdcb8",
  drawerBack: "#efdcb8",
  drawerBottom: "#c9b79a",
  flap: "#d6b076",
  grille: "#d6b076",
  hatch: "#d6b076",
  panel: "#d6b076",
}

/** Mòdul de la composició, per ressaltar-lo, seleccionar-lo i afegir-ne al costat. */
export interface ViewerModule {
  id: string
  /** Número de mòdul (1..n), el mateix que `Panel.module`. */
  index: number
  /** Cantonada baix-esquerra-darrere en mm (coordenades de la composició). */
  x: number
  y: number
  width: number
  height: number
  depth: number
}

export interface CabinetViewerProps {
  panels: Panel[]
  /** Mides exteriors del moble (o de tota la composició) en mm, per centrar la càmera. */
  size: { width: number; height: number; depth: number }
  exploded: boolean
  showHoles?: boolean
  /** Mòduls de la composició: el seleccionat es ressalta i té botons + als costats. */
  modules?: ViewerModule[]
  selectedModuleId?: string | null
  onSelectModule?: (id: string) => void
  onAddModule?: (side: "left" | "right") => void
  /** Objectes fantasma (translúcids). */
  ghosts?: RefObject[]
}

export function CabinetViewer({ panels, size, exploded, showHoles = true, modules, selectedModuleId, onSelectModule, onAddModule, ghosts }: CabinetViewerProps) {
  const bg = useColorModeValue("#f4f1ea", "#1b1a17")
  const gridCell = useColorModeValue("#d8d2c4", "#33302a")
  const gridSection = useColorModeValue("#b9b1a0", "#4a463d")
  const selected = modules?.find((m) => m.id === selectedModuleId)
  const selectedIndex = selected?.index
  const moduleIdOf = (p: Panel): string | undefined => modules?.find((m) => m.index === p.module)?.id

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.01, far: 100, position: [1.4, 1.1, 1.9] }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={[bg]} />
      <hemisphereLight intensity={0.55} groundColor="#8a7a60" />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} castShadow shadow-mapSize={1024} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />

      <group position={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}>
        {panels.map((p) => (
          <PanelMesh
            key={p.id}
            panel={p}
            exploded={exploded}
            showHoles={showHoles}
            dimmed={selectedIndex !== undefined && (modules?.length ?? 0) > 1 && p.module !== selectedIndex}
            onClick={onSelectModule ? () => {
              const id = moduleIdOf(p)
              if (id) onSelectModule(id)
            } : undefined}
          />
        ))}
        {ghosts?.map((g) => (
          <mesh key={g.id} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, (g.z + g.d / 2) * S]}>
            <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.22} depthWrite={false} />
            <Edges color="#3b82f6" />
          </mesh>
        ))}
        {selected && onAddModule && (
          <>
            <AddButton x={selected.x - 120} y={selected.y + selected.height / 2} z={selected.depth / 2} side="left" onClick={() => onAddModule("left")} />
            <AddButton x={selected.x + selected.width + 120} y={selected.y + selected.height / 2} z={selected.depth / 2} side="right" onClick={() => onAddModule("right")} />
          </>
        )}
      </group>

      <Grid
        position={[0, -0.001, 0]}
        args={[10, 10]}
        cellSize={0.1}
        sectionSize={0.5}
        cellColor={gridCell}
        sectionColor={gridSection}
        fadeDistance={6}
        infiniteGrid
      />
      <CameraRig size={size} />
    </Canvas>
  )
}

/**
 * Enquadra el moble sencer: recol·loca la càmera quan canvien les mides o la
 * proporció del visor (p. ex. mòbil en vertical o 3D ampliat). Té en compte el
 * camp de visió horitzontal i el vertical, i fa servir el més estret.
 */
function CameraRig({ size }: { size: CabinetViewerProps["size"] }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport } = useThree()
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const targetY = h * 0.5
  const aspect = viewport.width / Math.max(viewport.height, 1)

  useEffect(() => {
    if (!("fov" in camera)) return
    // Esfera que envolta el moble.
    const radius = 0.5 * Math.sqrt(w * w + h * h + d * d)
    const vHalf = ((camera.fov as number) * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * aspect)
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08
    // Vista 3/4 des de davant-dreta i una mica per sobre.
    const dir = { x: 0.72, y: 0.45, z: 0.95 }
    const len = Math.hypot(dir.x, dir.y, dir.z)
    camera.position.set((dir.x / len) * dist, targetY + (dir.y / len) * dist, (dir.z / len) * dist)
    camera.updateProjectionMatrix()
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
  }, [camera, w, h, d, targetY, aspect])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={0.3}
      maxDistance={12}
      maxPolarAngle={Math.PI * 0.55}
    />
  )
}

/** Botó + ancorat a un punt del 3D, per afegir un mòdul a un costat del seleccionat. */
function AddButton({ x, y, z, side, onClick }: { x: number; y: number; z: number; side: "left" | "right"; onClick: () => void }) {
  const label = side === "left" ? "Afegir mòdul a l'esquerra" : "Afegir mòdul a la dreta"
  // L'Html de drei munta el contingut en un arrel React a part, sense el context de
  // Chakra: aquí només hi van elements HTML plans.
  return (
    <Html position={[x * S, y * S, z * S]} center zIndexRange={[20, 10]} style={{ pointerEvents: "auto" }}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "2px solid white",
          background: "#b57a37",
          color: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          fontSize: 18,
        }}
      >
        <LuPlus />
      </button>
    </Html>
  )
}

function PanelMesh({
  panel,
  exploded,
  showHoles,
  dimmed = false,
  onClick,
}: {
  panel: Panel
  exploded: boolean
  showHoles: boolean
  /** Fora del mòdul seleccionat: més apagat. */
  dimmed?: boolean
  onClick?: () => void
}) {
  const group = useRef<Group>(null)
  const amount = useRef(exploded ? 1 : 0)

  const { matrix, explode } = useMemo(() => {
    const { origin, xAxis, yAxis, zAxis, explodeDir } = panel.placement
    const m = new Matrix4().makeBasis(
      new Vector3(...xAxis),
      new Vector3(...yAxis),
      new Vector3(...zAxis),
    )
    m.setPosition(origin[0] * S, origin[1] * S, origin[2] * S)
    return { matrix: m, explode: new Vector3(...explodeDir).multiplyScalar(EXPLODE_MM * S) }
  }, [panel.placement])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = exploded ? 1 : 0
    amount.current += (target - amount.current) * Math.min(1, dt * 7)
    if (Math.abs(target - amount.current) < 0.002) amount.current = target
    g.position.copy(explode).multiplyScalar(amount.current)
  })

  const L = panel.length * S
  const W = panel.width * S
  const T = panel.thickness * S
  const color = ROLE_COLOR[panel.role]

  return (
    <group ref={group}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        <mesh
          position={[L / 2, W / 2, T / 2]}
          castShadow
          receiveShadow
          onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick()
          } : undefined}
        >
          <boxGeometry args={[L, W, T]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} transparent={dimmed} opacity={dimmed ? 0.45 : 1} />
          <Edges color={dimmed ? "#a08a6a" : "#6b5a3e"} threshold={15} />
        </mesh>
        {showHoles && panel.holes.map((h, i) => <HoleMark key={i} hole={h} thickness={T} />)}
        {panel.grooves.map((g, i) => (
          <mesh
            key={`g${i}`}
            position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, T - (g.depth * S) / 2 + 0.0002]}
          >
            <boxGeometry args={[g.w * S, g.h * S, g.depth * S]} />
            <meshStandardMaterial color="#8a7150" roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const HOLE_COLOR = "#3b2f1f"
const EPS = 0.0004

function HoleMark({ hole, thickness }: { hole: Hole; thickness: number }) {
  const r = (hole.diameter / 2) * S
  const x = hole.x * S
  const y = hole.y * S

  if (hole.face === "A") {
    return (
      <mesh position={[x, y, thickness + EPS]}>
        <circleGeometry args={[r, 20]} />
        <meshBasicMaterial color={HOLE_COLOR} />
      </mesh>
    )
  }
  if (hole.face === "B") {
    return (
      <mesh position={[x, y, -EPS]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[r, 20]} />
        <meshBasicMaterial color={HOLE_COLOR} />
      </mesh>
    )
  }
  // Forat de cantell: disc perpendicular al cantell, al mig del gruix.
  const z = thickness / 2
  switch (hole.edge) {
    case "left":
      return (
        <mesh position={[x - EPS, y, z]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "right":
      return (
        <mesh position={[x + EPS, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "bottom":
      return (
        <mesh position={[x, y - EPS, z]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    case "top":
      return (
        <mesh position={[x, y + EPS, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 20]} />
          <meshBasicMaterial color={HOLE_COLOR} />
        </mesh>
      )
    default:
      return null
  }
}
