import {
  type BPt,
  type CableHole,
  NO_EDGES,
  profileToOutline,
  sampleProfile,
  type PNode,
  type Cutout,
  type EdgeBanding,
  type EdgeSide,
  type Front,
  type HardwareItem,
  type KitLevel,
  type KitOptions,
  type ModuleHardware,
  type HardwareSlot,
  type Hole,
  type Module,
  type Panel,
  type PanelRole,
  type Vec3,
  type Zone,
  damagedImportMessage,
  isDamagedImport,
  isDrawerKit,
  isLegacyHardware,
  migrateModuleHardware,
  visibleModule,
} from "../model"
import { normalizePanel } from "./buildCabinet"
import { applyHardware, legSpec, resolveKit, slotSpec, type ResolvedKit, type SlotSpec } from "./hardware"
import { kitBottomThickness, kitHeight, kitSolidPanels, planKit, type KitOrderLine, type KitWoodSize } from "./drawerKit"
import {
  X,
  Y,
  Z,
  addEdgeHole,
  addFaceHole,
  dowelJoint,
  dowelsAlong,
  faceAt,
  neg,
  placement,
  r,
  snap,
  system32Ys,
  threeAlong,
  toLocal,
} from "./geometry"
import { MIN_OPEN_RATIO, grilleCutouts, type Rect } from "./grille"
import { fitSizes, layoutZones, mismatchMessage, type Layout, type ZoneRect } from "./layout"

/** Mm per als avisos: un decimal com a molt, amb coma. */
const num = (n: number): string => String(Math.round(n * 10) / 10).replace(".", ",")

export interface BuildWarning {
  code:
    | "door-too-wide"
    | "door-too-tall"
    | "shelf-span"
    | "drawer-no-slide"
    | "grille-open-ratio"
    | "back-groove"
    | "back-inset"
    | "cable-hole"
    | "ref-cut"
    | "mitre"
    | "push"
    | "inset"
    | "hollow"
    | "table"
    | "layout"
    | "no-side"
    | "material-heat"
    | "collision"
    | "overlap"
    | "rail"
    | "hanging"
    | "hole-clash"
    | "hinge"
    | "drawer-bottom"
    | "invalid-part"
    | "same-size"
    | "edge-notch"
    | "drawer-box"
    | "handle"
    | "shelves"
    // Un ferratge del mòdul o d'un front que no es pot fer servir (paràmetre que falta, fórmula dolenta, tipus que no toca).
    | "hardware"
    // Materials que no lliguen amb Preferències (`materialIssues`, fora del build: el build no llegeix preferències).
    | "unknown-material"
    | "thickness-not-listed"
  message: string
  zoneId?: string
  panelId?: string
}

/** Un calaix fet amb un joc paramètric: el que cal comprar (números d'article) i la fusta que demana. */
export interface KitOrder {
  zoneId: string
  drawer: number
  /** Nom de l'item de la biblioteca i del joc («DTC MAGIC-PRO HT11 M»). */
  item: string
  kit: string
  nl: number
  options: KitOptions
  lines: KitOrderLine[]
  wood: KitWoodSize[]
  rule?: { stabilizer: KitLevel; syncRod: KitLevel }
  syncRod?: number
}

export interface ModuleBuild {
  panels: Panel[]
  /** Elements que no són de CNC (barres de penjar; components dels jocs de calaix, rol `hardware`): 3D i llista, sense nesting. */
  extras: Panel[]
  /** Calaixos amb joc paramètric: la comanda per al taller (Peces › «Ferratges dels jocs», LLEGEIX-ME). */
  hardwareKits: KitOrder[]
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
  /** Tapa a inglet amb els laterals (a cada costat on hi ha lateral). */
  mitreTop: boolean
  /** Base a inglet amb els laterals (quan la base és a baix de tot dels laterals: no amb sòcol). */
  mitreBottom: boolean
  /**
   * Fronts de calaix a inglet amb els laterals: cantonades a inglet, fronts recobrents i només
   * calaixos (les portes, en obrir-se, toparien amb el lateral). Els laterals arriben fins a la
   * cara dels fronts amb el cantell de davant a 45°; els fronts, de fora a fora.
   */
  mitreFronts: boolean
  /** Fronts encastats (dins de la llum) en lloc de recobrents. */
  inset: boolean
  /** Tauler de taula: tapa per sobre dels laterals, amb voladís i forma. */
  tableTop: { overhang: number; shape?: PNode[] } | null
  /** Alçada dels laterals (més curts si la tapa hi va per sobre). */
  sideH: number
  /** Parets buides: gruix aparent (null si són massisses). */
  hollow: number | null
  /** Gruix de cada paret exterior (el del tauler o l'aparent si és buida). */
  ws: number
  wb: number
  wt: number
  /** Z de la cara de davant dels fronts (encastats: el davant de la caixa). */
  frontZ: number
}

function derive(m: Module): Derived {
  const c = m.carcass
  const t = c.thickness
  const tb = c.backThickness
  const { width: W, height: H, depth: D } = c
  const sideDepth = c.back === "screwed" ? D - tb : D
  const sideZ0 = D - sideDepth
  // Encastat: entre laterals, a `backInsetSetback` del darrere; l'interior comença a la seva cara de davant.
  const backInnerZ = c.back === "groove" ? c.backSetback + tb : c.back === "screwed" ? tb : c.back === "inset" ? (c.backInsetSetback ?? 0) + tb : 0
  const hasBase = c.base.kind !== "open"
  const hasTop = c.top.kind !== "none"
  const baseY = c.base.kind === "plinth" ? c.base.height : 0
  // Paret buida: cal lloc per a dues pells i un llistó (almenys 6 mm entre pells).
  const tableTop = c.tableTop && c.top.kind === "full" ? c.tableTop : null
  const hollow = c.hollow && c.hollow.thickness >= 2 * t + 6 ? c.hollow.thickness : null
  const ws = hollow ?? t
  const wb = hollow ?? t
  const wt = hollow && c.top.kind === "full" && !tableTop ? hollow : t
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
      x0: c.sides.left ? ws : 0,
      x1: c.sides.right ? W - ws : W,
      y0: hasBase ? baseY + wb : 0,
      y1: hasTop ? H - wt : H,
    },
    hasBase,
    hasTop,
    baseY,
    mitreTop: !hollow && !tableTop && c.joint === "mitre" && hasTop && (c.sides.left || c.sides.right),
    mitreBottom: !hollow && c.joint === "mitre" && hasBase && baseY === 0 && (c.sides.left || c.sides.right),
    mitreFronts: !hollow && c.joint === "mitre" && m.fronts.style !== "inset" && (c.sides.left || c.sides.right) && onlyDrawers(m.root),
    inset: m.fronts.style === "inset",
    frontZ: m.fronts.style === "inset" ? D : D + t,
    tableTop,
    sideH: tableTop ? H - t : H,
    hollow,
    ws,
    wb,
    wt,
  }
}

