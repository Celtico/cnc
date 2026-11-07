import { Line } from "@react-three/drei"
import type { SketchLine } from "../facePick"
import { S } from "./constants"

const COLOR: Record<SketchLine["tone"], string> = { sketch: "#1971c2", selected: "#e8590c", draft: "#2f9e44" }

/** Els croquis de Modelatge (com les línies de l'Esbós del Taulell), per sobre de les peces; els punts sols, una boleta. */
export function SketchLines({ lines }: { lines: SketchLine[] }) {
  return (
    <>
      {lines.map((l, i) =>
        l.pts.length < 2 ? (
          l.pts.map((p, k) => (
            <mesh key={`${i}-${k}`} position={[p[0] * S, p[1] * S, p[2] * S]} renderOrder={20}>
              <sphereGeometry args={[4 * S, 12, 8]} />
              <meshBasicMaterial color={COLOR[l.tone]} depthTest={false} />
            </mesh>
          ))
        ) : (
          <Line key={i} points={(l.closed ? [...l.pts, l.pts[0]!] : l.pts).map((p) => [p[0] * S, p[1] * S, p[2] * S] as [number, number, number])} color={COLOR[l.tone]} lineWidth={l.tone === "sketch" ? 2 : 3} depthTest={false} renderOrder={20} />
        ),
      )}
    </>
  )
}
