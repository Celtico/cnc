import type { Module, Panel, RefObject, Vec3 } from "../model"
import { normalizePanel } from "./buildCabinet"
import { X, Y, Z, dowelJoint, placement, r, threeAlong, toLocal, toWorld } from "./geometry"
import { dowelSpec } from "./hardware"
import { applyRefCuts } from "./refCuts"

type Box = { min: Vec3; max: Vec3 }

interface ColumnWallProblem {
  refId: string
  panel: Panel
  message: string
}

/**
 * Moble tancat al voltant d'una columna (per decisió de l'usuari, 2026-10-14: «ha de fer les ranures i les traseres que
 * falten»): una columna de la casa (objecte de referència que talla, caixa vertical) que entra pel darrere d'un mòdul
 * ja n'ha retallat la base, la tapa, els prestatges, el fons i els laterals (`applyRefCuts`). Aquí s'hi afegeixen els
 * **fons que falten**, a les cares de la columna que queden dins del mòdul (la del davant i les dels costats), a la
 * mateixa distància de la columna que el fons del darrere, del mateix tauler i gruix que el fons, i units com el fons:
 *  - **en ranura**: a `backSetback`, amb les **ranures** a la base i a la tapa (fondària i joc de sempre);
 *  - **encastat**: a `backInsetSetback`, a la llum (de la base a la tapa) i amb **espigues** a la base, la tapa i els
 *    laterals on hi topa (com el fons encastat; amb menys de 15 mm, sense, com el del darrere);
 *  - **cargolat**: a la cara de la columna, de l'alçada del fons del darrere, i les peces del mòdul es retallen un gruix
 *    de fons més perquè els fons nous es cargolin als seus cantells (com el del darrere).
 * Una columna que no és una caixa vertical, que no toca el darrere o que travessa tot el mòdul no s'hi tanca: avís.
 */
