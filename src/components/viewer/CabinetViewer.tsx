import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges, Grid, OrbitControls } from "@react-three/drei"
import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { Group, Matrix4, Vector3 } from "three"

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>
import type { Hole, Panel, PanelRole } from "../../core/model"
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

export interface CabinetViewerProps {
  panels: Panel[]
  /** Mides exteriors del moble en mm, per centrar la càmera. */
  size: { width: number; height: number; depth: number }
  exploded: boolean
  showHoles?: boolean
}

export function CabinetViewer({ panels, size, exploded, showHoles = true }: CabinetViewerProps) {
  const bg = useColorModeValue("#f4f1ea", "#1b1a17")
  const gridCell = useColorModeValue("#d8d2c4", "#33302a")
  const gridSection = useColorModeValue("#b9b1a0", "#4a463d")

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
          <PanelMesh key={p.id} panel={p} exploded={exploded} showHoles={showHoles} />
        ))}
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

/** Recol·loca la càmera i l'objectiu quan canvien les mides. */
function CameraRig({ size }: { size: CabinetViewerProps["size"] }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const maxDim = Math.max(size.width, size.height, size.depth) * S
  const targetY = size.height * S * 0.5

  useEffect(() => {
    const dist = maxDim * 2.1 + 0.3
    camera.position.set(dist * 0.72, targetY + dist * 0.45, dist * 0.95)
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
  }, [camera, maxDim, targetY])

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

function PanelMesh({ panel, exploded, showHoles }: { panel: Panel; exploded: boolean; showHoles: boolean }) {
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
        <mesh position={[L / 2, W / 2, T / 2]} castShadow receiveShadow>
          <boxGeometry args={[L, W, T]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
          <Edges color="#6b5a3e" threshold={15} />
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
