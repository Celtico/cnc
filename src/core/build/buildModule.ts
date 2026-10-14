import {
  mountOf,
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
  type FrontHandle,
  type HardwareItem,
  type HardwareKit,
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
  UI_PATHS,
  damagedImportMessage,
  isDamagedImport,
  isDrawerKit,
  isLegacyHardware,
  isPushClosing,
  kitOptionsOf,
  migrateModuleHardware,
  visibleModule,
  frontOptionsUse,
  hasInnerPieces,
  lightSystemOf,
  walkZones,
} from "../model"
import { normalizePanel } from "./buildCabinet"
import { applyHardware, legSpec, resolveKit, slotSpec, type ResolvedKit, type SlotSpec } from "./hardware"
import { kitBottomThickness, kitFamily, kitHeight, kitSolidPanels, planKit, type KitOrderLine, type KitPlan, type KitWoodSize } from "./drawerKit"
import { discOutline, planLights } from "./lightKit"
import type { LightOrder } from "./lightOrders"
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
  toWorld,
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
    | "light"
    | "hanging"
    | "hole-clash"
    | "island"
    | "hinge"
    | "drawer-bottom"
    | "invalid-part"
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
  /** Compartiments amb un joc de llum: les làmpades i el sistema elèctric (Peces › «Llums», LLEGEIX-ME; `lightOrders.ts`). */
  lightKits: LightOrder[]
  /** La comanda dels ferratges col·locats (frontisses, tiradors, pistons, potes): una línia per item (Peces › «Ferratges», LLEGEIX-ME). */
  fittingOrders: KitOrderLine[]
  /** La instal·lació dels llums del mòdul (alimentador, recorreguts dels cables, sortida a l'endoll) per al plànol de Peces. */
  wiring?: Wiring
  warnings: BuildWarning[]
  layout: Layout
  /** % d'àrea oberta de cada reixeta, per id de zona (o "top" per a la tapa). */
  openRatios: Record<string, number>
  /** Alçades reals dels fronts de cada pila de calaixos (mm, de baix a dalt), per id de zona: les de les «Auto» a l'inspector. */
  drawerHeights: Record<string, number[]>
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
  /**
   * Folgança de les peces de dins: la peça s'atura aquests mm abans a cada cap (`yB`/`yT` són els de la llum; la peça
   * va de `yB + endGap` a `yT − endGap`). Sense (laterals, mòdul sense dividir): 0.
   */
  endGap?: number
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
  /** Com `VerticalRef.endGap`: la peça va de `xL + endGap` a `xR − endGap`. */
  endGap?: number
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.51

/** El tirador resolt d'un front (`Builder.frontHandle`): push (cap forat) o els números del tirador, a demanda. */
interface HandleChoice {
  push: boolean
  kitPush: boolean
  readonly spec: SlotSpec<"handle">
  readonly item: HardwareItem
}

class Builder {
  readonly m: Module
  readonly d: Derived
  /** Obstacles pel darrere (columnes): els calaixos del seu tram, més curts. */
  rearLimits: RearLimit[] = []
  /** On comença l'interior pel darrere en el tram x0–x1 (el fons, o la columna amb el seu fons si hi és). */
  rearAt(x0: number, x1: number): number {
    let z = this.d.backInnerZ
    for (const l of this.rearLimits) if (Math.min(x1, l.x1) - Math.max(x0, l.x0) > 1) z = Math.max(z, l.z)
    return z
  }
  readonly panels: Panel[] = []
  readonly warnings: BuildWarning[] = []
  readonly openRatios: Record<string, number> = {}
  readonly drawerHeights: Record<string, number[]> = {}
  readonly extras: Panel[] = []
  readonly hardwareKits: KitOrder[] = []
  readonly lightKits: LightOrder[] = []
  readonly fittingOrders: KitOrderLine[] = []
  /** On és cada làmpada d'un joc de llum (el punt del forat del cable) i la peça que la porta: el recorregut del cable (`buildWiring`). */
  private readonly lampSpots: { x: number; y: number; z: number; host: Panel; x0: number; d: number; label: string }[] = []
  private switchSpot?: { x: number; y: number }
  wiring?: Wiring
  private readonly strutOrdered = new Set<string>()
  /** Afegeix `qty` unitats d'un ferratge a la comanda del mòdul (els iguals, per id i nota, se sumen). */
  order(item: HardwareItem, qty: number, note?: string): void {
    if (qty <= 0) return
    const hit = this.fittingOrders.find((l) => l.component === item.id && l.note === note && l.name === item.name)
    if (hit) hit.qty += qty
    else this.fittingOrders.push({ component: item.id, name: item.name, qty, ...(item.ref ? { item: item.ref } : {}), ...(note ? { note } : {}) })
  }
  /** L'interruptor dels llums del mòdul (un per mòdul, amb el primer compartiment amb llum). */
  private lightSwitch?: LightOrder["switch"]
  private lightMaker?: string
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

  /**
   * Ferratges del mòdul resolts (números i mecanitzats de cada lloc, `core/build/hardware.ts`), **a demanda**: un lloc
   * que cap peça fa servir no es llegeix ni avisa (res amagat compta: la frontissa d'un mòdul només de calaixos no hi pinta res).
   */
  readonly kit: ResolvedKit
  readonly hw: { [S in HardwareSlot]: SlotSpec<S> }

  constructor(m: Module) {
    this.m = m
    this.d = derive(m)
    // Mòduls d'abans que no han passat per l'esquema: els números d'abans, com a kit (els mateixos números).
    const kit = (isLegacyHardware(m.hardware) ? migrateModuleHardware(m.hardware) : m.hardware) as ModuleHardware
    this.kit = resolveKit(kit, (message) => this.hardwareWarning(message))
    const k = this.kit
    this.hw = {
      get hinge() { return k.hinge.spec },
      get system32() { return k.system32.spec },
      get dowel() { return k.dowel.spec },
      get slide() { return k.slide.spec },
      get flap() { return k.flap.spec },
      get magnet() { return k.magnet.spec },
      get handle() { return k.handle.spec },
      get rail() { return k.rail.spec },
      get led() { return k.led.spec },
      get glassFrame() { return k.glassFrame.spec },
    }
  }

  private hardwareWarning(message: string, zoneId?: string): void {
    if (!this.warnings.some((w) => w.code === "hardware" && w.message === message)) this.warnings.push({ code: "hardware", message, ...(zoneId ? { zoneId } : {}) })
  }

