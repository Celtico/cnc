import { moduleRot, type Carcass, type Module, type Panel, type RefObject, type Vec3 } from "../model"
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
 * ja n'ha retallat les peces i el fons (`applyRefCuts`). Aquí s'hi afegeixen els **fons que falten**, a les cares de la
 * columna que queden dins del mòdul (la del davant i les dels costats), a la mateixa distància de la columna que el fons
 * del darrere, del mateix tauler i gruix, i units com ell. Cada tros de fons que la columna talla en fa els seus (per
 * decisió de l'usuari, 2026-10-21: el fons de cada zona; una zona sense fons, cap; sense base, igual), de la seva alçada:
 *  - **en ranura**: amb les **ranures** a les peces de dalt i de baix on entra (base, tapa o prestatge fix);
 *  - **encastat**: a la llum, amb **espigues** a les peces de dalt i de baix i als laterals on hi topa (com el fons
 *    encastat; amb menys de 15 mm, sense, com el del darrere);
 *  - **cargolat**: a la cara de la columna, i les peces del mòdul es retallen un gruix de fons més perquè els fons nous es
 *    cargolin als seus cantells (com el del darrere).
 * Una columna que no és una caixa vertical, que no toca el darrere o que travessa tot el mòdul no s'hi tanca: avís.
 */
export function columnWalls(
  panels: Panel[],
  refs: RefObject[],
  modules: { id: string; index: number; module: Module; backKinds?: Record<string, Carcass["back"]> }[],
  boxOf: (p: Panel) => Box,
): { added: Panel[]; removed: Set<Panel>; problems: ColumnWallProblem[] } {
  const added: Panel[] = []
  const removed = new Set<Panel>()
  const problems: ColumnWallProblem[] = []
  const pillars = mergePillars(refs)
  for (const { id, index, module, backKinds } of modules) {
    const c = module.carcass
    // Un mòdul girat a un costat (90° o 270°) té el fons al llarg de x: es treballa girat (el fons al llarg de z, com un
    // mòdul endavant) i les peces, els punts i els talls es tornen al món.
    const turned = moduleRot(module) === 90 || moduleRot(module) === 270
    const F = (v: readonly number[]): Vec3 => (turned ? [v[2]!, v[1]!, -v[0]!] : [v[0]!, v[1]!, v[2]!])
    const W = (v: readonly number[]): Vec3 => (turned ? [-v[2]!, v[1]!, v[0]!] : [v[0]!, v[1]!, v[2]!])
    const box = (p: Panel): Box => {
      const q = boxOf(p)
      const a = F(q.min), b = F(q.max)
      return { min: [Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])], max: [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])] }
    }
    const toWorldRef = (o: RefObject): RefObject => (turned ? { ...o, x: -(o.z + o.d), w: o.d, z: o.x, d: o.w } : o)
    const framed = (origin: Vec3, xa: Vec3, ya: Vec3, za: Vec3, ex: Vec3) => placement(W(origin), W(xa), W(ya), W(za), W(ex))
    const mine = panels.filter((p) => p.module === index)
    // El tipus de cada tros de fons (el del mòdul o el de la seva zona); un tros tallat per la columna (`-2`…), el seu.
    const kindOf = (p: Panel): Carcass["back"] | undefined => {
      if (p.role !== "back" || p.id.includes(":colback")) return undefined
      let local = p.id.slice(id.length + 1)
      while (local) {
        const k = backKinds?.[local] ?? (local === "back" ? c.back : undefined)
        if (k) return k
        const cut = local.match(/^(.*)-\d+$/)
        if (!cut) return undefined
        local = cut[1]!
      }
      return undefined
    }
    const backs = mine.filter((p) => kindOf(p) && kindOf(p) !== "none")
    if (!backs.length) continue
    // La caixa sense el fons: un fons cargolat va darrere dels laterals, i la distància a la columna es compta des d'aquí.
    const shell = mine.filter((p) => p.role === "side" || p.role === "bottom" || p.role === "top").map(box)
    if (!shell.length) continue
    const bb = shell.reduce((a, b) => ({ min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])] as Vec3, max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])] as Vec3 }))
    // El darrere del mòdul: on és el fons respecte de la caixa (un mòdul girat 180° el té al davant).
    const kb0 = box(backs[0]!)
    const rearMin = (kb0.min[2] + kb0.max[2]) / 2 < (bb.min[2] + bb.max[2]) / 2
    const dir = rearMin ? 1 : -1
    const cols = pillars.map((w0): RefObject => (turned ? { ...w0, x: w0.z, w: w0.d, z: -(w0.x + w0.w), d: w0.w } : w0))
    // Una columna que s'ha menjat tot el darrere dels laterals (un mòdul més estret que entre dues columnes): la caixa
    // que queda comença davant seu, però el darrere del mòdul és a la paret, on comença la columna (o a la fondària).
    for (const o of cols) {
      if (o.x + o.w <= bb.min[0] + 1 || o.x >= bb.max[0] - 1) continue
      if (rearMin && o.z < bb.min[2] - 1 && o.z + o.d >= bb.min[2] - 1) bb.min[2] = Math.max(o.z, bb.max[2] - c.depth)
      if (!rearMin && o.z + o.d > bb.max[2] + 1 && o.z <= bb.max[2] + 1) bb.max[2] = Math.min(o.z + o.d, bb.min[2] + c.depth)
    }
    const rearZ = rearMin ? bb.min[2] : bb.max[2]
    // Les peces horitzontals i verticals on poden entrar (ranura) o topar (espigues) els fons nous.
    const flats = mine.filter((p) => p.role === "bottom" || p.role === "top" || p.role === "fixedShelf")
    const uprights = mine.filter((p) => p.role === "side" || p.role === "divider")
    let dowel: ReturnType<typeof dowelSpec> | undefined
    const dowelOf = () => {
      try {
        dowel ??= dowelSpec(module.hardware.dowel)
      } catch {
        dowel = undefined
      }
      return dowel
    }
    let k = 0
    for (const o of cols) {
      const cx0 = o.x, cx1 = o.x + o.w, cz0 = o.z, cz1 = o.z + o.d
      const x0 = Math.max(cx0, bb.min[0]), x1 = Math.min(cx1, bb.max[0])
      const z0 = Math.max(cz0, bb.min[2]), z1 = Math.min(cz1, bb.max[2])
      // Només les que pugen de terra (una columna de la casa) i arriben al mòdul; un tall de més amunt (pica, placa), no.
      if (x1 - x0 < 1 || z1 - z0 < 1 || o.y + o.h < bb.min[1]) continue
      // Els trossos de fons que la columna ha tallat: els que toquen la columna pels costats (o la tenen a dins). Els que
      // queden tot darrere seu (les tires entre els forats de les zones) no hi són (`buildComposition` els treu).
      const near = backs.filter((p) => {
        const q = box(p)
        return q.max[0] >= cx0 - 1 && q.min[0] <= cx1 + 1 && (q.min[0] < cx0 - 1 || q.max[0] > cx1 + 1)
      })
      if (!near.length) continue
      const touchesRear = rearMin ? cz0 <= bb.min[2] + 1 : cz1 >= bb.max[2] - 1
      const throughFront = rearMin ? cz1 >= bb.max[2] - 1 : cz0 <= bb.min[2] + 1
      if (!touchesRear || throughFront) {
        problems.push({ refId: o.id, panel: near[0]!, message: `«${o.name}» ${throughFront ? "travessa tot el mòdul de darrere a davant" : "no toca el darrere del mòdul"}: el moble no s'hi tanca sol (els fons que falten s'han de posar a mà).` })
        continue
      }
      // Trams d'alçada: a cada un, el fons que hi ha a l'esquerra i a la dreta de la columna (una zona sense fons a un
      // costat, aquell costat no es tanca).
      type Seg = { kind: Carcass["back"]; y0: number; y1: number; own0: boolean; own1: boolean; hasL: boolean; hasR: boolean; xl: number; xr: number; zr: number; tb: number; tpl: Panel }
      const segs: Seg[] = []
      const ys = [...new Set(near.flatMap((p) => [box(p).min[1], box(p).max[1]]).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b)
      for (let i = 0; i + 1 < ys.length; i++) {
        const ya = ys[i]!, yb = ys[i + 1]!
        if (yb - ya < 1) continue
        const here = near.filter((p) => box(p).min[1] < ya + 0.5 && box(p).max[1] > yb - 0.5)
        if (!here.length) continue
        const L = here.filter((p) => box(p).min[0] < cx0 - 1), R = here.filter((p) => box(p).max[0] > cx1 + 1)
        const tpl = L[0] ?? R[0]!
        const q = box(tpl)
        const kind = kindOf(tpl)!
        const zr = rearMin ? q.min[2] : q.max[2]
        const xl = L.length ? Math.min(...L.map((p) => box(p).min[0])) : x0
        const xr = R.length ? Math.max(...R.map((p) => box(p).max[0])) : x1
        // Si el tram comença o s'acaba on un fons hi comença o s'hi acaba (`own`), el fons ja té l'alçada bona (en ranura,
        // dins la peça); si no (és l'altre costat que canvia), cal buscar la peça que hi ha.
        const own0 = here.some((p) => Math.abs(box(p).min[1] - ya) < 1), own1 = here.some((p) => Math.abs(box(p).max[1] - yb) < 1)
        const last = segs[segs.length - 1]
        if (last && Math.abs(last.y1 - ya) < 0.5 && last.kind === kind && last.hasL === L.length > 0 && last.hasR === R.length > 0 && Math.abs(last.xl - xl) < 1 && Math.abs(last.xr - xr) < 1 && Math.abs(last.zr - zr) < 0.5 && last.tb === tpl.thickness) {
          last.y1 = yb
          last.own1 = own1
        } else segs.push({ kind, y0: ya, y1: yb, own0, own1, hasL: L.length > 0, hasR: R.length > 0, xl, xr, zr, tb: tpl.thickness, tpl })
      }
      if (!segs.length) continue
      // Un tram que comença al mig d'una peça horitzontal (un prestatge fix gruixut on el fons de l'altre costat s'acaba):
      // el fons nou comença a sobre de la peça (en ranura, dins seu), i s'acaba a sota.
      const stack = mine.filter((p) => (p.role === "fixedShelf" || p.role === "bottom" || p.role === "top" || p.role === "spacer") && box(p).max[0] > x0 + 1 && box(p).min[0] < x1 - 1).map(box)
      for (const sg of segs) {
        const g = sg.kind === "groove" ? c.grooveDepth : 0
        let y = sg.y0
        for (let q = stack.find((b) => b.min[1] < y + 0.5 && b.max[1] > y + 0.5); !sg.own0 && q; q = stack.find((b) => b.min[1] < y + 0.5 && b.max[1] > y + 0.5)) y = q.max[1]
        if (y > sg.y0) sg.y0 = Math.min(sg.y1, y - g)
        y = sg.y1
        for (let q = stack.find((b) => b.min[1] < y - 0.5 && b.max[1] > y - 0.5); !sg.own1 && q; q = stack.find((b) => b.min[1] < y - 0.5 && b.max[1] > y - 0.5)) y = q.min[1]
        if (y < sg.y1) sg.y1 = Math.max(sg.y0, y + g)
      }
      if (o.y + o.h < Math.max(...segs.map((g) => g.y1)) - 1) {
        problems.push({ refId: o.id, panel: near[0]!, message: `«${o.name}» no arriba a la tapa del mòdul (on s'acaba el fons): si és una columna de terra a sostre, fes-la més alta (Alt) i el moble s'hi tancarà amb els fons que falten.` })
        continue
      }
      // Cargolat: les peces del mòdul (no els fons) es retallen un gruix de fons més, perquè els fons nous hi cargolin.
      const sc = segs.find((g) => g.kind === "screwed")
      if (sc) {
        const tb = sc.tb
        const grown: RefObject = { ...o, id: `${o.id}-screwed`, x: o.x - tb, z: o.z - tb, w: o.w + 2 * tb, d: o.d + 2 * tb }
        for (const pr of applyRefCuts(mine.filter((p) => p.role !== "back" && !removed.has(p)), [toWorldRef(grown)], boxOf, undefined, added)) if (pr.eaten) removed.add(pr.panel)
      }
      for (const sg of segs) {
        const { kind, tb } = sg
        const groove = kind === "groove", inset = kind === "inset", screwed = kind === "screwed"
        // A la mateixa distància de la columna que el fons tallat del darrere de la caixa.
        const s = Math.max(0, (sg.zr - rearZ) * dir)
        const g = groove ? c.grooveDepth : 0
        const gw = tb + (groove ? (c.grooveClearance ?? 0) : 0)
        const bc = groove ? c.backClearance : 0
        const yLo = sg.y0, yHi = sg.y1
        // De costat a costat del fons tallat; en ranura, fins a la cara de les peces dels costats (el fons hi entrava). On la
        // columna se n'ha endut la vora (arriba a un lateral o un divisor), la cara de la peça que el tancava.
        const crossY = (q: Box) => q.max[1] > yLo + 1 && q.min[1] < yHi - 1
        // Sense fons a un costat, el fons del davant s'acaba a la columna, o a la peça que la toca (un lateral, un divisor).
        const atL = sg.hasL ? undefined : uprights.map(box).filter((q) => crossY(q) && q.min[0] < x0 + 1 && q.max[0] >= cx0 - 1 && q.max[0] < x1).sort((a, b) => b.max[0] - a.max[0])[0]
        const atR = sg.hasR ? undefined : uprights.map(box).filter((q) => crossY(q) && q.max[0] > x1 - 1 && q.min[0] <= cx1 + 1 && q.min[0] > x0).sort((a, b) => a.min[0] - b.min[0])[0]
        const ix0 = sg.hasL ? sg.xl + g - bc / 2 : atL ? (screwed ? atL.min[0] : atL.max[0]) : x0
        const ix1 = sg.hasR ? sg.xr - g + bc / 2 : atR ? (screwed ? atR.max[0] : atR.min[0]) : x1
        const zFace = rearMin ? z1 : z0
        const zw0 = rearMin ? zFace + s : zFace - s - tb
        const zg0 = rearMin ? zFace + s : zFace - s - gw
        const hasLeft = sg.hasL && (screwed ? cx0 : x0) > ix0 + 1
        const hasRight = sg.hasR && (screwed ? cx1 : x1) < ix1 - 1
        const wallX0 = hasLeft ? x0 - s - tb : ix0
        const wallX1 = hasRight ? x1 + s + tb : ix1
        const backFront = sg.zr + dir * tb
        // Les peces de dins (prestatges, divisors) s'aturen davant dels fons nous, com davant del fons del darrere.
        if (!screwed) {
          const ext = s + tb
          const ax0 = hasLeft ? x0 - ext : cx0, ax1 = hasRight ? x1 + ext : cx1
          const wall: RefObject = { ...o, id: `${o.id}-wall`, x: ax0, w: ax1 - ax0, y: yLo + 0.5, h: yHi - yLo - 1, z: rearMin ? cz0 : cz0 - ext, d: cz1 - cz0 + ext }
          const inner = [...mine, ...added].filter((p) => p.module === index && !INNER_SKIP.has(p.role) && !p.id.includes(":colback") && !removed.has(p))
          for (const pr of applyRefCuts(inner, [toWorldRef(wall)], boxOf, undefined, added)) if (pr.eaten) removed.add(pr.panel)
        }
        // Les peces de baix i de dalt on entra (ranura) o topa (espigues) aquest fons.
        const span = (p: Panel) => {
          const q = box(p)
          return q.max[0] > wallX0 + 1 && q.min[0] < wallX1 - 1
        }
        const below = flats.find((p) => span(p) && box(p).max[1] >= yLo - 0.5 && box(p).max[1] <= yLo + g + 1)
        const above = flats.find((p) => span(p) && box(p).min[1] <= yHi + 0.5 && box(p).min[1] >= yHi - g - 1)
        const ends = (x: number) => uprights.find((p) => {
          const q = box(p)
          return (Math.abs(q.max[0] - x) < 1 || Math.abs(q.min[0] - x) < 1) && q.max[1] > yLo + 1 && q.min[1] < yHi - 1
        })
        type Wall = { pl: ReturnType<typeof placement>; length: number; groove: [number, number, number, number]; along: "x" | "z"; from: number; to: number; mid: number; ends: Panel[] }
        const walls: Wall[] = []
        const endL = !hasLeft ? ends(wallX0) : undefined
        const endR = !hasRight ? ends(wallX1) : undefined
        // Fons del davant de la columna (paral·lel al del darrere). Encastat, espigues als laterals on hi topa.
        walls.push({
          // A l'explosió, cap al davant (lluny de la columna i del fons de darrere, que va cap a la paret).
          pl: framed([wallX0 + (hasLeft ? 0 : bc / 2), yLo, zw0], X, Y, Z, [0, 0, dir]),
          length: wallX1 - wallX0 - (hasLeft ? 0 : bc / 2) - (hasRight ? 0 : bc / 2),
          groove: [wallX0, wallX1, zg0, zg0 + gw],
          along: "x",
          from: wallX0,
          to: wallX1,
          mid: zw0 + tb / 2,
          ends: [...(endL ? [endL] : []), ...(endR ? [endR] : [])],
        })
        // Fons dels costats de la columna: del fons del darrere al del davant.
        const sideZ0 = rearMin ? backFront : zw0 + tb
        const sideZ1 = rearMin ? zw0 : backFront
        if (sideZ1 - sideZ0 > 1) {
          if (hasRight) walls.push({ pl: framed([x1 + s, yLo, sideZ0], Z, Y, X, [1, 0, 0]), length: sideZ1 - sideZ0, groove: [x1 + s, x1 + s + gw, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)], along: "z", from: sideZ0, to: sideZ1, mid: x1 + s + tb / 2, ends: [] })
          if (hasLeft) walls.push({ pl: framed([x0 - s - tb, yLo, sideZ0], Z, Y, X, [-1, 0, 0]), length: sideZ1 - sideZ0, groove: [x0 - s - gw, x0 - s, Math.min(sideZ0, sideZ1), Math.max(sideZ0, sideZ1)], along: "z", from: sideZ0, to: sideZ1, mid: x0 - s - tb / 2, ends: [] })
        }
        const dw = inset && tb >= 15 ? dowelOf() : undefined
        for (const w of walls) {
          k++
          const height = yHi - yLo
          if (w.length < 5 || height < 5) continue
          // Un fons de costat va amb l'eix u al llarg de z: el pla és Z·Y i la normal X (l'origen, a la cantonada de z menor).
          const p: Panel = {
            ...sg.tpl,
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
          if (groove) {
            if (below) addGroove(below, box(below), w.groove, box(below).max[1], g, W)
            if (above) addGroove(above, box(above), w.groove, box(above).min[1], g, W)
          }
          // Encastat: espigues com el fons encastat (tres per costat, a `endOffset` dels extrems).
          if (dw) {
            for (const host of [below, above]) {
              if (!host) continue
              const yFace = host === below ? box(host).max[1] : box(host).min[1]
              const pts = threeAlong(Math.min(w.from, w.to), Math.max(w.from, w.to), dw.endOffset).map((t): Vec3 => (w.along === "x" ? [t, yFace, w.mid] : [w.mid, yFace, t]))
              dowelJoint(wall, host, pts.map(W), dw, dw.tag)
            }
            for (const side of w.ends) {
              const xFace = Math.abs(box(side).max[0] - w.from) < 1 ? box(side).max[0] : box(side).min[0]
              dowelJoint(wall, side, threeAlong(yLo, yHi, dw.endOffset).map((y): Vec3 => W([xFace, y, w.mid])), dw, dw.tag)
            }
          }
        }
      }
    }
  }
  return { added: added.filter((p) => !removed.has(p)), removed, problems }
}

