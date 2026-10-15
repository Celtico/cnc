import type { Panel, RefObject, Vec3 } from "../../core/model"

/**
 * Moviment d'obertura de les peces mòbils (només per al visor: no toca el `core`):
 *  - portes (i reixetes amb frontisses): giren sobre l'eix de les frontisses, fins a 95°;
 *  - abatibles: giren sobre el cantell inferior (cap avall) o superior (cap amunt);
 *  - calaixos: el front i la caixa surten fins a la llargada de la guia.
 * El costat de la frontissa es dedueix de les cassoletes; la direcció de l'abatible,
 * dels seus forats; la llargada de guia, del lateral de la caixa.
 */

const MAX_DOOR_ANGLE = (95 * Math.PI) / 180

export type Motion =
  | { kind: "hinge"; pivot: Vec3; axis: "x" | "y"; sign: 1 | -1; maxAngle: number }
  | { kind: "slide"; dir: Vec3; distance: number }

/** Grup de peces que es mouen juntes (una porta, un calaix sencer). */
export interface MovingGroup {
  id: string
  label: string
  panelIds: string[]
  motion: Motion
}

const box = (p: Panel): { min: Vec3; max: Vec3 } => {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness])
        for (let i = 0; i < 3; i++) {
          const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
          min[i] = Math.min(min[i]!, v)
          max[i] = Math.max(max[i]!, v)
        }
  return { min, max }
}

/** Cap on obre un front: +1 endavant (+Z), −1 enrere (mòdul girat 180°), per l'`explodeDir` de la peça. */
const outSign = (p: Panel): 1 | -1 => (p.placement.explodeDir[2] < 0 ? -1 : 1)

