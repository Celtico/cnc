import type { Module, Panel, RefObject, Vec3 } from "../model"
import { normalizePanel } from "./buildCabinet"
import { X, Y, Z, placement, r, toLocal } from "./geometry"

type Box = { min: Vec3; max: Vec3 }

export interface ColumnWallProblem {
  refId: string
  panel: Panel
  message: string
}

/**
 * Moble tancat al voltant d'una columna (per decisió de l'usuari, 2026-10-14: «ha de fer les ranures i les traseres que
 * falten»): una columna de la casa (objecte de referència que talla, caixa vertical) que entra pel darrere d'un mòdul
 * ja n'ha retallat la base, la tapa, els prestatges, el fons i els laterals (`applyRefCuts`). Aquí s'hi afegeixen els
 * **fons que falten**, a les cares de la columna que queden dins del mòdul (la del davant i les dels costats), a la
 * mateixa distància de la columna que el fons del darrere (`backSetback`), del mateix tauler i gruix que el fons, i, si
 * el fons va en ranura, les **ranures** a la base i a la tapa (fondària i joc de sempre). Una columna que no és una
 * caixa vertical, que no toca el darrere o que travessa tot el mòdul no s'hi tanca: avís.
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
    const bb = boxOf(base)
    const kb = boxOf(back)
    const tb = back.thickness
    const s = c.backSetback
    const groove = c.back === "groove"
    const g = groove ? c.grooveDepth : 0
    const gw = tb + (groove ? (c.grooveClearance ?? 0) : 0)
    const bc = c.backClearance
    // El darrere del mòdul: on és el fons respecte de la base (un mòdul girat 180° el té al davant).
    const rearMin = (kb.min[2] + kb.max[2]) / 2 < (bb.min[2] + bb.max[2]) / 2
    const dir = rearMin ? 1 : -1
    // Cares de dins dels laterals (la base pot anar a inglet, de fora a fora).
    const ix0 = left ? boxOf(left).max[0] : bb.min[0]
    const ix1 = right ? boxOf(right).min[0] : bb.max[0]
    const yLo = bb.max[1] - g + bc / 2
    const yHi = (top ? boxOf(top).min[1] + g : Math.max(...panels.filter((p) => p.module === index && p.role === "side").map((p) => boxOf(p).max[1]), bb.max[1])) - bc / 2
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
      if (o.y + o.h < yHi) {
        problems.push({ refId: o.id, panel: base, message: `«${o.name}» no arriba a la tapa del mòdul: si és una columna de terra a sostre, fes-la més alta (Alt) i el moble s'hi tancarà amb els fons que falten.` })
        continue
      }
      const touchesRear = rearMin ? cz0 <= bb.min[2] + 1 : cz1 >= bb.max[2] - 1
      const throughFront = rearMin ? cz1 >= bb.max[2] - 1 : cz0 <= bb.min[2] + 1
      if (!touchesRear || throughFront) {
        problems.push({ refId: o.id, panel: base, message: `«${o.name}» ${throughFront ? "travessa tot el mòdul de darrere a davant" : "no toca el darrere del mòdul"}: el moble no s'hi tanca sol (els fons que falten s'han de posar a mà).` })
        continue
      }
      // La cara del davant de la columna i els fons que hi falten.
      const zFace = rearMin ? z1 : z0
      const zw0 = rearMin ? zFace + s : zFace - s - tb
      const zg0 = rearMin ? zFace + s : zFace - s - gw
      const hasLeft = x0 > ix0 + 1
      const hasRight = x1 < ix1 - 1
      const wallX0 = hasLeft ? x0 - s - tb : ix0
      const wallX1 = hasRight ? x1 + s + tb : ix1
      const backFront = rearMin ? kb.max[2] : kb.min[2]
      const walls: { pl: ReturnType<typeof placement>; length: number; groove: [number, number, number, number] }[] = []
      // Fons del davant de la columna (paral·lel al del darrere).
      walls.push({
        pl: placement([wallX0 + (hasLeft ? 0 : bc / 2), yLo, zw0], X, Y, Z, [0, 0, -dir]),
        length: wallX1 - wallX0 - (hasLeft ? 0 : bc / 2) - (hasRight ? 0 : bc / 2),
        groove: [wallX0, wallX1, zg0, zg0 + gw],
      })
      // Fons dels costats de la columna: del fons del darrere al del davant.
      const sideZ0 = rearMin ? backFront : zw0 + tb
      const sideZ1 = rearMin ? zw0 : backFront
      if (sideZ1 - sideZ0 > 1) {
        if (hasRight) walls.push({ pl: placement([x1 + s, yLo, sideZ0], Z, Y, X, [-1, 0, 0]), length: sideZ1 - sideZ0, groove: [x1 + s, x1 + s + gw, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)] })
        if (hasLeft) walls.push({ pl: placement([x0 - s - tb, yLo, sideZ0], Z, Y, X, [1, 0, 0]), length: sideZ1 - sideZ0, groove: [x0 - s - gw, x0 - s, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)] })
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
        added.push(normalizePanel(p))
        if (groove) for (const host of [base, top]) if (host) addGroove(host, boxOf(host), w.groove, host === base ? bb.max[1] : boxOf(host).min[1], g)
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
 * cantonades de dins (la de l'osca) no en porten. Sense contorn, cap (es fan les de sempre).
 */
export function legPoints(base: Panel, inset: number): [number, number][] | undefined {
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
    const k = Math.min(inset, lu / 2, lv / 2)
    out.push([r(p[0] + (u[0]! / lu) * k + (v[0]! / lv) * k), r(p[1] + (u[1]! / lu) * k + (v[1]! / lv) * k)])
  }
  return out
}

function toWorldXZ(p: Panel, u: number, v: number): [number, number] {
  const { origin: o, xAxis, yAxis } = p.placement
  return [o[0] + u * xAxis[0] + v * yAxis[0], o[2] + u * xAxis[2] + v * yAxis[2]]
}
