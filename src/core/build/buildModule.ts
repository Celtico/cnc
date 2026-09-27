import {
  NO_EDGES,
  type Cutout,
  type EdgeBanding,
  type EdgeSide,
  type Front,
  type Module,
  type Panel,
  type PanelRole,
  type Vec3,
  type Zone,
} from "../model"
import { normalizePanel } from "./buildCabinet"
import {
  X,
  Y,
  Z,
  addEdgeHole,
  addFaceHole,
  dowelJoint,
  neg,
  placement,
  r,
  snap,
  system32Ys,
  threeAlong,
  toLocal,
} from "./geometry"
import { MIN_OPEN_RATIO, grilleCutouts, type Rect } from "./grille"
import { layoutZones, type Layout, type ZoneRect } from "./layout"

export interface BuildWarning {
  code:
    | "door-too-wide"
    | "door-too-tall"
    | "shelf-span"
    | "drawer-no-slide"
    | "grille-open-ratio"
    | "layout"
    | "no-side"
    | "material-heat"
    | "collision"
    | "overlap"
  message: string
  zoneId?: string
  panelId?: string
}

export interface ModuleBuild {
  panels: Panel[]
  warnings: BuildWarning[]
  layout: Layout
  /** % d'àrea oberta de cada reixeta, per id de zona (o "top" per a la tapa). */
  openRatios: Record<string, number>
}

/** Mides derivades de la carcassa. */
interface Derived {
  t: number
  tb: number
  W: number
  H: number
  D: number
  sideDepth: number
  sideZ0: number
  backInnerZ: number
  availDepth: number
  /** Llum interior del mòdul. */
  interior: ZoneRect
  hasBase: boolean
  hasTop: boolean
  /** Y de la cara inferior de la base (0 o alçada del sòcol). */
  baseY: number
}

function derive(m: Module): Derived {
  const c = m.carcass
  const t = c.thickness
  const tb = c.backThickness
  const { width: W, height: H, depth: D } = c
  const sideDepth = c.back === "screwed" ? D - tb : D
  const sideZ0 = D - sideDepth
  const backInnerZ = c.back === "groove" ? c.backSetback + tb : c.back === "screwed" ? tb : 0
  const hasBase = c.base.kind !== "open"
  const hasTop = c.top.kind !== "none"
  const baseY = c.base.kind === "plinth" ? c.base.height : 0
  return {
    t,
    tb,
    W,
    H,
    D,
    sideDepth,
    sideZ0,
    backInnerZ,
    availDepth: D - backInnerZ,
    interior: {
      x0: c.sides.left ? t : 0,
      x1: c.sides.right ? W - t : W,
      y0: hasBase ? baseY + t : 0,
      y1: hasTop ? H - t : H,
    },
    hasBase,
    hasTop,
    baseY,
  }
}

function edges(...sides: EdgeSide[]): EdgeBanding {
  const e = { ...NO_EDGES }
  for (const s of sides) e[s] = true
  return e
}

/** Panells verticals registrats (laterals i divisors) per resoldre unions i fileres. */
interface VerticalRef {
  panel: Panel
  /** X de les dues cares (esquerra i dreta). */
  xL: number
  xR: number
  yB: number
  yT: number
  zRear: number
  zFront: number
  outer: boolean
}

/** Panells horitzontals registrats (base, tapa, prestatges fixos). */
interface HorizontalRef {
  panel: Panel
  yBottom: number
  yTop: number
  xL: number
  xR: number
  outer: boolean
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.51

class Builder {
  readonly m: Module
  readonly d: Derived
  readonly panels: Panel[] = []
  readonly warnings: BuildWarning[] = []
  readonly openRatios: Record<string, number> = {}
  readonly verticals: VerticalRef[] = []
  readonly horizontals: HorizontalRef[] = []
  private shelfCount = 0
  private doorZones = 0
  private drawerCount = 0
  private frontCount = 0

  constructor(m: Module) {
    this.m = m
    this.d = derive(m)
  }

  private add(panel: Panel): Panel {
    this.panels.push(panel)
    return panel
  }

  private basePanel(
    id: string,
    name: string,
    label: string,
    role: PanelRole,
    length: number,
    width: number,
    thickness: number,
    material: string,
    grain: Panel["grain"],
    edgesBanded: EdgeBanding,
    pl: Panel["placement"],
  ): Panel {
    return { id, name, label, role, length: r(length), width: r(width), thickness, material, grain, edges: edgesBanded, holes: [], grooves: [], placement: pl }
  }

