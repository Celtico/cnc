import { Line } from "@react-three/drei"
import { useEffect, useMemo } from "react"
import { Vector3 } from "three"
import { flatten, type Panel } from "../../../core/model"
import { useViewerCursor } from "../cursor"
import { S, SELECT_COLOR } from "./constants"

/** Cursor de les peces dels mòduls (el hover el porta `CabinetViewer`, fora del Canvas). */
export function HoverCursor({ active }: { active: boolean }) {
  const cursor = useViewerCursor()
  useEffect(() => cursor.hover(active ? "pointer" : null), [cursor, active])
  return null
}

/**
 * Passacables del mòdul seleccionat: contorn taronja que es veu a través de les portes i
 * dels laterals (sense prova de profunditat), perquè sovint són al fons, amagats.
 */
export function CableMarks({ panels }: { panels: Panel[] }) {
  const loops = useMemo(() => {
    const out: Vector3[][] = []
    for (const p of panels) {
      const { origin: o, xAxis: xa, yAxis: ya, zAxis: za } = p.placement
      const z = p.thickness / 2
      const world = (x: number, y: number) =>
        new Vector3((o[0] + x * xa[0] + y * ya[0] + z * za[0]) * S, (o[1] + x * xa[1] + y * ya[1] + z * za[1]) * S, (o[2] + x * xa[2] + y * ya[2] + z * za[2]) * S)
      for (const c of p.cutouts ?? []) {
        if (!c.tag?.startsWith("cable") && c.tag !== "ref") continue
        if (c.kind === "circle") {
          const r = c.diameter / 2
          out.push(Array.from({ length: 33 }, (_, i) => world(c.x + r * Math.cos((i / 32) * Math.PI * 2), c.y + r * Math.sin((i / 32) * Math.PI * 2))))
        } else if (c.kind === "polygon") {
          const f = flatten(c.points)
          out.push([...f, f[0]!].map(([x, y]) => world(x, y)))
        } else {
          out.push([world(c.x, c.y), world(c.x + c.w, c.y), world(c.x + c.w, c.y + c.h), world(c.x, c.y + c.h), world(c.x, c.y)])
        }
      }
    }
    return out
  }, [panels])
  return (
    <>
      {loops.map((pts, i) => (
        <Line key={i} points={pts} color={SELECT_COLOR} lineWidth={3} depthTest={false} renderOrder={10} />
      ))}
    </>
  )
}

/**
 * Contorn del compartiment seleccionat: arestes taronges que es veuen a través de les
 * portes (sense prova de profunditat) i un vel molt suau a dins.
 */
export function ZoneHighlight({ box: b }: { box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } }) {
  const inset = b.veil === false ? -2 : 3
  const x0 = (b.x0 + inset) * S
  const x1 = (b.x1 - inset) * S
  const y0 = (b.y0 + inset) * S
  const y1 = (b.y1 - inset) * S
  const z0 = b.z0 * S
  const z1 = b.z1 * S
  const c = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const front = [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1), c(x0, y0, z1)]
  const back = [c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0), c(x0, y0, z0)]
  const sides: [Vector3, Vector3][] = [
    [c(x0, y0, z0), c(x0, y0, z1)],
    [c(x1, y0, z0), c(x1, y0, z1)],
    [c(x1, y1, z0), c(x1, y1, z1)],
    [c(x0, y1, z0), c(x0, y1, z1)],
  ]
  return (
    <group renderOrder={10}>
      {b.veil !== false && (
      <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} renderOrder={10}>
        <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
        <meshBasicMaterial color={SELECT_COLOR} transparent opacity={0.22} depthWrite={false} depthTest={false} />
      </mesh>
      )}
      <Line points={front} color={SELECT_COLOR} lineWidth={4} depthTest={false} renderOrder={11} />
      <Line points={back} color={SELECT_COLOR} lineWidth={1.5} depthTest={false} transparent opacity={0.6} renderOrder={11} />
      {sides.map((pts, i) => (
        <Line key={i} points={pts} color={SELECT_COLOR} lineWidth={1.5} depthTest={false} transparent opacity={0.6} renderOrder={11} />
      ))}
    </group>
  )
}