/** Perfil del tauler (mm, amb la seva mida) escalat a llarg × ample i passat a rectes i arcs. */
export function shapeOutline(shape: PNode[], length: number, width: number): BPt[] {
  // Extensió real de la corba (les cúbiques poden sortir dels nodes): si no, la peça
  // quedaria més gran que el rectangle que ocupa al nesting.
  const pts = sampleProfile(shape, 64)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const sx = length / Math.max(1, Math.max(...xs) - x0)
  const sy = width / Math.max(1, Math.max(...ys) - y0)
  const scaled: PNode[] = shape.map((n) => ({
    ...n,
    x: (n.x - x0) * sx,
    y: (n.y - y0) * sy,
    ...(n.in ? { in: [n.in[0] * sx, n.in[1] * sy] as [number, number] } : {}),
    ...(n.out ? { out: [n.out[0] * sx, n.out[1] * sy] as [number, number] } : {}),
  }))
  return profileToOutline(scaled)
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
  /** Z del cantell de darrere i del de davant (prestatges fixos: més enrere si un front encastat els tapa; tapa amb
   * ranura d'aire: comença després de la ranura). Les espigues dels divisors van dins del tram comú. */
  zRear: number
  zFront: number
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.51

class Builder {
  readonly m: Module
  readonly d: Derived
  readonly panels: Panel[] = []
  readonly warnings: BuildWarning[] = []
  readonly openRatios: Record<string, number> = {}
  readonly extras: Panel[] = []
  readonly hardwareKits: KitOrder[] = []
  /** Zones que queden darrere del front d'una zona pare. */
  readonly covered = new Set<string>()
  /** Totes les zones per id. */
  private readonly zones = new Map<string, Zone>()
  readonly verticals: VerticalRef[] = []
  readonly horizontals: HorizontalRef[] = []
  private shelfCount = 0
  private doorZones = 0
  private drawerCount = 0
  private frontCount = 0

  /** Ferratges del mòdul resolts (números i mecanitzats de cada lloc, `core/build/hardware.ts`). */
  readonly kit: ResolvedKit
  readonly hw: { [S in HardwareSlot]: SlotSpec<S> }

  constructor(m: Module) {
    this.m = m
    this.d = derive(m)
    // Mòduls d'abans que no han passat per l'esquema: els números d'abans, com a kit (els mateixos números).
    const kit = (isLegacyHardware(m.hardware) ? migrateModuleHardware(m.hardware) : m.hardware) as ModuleHardware
    this.kit = resolveKit(kit, (message) => this.hardwareWarning(message))
    const k = this.kit
    this.hw = { hinge: k.hinge.spec, system32: k.system32.spec, dowel: k.dowel.spec, slide: k.slide.spec, flap: k.flap.spec, magnet: k.magnet.spec, handle: k.handle.spec }
  }

  private hardwareWarning(message: string, zoneId?: string): void {
    if (!this.warnings.some((w) => w.code === "hardware" && w.message === message)) this.warnings.push({ code: "hardware", message, ...(zoneId ? { zoneId } : {}) })
  }

  /** El ferratge d'un front (el triat a la porta, el calaix o l'abatible; si no, el del mòdul). */
  private frontHardware<S extends "hinge" | "slide" | "flap">(slot: S, item: HardwareItem | undefined, zoneId?: string): { spec: SlotSpec<S>; item: HardwareItem } {
    if (!item) return this.kit[slot] as { spec: SlotSpec<S>; item: HardwareItem }
    const res = slotSpec(slot, item, (message) => this.hardwareWarning(message, zoneId))
    // No serveix: el del mòdul (no el d'inici de l'app). Un importat que no serveix queda inert (cap forat), mai el del mòdul.
    return res.failed && !item.imported ? (this.kit[slot] as { spec: SlotSpec<S>; item: HardwareItem }) : res
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
    if (d.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${d.hollow} mm: cada paret són dues pells, llistons a dins i una tira al davant, encolats abans de muntar el moble.` })
    else if (c.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${c.hollow.thickness} mm: amb tauler de ${d.t} cal un gruix d'almenys ${2 * d.t + 6} mm. Es fan massisses.` })
    // Fronts encastats: van dins de la llum, a nivell amb el davant de la caixa.
    if (d.inset) {
      this.warnings.push({ code: "inset", message: "Fronts encastats: van dins de la llum amb el joc a tot el voltant; calen frontisses per a porta encastada." })
      if (c.shelfSetback < d.t)
        this.warnings.push({ code: "inset", message: `Els prestatges van retirats ${c.shelfSetback} mm i el front encastat entra ${d.t} mm: retira'ls almenys ${d.t} mm (Fusteria › Retranqueig dels prestatges).` })
    }
    // Fons en ranura massa gruixut: la ranura deixaria el lateral sense material.
    if (c.back === "groove" && d.tb > d.t - 6) {
      this.warnings.push({
        code: "back-groove",
        message: `Fons de ${d.tb} mm en ranura en un cos de ${d.t} mm: la ranura buidaria el lateral. Amb un fons gruixut, posa'l cargolat.`,
      })
    }
  }

  private buildSide(isLeft: boolean): void {
    if (this.d.hollow) return this.buildHollowSide(isLeft)
    const { m, d } = this
    const c = m.carcass
    const { t, sideDepth } = d
    const H = d.sideH
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      // Dins de la peça: amb tauler de taula el lateral s'acaba a sota de la tapa (la ranura hi surt).
      const gy0 = Math.max(0, d.hasBase ? d.interior.y0 - g : d.interior.y0)
      const gy1 = Math.min(H, this.backGrooveTop())
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
    // Fronts de calaix a inglet: el lateral arriba fins a la cara dels fronts.
    const ext = d.mitreFronts ? t : 0
    const pl = isLeft
      ? placement([0, 0, d.sideZ0], Y, Z, X, neg(X))
      : placement([d.W, 0, d.D + ext], Y, neg(Z), neg(X), X)
    if (ext && !isLeft) for (const g of grooves) g.y = r(g.y + ext)
    const panel = this.add({
      ...this.basePanel(
        isLeft ? "side-left" : "side-right",
        isLeft ? "lat e" : "lat d",
        isLeft ? "Lateral esquerre" : "Lateral dret",
        "side",
        H,
        sideDepth + ext,
        t,
        c.material,
        "x",
        d.mitreTop ? edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)])) : edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), "right"),
        pl,
      ),
      grooves,
      // Local x = alçada: «right» és el cap de dalt (tapa) i «left» el de baix (base); el cantell
      // de davant és «top» a l'esquerre i «bottom» al dret.
      ...(d.mitreTop || d.mitreBottom || ext
        ? { mitres: [...(d.mitreTop ? (["right"] as const) : []), ...(d.mitreBottom ? (["left"] as const) : []), ...(ext ? [isLeft ? ("top" as const) : ("bottom" as const)] : [])] }
        : {}),
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

  // --- Parets buides ------------------------------------------------------------------
  // Cada paret: pell de fora i pell de dins (el tauler), llistons entre pells (darrere i
  // extrems) i una tira al davant que tapa els cantells. La pell de dins fa de «paret» per
  // a l'interior (forats de prestatge, guies, frontisses, ranura del fons).

  private hollowPiece(id: string, name: string, label: string, role: PanelRole, length: number, width: number, eb: EdgeBanding, pl: Panel["placement"], grain: Panel["grain"] = "x"): Panel {
    const c = this.m.carcass
    // Totes les peces d'una paret buida s'encolen juntes abans de muntar el moble.
    const assembly = `${label.replace(/ \(.*\)$/, "")} (paret buida)`
    return this.add({ ...this.basePanel(id, name, label, role, length, width, this.d.t, c.material, grain, eb, pl), assembly })
  }

  /**
   * Cantonades de les parets buides: sempre a inglet on un lateral es troba amb la tapa o la
   * base (com un bloc massís, sense cap cantell). Les pells de fora del sostre i de la base
   * van de fora a fora amb el cantell a 45°, igual que les dels laterals; les tires del davant
   * fan un marc amb els talls a 45° en el seu pla (contorn, es fa al nesting).
   */
  private hollowCorners(): { top: boolean; bottom: boolean } {
    const { m, d } = this
    return {
      top: !!d.hollow && d.hasTop && m.carcass.top.kind === "full" && !d.tableTop,
      bottom: !!d.hollow && d.hasBase && d.baseY === 0,
    }
  }

  private buildHollowSide(isLeft: boolean): void {
    const { m, d } = this
    const c = m.carcass
    const { t, W, D, sideZ0, ws } = d
    const H = d.sideH
    const k = isLeft ? "left" : "right"
    const nm = isLeft ? "Lateral esquerre" : "Lateral dret"
    const skinDepth = D - t - sideZ0
    const mc = this.hollowCorners()
    // La pell de dins queda entre les pells de fora de la base i del sostre quan són a inglet.
    const yi0 = mc.bottom ? t : 0
    const yi1 = mc.top ? H - t : H
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      const gy0 = Math.max(yi0, d.hasBase ? d.interior.y0 - g : d.interior.y0)
      const gy1 = Math.min(yi1, this.backGrooveTop())
      grooves.push({ x: r(gy0 - yi0), y: isLeft ? r(c.backSetback) : r(skinDepth - c.backSetback - d.tb), w: r(gy1 - gy0), h: d.tb, depth: g, face: "A", tag: "back" })
    }
    // Pells: la de fora a x = 0 / W, la de dins a la cara interior (x = ws / W − ws), cara A cap a dins.
    const outer = isLeft
      ? placement([0, 0, sideZ0], Y, Z, X, neg(X))
      : placement([W, 0, D - t], Y, neg(Z), neg(X), X)
    const inner = isLeft
      ? placement([ws - t, yi0, sideZ0], Y, Z, X, neg(X))
      : placement([W - ws + t, yi0, D - t], Y, neg(Z), neg(X), X)
    const outerMitres = [...(mc.bottom ? (["left"] as const) : []), ...(mc.top ? (["right"] as const) : [])]
    const outerPanel = this.hollowPiece(`side-${k}`, isLeft ? "lat e" : "lat d", `${nm} (pell de fora)`, "side", H, skinDepth, mc.top ? { ...NO_EDGES } : edges("right"), outer)
    if (outerMitres.length) outerPanel.mitres = [...outerMitres]
    const innerPanel = this.add({ ...this.basePanel(`side-${k}-inner`, isLeft ? "lat e int" : "lat d int", `${nm} (pell de dins)`, "side", yi1 - yi0, skinDepth, t, c.material, "x", mc.top ? { ...NO_EDGES } : edges("right"), inner), grooves, assembly: `${nm} (paret buida)` })
    // Tira del davant: tota l'alçada i tot el gruix aparent; a les cantonades, tall a 45° en el seu pla.
    const xMax = isLeft ? ws : W
    const yOut = isLeft ? ws : 0
    const yIn = isLeft ? 0 : ws
    const facing = this.hollowPiece(`side-${k}-facing`, "tira", `${nm} (tira del davant)`, "facing", H, ws, edges(...(mc.top ? [] : (["right"] as const)), isLeft ? "top" : "bottom"), placement([xMax, 0, D - t], Y, neg(X), Z, Z))
    if (mc.top || mc.bottom) facing.outline = [[0, yOut], [H, yOut], [mc.top ? H - d.wt : H, yIn], [mc.bottom ? d.wb : 0, yIn]]
    // Llistons: darrere (entre les pells de fora de base i sostre) i als extrems que no tanca cap pell.
    const xIn = isLeft ? ws - t : W - t
    const gap = ws - 2 * t
    this.hollowPiece(`side-${k}-spacer-back`, "llistó", `${nm} (llistó del darrere)`, "spacer", yi1 - yi0, gap, { ...NO_EDGES }, placement([xIn, yi0, sideZ0], Y, neg(X), Z, neg(Z)))
    const spL = D - t - sideZ0 - t
    for (const [end, y] of [["bottom", t], ["top", H]] as const) {
      if ((end === "top" && mc.top) || (end === "bottom" && mc.bottom)) continue
      this.hollowPiece(`side-${k}-spacer-${end}`, "llistó", `${nm} (llistó ${end === "top" ? "de dalt" : "de baix"})`, "spacer", spL, gap, { ...NO_EDGES }, placement([xIn, y, sideZ0 + t], Z, neg(X), neg(Y), end === "top" ? Y : neg(Y)))
    }
    this.verticals.push({ panel: innerPanel, xL: isLeft ? 0 : W - ws, xR: isLeft ? ws : W, yB: 0, yT: H, zRear: sideZ0, zFront: D, outer: true })
  }

  private buildHollowHorizontal(which: "bottom" | "top"): void {
    const { m, d } = this
    const c = m.carcass
    const { t, D, sideZ0, interior, ws } = d
    const isBottom = which === "bottom"
    const w = isBottom ? d.wb : d.wt
    const y0 = isBottom ? d.baseY : d.H - w
    const x0 = interior.x0
    const len = interior.x1 - interior.x0
    const skinDepth = D - t - sideZ0
    const nm = isBottom ? "Base" : "Sostre"
    const mc = this.hollowCorners()
    const mitred = isBottom ? mc.bottom : mc.top
    // A inglet: la pell de fora i la tira van de fora a fora (fins a x = 0 / W on hi ha lateral).
    const mL = mitred && c.sides.left
    const mR = mitred && c.sides.right
    const ox0 = mL ? 0 : x0
    const olen = (mR ? d.W : interior.x1) - ox0
    const grooves: Panel["grooves"] = []
    if (c.back === "groove")
      grooves.push({ x: 0, y: isBottom ? r(skinDepth - c.backSetback - d.tb) : r(c.backSetback), w: r(len), h: d.tb, depth: c.grooveDepth, face: "A", tag: "back" })
    // Pells: la de fora (a baix a la base, a dalt al sostre) i la de dins, cara A cap a l'interior.
    const outerPl = isBottom ? placement([ox0, y0, D - t], X, neg(Z), Y, neg(Y)) : placement([ox0, d.H, sideZ0], X, Z, neg(Y), Y)
    const innerPl = isBottom ? placement([x0, y0 + w - t, D - t], X, neg(Z), Y, neg(Y)) : placement([x0, d.H - w + t, sideZ0], X, Z, neg(Y), Y)
    const outerPanel = this.hollowPiece(which, isBottom ? "baix" : "dalt", `${nm} (pell de fora)`, which, olen, skinDepth, { ...NO_EDGES }, outerPl)
    if (mL || mR) outerPanel.mitres = [...(mL ? (["left"] as const) : []), ...(mR ? (["right"] as const) : [])]
    const innerPanel = this.add({ ...this.basePanel(`${which}-inner`, isBottom ? "baix int" : "dalt int", `${nm} (pell de dins)`, which, len, skinDepth, t, c.material, "x", { ...NO_EDGES }, innerPl), grooves, assembly: `${nm} (paret buida)` })
    // Tira del davant (el cantell que es veu, de gruix aparent), amb els talls a 45° del marc.
    const facing = this.hollowPiece(`${which}-facing`, "tira", `${nm} (tira del davant)`, "facing", olen, w, edges(isBottom ? "bottom" : "top"), placement([ox0, y0, D - t], X, Y, Z, Z))
    if (mL || mR) {
      const yOut = isBottom ? 0 : w
      const yIn = isBottom ? w : 0
      facing.outline = [[0, yOut], [olen, yOut], [mR ? olen - ws : olen, yIn], [mL ? ws : 0, yIn]]
    }
    // Llistons: darrere i als dos extrems.
    const gap = w - 2 * t
    this.hollowPiece(`${which}-spacer-back`, "llistó", `${nm} (llistó del darrere)`, "spacer", len, gap, { ...NO_EDGES }, placement([x0, y0 + t, sideZ0], X, Y, Z, neg(Z)))
    const spL = D - t - sideZ0 - t
    for (const [end, x] of [["left", x0], ["right", x0 + len - t]] as const)
      this.hollowPiece(`${which}-spacer-${end}`, "llistó", `${nm} (llistó ${end === "left" ? "esquerre" : "dret"})`, "spacer", spL, gap, { ...NO_EDGES }, placement([x, y0 + t, D - t], neg(Z), Y, X, end === "left" ? neg(X) : X))
    this.horizontals.push({ panel: innerPanel, yBottom: y0, yTop: y0 + w, xL: interior.x0, xR: interior.x1, outer: true, zRear: sideZ0, zFront: D - t })
  }

  private buildHorizontal(which: "bottom" | "top"): void {
    if (this.d.hollow && (which === "bottom" || (this.m.carcass.top.kind === "full" && !this.d.tableTop))) return this.buildHollowHorizontal(which)
    const { m, d } = this
    const c = m.carcass
    const { t, interior } = d
    const isBottom = which === "bottom"
    // Tapa a inglet: arriba fins a fora de cada lateral (x = 0 / W), amb el cantell a 45°.
    const mitreL = (isBottom ? d.mitreBottom : d.mitreTop) && c.sides.left
    const mitreR = (isBottom ? d.mitreBottom : d.mitreTop) && c.sides.right
    // Tauler de taula: per sobre dels laterals, amb voladís a tot el voltant.
    const ov = !isBottom && d.tableTop ? d.tableTop.overhang : 0
    const onTop = !isBottom && !!d.tableTop
    const px0 = onTop ? -ov : mitreL ? 0 : interior.x0
    const length = onTop ? d.W + 2 * ov : (mitreR ? d.W : interior.x1) - px0
    // Fronts de calaix a inglet: la tapa i la base també arriben a la cara dels fronts.
    const ext = d.mitreFronts && (isBottom ? d.mitreBottom : d.mitreTop) ? t : 0
    let width = d.sideDepth + ext + (onTop ? 2 * ov : 0)
    let zRear = d.sideZ0 - (onTop ? ov : 0)
    let cutouts: Cutout[] | undefined
    if (!isBottom && c.top.kind === "ventSlot") {
      width = d.sideDepth - c.top.gap
      zRear = d.sideZ0 + c.top.gap
    }
    const grooves: Panel["grooves"] = []
    if (c.back === "groove" && !(c.top.kind === "ventSlot" && !isBottom)) {
      // Si la peça passa per sobre d'un lateral (inglet, tauler de taula), el fons hi entra
      // també la fondària de la ranura del lateral: la ranura s'allarga g per aquell costat.
      const g = c.grooveDepth
      const gx0 = interior.x0 - (c.sides.left && px0 < interior.x0 - 0.01 ? g : 0)
      const gx1 = interior.x1 + (c.sides.right && px0 + length > interior.x1 + 0.01 ? g : 0)
      grooves.push({
        x: r(gx0 - px0),
        y: isBottom ? r(d.sideDepth + ext - c.backSetback - d.tb) : r(c.backSetback + ov),
        w: r(gx1 - gx0),
        h: d.tb,
        depth: c.grooveDepth,
        face: "A",
        tag: "back",
      })
    }
    const yBottom = isBottom ? d.baseY : d.H - t
    const pl = isBottom
      ? placement([px0, yBottom, d.D + ext], X, neg(Z), Y, neg(Y))
      : placement([px0, d.H, zRear], X, Z, neg(Y), Y)
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
        onTop ? edges("top", "bottom", "left", "right") : ext ? edges() : edges(isBottom ? "bottom" : "top"),
        pl,
      ),
      grooves,
      ...(onTop && d.tableTop!.shape ? { outline: shapeOutline(d.tableTop!.shape, length, width) } : {}),
      // El cantell de davant: «bottom» a la base (y local cap enrere), «top» a la tapa.
      ...(mitreL || mitreR || ext
        ? { mitres: [...(mitreL ? (["left"] as const) : []), ...(mitreR ? (["right"] as const) : []), ...(ext ? [isBottom ? ("bottom" as const) : ("top" as const)] : [])] }
        : {}),
    })
    if (!isBottom && c.top.kind === "grille") {
      // Fons encastat: la franja on el fons toca la tapa (amb les espigues) queda sense ranures, com la trapa o els imants.
      const exclude: Rect[] = []
      if (c.back === "inset") {
        const pad = this.hw.dowel.diameter / 2 + 1
        exclude.push({ x: 0, y: (c.backInsetSetback ?? 0) - zRear - pad, w: panel.length, h: d.tb + 2 * pad })
      }
      const g = grilleCutouts(panel.length, panel.width, c.top.pattern, exclude)
      cutouts = g.cutouts
      this.openRatios.top = g.openRatio
      if (g.openRatio < MIN_OPEN_RATIO) {
        this.warnings.push({ code: "grille-open-ratio", message: `La reixeta de la tapa només té un ${Math.round(g.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, panelId: panel.id })
      }
    }
    if (cutouts?.length) panel.cutouts = cutouts
    this.horizontals.push({ panel, yBottom, yTop: yBottom + t, xL: interior.x0, xR: interior.x1, outer: true, zRear, zFront: zRear + width })

    // Espigues amb els laterals (la base/tapa hi topa; el lateral continua). A inglet no:
    // s'encola amb lamel·les o Clamex, que es fan a mà o amb una eina a 45°.
    const yMid = yBottom + t / 2
    if (onTop)
      this.warnings.push({ code: "table", message: "Tauler de taula per sobre dels laterals: es fixa per sota amb cargols o ferratges d'unió (no porta espigues).", panelId: panel.id })
    if (mitreL || mitreR)
      this.warnings.push({ code: "mitre", message: `${isBottom ? "Base" : "Tapa"} a inglet: tall a 45° als cantells de la ${isBottom ? "base" : "tapa"} i dels laterals; encolar amb lamel·les o Clamex (no porta espigues).`, panelId: panel.id })
    for (const v of this.verticals) {
      if (!v.outer || mitreL || mitreR || onTop) continue
      const xFace = near(v.xR, interior.x0) ? v.xR : v.xL
      if (!near(xFace, interior.x0) && !near(xFace, interior.x1)) continue
      // Sobre la fondària real de la peça (la tapa amb ranura d'aire és més curta).
      const zs = threeAlong(zRear, d.D, this.hw.dowel.endOffset)
      dowelJoint(panel, v.panel, zs.map((z): Vec3 => [xFace, yMid, z]), this.hw.dowel, this.hw.dowel.tag)
    }
  }

  private buildBack(): void {
    const { m, d } = this
    const c = m.carcass
    const { interior } = d
    if (c.back === "inset") return this.buildInsetBack()
    if (c.back === "screwed") {
      // Cargolat per darrere, els seus quatre cantells es veuen de costat i de dalt. Si és
      // del mateix tauler que el cos (no un DM de fons), es cantegen com la resta.
      const visible = c.backMaterial === c.material
      // Amb tauler de taula, s'acaba a sota de la tapa (que passa per sobre).
      this.add(
        this.basePanel("back", "trassera", "Fons", "back", d.W, d.sideH, d.tb, c.backMaterial, "none", visible ? edges("top", "bottom", "left", "right") : { ...NO_EDGES }, placement([0, 0, 0], X, Y, Z, neg(Z))),
      )
      return
    }
    const g = c.grooveDepth
    const cl = c.backClearance
    const xL = c.sides.left ? interior.x0 - g + cl / 2 : interior.x0
    const xR = c.sides.right ? interior.x1 + g - cl / 2 : interior.x1
    const yB = d.hasBase ? interior.y0 - g + cl / 2 : interior.y0
    // Fins on arriba la ranura: dins de la de la tapa o, si la tapa no en porta (ranura d'aire), a sota.
    const top = this.backGrooveTop()
    const yT = top > interior.y1 ? top - cl / 2 : interior.y1
    this.add(
      this.basePanel("back", "trassera", "Fons", "back", xR - xL, yT - yB, d.tb, c.backMaterial, "none", { ...NO_EDGES }, placement([xL, yB, c.backSetback], X, Y, Z, neg(Z))),
    )
  }

  /**
   * Fons encastat: ocupa la llum interior (entre laterals, base i tapa; on falta una peça, fins a
   * fora del mòdul), a `backInsetSetback` del cantell posterior. S'uneix com un prestatge fix:
   * espigues al cantell del fons i forats de cara a laterals, base i tapa (tres per costat, a
   * `endOffset` dels extrems). Amb un fons de menys de 15 mm no hi caben espigues: avís.
   */
  private buildInsetBack(): void {
    const { m, d } = this
    const c = m.carcass
    const { interior } = d
    const z0 = c.backInsetSetback ?? 0
    // Tapa amb ranura d'aire: aire entre la cara de davant del fons i el darrere de la tapa (el cantell de dalt del fons s'hi veu).
    const slot = d.hasTop && c.top.kind === "ventSlot" ? d.sideZ0 + c.top.gap - (z0 + d.tb) : null
    // Del mateix tauler que el cos: es veu per darrere; veta vertical i cantell on no toca res (o on la ranura el deixa veure).
    const visible = c.backMaterial === c.material
    const eb = visible
      ? edges(
          ...(c.sides.left ? [] : (["left"] as const)),
          ...(c.sides.right ? [] : (["right"] as const)),
          ...(d.hasBase ? [] : (["bottom"] as const)),
          ...(!d.hasTop || (slot !== null && slot > 0) ? (["top"] as const) : []),
        )
      : { ...NO_EDGES }
    const back = this.add(
      this.basePanel("back", "trassera", "Fons", "back", interior.x1 - interior.x0, interior.y1 - interior.y0, d.tb, c.backMaterial, visible ? "y" : "none", eb, placement([interior.x0, interior.y0, z0], X, Y, Z, neg(Z))),
    )
    if (slot !== null && slot < 10) {
      this.warnings.push({
        code: "back-inset",
        message:
          slot <= 0
            ? `Ranura d'aire de la tapa: amb el fons encastat (retirada ${num(z0)} + gruix ${num(d.tb)} mm) la ranura queda tapada. Fes-la més ampla (més de ${num(z0 + d.tb + 10)} mm) o retira menys el fons.`
            : `Ranura d'aire de la tapa: entre el fons encastat i la tapa només queden ${num(slot)} mm (calen 10 mm o més). Fes la ranura més ampla o retira menys el fons.`,
        panelId: back.id,
      })
    }
    // Fondària que queda davant del fons: hi han de cabre les dues fileres System 32 (`rows`: la de darrere no es fa si
    // arribaria a la de davant).
    const s32 = this.hw.system32
    const need = 2 * s32.edgeOffset + s32.diameter
    if (d.D - d.backInnerZ < need) {
      this.warnings.push({
        code: "back-inset",
        message: `Fons encastat: davant del fons només queden ${num(d.D - d.backInnerZ)} mm de fondària (calen ${num(need)} mm per a les dues fileres System 32 a ${num(s32.edgeOffset)} mm dels cantells). Retira menys el fons o fes el mòdul més fondo; si les fileres es trobarien, la de darrere no es fa.`,
        panelId: back.id,
      })
    }
    if (d.tb < 15) {
      this.warnings.push({ code: "back-inset", message: `Fons encastat de ${d.tb} mm: massa prim per a espigues al cantell (calen 15 mm o més). Fixa'l amb cargols des dels laterals, la base i la tapa, o posa'l en ranura.`, panelId: back.id })
      return
    }
    const dw = this.hw.dowel
    const zMid = z0 + d.tb / 2
    const rad = dw.diameter / 2
    // Només els punts que cauen dins de la peça que continua (la tapa amb ranura d'aire no arriba al fons).
    const join = (through: Panel, pts: Vec3[]) =>
      dowelJoint(back, through, pts.filter((w) => {
        const l = toLocal(through, w)
        return l[0] >= rad && l[0] <= through.length - rad && l[1] >= rad && l[1] <= through.width - rad
      }), dw, dw.tag)
    for (const v of this.verticals) {
      if (!v.outer) continue
      const xFace = near(v.xR, interior.x0) ? v.xR : near(v.xL, interior.x1) ? v.xL : null
      if (xFace === null) continue
      join(v.panel, threeAlong(interior.y0, interior.y1, dw.endOffset).map((y): Vec3 => [xFace, y, zMid]))
    }
    for (const h of this.horizontals) {
      if (!h.outer) continue
      // El tauler de taula es fixa per sota amb cargols (no porta espigues).
      if (d.tableTop && h.panel.id === "top") continue
      const yFace = d.hasBase && near(h.yTop, interior.y0) ? h.yTop : d.hasTop && near(h.yBottom, interior.y1) ? h.yBottom : null
      if (yFace === null) continue
      join(h.panel, threeAlong(interior.x0, interior.x1, dw.endOffset).map((x): Vec3 => [x, yFace, zMid]))
    }
  }

  /** Y de dalt de la ranura del fons: dins de la tapa (g), si la tapa porta ranura. */
  private backGrooveTop(): number {
    const { m, d } = this
    const c = m.carcass
    // Tapa amb ranura d'aire: no porta ranura del fons i el fons s'atura a sota (no hi entra).
    if (!d.hasTop || c.top.kind === "ventSlot") return d.interior.y1
    return d.interior.y1 + c.grooveDepth
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

    // Zones que queden darrere del front d'una zona pare (portes d'armari de dalt a baix).
    const walk = (z: Zone, covered: boolean) => {
      this.zones.set(z.id, z)
      if (covered) this.covered.add(z.id)
      if (z.split) for (const c of z.split.children) walk(c, covered || !!z.front)
    }
    walk(m.root, false)

    // 1) Divisors i prestatges fixos de totes les divisions.
    layout.dividers.forEach((div, i) => {
      const cut = this.insetCut(div.parentId)
      if (div.dir === "v") this.buildDivider(div.at, div.from, div.to, `divider-${i + 1}`, cut)
      else this.buildFixedShelf(div.at, div.from, div.to, `fixed-${i + 1}`, cut)
    })
    // 2) Unions dels divisors amb el que tenen a sota i a sobre, i dels fixos amb els costats.
    for (const v of this.verticals) if (!v.outer) this.joinDivider(v)
    for (const h of this.horizontals) if (!h.outer) this.joinFixedShelf(h)
    // 3) Fulles: fileres, prestatges regulables i fronts. Les que són darrere del front d'una
    // zona dividida no en fan: el front és el del pare.
    for (const zone of layout.leaves) this.buildLeaf(this.covered.has(zone.id) ? { ...zone, front: undefined } : zone, layout.rects.get(zone.id)!)
    const parents = (z: Zone) => {
      if (!z.split) return
      if (z.front && !this.covered.has(z.id)) this.buildParentFront(z, layout.rects.get(z.id)!)
      z.split.children.forEach(parents)
    }
    parents(m.root)

    // 4) Passacables i extres.
    for (const hole of m.extras.cableHoles) this.cableHole(hole)
    if (d.mitreFronts)
      this.warnings.push({ code: "mitre", message: "Fronts dels calaixos a inglet amb els laterals: els laterals arriben fins a la cara dels fronts i tots dos es tallen a 45°. Cal un joc de 1–2 mm al tall perquè el calaix obri." })
    return layout
  }

  /**
   * Fondària que perd un divisor o un prestatge fix de la zona `parentId` quan un front encastat
   * (el de la zona o el d'una zona pare) el tapa: el front entra un gruix dins de la llum.
   */
  private insetCut(parentId: string): number {
    const { m, d } = this
    const z = this.zones.get(parentId)
    return d.inset && (!!z?.front || this.covered.has(parentId)) ? d.t + m.fronts.outerGap : 0
  }

  private buildDivider(x: number, yFrom: number, yTo: number, id: string, cut = 0): void {
    const { m, d } = this
    const t = d.t
    const panel = this.add(
      this.basePanel(id, "divisor", "Divisor", "divider", yTo - yFrom, d.availDepth - cut, t, m.carcass.material, "x", edges("top"), placement([x, yFrom, d.backInnerZ], Y, Z, X, Z)),
    )
    this.verticals.push({ panel, xL: x, xR: x + t, yB: yFrom, yT: yTo, zRear: d.backInnerZ, zFront: d.D - cut, outer: false })
  }

  private buildFixedShelf(y: number, xFrom: number, xTo: number, id: string, cut = 0): void {
    const { m, d } = this
    const t = d.t
    const zFront = d.D - cut
    const panel = this.add(
      this.basePanel(id, "estanter fixe", "Prestatge fix", "fixedShelf", xTo - xFrom, d.availDepth - cut, t, m.carcass.material, "x", edges("bottom"), placement([xFrom, y, zFront], X, neg(Z), Y, Z)),
    )
    this.horizontals.push({ panel, yBottom: y, yTop: y + t, xL: xFrom, xR: xTo, outer: false, zRear: d.backInnerZ, zFront })
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

  /**
   * Espigues entre un divisor o un prestatge fix i la peça on topa: repartides sobre el tram de fondària que tenen en
   * comú (la tapa amb ranura d'aire comença després de la ranura; un prestatge fix tapat per un front encastat és més
   * curt). Si el tram és massa curt per a tres, dues o una (`dowelsAlong`).
   */
  private sharedDowelZs(z0: number, z1: number): number[] {
    const dw = this.hw.dowel
    if (z1 - z0 >= 2 * dw.endOffset + dw.diameter) return threeAlong(z0, z1, dw.endOffset)
    return dowelsAlong(z0, z1, Math.min(dw.endOffset, (z1 - z0) / 4), dw.diameter)
  }

  private joinDivider(v: VerticalRef): void {
    const xMid = (v.xL + v.xR) / 2
    const rect: ZoneRect = { x0: v.xL, x1: v.xR, y0: v.yB, y1: v.yT }
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    for (const [h, y] of [[below, v.yB], [above, v.yT]] as const) {
      if (!h) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      dowelJoint(v.panel, h.panel, zs.map((z): Vec3 => [xMid, y, z]), this.hw.dowel, this.hw.dowel.tag)
    }
  }

  private joinFixedShelf(h: HorizontalRef): void {
    const yMid = (h.yBottom + h.yTop) / 2
    const rect: ZoneRect = { x0: h.xL, x1: h.xR, y0: h.yBottom, y1: h.yTop }
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    for (const [v, x] of [[left, h.xL], [right, h.xR]] as const) {
      if (!v) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      dowelJoint(h.panel, v.panel, zs.map((z): Vec3 => [x, yMid, z]), this.hw.dowel, this.hw.dowel.tag)
    }
  }

  /** Filera System 32 sobre la cara d'un panell vertical, per al tram d'una zona. */
  private rows(v: VerticalRef, rect: ZoneRect, side: "left" | "right"): number[] {
    const s = this.hw.system32
    const ys = system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch)
    const xFace = side === "left" ? v.xR : v.xL
    // Fons encastat retirat: la filera de darrere es mesura des del darrere del fons, però mai dins del fons (gruixos de 30
    // o 40): com a molt a prop, a un Ø de la seva cara de davant.
    const c = this.m.carcass
    const zFront = v.zFront - s.edgeOffset
    const zBack = c.back === "inset" ? Math.max(Math.max(v.zRear, c.backInsetSetback ?? 0) + s.edgeOffset, this.d.backInnerZ + s.diameter) : v.zRear + s.edgeOffset
    // Si la de darrere arribaria a la de davant (mòdul massa poc fondo), només la de davant (la de les frontisses).
    const rear = zBack <= zFront - s.diameter
    for (const y of ys) {
      addFaceHole(v.panel, [xFace, y, zFront], s.hole)
      if (rear) addFaceHole(v.panel, [xFace, y, zBack], s.hole)
    }
    return ys
  }

  private buildLeaf(zone: Zone, rect: ZoneRect): void {
    const { d } = this
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
    const s = this.hw.system32
    const rowYs = ysLeft.length ? ysLeft : ysRight.length ? ysRight : system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch)

    // Prestatges.
    const shelfYs = zone.shelves && zone.shelves.n > 0 ? this.buildShelves(zone, rect, rowYs) : []
    if (zone.rail) this.buildRail(zone, rect)
    if (zone.led) this.buildLed(zone, rect, shelfYs)

    // Front.
    if (!front) return
    this.buildFront(zone, front, rect, left, right, rowYs)
    void d
  }

  /**
   * Front d'una zona dividida (p. ex. les portes d'un armari que tapen el penjador i el
   * maleter): cobreix tota la zona; les fulles de dins queden darrere.
   */
  private buildParentFront(zone: Zone, rect: ZoneRect): void {
    const s = this.hw.system32
    const front = zone.front!
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    // Com a les fulles: filera System 32 al costat de les frontisses (hi va la placa), però
    // només als trams lliures entre els prestatges fixos que hi toquen (els mateixos trams que
    // les fulles: els forats coincideixen i no en trepitgen cap altre).
    const hingeSide = front.kind === "door" ? front.hinge : front.kind === "grille" && front.mount === "hinged" ? front.hinge : null
    const double = front.kind === "door" && front.mode === "double"
    let ys: number[] = []
    for (const side of ["left", "right"] as const) {
      if (hingeSide !== side && !double) continue
      const ref = side === "left" ? left : right
      if (ref) {
        const xFace = side === "left" ? ref.xR : ref.xL
        const cuts = this.horizontals
          .filter((h) => !h.outer && near(side === "left" ? h.xL : h.xR, xFace) && h.yBottom > rect.y0 - 0.51 && h.yTop < rect.y1 + 0.51)
          .sort((a, b) => a.yBottom - b.yBottom)
        const got: number[] = []
        let y0 = rect.y0
        for (const y1 of [...cuts.map((h) => h.yBottom), rect.y1]) {
          if (y1 - y0 > 0.5) got.push(...this.rows(ref, { ...rect, y0, y1 }, side))
          y0 = cuts.find((h) => h.yBottom === y1)?.yTop ?? y1
        }
        if (!ys.length) ys = got
      } else this.warnings.push({ code: "no-side", message: `La zona no té panell a la ${side === "left" ? "esquerra" : "dreta"} per a la filera System 32.`, zoneId: zone.id })
    }
    this.buildFront(zone, front, rect, left, right, ys.length ? ys : system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch))
  }

  private buildFront(zone: Zone, front: Front, rect: ZoneRect, left: VerticalRef | undefined, right: VerticalRef | undefined, rowYs: number[]): void {
    const territory = this.frontTerritory(rect, left, right)
    switch (front.kind) {
      case "door":
        this.buildDoors(zone, front, territory, rowYs, left, right)
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
  }

  /**
   * Barra de penjar: tub d'inox Ø25 de lateral a lateral, a 50 mm del sostre del compartiment
   * i centrat en la fondària útil. No és de CNC: va a `extras` (3D i llista). Els suports es
   * cargolen als laterals.
   */
  private buildRail(zone: Zone, rect: ZoneRect): void {
    const { d } = this
    const R = 25
    const len = r(rect.x1 - rect.x0 - 2)
    const cy = rect.y1 - 50
    const cz = d.backInnerZ + (d.D - d.backInnerZ) / 2
    if (rect.y1 - rect.y0 < 900) this.warnings.push({ code: "rail", message: "Barra de penjar en un compartiment de menys de 900 mm: la roba llarga no hi cap.", zoneId: zone.id })
    const b = Math.tan(Math.PI / 8)
    this.extras.push({
      id: `rail-${zone.id}`,
      name: "barra",
      label: "Barra de penjar",
      role: "part",
      length: R,
      width: R,
      thickness: len,
      material: "Acer inox",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      outline: [
        [R, R / 2, b],
        [R / 2, R, b],
        [0, R / 2, b],
        [R / 2, 0, b],
      ],
      // Secció al pla Z·Y i el llarg (gruix local) cap a −X, des del lateral dret.
      placement: { origin: [r(rect.x1 - 1), r(cy - R / 2), r(cz - R / 2)], xAxis: [0, 0, 1], yAxis: [0, 1, 0], zAxis: [-1, 0, 0], explodeDir: [0, 0, 1] },
    })
  }

  /**
   * Llum LED: perfil d'alumini de 16 × 8 amb tira LED càlida sota el sostre del compartiment i sota cada prestatge, a
   * 20 mm del davant del prestatge (il·lumina el que hi ha a sota). No és de CNC: va a `extras` (3D, render i llista, amb
   * el llarg per tallar el perfil). Material «Tira LED» (fa llum al render).
   */
  private buildLed(zone: Zone, rect: ZoneRect, shelfYs: number[]): void {
    const { m, d } = this
    const W = 16, H = 8
    const len = r(rect.x1 - rect.x0 - 20)
    if (len < 50) return
    const zFront = d.D - m.carcass.shelfSetback - 20
    const ys = [rect.y1, ...shelfYs].map((y) => r(y - H))
    ys.forEach((y, i) => {
      this.extras.push({
        id: `led-${zone.id}-${i}`,
        name: "tira LED",
        label: "Tira LED",
        role: "part",
        length: len,
        width: W,
        thickness: H,
        material: "Tira LED",
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(rect.x0 + 10), y, zFront], X, neg(Z), Y, Z),
      })
    })
  }

  /** Posa els prestatges i torna on és la cara de sota de cadascun (per a la llum LED). */
  private buildShelves(zone: Zone, rect: ZoneRect, rowYs: number[]): number[] {
    const { m, d } = this
    const c = m.carcass
    const n = zone.shelves!.n
    const t = d.t
    // Gruix aparent (prestatges buits): cal lloc per a dues pells i un llistó.
    const want = zone.shelves!.thickness
    const T = want && want >= 2 * t + 6 ? want : t
    const hollow = T > t
    if (want && !hollow) this.warnings.push({ code: "hollow", message: `Prestatges de ${want} mm: amb tauler de ${t} cal un gruix d'almenys ${2 * t + 6} mm. Es fan massissos.`, zoneId: zone.id })
    const width = rect.x1 - rect.x0
    const length = width - c.shelfClearance
    // A ras del davant (a sang): sense retranqueig. Amb fronts encastats no hi cabria la porta.
    // Amb fronts encastats, a ras només es pot si el compartiment és obert (sense front).
    const blocked = d.inset && (!!zone.front || this.covered.has(zone.id))
    const flush = !!zone.shelves!.flush && !blocked
    if (zone.shelves!.flush && blocked) this.warnings.push({ code: "inset", message: "Prestatges a ras del davant amb fronts encastats: toparien amb el front. Es retiren com sempre.", zoneId: zone.id })
    const setback = flush ? 0 : c.shelfSetback
    const depth = d.availDepth - setback
    const innerH = rect.y1 - rect.y0
    const gap = (innerH - n * T) / (n + 1)
    if (width > 800 && t <= 19 && !hollow) {
      this.warnings.push({ code: "shelf-span", message: `Prestatge de ${num(t)} mm amb una llum de ${num(width)} mm: es vinclarà (màxim recomanat 800).`, zoneId: zone.id })
    }
    const x0 = rect.x0 + c.shelfClearance / 2
    const zF = d.D - setback
    // On va cada prestatge. Regulables: a la filera més propera que no trepitgi cap altre prestatge (si no n'hi ha cap
    // de lliure, no es fa). Fixos: si no hi caben amb 10 mm entre ells, només els que hi caben.
    const ys: number[] = []
    if (zone.shelves!.adjustable && rowYs.length) {
      for (let k = 1; k <= n; k++) {
        const target = rect.y0 + k * gap + (k - 1) * T
        const free = rowYs.filter((ry) => ry + T <= rect.y1 + 0.01 && ys.every((u) => Math.abs(u - ry) >= T + 1))
        if (free.length) ys.push(snap(target, free))
      }
      ys.sort((a, b) => a - b)
    } else {
      const fit = Math.max(0, Math.min(n, Math.floor((innerH - 10) / (T + 10))))
      const g = (innerH - fit * T) / (fit + 1)
      for (let k = 1; k <= fit; k++) ys.push(r(rect.y0 + k * g + (k - 1) * T))
    }
    if (ys.length < n)
      this.warnings.push({
        code: "shelves",
        message: `Hi caben ${ys.length} de ${n} prestatges ${zone.shelves!.adjustable ? "regulables (cada un en una filera lliure sense trepitjar-ne cap altre)" : "(amb almenys 10 mm entre ells)"} en ${num(innerH)} mm: se'n fan ${ys.length}.`,
        zoneId: zone.id,
      })
    for (const y of ys) {
      this.shelfCount += 1
      const idx = this.shelfCount
      const nm = this.shelfCount === 1 && n === 1 ? "Prestatge" : `Prestatge ${idx}`
      const code = this.shelfCount === 1 && n === 1 ? "estanter" : `estanter ${idx}`
      if (!hollow) {
        this.add(this.basePanel(`shelf-${idx}`, code, nm, "shelf", length, depth, t, c.material, "x", edges("bottom"), placement([x0, y, zF], X, neg(Z), Y, Z)))
        continue
      }
      // Prestatge buit: pell de baix i de dalt, tira al davant i llistons (darrere i extrems).
      const assembly = `${nm} (buit)`
      const piece = (id: string, label: string, role: PanelRole, L: number, Wd: number, eb: EdgeBanding, pl: Panel["placement"]) =>
        this.add({ ...this.basePanel(id, code, label, role, L, Wd, t, c.material, "x", eb, pl), assembly })
      const skinD = depth - t
      piece(`shelf-${idx}`, `${nm} (pell de baix)`, "shelf", length, skinD, { ...NO_EDGES }, placement([x0, y, zF - t], X, neg(Z), Y, Z))
      piece(`shelf-${idx}-top`, `${nm} (pell de dalt)`, "shelf", length, skinD, { ...NO_EDGES }, placement([x0, y + T - t, zF - t], X, neg(Z), Y, Z))
      piece(`shelf-${idx}-facing`, `${nm} (tira del davant)`, "facing", length, T, edges("bottom", "top", "left", "right"), placement([x0, y, zF - t], X, Y, Z, Z))
      const zBack = zF - depth
      piece(`shelf-${idx}-spacer-back`, `${nm} (llistó del darrere)`, "spacer", length, T - 2 * t, { ...NO_EDGES }, placement([x0, y + t, zBack], X, Y, Z, neg(Z)))
      for (const [end, x] of [["left", x0], ["right", x0 + length - t]] as const)
        piece(`shelf-${idx}-spacer-${end}`, `${nm} (llistó ${end === "left" ? "esquerre" : "dret"})`, "spacer", depth - 2 * t, T - 2 * t, { ...NO_EDGES }, placement([x, y + t, zF - t], neg(Z), Y, X, end === "left" ? neg(X) : X))
    }
    return ys
  }

  /** Rectangle que un front tapa: la llum més el que li toca dels panells del voltant, menys jocs. */
  private frontTerritory(rect: ZoneRect, left?: VerticalRef, right?: VerticalRef): ZoneRect {
    const { m, d } = this
    const t = d.t
    const og = m.fronts.outerGap
    const bg = m.fronts.betweenGap
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    // Encastats: dins de la llum, amb el joc a cada costat.
    if (d.inset) return { x0: r(rect.x0 + og), x1: r(rect.x1 - og), y0: r(rect.y0 + og), y1: r(rect.y1 - og) }
    // Les parets exteriors poden ser més gruixudes que el tauler (parets buides).
    // Fronts de calaix a inglet: de fora a fora als laterals (el tall a 45° fa el joc).
    const ogL = d.mitreFronts ? 0 : og
    const x0 = left ? (left.outer ? rect.x0 - (left.xR - left.xL) + ogL : rect.x0 - t / 2 + bg / 2) : rect.x0 + og
    const x1 = right ? (right.outer ? rect.x1 + (right.xR - right.xL) - ogL : rect.x1 + t / 2 - bg / 2) : rect.x1 - og
    const ogB = d.mitreFronts && d.mitreBottom ? 0 : og
    const ogT = d.mitreFronts && d.mitreTop ? 0 : og
    const y0 = below ? (below.outer ? rect.y0 - (below.yTop - below.yBottom) + ogB : rect.y0 - t / 2 + bg / 2) : rect.y0 + og
    // Tauler de taula amb voladís: sobresurt per davant dels fronts (que hi toparien); el front s'atura a sota, amb el joc.
    const underTable = !!above && above.outer && above.panel.id === "top" && !!d.tableTop && d.tableTop.overhang > 0
    const y1 = above ? (underTable ? rect.y1 - og : above.outer ? rect.y1 + (above.yTop - above.yBottom) - ogT : rect.y1 + t / 2 - bg / 2) : rect.y1 - og
    return { x0: r(x0), x1: r(x1), y0: r(y0), y1: r(y1) }
  }

  /**
   * El tirador d'un front: el triat a la porta, el calaix o l'abatible (`front.handle`) o, si no, el del mòdul. Un que no
   * serveix torna al del mòdul; un d'**importat** que no serveix queda inert (cap forat, `inertHandle`), mai el del mòdul.
   */
  private frontHandle(item: HardwareItem | undefined, zoneId?: string): { spec: SlotSpec<"handle">; item: HardwareItem } {
    if (!item) return this.kit.handle
    const res = slotSpec("handle", item, (message) => this.hardwareWarning(message, zoneId))
    return res.failed && !item.imported ? this.kit.handle : res
  }

  /**
   * Tirador del front; sense tiradors (`handles: "none"`), cap forat i un avís (una vegada) del ferratge push. Un tirador
   * importat **sense confirmar** (o que no serveix) no fa cap forat: avís `hardware` (el taller no rep res que no s'hagi
   * revisat). Un d'importat i confirmat posa el seu model al 3D (`Panel.fittings`, a la cara de fora).
   */
  private handle(p: Panel, cx: number, cy: number, along: "x" | "y", hs: { spec: SlotSpec<"handle">; item: HardwareItem } = this.kit.handle, zoneId?: string): void {
    if (this.m.fronts.handles !== "none") {
      const { spec, item } = hs
      if (spec.pending) {
        this.hardwareWarning(spec.unusable ?? `«${item.name}» és un tirador importat i encara no està confirmat: els fronts que el porten no fan els forats del tirador. Revisa'l i confirma'l a Preferències › Ferratges.`, zoneId)
        return
      }
      if (!addHandle(p, cx, cy, along, item, spec)) {
        this.warnings.push({ code: "handle", message: `${p.label} de ${num(p.width)} × ${num(p.length)} mm: massa petit per als forats del tirador (o toparien amb les cassoletes). No es fan: posa-hi un pom o un tirador de cantell.`, panelId: p.id })
        return
      }
      const imp = item.imported
      if (imp && (imp.asset || imp.bbox)) {
        // Cara de fora del front (la que mira cap al davant del moble) i el marc del tirador: u al llarg dels forats.
        const face = p.placement.zAxis[2] > 0 ? "A" : "B"
        const v: [number, number] = along === "x" ? [0, face === "A" ? 1 : -1] : [face === "A" ? -1 : 1, 0]
        ;(p.fittings ??= []).push({ kind: "handle", ...(imp.asset ? { asset: imp.asset } : {}), x: r(cx), y: r(cy), face, v, ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
      return
    }
    p.push = true
    if (!this.warnings.some((w) => w.code === "push"))
      this.warnings.push({ code: "push", message: "Fronts sense tirador: cada porta, calaix o abatible necessita un ferratge d'obertura per pressió (push, p. ex. Tip-On o Push-to-open); als calaixos, guies amb push; a les portes, frontisses sense molla (sense retenció), perquè el push les pugui obrir." })
  }

  private frontPanel(id: string, name: string, label: string, role: PanelRole, x0: number, y0: number, w: number, h: number): Panel {
    const { m, d } = this
    return this.add(
      this.basePanel(id, name, label, role, h, w, d.t, frontMaterialOf(m), "x", edges("left", "right", "bottom", "top"), placement([x0, y0, d.frontZ], Y, X, neg(Z), Z)),
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

  /**
   * Cassoletes d'una porta (o reixeta amb frontisses) amb la frontissa `hinge` (la de la porta o la del mòdul): la
   * quantitat per alçada i els números surten de l'item; la regla (repartides, al mig de dos forats de la filera System
   * 32, sense trepitjar-se) és d'aquí. Els forats, del motor (`applyHardware`).
   */
  private addCups(door: Panel, doorH: number, hingeSide: "left" | "right", doorW: number, rowYs: number[], doorY0: number, zoneId?: string, hinge = this.kit.hinge, side?: VerticalRef): number {
    const h = hinge.spec
    // Importada i sense confirmar: cap forat (ni a la porta ni al lateral) i un avís; el taller no en rep res.
    if (h.pending) {
      this.hardwareWarning(h.unusable ?? `«${hinge.item.name}» és importada i encara no està confirmada: la porta queda sense cassoletes ni forats. Revisa-la i confirma-la a Preferències › Ferratges.`, zoneId)
      return 0
    }
    const half = this.hw.system32.pitch / 2
    // Entre dos forats seguits de la filera (amb trams, no entre l'últim d'un i el primer de l'altre).
    const pitch = this.hw.system32.pitch
    const midpoints = rowYs.filter((y) => rowYs.some((z) => Math.abs(z - y - pitch) < 0.01)).map((y) => r(y + half))
    const count = h.count(doorH)
    const span = doorH - 2 * h.endOffset
    const targets = count === 1 ? [doorH / 2] : Array.from({ length: count }, (_, i) => h.endOffset + (span * i) / (count - 1))
    // Cassoletes sense trepitjar-se: entre centres, almenys el diàmetre i 10 mm, i dins de la porta.
    const dia = h.cupDiameter
    // Tot el patró de la frontissa (cassoleta i cargols o espigues) ha de cabre a la porta amb el marge: al llarg del
    // cantell (de `lo` a `hi`) i a través (la cassoleta, a `cupOffset` del cantell, no ha de sortir per l'altre costat).
    // Amb la frontissa d'inici el patró és només la cassoleta (els números de sempre).
    const pattern = applyHardware(hinge.item, "door", {}, { at: { x: 0, y: 0 } }).holes
    const below = Math.max(dia / 2, ...pattern.map((o) => o.diameter / 2 - o.x))
    const above = Math.max(dia / 2, ...pattern.map((o) => o.x + o.diameter / 2))
    const across = Math.max(h.cupOffset + dia / 2, ...pattern.map((o) => o.y + o.diameter / 2))
    const nearEdge = Math.min(h.cupOffset - dia / 2, ...pattern.map((o) => o.y - o.diameter / 2))
    // Porta massa estreta: la cassoleta (a `cupOffset` del cantell) o un cargol sortiria per l'altre costat.
    const minW = across + h.margin
    if (doorW < minW || nearEdge < 0) {
      this.warnings.push({ code: "hinge", message: `${door.label} de ${num(doorW)} mm d'amplada: no hi cap la cassoleta de la frontissa (calen ${num(minW)} mm). Fes-la més ampla o posa-hi un front fix.`, zoneId, panelId: door.id })
      return 0
    }
    const minGap = dia + h.gap
    const lo = doorY0 + below + h.margin
    const hi = doorY0 + doorH - above - h.margin
    // La placa (si n'hi ha) ha de cabre sencera al lateral a cada alçada; si no, aquella frontissa no es fa.
    if (h.plate && !side) this.warnings.push({ code: "hinge", message: `${door.label}: la placa de «${hinge.item.name}» va al lateral de les frontisses i aquest mòdul no en té (${hingeSide === "left" ? "esquerra" : "dreta"}). Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId, panelId: door.id })
    const plateWhy = new Set<string>()
    const plateAt = (y: number) => {
      if (!h.plate || !side) return null
      const res = this.plateHoles(side, hingeSide, y, h.plate, hinge.item)
      if ("error" in res) plateWhy.add(res.error)
      return res
    }
    const placed: number[] = []
    for (const target of targets) {
      const pool = (midpoints.length ? midpoints : [r(Math.min(hi, Math.max(lo, target + doorY0)))]).filter((y) => y >= lo && y <= hi && placed.every((p) => Math.abs(p - y) >= minGap) && !(plateAt(y) && "error" in plateAt(y)!))
      if (!pool.length) continue
      const y = snap(target + doorY0, pool)
      placed.push(y)
      // Ancoratge: al cantell de la frontissa (x local = alçada); a la dreta, des de l'altre cantell.
      const at = applyHardware(hinge.item, "door", {}, { at: { x: r(y - doorY0), y: 0 }, ...(hingeSide === "left" ? {} : { mirrorY: doorW }) })
      door.holes.push(...at.holes)
      // Ferratge importat: el model (només per veure'l) a la cassoleta i la placa aparellada al lateral.
      const imp = hinge.item.imported
      if (imp) {
        const cupX = r(y - doorY0)
        const cupY = hingeSide === "left" ? h.cupOffset : r(doorW - h.cupOffset)
        const face = at.holes[0]?.face === "B" ? "B" : "A"
        ;(door.fittings ??= []).push({ ...(imp.asset ? { asset: imp.asset } : {}), x: cupX, y: cupY, face, v: [0, hingeSide === "left" ? 1 : -1], ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
      const plate = plateAt(y)
      if (plate && !("error" in plate)) this.addPlate(side!, plate, hinge.item, zoneId)
    }
    if (placed.length < count)
      this.warnings.push({ code: "hinge", message: `${door.label} de ${r(doorH)} mm: només hi caben ${placed.length} de ${count} frontisses sense que les cassoletes es trepitgin${plateWhy.size ? ` ni que la placa surti del lateral o caigui en una unió (${[...plateWhy].join(" ")})` : ""}.`, zoneId, panelId: door.id })
    return placed.length
  }

  /**
   * Forats de la placa de muntatge d'una frontissa importada, a la cara de dins del lateral de les frontisses: a la
   * referència de la placa (`setback` darrere de la cara de darrere de la porta —amb fronts recobrents, el cantell de
   * davant del lateral; amb encastats, un gruix de front més endins— i `offset` per sobre del centre de la cassoleta
   * `yCup`). Marc de la placa: v cap al darrere, n cap a dins del moble, u = v × n (el mateix que el model importat).
   * **Tota o res**: si un forat (amb el seu radi) sortiria del lateral o cauria a la unió amb la base, la tapa o un
   * prestatge fix, `error`. Un forat més fondo que el lateral es deixa a gruix − 1 (pell d'1 mm) i ho diu `notes`.
   */
  private plateHoles(side: VerticalRef, hingeSide: "left" | "right", yCup: number, plate: NonNullable<SlotSpec<"hinge">["plate"]>, item: HardwareItem): { holes: Hole[]; notes: string[]; origin: Vec3; v: Vec3 } | { error: string } {
    const { d } = this
    const xFace = hingeSide === "left" ? side.xR : side.xL
    const n: Vec3 = hingeSide === "left" ? X : neg(X)
    const v: Vec3 = neg(Z)
    const u: Vec3 = [v[1] * n[2] - v[2] * n[1], v[2] * n[0] - v[0] * n[2], v[0] * n[1] - v[1] * n[0]]
    // La referència es mesura des de la cara de darrere de la porta (recobrent: el davant del moble; encastada: un gruix
    // de front més endins). Amb fronts recobrents és el cantell de davant del lateral de sempre (37).
    const o: Vec3 = [xFace, yCup + plate.offset, d.frontZ - d.t - plate.setback]
    const at = (du: number, dv: number): Vec3 => [o[0] + du * u[0] + dv * v[0], o[1] + du * u[1] + dv * v[1], o[2] + du * u[2] + dv * v[2]]
    const p = side.panel
    const holes: Hole[] = []
    const notes: string[] = []
    for (const hole of plate.holes) {
      const w = at(hole.u, hole.v)
      const l = toLocal(p, w)
      const face = faceAt(p, l)
      const rad = hole.d / 2
      if (!face || face === "edge" || l[0] - rad < 0 || l[0] + rad > p.length || l[1] - rad < 0 || l[1] + rad > p.width)
        return { error: `Placa de «${item.name}»: un forat Ø${num(hole.d)} surt del ${p.label.toLowerCase()}.` }
      // Unions de la base, la tapa i els prestatges fixos que topen a aquesta cara: espigues i cantell.
      const joint = this.horizontals.find((hz) => (near(hz.xL, xFace) || near(hz.xR, xFace)) && w[1] + rad > hz.yBottom && w[1] - rad < hz.yTop && w[2] + rad > hz.zRear && w[2] - rad < hz.zFront)
      if (joint) return { error: `Placa de «${item.name}»: un forat cau a la unió amb ${joint.panel.label.toLowerCase()}.` }
      let depth = hole.depth
      if (depth > p.thickness - 1) {
        depth = Math.max(0.5, Math.floor((p.thickness - 1) * 2) / 2)
        notes.push(`Placa de «${item.name}»: un forat de ${num(hole.depth)} mm és massa fondo per al ${p.label.toLowerCase()} de ${num(p.thickness)} mm; es fa de ${num(depth)} mm (1 mm de pell). Comprova que la placa hi aguanta.`)
      }
      holes.push({ x: l[0], y: l[1], diameter: hole.d, depth, face, tag: hole.tag ?? "plate" })
    }
    return { holes, notes, origin: o, v }
  }

  /** Posa els forats de la placa (`plateHoles`) al lateral. Un forat que cau on ja n'hi ha un (la filera System 32) es queda el més gros. */
  private addPlate(side: VerticalRef, plate: { holes: Hole[]; notes: string[]; origin: Vec3; v: Vec3 }, item: HardwareItem, zoneId?: string): void {
    const p = side.panel
    for (const message of plate.notes) if (!this.warnings.some((w) => w.code === "hinge" && w.message === message)) this.warnings.push({ code: "hinge", message, panelId: p.id, ...(zoneId ? { zoneId } : {}) })
    for (const next of plate.holes) {
      const same = p.holes.findIndex((e) => e.face === next.face && Math.abs(e.x - next.x) < 0.05 && Math.abs(e.y - next.y) < 0.05)
      if (same >= 0) {
        const e = p.holes[same]!
        if (e.diameter > next.diameter || (e.diameter === next.diameter && e.depth >= next.depth)) continue
        p.holes.splice(same, 1)
      }
      p.holes.push(next)
    }
    const pa = item.plate
    if (pa) {
      const { origin: o, v } = plate
      const l = toLocal(p, o)
      const face = faceAt(p, l)
      const lv = [v[0] * p.placement.xAxis[0] + v[1] * p.placement.xAxis[1] + v[2] * p.placement.xAxis[2], v[0] * p.placement.yAxis[0] + v[1] * p.placement.yAxis[1] + v[2] * p.placement.yAxis[2]] as [number, number]
      if (face === "A" || face === "B") (p.fittings ??= []).push({ ...(pa.asset ? { asset: pa.asset } : {}), x: l[0], y: l[1], face, v: lv, ...(pa.bbox ? { bbox: pa.bbox } : {}) })
    }
  }

  private buildDoors(zone: Zone, front: Extract<Front, { kind: "door" }>, ter: ZoneRect, rowYs: number[], left?: VerticalRef, right?: VerticalRef): void {
    const { m } = this
    this.doorZones += 1
    const suffix = this.doorZones === 1 ? "" : `-${this.doorZones}`
    const doorH = r(ter.y1 - ter.y0)
    if (doorH > 2200) this.warnings.push({ code: "door-too-tall", message: `Porta de ${num(doorH)} mm d'alçada (màxim recomanat 2.200).`, zoneId: zone.id })

    // La frontissa triada a la porta (si no, la del mòdul); la de vidre no en porta.
    const hingeHw = front.glass ? this.kit.hinge : this.frontHardware("hinge", front.hardware, zone.id)
    // El tirador triat a la porta (si no, el del mòdul).
    const handleHw = front.glass ? this.kit.handle : this.frontHandle(front.handle, zone.id)
    const hd = handleHw.spec
    const make = (id: string, name: string, label: string, x0: number, w: number, hinge: "left" | "right") => {
      if (w > 600) this.warnings.push({ code: "door-too-wide", message: `Porta de ${num(w)} mm d'amplada (màxim recomanat 600).`, zoneId: zone.id })
      if (front.glass) return this.glassDoor(id, label, x0, ter.y0, w, doorH)
      const door = this.frontPanel(id, name, label, "door", x0, ter.y0, w, doorH)
      this.addCups(door, doorH, hinge, w, rowYs, ter.y0, zone.id, hingeHw, hinge === "left" ? left : right)
      // Tirador al costat contrari de les frontisses, vertical i a mitja alçada. En una porta estreta cauria a la
      // columna de les cassoletes (on va el braç de la frontissa): no es fa.
      const cupBand = hingeHw.spec.cupOffset + hingeHw.spec.cupDiameter / 2 + hd.diameter / 2 + hd.margin
      if (m.fronts.handles !== "none" && w - hd.inset < cupBand)
        this.warnings.push({ code: "handle", message: `${door.label} de ${num(w)} mm d'amplada: el tirador cauria sobre les frontisses (calen ${num(cupBand + hd.inset)} mm). No es fan els forats: posa-hi un pom o un tirador de cantell.`, zoneId: zone.id, panelId: door.id })
      else this.handle(door, doorH / 2, hinge === "left" ? w - hd.inset : hd.inset, "x", handleHw, zone.id)
    }
    if (front.mode === "single") {
      make(`door${suffix}`, "porta", "Porta", ter.x0, r(ter.x1 - ter.x0), front.hinge)
    } else {
      const w = r((ter.x1 - ter.x0 - m.fronts.betweenGap) / 2)
      make(`door${suffix}-left`, "porta e", "Porta esquerra", ter.x0, w, "left")
      make(`door${suffix}-right`, "porta d", "Porta dreta", r(ter.x0 + w + m.fronts.betweenGap), w, "right")
    }
  }

  /**
   * Porta de vidre (vitrina): marc de perfil d'alumini negre de 20 mm i vidre de 5 al mig, al lloc de la porta. No és de
   * CNC: tot va a `extras` («Elements sense nesting», amb les mides per demanar-ho). Les frontisses són les del perfil
   * (no porta cassoletes al tauler); els laterals mantenen les fileres.
   */
  private glassDoor(id: string, label: string, x0: number, y0: number, w: number, h: number): void {
    const { d } = this
    const F = 20, G = 5, t = d.t
    const z = d.frontZ
    const bar = (sid: string, lbl: string, bx: number, by: number, len: number, wid: number) =>
      this.extras.push({
        id: `${id}-${sid}`,
        name: "perfil vitrina",
        label: `${label} de vidre (${lbl})`,
        role: "part",
        length: r(len),
        width: r(wid),
        thickness: t,
        material: "Alumini negre",
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(bx), r(by), z], Y, X, neg(Z), Z),
      })
    bar("left", "perfil esquerre", x0, y0, h, F)
    bar("right", "perfil dret", x0 + w - F, y0, h, F)
    bar("bottom", "perfil de baix", x0 + F, y0, F, w - 2 * F)
    bar("top", "perfil de dalt", x0 + F, y0 + h - F, F, w - 2 * F)
    this.extras.push({
      id: `${id}-glass`,
      name: "vidre vitrina",
      label: `${label} de vidre (vidre)`,
      role: "part",
      length: r(h - 2 * F + 10),
      width: r(w - 2 * F + 10),
      thickness: G,
      material: "Vidre",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      // El vidre entra 5 mm a la ranura del perfil per cada costat, centrat en el gruix.
      placement: placement([r(x0 + F - 5), r(y0 + F - 5), r(z - (t - G) / 2)], Y, X, neg(Z), Z),
    })
  }

  private buildFlap(zone: Zone, front: Extract<Front, { kind: "flap" }>, ter: ZoneRect): void {
    const flap = this.buildFrontPanel(zone, ter, "flap", "abatible", "Abatible")
    // El braç triat a l'abatible (si no, el del mòdul): dos forats a `offset` del cantell de gir (22,5).
    const arm = this.frontHardware("flap", front.hardware, zone.id)
    const f = arm.spec
    const along = flap.length // alçada
    const across = flap.width
    // Abatibles estrets: si els dos forats no hi caben a `endOffset` (100) dels costats, a un quart i a tres quarts (com a
    // mínim un Ø de matèria entre ells); més estret encara, no se'n fan i s'avisa.
    const fitsAlong = along >= f.offset + f.diameter / 2 + 1
    const ys = !fitsAlong ? [] : across >= 2 * f.endOffset + 2 * f.diameter ? [f.endOffset, r(across - f.endOffset)] : across >= 4 * f.diameter ? [r(across / 4), r((3 * across) / 4)] : []
    if (!ys.length) this.warnings.push({ code: "hinge", message: `Abatible de ${num(across)} × ${num(along)} mm: no hi caben els forats de les frontisses.`, zoneId: zone.id, panelId: flap.id })
    for (const y of ys) {
      // Ancoratge al cantell de gir (x local = alçada): avall, el de baix; amunt, el de dalt.
      flap.holes.push(...applyHardware(arm.item, "flap", {}, { at: { x: 0, y }, ...(front.dir === "down" ? {} : { mirrorX: along }) }).holes)
    }
    // Tirador al cantell que obre (el contrari del gir), horitzontal i centrat.
    const handleHw = this.frontHandle(front.handle, zone.id)
    const inset = handleHw.spec.inset
    this.handle(flap, front.dir === "down" ? along - inset : inset, across / 2, "y", handleHw, zone.id)
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
    // Trapa: obertura més 20 mm de solapament per costat (on van els imants), darrere del front.
    const lip = 20
    if (front.hatch) {
      // Trapa en coordenades de la zona → locals del front (x local = Y, y local = X).
      const hx = rect.x0 + front.hatch.x
      const hy = rect.y0 + front.hatch.y
      hatchLocal = { x: r(hy - ter.y0), y: r(hx - ter.x0), w: front.hatch.h, h: front.hatch.w }
      // Cap ranura dins del solapament de la trapa (hi van els imants) ni a menys d'un pas.
      const g = lip + front.pattern.slotGap
      exclude.push({ x: hatchLocal.x - g, y: hatchLocal.y - g, w: hatchLocal.w + 2 * g, h: hatchLocal.h + 2 * g })
    }
    // Imants (reixeta desmuntable): cap ranura a sobre ni a tocar dels forats dels imants.
    // Si no, amb un marge petit les ranures els travessen i la peça no es pot fer.
    if (front.mount !== "hinged") {
      const mg = this.hw.magnet
      const clear = mg.diameter / 2 + Math.max(6, front.pattern.slotGap / 2)
      for (const ref of [left, right]) {
        if (!ref) continue
        const xMid = (ref.xL + ref.xR) / 2
        for (const y of [rect.y0 + mg.cornerOffset, rect.y1 - mg.cornerOffset]) {
          const lx = y - ter.y0
          const ly = xMid - ter.x0
          exclude.push({ x: lx - clear, y: ly - clear, w: 2 * clear, h: 2 * clear })
        }
      }
    }
    const result = grilleCutouts(grille.length, grille.width, front.pattern, exclude)
    grille.cutouts = [...result.cutouts]
    this.openRatios[zone.id] = result.openRatio
    if (result.openRatio < MIN_OPEN_RATIO) {
      this.warnings.push({ code: "grille-open-ratio", message: `La reixeta només té un ${Math.round(result.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, zoneId: zone.id, panelId: grille.id })
    }
    // Una reixeta pot ser un cobreradiador (o només decorativa: no se sap): un avís per mòdul, i cap si ja és MDF lacat.
    if (!/lacat/i.test(grille.material) && !this.warnings.some((w) => w.code === "material-heat")) {
      this.warnings.push({ code: "material-heat", message: "Reixeta: si va davant d'un radiador, millor MDF lacat o cantells amb cola PUR (la cola EVA es desenganxa amb la calor).", zoneId: zone.id })
    }

    if (hatchLocal) {
      grille.cutouts.push({ kind: "rect", ...hatchLocal, tag: "hatch" })
      const hw = front.hatch!.w + 2 * lip
      const hh = front.hatch!.h + 2 * lip
      const hx0 = rect.x0 + front.hatch!.x - lip
      const hy0 = rect.y0 + front.hatch!.y - lip
      // Darrere del front: a la seva cara de dins (encastat, un gruix més endins).
      const hatch = this.add(
        this.basePanel(`hatch-${this.frontCount}`, "trapa", "Trapa", "hatch", hh, hw, d.t, frontMaterialOf(m), "x", edges("left", "right", "bottom", "top"), placement([hx0, hy0, d.frontZ - d.t], Y, X, neg(Z), Z)),
      )
      const mg = this.hw.magnet
      for (const [lx, ly] of [[lip / 2, lip / 2], [hh - lip / 2, lip / 2], [lip / 2, hw - lip / 2], [hh - lip / 2, hw - lip / 2]] as [number, number][]) {
        // Imant a la cara B de la trapa (la que toca el front) i contrapart a la cara A del front.
        hatch.holes.push({ x: r(lx), y: r(ly), diameter: mg.front.diameter, depth: mg.front.depth, face: "B", ...(mg.front.tag ? { tag: mg.front.tag } : {}) })
        const w: Vec3 = [hx0 + ly, hy0 + lx, d.frontZ - d.t]
        addFaceHole(grille, w, mg.front)
      }
    }

    if (front.mount === "hinged") {
      this.addCups(grille, grille.length, front.hinge, grille.width, rowYs, ter.y0, zone.id, this.kit.hinge, front.hinge === "left" ? left : right)
      return
    }
    // Desmuntable: imants als cantells frontals dels panells dels costats i contraparts al front.
    const mg = this.hw.magnet
    for (const [ref, side] of [[left, "left"], [right, "right"]] as [VerticalRef | undefined, "left" | "right"][]) {
      if (!ref) {
        this.warnings.push({ code: "no-side", message: `La reixeta no té panell a la ${side === "left" ? "esquerra" : "dreta"} on posar els imants.`, zoneId: zone.id })
        continue
      }
      const xMid = (ref.xL + ref.xR) / 2
      for (const y of [rect.y0 + mg.cornerOffset, rect.y1 - mg.cornerOffset]) {
        const w: Vec3 = [r(xMid), r(y), ref.zFront]
        addEdgeHole(ref.panel, w, mg.side)
        addFaceHole(grille, w, mg.front)
      }
    }
  }

  /** Alçades i Y de baix de cada front d'una pila de calaixos (l'últim «auto» es queda el que sobra; iguals a mig mm). */
  private drawerLayout(zone: Zone, front: Extract<Front, { kind: "drawers" }>, ter: ZoneRect): { heights: number[]; ys: number[] } {
    const n = front.n
    const bg = this.m.fronts.betweenGap
    const sizes = front.heights.slice(0, n)
    while (sizes.length < n) sizes.push("auto")
    // Com les zones: l'últim auto es queda el que sobra; sense cap «auto», l'últim s'ajusta (i s'avisa).
    const fit = fitSizes(ter.y1 - ter.y0, sizes, bg)
    const heights = snapAutoHeights(fit.sizes, sizes)
    if (fit.mismatch !== null)
      this.warnings.push({ code: "layout", message: mismatchMessage("Les alçades dels fronts dels calaixos", fit.mismatch, r(ter.y1 - ter.y0), heights.at(-1)!), zoneId: zone.id })
    if (heights.some((h) => h <= 0)) this.warnings.push({ code: "layout", message: `Els ${n} calaixos no hi caben: algun front no té alçada.`, zoneId: zone.id })
    const ys: number[] = []
    for (let i = 0, yy = ter.y0; i < n; i++) {
      ys.push(yy)
      yy = r(yy + heights[i]! + bg)
    }
    return { heights, ys }
  }

  /** El front d'un calaix (cara A cap a dins, x local = amplada) amb el tirador centrat i, si toca, els inglets. */
  private addDrawerFront(k: number, ter: ZoneRect, y: number, fh: number, handleHw: ReturnType<Builder["frontHandle"]>, zone: Zone): Panel {
    const { d } = this
    const c = this.m.carcass
    const fw = r(ter.x1 - ter.x0)
    // A inglet amb els laterals: el costat que arriba a fora del moble, tallat a 45°.
    const mL = d.mitreFronts && ter.x0 <= 0.01 && c.sides.left
    const mR = d.mitreFronts && ter.x1 >= d.W - 0.01 && c.sides.right
    // Primer i últim calaix: també a inglet amb la tapa i la base (y local cap avall: el
    // cantell de dalt és «bottom» i el de baix, «top»).
    const mT = d.mitreFronts && d.mitreTop && y + fh >= d.H - 0.01
    const mB = d.mitreFronts && d.mitreBottom && y <= d.baseY + 0.01
    const frontPanel = this.add({
      ...this.basePanel(`drawer-${k}-front`, "frontal calaix", `Front calaix ${k}`, "drawerFront", fw, fh, d.t, frontMaterialOf(this.m), "x", edges(...(mT ? [] : (["bottom"] as const)), ...(mB ? [] : (["top"] as const)), ...(mL ? [] : (["left"] as const)), ...(mR ? [] : (["right"] as const))), placement([ter.x0, y + fh, d.frontZ], X, neg(Y), neg(Z), Z)),
      ...(mL || mR || mT || mB ? { mitres: [...(mL ? (["left"] as const) : []), ...(mR ? (["right"] as const) : []), ...(mT ? (["bottom"] as const) : []), ...(mB ? (["top"] as const) : [])] } : {}),
    })
    // Tirador centrat (x local = amplada, y local = cap avall).
    this.handle(frontPanel, fw / 2, fh / 2, "x", handleHw, zone.id)
    return frontPanel
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
    // El tirador triat al calaix (si no, el del mòdul).
    const handleHw = this.frontHandle(front.handle, zone.id)
    // Un joc paramètric de calaix de doble paret (DTC MAGIC-PRO): cap lateral de fusta; el joc mana.
    if (front.hardware && isDrawerKit(front.hardware)) {
      this.buildKitDrawers(zone, front, front.hardware, rect, ter, left, right, handleHw)
      return
    }
    // La guia triada al calaix (si no, la del mòdul): llargades, jocs, caixa i forats.
    const hw = this.frontHardware("slide", front.hardware, zone.id).spec
    const n = front.n
    const { heights, ys } = this.drawerLayout(zone, front, ter)

    const boxW = r(rect.x1 - rect.x0 - 2 * hw.sideClearance)
    // Amb el front encastat, la caixa del calaix comença un gruix més endins.
    const maxLen = d.availDepth - hw.backClearance - (d.inset ? d.t : 0)
    const slide = [...hw.slideLengths].sort((a, b) => b - a).find((l) => l <= maxLen)
    if (slide === undefined) {
      this.warnings.push({ code: "drawer-no-slide", message: `Cap guia de calaix (${hw.slideLengths.join(", ")}) cap en ${r(maxLen)} mm de fondària útil.`, zoneId: zone.id })
    }
    const boxL = slide ?? r(maxLen)
    const bt = hw.boxThickness
    const tbb = hw.bottomThickness
    const g = c.grooveDepth
    const bottomMat = drawerBottomMaterial(c.backMaterial, c.backThickness, tbb)
    if (n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons dels calaixos de ${tbb} mm en «${bottomMat.name}» (${c.back === "none" ? `el mòdul no té fons: el material del cos, de ${c.thickness} mm` : `el fons del moble és de ${c.backThickness} mm`}): comprova que aquest material es ven en ${tbb} mm.`, zoneId: zone.id })

    // Caixa de cada calaix (relativa a la vora de baix del front): centrada al front (`boxDrop`) però sempre dins de la
    // llum (el front del primer i de l'últim calaix sobresurt per sobre de la tapa o la base i la caixa hi toparia). Els
    // fronts iguals fan servir la mateixa caixa (la més justa del grup): així tenen exactament els mateixos mecanitzats
    // i el taller, que casa les peces per mida, no en barreja dos de diferents.
    const box = heights.map((fh, i) => ({
      lo: Math.max(hw.boxDrop / 2, rect.y0 + 1 - ys[i]!),
      hi: Math.min(fh - hw.boxDrop / 2, rect.y1 - 1 - ys[i]!),
    }))
    // Iguals a mig mil·límetre (com els agrupa el taller i `sameSize`): l'últim «auto» pot fer 0,01 mm més.
    const groupOf = (fh: number) => String(Math.round(fh * 2) / 2)
    const shared = new Map<string, { lo: number; hi: number }>()
    heights.forEach((fh, i) => {
      const k = groupOf(fh)
      const cur = shared.get(k)
      shared.set(k, cur ? { lo: Math.max(cur.lo, box[i]!.lo), hi: Math.min(cur.hi, box[i]!.hi) } : { ...box[i]! })
    })
    // Alçada mínima de la caixa: el fons en ranura i una mica de lateral per sobre (si no, no es fa: només el front).
    const minBox = hw.bottomOffset + tbb + 30
    let lowBox: number | null = null
    let noDowel = false
    // Amplada mínima: el darrere entre laterals ha de poder rebre les espigues de tots dos costats (20 mm cadascuna).
    const minInner = 2 * 20 + 10
    const narrowBox = boxW - 2 * bt < minInner
    if (n > 0 && narrowBox)
      this.warnings.push({ code: "drawer-box", message: `Calaixos massa estrets: entre els laterals de la caixa només queden ${num(boxW - 2 * bt)} mm (en calen ${num(minInner)}). No es fa la caixa (només el front).`, zoneId: zone.id })

    for (let i = 0; i < n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const y = ys[i]!
      const frontPanel = this.addDrawerFront(k, ter, y, fh, handleHw, zone)
      const sb = shared.get(groupOf(fh))!
      const boxH = r(sb.hi - sb.lo)
      if (boxH < minBox) {
        lowBox = lowBox === null ? boxH : Math.min(lowBox, boxH)
        continue
      }
      if (narrowBox) continue
      const boxY0 = r(y + sb.lo)
      const boxX0 = r(rect.x0 + hw.sideClearance)
      const zFront = d.frontZ - d.t // cara posterior del front
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
      const backY0 = boxY0 + hw.bottomOffset + tbb
      const backH = r(boxH - hw.bottomOffset - tbb)
      const back = this.add(
        this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", boxW - 2 * bt, backH, bt, c.material, "x", edges("top"), placement([boxX0 + bt, backY0, zBack + bt], X, Y, neg(Z), neg(Z))),
      )
      // Fons: en ranura als laterals i al front.
      const bottomW = r(boxW - 2 * bt + 2 * g - 1)
      const bottomL = r(boxL + g - 1)
      this.add(
        this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottomW, bottomL, tbb, bottomMat.name, "none", { ...NO_EDGES }, placement([boxX0 + bt - g + 0.5, boxY0 + hw.bottomOffset, zFront + g - 0.5], X, neg(Z), Y, neg(Y))),
      )
      // Ranura al front per al fons (cara A = darrere del front).
      frontPanel.grooves.push({ x: r(boxX0 + bt - g - ter.x0), y: r(y + fh - (boxY0 + hw.bottomOffset + tbb)), w: r(boxW - 2 * bt + 2 * g), h: tbb, depth: g, face: "A", tag: "drawer-bottom" })
      // Espigues: laterals → front (topen), darrere → laterals (topa). Dues a 30 / 20 mm dels extrems si hi caben; si
      // la caixa és baixa, una al mig (`dowelsAlong`).
      const dowel = { diameter: hw.boxThickness >= 16 ? 8 : 6, faceDepth: 10, edgeDepth: 20 }
      const frontYs = dowelsAlong(boxY0, boxY0 + boxH, 30, dowel.diameter)
      const backYs = dowelsAlong(backY0, boxY0 + boxH, 20, dowel.diameter)
      for (const [xs, sidePanel] of [[boxX0 + bt / 2, sideL], [boxX0 + boxW - bt / 2, sideR]] as [number, Panel][]) {
        const a = dowelJoint(sidePanel, frontPanel, frontYs.map((yy): Vec3 => [r(xs), r(yy), zFront]), dowel)
        const b = dowelJoint(back, sidePanel, backYs.map((yy): Vec3 => [r(xs < boxX0 + bt ? boxX0 + bt : boxX0 + boxW - bt), r(yy), r(zBack + bt / 2)]), dowel)
        if (!a || !b) noDowel = true
      }
      // Forats de guia: al lateral del moble (Ø5 P12) i al lateral de la caixa (Ø4 P10).
      // Des de la cara de darrere del front (encastat: un gruix més endins que el recobrent).
      // Els números i els forats (Ø, fondària) són de la guia (la triada al calaix o la del mòdul).
      const zs = [zFront - hw.frontOffset, zFront - hw.frontOffset - hw.secondOffset].filter((z) => z > zBack)
      const ySlide = r(boxY0 + hw.holeHeight)
      const boxR = hw.box.diameter / 2
      for (const [ref, sidePanel, xBox] of [[left, sideL, boxX0], [right, sideR, boxX0 + boxW]] as [VerticalRef | undefined, Panel, number][]) {
        for (const z of zs) {
          if (ref) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, ySlide, r(z)], hw.side)
          // Si cau a l'alçada de la ranura del fons (per l'altra cara), no pot arribar-hi: es
          // limita la fondària perquè quedi 1 mm de matèria.
          const inGroove = ySlide - boxR < boxY0 + hw.bottomOffset + tbb && ySlide + boxR > boxY0 + hw.bottomOffset
          addFaceHole(sidePanel, [xBox, ySlide, r(z)], { ...hw.box, depth: inGroove ? Math.min(hw.box.depth, r(bt - g - 1)) : hw.box.depth })
        }
      }
    }
    if (lowBox !== null)
      this.warnings.push({
        code: "drawer-box",
        message: `Calaixos massa baixos: la caixa faria ${num(lowBox)} mm d'alçada i en calen almenys ${num(minBox)} (fons a ${num(hw.bottomOffset)} mm + ${num(tbb)} mm de fons + 30). No es fa la caixa (només el front): fes els fronts més alts o posa'n menys.`,
        zoneId: zone.id,
      })
    if (noDowel)
      this.warnings.push({ code: "drawer-box", message: "Caixa del calaix massa baixa per a les espigues: alguna unió queda sense espiga (cal cargolar-la).", zoneId: zone.id })
  }

  /**
   * Calaixos amb un **joc paramètric de doble paret** (`drawerKit`, `core/build/drawerKit.ts`): el front de sempre i, per
   * cada calaix, el pla del joc (`planKit`: la NL més gran que hi cap darrere del front, components amb el número
   * d'article, fons A i darrere B per fórmula, prebroques). **Cap lateral de fusta.** Peces: el fons (del material del
   * fons dels calaixos, gruix del joc) i el darrere (del tauler del cos); mecanitzats: prebroques Ø2 × 10 dels cargols de
   * la guia als dos laterals del moble (mirall), dels suports de davant al darrere del front i dels de darrere al darrere.
   * Els components van a `extras` com a peces de només veure (rol `hardware`, `drawer-<k>-kit-…`: el visor les mou amb el
   * calaix) i la comanda a `hardwareKits`. **Tot o res** per calaix: sense NL que hi càpiga, sense lateral del moble a un
   * costat o sense lloc en alçada, només el front i avís `hardware`. La vora inferior de la guia va a `baseAboveFront`
   * del cantell de baix del front (hipòtesi del catàleg) i, si cal, puja perquè el joc quedi dins de la llum.
   */
  private buildKitDrawers(
    zone: Zone,
    front: Extract<Front, { kind: "drawers" }>,
    item: HardwareItem,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
    handleHw: ReturnType<Builder["frontHandle"]>,
  ): void {
    const { m, d } = this
    const c = m.carcass
    const { heights, ys } = this.drawerLayout(zone, front, ter)
    const LW = r(rect.x1 - rect.x0)
    const zFront = d.frontZ - d.t // cara posterior del front
    // Fondària darrere del front fins al fons del moble (encastat: el front ja és dins de la llum).
    const depth = r(zFront - d.backInnerZ)
    const TB = kitBottomThickness(item)
    const res = planKit(item, { LW, depth, G: c.thickness, TB, options: front.kit })
    for (const w of res.warnings) this.hardwareWarning(w, zone.id)
    const plan = res.plan
    const bottomMat = c.thickness === TB ? { name: c.material, warn: false } : drawerBottomMaterial(c.backMaterial, c.backThickness, TB)
    if (plan && front.n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons dels calaixos de ${TB} mm en «${bottomMat.name}» (${c.back === "none" ? `el mòdul no té fons: el material del cos, de ${c.thickness} mm` : `el fons del moble és de ${c.backThickness} mm`}): comprova que aquest material es ven en ${TB} mm.`, zoneId: zone.id })
    if (plan && (!left || !right)) this.hardwareWarning(`«${item.name}»: el compartiment no té lateral a ${!left ? "l'esquerra" : "la dreta"} on cargolar la guia. Els calaixos es queden només amb el front.`, zone.id)
    const kit = plan?.kit
    const totalH = kit ? kitHeight(kit) : 0
    for (let i = 0; i < front.n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const y = ys[i]!
      const frontPanel = this.addDrawerFront(k, ter, y, fh, handleHw, zone)
      if (!plan || !kit || !left || !right) continue
      // Vora inferior de la guia: a `baseAboveFront` del cantell de baix del front, dins de la llum (1 mm de marge).
      const y0 = r(Math.max(y + kit.rules.baseAboveFront, rect.y0 + 1))
      if (y0 + totalH > rect.y1 - 1) {
        this.hardwareWarning(`«${item.name}» (${kit.heightClass.code}, ${num(totalH)} mm d'alçada) no cap al calaix ${k}: en queden ${num(rect.y1 - 1 - y0)} per sobre de la guia. Només es fa el front: posa menys calaixos o un joc més baix.`, zone.id)
        continue
      }
      const at = { x0: rect.x0, y0, zFront }
      const pilot = plan.pilot
      // Prebroques dels cargols de la guia als dos laterals del moble (el dret, mirall): z des del cantell de davant del
      // lateral (= la cara de darrere del front, amb els fronts recobrents).
      if (pilot) {
        const spec = { ...pilot, tag: "kit-slide" }
        for (const ref of [left, right])
          for (const h of plan.sidePilots) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, r(y0 + h.y), r(zFront - h.z)], spec)
        // Suports de davant: al darrere del front (cara A), a `x` de cada lateral.
        for (const h of plan.frontPilots) for (const x of [rect.x0 + h.x, rect.x1 - h.x]) addFaceHole(frontPanel, [r(x), r(y0 + h.y), zFront], { ...pilot, tag: "kit-front" })
      }
      // Fusta: fons A (sobre la guia del lateral) i darrere B (sobre el fons, al final).
      const bottom = plan.wood.find((w) => w.key === "bottom")
      const back = plan.wood.find((w) => w.key === "back")
      const zSlide = zFront - kit.rules.slideSetback
      if (bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - bottom.width) / 2)
        this.add(
          this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottom.width, bottom.depth, TB, bottomMat.name, "none", { ...NO_EDGES }, placement([bx0, y0 + kit.geometry.bottomBase, zSlide], X, neg(Z), Y, neg(Y))),
        )
      }
      if (back && back.height !== undefined && bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - back.width) / 2)
        const yB = r(y0 + kit.geometry.bottomBase + TB)
        const zB = r(zSlide - bottom.depth)
        // Cara A cap al darrere del moble (on van els suports): x local = amplada, y local amunt.
        const backPanel = this.add(this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", back.width, back.height, c.thickness, c.material, "x", edges("top"), placement([bx0, yB, zB + c.thickness], X, Y, neg(Z), neg(Z))))
        if (pilot) for (const h of plan.backPilots) for (const x of [bx0 + h.x, bx0 + back.width - h.x]) addFaceHole(backPanel, [r(x), r(yB + h.y), zB], { ...pilot, tag: "kit-back" })
      }
      this.extras.push(...kitSolidPanels(plan, k, at, LW))
      this.hardwareKits.push({ zoneId: zone.id, drawer: k, item: item.name, kit: `${kit.maker} ${kit.series} ${kit.heightClass.code}`, nl: plan.nl, options: plan.options, lines: plan.lines, wood: plan.wood, ...(plan.rule ? { rule: plan.rule } : {}), ...(plan.syncRod !== undefined ? { syncRod: plan.syncRod } : {}) })
    }
  }

  /**
   * Potes amb una pota importada triada (`Base.hardware` de la base «Potes»): una a cada cantonada, a `inset` de les vores
   * de fora del mòdul (on les dibuixa el 3D), amb els forats de la placa a la **cara de sota de la base** (u = X del
   * mòdul, v = cap al davant: totes girades igual). **Totes o cap**: si una placa no hi cap sencera (amb 3 mm de marge, sense
   * trepitjar cap forat) no se'n fa cap i avisa; sense confirmar (o malmesa), cap forat i avís `hardware`.
   */
  buildLegs(): void {
    const base = this.m.carcass.base
    if (base.kind !== "legs" || !base.hardware) return
    const item = base.hardware
    let spec: ReturnType<typeof legSpec>
    try {
      spec = legSpec(item)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      this.hardwareWarning(isDamagedImport(item) ? damagedImportMessage(item) : `Potes: ${why}. Les potes no fan cap forat.`)
      return
    }
    if (spec.pending) {
      this.hardwareWarning(`«${item.name}» és una pota importada i encara no està confirmada: la base no fa els forats de les potes. Revisa-la i confirma-la a Preferències › Ferratges.`)
      return
    }
    const { d } = this
    const legLen = item.imported?.bbox?.max[2]
    if (legLen !== undefined && Math.abs(legLen - base.height) > 1)
      this.hardwareWarning(`«${item.name}» fa ${num(legLen)} mm d'alçada i la base «Potes» en diu ${num(base.height)}: el moble quedarà a una altra alçada (posa-hi ${num(legLen)}).`)
    // La base: la peça de baix amb la cara a Y = 0 (la de fora, si les parets són buides).
    const bottom = this.panels.find((p) => p.role === "bottom" && faceAt(p, toLocal(p, [d.W / 2, d.baseY, d.D / 2])) !== null)
    if (!bottom) {
      this.hardwareWarning(`«${item.name}»: el mòdul no té base on cargolar les potes. No es fan els forats.`)
      return
    }
    const inset = spec.inset
    const legs: [number, number][] = [
      [inset, inset],
      [d.W - inset, inset],
      [inset, d.D - inset],
      [d.W - inset, d.D - inset],
    ]
    const T = bottom.thickness
    const margin = 3
    const holes: Hole[] = []
    let deep = false
    for (const [lx, lz] of legs)
      for (const h of spec.holes) {
        const l = toLocal(bottom, [r(lx + h.u), d.baseY, r(lz + h.v)])
        const face = faceAt(bottom, l)
        const R = h.d / 2
        const fits =
          face !== null &&
          l[0] - R >= margin &&
          l[0] + R <= bottom.length - margin &&
          l[1] - R >= margin &&
          l[1] + R <= bottom.width - margin &&
          bottom.holes.every((e) => e.face === "edge" || e.face !== face || Math.hypot(e.x - l[0], e.y - l[1]) >= e.diameter / 2 + R + 1)
        if (!fits || !face) {
          this.hardwareWarning(`«${item.name}»: la placa d'alguna pota no hi cap sencera a la base (a ${num(inset)} mm dels cantells, amb ${margin} mm de marge i sense trepitjar altres forats). No es fa cap forat de les potes: canvia «Als cantells» de la pota.`)
          return
        }
        const depth = Math.min(h.depth, T - 1)
        if (depth < h.depth) deep = true
        holes.push({ x: l[0], y: l[1], diameter: h.d, depth: r(depth), face, tag: h.tag })
      }
    bottom.holes.push(...holes)
    if (deep) this.hardwareWarning(`«${item.name}»: els forats de les potes són més fondos que la base: es fan a ${num(T - 1)} mm (1 mm de pell).`)
    const imp = item.imported
    if (imp && (imp.asset || imp.bbox)) {
      const z = bottom.placement
      const lv: [number, number] = [z.xAxis[2], z.yAxis[2]]
      for (const [lx, lz] of legs) {
        const l = toLocal(bottom, [lx, d.baseY, lz])
        const face = faceAt(bottom, l)
        if (face === "A" || face === "B") (bottom.fittings ??= []).push({ kind: "leg", ...(imp.asset ? { asset: imp.asset } : {}), x: l[0], y: l[1], face, v: lv, ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
    }
  }

  private cableHole(hole: CableHole): void {
    const { d } = this
    const target =
      hole.panel === "left" ? this.panels.find((p) => p.id === "side-left")
      : hole.panel === "right" ? this.panels.find((p) => p.id === "side-right")
      : this.panels.find((p) => p.role === hole.panel)
    const what = { back: "al fons", top: "a la tapa", bottom: "a la base", left: "al lateral esquerre", right: "al lateral dret" }[hole.panel]
    if (!target) {
      this.warnings.push({ code: "cable-hole", message: `El passacables ${what} no té peça on anar (el mòdul no en té).` })
      return
    }
    // Punt del pla de la peça per a (u, v) del passacables, en coordenades del mòdul. Els
    // retalls són passants: la posició en el gruix no importa.
    const at = (u: number, v: number): Vec3 =>
      hole.panel === "back" ? [u, v, r(target.placement.origin[2] + d.tb)]
      : hole.panel === "top" ? [u, d.H - d.t, v]
      : hole.panel === "bottom" ? [u, d.baseY + d.t, v]
      : hole.panel === "left" ? [0, v, u]
      : [d.W, v, u]
    const rect = hole.shape === "rect"
    const hw = (rect ? (hole.w ?? hole.diameter) : hole.diameter) / 2
    const hh = (rect ? (hole.h ?? hole.diameter) : hole.diameter) / 2
    const a = toLocal(target, at(hole.x - hw, hole.y - hh))
    const b = toLocal(target, at(hole.x + hw, hole.y + hh))
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0])
    const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1])
    // Fora de la peça (o tocant-ne la vora): no es fa, i s'avisa.
    if (x0 < 1 || y0 < 1 || x1 > target.length - 1 || y1 > target.width - 1) {
      this.warnings.push({ code: "cable-hole", message: `El passacables ${what} surt de la peça: no s'ha fet. Mou-lo o fes-lo més petit.`, panelId: target.id })
      return
    }
    ;(target.cutouts ??= []).push(
      rect
        ? { kind: "rect", x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0), tag: "cable" }
        : { kind: "circle", x: r((x0 + x1) / 2), y: r((y0 + y1) / 2), diameter: hole.diameter, tag: "cable" },
    )
  }
}