export function columnWalls(
  panels: Panel[],
  refs: RefObject[],
  modules: { id: string; index: number; module: Module }[],
  boxOf: (p: Panel) => Box,
): { added: Panel[]; problems: ColumnWallProblem[] } {
  const added: Panel[] = []
  const problems: ColumnWallProblem[] = []
  for (const { id, index, module } of modules) {
    const c = module.carcass
    if (c.back === "none") continue
    const own = (suffix: string) => panels.find((p) => p.module === index && p.id === `${id}:${suffix}`)
    const base = own("bottom")
    const back = own("back")
    if (!base || !back) continue
    const top = own("top")
    const left = own("side-left")
    const right = own("side-right")
    // La petjada de la base: la de tots els seus trossos (una columna que la parteix en deixa dos).
    const bb = panels
      .filter((p) => p.module === index && (p.id === base.id || p.id.startsWith(`${base.id}-`)))
      .map(boxOf)
      .reduce((a, b) => ({ min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])], max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])] }))
    const kb = boxOf(back)
    const tb = back.thickness
    const groove = c.back === "groove"
    const inset = c.back === "inset"
    const screwed = c.back === "screwed"
    const s = groove ? c.backSetback : inset ? (c.backInsetSetback ?? 0) : 0
    const g = groove ? c.grooveDepth : 0
    const gw = tb + (groove ? (c.grooveClearance ?? 0) : 0)
    const bc = groove ? c.backClearance : 0
    // El darrere del mòdul: on és el fons respecte de la base (un mòdul girat 180° el té al davant).
    const rearMin = (kb.min[2] + kb.max[2]) / 2 < (bb.min[2] + bb.max[2]) / 2
    const dir = rearMin ? 1 : -1
    // Cares de dins dels laterals (la base pot anar a inglet, de fora a fora); cargolat, les de fora (el fons els tapa).
    const ix0 = left ? (screwed ? boxOf(left).min[0] : boxOf(left).max[0]) : bb.min[0]
    const ix1 = right ? (screwed ? boxOf(right).max[0] : boxOf(right).min[0]) : bb.max[0]
    const sidesTop = Math.max(...panels.filter((p) => p.module === index && p.role === "side").map((p) => boxOf(p).max[1]), bb.max[1])
    const yLo = screwed ? kb.min[1] : bb.max[1] - g + bc / 2
    const yHi = screwed ? kb.max[1] : (top ? boxOf(top).min[1] + g : sidesTop) - bc / 2
    let dowel: ReturnType<typeof dowelSpec> | undefined
    try {
      dowel = inset && tb >= 15 ? dowelSpec(module.hardware.dowel) : undefined
    } catch {
      dowel = undefined
    }
    let k = 0
    for (const o of refs) {
      if (o.effect !== "cut" || o.id.startsWith("part:")) continue
      if (o.shape === "cylinder" || o.shape === "profile" || (o.axis ?? "z") !== "y") continue
      const cx0 = o.x, cx1 = o.x + o.w, cz0 = o.z, cz1 = o.z + o.d
      // Ha de tocar la base i anar de la base a la tapa.
      const x0 = Math.max(cx0, bb.min[0]), x1 = Math.min(cx1, bb.max[0])
      const z0 = Math.max(cz0, bb.min[2]), z1 = Math.min(cz1, bb.max[2])
      // Només les que pugen de terra (una columna de la casa) i arriben a la base; un tall de més amunt (pica, placa), no.
      if (x1 - x0 < 1 || z1 - z0 < 1 || o.y > 1 || o.y + o.h < bb.min[1]) continue
      // Una columna de terra a sostre: si no arriba a la tapa, el moble no s'hi pot tancar (i ho diu).
      if (o.y + o.h < (screwed ? yHi : top ? boxOf(top).min[1] : sidesTop)) {
        problems.push({ refId: o.id, panel: base, message: `«${o.name}» no arriba a la tapa del mòdul: si és una columna de terra a sostre, fes-la més alta (Alt) i el moble s'hi tancarà amb els fons que falten.` })
        continue
      }
      const touchesRear = rearMin ? cz0 <= bb.min[2] + 1 : cz1 >= bb.max[2] - 1
      const throughFront = rearMin ? cz1 >= bb.max[2] - 1 : cz0 <= bb.min[2] + 1
      if (!touchesRear || throughFront) {
        problems.push({ refId: o.id, panel: base, message: `«${o.name}» ${throughFront ? "travessa tot el mòdul de darrere a davant" : "no toca el darrere del mòdul"}: el moble no s'hi tanca sol (els fons que falten s'han de posar a mà).` })
        continue
      }
      // Cargolat: les peces del mòdul (no els fons) es retallen un gruix de fons més, perquè els fons nous hi cargolin.
      if (screwed) {
        const grown: RefObject = { ...o, id: `${o.id}-screwed`, x: o.x - tb, z: o.z - tb, w: o.w + 2 * tb, d: o.d + 2 * tb }
        applyRefCuts(panels.filter((p) => p.module === index && p.role !== "back"), [grown], boxOf, undefined, added)
      }
      // La cara del davant de la columna i els fons que hi falten.
      const zFace = rearMin ? z1 : z0
      const zw0 = rearMin ? zFace + s : zFace - s - tb
      const zg0 = rearMin ? zFace + s : zFace - s - gw
      // Hi ha cara de costat si la columna no arriba a la vora del mòdul (cargolat, la de fora dels laterals).
      const hasLeft = (screwed ? cx0 : x0) > ix0 + 1
      const hasRight = (screwed ? cx1 : x1) < ix1 - 1
      const wallX0 = hasLeft ? x0 - s - tb : ix0
      const wallX1 = hasRight ? x1 + s + tb : ix1
      const backFront = rearMin ? kb.max[2] : kb.min[2]
      type Wall = { pl: ReturnType<typeof placement>; length: number; groove: [number, number, number, number]; along: "x" | "z"; from: number; to: number; mid: number; ends: Panel[] }
      const walls: Wall[] = []
      // Fons del davant de la columna (paral·lel al del darrere). Encastat, espigues als laterals on hi topa.
      walls.push({
        // A l'explosió, cap al davant (lluny de la columna i del fons de darrere, que va cap a la paret).
        pl: placement([wallX0 + (hasLeft ? 0 : bc / 2), yLo, zw0], X, Y, Z, [0, 0, dir]),
        length: wallX1 - wallX0 - (hasLeft ? 0 : bc / 2) - (hasRight ? 0 : bc / 2),
        groove: [wallX0, wallX1, zg0, zg0 + gw],
        along: "x",
        from: wallX0,
        to: wallX1,
        mid: zw0 + tb / 2,
        ends: [...(!hasLeft && left ? [left] : []), ...(!hasRight && right ? [right] : [])],
      })
      // Fons dels costats de la columna: del fons del darrere al del davant.
      const sideZ0 = rearMin ? backFront : zw0 + tb
      const sideZ1 = rearMin ? zw0 : backFront
      if (sideZ1 - sideZ0 > 1) {
        if (hasRight) walls.push({ pl: placement([x1 + s, yLo, sideZ0], Z, Y, X, [1, 0, 0]), length: sideZ1 - sideZ0, groove: [x1 + s, x1 + s + gw, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)], along: "z", from: sideZ0, to: sideZ1, mid: x1 + s + tb / 2, ends: [] })
        if (hasLeft) walls.push({ pl: placement([x0 - s - tb, yLo, sideZ0], Z, Y, X, [-1, 0, 0]), length: sideZ1 - sideZ0, groove: [x0 - s - gw, x0 - s, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)], along: "z", from: sideZ0, to: sideZ1, mid: x0 - s - tb / 2, ends: [] })
      }
      for (const w of walls) {
        k++
        const height = yHi - yLo
        if (w.length < 5 || height < 5) continue
        // Un fons de costat va amb l'eix u al llarg de z: el pla és Z·Y i la normal X (l'origen, a la cantonada de z menor).
        const p: Panel = {
          ...back,
          id: `${id}:colback-${o.id}-${k}`,
          label: `Fons columna ${k}`,
          length: r(w.length),
          width: r(height),
          edges: { left: false, right: false, top: false, bottom: false },
          holes: [],
          grooves: [],
          placement: w.pl,
        }
        delete p.outline
        delete p.cutouts
        delete p.mitres
        const wall = normalizePanel(p)
        added.push(wall)
        if (groove) for (const host of [base, top]) if (host) addGroove(host, boxOf(host), w.groove, host === base ? bb.max[1] : boxOf(host).min[1], g)
        // Encastat: espigues com el fons encastat (tres per costat, a `endOffset` dels extrems).
        if (dowel) {
          for (const host of [base, top]) {
            if (!host) continue
            const yFace = host === base ? bb.max[1] : boxOf(host).min[1]
            const pts = threeAlong(Math.min(w.from, w.to), Math.max(w.from, w.to), dowel.endOffset).map((t): Vec3 => (w.along === "x" ? [t, yFace, w.mid] : [w.mid, yFace, t]))
            dowelJoint(wall, host, pts, dowel, dowel.tag)
          }
          for (const side of w.ends) {
            const xFace = side === left ? boxOf(side).max[0] : boxOf(side).min[0]
            dowelJoint(wall, side, threeAlong(yLo, yHi, dowel.endOffset).map((y): Vec3 => [xFace, y, w.mid]), dowel, dowel.tag)
          }
        }
      }
    }
  }
  return { added, problems }
}