  // --- Carcassa ---------------------------------------------------------------------

  buildCarcass(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.sides.left) this.buildSide(true)
    if (c.sides.right) this.buildSide(false)
    if (d.hasBase) this.buildHorizontal("bottom")
    if (d.hasTop) this.buildHorizontal("top")
    if (c.back !== "none") this.buildBack()
    if (c.base.kind === "plinth") this.buildPlinth()
  }

  private buildSide(isLeft: boolean): void {
    const { m, d } = this
    const c = m.carcass
    const { t, H, sideDepth } = d
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      const gy0 = d.hasBase ? d.interior.y0 - g : d.interior.y0
      const gy1 = d.hasTop ? d.interior.y1 + g : d.interior.y1
      grooves.push({
        x: r(gy0),
        y: isLeft ? r(c.backSetback) : r(sideDepth - c.backSetback - d.tb),
        w: r(gy1 - gy0),
        h: d.tb,
        depth: g,
        face: "A",
        tag: "back",
      })
    }
    const pl = isLeft
      ? placement([0, 0, d.sideZ0], Y, Z, X, neg(X))
      : placement([d.W, 0, d.D], Y, neg(Z), neg(X), X)
    const panel = this.add({
      ...this.basePanel(
        isLeft ? "side-left" : "side-right",
        isLeft ? "lat e" : "lat d",
        isLeft ? "Lateral esquerre" : "Lateral dret",
        "side",
        H,
        sideDepth,
        t,
        c.material,
        "x",
        edges(isLeft ? "top" : "bottom", "right"),
        pl,
      ),
      grooves,
    })
    this.verticals.push({
      panel,
      xL: isLeft ? 0 : d.W - t,
      xR: isLeft ? t : d.W,
      yB: 0,
      yT: H,
      zRear: d.sideZ0,
      zFront: d.D,
      outer: true,
    })
  }

  private buildHorizontal(which: "bottom" | "top"): void {
    const { m, d } = this
    const c = m.carcass
    const { t, interior } = d
    const isBottom = which === "bottom"
    const length = interior.x1 - interior.x0
    let width = d.sideDepth
    let zRear = d.sideZ0
    let cutouts: Cutout[] | undefined
    if (!isBottom && c.top.kind === "ventSlot") {
      width = d.sideDepth - c.top.gap
      zRear = d.sideZ0 + c.top.gap
    }
    const grooves: Panel["grooves"] = []
    if (c.back === "groove" && !(c.top.kind === "ventSlot" && !isBottom)) {
      grooves.push({
        x: 0,
        y: isBottom ? r(d.sideDepth - c.backSetback - d.tb) : r(c.backSetback),
        w: r(length),
        h: d.tb,
        depth: c.grooveDepth,
        face: "A",
        tag: "back",
      })
    }
    const yBottom = isBottom ? d.baseY : d.H - t
    const pl = isBottom
      ? placement([interior.x0, yBottom, d.D], X, neg(Z), Y, neg(Y))
      : placement([interior.x0, d.H, zRear], X, Z, neg(Y), Y)
    const panel = this.add({
      ...this.basePanel(
        which,
        isBottom ? "baix" : "dalt",
        isBottom ? "Base" : "Sostre",
        which,
        length,
        width,
        t,
        c.material,
        "x",
        edges(isBottom ? "bottom" : "top"),
        pl,
      ),
      grooves,
    })
    if (!isBottom && c.top.kind === "grille") {
      const g = grilleCutouts(panel.length, panel.width, c.top.pattern)
      cutouts = g.cutouts
      this.openRatios.top = g.openRatio
      if (g.openRatio < MIN_OPEN_RATIO) {
        this.warnings.push({ code: "grille-open-ratio", message: `La reixeta de la tapa només té un ${Math.round(g.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, panelId: panel.id })
      }
    }
    if (cutouts?.length) panel.cutouts = cutouts
    this.horizontals.push({ panel, yBottom, yTop: yBottom + t, xL: interior.x0, xR: interior.x1, outer: true })

    // Espigues amb els laterals (la base/tapa hi topa; el lateral continua).
    const yMid = yBottom + t / 2
    for (const v of this.verticals) {
      if (!v.outer) continue
      const xFace = near(v.xR, interior.x0) ? v.xR : v.xL
      if (!near(xFace, interior.x0) && !near(xFace, interior.x1)) continue
      const zs = threeAlong(d.sideZ0, d.D, m.hardware.dowel.endOffset)
      dowelJoint(panel, v.panel, zs.map((z): Vec3 => [xFace, yMid, z]), m.hardware.dowel)
    }
  }

  private buildBack(): void {
    const { m, d } = this
    const c = m.carcass
    const { interior } = d
    if (c.back === "screwed") {
      this.add(
        this.basePanel("back", "trassera", "Fons", "back", d.W, d.H, d.tb, c.backMaterial, "none", { ...NO_EDGES }, placement([0, 0, 0], X, Y, Z, neg(Z))),
      )
      return
    }
    const g = c.grooveDepth
    const cl = c.backClearance
    const xL = c.sides.left ? interior.x0 - g + cl / 2 : interior.x0
    const xR = c.sides.right ? interior.x1 + g - cl / 2 : interior.x1
    const yB = d.hasBase ? interior.y0 - g + cl / 2 : interior.y0
    const yT = d.hasTop ? interior.y1 + g - cl / 2 : interior.y1
    this.add(
      this.basePanel("back", "trassera", "Fons", "back", xR - xL, yT - yB, d.tb, c.backMaterial, "none", { ...NO_EDGES }, placement([xL, yB, c.backSetback], X, Y, Z, neg(Z))),
    )
  }

  private buildPlinth(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "plinth") return
    const { interior, t } = d
    const z0 = d.D - c.base.setback - t
    this.add(
      this.basePanel("plinth", "socol", "Sòcol", "plinth", interior.x1 - interior.x0, c.base.height, t, c.material, "x", edges("top", "bottom"), placement([interior.x0, 0, z0], X, Y, Z, Z)),
    )
  }

  // --- Zones ------------------------------------------------------------------------

  buildZones(): Layout {
    const { m, d } = this
    const layout = layoutZones(m.root, d.interior, d.t)
    for (const p of layout.problems) this.warnings.push({ code: "layout", message: p })

    // 1) Divisors i prestatges fixos de totes les divisions.
    layout.dividers.forEach((div, i) => {
      if (div.dir === "v") this.buildDivider(div.at, div.from, div.to, `divider-${i + 1}`)
      else this.buildFixedShelf(div.at, div.from, div.to, `fixed-${i + 1}`)
    })
    // 2) Unions dels divisors amb el que tenen a sota i a sobre, i dels fixos amb els costats.
    for (const v of this.verticals) if (!v.outer) this.joinDivider(v)
    for (const h of this.horizontals) if (!h.outer) this.joinFixedShelf(h)
    // 3) Fulles: fileres, prestatges regulables i fronts.
    for (const zone of layout.leaves) this.buildLeaf(zone, layout.rects.get(zone.id)!)

    // 4) Passacables i extres.
    for (const hole of m.extras.cableHoles) this.cableHole(hole)
    return layout
  }

  private buildDivider(x: number, yFrom: number, yTo: number, id: string): void {
    const { m, d } = this
    const t = d.t
    const panel = this.add(
      this.basePanel(id, "divisor", "Divisor", "divider", yTo - yFrom, d.availDepth, t, m.carcass.material, "x", edges("top"), placement([x, yFrom, d.backInnerZ], Y, Z, X, Z)),
    )
    this.verticals.push({ panel, xL: x, xR: x + t, yB: yFrom, yT: yTo, zRear: d.backInnerZ, zFront: d.D, outer: false })
  }

  private buildFixedShelf(y: number, xFrom: number, xTo: number, id: string): void {
    const { m, d } = this
    const t = d.t
    const panel = this.add(
      this.basePanel(id, "estanter fixe", "Prestatge fix", "fixedShelf", xTo - xFrom, d.availDepth, t, m.carcass.material, "x", edges("bottom"), placement([xFrom, y, d.D], X, neg(Z), Y, Z)),
    )
    this.horizontals.push({ panel, yBottom: y, yTop: y + t, xL: xFrom, xR: xTo, outer: false })
  }

  private findBelow(rect: ZoneRect): HorizontalRef | undefined {
    return this.horizontals.find((h) => near(h.yTop, rect.y0) && h.xL <= rect.x0 + 0.51 && h.xR >= rect.x1 - 0.51)
  }
  private findAbove(rect: ZoneRect): HorizontalRef | undefined {
    return this.horizontals.find((h) => near(h.yBottom, rect.y1) && h.xL <= rect.x0 + 0.51 && h.xR >= rect.x1 - 0.51)
  }
  private findLeft(rect: ZoneRect): VerticalRef | undefined {
    return this.verticals.find((v) => near(v.xR, rect.x0) && v.yB <= rect.y0 + 0.51 && v.yT >= rect.y1 - 0.51)
  }
  private findRight(rect: ZoneRect): VerticalRef | undefined {
    return this.verticals.find((v) => near(v.xL, rect.x1) && v.yB <= rect.y0 + 0.51 && v.yT >= rect.y1 - 0.51)
  }

  private joinDivider(v: VerticalRef): void {
    const { m, d } = this
    const xMid = (v.xL + v.xR) / 2
    const zs = threeAlong(v.zRear, v.zFront, m.hardware.dowel.endOffset)
    const rect: ZoneRect = { x0: v.xL, x1: v.xR, y0: v.yB, y1: v.yT }
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    if (below) dowelJoint(v.panel, below.panel, zs.map((z): Vec3 => [xMid, v.yB, z]), m.hardware.dowel)
    if (above) dowelJoint(v.panel, above.panel, zs.map((z): Vec3 => [xMid, v.yT, z]), m.hardware.dowel)
    void d
  }

  private joinFixedShelf(h: HorizontalRef): void {
    const { m, d } = this
    const yMid = (h.yBottom + h.yTop) / 2
    const zs = threeAlong(d.backInnerZ, d.D, m.hardware.dowel.endOffset)
    const rect: ZoneRect = { x0: h.xL, x1: h.xR, y0: h.yBottom, y1: h.yTop }
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    if (left) dowelJoint(h.panel, left.panel, zs.map((z): Vec3 => [h.xL, yMid, z]), m.hardware.dowel)
    if (right) dowelJoint(h.panel, right.panel, zs.map((z): Vec3 => [h.xR, yMid, z]), m.hardware.dowel)
  }

  /** Filera System 32 sobre la cara d'un panell vertical, per al tram d'una zona. */
  private rows(v: VerticalRef, rect: ZoneRect, side: "left" | "right"): number[] {
    const s = this.m.hardware.system32
    const ys = system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch)
    const xFace = side === "left" ? v.xR : v.xL
    for (const y of ys) {
      addFaceHole(v.panel, [xFace, y, v.zFront - s.edgeOffset], { diameter: s.diameter, depth: s.depth, tag: "system32" })
      addFaceHole(v.panel, [xFace, y, v.zRear + s.edgeOffset], { diameter: s.diameter, depth: s.depth, tag: "system32" })
    }
    return ys
  }

  private buildLeaf(zone: Zone, rect: ZoneRect): void {
    const { m, d } = this
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    const front = zone.front
    const hingeSide = front?.kind === "door" ? front.hinge : front?.kind === "grille" && front.mount === "hinged" ? front.hinge : null

    // Fileres: per prestatges regulables (als dos costats) i per frontisses (al seu costat).
    let ysLeft: number[] = []
    let ysRight: number[] = []
    const wantsLeft = (zone.shelves?.adjustable ?? false) || hingeSide === "left" || (front?.kind === "door" && front.mode === "double")
    const wantsRight = (zone.shelves?.adjustable ?? false) || hingeSide === "right" || (front?.kind === "door" && front.mode === "double")
    if (wantsLeft) {
      if (left) ysLeft = this.rows(left, rect, "left")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a l'esquerra per a la filera System 32.`, zoneId: zone.id })
    }
    if (wantsRight) {
      if (right) ysRight = this.rows(right, rect, "right")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a la dreta per a la filera System 32.`, zoneId: zone.id })
    }
    const s = m.hardware.system32
    const rowYs = ysLeft.length ? ysLeft : ysRight.length ? ysRight : system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch)

    // Prestatges.
    if (zone.shelves && zone.shelves.n > 0) this.buildShelves(zone, rect, rowYs)

    // Front.
    if (!front) return
    const territory = this.frontTerritory(rect, left, right)
    switch (front.kind) {
      case "door":
        this.buildDoors(zone, front, territory, rowYs)
        break
      case "drawers":
        this.buildDrawers(zone, front, rect, territory, left, right)
        break
      case "flap":
        this.buildFlap(zone, front, territory)
        break
      case "grille":
        this.buildGrille(zone, front, rect, territory, left, right, rowYs)
        break
      case "panel":
        this.buildFrontPanel(zone, territory, "panel", "frontal fix", "Front fix")
        break
    }
    void d
  }

  private buildShelves(zone: Zone, rect: ZoneRect, rowYs: number[]): void {
    const { m, d } = this
    const c = m.carcass
    const n = zone.shelves!.n
    const t = d.t
    const width = rect.x1 - rect.x0
    const length = width - c.shelfClearance
    const depth = d.availDepth - c.shelfSetback
    const innerH = rect.y1 - rect.y0
    const gap = (innerH - n * t) / (n + 1)
    if (width > 800 && t <= 19) {
      this.warnings.push({ code: "shelf-span", message: `Prestatge de ${t} mm amb una llum de ${r(width)} mm: es vinclarà (màxim recomanat 800).`, zoneId: zone.id })
    }
    for (let k = 1; k <= n; k++) {
      this.shelfCount += 1
      const target = rect.y0 + k * gap + (k - 1) * t
      const y = zone.shelves!.adjustable && rowYs.length ? snap(target, rowYs) : r(target)
      const idx = this.shelfCount
      this.add(
        this.basePanel(
          `shelf-${idx}`,
          this.shelfCount === 1 && n === 1 ? "estanter" : `estanter ${idx}`,
          this.shelfCount === 1 && n === 1 ? "Prestatge" : `Prestatge ${idx}`,
          "shelf",
          length,
          depth,
          t,
          c.material,
          "x",
          edges("bottom"),
          placement([rect.x0 + c.shelfClearance / 2, y, d.D - c.shelfSetback], X, neg(Z), Y, Z),
        ),
      )
    }
  }

  /** Rectangle que un front tapa: la llum més el que li toca dels panells del voltant, menys jocs. */
  private frontTerritory(rect: ZoneRect, left?: VerticalRef, right?: VerticalRef): ZoneRect {
    const { m, d } = this
    const t = d.t
    const og = m.fronts.outerGap
    const bg = m.fronts.betweenGap
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    const x0 = left ? (left.outer ? rect.x0 - t + og : rect.x0 - t / 2 + bg / 2) : rect.x0 + og
    const x1 = right ? (right.outer ? rect.x1 + t - og : rect.x1 + t / 2 - bg / 2) : rect.x1 - og
    const y0 = below ? (below.outer ? rect.y0 - t + og : rect.y0 - t / 2 + bg / 2) : rect.y0 + og
    const y1 = above ? (above.outer ? rect.y1 + t - og : rect.y1 + t / 2 - bg / 2) : rect.y1 - og
    return { x0: r(x0), x1: r(x1), y0: r(y0), y1: r(y1) }
  }

  private hingeCount(height: number): number {
    if (height <= 900) return 2
    if (height <= 1600) return 3
    return 4
  }

  /** Peça de front vertical (porta, reixeta, fix): cara A cap a dins, x local = alçada. */
  private frontPanel(id: string, name: string, label: string, role: PanelRole, x0: number, y0: number, w: number, h: number): Panel {
    const { m, d } = this
    return this.add(
      this.basePanel(id, name, label, role, h, w, d.t, m.carcass.material, "x", edges("left", "right", "bottom", "top"), placement([x0, y0, d.D + d.t], Y, X, neg(Z), Z)),
    )
  }

  private buildFrontPanel(zone: Zone, ter: ZoneRect, role: PanelRole, name: string, label: string): Panel {
    this.frontCount += 1
    const w = ter.x1 - ter.x0
    const h = ter.y1 - ter.y0
    const p = this.frontPanel(`${role}-${this.frontCount}`, name, label, role, ter.x0, ter.y0, w, h)
    void zone
    return p
  }

  private addCups(door: Panel, doorH: number, hingeSide: "left" | "right", doorW: number, rowYs: number[], doorY0: number): number {
    const { m } = this
    const half = m.hardware.system32.pitch / 2
    const midpoints = rowYs.slice(0, -1).map((y) => r(y + half))
    const count = this.hingeCount(doorH)
    const span = doorH - 200
    const targets = Array.from({ length: count }, (_, i) => 100 + (span * i) / (count - 1))
    for (const target of targets) {
      const y = midpoints.length ? snap(target + doorY0, midpoints) : r(target + doorY0)
      door.holes.push({
        x: r(y - doorY0),
        y: hingeSide === "left" ? m.hardware.hinge.cupOffset : r(doorW - m.hardware.hinge.cupOffset),
        diameter: m.hardware.hinge.cupDiameter,
        depth: m.hardware.hinge.cupDepth,
        face: "A",
        tag: "hinge",
      })
    }
    return count
  }

  private buildDoors(zone: Zone, front: Extract<Front, { kind: "door" }>, ter: ZoneRect, rowYs: number[]): void {
    const { m } = this
    this.doorZones += 1
    const suffix = this.doorZones === 1 ? "" : `-${this.doorZones}`
    const doorH = r(ter.y1 - ter.y0)
    if (doorH > 2200) this.warnings.push({ code: "door-too-tall", message: `Porta de ${doorH} mm d'alçada (màxim recomanat 2.200).`, zoneId: zone.id })

    const make = (id: string, name: string, label: string, x0: number, w: number, hinge: "left" | "right") => {
      if (w > 600) this.warnings.push({ code: "door-too-wide", message: `Porta de ${w} mm d'amplada (màxim recomanat 600).`, zoneId: zone.id })
      const door = this.frontPanel(id, name, label, "door", x0, ter.y0, w, doorH)
      this.addCups(door, doorH, hinge, w, rowYs, ter.y0)
    }
    if (front.mode === "single") {
      make(`door${suffix}`, "porta", "Porta", ter.x0, r(ter.x1 - ter.x0), front.hinge)
    } else {
      const w = r((ter.x1 - ter.x0 - m.fronts.betweenGap) / 2)
      make(`door${suffix}-left`, "porta e", "Porta esquerra", ter.x0, w, "left")
      make(`door${suffix}-right`, "porta d", "Porta dreta", r(ter.x0 + w + m.fronts.betweenGap), w, "right")
    }
  }

  private buildFlap(zone: Zone, front: Extract<Front, { kind: "flap" }>, ter: ZoneRect): void {
    const { m } = this
    const flap = this.buildFrontPanel(zone, ter, "flap", "abatible", "Abatible")
    // Forats genèrics de frontissa: dos per costat, a 22,5 del cantell de gir.
    const along = flap.length // alçada
    const across = flap.width
    const x = front.dir === "down" ? m.hardware.hinge.cupOffset : r(along - m.hardware.hinge.cupOffset)
    for (const y of [100, r(across - 100)]) {
      flap.holes.push({ x, y, diameter: 8, depth: 12, face: "A", tag: "flap" })
    }
  }

  private buildGrille(
    zone: Zone,
    front: Extract<Front, { kind: "grille" }>,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
    rowYs: number[],
  ): void {
    const { m, d } = this
    const grille = this.buildFrontPanel(zone, ter, "grille", "reixeta", "Reixeta")
    const exclude: Rect[] = []
    let hatchLocal: Rect | undefined
    if (front.hatch) {
      // Trapa en coordenades de la zona → locals del front (x local = Y, y local = X).
      const hx = rect.x0 + front.hatch.x
      const hy = rect.y0 + front.hatch.y
      hatchLocal = { x: r(hy - ter.y0), y: r(hx - ter.x0), w: front.hatch.h, h: front.hatch.w }
      const g = front.pattern.slotGap
      exclude.push({ x: hatchLocal.x - g, y: hatchLocal.y - g, w: hatchLocal.w + 2 * g, h: hatchLocal.h + 2 * g })
    }
    const result = grilleCutouts(grille.length, grille.width, front.pattern, exclude)
    grille.cutouts = [...result.cutouts]
    this.openRatios[zone.id] = result.openRatio
    if (result.openRatio < MIN_OPEN_RATIO) {
      this.warnings.push({ code: "grille-open-ratio", message: `La reixeta només té un ${Math.round(result.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, zoneId: zone.id, panelId: grille.id })
    }
    this.warnings.push({ code: "material-heat", message: "Prop d'un radiador: MDF lacat o cantells amb cola PUR (la cola EVA es desenganxa amb la calor).", zoneId: zone.id })

    if (hatchLocal) {
      grille.cutouts.push({ kind: "rect", ...hatchLocal, tag: "hatch" })
      // Trapa: obertura més 20 mm de solapament per costat, darrere del front.
      const lip = 20
      const hw = front.hatch!.w + 2 * lip
      const hh = front.hatch!.h + 2 * lip
      const hx0 = rect.x0 + front.hatch!.x - lip
      const hy0 = rect.y0 + front.hatch!.y - lip
      const hatch = this.add(
        this.basePanel(`hatch-${this.frontCount}`, "trapa", "Trapa", "hatch", hh, hw, d.t, m.carcass.material, "x", edges("left", "right", "bottom", "top"), placement([hx0, hy0, d.D], Y, X, neg(Z), Z)),
      )
      const mg = m.hardware.magnet
      for (const [lx, ly] of [[lip / 2, lip / 2], [hh - lip / 2, lip / 2], [lip / 2, hw - lip / 2], [hh - lip / 2, hw - lip / 2]] as [number, number][]) {
        // Imant a la cara B de la trapa (la que toca el front) i contrapart a la cara A del front.
        hatch.holes.push({ x: r(lx), y: r(ly), diameter: mg.diameter, depth: mg.depth, face: "B", tag: "magnet" })
        const w: Vec3 = [hx0 + ly, hy0 + lx, d.D]
        addFaceHole(grille, w, { diameter: mg.diameter, depth: mg.depth, tag: "magnet" })
      }
    }

    if (front.mount === "hinged") {
      this.addCups(grille, grille.length, front.hinge, grille.width, rowYs, ter.y0)
      return
    }
    // Desmuntable: imants als cantells frontals dels panells dels costats i contraparts al front.
    const mg = m.hardware.magnet
    for (const [ref, side] of [[left, "left"], [right, "right"]] as [VerticalRef | undefined, "left" | "right"][]) {
      if (!ref) {
        this.warnings.push({ code: "no-side", message: `La reixeta no té panell a la ${side === "left" ? "esquerra" : "dreta"} on posar els imants.`, zoneId: zone.id })
        continue
      }
      const xMid = (ref.xL + ref.xR) / 2
      for (const y of [rect.y0 + mg.cornerOffset, rect.y1 - mg.cornerOffset]) {
        const w: Vec3 = [r(xMid), r(y), ref.zFront]
        addEdgeHole(ref.panel, w, { diameter: mg.diameter, depth: mg.depth, tag: "magnet" })
        addFaceHole(grille, w, { diameter: mg.diameter, depth: mg.depth, tag: "magnet" })
      }
    }
  }

  private buildDrawers(
    zone: Zone,
    front: Extract<Front, { kind: "drawers" }>,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
  ): void {
    const { m, d } = this
    const c = m.carcass
    const hw = m.hardware.drawer
    const n = front.n
    const bg = m.fronts.betweenGap
    const sizes = front.heights.slice(0, n)
    while (sizes.length < n) sizes.push("auto")
    const total = ter.y1 - ter.y0
    const fixed = sizes.reduce<number>((s, v) => (typeof v === "number" ? s + v : s), 0)
    const autos = sizes.filter((v) => v === "auto").length
    const auto = autos ? (total - (n - 1) * bg - fixed) / autos : 0
    const heights = sizes.map((v) => r(v === "auto" ? auto : v))

    const boxW = r(rect.x1 - rect.x0 - 2 * hw.sideClearance)
    const maxLen = d.availDepth - hw.backClearance
    const slide = [...hw.slideLengths].sort((a, b) => b - a).find((l) => l <= maxLen)
    if (slide === undefined) {
      this.warnings.push({ code: "drawer-no-slide", message: `Cap guia de calaix (${hw.slideLengths.join(", ")}) cap en ${r(maxLen)} mm de fondària útil.`, zoneId: zone.id })
    }
    const boxL = slide ?? r(maxLen)
    const bt = hw.boxThickness
    const tbb = hw.bottomThickness
    const g = c.grooveDepth

    let y = ter.y0
    for (let i = 0; i < n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const fw = r(ter.x1 - ter.x0)
      // Front (cara A cap a dins, x local = amplada).
      const frontPanel = this.add(
        this.basePanel(`drawer-${k}-front`, "frontal calaix", `Front calaix ${k}`, "drawerFront", fw, fh, d.t, c.material, "x", edges("left", "right", "bottom", "top"), placement([ter.x0, y + fh, d.D + d.t], X, neg(Y), neg(Z), Z)),
      )
      const boxH = r(fh - hw.boxDrop)
      const boxY0 = r(y + (fh - boxH) / 2)
      const boxX0 = r(rect.x0 + hw.sideClearance)
      const zFront = d.D // cara posterior del front
      const zBack = r(zFront - boxL)
      // Laterals de la caixa (cara A cap a dins de la caixa), amb ranura per al fons.
      const sideGroove = { x: 0, y: hw.bottomOffset, w: boxL, h: tbb, depth: g, face: "A" as const, tag: "drawer-bottom" }
      const sideL = this.add({
        ...this.basePanel(`drawer-${k}-side-left`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top"), placement([boxX0, boxY0, zBack], Z, Y, X, neg(X))),
        grooves: [sideGroove],
      })
      const sideR = this.add({
        ...this.basePanel(`drawer-${k}-side-right`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top"), placement([boxX0 + boxW, boxY0, zFront], neg(Z), Y, neg(X), X)),
        grooves: [{ ...sideGroove }],
      })
      // Darrere: entre laterals, sobre el fons.
      const backH = r(boxH - hw.bottomOffset - tbb)
      const back = this.add(
        this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", boxW - 2 * bt, backH, bt, c.material, "x", edges("top"), placement([boxX0 + bt, boxY0 + hw.bottomOffset + tbb, zBack + bt], X, Y, neg(Z), neg(Z))),
      )
      // Fons: en ranura als laterals i al front.
      const bottomW = r(boxW - 2 * bt + 2 * g - 1)
      const bottomL = r(boxL + g - 1)
      this.add(
        this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottomW, bottomL, tbb, c.backMaterial, "none", { ...NO_EDGES }, placement([boxX0 + bt - g + 0.5, boxY0 + hw.bottomOffset, zFront + g - 0.5], X, neg(Z), Y, neg(Y))),
      )
      // Ranura al front per al fons (cara A = darrere del front).
      frontPanel.grooves.push({ x: r(boxX0 + bt - g - ter.x0), y: r(y + fh - (boxY0 + hw.bottomOffset + tbb)), w: r(boxW - 2 * bt + 2 * g), h: tbb, depth: g, face: "A", tag: "drawer-bottom" })
      // Espigues: laterals → front (topen), darrere → laterals (topa).
      const dowel = { diameter: hw.boxThickness >= 16 ? 8 : 6, faceDepth: 10, edgeDepth: 20 }
      for (const [xs, sidePanel] of [[boxX0 + bt / 2, sideL], [boxX0 + boxW - bt / 2, sideR]] as [number, Panel][]) {
        dowelJoint(sidePanel, frontPanel, [boxY0 + 30, boxY0 + boxH - 30].map((yy): Vec3 => [r(xs), r(yy), zFront]), dowel)
        dowelJoint(back, sidePanel, [boxY0 + hw.bottomOffset + tbb + 20, boxY0 + boxH - 20].map((yy): Vec3 => [r(xs < boxX0 + bt ? boxX0 + bt : boxX0 + boxW - bt), r(yy), r(zBack + bt / 2)]), dowel)
      }
      // Forats de guia: al lateral del moble (Ø5 P12) i al lateral de la caixa (Ø4 P10).
      const zs = [d.D - m.hardware.system32.edgeOffset, d.D - m.hardware.system32.edgeOffset - 256].filter((z) => z > zBack)
      const ySlide = r(boxY0 + 20)
      for (const [ref, sidePanel, xBox] of [[left, sideL, boxX0], [right, sideR, boxX0 + boxW]] as [VerticalRef | undefined, Panel, number][]) {
        for (const z of zs) {
          if (ref) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, ySlide, r(z)], { diameter: 5, depth: 12, tag: "slide" })
          addFaceHole(sidePanel, [xBox, ySlide, r(z)], { diameter: 4, depth: 10, tag: "slide" })
        }
      }
      y = r(y + fh + bg)
    }
  }

  private cableHole(hole: Module["extras"]["cableHoles"][number]): void {
    const { d } = this
    const target = this.panels.find((p) => p.role === hole.panel)
    if (!target) return
    // Punt sobre la cara A del panell: fons → (x, y, cara interior); tapa/base → (x, cara, z des del darrere).
    const w: Vec3 =
      hole.panel === "back"
        ? [hole.x, hole.y, r(target.placement.origin[2] + d.tb)]
        : hole.panel === "top"
          ? [hole.x, d.H - d.t, hole.y]
          : [hole.x, d.baseY + d.t, hole.y]
    const l = toLocal(target, w)
    ;(target.cutouts ??= []).push({ kind: "circle", x: l[0], y: l[1], diameter: hole.diameter, tag: "cable" })
  }
}

/** Construeix totes les peces d'un mòdul en coordenades del mòdul (base a Y = 0). */
export function buildModule(m: Module): ModuleBuild {
  const b = new Builder(m)
  b.buildCarcass()
  const layout = b.buildZones()
  const panels = b.panels.map((p) => normalizePanel(p.cutouts && p.cutouts.length === 0 ? { ...p, cutouts: undefined } : p))
  return { panels, warnings: b.warnings, layout, openRatios: b.openRatios }
}
