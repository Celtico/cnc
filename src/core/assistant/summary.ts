import { buildComposition, type CompositionBuild, type CompositionWarning } from "../build/buildComposition"
import { materialIssues } from "../build/materialIssues"
import {
  backChoices,
  boardChoices,
  canHoldFront,
  canHoldShelves,
  compositionKind,
  coveringZone,
  FRONT_KINDS,
  mountOf,
  splitDirsFor,
  visibleModule,
  zoneBoundsMap,
  type Composition,
  type Front,
  type Module,
  type Settings,
  type Zone,
} from "../model"

/**
 * Resum compacte del moble per a l'assistent IA (`get_moble` i el resultat de cada eina): el que cal per decidir i
 * referir-se a les coses (ids), en mm, sense les dades que no fan falta (ferratges sencers, forats). Pur.
 */

export interface ZoneSummary {
  id: string
  /** Llum (mm) del compartiment tal com es construeix: amplada × alçada. */
  w?: number
  h?: number
  split?: { dir: "v" | "h"; sizes: (number | "auto")[]; children: ZoneSummary[] }
  front?: Record<string, unknown>
  shelves?: { n: number; adjustable: boolean }
  /** Barra i llum: el nom del ferratge (el del compartiment o, «Com el mòdul», el del mòdul). */
  rail?: string
  led?: string
  /** Tapat per les portes de tot el mòdul: el seu front no es fa. */
  covered?: true
  /** Què hi pot anar (les mateixes regles que la UI, `zoneSupport.ts`). */
  can?: { fronts: string[]; shelves: boolean; split: ("v" | "h")[] }
}

export interface ModuleSummary {
  id: string
  name: string
  /** wall = arrambat a la paret (a terra), hung = penjat, floor = lliure al terra. */
  mount: "wall" | "hung" | "floor"
  /** Cantonada baix-esquerra-darrere a la composició (mm). */
  at?: { x: number; y: number; z: number }
  width: number
  height: number
  depth: number
  carcass: Record<string, unknown>
  /** Portes de tot el mòdul (Mòdul › Portes): el front de l'«Interior» dividit. */
  module_doors?: Record<string, unknown>
  interior: ZoneSummary
}

export interface WarningSummary {
  module?: string
  zone?: string
  code: string
  message: string
}

export interface MobleSummary {
  kind: string
  units: "mm"
  modules: ModuleSummary[]
  free_parts?: number
  reference_objects?: number
  warnings: WarningSummary[]
}

export interface CatalogSummary {
  /** Materials per al cos, els fronts i el taulell (taulers de CNC). */
  board_materials: { name: string; thicknesses: number[] }[]
  /** Materials per al fons (taulers i fons). */
  back_materials: { name: string; thicknesses: number[] }[]
  /** Jocs de calaix paramètrics de la biblioteca (`set_front` › drawers.kit). */
  drawer_kits: { id: string; name: string }[]
  defaults: { material: string; thickness: number; back_material: string; back_thickness: number }
}

const r1 = (v: number) => Math.round(v * 10) / 10

function frontSummary(f: Front): Record<string, unknown> {
  const handle = "handle" in f && f.handle === "none" ? { handle: "none (push)" } : {}
  switch (f.kind) {
    case "door":
      return { kind: "door", mode: f.mode, hinge: f.hinge, ...(f.glass ? { glass: true } : {}), ...handle }
    case "drawers":
      return { kind: "drawers", n: f.n, heights: f.heights.slice(0, f.n), ...(f.hardware?.engine === "drawerKit" ? { kit: f.hardware.name } : {}), ...handle }
    case "flap":
      return { kind: "flap", dir: f.dir, ...handle }
    case "grille":
      return { kind: "grille", mount: f.mount, pattern: f.pattern.kind }
    case "panel":
      return { kind: "panel" }
  }
}

function carcassSummary(m: Module): Record<string, unknown> {
  const c = m.carcass
  const { hardware: _hw, ...base } = c.base as typeof c.base & { hardware?: unknown }
  void _hw
  return {
    base,
    back: c.back,
    top: c.top.kind === "ventSlot" ? { kind: "ventSlot", gap: c.top.gap } : c.top.kind,
    sides: c.sides,
    ...(c.joint === "mitre" ? { joint: "mitre" } : {}),
    ...(c.hollow ? { hollow_walls: c.hollow.thickness } : {}),
    ...(c.tableTop ? { table_top_overhang: c.tableTop.overhang } : {}),
    thickness: c.thickness,
    material: c.material,
    ...(c.frontMaterial ? { front_material: c.frontMaterial } : {}),
    ...(c.back !== "none" ? { back_material: c.backMaterial, back_thickness: c.backThickness } : {}),
    front_style: m.fronts.style ?? "overlay",
  }
}