/** Ranura de la base o la tapa sota un fons nou: el rectangle [x0, x1] × [z0, z1] a la cara de dins (`y`). */
function addGroove(host: Panel, hb: Box, [x0, x1, z0, z1]: [number, number, number, number], y: number, depth: number): void {
  const a = toLocal(host, [Math.max(x0, hb.min[0]), y, Math.max(z0, hb.min[2])])
  const b = toLocal(host, [Math.min(x1, hb.max[0]), y, Math.min(z1, hb.max[2])])
  const u0 = Math.max(0, Math.min(a[0], b[0])), u1 = Math.min(host.length, Math.max(a[0], b[0]))
  const v0 = Math.max(0, Math.min(a[1], b[1])), v1 = Math.min(host.width, Math.max(a[1], b[1]))
  if (u1 - u0 < 1 || v1 - v0 < 0.5) return
  const face = Math.abs(a[2] - host.thickness) < 0.51 ? "A" : "B"
  host.grooves = [...host.grooves, { x: r(u0), y: r(v0), w: r(u1 - u0), h: r(v1 - v0), depth, face, tag: "back" }]
}

/**
 * On van les potes d'una base retallada (per una columna): una a cada cantonada que sobresurt del contorn de la base
 * (vista de dalt, x·z del moble), a `inset` de cada costat; una base rectangular dona les quatre de sempre. Les
 * cantonades de dins (la de l'osca) no en porten. Sense contorn, cap (es fan les de sempre). Amb una distància per a cada
 * costat (`LegInsets`, la AXILO 78: les del davant més endins, pel sòcol), cada cantell del contorn pren la del costat cap
 * on mira (davant +Z, darrere −Z, esquerra −X, dreta +X; els de l'osca també): les potes queden on les posa una base
 * sencera.
 */
interface LegInsets {
  front: number
  back: number
  left: number
  right: number
}

/** Distància mínima entre dues potes (centre a centre): la placa de la AXILO 78 fa 92 × 79. */
const LEG_MIN_GAP = 110

/** Una pota de la base sencera a menys d'això d'una cantonada del contorn és la d'aquella cantonada: es queda on era. */
const KEEP_LEG = 80