  /**
   * El ferratge d'un front o d'un accessori (el triat a la porta, el calaix, l'abatible, la reixeta, la barra o la llum;
   * si no, el del mòdul).
   */
  private frontHardware<S extends HardwareSlot>(slot: S, item: HardwareItem | undefined, zoneId?: string): { spec: SlotSpec<S>; item: HardwareItem } {
    // A demanda (com els llocs del mòdul): si ningú llegeix el lloc (l'imant d'una reixeta amb frontisses), no es valida.
    let cached: { spec: SlotSpec<S>; item: HardwareItem } | undefined
    const resolve = () => {
      if (cached) return cached
      if (!item) return (cached = this.kit[slot] as { spec: SlotSpec<S>; item: HardwareItem })
      const res = slotSpec(slot, item, (message) => this.hardwareWarning(message, zoneId))
      // No serveix: el del mòdul (no el d'inici de l'app). Un importat que no serveix queda inert (cap forat), mai el del mòdul.
      return (cached = res.failed && !item.imported ? (this.kit[slot] as { spec: SlotSpec<S>; item: HardwareItem }) : res)
    }
    return {
      get spec() { return resolve().spec },
      get item() { return resolve().item },
    }
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
    if (c.base.kind === "legs") this.buildLegPlinth()
    if (d.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${d.hollow} mm: cada paret són dues pells, llistons a dins i una tira al davant, encolats abans de muntar el moble.` })
    else if (c.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${c.hollow.thickness} mm: amb tauler de ${d.t} cal un gruix d'almenys ${2 * d.t + 6} mm. Es fan massisses.` })
    // Fronts encastats: van dins de la llum, a nivell amb el davant de la caixa.
    if (d.inset) {
      this.warnings.push({ code: "inset", message: "Fronts encastats: van dins de la llum amb el joc a tot el voltant; calen frontisses per a porta encastada." })
      // Només si algun prestatge es retira de debò (sense prestatges, o tots a ras en compartiments oberts, no compta).
      if (c.shelfSetback < d.t && frontOptionsUse(m).shelfSetback)
        this.warnings.push({ code: "inset", message: `Els prestatges van retirats ${c.shelfSetback} mm i el front encastat entra ${d.t} mm: retira'ls almenys ${d.t} mm (${UI_PATHS.box} › Retranqueig dels prestatges).` })
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
      // Ample = gruix del fons + el joc (`grooveClearance`): el cantell de darrere es queda a `backSetback`, el joc va cap
      // al davant.
      const gw = this.backGrooveWidth()
      grooves.push({
        x: r(gy0),
        y: isLeft ? r(c.backSetback) : r(sideDepth - c.backSetback - gw),
        w: r(gy1 - gy0),
        h: gw,
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
        d.mitreTop
          ? edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), ...this.rearEdge(isLeft ? "bottom" : "top"))
          : edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), "right", ...this.rearEdge(isLeft ? "bottom" : "top")),
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
      const gw = this.backGrooveWidth()
      grooves.push({ x: r(gy0 - yi0), y: isLeft ? r(c.backSetback) : r(skinDepth - c.backSetback - gw), w: r(gy1 - gy0), h: gw, depth: g, face: "A", tag: "back" })
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
      grooves.push({ x: 0, y: isBottom ? r(skinDepth - c.backSetback - this.backGrooveWidth()) : r(c.backSetback), w: r(len), h: this.backGrooveWidth(), depth: c.grooveDepth, face: "A", tag: "back" })
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
      const gw = this.backGrooveWidth()
      grooves.push({
        x: r(gx0 - px0),
        y: isBottom ? r(d.sideDepth + ext - c.backSetback - gw) : r(c.backSetback + ov),
        w: r(gx1 - gx0),
        h: gw,
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
        onTop ? edges("top", "bottom", "left", "right") : edges(...(ext ? [] : [isBottom ? ("bottom" as const) : ("top" as const)]), ...this.rearEdge(isBottom ? "top" : "bottom")),
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

  /** Ample de la ranura del fons: el gruix del fons + el joc de Folgances (`Carcass.grooveClearance`; sense, 0). */
  private backGrooveWidth(): number {
    return this.d.tb + (this.m.carcass.grooveClearance ?? 0)
  }

  /** Y de dalt de la ranura del fons: dins de la tapa (g), si la tapa porta ranura. */
  private backGrooveTop(): number {
    const { m, d } = this
    const c = m.carcass
    // Tapa amb ranura d'aire: no porta ranura del fons i el fons s'atura a sota (no hi entra).
    if (!d.hasTop || c.top.kind === "ventSlot") return d.interior.y1
    return d.interior.y1 + c.grooveDepth
  }

  /** Sòcol davant de les potes (base «Potes» amb `plinth`): de terra fins a 5 mm sota la base, de tota l'amplada. */
  private buildLegPlinth(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "legs" || !c.base.plinth) return
    const H = c.base.height
    const h = r(H - 5)
    if (h <= 0) return
    const z0 = d.D - c.base.plinth.setback - d.t
    this.add(this.basePanel("plinth", "socol", "Sòcol", "plinth", d.W, h, d.t, c.material, "x", edges("top", "bottom"), placement([0, -H, z0], X, Y, Z, Z)))
    // El peu de les potes del davant (Ø78 de l'AXILO; les genèriques, Ø48) ha de quedar darrere del sòcol.
    const hw = c.base.hardware
    const front = hw?.engine === "leg" ? (hw.params.insetFront ?? hw.params.inset ?? 50) : 50
    const foot = hw?.engine === "leg" ? (hw.params.foot ?? 48) / 2 : 24
    if (d.D - front + foot > z0 + 0.5)
      this.warnings.push({ code: "hardware", message: `El sòcol (a ${num(c.base.plinth.setback)} mm del davant) toca el peu de les potes del davant (a ${num(front)} mm, Ø${num(foot * 2)}): retira'l fins a ${num(Math.max(0, front - foot - d.t))} mm com a molt o posa les potes més enrere.` })
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

    // 1) Divisors i prestatges fixos de totes les divisions, amb la folgança de les peces de dins: més curts, centrats.
    layout.dividers.forEach((div, i) => {
      const cut = this.insetCut(div.parentId)
      const gap = this.innerGap()
      if (div.dir === "v") this.buildDivider(div.at, div.from, div.to, `divider-${i + 1}`, cut, gap)
      else this.buildFixedShelf(div.at, div.from, div.to, `fixed-${i + 1}`, cut, gap)
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

  /**
   * Folgança de les peces de dins (`Carcass.innerClearance`, sense = 0) dels divisors i prestatges fixos: amb l'arrel
   * dividida, tots (de qualsevol nivell, també els de l'arrel; `hasInnerPieces`); sense dividir, cap (els prestatges
   * fixos van sencers entre la caixa).
   */
  /**
   * Cantell del darrere d'una peça de la caixa (laterals, base, tapa, divisors i prestatges): només amb el mòdul lliure
   * al terra separat de la paret, que el deixa a la vista (per decisió de l'usuari, 2026-10-13: arrambat o penjat a la
   * paret, el darrere no es veu; 2026-10-14: «el laminat del darrere només si no és moble de paret», també amb fons). Amb
   * el fons cargolat, no: el fons tapa els cantells de darrere (es cantegen els seus). `side` = el cantell local del
   * darrere de la peça.
   */
  private rearEdge(side: EdgeSide): EdgeSide[] {
    const m = this.m
    return m.carcass.back !== "screwed" && mountOf(m) === "floor" && (m.wallGap ?? 0) > 0 ? [side] : []
  }

  /** El mateix per a les peces de dins (divisors i prestatges): amb fons, queden darrere del fons i no es veuen. */
  private innerRearEdge(side: EdgeSide): EdgeSide[] {
    return this.m.carcass.back === "none" ? this.rearEdge(side) : []
  }

  private innerGap(): number {
    const g = this.m.carcass.innerClearance ?? 0
    return g > 0 && hasInnerPieces(this.m.root) ? g : 0
  }

  private buildDivider(x: number, yFrom: number, yTo: number, id: string, cut = 0, gap = 0): void {
    const { m, d } = this
    const t = d.t
    const e = gap / 2
    const panel = this.add(
      this.basePanel(id, "divisor", "Divisor", "divider", yTo - yFrom - gap, d.availDepth - cut, t, m.carcass.material, "x", edges("top", ...this.innerRearEdge("bottom")), placement([x, yFrom + e, d.backInnerZ], Y, Z, X, Z)),
    )
    this.verticals.push({ panel, xL: x, xR: x + t, yB: yFrom, yT: yTo, zRear: d.backInnerZ, zFront: d.D - cut, outer: false, ...(e ? { endGap: e } : {}) })
  }

  private buildFixedShelf(y: number, xFrom: number, xTo: number, id: string, cut = 0, gap = 0): void {
    const { m, d } = this
    const t = d.t
    const e = gap / 2
    const zFront = d.D - cut
    const panel = this.add(
      this.basePanel(id, "estanter fixe", "Prestatge fix", "fixedShelf", xTo - xFrom - gap, d.availDepth - cut, t, m.carcass.material, "x", edges("bottom", ...this.innerRearEdge("top")), placement([xFrom + e, y, zFront], X, neg(Z), Y, Z)),
    )
    this.horizontals.push({ panel, yBottom: y, yTop: y + t, xL: xFrom, xR: xTo, outer: false, zRear: d.backInnerZ, zFront, ...(e ? { endGap: e } : {}) })
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
    for (const [h, y, dir] of [[below, v.yB, 1], [above, v.yT, -1]] as const) {
      if (!h) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      // Folgança de les peces de dins: el cantell del divisor s'atura abans de la cara (el forat de cara no es mou).
      dowelJoint(v.panel, h.panel, zs.map((z): Vec3 => [xMid, y, z]), this.hw.dowel, this.hw.dowel.tag, v.endGap ? [0, dir * v.endGap, 0] : undefined)
    }
  }

  private joinFixedShelf(h: HorizontalRef): void {
    const yMid = (h.yBottom + h.yTop) / 2
    const rect: ZoneRect = { x0: h.xL, x1: h.xR, y0: h.yBottom, y1: h.yTop }
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    for (const [v, x, dir] of [[left, h.xL, 1], [right, h.xR, -1]] as const) {
      if (!v) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      dowelJoint(h.panel, v.panel, zs.map((z): Vec3 => [x, yMid, z]), this.hw.dowel, this.hw.dowel.tag, h.endGap ? [dir * h.endGap, 0, 0] : undefined)
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
    // Una porta de vidre no porta filera (per decisió de l'usuari, 2026-10-14: «res de sistemes, només els forats dels
    // ferratges»): la placa de la frontissa fa els seus forats sola.
    const woodDoor = front?.kind === "door" && !front.glass
    const hingeSide = woodDoor ? front.hinge : front?.kind === "grille" && front.mount === "hinged" ? front.hinge : null

    // Fileres: per prestatges regulables (als dos costats) i per frontisses (al seu costat).
    let ysLeft: number[] = []
    let ysRight: number[] = []
    const wantsLeft = (zone.shelves?.adjustable ?? false) || hingeSide === "left" || (woodDoor && front.mode === "double")
    const wantsRight = (zone.shelves?.adjustable ?? false) || hingeSide === "right" || (woodDoor && front.mode === "double")
    if (wantsLeft) {
      if (left) ysLeft = this.rows(left, rect, "left")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a l'esquerra per a la filera System 32.`, zoneId: zone.id })
    }
    if (wantsRight) {
      if (right) ysRight = this.rows(right, rect, "right")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a la dreta per a la filera System 32.`, zoneId: zone.id })
    }
    // Només qui llegeix la filera (portes, reixetes, prestatges regulables) la necessita: als calaixos i als compartiments
    // oberts no es toca el System 32 (res amagat compta: un item dolent al lloc no avisa si no es fa servir).
    const needsRows = (zone.shelves?.adjustable ?? false) || woodDoor || (front?.kind === "grille" && front.mount === "hinged")
    const rowYs = ysLeft.length ? ysLeft : ysRight.length ? ysRight : needsRows ? system32Ys(rect.y0, rect.y1, this.hw.system32.edgeOffset, this.hw.system32.pitch) : []

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
    const front = zone.front!
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    // Com a les fulles: filera System 32 al costat de les frontisses (hi va la placa), però
    // només als trams lliures entre els prestatges fixos que hi toquen (els mateixos trams que
    // les fulles: els forats coincideixen i no en trepitgen cap altre).
    // Les portes de vidre, sense filera (només els forats de la placa, `glassHinges`).
    const woodDoor = front.kind === "door" && !front.glass
    const hingeSide = woodDoor ? front.hinge : front.kind === "grille" && front.mount === "hinged" ? front.hinge : null
    const double = woodDoor && front.mode === "double"
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
    const needsRows = woodDoor || (front.kind === "grille" && front.mount === "hinged")
    this.buildFront(zone, front, rect, left, right, ys.length ? ys : needsRows ? system32Ys(rect.y0, rect.y1, this.hw.system32.edgeOffset, this.hw.system32.pitch) : [])
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
        this.buildFlap(zone, front, territory, left, right)
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
    // Els números són de l'item (la barra triada al compartiment o la del mòdul; d'inici Ø25 a 50 del sostre).
    const spec = this.frontHardware("rail", zone.rail?.hardware, zone.id).spec
    const R = spec.diameter
    const len = r(rect.x1 - rect.x0 - 2)
    const cy = rect.y1 - spec.drop
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
    // Els números són de l'item (el perfil triat al compartiment o el del mòdul; d'inici 16 × 8 a 20 del davant).
    const led = this.frontHardware("led", zone.led?.hardware, zone.id)
    const spec = led.spec
    if (spec.light) {
      this.buildLights(zone, rect, shelfYs, led.item, spec)
      return
    }
    const W = spec.width, H = spec.height
    const len = r(rect.x1 - rect.x0 - 20)
    if (len < 50) return
    const zFront = d.D - m.carcass.shelfSetback - spec.setback
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

  /**
   * La **llum a sota del moble** (`Carcass.underLight`): un joc de llum a la cara de sota de la base (el mateix camí que
   * dins, `buildLights` amb `under`: el forat o el rebaix de la làmpada i el passant del cable a la base) o el perfil LED
   * de l'app, enganxat a sota de la base, a la seva distància del davant. Il·lumina el taulell.
   */
  buildUnderLight(): void {
    const { m, d } = this
    const ul = m.carcass.underLight
    if (!ul) return
    const base = this.panels.find((p) => p.role === "bottom")
    if (!base) {
      this.warnings.push({ code: "light", message: "Llum a sota: el mòdul no té base on posar-la. No es fa." })
      return
    }
    const cs = [0, base.length].flatMap((u) => [0, base.width].flatMap((v) => [0, base.thickness].map((w) => toWorld(base, [u, v, w]))))
    const box = { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))), max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) } as { min: Vec3; max: Vec3 }
    const led = this.frontHardware("led", ul.hardware)
    const rect = { x0: box.min[0], x1: box.max[0], y0: box.min[1], y1: box.min[1] } as ZoneRect
    if (led.spec.light) return this.buildLights({ id: "under" }, rect, [], led.item, led.spec, { y: box.min[1] })
    const W = led.spec.width, H = led.spec.height
    const len = r(box.max[0] - box.min[0] - 20)
    if (len < 50) return
    this.extras.push({ id: "led-under", name: "tira LED", label: "Tira LED a sota", role: "part", length: len, width: W, thickness: H, material: "Tira LED", grain: "none", edges: { ...NO_EDGES }, holes: [], grooves: [], placement: placement([r(box.min[0] + 10), r(box.min[1] - H), r(d.D - led.spec.setback)], X, neg(Z), Y, Z) })
  }

  /**
   * **Joc de llum** (`HardwareItem.light`, `lightKit.ts`): a la peça de sobre del compartiment (la tapa, el travesser o
   * el prestatge) i a la cara de sota de cada prestatge, les làmpades del catàleg amb el seu **mecanitzat per encastar**
   * (forat rodó, rebaix quadrat o ranura de la barra, tag `light`) i el **forat passant del cable** (tag `cable`); si la
   * peça és massa prima o no hi cap, la caixa o la versió de sobreposar (només el forat del cable) i avís `light`. El
   * cos de la làmpada es veu (material «Tira LED», fa llum al render) a `extras`. L'**interruptor**, un per mòdul: el
   * sensor de porta amb un forat Ø12 al cantell de davant del lateral esquerre si el mòdul té portes recobrents (o
   * abatibles), si no el de proximitat per cargolar. La comanda (làmpades, alimentador, distribuïdor, interruptor i
   * cables) va a `lightKits` (`lightOrders.ts`).
   */
  private buildLights(zone: Pick<Zone, "id">, rect: ZoneRect, shelfYs: number[], item: HardwareItem, spec: SlotSpec<"led">, under?: { y: number }): void {
    const { m, d } = this
    const k = spec.light!
    this.lightMaker ??= k.maker
    // A sota del moble (`under`): la cara de sota de la base, des del davant del mòdul.
    const front = under ? d.D : d.D - m.carcass.shelfSetback
    const len = rect.x1 - rect.x0
    const hosts: Panel["role"][] = under ? ["bottom"] : ["top", "fixedShelf", "shelf"]
    const lines: KitOrderLine[] = []
    let lamps = 0, watts = 0, peak = 0
    const warn = (message: string) => {
      if (!this.warnings.some((w) => w.code === "light" && w.message === message && w.zoneId === zone.id)) this.warnings.push({ code: "light", message, zoneId: zone.id })
    }
    for (const [i, y] of (under ? [under.y] : [rect.y1, ...shelfYs]).entries()) {
      const probe: Vec3 = [(rect.x0 + rect.x1) / 2, y, front - 30]
      const host = this.panels.find((p) => hosts.includes(p.role) && faceAt(p, toLocal(p, probe)) !== null)
      const depth = host ? Math.min(host.width, front - (d.D - host.width)) : front
      const plan = planLights(k, spec, { length: len, depth: host ? Math.min(host.width, depth) : depth }, host?.thickness ?? 0)
      for (const w of plan.warnings) warn(w)
      if (!host && plan.xs.length) warn(under ? `${k.series}: el mòdul no té base on posar la llum a sota: no es fa.` : `${k.series}: el compartiment no té res a sobre on posar la llum (sense tapa): no es fa.`)
      if (!host || !plan.xs.length) continue
      const zc = front - plan.z
      const n = plan.xs.length
      lamps += n
      watts += plan.watts
      peak += plan.peakWatts
      lines.push(...plan.lines)
      const yTop = plan.recessed ? y + plan.depth : y
      const bodyH = plan.recessed ? k.body.height : (k.surface?.height ?? k.body.height)
      for (const [j, dx] of plan.xs.entries()) {
        const x = rect.x0 + dx
        if (plan.bar) {
          // Ranura de la barra al llarg del compartiment; el cable surt per l'extrem esquerre.
          const x0 = x - plan.bar.cut / 2, x1 = x + plan.bar.cut / 2
          if (plan.recessed) this.pocket(host, [x0, y, zc - k.recess.size / 2], [x1, y, zc + k.recess.size / 2], plan.depth, "light")
          this.throughHole(host, [x0 + 20, y, zc], k.cableHole, "cable")
          this.lampSpots.push({ x: x0 + 20, y, z: zc, host, x0: rect.x0, d: k.cableHole, label: `Llum ${k.series}` })
          this.extras.push({
            id: `light-${zone.id}-${i}-${j}`,
            name: "barra LED",
            label: `Llum ${k.series}`,
            role: "part",
            length: plan.bar.cut,
            width: k.body.size,
            thickness: bodyH,
            material: "Tira LED",
            grain: "none",
            edges: { ...NO_EDGES },
            holes: [],
            grooves: [],
            placement: placement([r(x0), r(yTop - bodyH), r(zc + k.body.size / 2)], X, neg(Z), Y, Z),
          })
          continue
        }
        if (plan.recessed) {
          if (k.recess.shape === "round") {
            if (!addFaceHole(host, [x, y, zc], { diameter: k.recess.size, depth: plan.depth, tag: "light" })) warn(`${k.series}: el forat de la làmpada cau fora de «${host.label}».`)
          } else this.pocket(host, [x - k.recess.size / 2, y, zc - k.recess.size / 2], [x + k.recess.size / 2, y, zc + k.recess.size / 2], plan.depth, "light")
        }
        this.throughHole(host, [x, y, zc], k.cableHole, "cable")
        this.lampSpots.push({ x, y, z: zc, host, x0: rect.x0, d: k.cableHole, label: `Llum ${k.series}` })
        const sz = k.body.size
        this.extras.push({
          id: `light-${zone.id}-${i}-${j}`,
          name: "llum LED",
          label: `Llum ${k.series}`,
          role: "part",
          length: sz,
          width: sz,
          thickness: bodyH,
          material: "Tira LED",
          grain: "none",
          edges: { ...NO_EDGES },
          holes: [],
          grooves: [],
          ...(k.recess.shape === "square" ? {} : { outline: discOutline(sz) }),
          placement: placement([r(x - sz / 2), r(yTop - bodyH), r(zc + sz / 2)], X, neg(Z), Y, Z),
        })
      }
    }
    if (!lamps) return
    if (!this.lightSwitch) this.lightSwitch = this.lightSwitchFor(rect)
    this.lightKits.push({ zoneId: zone.id, item: item.name, kit: `${k.maker} ${k.series}`, maker: k.maker, lamps, watts: r(watts), peakWatts: r(peak), switch: this.lightSwitch, lines })
  }

  /** L'interruptor del mòdul: sensor de porta al cantell de davant del lateral esquerre si hi ha portes recobrents; si no, de proximitat. */
  private lightSwitchFor(rect: ZoneRect): LightOrder["switch"] {
    const { m, d } = this
    let doors = false
    walkZones(m.root, (z) => {
      if (z.front?.kind === "door" || z.front?.kind === "flap") doors = true
    })
    const side = this.panels.find((p) => p.id === "side-left")
    const sys = lightSystemOf(this.lightMaker ?? "")
    if (doors && !d.inset && side && sys && addEdgeHole(side, [d.t / 2, (rect.y0 + rect.y1) / 2, d.D], { diameter: sys.doorSwitch.bore, depth: sys.doorSwitch.depth, tag: "light-switch" })) {
      this.switchSpot = { x: d.t / 2, y: (rect.y0 + rect.y1) / 2 }
      return "door"
    }
    return sys ? "touch" : "none"
  }

  /** Rebaix rectangular (caixera) a la cara d'una peça, entre dos punts del moble sobre aquella cara. */
  private pocket(host: Panel, a: Vec3, b: Vec3, depth: number, tag: string): void {
    const la = toLocal(host, a), lb = toLocal(host, b)
    const face = faceAt(host, la)
    if (!face || face === "edge") return
    const x0 = Math.min(la[0], lb[0]), x1 = Math.max(la[0], lb[0])
    const y0 = Math.min(la[1], lb[1]), y1 = Math.max(la[1], lb[1])
    if (x0 < 0 || y0 < 0 || x1 > host.length || y1 > host.width) return
    host.grooves.push({ x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0), depth: r(depth), face, tag })
  }

  /** Forat passant rodó en un punt del moble sobre una cara de la peça. */
  private throughHole(host: Panel, w: Vec3, diameter: number, tag: string): void {
    const l = toLocal(host, w)
    if (l[0] < diameter / 2 || l[1] < diameter / 2 || l[0] > host.length - diameter / 2 || l[1] > host.width - diameter / 2) return
    ;(host.cutouts ??= []).push({ kind: "circle", x: r(l[0]), y: r(l[1]), diameter, tag })
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
    // Prestatges fixos (sense «Regulables») d'un mòdul dividit: també la folgança de les peces de dins.
    const inner = zone.shelves!.adjustable ? 0 : this.innerGap()
    const length = width - c.shelfClearance - inner
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
    const x0 = rect.x0 + (c.shelfClearance + inner) / 2
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
        this.add(this.basePanel(`shelf-${idx}`, code, nm, "shelf", length, depth, t, c.material, "x", edges("bottom", ...this.innerRearEdge("top")), placement([x0, y, zF], X, neg(Z), Y, Z)))
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
  /**
   * El tirador d'un front, **una sola font**: «Cap (push)» si el front ho diu (`handle: "none"`), si el front no en diu
   * res i el mòdul és push (`fronts.handles: "none"`, el per defecte) o si el joc del calaix obre per pressió (`kitPush`);
   * si no, el triat al front o el del mòdul.
   * A demanda: amb push ningú llegeix el lloc «tirador» i no es valida (res amagat compta).
   */
  private frontHandle(item: FrontHandle | undefined, zoneId?: string, kitPush = false): HandleChoice {
    const push = item === "none" || (item === undefined && this.m.fronts.handles === "none") || kitPush
    let cached: { spec: SlotSpec<"handle">; item: HardwareItem } | undefined
    const resolve = () => {
      if (cached) return cached
      if (!item || item === "none") return (cached = this.kit.handle)
      const res = slotSpec("handle", item, (message) => this.hardwareWarning(message, zoneId))
      return (cached = res.failed && !item.imported ? this.kit.handle : res)
    }
    return {
      push,
      /** El push el posa el joc del calaix: cap altre ferratge a demanar. */
      kitPush,
      get spec() { return resolve().spec },
      get item() { return resolve().item },
    }
  }

  /**
   * Tirador del front; amb push (`HandleChoice.push`), cap forat i un avís (una vegada) del ferratge push (llevat que el
   * posi el joc del calaix). Un tirador importat **sense confirmar** (o que no serveix) no fa cap forat: avís `hardware`
   * (el taller no rep res que no s'hagi revisat). Un d'importat i confirmat posa el seu model al 3D (`Panel.fittings`, a
   * la cara de fora).
   */
  private handle(p: Panel, cx: number, cy: number, along: "x" | "y", hs: HandleChoice, zoneId?: string): void {
    if (!hs.push) {
      const { spec, item } = hs
      if (spec.pending) {
        this.hardwareWarning(spec.unusable ?? `«${item.name}» és un tirador importat i encara no està confirmat: els fronts que el porten no fan els forats del tirador. Revisa'l i confirma'l a Preferències › Ferratges.`, zoneId)
        return
      }
      if (!addHandle(p, cx, cy, along, item, spec)) {
        this.warnings.push({ code: "handle", message: `${p.label} de ${num(p.width)} × ${num(p.length)} mm: massa petit per als forats del tirador (o toparien amb les cassoletes). No es fan: posa-hi un pom o un tirador de cantell.`, panelId: p.id })
        return
      }
      this.order(item, 1)
      const imp = item.imported
      if (imp && (imp.asset || imp.bbox)) {
        // Cara de fora del front (la que mira cap al davant del moble) i el marc del tirador: u al llarg dels forats.
        const face = p.placement.zAxis[2] > 0 ? "A" : "B"
        const v: [number, number] = along === "x" ? [0, face === "A" ? 1 : -1] : [face === "A" ? -1 : 1, 0]
        ;(p.fittings ??= []).push({ kind: "handle", ...(imp.asset ? { asset: imp.asset } : {}), x: r(cx), y: r(cy), face, v, ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
      return
    }
    // La guia del joc ja porta el push (push-open): el front no necessita cap Tip-On (ni post-procés ni 3D ni avís).
    if (hs.kitPush) return
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
    this.order(hinge.item, placed.length)
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
    // (Els llocs es llegeixen a demanda: la porta de vidre no toca ni la frontissa ni el tirador.)
    // (Una de vidre també: la frontissa de perfil en fa la placa al lateral; el tirador s'hi clava, cap forat.)
    const hingeHw = this.frontHardware("hinge", front.hardware, zone.id)
    // El tirador triat a la porta (si no, el del mòdul).
    const handleHw = this.frontHandle(front.handle, zone.id)
    const make = (id: string, name: string, label: string, x0: number, w: number, hinge: "left" | "right") => {
      if (w > 600) this.warnings.push({ code: "door-too-wide", message: `Porta de ${num(w)} mm d'amplada (màxim recomanat 600).`, zoneId: zone.id })
      if (front.glass) return this.glassDoor(id, label, x0, ter.y0, w, doorH, this.frontHardware("glassFrame", front.frame, zone.id), { hinge: hingeHw, side: hinge, panel: hinge === "left" ? left : right, rowYs, zoneId: zone.id }, handleHw.push ? undefined : handleHw.item)
      const door = this.frontPanel(id, name, label, "door", x0, ter.y0, w, doorH)
      this.addCups(door, doorH, hinge, w, rowYs, ter.y0, zone.id, hingeHw, hinge === "left" ? left : right)
      // Sense tirador (push): cap forat ni cap lectura del lloc «tirador».
      if (handleHw.push) return this.handle(door, doorH / 2, 0, "x", handleHw, zone.id)
      // Tirador al costat contrari de les frontisses, vertical i a mitja alçada. En una porta estreta cauria a la
      // columna de les cassoletes (on va el braç de la frontissa): no es fa.
      const hd = handleHw.spec
      const cupBand = hingeHw.spec.cupOffset + hingeHw.spec.cupDiameter / 2 + hd.diameter / 2 + hd.margin
      if (w - hd.inset < cupBand)
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
   * Porta de vidre (vitrina): marc de perfil d'alumini (el material del marc: negre a l'app, plata als Häfele) i vidre al mig, al lloc de la porta. No és de
   * CNC: tot va a `extras` («Elements sense nesting», amb les mides per demanar-ho). Les frontisses són les del perfil
   * (no porta cassoletes al tauler); els laterals mantenen les fileres.
   */
  private glassDoor(id: string, label: string, x0: number, y0: number, w: number, h: number, frameHw: { spec: SlotSpec<"glassFrame">; item: HardwareItem }, hinge?: GlassHinge, handle?: HardwareItem): void {
    const { d } = this
    const frame = frameHw.spec
    // Les plaques de les frontisses de perfil (la frontissa triada), només a les portes; es dibuixen (frontissa i placa).
    const hingeYs = hinge ? this.glassHinges(label, y0, h, hinge) : []
    if (hinge) this.order(hinge.hinge.item, hingeYs.length, "per a perfil d'alumini")
    // El tirador (es clava al perfil del costat que obre, a mitja alçada): es veu.
    if (handle && hinge) this.glassPull(`${id}-pull`, label, hinge.side === "left" ? x0 + w - frame.frame / 2 : x0 + frame.frame / 2, y0 + h / 2, "y", handle)
    const F = frame.frame, G = frame.glass, t = d.t
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
        material: frame.material,
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(bx), r(by), z], Y, X, neg(Z), Z),
      })
    bar("left", "perfil esquerre", x0, y0, h, F)
    bar("right", "perfil dret", x0 + w - F, y0, h, F)
    // Les frontisses es veuen com són (per decisió de l'usuari: «això s'ha de veure»): la cassoleta de la frontissa triada
    // al darrere del perfil del costat de les frontisses (cara A, que mira enrere), a `cupOffset` del cantell de fora
    // (`edge`: el cantell de les frontisses); el dibuix (cassoleta, braç i placa al lateral) el fa `hardwareSolids`. És
    // d'alumini: no va a la CNC (el perfil és a `extras`).
    if (hinge && hingeYs.length) {
      const bp = this.extras.find((p) => p.id === `${id}-${hinge.side}`)!
      const cs = hinge.hinge.spec
      const v = hinge.side === "left" ? cs.cupOffset : F - cs.cupOffset
      for (const y of hingeYs) bp.holes.push({ x: r(y - y0), y: r(v), diameter: cs.cupDiameter, depth: Math.min(cs.cupDepth, t - 1), face: "A", edge: hinge.side === "left" ? "bottom" : "top", tag: "hinge" })
    }
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

  /**
   * Frontisses de perfil d'una porta de vidre (la frontissa triada, com a les portes de fusta): el perfil no es mecanitza
   * (la frontissa s'hi clava), però si la frontissa porta **placa** (target `side`, la Metallamat A), es fa al lateral de
   * les frontisses com a les de cassoleta: la quantitat per alçada, a `endOffset` dels extrems i, si hi ha filera System
   * 32, al mig de dos forats seguits. Tota la placa o res d'aquella frontissa (`plateHoles`). Sense placa, res.
   */
  private glassHinges(label: string, y0: number, h: number, g: GlassHinge): number[] {
    const spec = g.hinge.spec
    const plate = spec.plate
    const count = spec.count(h)
    const span = h - 2 * spec.endOffset
    const targets = count === 1 ? [h / 2] : Array.from({ length: count }, (_, i) => spec.endOffset + (span * i) / (count - 1))
    // Sense placa (una frontissa sense mecanitzat al lateral): es dibuixa a les alçades de la regla, cap forat.
    if (!plate || spec.pending) return targets.map((t) => r(y0 + t))
    const item = g.hinge.item
    if (!g.panel) {
      this.warnings.push({ code: "hinge", message: `${label} de vidre: la placa de «${item.name}» va al lateral de les frontisses i aquest mòdul no en té. Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId: g.zoneId })
      return targets.map((t) => r(y0 + t))
    }
    const pitch = this.hw.system32.pitch
    const mids = g.rowYs.filter((y) => g.rowYs.some((z) => Math.abs(z - y - pitch) < 0.01)).map((y) => r(y + pitch / 2))
    const placed: number[] = []
    const why = new Set<string>()
    for (const t of targets) {
      const want = y0 + t
      const pool = (mids.length ? mids : [r(want)]).filter((y) => y >= y0 + 40 && y <= y0 + h - 40 && placed.every((p) => Math.abs(p - y) >= 64))
      const sorted = [...pool].sort((a, b) => Math.abs(a - want) - Math.abs(b - want))
      for (const y of sorted) {
        const res = this.plateHoles(g.panel, g.side, y, plate, item)
        if ("error" in res) {
          why.add(res.error)
          continue
        }
        this.addPlate(g.panel, res, item, g.zoneId)
        // Un forat de la placa que cau en un de la filera (el mateix forat) és el de la placa: hi va el seu cargol.
        for (const hl of res.holes) {
          const e = g.panel.panel.holes.find((x) => x.face === hl.face && Math.abs(x.x - hl.x) < 0.05 && Math.abs(x.y - hl.y) < 0.05)
          if (e && e.tag === "system32") e.tag = hl.tag
        }
        placed.push(y)
        break
      }
    }
    if (placed.length < count)
      this.warnings.push({ code: "hinge", message: `${label} de vidre de ${num(h)} mm: només hi caben ${placed.length} de ${count} plaques de frontissa al lateral${why.size ? ` (${[...why].join(" ")})` : ""}.`, zoneId: g.zoneId })
    return placed
  }

  /** Una peça de només veure (rol `hardware`, sense nesting): una caixa de `min` (mòdul, mm) a `min + size`. */
  private hwBox(id: string, label: string, material: string, min: Vec3, size: Vec3): void {
    this.extras.push({ id, name: "ferratge", label, role: "hardware", length: r(size[0]), width: r(size[1]), thickness: r(size[2]), material, grain: "none", edges: { ...NO_EDGES }, holes: [], grooves: [], placement: placement([r(min[0]), r(min[1]), r(min[2])], X, Y, Z, Z) })
  }

  /**
   * Un cilindre de només veure (rol `hardware`): radi `R`, al llarg de Y (de `y0` a `y1`, centrat a x = `x0`, z = `z`) o
   * de X (de `x0` a `x1`, a y = `y0`). Un contorn rodó extrudit, com les peces amb forma.
   */
  private hwRod(id: string, label: string, material: string, x0: number, x1: number, y0: number, z: number, R: number, axis: "x" | "y" | "z", y1 = y0, z1 = z): void {
    const k = 0.41421356
    const len = axis === "y" ? y1 - y0 : axis === "z" ? Math.abs(z1 - z) : Math.abs(x1 - x0)
    if (len <= 0.5) return
    const outline: [number, number, number][] = [[R, 0, k], [2 * R, R, k], [R, 2 * R, k], [0, R, k]]
    const base = { id, name: "ferratge", label, role: "hardware" as const, length: 2 * R, width: 2 * R, thickness: r(len), material, grain: "none" as const, edges: { ...NO_EDGES }, holes: [], grooves: [], outline }
    if (axis === "y") this.extras.push({ ...base, placement: placement([r(x0 - R), r(y0), r(z + R)], X, neg(Z), Y, Y) })
    else if (axis === "z") this.extras.push({ ...base, placement: placement([r(x0 - R), r(y0 - R), r(Math.min(z, z1))], X, Y, Z, Z) })
    else this.extras.push({ ...base, placement: placement([r(Math.min(x0, x1)), r(y0 - R), r(z + R)], neg(Z), Y, X, X) })
  }

  /** El tirador d'una vitrina (es clava al perfil): la barra del tirador triat (de llarg la distància + 25, o 80), sortint 14. */
  private glassPull(id: string, label: string, cx: number, cy: number, along: "x" | "y", item: HardwareItem): void {
    const { d } = this
    const pitch = item.pitch ? item.pitch.else : 0
    const L = pitch > 0 ? pitch + 25 : 80
    const [w, hh] = along === "y" ? [16, L] : [L, 16]
    this.order(item, 1)
    // Com els de marc de vitrina (es claven al perfil): la placa prima sobre el perfil i el llavi per agafar-lo.
    this.hwBox(`${id}-base`, `${label}: tirador`, "Acer inox", [cx - w / 2, cy - hh / 2, d.frontZ], [w, hh, 3])
    const lip: Vec3 = along === "y" ? [5, hh, 11] : [w, 5, 11]
    this.hwBox(id, `${label}: tirador`, "Acer inox", [along === "y" ? cx + w / 2 - 5 : cx - w / 2, along === "y" ? cy - hh / 2 : cy - hh / 2, d.frontZ + 3], lip)
  }

  /**
   * Les frontisses d'un abatible de vidre (per decisió de l'usuari, com la vitrina de la cuina de casa: «connectat a la
   * fusta»): la frontissa del mòdul al perfil del cantell de gir (dalt si obre amunt, baix si obre avall), la quantitat
   * per l'amplada a `endOffset` dels extrems, i la placa a la tapa (o a la base) a la cara que mira l'abatible, a
   * `plateSetback` del darrere del front: els forats de la placa al tauler (tota o res per frontissa) i el dibuix
   * (cassoleta, braç i placa) de `hardwareSolids`. Sense la peça al cantell de gir, només el dibuix i un avís.
   */
  private glassFlapHinges(id: string, x0: number, y0: number, w: number, h: number, F: number, dir: "up" | "down", zoneId: string): void {
    const { d } = this
    const hinge = this.frontHardware("hinge", undefined, zoneId)
    const cs = hinge.spec
    const count = cs.count(w)
    const span = w - 2 * cs.endOffset
    const xs = (count === 1 || span <= 0 ? [w / 2] : Array.from({ length: count }, (_, i) => cs.endOffset + (span * i) / (count - 1))).map((x) => r(x0 + x))
    const bar = this.extras.find((p) => p.id === `${id}-${dir === "up" ? "top" : "bottom"}`)
    if (!bar) return
    if (!cs.pending) this.order(hinge.item, xs.length, "per a perfil d'alumini")
    // El perfil de dalt/baix: u al llarg de Y (F), v al llarg de X des de x0 + F; el cantell de gir és u = F (dalt) o u = 0 (baix).
    for (const x of xs) bar.holes.push({ x: r(dir === "up" ? F - cs.cupOffset : cs.cupOffset), y: r(x - (x0 + F)), diameter: cs.cupDiameter, depth: Math.min(cs.cupDepth, d.t - 1), face: "A", edge: dir === "up" ? "right" : "left", tag: "hinge" })
    if (cs.pending) return
    // La placa de la frontissa; la de l'app (sense placa pròpia) va, com al lateral, a dos forats de la filera System 32
    // (Ø i fondària de la filera, a mig pas per banda, a `edgeOffset` del davant).
    const s32 = this.hw.system32
    const plate = cs.plate ?? { setback: s32.edgeOffset, holes: [-s32.pitch / 2, s32.pitch / 2].map((u) => ({ u, v: 0, d: s32.diameter, depth: s32.depth, tag: "plate" })) }
    const edgeY = dir === "up" ? y0 + h : y0
    const host = this.horizontals.find((hz) => (dir === "up" ? hz.yBottom >= edgeY - d.t - 0.5 && hz.yBottom <= edgeY + 0.5 : hz.yTop <= edgeY + d.t + 0.5 && hz.yTop >= edgeY - 0.5) && xs.every((x) => x > hz.xL && x < hz.xR))
    if (!host) {
      this.warnings.push({ code: "hinge", message: `Abatible de vidre: la placa de «${hinge.item.name}» va a la ${dir === "up" ? "tapa" : "base"} i aquest mòdul no en té al cantell de gir. Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId })
      return
    }
    const yFace = dir === "up" ? host.yBottom : host.yTop
    const z = d.frontZ - d.t - plate.setback
    for (const x of xs) {
      const holes: Hole[] = []
      let bad = false
      for (const ph of plate.holes) {
        const l = toLocal(host.panel, [x + ph.u, yFace, z - ph.v])
        const face = faceAt(host.panel, l)
        const rad = ph.d / 2
        if (!face || face === "edge" || l[0] - rad < 0 || l[0] + rad > host.panel.length || l[1] - rad < 0 || l[1] + rad > host.panel.width) { bad = true; break }
        holes.push({ x: l[0], y: l[1], diameter: ph.d, depth: Math.min(ph.depth, Math.max(0.5, host.panel.thickness - 1)), face, tag: ph.tag ?? "plate" })
      }
      if (bad) this.warnings.push({ code: "hinge", message: `Abatible de vidre: la placa de «${hinge.item.name}» no cap a la ${host.panel.label.toLowerCase()}; aquella placa no es fa.`, zoneId })
      else host.panel.holes.push(...holes)
    }
  }

  /**
   * Pistó de gas (un item del braç d'abatible amb `strutG`: els Häfele 373.78.90x, p. FF 4.224; per decisió de l'usuari
   * «res de sistemes»: només els forats del ferratge): el bracket d'armari a la cara de dins del lateral, a G per sota del
   * cantell de gir i a `sideSetback` del darrere del front, amb els forats del target `side` (els dos Ø5 a 32, tot o res), i
   * el dibuix: el pistó (Ø15,6, del llarg del joc) amunt des del bracket, a 16 de la cara del lateral, i el bracket. Només
   * per als que obren amunt; si no, avís. Torna `false` si l'item no és un pistó (el braç de sempre).
   */
  private gasStrut(id: string, side: VerticalRef, which: "left" | "right", pivotY: number, dir: "up" | "down", item: HardwareItem, zoneId: string): boolean {
    const G = item.params.strutG
    if (G === undefined) return false
    if (dir !== "up") {
      if (which === "left") this.warnings.push({ code: "hardware", message: `«${item.name}» és per a portes que obren amunt: en un abatible que obre avall no es fa ni es dibuixa.`, zoneId })
      return true
    }
    const { d } = this
    const xFace = which === "left" ? side.xR : side.xL
    const out = which === "left" ? 1 : -1
    const yB = pivotY - G
    const zB = d.frontZ - d.t - (item.params.sideSetback ?? 37)
    const p = side.panel
    const ops = item.targets.find((t) => t.key === "side")?.ops ?? []
    const holes: Hole[] = []
    for (const op of ops) {
      if (op.kind !== "drill") continue
      const u = typeof op.u === "number" ? op.u : 0
      const dd = item.params.diameter ?? 5
      const l = toLocal(p, [xFace, yB + u, zB])
      const face = faceAt(p, l)
      if (!face || face === "edge" || l[0] - dd / 2 < 0 || l[0] + dd / 2 > p.length || l[1] - dd / 2 < 0 || l[1] + dd / 2 > p.width) {
        this.warnings.push({ code: "hardware", message: `«${item.name}»: el bracket d'armari no cap al ${p.label.toLowerCase()} (a ${num(G)} mm del cantell de gir); no es fa.`, zoneId })
        return true
      }
      holes.push({ x: l[0], y: l[1], diameter: dd, depth: Math.min(item.params.depth ?? 12, p.thickness - 1), face, tag: "flap" })
    }
    p.holes.push(...holes)
    // La comanda: un joc (2 pistons i els brackets) per abatible, amb el lateral esquerre (o el dret si no n'hi ha).
    const flapKey = id.replace(/-strut-[lr]$/, "")
    if (!this.strutOrdered.has(flapKey)) {
      this.strutOrdered.add(flapKey)
      this.order(item, 1, "joc de 2 pistons, brackets i tapes; tria la força pel pes de la porta (notes del ferratge)")
    }
    // El dibuix, com el del catàleg (FF 4.224): el bracket d'armari (placa de 26 × 14 × 3 amb el pern Ø10), el pistó tancat
    // de pern a pern (`strutLength`): la ròtula de baix, el cos Ø15,6, la tija Ø6 del recorregut i la ròtula de dalt, i el
    // bracket de porta a dalt. A 16 de la cara del lateral, vertical (la porta tancada).
    const len = item.params.strutLength ?? 230
    const stroke = item.params.strutStroke ?? Math.round(len / 3)
    const cx = xFace + out * 16
    const yTop = Math.min(pivotY - 8, yB + len)
    const L = yTop - yB
    const cap = 18
    this.hwBox(`${id}-bracket`, `${item.name}: bracket d'armari`, "Acer inox", [which === "left" ? xFace : xFace - 3, yB - 13, zB - 7], [3, 26, 14])
    this.hwRod(`${id}-pin`, `${item.name}: pern`, "Acer inox", xFace + out * 1.5, xFace + out * 12, yB, zB, 5, "x")
    this.hwRod(`${id}-cap-b`, `${item.name}: ròtula`, "Gris mat", cx, cx, yB - cap / 2, zB, 6.65, "y", yB + cap / 2)
    this.hwRod(`${id}-body`, `${item.name}: pistó`, "Alumini anoditzat plata", cx, cx, yB + cap / 2, zB, 7.8, "y", Math.max(yB + cap, yTop - cap / 2 - Math.min(stroke, L - 2 * cap)))
    this.hwRod(`${id}-rod`, `${item.name}: tija`, "Acer inox", cx, cx, Math.max(yB + cap, yTop - cap / 2 - Math.min(stroke, L - 2 * cap)), zB, 3, "y", yTop - cap / 2)
    this.hwRod(`${id}-cap-t`, `${item.name}: ròtula`, "Gris mat", cx, cx, yTop - cap / 2, zB, 6.65, "y", yTop + cap / 2)
    this.hwBox(`${id}-door-bracket`, `${item.name}: bracket de porta`, "Acer inox", [cx - 7, yTop - 13, d.frontZ - d.t - 3], [14, 26, 3])
    return true
  }

  /**
   * **El recorregut dels cables dels llums** (per decisió de l'usuari, 2026-10-14: «fes el mecanitzat de tots els cables,
   * i el que no és mecanitzat, un plànol»): l'alimentador va dins del mòdul, ajagut sobre la base, a darrere a l'esquerra
   * (50 mm lliures, com demana el catàleg). Cada cable de làmpada surt pel seu forat (ja fet), va fins a la cantonada de
   * darrere a l'esquerra del seu compartiment (a 40 del lateral i 25 del fons) i baixa: un passant del Ø del cable a cada peça horitzontal
   * que travessa (la mateixa peça de la làmpada, travessers i prestatges fixos; la base no) i, sobre la base, un passant a
   * cada divisor fins a l'alimentador. El cable de xarxa surt pel fons, darrere de l'alimentador, per una ranura de
   * 40 × 16 (hi passa l'endoll pla europeu, 35,3 × 13,7). Els prestatges regulables no es foraden (el cable passa pel
   * costat). Tot el que no és mecanitzat (on va cada cosa i les llargades) va al plànol (`wiring`).
   */
  buildWiring(): void {
    if (!this.lampSpots.length) return
    const sys = lightSystemOf(this.lightMaker ?? "")
    if (!sys) return
    const notes: string[] = []
    const base = this.panels.find((p) => p.role === "bottom")
    if (!base) return
    const bb = worldBoxOf(base)
    const baseTop = bb.max[1]
    const back = this.panels.find((p) => p.role === "back")
    const zBack = back ? worldBoxOf(back).max[2] : bb.min[2]
    const zc = zBack + 25
    // L'alimentador: el més petit que arriba a la potència (amb el pic), com a la comanda.
    const kits = this.lightKits
    const peak = kits.reduce((a, k) => a + k.peakWatts, 0)
    const ds = sys.drivers.slice().sort((a, b) => a.watts - b.watts)
    const drv = ds.find((x) => (x.perSlot ?? x.watts) >= peak) ?? ds[ds.length - 1]!
    const [len] = drv.size.split("×").map((v) => Number(v.trim().replace(",", ".")))
    const dx0 = bb.min[0] + 50
    const dx1 = dx0 + (len ?? 140)
    const driverIn: [number, number] = [dx0, baseTop + 8]
    const holes: Wiring["holes"] = []
    const seen = new Set<string>()
    const drill = (p: Panel, w: Vec3, d: number, label: string) => {
      const key = `${p.id}:${Math.round(w[0])}:${Math.round(w[1])}:${Math.round(w[2])}`
      if (seen.has(key)) return
      seen.add(key)
      const before = p.cutouts?.length ?? 0
      this.throughHole(p, w, d, "cable-run")
      if ((p.cutouts?.length ?? 0) > before) holes.push({ x: r(w[0]), y: r(w[1]), label })
    }
    // Sobre la base, de x fins a l'alimentador: un passant a cada divisor que hi ha pel mig.
    const alongBase = (x: number, d: number) => {
      for (const v of this.verticals) {
        if (v.outer) continue
        const mid = (v.xL + v.xR) / 2
        if (mid > Math.min(x, dx0) && mid < Math.max(x, dx0) && v.yB <= baseTop + 1 && v.yT > baseTop + 20) drill(v.panel, [mid, baseTop + 20, zc], d, "pas del cable (divisor)")
      }
    }
    const runs: Wiring["runs"] = []
    for (const l of this.lampSpots) {
      const hb = worldBoxOf(l.host)
      const pts: [number, number][] = [[l.x, l.y]]
      let length = 0
      if (l.host === base) {
        // Llum a sota: el cable puja per la base i va per sobre fins a l'alimentador.
        alongBase(l.x, l.d)
        length = Math.abs(l.x - dx0) + Math.abs(l.z - zc) + 50
        pts.push([l.x, baseTop + 8], driverIn)
      } else {
        // A 40 del lateral (fora de les espigues de cantell dels prestatges, que hi entren uns 20) i a 25 del fons.
        const cx = l.x0 + 40
        const top = hb.max[1]
        // Per sobre de la peça de la làmpada fins a la cantonada, i avall per la cantonada.
        drill(l.host, [cx, (hb.min[1] + hb.max[1]) / 2, zc], l.d, "pas del cable")
        // Les peces horitzontals fixes de sota (travessers, prestatges fixos: els que porten espigues); els regulables, no.
        for (const p of this.panels) {
          if (p === base || p === l.host) continue
          const fixed = p.role === "fixedShelf" || (p.role === "shelf" && p.holes.some((h) => h.tag === "dowel"))
          if (!fixed) continue
          const pb = worldBoxOf(p)
          if (cx > pb.min[0] && cx < pb.max[0] && zc > pb.min[2] && zc < pb.max[2] && pb.max[1] <= hb.min[1] + 0.5 && pb.min[1] >= baseTop - 0.5) drill(p, [cx, (pb.min[1] + pb.max[1]) / 2, zc], l.d, "pas del cable")
        }
        alongBase(cx, l.d)
        length = Math.abs(l.x - cx) + Math.abs(l.z - zc) + (top - baseTop) + Math.abs(cx - dx0) + 50
        pts.push([l.x, top + 8], [cx, top + 8], [cx, baseTop + 8], driverIn)
      }
      runs.push({ from: l.label, points: pts.map(([x, y]) => [r(x), r(y)]), length: Math.round(length) })
      if (length > sys.maxCable) notes.push(`${l.label}: ${Math.round(length)} mm de cable fins a l'alimentador (el catàleg en diu ${sys.maxCable} com a molt): cal un altre alimentador més a prop.`)
    }
    // El cable de xarxa: pel fons, darrere de l'alimentador (l'endoll pla europeu, 35,3 × 13,7, passa per 40 × 16).
    let mains: Wiring["mains"]
    if (back) {
      const mx = (dx0 + dx1) / 2, my = baseTop + 40
      const l = toLocal(back, [mx, my, worldBoxOf(back).min[2]])
      if (l[0] > 25 && l[1] > 12 && l[0] < back.length - 25 && l[1] < back.width - 12) {
        ;(back.cutouts ??= []).push({ kind: "slot", x: r(l[0] - 20), y: r(l[1] - 8), w: 40, h: 16, tag: "cable-mains" })
        mains = { x: r(mx), y: r(my) }
      }
    }
    if (!mains) notes.push("Sense fons on fer la sortida del cable de xarxa: passa'l per darrere del mòdul fins a l'endoll.")
    if (this.lampSpots.some((l) => l.host.role === "shelf")) notes.push("Les làmpades sota prestatges regulables: el cable passa pel costat del prestatge (no es forada) fins a la cantonada.")
    // Al 3D (per decisió de l'usuari: «es veuen els cables?»): l'alimentador, cada cable pel seu recorregut (Ø4) i la tapa
    // passacables del catàleg a la cantonada per on baixa (de només veure, rol `hardware`).
    this.hwBox("wiring-driver", drv.name, "Gris mat", [dx0, baseTop, zBack + 20], [dx1 - dx0, 16, 50])
    const cable = (id: string, a: Vec3, b: Vec3) => {
      if (Math.abs(a[0] - b[0]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], b[0], a[1], a[2], 2, "x")
      else if (Math.abs(a[1] - b[1]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], a[0], Math.min(a[1], b[1]), a[2], 2, "y", Math.max(a[1], b[1]))
      else if (Math.abs(a[2] - b[2]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], a[0], a[1], a[2], 2, "z", a[1], b[2])
    }
    const covers = new Set<string>()
    this.lampSpots.forEach((l, i) => {
      const dz: Vec3 = [dx0, baseTop + 8, zc]
      const path: Vec3[] = []
      if (l.host === base) path.push([l.x, l.y, l.z], [l.x, baseTop + 8, l.z], [l.x, baseTop + 8, zc], dz)
      else {
        const top = worldBoxOf(l.host).max[1] + 3
        const cx = l.x0 + 40
        path.push([l.x, l.y, l.z], [l.x, top, l.z], [l.x, top, zc], [cx, top, zc], [cx, baseTop + 8, zc], dz)
        const key = `${Math.round(cx)}`
        if (!covers.has(key)) {
          covers.add(key)
          if (top - baseTop > 60) this.hwBox(`wiring-cover-${i}`, sys.cableCover?.name ?? "Tapa passacables", "Blanc seda", [cx - 10, baseTop + 16, zc - 8], [20, top - baseTop - 16, 16])
        }
      }
      for (let j = 0; j + 1 < path.length; j++) cable(`wiring-${i}-${j}`, path[j]!, path[j + 1]!)
    })
    const sw = this.lightKits[0]?.switch
    this.wiring = {
      driver: { x0: r(dx0), x1: r(dx1), y0: r(baseTop), y1: r(baseTop + 16), name: drv.name, article: drv.article },
      lamps: this.lampSpots.map((l) => ({ x: r(l.x), y: r(l.y), label: l.label })),
      runs,
      ...(sw === "door" && this.switchSpot ? { switch: { ...this.switchSpot, kind: "door" as const } } : sw === "touch" ? { switch: { x: r(bb.min[0] + 30), y: r(baseTop + 60), kind: "touch" as const } } : {}),
      ...(mains ? { mains } : {}),
      holes,
      notes,
    }
  }

  /** El braç d'un abatible de vidre (es veu): el cos cargolat a la cara de dins del lateral, a dalt. */
  private glassArm(id: string, side: VerticalRef, which: "left" | "right", y0: number, h: number, dir: "down" | "up"): void {
    const { d } = this
    const zBack = d.frontZ - d.t
    const xFace = which === "left" ? side.xR : side.xL
    const yTop = dir === "up" ? y0 + h - 30 : y0 + 140
    this.hwBox(id, "Braç d'abatible", "Acer inox", [which === "left" ? xFace : xFace - 18, yTop - 110, zBack - 260], [18, 110, 230])
  }

  private buildFlap(zone: Zone, front: Extract<Front, { kind: "flap" }>, ter: ZoneRect, left?: VerticalRef, right?: VerticalRef): void {
    // Abatible de vidre (vitrina): el marc d'alumini i el vidre, com la porta de vidre; el braç va al perfil.
    if (front.glass) {
      this.frontCount += 1
      const id = `flap-${this.frontCount}`
      const x0 = ter.x0, y0 = ter.y0, w = r(ter.x1 - ter.x0), h = r(ter.y1 - ter.y0)
      this.glassDoor(id, "Abatible", x0, y0, w, h, this.frontHardware("glassFrame", front.frame, zone.id))
      const F = this.frontHardware("glassFrame", front.frame, zone.id).spec.frame
      // Es veu (per decisió de l'usuari: «s'ha de veure tot»): el tirador al perfil del cantell que obre i els braços als laterals.
      const handle = this.frontHandle(front.handle, zone.id)
      if (!handle.push) this.glassPull(`${id}-pull`, "Abatible", x0 + w / 2, front.dir === "down" ? y0 + h - F / 2 : y0 + F / 2, "x", handle.item)
      const arm = this.frontHardware("flap", front.hardware, zone.id)
      for (const ref of [left, right]) {
        if (!ref) continue
        const which = ref === left ? "left" : "right"
        if (!this.gasStrut(`${id}-strut-${which[0]}`, ref, which, front.dir === "up" ? y0 + h : y0, front.dir, arm.item, zone.id))
          this.glassArm(`${id}-arm-${which[0]}`, ref, which, y0, h, front.dir)
      }
      this.glassFlapHinges(id, x0, y0, w, h, F, front.dir, zone.id)
      return
    }
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
    // Un pistó de gas també es cargola al lateral (bracket d'armari) i es dibuixa.
    for (const ref of [left, right]) if (ref) this.gasStrut(`${flap.id}-strut-${ref === left ? "l" : "r"}`, ref, ref === left ? "left" : "right", front.dir === "up" ? ter.y1 : ter.y0, front.dir, arm.item, zone.id)
    // Tirador al cantell que obre (el contrari del gir), horitzontal i centrat.
    const handleHw = this.frontHandle(front.handle, zone.id)
    // Sense tiradors no es llegeix el lloc (`handle` només marca el push).
    // La distància del front (`handleInset`) o la del tirador; com a molt, el mig de l'abatible.
    const inset = handleHw.push ? 0 : Math.min(front.handleInset ?? handleHw.spec.inset, along / 2)
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
    // L'imant triat a la reixeta (si no, el del mòdul): desmuntable i trapa.
    const magnet = this.frontHardware("magnet", front.hardware, zone.id)
    if (front.mount !== "hinged") {
      const mg = magnet.spec
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
      const mg = magnet.spec
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
    const mg = magnet.spec
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
    this.drawerHeights[zone.id] = heights
    const ys: number[] = []
    for (let i = 0, yy = ter.y0; i < n; i++) {
      ys.push(yy)
      yy = r(yy + heights[i]! + bg)
    }
    return { heights, ys }
  }

  /** El front d'un calaix (cara A cap a dins, x local = amplada) amb el tirador (centrat o a dalt) i, si toca, els inglets. */
  private addDrawerFront(k: number, ter: ZoneRect, y: number, fh: number, handleHw: HandleChoice, zone: Zone): Panel {
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
    // Centrat o a `handleTop` mm del cantell de dalt (y local cap avall), mai per sota del mig.
    const top = zone.front?.kind === "drawers" ? zone.front.handleTop : undefined
    this.handle(frontPanel, fw / 2, top !== undefined ? Math.min(top, fh / 2) : fh / 2, "x", handleHw, zone.id)
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
    // La guia triada al calaix (si no, la del mòdul). Un joc paramètric de calaix de doble paret (DTC MAGIC-PRO), triat
    // al calaix o com a guia del mòdul: cap lateral de fusta; el joc mana.
    const slideHw = this.frontHardware("slide", front.hardware, zone.id)
    if (isDrawerKit(slideHw.item)) {
      // El tancament del joc mana: push-open ⇒ cap tirador (el push el posa el joc).
      const kitPush = isPushClosing(kitOptionsOf(slideHw.item.kit, front.kit).closing)
      this.buildKitDrawers(zone, front, slideHw.item, rect, ter, left, right, this.frontHandle(front.handle, zone.id, kitPush))
      return
    }
    // El tirador triat al calaix (si no, el del mòdul).
    const handleHw = this.frontHandle(front.handle, zone.id)
    // Llargades, jocs, caixa i forats de la guia.
    const hw = slideHw.spec
    const n = front.n
    const { heights, ys } = this.drawerLayout(zone, front, ter)

    const boxW = r(rect.x1 - rect.x0 - 2 * hw.sideClearance)
    // Amb el front encastat, la caixa del calaix comença un gruix més endins.
    // Una columna pel darrere: la fondària que queda davant del seu fons.
    const maxLen = d.availDepth - (this.rearAt(rect.x0, rect.x1) - d.backInnerZ) - hw.backClearance - (d.inset ? d.t : 0)
    const slide = [...hw.slideLengths].sort((a, b) => b - a).find((l) => l <= maxLen)
    if (slide === undefined) {
      this.warnings.push({ code: "drawer-no-slide", message: `Cap guia de calaix (${hw.slideLengths.join(", ")}) cap en ${r(maxLen)} mm de fondària útil.`, zoneId: zone.id })
    }
    const boxL = slide ?? r(maxLen)
    const bt = hw.boxThickness
    const tbb = hw.bottomThickness
    const g = c.grooveDepth
    const bottomMat = c.drawerBottomMaterial ? { name: c.drawerBottomMaterial, warn: false } : drawerBottomMaterial(c.backMaterial, c.backThickness, tbb)
    if (n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons del calaix de ${tbb} mm en «${bottomMat.name}» (${c.back === "none" ? `sense fons al mòdul, surt del material del cos, de ${c.thickness} mm` : `surt del fons del mòdul, de ${c.backThickness} mm`}): comprova que aquest material es ven en ${tbb} mm, o tria'n un a Materials › «Fons del calaix».`, zoneId: zone.id })

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
    handleHw: HandleChoice,
  ): void {
    const { m, d } = this
    const c = m.carcass
    const { heights, ys } = this.drawerLayout(zone, front, ter)
    const LW = r(rect.x1 - rect.x0)
    const zFront = d.frontZ - d.t // cara posterior del front
    // Fondària darrere del front fins al fons del moble (encastat: el front ja és dins de la llum).
    const depth = r(zFront - this.rearAt(rect.x0, rect.x1))
    const TB = kitBottomThickness(item)
    const res = planKit(item, { LW, depth, G: c.thickness, TB, options: front.kit })
    for (const w of res.warnings) this.hardwareWarning(w, zone.id)
    const plan = res.plan
    // El gruix del fons el demana el joc (16, `TB`): no és cap tria del moble ni s'hi suggereix res; només s'avisa si
    // el material del fons no se sap si es ven en aquest gruix.
    const bottomMat = c.drawerBottomMaterial ? { name: c.drawerBottomMaterial, warn: false } : c.thickness === TB ? { name: c.material, warn: false } : drawerBottomMaterial(c.backMaterial, c.backThickness, TB)
    if (plan && front.n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons del calaix de ${TB} mm en «${bottomMat.name}» (el joc «${item.name}» demana un fons del calaix de ${TB} mm; ${c.back === "none" ? `sense fons al mòdul, surt del material del cos, de ${c.thickness} mm` : `surt del fons del mòdul, de ${c.backThickness} mm`}): comprova que aquest material es ven en ${TB} mm, o tria'n un a Materials › «Fons del calaix».`, zoneId: zone.id })
    if (plan && (!left || !right)) this.hardwareWarning(`«${item.name}»: el compartiment no té lateral a ${!left ? "l'esquerra" : "la dreta"} on cargolar la guia. Els calaixos es queden només amb el front.`, zone.id)
    // Vora inferior de la guia de cada calaix: a `baseAboveFront` del cantell de baix del front, dins de la llum (1 mm).
    const slideBase = (i: number, kit: HardwareKit) => r(Math.max(ys[i]! + kit.rules.baseAboveFront, rect.y0 + 1))
    // Fins on pot arribar el joc: l'últim, sota la tapa (1 mm); els altres, fins a la guia del de sobre.
    const kitTop = (i: number, kit: HardwareKit) => (i === front.n - 1 ? rect.y1 - 1 : slideBase(i + 1, kit))
    const fits = (i: number, kit: HardwareKit) => slideBase(i, kit) + kitHeight(kit) <= kitTop(i, kit) + 0.01
    // L'alçada del calaix mana (per decisió de l'usuari): si el joc triat no hi cap, el més alt de la mateixa sèrie que
    // sí que hi cap (MAGIC-PRO K → M → N), amb els mateixos números de l'item (prebroca) i les mateixes opcions.
    // La guia de cada calaix (per decisió de l'usuari, 2026-10-14): el primer, la «Guia de calaix»; cada un dels altres, la
    // seva (`front.drawerSlides[i]`, un joc) o, sense, la del calaix de sota. Triar-ne una canvia aquell i els de sobre.
    const slideOf: HardwareItem[] = []
    for (let i = 0, prev = item; i < front.n; i++) {
      const own = i > 0 ? front.drawerSlides?.[i] : undefined
      if (own && isDrawerKit(own)) prev = own
      slideOf.push(prev)
    }
    // Pla de cada joc (un cop per item) i els de la seva sèrie més baixos.
    const plans = new Map<HardwareItem, { plan: KitPlan | null; lower: { sib: HardwareItem; plan: KitPlan }[] }>()
    const planOf = (it: HardwareItem) => {
      let got = plans.get(it)
      if (!got) {
        const tb = kitBottomThickness(it)
        const own = it === item ? res : planKit(it, { LW, depth, G: c.thickness, TB: tb, options: front.kit })
        if (it !== item) for (const w of own.warnings) this.hardwareWarning(w, zone.id)
        // L'alçada del calaix mana (per decisió de l'usuari): si el joc no hi cap, el més alt de la mateixa sèrie que
        // sí que hi cap (MAGIC-PRO K → M → N), amb els mateixos números de l'item (prebroca) i les mateixes opcions.
        const lower = own.plan ? kitFamily(it).flatMap((sib) => {
          const sp = planKit(sib, { LW, depth, G: c.thickness, TB: kitBottomThickness(sib), options: front.kit }).plan
          return sp ? [{ sib, plan: sp }] : []
        }) : []
        got = { plan: own.plan, lower }
        plans.set(it, got)
      }
      return got
    }
    for (let i = 0; i < front.n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const y = ys[i]!
      const frontPanel = this.addDrawerFront(k, ter, y, fh, handleHw, zone)
      const chosen = slideOf[i]!
      const { plan: own, lower } = planOf(chosen)
      if (!own || !left || !right) continue
      const pick = fits(i, own.kit) ? { sib: chosen, plan: own } : lower.find((x) => fits(i, x.plan.kit))
      if (!pick) {
        const least = lower.at(-1)
        this.hardwareWarning(`«${chosen.name}» no cap al calaix ${k} (front de ${num(fh)} mm)${least ? `, ni tampoc el joc més baix de la sèrie («${least.sib.name}», ${num(kitHeight(least.plan.kit))} mm d'alçada)` : ""}: només es fa el front. Fes més alt el front, posa menys calaixos o tria una guia més baixa per a aquest calaix.`, zone.id)
        continue
      }
      const kitItemUsed = pick.sib
      const kitPlan = pick.plan
      const kit = kitPlan.kit
      const y0 = slideBase(i, kit)
      const at = { x0: rect.x0, y0, zFront }
      const pilot = kitPlan.pilot
      // Prebroques dels cargols de la guia als dos laterals del moble (el dret, mirall): z des del cantell de davant del
      // lateral (= la cara de darrere del front, amb els fronts recobrents).
      if (pilot) {
        const spec = { ...pilot, tag: "kit-slide" }
        for (const ref of [left, right])
          for (const h of kitPlan.sidePilots) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, r(y0 + h.y), r(zFront - h.z)], spec)
        // Suports de davant: al darrere del front (cara A), a `x` de cada lateral.
        for (const h of kitPlan.frontPilots) for (const x of [rect.x0 + h.x, rect.x1 - h.x]) addFaceHole(frontPanel, [r(x), r(y0 + h.y), zFront], { ...pilot, tag: "kit-front" })
      }
      // Fusta: fons A (sobre la guia del lateral) i darrere B (sobre el fons, al final).
      const bottom = kitPlan.wood.find((w) => w.key === "bottom")
      const back = kitPlan.wood.find((w) => w.key === "back")
      const zSlide = zFront - kit.rules.slideSetback
      if (bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - bottom.width) / 2)
        this.add(
          this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottom.width, bottom.depth, kitBottomThickness(kitItemUsed), bottomMat.name, "none", { ...NO_EDGES }, placement([bx0, y0 + kit.geometry.bottomBase, zSlide], X, neg(Z), Y, neg(Y))),
        )
      }
      if (back && back.height !== undefined && bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - back.width) / 2)
        const yB = r(y0 + kit.geometry.bottomBase + kitBottomThickness(kitItemUsed))
        const zB = r(zSlide - bottom.depth)
        // Cara A cap al darrere del moble (on van els suports): x local = amplada, y local amunt.
        const backPanel = this.add(this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", back.width, back.height, c.thickness, c.material, "x", edges("top"), placement([bx0, yB, zB + c.thickness], X, Y, neg(Z), neg(Z))))
        if (pilot) for (const h of kitPlan.backPilots) for (const x of [bx0 + h.x, bx0 + back.width - h.x]) addFaceHole(backPanel, [r(x), r(yB + h.y), zB], { ...pilot, tag: "kit-back" })
      }
      this.extras.push(...kitSolidPanels(kitPlan, k, at, LW))
      this.hardwareKits.push({ zoneId: zone.id, drawer: k, item: kitItemUsed.name, kit: `${kit.maker} ${kit.series} ${kit.heightClass.code}`, nl: kitPlan.nl, options: kitPlan.options, lines: kitPlan.lines, wood: kitPlan.wood, ...(kitPlan.rule ? { rule: kitPlan.rule } : {}), ...(kitPlan.syncRod !== undefined ? { syncRod: kitPlan.syncRod } : {}) })
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
    // Una distància per a cada costat (la que l'item no porta és `inset`): esquerra, dreta, darrere i davant.
    const { insetLeft: left, insetRight: right, insetBack: back, insetFront: front } = spec
    const legs: [number, number][] = [
      [left, back],
      [d.W - right, back],
      [left, d.D - front],
      [d.W - right, d.D - front],
    ]
    const T = bottom.thickness
    const margin = 3
    const holes: Hole[] = []
    let deep = false
    for (const [lx, lz] of legs)
      for (const h of spec.holes) {
        const u = spec.mirror && lx > d.W / 2 ? -h.u : h.u
        const l = toLocal(bottom, [r(lx + u), d.baseY, r(lz + h.v)])
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
    this.order(item, legs.length, item.tags?.some((t) => t.startsWith("Tub")) ? "el tub amb el peu es demana a part per l'alçada (notes del ferratge)" : undefined)
    if (deep) this.hardwareWarning(`«${item.name}»: els forats de les potes són més fondos que la base: es fan a ${num(T - 1)} mm (1 mm de pell).`)
    const imp = item.imported
    // Una pota de la biblioteca sense model (la AXILO 78): es dibuixa amb sòlids de l'app (`legSolids`), la placa amb les
    // mides de l'item (`plateU0`…; a la dreta, en mirall) i el tub fins a terra.
    const pp = item.params
    if (!imp && [pp.plateU0, pp.plateU1, pp.plateV, pp.plateH].every((x) => Number.isFinite(x))) {
      const z = bottom.placement
      const lv: [number, number] = [z.xAxis[2], z.yAxis[2]]
      for (const [lx, lz] of legs) {
        const l = toLocal(bottom, [lx, d.baseY, lz])
        const face = faceAt(bottom, l)
        if (face !== "A" && face !== "B") continue
        // El marc del ferratge: u = v × n amb n cap a terra; si u surt cap a −X del mòdul, la placa es gira.
        const n: Vec3 = face === "A" ? [z.zAxis[0], z.zAxis[1], z.zAxis[2]] : [-z.zAxis[0], -z.zAxis[1], -z.zAxis[2]]
        const vw: Vec3 = [lv[0] * z.xAxis[0] + lv[1] * z.yAxis[0], lv[0] * z.xAxis[1] + lv[1] * z.yAxis[1], lv[0] * z.xAxis[2] + lv[1] * z.yAxis[2]]
        const ux = vw[1] * n[2] - vw[2] * n[1]
        const flip = (spec.mirror && lx > d.W / 2 ? -1 : 1) * (ux < 0 ? -1 : 1)
        const [u0, u1] = flip > 0 ? [pp.plateU0!, pp.plateU1!] : [-pp.plateU1!, -pp.plateU0!]
        ;(bottom.fittings ??= []).push({ kind: "leg", x: l[0], y: l[1], face, v: lv, leg: { u0, u1, halfV: pp.plateV!, plateH: pp.plateH!, height: base.height, foot: pp.foot ?? 78 } })
      }
    }
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
/**
 * Un obstacle que entra pel darrere del mòdul (una columna de la casa, `buildComposition`): en coordenades del mòdul, de
 * `x0` a `x1`, i fins a `z` (des del darrere, ja amb el fons nou que s'hi posa davant). Els calaixos d'aquell tram es
 * fan més curts (guia i caixa, o la NL del joc) perquè hi càpiguen.
 */
export interface RearLimit {
  x0: number
  x1: number
  z: number
}

/**
 * La instal·lació elèctrica dels llums d'un mòdul, vista de davant (x, y del mòdul, mm): l'alimentador, cada làmpada i el
 * recorregut del seu cable fins a l'alimentador (amb la llargada), l'interruptor i la sortida del cable de xarxa.
 */
export interface Wiring {
  driver: { x0: number; x1: number; y0: number; y1: number; name: string; article: string }
  lamps: { x: number; y: number; label: string }[]
  runs: { from: string; points: [number, number][]; length: number }[]
  switch?: { x: number; y: number; kind: "door" | "touch" }
  mains?: { x: number; y: number }
  /** Els forats que fa el recorregut (a més dels de les làmpades): per a la llegenda. */
  holes: { x: number; y: number; label: string }[]
  notes: string[]
}

/** La caixa d'una peça al mòdul (mm). */
function worldBoxOf(p: Panel): { min: Vec3; max: Vec3 } {
  const cs = [0, p.length].flatMap((u) => [0, p.width].flatMap((v) => [0, p.thickness].map((w) => toWorld(p, [u, v, w]))))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/** La frontissa d'una porta de vidre: la triada (la seva placa al lateral) i on va. */
type GlassHinge = { hinge: { spec: SlotSpec<"hinge">; item: HardwareItem }; side: "left" | "right"; panel?: VerticalRef; rowYs: number[]; zoneId?: string }

export function buildModule(input: Module, opts: { rearLimits?: RearLimit[] } = {}): ModuleBuild {
  // Res amagat compta: només el que es veu a l'inspector (els camps de les opcions apagades no hi entren).
  const b = new Builder(visibleModule(input))
  b.rearLimits = opts.rearLimits ?? []

  b.buildCarcass()
  const layout = b.buildZones()
  b.buildLegs()
  b.buildUnderLight()
  b.buildWiring()
  const panels = b.panels.map((p) => normalizePanel(p.cutouts && p.cutouts.length === 0 ? { ...p, cutouts: undefined } : p))
  return { panels, extras: b.extras, hardwareKits: b.hardwareKits, lightKits: b.lightKits, fittingOrders: b.fittingOrders, ...(b.wiring ? { wiring: b.wiring } : {}), warnings: b.warnings, layout, openRatios: b.openRatios, drawerHeights: b.drawerHeights }
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