function zoneSummary(m: Module, z: Zone, rects: Map<string, { x0: number; x1: number; y0: number; y1: number }> | undefined, isRoot: boolean): ZoneSummary {
  const bounds = zoneBoundsMap(m)
  const visibleRoot = visibleModule(m).root
  const walk = (zone: Zone, root: boolean): ZoneSummary => {
    const rect = rects?.get(zone.id)
    const b = bounds.get(zone.id)
    const out: ZoneSummary = { id: zone.id, ...(rect ? { w: r1(rect.x1 - rect.x0), h: r1(rect.y1 - rect.y0) } : {}) }
    if (zone.split) {
      out.split = { dir: zone.split.dir, sizes: zone.split.children.map((_, i) => zone.split!.sizes[i] ?? "auto"), children: zone.split.children.map((c) => walk(c, false)) }
      // El front de l'arrel dividida (portes de tot el mòdul) va a `module_doors`.
      if (b) out.can = { fronts: root ? ["none", ...(canHoldFront(b, "door") ? ["door"] : [])] : [], shelves: false, split: [] }
      return out
    }
    if (zone.front) out.front = frontSummary(zone.front)
    if (zone.shelves && zone.shelves.n > 0) out.shelves = { n: zone.shelves.n, adjustable: zone.shelves.adjustable }
    const acc = (own: { hardware?: { name: string } } | undefined, inherited: { name: string } | undefined) => (own?.hardware ? own.hardware.name : `com el mòdul${inherited ? `: ${inherited.name}` : ""}`)
    if (zone.rail) out.rail = acc(zone.rail, m.hardware?.rail)
    if (zone.led) out.led = acc(zone.led, m.hardware?.led)
    if (!root && coveringZone(visibleRoot, zone.id)) out.covered = true
    if (b) {
      const fills = zone.front?.kind === "drawers" || zone.front?.kind === "panel"
      out.can = { fronts: ["none", ...FRONT_KINDS.filter((k) => canHoldFront(b, k))], shelves: canHoldShelves(b) && !fills, split: splitDirsFor(b) }
    }
    return out
  }
  return walk(z, isRoot)
}

/** Tots els avisos (els del build i els de materials), en l'ordre en què es resumeixen. */
export function allWarnings(comp: Composition, build: CompositionBuild, settings: Pick<Settings, "materials">): CompositionWarning[] {
  return [...build.warnings, ...materialIssues(build, comp, settings.materials)]
}

/** Clau d'un avís per comparar abans i després d'un canvi (pel mòdul, no pel nom: canviar el nom no el fa nou). */
export const warningKey = (w: CompositionWarning) => `${w.moduleId ?? ""}|${w.zoneId ?? ""}|${w.code}|${w.message}`

/** Avisos de fusteria (els del build i els de materials, `materialIssues`), amb el nom del mòdul. */
export function summarizeWarnings(comp: Composition, build: CompositionBuild, settings: Pick<Settings, "materials">): WarningSummary[] {
  return allWarnings(comp, build, settings).map((w) => ({
    ...(w.moduleId ? { module: comp.modules.find((m) => m.id === w.moduleId)?.name ?? w.moduleId } : {}),
    ...(w.zoneId ? { zone: w.zoneId } : {}),
    code: w.code,
    message: w.message,
  }))
}

export function summarizeMoble(comp: Composition, settings: Pick<Settings, "materials">, build: CompositionBuild = buildComposition(comp)): MobleSummary {
  const modules = comp.modules.map((m, i): ModuleSummary => {
    const mb = build.modules[i]
    const rects = mb?.build.layout.rects
    const rootDoor = m.root.split && m.root.front?.kind === "door" ? frontSummary(m.root.front) : undefined
    return {
      id: m.id,
      name: m.name,
      mount: mountOf(m),
      ...(mb ? { at: { x: r1(mb.x), y: r1(mb.y), z: r1(mb.z) } } : {}),
      width: m.carcass.width,
      height: m.carcass.height,
      depth: m.carcass.depth,
      carcass: carcassSummary(m),
      ...(rootDoor ? { module_doors: rootDoor } : {}),
      interior: zoneSummary(m, m.root, rects, true),
    }
  })
  return {
    kind: compositionKind(comp),
    units: "mm",
    modules,
    ...(comp.parts?.length ? { free_parts: comp.parts.length } : {}),
    ...(comp.references.length ? { reference_objects: comp.references.length } : {}),
    warnings: summarizeWarnings(comp, build, settings),
  }
}

/** El que es pot triar (materials de Preferències, jocs de calaix): només a `get_moble`. */
export function summarizeCatalog(settings: Pick<Settings, "materials" | "hardwareLibrary" | "defaults">): CatalogSummary {
  return {
    board_materials: boardChoices(settings.materials).map((m) => ({ name: m.name, thicknesses: m.thicknesses })),
    back_materials: backChoices(settings.materials).map((m) => ({ name: m.name, thicknesses: m.thicknesses })),
    drawer_kits: settings.hardwareLibrary.filter((x) => x.engine === "drawerKit").map((x) => ({ id: x.id, name: x.name })),
    defaults: { material: settings.defaults.material, thickness: settings.defaults.thickness, back_material: settings.defaults.backMaterial, back_thickness: settings.defaults.backThickness },
  }
}