export function legPoints(base: Panel, inset: number | LegInsets): [number, number][] | undefined {
  if (!base.outline || base.outline.length < 3) return undefined
  const pts = base.outline.map((q) => {
    const w = toWorldXZ(base, q[0], q[1])
    return w
  })
  // Sentit antihorari al pla x·z (la normal de la base pot girar el contorn).
  const area = pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0)
  const ring = area < 0 ? [...pts].reverse() : pts
  const out: [number, number][] = []
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, a = ring[(i + ring.length - 1) % ring.length]!, b = ring[(i + 1) % ring.length]!
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]]
    const lu = Math.hypot(u[0]!, u[1]!), lv = Math.hypot(v[0]!, v[1]!)
    if (lu < 1 || lv < 1) continue
    // Cantonada que sobresurt: el gir de (p − a) a (b − p) és cap a l'esquerra en un contorn antihorari.
    const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])
    if (cross <= 0) continue
    // Moure's pel cantell p→a allunya la pota del cantell p→b, i al revés.
    const ku = Math.min(edgeInset(inset, p, b), lu / 2)
    const kv = Math.min(edgeInset(inset, a, p), lv / 2)
    const q: [number, number] = [r(p[0] + (u[0]! / lu) * ku + (v[0]! / lv) * kv), r(p[1] + (u[1]! / lu) * ku + (v[1]! / lv) * kv)]
    // Dues cantonades massa a prop (una osca estreta): les potes es trepitjarien (per decisió de l'usuari, 2026-10-14: «aquí
    // es xafen les potes»); n'hi va una sola.
    if (out.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < LEG_MIN_GAP)) continue
    out.push(q)
  }
  return out
}

/** La distància de les potes a un cantell (de `from` a `to`, contorn antihorari a x·z): la del costat cap on mira. */
function edgeInset(inset: number | LegInsets, from: [number, number], to: [number, number]): number {
  if (typeof inset === "number") return inset
  // Normal de fora d'un cantell antihorari: (dz, −dx).
  const nx = to[1] - from[1], nz = -(to[0] - from[0])
  return Math.abs(nz) >= Math.abs(nx) ? (nz > 0 ? inset.front : inset.back) : nx > 0 ? inset.right : inset.left
}

function toWorldXZ(p: Panel, u: number, v: number): [number, number] {
  const { origin: o, xAxis, yAxis } = p.placement
  return [o[0] + u * xAxis[0] + v * yAxis[0], o[2] + u * xAxis[2] + v * yAxis[2]]
}

/**
 * Les columnes que entren pel darrere d'un mòdul (les mateixes de `columnWalls`: caixa vertical que puja de terra i toca
 * el darrere), en coordenades del mòdul: de quina x a quina i fins on arriben (la cara del davant més el fons nou que s'hi
 * posa davant), perquè els calaixos d'aquell tram es facin més curts (`buildModule` `rearLimits`). Un mòdul girat, cap.
 */
export function columnRearLimits(module: Module, refs: RefObject[], place: { x: number; z?: number }): { x0: number; x1: number; z: number }[] {
  const c = module.carcass
  const tb = c.back === "none" ? 0 : c.backThickness
  const s = c.back === "groove" ? c.backSetback : c.back === "inset" ? (c.backInsetSetback ?? 0) : 0
  const mz = place.z ?? 0
  const out: { x0: number; x1: number; z: number }[] = []
  for (const o of refs) {
    if (o.effect !== "cut" || o.shape === "cylinder" || o.shape === "profile" || (o.axis ?? "z") !== "y" || o.y > 1) continue
    if (o.z > mz + 1) continue
    const x0 = o.x - place.x, x1 = o.x + o.w - place.x
    const front = o.z + o.d - mz
    if (x1 <= 0 || x0 >= c.width || front <= 0) continue
    out.push({ x0, x1, z: front + s + tb })
  }
  return out
}

/**
 * Les potes dibuixades per l'app (la AXILO 78: `Panel.fittings` amb `leg`) en una base **retallada** per una columna (amb
 * `outline`): com les genèriques (`legPoints`), una a cada cantonada que sobresurt del contorn, també a les de l'osca, amb
 * la placa sencera dins de la base (si no, aquella pota no es fa i es diu). Els forats i el dibuix es tornen a posar a
 * cada punt, amb el mirall de la dreta. Torna els avisos.
 */