/** Peces mòbils de la composició, agrupades. */
export function movingGroups(panels: Panel[]): MovingGroup[] {
  const groups: MovingGroup[] = []
  const drawers = new Map<string, Panel[]>()

  for (const p of panels) {
    const m = /^(.*?:)?drawer-(\d+)-/.exec(p.id)
    if (m) {
      const key = `${m[1] ?? ""}drawer-${m[2]}`
      const list = drawers.get(key)
      if (list) list.push(p)
      else drawers.set(key, [p])
      continue
    }
    if (p.role === "door" || (p.role === "grille" && p.holes.some((h) => h.tag === "hinge"))) {
      const cups = p.holes.filter((h) => h.tag === "hinge")
      // Una reixeta sense cassoletes és desmuntable (no s'obre); una porta sí, encara que no en tingui (una frontissa
      // que no hi cap o sense confirmar): el costat, el del nom de la porta («door-right» a la dreta).
      if (!cups.length && p.role !== "door") continue
      const b = box(p)
      // Cassoletes a y local petita → frontissa al costat de y = 0 (esquerra en X del mòdul). Un mòdul girat 180°
      // (`explodeDir` cap enrere) obre cap a −Z: la frontissa queda a l'altre costat en X i el pivot, al darrere.
      const out = outSign(p)
      // El costat de les cassoletes al món (no a la peça: una porta pot tenir els eixos locals girats), comparat amb el mig.
      const { origin: o, xAxis: ax, yAxis: ay } = p.placement
      const cx = (b.min[0] + b.max[0]) / 2
      const worldX = (h: { x: number; y: number }) => o[0] + h.x * ax[0] + h.y * ay[0]
      const left = cups.length ? cups.every((h) => (worldX(h) < cx) === out > 0) : !/door(-\d+)?-right$/.test(p.id)
      const pivot: Vec3 = [left === out > 0 ? b.min[0] : b.max[0], b.min[1], out > 0 ? b.min[2] : b.max[2]]
      groups.push({ id: p.id, label: p.label, panelIds: [p.id], motion: { kind: "hinge", pivot, axis: "y", sign: left ? -1 : 1, maxAngle: MAX_DOOR_ANGLE } })
      continue
    }
    if (p.role === "flap") {
      const b = box(p)
      const holes = p.holes.filter((h) => h.tag === "flap")
      // Forats a x local petita (baix) → gira cap avall sobre el cantell inferior.
      const down = holes.length ? holes.every((h) => h.x < p.length / 2) : true
      const out = outSign(p)
      const pivot: Vec3 = [b.min[0], down ? b.min[1] : b.max[1], out > 0 ? b.min[2] : b.max[2]]
      groups.push({ id: p.id, label: p.label, panelIds: [p.id], motion: { kind: "hinge", pivot, axis: "x", sign: down === out > 0 ? 1 : -1, maxAngle: Math.PI / 2 } })
    }
  }

  // Portes i abatibles de vidre (vitrina): el marc, el vidre i el tirador són a `extras` (no són de CNC) amb l'id del front
  // davant (`door-2-left`, `flap-1-glass`…); giren junts sobre el perfil que porta les cassoletes (els pistons de gas,
  // `-strut-`, es queden al moble).
  const glass = new Map<string, Panel[]>()
  for (const p of panels) {
    if (p.name !== "perfil vitrina") continue
    const base = p.id.replace(/-(left|right|top|bottom)$/, "")
    if (base === p.id || glass.has(base)) continue
    const own = /^-(left|right|top|bottom|glass|pull|pull-base)$/
    glass.set(base, panels.filter((q) => q.id.startsWith(base) && own.test(q.id.slice(base.length))))
  }
  for (const [base, parts] of glass) {
    const bars = parts.filter((q) => q.name === "perfil vitrina")
    const hinged = bars.find((q) => q.holes.some((h) => h.tag === "hinge"))
    const where = hinged ? /-(left|right|top|bottom)$/.exec(hinged.id)?.[1] : undefined
    const bs = parts.map(box)
    const b = { min: [0, 1, 2].map((k) => Math.min(...bs.map((x) => x.min[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...bs.map((x) => x.max[k]!))) as Vec3 }
    const out = outSign(bars[0]!)
    const label = bars[0]!.label.replace(/ \(.*\)$/, "")
    if (/(^|[-:])flap-\d+$/.test(base)) {
      const down = where === "bottom"
      const pivot: Vec3 = [b.min[0], down ? b.min[1] : b.max[1], out > 0 ? b.min[2] : b.max[2]]
      groups.push({ id: base, label, panelIds: parts.map((q) => q.id), motion: { kind: "hinge", pivot, axis: "x", sign: down === out > 0 ? 1 : -1, maxAngle: Math.PI / 2 } })
    } else {
      const left = where !== "right"
      const pivot: Vec3 = [left === out > 0 ? b.min[0] : b.max[0], b.min[1], out > 0 ? b.min[2] : b.max[2]]
      groups.push({ id: base, label, panelIds: parts.map((q) => q.id), motion: { kind: "hinge", pivot, axis: "y", sign: left ? -1 : 1, maxAngle: MAX_DOOR_ANGLE } })
    }
  }

  for (const [key, parts] of drawers) {
    const side = parts.find((p) => p.role === "drawerSide")
    // Calaix amb joc paramètric: la guia (fixa al moble, id `kitfix-<k>-kit-slide-…`) diu la llargada.
    const k = /drawer-(\d+)$/.exec(key)?.[1]
    const slide = panels.find((p) => p.role === "hardware" && p.id.includes(`kitfix-${k}-kit-slide-`))
    const front = parts.find((p) => p.role === "drawerFront")
    const distance = side ? side.length : slide ? slide.thickness : front ? Math.min(front.length, 400) : 400
    groups.push({ id: key, label: front?.label ?? key, panelIds: parts.map((p) => p.id), motion: { kind: "slide", dir: [0, 0, front ? outSign(front) : 1], distance } })
  }
  return groups
}

interface Transform {
  /** Rotació (rad) al voltant de l'eix, aplicada respecte al pivot. */
  pivot: Vec3
  rotation: Vec3
  translation: Vec3
}

/** Transformació d'un grup per a una obertura `t` (0..1). */
export function transformAt(motion: Motion, t: number): Transform {
  if (motion.kind === "slide") return { pivot: [0, 0, 0], rotation: [0, 0, 0], translation: [motion.dir[0] * motion.distance * t, motion.dir[1] * motion.distance * t, motion.dir[2] * motion.distance * t] }
  const a = motion.sign * motion.maxAngle * t
  return { pivot: motion.pivot, rotation: motion.axis === "y" ? [0, a, 0] : [a, 0, 0], translation: [0, 0, 0] }
}

function applyTransform(tr: Transform, p: Vec3): Vec3 {
  let [x, y, z] = [p[0] - tr.pivot[0], p[1] - tr.pivot[1], p[2] - tr.pivot[2]]
  const [rx, ry] = tr.rotation
  if (rx) {
    const c = Math.cos(rx)
    const s = Math.sin(rx)
    ;[y, z] = [y * c - z * s, y * s + z * c]
  }
  if (ry) {
    const c = Math.cos(ry)
    const s = Math.sin(ry)
    ;[x, z] = [x * c + z * s, -x * s + z * c]
  }
  return [x + tr.pivot[0] + tr.translation[0], y + tr.pivot[1] + tr.translation[1], z + tr.pivot[2] + tr.translation[2]]
}

/** Caixa englobant d'una peça un cop aplicat el moviment. */
export function movedBox(p: Panel, tr: Transform): { min: Vec3; max: Vec3 } {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness]) {
        const w: Vec3 = [
          o[0] + cx * x[0] + cy * y[0] + cz * z[0],
          o[1] + cx * x[1] + cy * y[1] + cz * z[1],
          o[2] + cx * x[2] + cy * y[2] + cz * z[2],
        ]
        const q = applyTransform(tr, w)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i]!, q[i]!)
          max[i] = Math.max(max[i]!, q[i]!)
        }
      }
  return { min, max }
}

