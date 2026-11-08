import type { Panel, PanelRole } from "../model"

/** Les peces que el trencajunt fa recular: la base, el sostre, els prestatges fixos i les divisions (com al Taulell). */
const ROLES = new Set<PanelRole>(["bottom", "top", "fixedShelf", "divider"])

/**
 * **Trencajunt** (el del Taulell, `CABDEF.tj`): la base, el sostre, els prestatges fixos i les divisions que arriben al davant
 * dels laterals hi queden `tj` mm enrere, perquè la junta no quedi a ras. El davant del mòdul és z = `depth`. La peça
 * s'escurça pel davant; si el seu origen és al davant, els mecanitzats es mouen amb ella. Les peces amb forma (contorn,
 * talls, inglets) no es toquen.
 */
export function applyBreakJoint(panels: Panel[], tj: number, depth: number): Panel[] {
  if (!(tj > 0)) return panels
  return panels.map((p) => {
    if (!ROLES.has(p.role) || p.outline || p.cutouts?.length || p.pockets?.length || p.solidCuts?.length || p.mitres?.length) return p
    const { origin, xAxis, yAxis } = p.placement
    const ax = Math.abs(xAxis[2]!) > 0.99 ? "x" : Math.abs(yAxis[2]!) > 0.99 ? "y" : null
    if (!ax) return p
    const dir = (ax === "x" ? xAxis : yAxis)[2]!
    const len = ax === "x" ? p.length : p.width
    const front = dir > 0 ? origin[2]! + len : origin[2]!
    if (Math.abs(front - depth) > 0.5 || len - tj < 10) return p
    const size = ax === "x" ? { length: p.length - tj } : { width: p.width - tj }
    const lim = len - tj
    // Una ranura que arribava al cantell del davant s'hi queda (no surt de la peça).
    const clip = (g: Panel["grooves"][number]): Panel["grooves"][number] => {
      const [at, w] = ax === "x" ? ["x", "w"] as const : ["y", "h"] as const
      const a = Math.max(0, g[at])
      const b = Math.min(lim, g[at] + g[w])
      return { ...g, [at]: a, [w]: Math.max(0.1, b - a) }
    }
    if (dir > 0) return { ...p, ...size, grooves: p.grooves.map(clip) }
    // L'origen és al davant: recula i tots els mecanitzats es mouen igual.
    const k = ax === "x" ? "x" : "y"
    const sh = <T extends { x: number; y: number }>(h: T): T => ({ ...h, [k]: h[k] - tj })
    return {
      ...p,
      ...size,
      placement: { ...p.placement, origin: [origin[0]!, origin[1]!, origin[2]! - tj] as typeof origin },
      holes: p.holes.map(sh),
      grooves: p.grooves.map(sh).map(clip),
      ...(p.fittings ? { fittings: p.fittings.map(sh) } : {}),
    }
  })
}