/** Construeix totes les peces d'un mòdul en coordenades del mòdul (base a Y = 0). */
export function buildModule(input: Module): ModuleBuild {
  // Res amagat compta: només el que es veu a l'inspector (els camps de les opcions apagades no hi entren).
  const b = new Builder(visibleModule(input))
  b.buildCarcass()
  const layout = b.buildZones()
  b.buildLegs()
  const panels = b.panels.map((p) => normalizePanel(p.cutouts && p.cutouts.length === 0 ? { ...p, cutouts: undefined } : p))
  return { panels, extras: b.extras, hardwareKits: b.hardwareKits, warnings: b.warnings, layout, openRatios: b.openRatios }
}

/** Material dels fronts (portes, calaixos, abatibles, reixetes, fixos): el propi o, si no n'hi ha, el del cos. */
export function frontMaterialOf(m: { carcass: { material: string; frontMaterial?: string } }): string {
  return m.carcass.frontMaterial?.trim() || m.carcass.material
}

/**
 * Material del fons dels calaixos (gruix `bottomThickness` dels ferratges). Les peces es
 * classifiquen per material + gruix (nesting, CSV): si el fons del moble té el mateix gruix,
 * el mateix material (comparteixen tauler); si el nom porta el gruix («DM 10»), el nom amb el
 * gruix del fons del calaix («DM 8»); si no, el mateix nom (un altre tauler del mateix
 * material) i s'avisa perquè es comprovi que existeix en aquest gruix.
 */
