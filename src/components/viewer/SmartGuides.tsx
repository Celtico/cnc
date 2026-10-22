import { Line } from "@react-three/drei"
import type { Guide } from "./guideSnap"
import { S } from "./cabinet/constants"

/** Vermell de les guies (com al Figma). */
const GUIDE_COLOR = "#ef4444"
/** Mida de la creueta de cada punta (mm). */
const CROSS = 30

/** Les guies d'alinear (`snapWithGuides`) mentre s'arrossega: línies vermelles amb una creueta a cada punta, sempre a sobre. */
export function SmartGuides({ guides }: { guides: readonly Guide[] }) {
  if (!guides.length) return null
  return (
    <group userData={{ editorOnly: true }}>
      {guides.map((g, i) => {
        const ends = [g.from, g.to]
        const crosses = ends.flatMap((p) => [
          [(p[0] - CROSS) * S, (p[1] - CROSS) * S, p[2] * S], [(p[0] + CROSS) * S, (p[1] + CROSS) * S, p[2] * S],
          [(p[0] - CROSS) * S, (p[1] + CROSS) * S, p[2] * S], [(p[0] + CROSS) * S, (p[1] - CROSS) * S, p[2] * S],
        ] as [number, number, number][])
        return (
          <group key={i}>
            <Line points={ends.map((p) => [p[0] * S, p[1] * S, p[2] * S] as [number, number, number])} color={GUIDE_COLOR} lineWidth={1.5} depthTest={false} renderOrder={20} raycast={() => null} />
            <Line points={crosses} segments color={GUIDE_COLOR} lineWidth={1.5} depthTest={false} renderOrder={20} raycast={() => null} />
          </group>
        )
      })}
    </group>
  )
}
