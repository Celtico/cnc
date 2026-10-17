import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Plane, SphereGeometry, Vector3 } from "three"
import { axisDragPlane } from "../../components/viewer/gizmoDrag"
import { MoveGizmo, type GizmoHandle } from "../../components/viewer/MoveGizmo"
import { useOrbitControls } from "../../components/viewer/orbitControls"
import { meshGeometry } from "../../components/viewer/refGeometry"
import { useColorModeValue } from "../../components/ui/color-mode"
import { edgeKey, moveVertices, type MeshCage } from "../../core/model"

const S = 0.001

/** Un punt de la caixa (0 a 1) a l'escena: la caixa centrada a l'origen, en m. */
const cageToScene = (p: readonly number[], size: Size): [number, number, number] => [(p[0]! - 0.5) * size.w * S, (p[1]! - 0.5) * size.h * S, (p[2]! - 0.5) * size.d * S]
type Axis = "x" | "y" | "z"
type Size = { w: number; h: number; d: number }

/**
 * El 3D de l'editor de malla: la superfície suau, la caixa de control (línies i punts) i el gizmo de moure (fletxes i
 * bola) als punts triats. Coordenades: la caixa centrada a l'origen (m).
 */
export function MeshEditorCanvas(props: { cage: MeshCage; size: Size; level: number; selected: number[]; mirror: number[] | null; onSelect: (ids: number[]) => void; onPreview: (c: MeshCage) => void; onCommit: (c: MeshCage) => void }) {
  const span = Math.max(props.size.w, props.size.h, props.size.d) * S
  // Els punts i les línies, foscos de dia i clars de nit (el fons del visor canvia amb el tema).
  const ink = useColorModeValue("#2b2418", "#f3e8d4")
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: 35, near: span / 200, far: span * 40, position: [span * 1.4, span * 1.1, span * 1.9] }}
      resize={{ offsetSize: true }}
      style={{ touchAction: "none" }}
      onPointerMissed={(e) => {
        if (!e.shiftKey) props.onSelect([])
      }}
    >
      <hemisphereLight args={["#ffffff", "#8a7a60", 1]} />
      <directionalLight position={[1, 3, 2]} intensity={1.3} />
      <CageScene {...props} ink={ink} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={span * 0.1} maxDistance={span * 10} />
    </Canvas>
  )
}