export function drawerBottomMaterial(backMaterial: string, backThickness: number, bottomThickness: number): { name: string; warn: boolean } {
  if (backThickness === bottomThickness) return { name: backMaterial, warn: false }
  const re = new RegExp(`(^|[^\\d.,])${String(backThickness).replace(".", "[.,]")}(\\s*mm)?(?![\\d.,]*\\d)`)
  if (re.test(backMaterial)) return { name: backMaterial.replace(re, (_, pre: string, unit?: string) => `${pre}${bottomThickness}${unit ?? ""}`), warn: false }
  return { name: backMaterial, warn: true }
}

/** Tots els fronts del mòdul són calaixos (n'hi ha almenys un). */
function onlyDrawers(root: Zone): boolean {
  let drawers = 0
  let other = 0
  const walk = (z: Zone) => {
    if (z.front) {
      if (z.front.kind === "drawers") drawers++
      else other++
    }
    z.split?.children.forEach(walk)
  }
  walk(root)
  return drawers > 0 && other === 0
}

/**
 * Forats d'un tirador de barra: dos forats passants Ø5 a la distància estàndard (128 o, si no
 * hi cap, 96 / 64) al voltant de (cx, cy), al llarg de l'eix local `along`. Van com a talls
 * passants (com els passacables): així els llegeix el taller i es fan al nesting.
 */
