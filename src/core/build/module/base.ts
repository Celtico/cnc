import {
  mountOf,
  NO_EDGES,
  type EdgeBanding,
  type EdgeSide,
  type Front,
  type HardwareItem,
  type ModuleHardware,
  type HardwareSlot,
  type Carcass,
  type Module,
  type Panel,
  type PanelRole,
  type Vec3,
  type Zone,
  isLegacyHardware,
  migrateModuleHardware,
  hasInnerPieces,
} from "../../model"
import type { KitOrderLine } from "../drawerKit"
import { X, Y, Z, cabineoJoint, neg, panelBox, placement, r, screwJoint, spreadAlong } from "../geometry"
import { resolveKit, slotSpec, type ResolvedKit, type SlotSpec } from "../hardware"
import type { LightOrder } from "../lightOrders"
import type { LinearPiece } from "../linearOrders"
import { type Derived, derive } from "./derive"
import type { BuildWarning, KitOrder, Wiring, RearLimit, VerticalRef, HorizontalRef, VentInlet } from "./types"

const EDGE_SIDES: readonly EdgeSide[] = ["left", "right", "bottom", "top"]
/**
 * Peces on manen les regles de laminat (`applyEdgeRules`). Les tires del davant de les parets i prestatges buits
 * (`facing`), no: són el cantell de davant de la peça gruixuda i es cantegen pels quatre costats, com un front.
 */
const EDGE_RULE_ROLES = new Set<PanelRole>(["side", "bottom", "top", "back", "shelf", "divider", "fixedShelf", "plinth", "spacer"])
/** Peces que no tapen el cantell d'una altra: els fronts s'obren (el cantell de davant del lateral es veu igual) i els ferratges no són tauler. */
const EDGE_RULE_SKIP_OCCLUDER = new Set<PanelRole>(["door", "drawerFront", "flap", "grille", "hatch", "panel", "hardware"])
/** Peces de dins: els caps són els cantells que no miren ni endavant ni enrere. */
const INNER_END_ROLES = new Set<PanelRole>(["divider", "fixedShelf", "shelf"])
/** Fins on es mira, fora del cantell, si hi ha una altra peça (més que la folgança de les peces de dins, 3 mm). */
const EDGE_PROBE = 4

/** Direcció cap a fora d'un cantell, en coordenades del mòdul (z+ = davant, y− = sota). */
function edgeDirection(p: Panel, side: EdgeSide): Vec3 {
  const { xAxis, yAxis } = p.placement
  return side === "left" ? neg(xAxis) : side === "right" ? xAxis : side === "bottom" ? neg(yAxis) : yAxis
}

/** El cantell es veu si algun punt just fora (a `EDGE_PROBE`, al llarg del cantell i a mig gruix) no és dins d'una altra peça. */
function edgeExposed(p: Panel, side: EdgeSide, others: readonly { p: Panel; box: { min: Vec3; max: Vec3 } }[]): boolean {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const along = side === "left" || side === "right"
  return [0.1, 0.3, 0.5, 0.7, 0.9].some((f) => {
    const u = along ? (side === "left" ? -EDGE_PROBE : p.length + EDGE_PROBE) : f * p.length
    const v = along ? f * p.width : side === "bottom" ? -EDGE_PROBE : p.width + EDGE_PROBE
    const w = p.thickness / 2
    const pt = [0, 1, 2].map((i) => o[i]! + u * x[i]! + v * y[i]! + w * z[i]!)
    return !others.some(({ p: q, box }) => q !== p && pt.every((c, i) => c > box.min[i]! - 0.01 && c < box.max[i]! + 0.01))
  })
}