export function relayLegs(panels: Panel[], modules: { index: number; module: Module }[]): { panel: Panel; message: string }[] {
  const problems: { panel: Panel; message: string }[] = []
  for (const { index, module } of modules) {
    const base = module.carcass.base
    const item = base.kind === "legs" ? base.hardware : undefined
    if (!item || item.engine !== "leg" || item.imported) continue
    const bottom = panels.find((p) => p.module === index && p.role === "bottom" && p.outline && p.fittings?.some((f) => f.kind === "leg" && f.leg))
    if (!bottom) continue
    const old = bottom.fittings!.filter((f) => f.kind === "leg" && f.leg)
    const f0 = old[0]!
    const faceZ = f0.face === "A" ? bottom.thickness : 0
    const yFace = toWorld(bottom, [f0.x, f0.y, faceZ])[1]
    const xs = bottom.outline!.map((q) => toWorld(bottom, [q[0], q[1], 0])[0])
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2
    // Les plantilles del dibuix de cada costat (esquerra / dreta: el mirall ja hi és).
    const sideOf = (f: (typeof old)[number]) => (toWorld(bottom, [f.x, f.y, faceZ])[0] < mid ? "left" : "right")
    const tpl = { left: old.find((f) => sideOf(f) === "left") ?? f0, right: old.find((f) => sideOf(f) === "right") ?? f0 }
    const q = item.params
    const or = (v: number | undefined) => (Number.isFinite(v) && v! > 0 ? v! : (q.inset ?? 50))
    const pts = legPoints(bottom, { front: or(q.insetFront), back: or(q.insetBack), left: or(q.insetLeft), right: or(q.insetRight) })
    if (!pts) continue
    const ops = item.targets.find((t) => t.key === "base")?.ops ?? []
    const inside = (x: number, y: number) => {
      const o = bottom.outline!
      let c = false
      for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
        const a = o[i]!, b = o[j]!
        if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c
      }
      return c
    }
    const fittings = bottom.fittings!.filter((f) => !(f.kind === "leg" && f.leg))
    const holes = bottom.holes.filter((h) => h.tag !== "leg")
    // Les potes de la base sencera que encara hi són (les cantonades de fora): es queden on eren (per decisió de l'usuari,
    // 2026-10-16: «no respecta la col·locació de les potes del davant»); la cantonada del contorn només dona les de l'osca.
    const kept = old.filter((f) => inside(f.x, f.y)).map((f) => toWorld(bottom, [f.x, f.y, faceZ])).map((w): [number, number] => [w[0], w[2]])
    const used = new Set<number>()
    const placed = pts.map(([px, pz]): [number, number] => {
      let k = -1
      for (let i = 0; i < kept.length; i++) if (!used.has(i) && Math.hypot(kept[i]![0] - px, kept[i]![1] - pz) < KEEP_LEG && (k < 0 || Math.hypot(kept[i]![0] - px, kept[i]![1] - pz) < Math.hypot(kept[k]![0] - px, kept[k]![1] - pz))) k = i
      if (k < 0) return [px, pz]
      used.add(k)
      return kept[k]!
    })
    let skipped = 0
    for (const [px, pz] of placed) {
      const side = px < mid ? "left" : "right"
      const s = item.params.mirror === 1 && side === "right" ? -1 : 1
      const legHoles = ops.flatMap((op) => {
        if (op.kind !== "drill" || typeof op.u !== "number" || typeof op.v !== "number" || typeof op.d !== "number" || typeof op.depth !== "number") return []
        const l = toLocal(bottom, [px + s * op.u, yFace, pz + op.v])
        return [{ x: r(l[0]), y: r(l[1]), diameter: op.d, depth: Math.min(op.depth, bottom.thickness - 1), face: f0.face, tag: "leg" }]
      })
      // La placa sencera dins de la base: tots els forats i la pota (amb un marge) dins del contorn.
      const at = toLocal(bottom, [px, yFace, pz])
      const fits = legHoles.every((h) => [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => inside(h.x + dx! * (h.diameter / 2 + 1), h.y + dy! * (h.diameter / 2 + 1)))) && inside(at[0], at[1])
      if (!fits) {
        skipped++
        continue
      }
      holes.push(...legHoles)
      fittings.push({ ...tpl[side], x: r(at[0]), y: r(at[1]) })
    }
    bottom.holes = holes
    bottom.fittings = fittings
    if (skipped) problems.push({ panel: bottom, message: `${bottom.label}: la base retallada per la columna no té lloc per a ${skipped === 1 ? "una pota" : `${skipped} potes`} de «${item.name}» (la placa no hi cap sencera): no es fa${skipped === 1 ? "" : "n"}. Afegeix-ne a mà o canvia la mida de la columna.` })
  }
  return problems
}