function overlap(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }, tol: number): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i]! <= b.min[i]! + tol || b.max[i]! <= a.min[i]! + tol) return false
  return true
}

interface OpeningCollision {
  groupId: string
  message: string
}

/**
 * Col·lisions amb l'obertura `t`: una peça mòbil que toca una peça fixa (que no sigui
 * del seu propi buit), una peça d'un altre mòdul o un objecte de referència.
 */
export function openingCollisions(panels: Panel[], groups: MovingGroup[], t: number, ghosts: RefObject[] = [], only?: Set<string>): OpeningCollision[] {
  if (t <= 0) return []
  const out: OpeningCollision[] = []
  const moving = new Set(groups.filter((g) => !only || only.has(g.id)).flatMap((g) => g.panelIds))
  const byId = new Map(panels.map((p) => [p.id, p]))
  const staticBoxes = panels.filter((p) => !moving.has(p.id)).map((p) => ({ p, b: box(p) }))
  for (const g of groups) {
    if (only && !only.has(g.id)) continue
    const tr = transformAt(g.motion, t)
    const hits = new Set<string>()
    for (const id of g.panelIds) {
      const p = byId.get(id)
      if (!p) continue
      const mb = movedBox(p, tr)
      for (const s of staticBoxes) {
        // Un calaix o una porta sempre toca la seva pròpia carcassa quan és tancat: només
        // compta si hi entra de debò (més de 2 mm) un cop en moviment.
        if (overlap(mb, s.b, 2)) hits.add(s.p.label + (s.p.module && s.p.module !== p.module ? ` (mòdul ${s.p.module})` : ""))
      }
      for (const gh of ghosts) {
        if (overlap(mb, { min: [gh.x, gh.y, gh.z], max: [gh.x + gh.w, gh.y + gh.h, gh.z + gh.d] }, 2)) hits.add(`«${gh.name}»`)
      }
    }
    if (hits.size) out.push({ groupId: g.id, message: `${g.label} oberta toca ${[...hits].slice(0, 3).join(", ")}.` })
  }
  return out
}