/** Estat i utilitats comunes del constructor d'un mòdul: les capes (`carcass`, `lights`… `zones`) l'estenen. */
export class BuilderBase {
  readonly m: Module
  /** Mides derivades; dins d'una zona amb el seu fons encastat, amb aquest fons (`withZoneDepth`). */
  d: Derived
  /** Obstacles pel darrere (columnes): els calaixos del seu tram, més curts. */
  rearLimits: RearLimit[] = []
  keepOut: [number, number][] = []
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
  /** El tipus de cada peça de fons (`ModuleBuild.backKinds`). */
  readonly backKinds: Record<string, Carcass["back"]> = {}
  readonly extras: Panel[] = []
  readonly hardwareKits: KitOrder[] = []
  readonly lightKits: LightOrder[] = []
  readonly fittingOrders: KitOrderLine[] = []
  /** El sòcol per defecte dels electrodomèstics de terra (sense, `DEFAULT_APPLIANCE_PLINTH`): el de les potes del moble. */
  appliancePlinth: number | undefined = undefined
  /** Entrades d'aire pel sòcol dels electrodomèstics: el sòcol és del tram (`tramPlinth.ts`), que hi fa el retall. */
  readonly ventInlets: VentInlet[] = []
  /** Ferratges per metres (la regleta dels penjadors, el sòcol d'alumini): els trossos per a la comanda (`buildLinearOrders`). */
  readonly linear: LinearPiece[] = []
  /** On és cada làmpada d'un joc de llum (el punt del forat del cable) i la peça que la porta: el recorregut del cable (`buildWiring`). */
  protected readonly lampSpots: { x: number; y: number; z: number; host: Panel; x0: number; d: number; label: string }[] = []
  protected switchSpot?: { x: number; y: number }
  wiring?: Wiring
  protected readonly strutOrdered = new Set<string>()
  /** Afegeix `qty` unitats d'un ferratge a la comanda del mòdul (els iguals, per id i nota, se sumen). */
  order(item: HardwareItem, qty: number, note?: string): void {
    if (qty <= 0) return
    const hit = this.fittingOrders.find((l) => l.component === item.id && l.note === note && l.name === item.name)
    if (hit) hit.qty += qty
    else this.fittingOrders.push({ component: item.id, name: item.name, qty, ...(item.ref ? { item: item.ref } : {}), ...(note ? { note } : {}) })
  }
  /** L'interruptor dels llums del mòdul (un per mòdul, amb el primer compartiment amb llum). */
  protected lightSwitch?: LightOrder["switch"]
  protected lightMaker?: string
  /** Zones que queden darrere del front d'una zona pare. */
  readonly covered = new Set<string>()
  /** El front que tapa cada zona de `covered` (el de la zona de més amunt): els calaixos interiors hi miren les frontisses. */
  readonly coverFront = new Map<string, Front>()
  /** Retranqueig dels prestatges de cada compartiment quan no és el del mòdul (el propi o el del pistó): la tira LED el segueix. */
  protected readonly shelfSetbackOf = new Map<string, number>()
  /** Totes les zones per id. */
  protected readonly zones = new Map<string, Zone>()
  readonly verticals: VerticalRef[] = []
  readonly horizontals: HorizontalRef[] = []
  protected shelfCount = 0
  protected doorZones = 0
  protected drawerCount = 0
  protected frontCount = 0

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
      get hanger() { return k.hanger.spec },
      get wallRail() { return k.wallRail.spec },
    }
  }

  protected hardwareWarning(message: string, zoneId?: string): void {
    if (!this.warnings.some((w) => w.code === "hardware" && w.message === message)) this.warnings.push({ code: "hardware", message, ...(zoneId ? { zoneId } : {}) })
  }

  /**
   * El ferratge d'un front o d'un accessori (el triat a la porta, el calaix, l'abatible, la reixeta, la barra o la llum;
   * si no, el del mòdul).
   */
  protected frontHardware<S extends HardwareSlot>(slot: S, item: HardwareItem | undefined, zoneId?: string): { spec: SlotSpec<S>; item: HardwareItem } {
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

  protected add(panel: Panel): Panel {
    this.panels.push(panel)
    return panel
  }

  protected basePanel(
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

  /**
   * Cantell del darrere d'una peça de la caixa (laterals, base, tapa, divisors i prestatges): només amb el mòdul lliure
   * al terra separat de la paret, que el deixa a la vista (per decisió de l'usuari, 2026-10-13: arrambat o penjat a la
   * paret, el darrere no es veu; 2026-10-14: «el laminat del darrere només si no és moble de paret», també amb fons). Amb
   * el fons cargolat, no: el fons tapa els cantells de darrere (es cantegen els seus). `side` = el cantell local del
   * darrere de la peça.
   */
  protected rearEdge(side: EdgeSide): EdgeSide[] {
    const m = this.m
    return m.carcass.back !== "screwed" && mountOf(m) === "floor" && (m.wallGap ?? 0) > 0 ? [side] : []
  }

  /**
   * Regles de laminat (per decisió de l'usuari, 2026-10-20), al final del mòdul i per sobre del que hagi posat cada peça:
   * segons on va el mòdul (`mountOf`), quins cantells de la caixa (laterals, base, tapa, fons del mateix tauler,
   * divisors, prestatges, sòcol i llistons) es cantegen:
   * - arrambat a la paret (a terra): els de davant i els de dalt (correcció de l'usuari, 2026-10-20);
   * - penjat a la paret: els de davant i els de sota;
   * - lliure al terra: tots. Les taules (`CompositionKind` «taula») compten com a lliures al terra (`freestanding`):
   *   el seu mòdul és «arrambat» per defecte, però una taula es veu per tots els costats.
   * Només els que queden a la vista: un cantell que toca una altra peça del mòdul (la base entre laterals, el lateral
   * sota la tapa, el darrere contra el fons cargolat) no es canteja. Els fronts (portes, calaixos, trapes), les tires del
   * davant de les peces buides i les caixes dels calaixos fan com sempre; els cantells a inglet i les peces amb contorn, també. Els materials massissos, cap
   * (`isSolidMaterial`, a `buildComposition`).
   */
  applyEdgeRules(freestanding = false): void {
    const own = mountOf(this.m)
    const mount = freestanding && own === "wall" ? "floor" : own
    const others = this.panels.filter((p) => !EDGE_RULE_SKIP_OCCLUDER.has(p.role)).map((p) => ({ p, box: panelBox(p) }))
    for (const [i, p] of this.panels.entries()) {
      // Amb contorn, només els divisors i prestatges fixos (la llengüeta del darrere on una zona no té fons, `fitGroovedBack`):
      // cada costat de la caixa de la peça, sencer.
      if (!EDGE_RULE_ROLES.has(p.role) || (p.outline && p.role !== "divider" && p.role !== "fixedShelf")) continue
      if (p.role === "back" && p.material !== this.m.carcass.material) continue
      const e: EdgeBanding = { ...NO_EDGES }
      for (const side of EDGE_SIDES) {
        if (p.mitres?.includes(side)) continue
        const dir = edgeDirection(p, side)
        // Els caps de les peces de dins (divisors i prestatges) que no toquen res: queden a la vista dins del moble, també
        // arrambat o penjat (on una zona treu una paret, `Zone.noWalls`; per decisió de l'usuari, 2026-10-21). El de dalt,
        // com el dels laterals (sense sostre, hi va un taulell al damunt).
        const innerEnd = INNER_END_ROLES.has(p.role) && Math.abs(dir[2]) < 0.1 && dir[1] < 0.9
        const wanted = innerEnd || mount === "floor" || dir[2] > 0.9 || (mount === "wall" && dir[1] > 0.9) || (mount === "hung" && dir[1] < -0.9)
        if (wanted && edgeExposed(p, side, others)) e[side] = true
      }
      this.panels[i] = { ...p, edges: e }
    }
  }

  /** El mateix per a les peces de dins (divisors i prestatges): amb fons, queden darrere del fons i no es veuen. */
  protected innerRearEdge(side: EdgeSide): EdgeSide[] {
    return this.m.carcass.back === "none" ? this.rearEdge(side) : []
  }

  /**
   * Folgança de les peces de dins (`Carcass.innerClearance`, sense = 0) dels divisors i prestatges fixos: amb l'arrel
   * dividida, tots (de qualsevol nivell, també els de l'arrel; `hasInnerPieces`); sense dividir, cap (els prestatges
   * fixos van sencers entre la caixa).
   */
  protected innerGap(): number {
    const g = this.m.carcass.innerClearance ?? 0
    return g > 0 && hasInnerPieces(this.m.root) ? g : 0
  }

  /** Una peça de només veure (rol `hardware`, sense nesting): una caixa de `min` (mòdul, mm) a `min + size`. */
  /**
   * La unió de la caixa quan no és d'espigues (el ferratge del lloc de la unió, `dowelSpec`; cel 2026-11-08: «ens falta la
   * unió del Cabineo»): Cabineo o
   * cargols repartits en [lo, hi] (`at` dona el punt de contacte, al mig del gruix de `butt`). Retorna false amb espigues
   * (les fa qui crida, com sempre).
   */
  protected joinOther(butt: Panel, through: Panel, lo: number, hi: number, at: (t: number) => Vec3, pocketDir: Vec3, shift?: Vec3): boolean {
    const { cabineo: c, screw: s } = this.hw.dowel
    if (c) cabineoJoint(butt, through, spreadAlong(lo, hi, c.margin, c.pitch, c.pocketD).map(at), pocketDir, c, shift)
    else if (s) screwJoint(butt, through, spreadAlong(lo, hi, s.margin, s.pitch, s.d).map(at), s.d, shift)
    else return false
    return true
  }

  protected hwBox(id: string, label: string, material: string, min: Vec3, size: Vec3): void {
    this.extras.push({ id, name: "ferratge", label, role: "hardware", length: r(size[0]), width: r(size[1]), thickness: r(size[2]), material, grain: "none", edges: { ...NO_EDGES }, holes: [], grooves: [], placement: placement([r(min[0]), r(min[1]), r(min[2])], X, Y, Z, Z) })
  }

  /**
   * Un cilindre de només veure (rol `hardware`): radi `R`, al llarg de Y (de `y0` a `y1`, centrat a x = `x0`, z = `z`) o
   * de X (de `x0` a `x1`, a y = `y0`). Un contorn rodó extrudit, com les peces amb forma.
   */
  protected hwRod(id: string, label: string, material: string, x0: number, x1: number, y0: number, z: number, R: number, axis: "x" | "y" | "z", y1 = y0, z1 = z): void {
    const k = 0.41421356
    const len = axis === "y" ? y1 - y0 : axis === "z" ? Math.abs(z1 - z) : Math.abs(x1 - x0)
    if (len <= 0.5) return
    const outline: [number, number, number][] = [[R, 0, k], [2 * R, R, k], [R, 2 * R, k], [0, R, k]]
    const base = { id, name: "ferratge", label, role: "hardware" as const, length: 2 * R, width: 2 * R, thickness: r(len), material, grain: "none" as const, edges: { ...NO_EDGES }, holes: [], grooves: [], outline }
    if (axis === "y") this.extras.push({ ...base, placement: placement([r(x0 - R), r(y0), r(z + R)], X, neg(Z), Y, Y) })
    else if (axis === "z") this.extras.push({ ...base, placement: placement([r(x0 - R), r(y0 - R), r(Math.min(z, z1))], X, Y, Z, Z) })
    else this.extras.push({ ...base, placement: placement([r(Math.min(x0, x1)), r(y0 - R), r(z + R)], neg(Z), Y, X, X) })
  }
}