function addHandle(p: Panel, cx: number, cy: number, along: "x" | "y", item: HardwareItem, spec: SlotSpec<"handle">): boolean {
  const room = along === "x" ? p.length : p.width
  // La distància entre forats segons l'espai (128 o, si no hi cap, 96 / 64: la regla del tirador).
  const pitch = spec.pitch(room)
  const m = spec.margin
  const { cutouts } = applyHardware(item, "front", { pitch }, { at: { x: cx, y: cy }, axis: along, round: true })
  // Cada forat sencer dins de la peça amb `margin` (3 mm) de matèria al voltant i sense tocar cap altre forat de cara (les
  // cassoletes de les frontisses d'una porta estreta): si no, no es fa cap dels dos.
  const fits = cutouts.every((c) => {
    if (c.kind !== "circle") return false
    const R = c.diameter / 2
    const { x, y } = c
    return x - R >= m && x + R <= p.length - m && y - R >= m && y + R <= p.width - m && p.holes.every((h) => h.face === "edge" || Math.hypot(h.x - x, h.y - y) >= h.diameter / 2 + R + m)
  })
  if (!fits) return false
  ;(p.cutouts ??= []).push(...cutouts)
  return true
}

/**
 * Alçades «auto» dels fronts de calaix a mig mil·límetre cap avall (253,5 i no 253,33): fronts iguals surten amb la
 * mateixa mida al taller (no 253,34 i 253,33, dues peces diferents a la llista) i amb els mateixos mecanitzats. El que
 * sobra (menys de 0,5 mm per calaix) queda al joc de dalt de la pila: no es nota.
 */
export function snapAutoHeights(heights: number[], sizes: (number | "auto")[]): number[] {
  if (sizes.filter((x) => x === "auto").length < 2) return heights
  return heights.map((h, i) => (sizes[i] === "auto" ? Math.floor(h * 2 + 1e-6) / 2 : h))
}
