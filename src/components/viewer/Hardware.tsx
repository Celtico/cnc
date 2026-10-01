import { useMemo } from "react"
import { MeshStandardMaterial } from "three"
import type { Panel } from "../../core/model"

/**
 * Ferratges al 3D (només visuals, no es fabriquen): frontisses, tiradors i potes, perquè
 * les portes i els mòduls no semblin flotar. Coordenades locals de la peça (mm × S), com
 * `PanelMesh`: així segueixen la porta quan s'obre i la vista explosionada.
 */
const S = 0.001
const METAL = new MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.85, roughness: 0.3 })
const DARK = new MeshStandardMaterial({ color: "#2f3033", metalness: 0.4, roughness: 0.5 })

/** Tirador de barra: llarg `len` mm, paral·lel a x local, centrat a (cx, cy), cap a `dir` (±z). */
function BarHandle({ cx, cy, z, dir, len, vertical }: { cx: number; cy: number; z: number; dir: 1 | -1; len: number; vertical: boolean }) {
  const standoff = 28
  const r = 6
  const rot: [number, number, number] = vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]
  // Barra: cilindre al llarg de y (vertical) o de x (horitzontal) a `standoff` de la cara.
  const zc = (z + dir * standoff) * S
  const feet = [-(len / 2 - 12), len / 2 - 12]
  return (
    <group position={[cx * S, cy * S, 0]}>
      <mesh position={[0, 0, zc]} rotation={vertical ? [0, 0, 0] : rot} material={METAL} castShadow>
        <cylinderGeometry args={[r * S, r * S, len * S, 16]} />
      </mesh>
      {feet.map((f, i) => (
        <mesh key={i} position={[vertical ? 0 : f * S, vertical ? f * S : 0, (z + (dir * standoff) / 2) * S]} rotation={[Math.PI / 2, 0, 0]} material={METAL}>
          <cylinderGeometry args={[4 * S, 4 * S, standoff * S, 10]} />
        </mesh>
      ))}
    </group>
  )
}

export function PanelHardware({ panel }: { panel: Panel }) {
  const hw = useMemo(() => {
    const isFront = panel.role === "door" || panel.role === "drawerFront" || panel.role === "flap"
    if (!isFront) return null
    const L = panel.length
    const W = panel.width
    const T = panel.thickness
    const cups = panel.holes.filter((h) => h.tag === "hinge")
    // Cara de dins: la de les cassoletes (A, z = T); el tirador va a l'altra (fora).
    const inner = cups[0]?.face === "B" ? 0 : T
    const outDir: 1 | -1 = inner === T ? -1 : 1
    const outZ = inner === T ? 0 : T
    // Cantell de les frontisses: el costat on són les cassoletes.
    let handle: { cx: number; cy: number; vertical: boolean; len: number }
    // Els forats del tirador (talls Ø5 «handle») diuen on va i la seva mida.
    const hh = (panel.cutouts ?? []).filter((c): c is Extract<typeof c, { kind: "circle" }> => c.kind === "circle" && c.tag === "handle")
    if (hh.length === 2) {
      const [a, b] = hh as [(typeof hh)[number], (typeof hh)[number]]
      const vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x)
      handle = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vertical, len: Math.hypot(a.x - b.x, a.y - b.y) + 40 }
    } else if (cups.length) {
      const mx = cups.reduce((a, h) => a + h.x, 0) / cups.length
      const my = cups.reduce((a, h) => a + h.y, 0) / cups.length
      const alongX = Math.abs(my - W / 2) / W > Math.abs(mx - L / 2) / L // frontisses a y ≈ 0 o W
      const len = Math.min(192, (alongX ? L : W) * 0.4)
      handle = alongX
        ? { cx: L / 2, cy: my < W / 2 ? W - 45 : 45, vertical: false, len }
        : { cx: mx < L / 2 ? L - 45 : 45, cy: W / 2, vertical: true, len }
    } else {
      // Calaix: tirador centrat, al llarg del costat llarg.
      handle = { cx: L / 2, cy: W / 2, vertical: false, len: Math.min(192, L * 0.4) }
    }
    return { cups, inner, outDir, outZ, handle }
  }, [panel])
  if (!hw) return null
  const { cups, inner, outDir, outZ, handle } = hw
  const inDir = -outDir as 1 | -1
  return (
    <group>
      {cups.map((h, i) => (
        <group key={i}>
          {/* Cassoleta i braç de la frontissa, a la cara de dins. */}
          <mesh position={[h.x * S, h.y * S, (inner + inDir * 1) * S]} rotation={[Math.PI / 2, 0, 0]} material={METAL}>
            <cylinderGeometry args={[(h.diameter / 2 + 3) * S, (h.diameter / 2 + 3) * S, 2 * S, 20]} />
          </mesh>
          <mesh position={[h.x * S, h.y * S, (inner + inDir * 7) * S]} material={METAL} castShadow>
            <boxGeometry args={[20 * S, Math.max(20, h.diameter) * S, 12 * S]} />
          </mesh>
        </group>
      ))}
      {!panel.push && <BarHandle cx={handle.cx} cy={handle.cy} z={outZ} dir={outDir} len={handle.len} vertical={handle.vertical} />}
    </group>
  )
}

/** Potes regulables sota un mòdul (coordenades de la composició, mm). */
export function ModuleLegs({ x, z, width, depth, height }: { x: number; z: number; width: number; depth: number; height: number }) {
  const inset = 50
  const pts: [number, number][] = [
    [x + inset, z + inset],
    [x + width - inset, z + inset],
    [x + inset, z + depth - inset],
    [x + width - inset, z + depth - inset],
  ]
  return (
    <group>
      {pts.map(([px, pz], i) => (
        <group key={i} position={[px * S, 0, pz * S]}>
          <mesh position={[0, (height / 2) * S, 0]} material={DARK} castShadow>
            <cylinderGeometry args={[14 * S, 14 * S, height * S, 16]} />
          </mesh>
          <mesh position={[0, 4 * S, 0]} material={DARK}>
            <cylinderGeometry args={[22 * S, 24 * S, 8 * S, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
