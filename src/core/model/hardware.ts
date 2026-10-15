import { z } from "zod"
import { tryExpr } from "./expr"
import { deepEqual } from "./photoUpgrade"
import { repairAtomically } from "./repair"
import { migratePlacePos, PlacementTargetSchema, PlacePosSchema, RepeatSchema, stepValue } from "./hardwareOps"
import { KIT_PILOT_PARAMS, kitSummary, type KitPilot } from "./hardwareKit"
import type { LightKit } from "./lightKit"
import { HARDWARE_SLOTS, HardwareItemSchema, ModuleHardwareKitSchema, isDamagedImport, isPendingImport, type HardwareItem, type HardwareSlot } from "./hardwareSchema"
import { migrateModuleHardware } from "./hardwareLibrary"

/**
 * Biblioteca de ferratges (vegeu `hardwareSchema.ts`): el model a `hardwareSchema.ts`, els paràmetres de l'editor a
 * `hardwareParams.ts` i els valors inicials i la migració a `hardwareLibrary.ts`. Aquí, el que se'n fa: resums, còpies,
 * referències als mobles desats, ferratges col·locats a mà i la prebroca dels jocs.
 */
export * from "./hardwareSchema"
export * from "./hardwareParams"
export * from "./hardwareLibrary"

/** Variables d'un item per a les seves fórmules: els paràmetres i les mides que doni qui l'aplica. */
export function hardwareVars(item: HardwareItem, extra: Record<string, number> = {}): Record<string, number> {
  return { ...item.params, ...extra }
}

/** Resum d'una línia (targeta i capçalera de l'editor): els forats que fa i on. */
/** «Ø55 × 12 · 3 W · 3000 K · cada 400 mm» (un joc de llum). */
function lightSummary(k: LightKit, p: Record<string, number>): string {
  const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
  const recess = k.recess.shape === "round" ? `Ø${n(k.recess.size)} × ${n(p.depth ?? k.recess.depth)}` : k.recess.shape === "square" ? `${n(k.recess.size)} × ${n(k.recess.size)} × ${n(p.depth ?? k.recess.depth)}` : `ranura ${n(k.recess.size)} × ${n(p.depth ?? k.recess.depth)}`
  const watts = k.bars ? `${n(k.bars[0]!.watts)} W/m` : `${n(k.watts)} W`
  return [recess, watts, k.colour, k.kind === "bar" ? "tallada a mida" : `cada ${n(p.spacing ?? 400)} mm`].join(" · ")
}

export function hardwareSummary(item: HardwareItem): string {
  const v = hardwareVars(item, { pitch: item.pitch ? stepValue(item.pitch, Infinity) : 0 })
  const n = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 100) / 100).replace(".", ",") : "?")
  const ops = item.engine === "drawerKit" && !((item.params.pilotDiameter ?? 0) > 0) ? [] : item.targets.flatMap((t) => t.ops)
  const holes = [...new Set(ops.map((o) => (o.kind === "through" ? `Ø${n(tryExpr(o.d, v))} passant` : `Ø${n(tryExpr(o.d, v))} × ${n(tryExpr(o.depth, v))}`)))]
  const p = item.params
  const extra =
    item.engine === "cup" ? `a ${n(p.cupOffset ?? NaN)} mm`
    : item.engine === "system32" ? `pas ${n(p.pitch ?? NaN)} a ${n(p.edgeOffset ?? NaN)} mm`
    : item.engine === "slide" ? `${item.lengths?.length ?? 0} llargades`
    : item.engine === "barHandle" && item.imported ? (item.pitch && item.pitch.else > 0 ? `${n(item.pitch.else)} mm` : "1 forat (pom)")
    : item.engine === "barHandle" && item.pitch ? [...item.pitch.steps.map((s) => s.n), item.pitch.else].sort((a, b) => b - a).join("/")
    : item.engine === "plate" ? `a ${n(p.setback ?? NaN)} mm del davant`
    : item.engine === "leg" ? `a ${n(p.inset ?? NaN)} mm dels cantells`
    : item.engine === "model" ? modelSummary(item, n)
    : item.engine === "drawerKit" && item.kit ? kitSummary(item.kit)
    : item.engine === "rail" ? `Ø${n(p.diameter ?? NaN)} a ${n(p.drop ?? NaN)} mm del sostre`
    : item.engine === "ledProfile" && item.light ? lightSummary(item.light, p)
    : item.engine === "ledProfile" ? `${n(p.width ?? NaN)} × ${n(p.height ?? NaN)} a ${n(p.setback ?? NaN)} mm del davant`
    : item.engine === "glassFrame" ? `perfil de ${n(p.frame ?? NaN)} mm, vidre de ${n(p.glass ?? NaN)} mm`
    : ""
  const gen = item.machining?.length ? `${item.machining.length} ${item.machining.length === 1 ? "mecanitzat" : "mecanitzats"} a mà` : ""
  const pending = isDamagedImport(item) ? "malmès" : isPendingImport(item) && (item.engine !== "model" || gen) ? "sense confirmar" : ""
  return [pending, holes.join(" · "), extra, gen].filter(Boolean).join(" · ")
}