/** Peces que els fons nous no retallen: el fons i la caixa (hi entren en ranura o hi topen). */
const INNER_SKIP = new Set<Panel["role"]>(["back", "side", "bottom", "top"])

/**
 * Les columnes de terra, juntant les que es toquen o es trepitgen (dues còpies una al costat de l'altra, o una a sobre
 * de l'altra): el moble es tanca al voltant de totes dues com si fossin una.
 */
function mergePillars(refs: RefObject[]): RefObject[] {
  const out: RefObject[] = []
  for (const o of refs) {
    if (o.effect !== "cut" || o.id.startsWith("part:") || !isPillar(o) || o.y > 1) continue
    let cur: RefObject = { ...o, y: 0 }
    for (let i = out.length - 1; i >= 0; i--) {
      const p = out[i]!
      const touch = p.x <= cur.x + cur.w + 1 && cur.x <= p.x + p.w + 1 && p.z < cur.z + cur.d && cur.z < p.z + p.d
      if (!touch) continue
      const x = Math.min(p.x, cur.x), z = Math.min(p.z, cur.z)
      cur = { ...p, x, z, w: Math.max(p.x + p.w, cur.x + cur.w) - x, d: Math.max(p.z + p.d, cur.z + cur.d) - z, h: Math.max(p.h, cur.h) }
      out.splice(i, 1)
      i = out.length
    }
    out.push(cur)
  }
  return out
}

/** Ranura de la base o la tapa sota un fons nou: el rectangle [x0, x1] × [z0, z1] a la cara de dins (`y`). */
function addGroove(host: Panel, hb: Box, [x0, x1, z0, z1]: [number, number, number, number], y: number, depth: number, W: (v: Vec3) => Vec3): void {
  const a = toLocal(host, W([Math.max(x0, hb.min[0]), y, Math.max(z0, hb.min[2])]))
  const b = toLocal(host, W([Math.min(x1, hb.max[0]), y, Math.min(z1, hb.max[2])]))
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
 * Una columna de la casa (pilar): una caixa. Una caixa llisa és la mateixa caixa sigui quina sigui la direcció
 * (`axis`); amb perfil o malla, només si va de dret (eix vertical).
 */
export function isPillar(o: RefObject): boolean {
  if ((o.shape ?? "box") !== "box") return false
  return (!o.profile && !o.mesh) || o.axis === "y"
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
    if (o.effect !== "cut" || !isPillar(o) || o.y > 1) continue
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
