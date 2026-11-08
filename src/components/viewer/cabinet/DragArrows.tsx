import { useThree, type ThreeEvent } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { useEffect, useRef, useState } from "react"
import { Plane, Quaternion, Vector3, type Group } from "three"
import type { ArrowHandles, ViewerArrow } from "../facePick"
import { frontRaycast, noRaycast } from "../gizmoRaycast"
import { usePixelScale } from "../pixelScale"
import { snapToleranceMm } from "../snapTolerance"
import { useOrbitControls } from "../orbitControls"
import { useViewerCursor } from "../cursor"
import { S } from "./constants"

const EDITOR_ONLY = { editorOnly: true }
const UP = new Vector3(0, 1, 0)

/**
 * Les fletxes d'arrossegar de Modelatge (com les del Taulell): un con a cada cara que es pot estirar, de mida constant a la
 * pantalla i per sobre de tot. Arrossegar-lo mou la cara al llarg de la fletxa; qui l'usa (`ArrowHandles.onDrag`) diu on
 * queda, amb l'imant. Dins del grup del moble (mm × `S`).
 */
export function DragArrows({ h }: { h: ArrowHandles }) {
  const [label, setLabel] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  // El text va a la fletxa que s'arrossega (que segueix la cara).
  const on = h.arrows.find((a) => a.id === active)
  return (
    <group userData={EDITOR_ONLY}>
      {h.arrows.map((a) => (
        <Arrow key={a.id} a={a} h={h} dim={!!active && active !== a.id} setActive={setActive} setLabel={setLabel} />
      ))}
      {label && on && (
        <Html position={[on.at[0] * S, on.at[1] * S, on.at[2] * S]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <div style={{ background: "rgba(24,24,27,.85)", color: "#fff", font: "12px system-ui", padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap", transform: "translateY(-24px)" }}>{label}</div>
        </Html>
      )}
    </group>
  )
}

function Arrow({ a, h, dim, setActive, setLabel }: { a: ViewerArrow; h: ArrowHandles; dim: boolean; setActive: (id: string | null) => void; setLabel: (l: string | null) => void }) {
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 14)
  const controls = useOrbitControls()
  const cursor = useViewerCursor()
  const getThree = useThree((st) => st.get)
  const [hover, setHover] = useState(false)
  const drag = useRef<{ plane: Plane; p0: Vector3; dir: Vector3; moved: boolean; at: [number, number] } | null>(null)
  const dir = new Vector3(...a.dir)
  const q = new Quaternion().setFromUnitVectors(UP, dir)
  const pos: [number, number, number] = [a.at[0] * S, a.at[1] * S, a.at[2] * S]
  useEffect(() => () => {
    if (controls) controls.enabled = true
  }, [controls])

  const begin = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const { camera } = getThree()
    // El pla que conté la fletxa i mira tant com pot a la càmera.
    const toCam = camera.getWorldDirection(new Vector3()).negate()
    const n = dir.clone().cross(toCam).cross(dir)
    if (n.lengthSq() < 1e-6) return
    drag.current = { plane: new Plane().setFromNormalAndCoplanarPoint(n.normalize(), e.point), p0: e.point.clone(), dir: dir.clone(), moved: false, at: [e.clientX, e.clientY] }
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    setActive(a.id)
    cursor.drag("grabbing")
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    e.stopPropagation()
    if (e.buttons === 0) return end(e)
    if (!d.moved && Math.hypot(e.clientX - d.at[0], e.clientY - d.at[1]) < 4) return
    d.moved = true
    const p = e.ray.intersectPlane(d.plane, new Vector3())
    if (!p) return
    const mm = p.clone().sub(d.p0).dot(d.dir) / S
    const three = getThree()
    const text = h.onDrag(a.id, Math.round(mm * 10) / 10, snapToleranceMm(three.camera, three.size.height, p, S), e.altKey)
    setLabel(text)
  }
  const end = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    setActive(null)
    setLabel(null)
    cursor.drag(null)
    h.onDrop(d.moved ? a.id : null)
  }
  const on = hover || !!drag.current
  return (
    <group position={pos} quaternion={q}>
      <group ref={scaler}>
        <group
          onPointerOver={(e) => (e.stopPropagation(), setHover(true), cursor.hover("grab"))}
          onPointerOut={() => (setHover(false), cursor.hover(null))}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
        >
          <mesh position={[0, 1.6, 0]} renderOrder={30} raycast={noRaycast}>
            <coneGeometry args={[on ? 0.75 : 0.55, 1.8, 18]} />
            <meshBasicMaterial color={a.color} transparent opacity={dim ? 0.3 : on ? 1 : 0.9} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.5, 0]} renderOrder={30} raycast={noRaycast}>
            <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
            <meshBasicMaterial color={a.color} transparent opacity={dim ? 0.3 : 0.9} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.3, 0]} visible={false} raycast={frontRaycast}>
            <cylinderGeometry args={[0.9, 0.9, 2.8, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