/** «Només 3D: sense forats · 1560 × 12,5 × 6,5 mm» (la caixa del model) o, sense el STEP, «només 2D: falta el STEP». */
function modelSummary(item: HardwareItem, n: (x: number) => string): string {
  const b = item.imported?.bbox
  if (item.imported && !b) return item.machining?.length ? "sense 3D" : "només 2D: falta el STEP (el 3D)"
  const size = b ? ` · ${n(b.max[0] - b.min[0])} × ${n(b.max[1] - b.min[1])} × ${n(b.max[2] - b.min[2])} mm` : ""
  return `${item.machining?.length ? "només 3D" : "només 3D: sense forats"}${size}`
}

/** Item nou de l'usuari a partir d'un altre (mateix motor): id nou, sense marca d'inicial. */
export function copyHardwareItem(item: HardwareItem, id: string, name: string): HardwareItem {
  const { builtin: _b, ...rest } = structuredClone(item)
  return { ...rest, id, name }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

// --- Referències als mobles desats (eliminar amb substitut) ---------------------------------------------------------

/** Les fronts que poden triar un ferratge propi (`front.hardware`): frontissa, guia, braç i, a la reixeta, l'imant. */
const FRONT_SLOT: Record<string, HardwareSlot> = { door: "hinge", drawers: "slide", flap: "flap", grille: "magnet" }

/** Recorre els ferratges d'una composició desada (també d'abans: `Module.hardware` amb els números). */
function eachHardware(comp: unknown, visit: (item: HardwareItem) => HardwareItem | null): unknown {
  if (!isRecord(comp) || !Array.isArray(comp.modules)) return comp
  const zone = (z: unknown): unknown => {
    if (!isRecord(z)) return z
    let out: Record<string, unknown> = z
    const f = z.front
    if (isRecord(f) && typeof f.kind === "string" && FRONT_SLOT[f.kind]) {
      // El ferratge propi del front (frontissa, guia, braç, imant), el tirador triat (`front.handle`) i el marc de vitrina (`front.frame`).
      let front: Record<string, unknown> = f
      for (const key of ["hardware", "handle", "frame"] as const) {
        if (!isRecord(f[key])) continue
        const parsed = HardwareItemSchema.safeParse(f[key])
        const next = parsed.success ? visit(parsed.data) : null
        if (next) front = { ...front, [key]: next }
      }
      if (front !== f) out = { ...out, front }
    }
    // Accessoris del compartiment amb ferratge propi (barra, tira LED).
    for (const key of ["rail", "led"] as const) {
      const acc = z[key]
      if (!isRecord(acc) || !isRecord(acc.hardware)) continue
      const parsed = HardwareItemSchema.safeParse(acc.hardware)
      const next = parsed.success ? visit(parsed.data) : null
      if (next) out = { ...out, [key]: { ...acc, hardware: next } }
    }
    const split = z.split
    if (isRecord(split) && Array.isArray(split.children)) {
      const before = split.children as unknown[]
      const children = before.map(zone)
      if (children.some((c, i) => c !== before[i])) out = { ...out, split: { ...split, children } }
    }
    return out
  }
  let changed = false
  const modules = comp.modules.map((m) => {
    if (!isRecord(m)) return m
    let out: Record<string, unknown> = m
    const kit = ModuleHardwareKitSchema.safeParse(migrateModuleHardware(m.hardware))
    if (kit.success) {
      const next = { ...kit.data }
      let touched = false
      for (const { slot } of HARDWARE_SLOTS) {
        const cur = next[slot]
        if (!cur) continue
        const v = visit(cur)
        if (v) {
          next[slot] = v
          touched = true
        }
      }
      if (touched) out = { ...out, hardware: next }
    }
    // La pota triada a la base «Potes» (`Base.hardware`).
    const c = m.carcass
    if (isRecord(c) && isRecord(c.base) && c.base.kind === "legs" && isRecord(c.base.hardware)) {
      const parsed = HardwareItemSchema.safeParse(c.base.hardware)
      const next = parsed.success ? visit(parsed.data) : null
      if (next) out = { ...out, carcass: { ...c, base: { ...c.base, hardware: next } } }
    }
    const root = zone(m.root)
    if (root !== m.root) out = { ...out, root }
    if (out !== m) changed = true
    return out
  })
  // Ferratges col·locats a mà (`hardwarePlacements`): la còpia de cada un.
  let placements = comp.hardwarePlacements
  if (Array.isArray(placements)) {
    const before = placements as unknown[]
    const after = before.map((pl) => {
      if (!isRecord(pl) || !isRecord(pl.item)) return pl
      const parsed = HardwareItemSchema.safeParse(pl.item)
      const next = parsed.success ? visit(parsed.data) : null
      return next ? { ...pl, item: next } : pl
    })
    if (after.some((x, i) => x !== before[i])) {
      placements = after
      changed = true
    }
  }
  return changed ? { ...comp, modules, ...(placements !== comp.hardwarePlacements ? { hardwarePlacements: placements } : {}) } : comp
}

/**
 * Dues còpies fan el mateix (mateix motor, paràmetres, llargades, regles i mecanitzats): el nom, el fabricant, la
 * referència, les etiquetes i la versió no canvien cap forat. Una còpia d'un mòdul amb el mateix id que un de la
 * biblioteca però un altre contingut (un mòdul d'abans amb una cassoleta de 30) **no** és aquell item.
 */
export function sameHardware(a: HardwareItem, b: HardwareItem): boolean {
  // D'un importat només compta si està confirmat (el model, les vistes i les notes no fan forats); de la placa, els forats (ja a `targets`).
  const content = ({ id: _i, name: _n, builtin: _b, tags: _t, maker: _m, ref: _r, version: _v, imported, plate: _p, ...rest }: HardwareItem) => ({ ...rest, ...(imported ? { confirmed: imported.confirmed } : {}) })
  return deepEqual(content(a), content(b))
}

/** La còpia `copy` és de l'item `item` de la biblioteca: mateix id i mateix contingut (`sameHardware`). */
export const isCopyOf = (copy: HardwareItem, item: HardwareItem): boolean => copy.id === item.id && sameHardware(copy, item)

/**
 * Una sola paraula per a la precedència dels ferratges (auditoria C3, sense gènere): **«Com el mòdul»** = heretat (el front o
 * l'accessori fa servir la còpia del mòdul, com «Com el cos» del material del fons); **«Còpia pròpia»** = una còpia que no
 * és a la biblioteca tal qual (esborrada, d'un altre fitxer o amb un altre contingut): és la que es fabrica.
 */
export const INHERITED_LABEL = "Com el mòdul"
export const OWN_COPY_LABEL = "Còpia pròpia"

/** Camins de les seccions de l'editor que surten als avisos i a les ajudes (un sol lloc: si una secció es mou, es canvia aquí). */
export const UI_PATHS = {
  /** La caixa del mòdul: també el fons (ranura, retirada), l'estil dels fronts, les folgances i el retranqueig. */
  box: "Mòdul › Caixa",
  /** Els materials del mòdul: cos, fronts, fons i fons del calaix. */
  materials: "Mòdul › Materials",
  /** Les unions de la caixa: l'espiga. */
  joint: "Mòdul › Unió",
  /** Les portes de dalt a baix de tot el mòdul (l'Interior dividit): Cap · Una · Dues i les opcions de la porta. */
  doors: "Mòdul › Portes",
  hardwarePrefs: "Preferències › Ferratges",
  gapsPrefs: "Preferències › Folgances per defecte",
} as const

/** Una opció del selector de ferratge d'un lloc (`hardwareChoices`). */
export interface HardwareChoice {
  /** Única entre les opcions: l'id de la biblioteca, o `moble:<n>:<id>` per a una còpia que no hi és tal qual. */
  key: string
  item: HardwareItem
  label: string
  /** Còpia del moble (no és a la biblioteca o hi és amb un altre contingut). */
  own: boolean
}

/**
 * Opcions del selector de ferratge (`HardwarePick`): els de la biblioteca d'aquell motor i, a part, les còpies del moble
 * (`current`, i `inherited`, el del mòdul, als fronts) que no són a la biblioteca **tal qual** (`isCopyOf`; no n'hi ha
 * prou amb l'id): «<nom> (còpia pròpia)», per veure el que es fabrica de debò i poder-hi tornar. `value` = l'opció de
 * `current`; `inheritedKey` = la d'`inherited` (triar-la treu el propi del front).
 */
export function hardwareChoices(library: readonly HardwareItem[], current: HardwareItem, inherited?: HardwareItem): { options: HardwareChoice[]; value: string; inheritedKey?: string } {
  const options: HardwareChoice[] = library.map((x) => ({ key: x.id, item: x, label: x.name, own: false }))
  const resolve = (it: HardwareItem, label: string): string => {
    const hit = options.find((o) => isCopyOf(it, o.item))
    if (hit) return hit.key
    const key = `moble:${options.length}:${it.id}`
    options.push({ key, item: it, label, own: true })
    return key
  }
  const inheritedKey = inherited ? resolve(inherited, `${inherited.name} (${OWN_COPY_LABEL.toLowerCase()})`) : undefined
  const value = resolve(current, `${current.name} (${OWN_COPY_LABEL.toLowerCase()})`)
  // Dues còpies diferents amb el mateix nom (la del front i la del mòdul): la del mòdul es diu «com el mòdul».
  const own = options.filter((o) => o.own)
  if (inheritedKey && own.length === 2 && own[0]!.label === own[1]!.label) own.find((o) => o.key === inheritedKey)!.label = `${inherited!.name} (${INHERITED_LABEL.toLowerCase()})`
  return { options, value, ...(inheritedKey ? { inheritedKey } : {}) }
}

/**
 * Ferratges de **marc d'alumini** (vitrines): les frontisses de perfil (Metallamat A, Duomatic per a marc) i els tiradors
 * que es claven al perfil (motor `barHandle` sense cap forat). Per decisió de l'usuari («les opcions no compatibles no han
 * de sortir»): a una porta o abatible de vidre només surten aquests, i a un front de fusta, mai.
 */
const FRAME_HINGE_IDS: ReadonlySet<string> = new Set(["hinge-hafele-metallamat-a", "hinge-hafele-duomatic-premium-alu", "hinge-hafele-duomatic-alu-narrow"])
export function isFrameHardware(item: Pick<HardwareItem, "id" | "engine" | "targets">): boolean {
  if (item.engine === "cup") return FRAME_HINGE_IDS.has(item.id)
  if (item.engine === "barHandle") return item.targets.every((t) => !t.ops.length)
  return false
}

/** Ids dels ferratges que fa servir una composició desada (els dels mòduls i els triats a les portes, calaixos…). */
export function hardwareRefIds(comp: unknown): string[] {
  const ids = new Set<string>()
  eachHardware(comp, (it) => {
    ids.add(it.id)
    return null
  })
  return [...ids]
}

/** La composició porta algun ferratge importat (al kit d'un mòdul o triat en un front): el `.moble` és v2. */
export function usesImportedHardware(comp: unknown): boolean {
  let hit = false
  eachHardware(comp, (it) => {
    if (it.imported) hit = true
    return null
  })
  return hit
}

/** La composició desada porta alguna còpia de l'item `item` tal qual (`isCopyOf`): la que canviaria en eliminar-lo. */
export function usesHardware(comp: unknown, item: HardwareItem): boolean {
  let hit = false
  eachHardware(comp, (it) => {
    if (isCopyOf(it, item)) hit = true
    return null
  })
  return hit
}

/**
 * Canvia les còpies de l'item `from` d'una composició desada per una còpia de `to` (eliminar amb substitut). Només les
 * que són `from` tal qual (`isCopyOf`): una còpia amb el mateix id i un altre contingut (un mòdul d'abans, un `.moble`
 * d'un altre) és la que es fabrica i no es toca. Torna el mateix objecte si no en canvia cap.
 */
export function replaceHardwareRefs<T>(comp: T, from: HardwareItem, to: HardwareItem): T {
  return eachHardware(comp, (it) => (isCopyOf(it, from) ? structuredClone(to) : null)) as T
}

// --- Ferratges col·locats a mà (generador de mecanitzats, v22) -------------------------------------------------------

/**
 * Un ferratge col·locat a mà en una peça del moble (`Composition.hardwarePlacements`): una **còpia** de l'item (com els
 * mòduls), la peça principal i, si es tria expressament, altres peces per a la resta de grups de l'item (`targets`), on
 * va el punt de referència (`p`, `q`, **paramètrics**: des d'un cantell, del mig o a un % de la peça, més un
 * desplaçament o una fórmula amb les mides de la peça; `PlacePos`), una repetició opcional (`Repeat`: per quantitat, per
 * regla segons la mida o cada tants mm entre marges) i el mirall esquerra/dreta. Es recalcula a cada construcció: si el
 * mòdul canvia de mida, el ferratge el segueix. Les posicions d'abans «des de la referència» (`ref`) es llegeixen com
 * «des de l'inici» (`migratePlacePos`, el mateix resultat). Tot o res: si una
 * operació no cap a la peça, cap forat d'aquest ferratge (`core/build/hardwarePlace.ts`).
 */
export const HardwarePlacementSchema = repairAtomically(
  z.object({
    id: z.string().min(1),
    item: HardwareItemSchema,
    targets: z.array(PlacementTargetSchema).min(1),
    /** Posició del punt de referència per eix (paramètrica: segueix la peça quan el moble canvia de mida). */
    p: z.preprocess(migratePlacePos, PlacePosSchema),
    q: z.preprocess(migratePlacePos, PlacePosSchema),
    repeat: RepeatSchema.optional(),
    /**
     * **Mirall esquerra/dreta**: també la còpia simètrica respecte del mig del moble en X (al lateral de l'altre costat, o
     * a la mateixa peça amb la posició reflectida si la peça és de costat a costat). Tot o res amb l'original.
     */
    mirror: z.boolean().optional(),
    /** Gir del model 3D al pla de la peça (graus, al voltant de la normal de la cara): només el 3D, no els mecanitzats. */
    turn: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  }),
)
export type HardwarePlacement = z.infer<typeof HardwarePlacementSchema>

/** La composició porta algun ferratge col·locat a mà (el `.moble` és v3: una app d'abans els trauria en silenci). */
export function usesHardwarePlacements(comp: unknown): boolean {
  return isRecord(comp) && Array.isArray(comp.hardwarePlacements) && comp.hardwarePlacements.length > 0
}

/**
 * Es pot col·locar a mà: només els **«només 3D»** (`model`: sense cap lloc al moble; amb els mecanitzats del generador
 * o sense). Els d'un lloc (frontissa, placa, tirador…) els posen les regles del mòdul: no es col·loquen a mà (els
 * col·locats d'abans d'un d'aquests es continuen llegint i fabricant, `hardwarePlace.ts`).
 */
export const isPlaceable = (item: HardwareItem): boolean => item.engine === "model"

// --- Prebroca dels cargols (regla del taller) -----------------------------------------------------------------------

/**
 * La prebroca que fan els jocs de la biblioteca (la del primer joc; cap joc → la inicial): per llegir unes preferències
 * d'abans que no tenien la regla `Settings.kitPilot`. La font és `Settings.kitPilot`.
 */
export function kitPilotFromLibrary(library: readonly HardwareItem[]): KitPilot {
  const kit = library.find((x) => x.engine === "drawerKit")
  if (!kit) return { enabled: true, ...KIT_PILOT_PARAMS_PLAIN }
  const d = kit.params.pilotDiameter ?? 0
  return { enabled: d > 0, diameter: d > 0 ? d : (kit.params.pilotOffDiameter ?? KIT_PILOT_PARAMS_PLAIN.diameter), depth: kit.params.pilotDepth ?? KIT_PILOT_PARAMS_PLAIN.depth }
}
const KIT_PILOT_PARAMS_PLAIN = { diameter: KIT_PILOT_PARAMS.pilotDiameter, depth: KIT_PILOT_PARAMS.pilotDepth }

/**
 * Regla del taller «prebroca dels cargols: Ø2 × 10» (Preferències › Ferratges) aplicada a tots els jocs de la biblioteca:
 * cada joc porta la prebroca als seus `params` (les còpies dels mobles fets no canvien). Apagada, Ø 0 (cap forat) i el Ø
 * es recorda a `pilotOffDiameter` per tornar-hi. Els ferratges de l'app de sempre ja foraden cada cargol (guia Ø5 / Ø4,
 * placa i System 32 Ø5, espigues, imants, braços): no hi ha res més a prebrocar.
 */
export function setKitPilot(library: readonly HardwareItem[], pilot: KitPilot): HardwareItem[] {
  return library.map((x) => {
    if (x.engine !== "drawerKit") return x
    const { pilotOffDiameter: _o, ...rest } = x.params
    const params = pilot.enabled ? { ...rest, pilotDiameter: pilot.diameter, pilotDepth: pilot.depth } : { ...rest, pilotDiameter: 0, pilotDepth: pilot.depth, pilotOffDiameter: pilot.diameter }
    return deepEqual(params, x.params) ? x : { ...x, params }
  })
}
