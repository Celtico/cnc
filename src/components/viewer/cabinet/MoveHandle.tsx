import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Billboard, Html } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState } from "react"
import { Plane, Vector3, type Group } from "three"
import { useViewerCursor } from "../cursor"
import { usePixelScale } from "../pixelScale"
import { S } from "./constants"
import type { ViewerModule } from "./types"

/** Elements d'edició (botons +, nanses, gizmo): la imatge del visor per al render no els porta (`SceneAccess`). */
const EDITOR_ONLY = { editorOnly: true }

/** La nansa ↔ va `HANDLE_LIFT` radis per sobre de l'aresta de dalt (a la pantalla) i, com a molt, a `HANDLE_TOP_PX` de dalt del visor. */
const HANDLE_LIFT = 1.8
const HANDLE_TOP_PX = 56

/**
 * Nansa per moure el mòdul seleccionat (o, amb Maj, tot el moble) arrossegant-la: al llarg de
 * la fila i, si és penjat, amunt i avall. S'enganxa a les vores dels altres mòduls i dels
 * objectes (Alt: lliure).
 */
export function MoveHandle({
  m,
  others,
  onDrag,
  onDrop,
}: {
  m: ViewerModule
  others: number[]
  onDrag: (d: { index: number; dx: number; dy: number; dz: number; all: boolean } | null) => void
  onDrop: (dx: number, dy: number, dz: number, all: boolean) => void
}) {
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  const start = useRef<{ p: Vector3; plane: Plane; all: boolean } | null>(null)
  const latest = useRef<{ dx: number; dy: number; dz: number; all: boolean } | null>(null)
  const [live, setLive] = useState<{ dx: number; dy: number; dz: number; all: boolean } | null>(null)
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  // Al mig de l'aresta de dalt de davant; el cercle va uns píxels més amunt (a la pantalla, `HANDLE_LIFT`).
  const top: [number, number, number] = [(m.x + m.width / 2) * S, (m.y + m.height) * S, ((m.z ?? 0) + m.depth) * S]
  // Mida constant a la pantalla (uns 30 px), s'allunyi o s'acosti la càmera.
  const scaler = useRef<Group>(null)
  const anchor = useRef<Group>(null)
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3() }), [])
  // En un mòdul alt (una columna) amb la càmera a prop, la nansa sortiria per dalt del visor: baixa per l'aresta de
  // davant (com a molt fins a una quarta part de l'alçada) fins que hi cap, a sota de la barra de dalt del visor.
  useFrame(({ camera, size }) => {
    const g = anchor.current
    if (!g) return
    const ox = (live?.dx ?? 0) * S, oy = (live?.dy ?? 0) * S, oz = (live?.dz ?? 0) * S
    const hi = tmp.a.set(top[0] + ox, top[1] + oy, top[2] + oz)
    let y = hi.y
    const limit = 1 - (2 * (HANDLE_TOP_PX + HANDLE_LIFT * 14)) / Math.max(1, size.height)
    // Les coordenades són del grup del moble (centrat a l'escena): a la pantalla, amb la seva matriu.
    const parent = g.parent?.matrixWorld
    const ndcOf = (v: Vector3) => (parent ? v.clone().applyMatrix4(parent) : v.clone()).project(camera).y
    const ndcHi = ndcOf(hi)
    if (ndcHi > limit) {
      const drop = m.height * 0.75 * S
      const lo = tmp.b.set(hi.x, hi.y - drop, hi.z)
      const ndcLo = ndcOf(lo)
      const t = ndcHi - ndcLo > 1e-6 ? Math.min(1, Math.max(0, (ndcHi - limit) / (ndcHi - ndcLo))) : 0
      y = hi.y - t * drop
    }
    g.position.set(hi.x, y, hi.z)
  })
  usePixelScale(scaler, 14)
  // r3f no fa arribar el `pointercancel` (un gest del sistema a l'iPhone, girar la pantalla…) ni el `pointerup` si el
  // dit acaba fora de la nansa i no s'ha pogut capturar el punter: com al gizmo, s'escolten a la finestra perquè
  // l'arrossegament acabi igualment (`end` ignora un final repetit).
  const endRef = useRef<(e: ThreeEvent<PointerEvent>) => void>(() => {})
  const unlisten = useRef<(() => void) | null>(null)
  useEffect(() => () => unlisten.current?.(), [])
  const listenEnd = (pointerId: number) => {
    unlisten.current?.()
    const fin = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      unlisten.current?.()
      endRef.current({ target: null, pointerId } as unknown as ThreeEvent<PointerEvent>)
    }
    window.addEventListener("pointerup", fin)
    window.addEventListener("pointercancel", fin)
    unlisten.current = () => {
      window.removeEventListener("pointerup", fin)
      window.removeEventListener("pointercancel", fin)
      unlisten.current = null
    }
  }

  const compute = (e: ThreeEvent<PointerEvent>) => {
    const s0 = start.current
    const p = s0 && e.ray.intersectPlane(s0.plane, new Vector3())
    if (!s0 || !p) return null
    let dx = (p.x - s0.p.x) / S
    const dy = m.wall && !s0.all ? Math.round((p.y - s0.p.y) / S) : 0
    // «Al terra»: endavant i enrere, sense passar la paret.
    const dz = m.free && !s0.all ? Math.max(-(m.z ?? 0), Math.round((p.z - s0.p.z) / S)) : 0
    if (!e.altKey) {
      let best: number | null = null
      for (const t of others) for (const edge of [m.x + dx, m.x + m.width + dx]) {
        const d = t - edge
        if (Math.abs(d) <= 15 && (best === null || Math.abs(d) < Math.abs(best))) best = d
      }
      if (best !== null) dx += best
    }
    return { dx: Math.round(dx), dy, dz, all: s0.all }
  }
  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!start.current) return
    start.current = null
    unlisten.current?.()
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    cursor.drag(null)
    const d = latest.current
    latest.current = null
    setLive(null)
    onDrop(d?.dx ?? 0, d?.dy ?? 0, d?.dz ?? 0, d?.all ?? false)
  }
  useEffect(() => {
    endRef.current = end
  })
  const sign = (v: number) => `${v > 0 ? "+" : ""}${v}`
  const label = live ? (live.all ? `Tot el moble ${sign(live.dx)} mm` : `${sign(live.dx)} mm${live.dy ? ` · ${sign(live.dy)} mm` : ""}${live.dz ? ` · paret ${(m.z ?? 0) + live.dz} mm` : ""}`) : null

  return (
    <group ref={anchor} position={top} userData={EDITOR_ONLY}>
      <Billboard>
        <group ref={scaler}>
        <group position={[0, HANDLE_LIFT, 0]}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            cursor.hover("grab")
          }}
          onPointerOut={() => {
            setHover(false)
            cursor.hover(null)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
            // «Al terra»: arrossega sobre un pla horitzontal (pel terra); la resta, pel pla de la paret.
            const plane = new Plane().setFromNormalAndCoplanarPoint(m.free && !e.shiftKey ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), e.point)
            start.current = { p: e.point.clone(), plane, all: e.shiftKey }
            if (controls) controls.enabled = false
            cursor.drag("grabbing")
            listenEnd(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!start.current) return
            e.stopPropagation()
            const d = compute(e)
            if (!d) return
            latest.current = d
            setLive(d)
            onDrag({ index: m.index, ...d })
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
          renderOrder={20}
        >
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color={hover || live ? "#98602c" : "#b57a37"} depthTest={false} depthWrite={false} transparent />
        </mesh>
        {/* Fletxes blanques ←→ (i ↑↓ als penjats): barres i triangles plans. */}
        {(m.wall || m.free ? [0, Math.PI / 2] : [0]).map((rot) => (
          <group key={rot} rotation={[0, 0, rot]}>
            <mesh position={[0, 0, 0.01]} renderOrder={21}>
              <planeGeometry args={[0.9, 0.13]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
            <mesh position={[0.5, 0, 0.01]} renderOrder={21}>
              <circleGeometry args={[0.26, 3]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
            <mesh position={[-0.5, 0, 0.01]} rotation={[0, 0, Math.PI]} renderOrder={21}>
              <circleGeometry args={[0.26, 3]} />
              <meshBasicMaterial color="white" depthTest={false} depthWrite={false} transparent />
            </mesh>
          </group>
        ))}
        </group>
        </group>
      </Billboard>
      {label && (
        // Per sobre de la nansa (que va uns 25 px per sobre de l'aresta).
        <Html position={[0, 0, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", background: "#b57a37", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", display: "block", transform: "translateY(-52px)" }}>{label}</span>
        </Html>
      )}
    </group>
  )
}
