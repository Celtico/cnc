import { Line } from "@react-three/drei"
import { useMemo } from "react"
import { Vector3 } from "three"

/** Color de selecció del 3D (contorns de l'editor i dels ambients). */
const SELECT = "#b57a37"

/**
 * Contorn d'una caixa centrada a l'origen (unitats de l'escena) amb línies gruixudes per sobre de tot: el que hi ha sota
 * el ratolí (prim i mig transparent) o el que està seleccionat (`strong`). Editor (mòduls i objectes) i ambients.
 */
export function BoxFrame({ w, h, d, strong = false, color = SELECT }: { w: number; h: number; d: number; strong?: boolean; color?: string }) {
  const pts = useMemo(() => {
    const x = w / 2, y = h / 2, z = d / 2
    const c: [number, number, number][] = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const
    return e.flatMap(([a, b]) => [new Vector3(...c[a]!), new Vector3(...c[b]!)])
  }, [w, h, d])
  return <Line points={pts} segments color={color} lineWidth={strong ? 3 : 2} transparent opacity={strong ? 1 : 0.8} depthTest={false} renderOrder={12} raycast={() => null} />
}