function CageScene({ cage, size, level, selected, mirror, onSelect, onPreview, onCommit, ink }: Parameters<typeof MeshEditorCanvas>[0] & { ink: string }) {
  const surface = useMemo(() => meshGeometry(size, cage, level), [size, cage, level])
  useEffect(() => () => surface.dispose(), [surface])
  const at = (p: readonly number[]) => cageToScene(p, size)
  // Línies de la caixa de control (cada aresta un cop).
  const lines = useMemo(() => {
    const seen = new Set<string>()
    const sharp = new Set((cage.crease ?? []).map(([a, b]) => edgeKey(a, b)))
    const pos: number[] = []
    const vivid: number[] = []
    for (const f of cage.f)
      f.forEach((a, k) => {
        const b = f[(k + 1) % f.length]!
        const key = edgeKey(a, b)
        if (seen.has(key)) return
        seen.add(key)
        ;(sharp.has(key) ? vivid : pos).push(...cageToScene(cage.v[a]!, size), ...cageToScene(cage.v[b]!, size))
      })
    const g = new BufferGeometry()
    g.setAttribute("position", new Float32BufferAttribute(pos, 3))
    // Les arestes vives, a part (taronja).
    const gv = new BufferGeometry()
    gv.setAttribute("position", new Float32BufferAttribute(vivid, 3))
    return { g, gv }
  }, [cage, size])
  useEffect(
    () => () => {
      lines.g.dispose()
      lines.gv.dispose()
    },
    [lines],
  )
  const r = Math.max(size.w, size.h, size.d) * S * 0.018
  // Les esferes dels punts, compartides (amb molts punts, una geometria per punt i per render es menjava l'app).
  const balls = useMemo(() => ({ hit: new SphereGeometry(r * 2.6, 8, 6), dot: new SphereGeometry(r, 12, 8), big: new SphereGeometry(r * 1.25, 12, 8) }), [r])
  useEffect(
    () => () => {
      balls.hit.dispose()
      balls.dot.dispose()
      balls.big.dispose()
    },
    [balls],
  )
  const sel = new Set(selected)
  const centroid = useMemo(() => {
    if (!selected.length) return null
    const c = [0, 0, 0]
    for (const i of selected) cageToScene(cage.v[i]!, size).forEach((x, k) => (c[k]! += x / selected.length))
    return c as [number, number, number]
  }, [selected, cage, size])

  // Arrossegar les fletxes o la bola: el pla que conté l'eix i mira a la càmera (com els objectes del visor).
  const camera = useThree((st) => st.camera)
  const invalidate = useThree((st) => st.invalidate)
  const controls = useOrbitControls()
  const drag = useRef<{ plane: Plane; start: Vector3; axes: Axis[]; base: MeshCage; last: MeshCage } | null>(null)
  const [active, setActive] = useState<GizmoHandle | null>(null)
  const start = (a: GizmoHandle, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const axes: Axis[] = a === "free" ? ["x", "y", "z"] : [a]
    const plane = axisDragPlane(a, camera, e.point)
    if (!plane) return
    drag.current = { plane, start: e.point.clone(), axes, base: cage, last: cage }
    setActive(a)
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    e.stopPropagation()
    const p = e.ray.intersectPlane(d.plane, new Vector3())
    if (!p) return
    const dm = p.sub(d.start).divideScalar(S)
    const delta: [number, number, number] = [d.axes.includes("x") ? dm.x / size.w : 0, d.axes.includes("y") ? dm.y / size.h : 0, d.axes.includes("z") ? dm.z / size.d : 0]
    d.last = moveVertices(d.base, selected, delta, mirror ?? undefined)
    onPreview(d.last)
    invalidate()
  }
  const end = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setActive(null)
    if (controls) controls.enabled = true
    if (d.last !== d.base) onCommit(d.last)
  }

  return (
    <group>
      <mesh geometry={surface}>
        <meshStandardMaterial color="#cdbb9c" roughness={0.6} transparent opacity={0.82} side={DoubleSide} />
      </mesh>
      <lineSegments geometry={lines.g}>
        <lineBasicMaterial color={ink} transparent opacity={0.7} depthTest={false} />
      </lineSegments>
      <lineSegments geometry={lines.gv} renderOrder={19}>
        <lineBasicMaterial color="#ea580c" depthTest={false} />
      </lineSegments>
      {cage.v.map((p, i) => (
        <mesh
          key={i}
          geometry={balls.hit}
          position={at(p)}
          renderOrder={20}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 4) return
            const add = e.shiftKey || e.metaKey || e.ctrlKey
            onSelect(add ? (sel.has(i) ? selected.filter((x) => x !== i) : [...selected, i]) : [i])
          }}
        >
          {/* Una esfera invisible més grossa per tocar-lo fàcilment (amb el dit). */}
          <meshBasicMaterial visible={false} />
          <mesh raycast={() => null} renderOrder={21} geometry={sel.has(i) ? balls.big : balls.dot}>
            <meshBasicMaterial color={sel.has(i) ? "#c2410c" : mirror && mirror[i] !== i && selected.some((s) => mirror[s] === i) ? "#fb923c" : ink} depthTest={false} />
          </mesh>
        </mesh>
      ))}
      {centroid && (
        <group position={centroid}>
          <MoveGizmo axes={["x", "y", "z"]} active={active} onStart={start} onMove={move} onEnd={end} />
        </group>
      )}
    </group>
  )
}
