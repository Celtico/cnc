import { z } from "zod"
import { evalExpr, type Expr } from "./expr"
import { fmtNum } from "../../lib/format"

/**
 * **Joc de ferratges paramètric** (`HardwareKit`, `docs/ferratges-jocs.md`): un sistema sencer del fabricant (el primer,
 * el calaix de doble paret DTC MAGIC-PRO) llegit del **catàleg en PDF**, no d'un STEP: components amb els números
 * d'article, opcions (tancament, darrere), regles de tria (la llargada nominal NL per la fondària del moble, l'estabilitzador
 * i la barra de sincronització per l'amplada KB), les **peces de fusta que demana** (fons A i darrere B, amb fórmules sobre
 * LW/NL/KB/G) i els **mecanitzats** que fa a les peces del moble (prebroques Ø2 × 10 dels cargols de la guia al lateral,
 * dels suports al front i al darrere). Adaptació paramètrica doble: el joc s'adapta al moble (NL, barra) i la fusta
 * s'adapta al joc (mides del fons i del darrere; **sense laterals de fusta**).
 *
 * El joc viu dins d'un `HardwareItem` amb motor `drawerKit` (`HardwareItem.kit`): així entra a la biblioteca, al selector
 * (`HardwareSelect`), a les còpies dels mobles i al `.moble` sense cap camí nou. Pur: sense React ni three.
 *
 * **Coordenades del joc** (mm): `x` des de la cara interior del lateral del moble cap a dins (el costat dret és el mirall),
 * `y` amunt des de la **vora inferior de la guia** (la referència del catàleg), `z` des de la cara de darrere del front cap
 * al fons del moble. Les fórmules (`Expr`, `evalExpr`, sense `eval`) poden fer servir: `LW` llum interior, `NL` llargada
 * nominal, `KB` amplada del moble (LW + 2 × 16, com al catàleg), `G` gruix del tauler del cos, `TB` gruix del fons del
 * calaix, `H` alçada del lateral del calaix, `BH` alçada del darrere de fusta.
 */

const mm = z.number().finite()
const KitExpr = z.union([mm, z.string().min(1).max(200)])

export const KIT_CLOSINGS = [
  { id: "soft", label: "Tancament suau", short: "Suau" },
  { id: "push", label: "Push-open", short: "Push" },
  { id: "pushSoft", label: "Push-open + tancament suau", short: "Push + suau" },
] as const
export type KitClosing = (typeof KIT_CLOSINGS)[number]["id"]
/** El tancament obre per pressió: el calaix no porta tirador (push-open; una sola font amb el «Tirador» del front). */
export const isPushClosing = (c: KitClosing): boolean => c === "push" || c === "pushSoft"
const CLOSING_IDS = KIT_CLOSINGS.map((c) => c.id) as [KitClosing, ...KitClosing[]]

export const KIT_BACKS = [
  { id: "wood", label: "Darrere de fusta", short: "Fusta" },
  { id: "metal", label: "Darrere metàl·lic", short: "Metàl·lic" },
] as const
type KitBack = (typeof KIT_BACKS)[number]["id"]
const BACK_IDS = KIT_BACKS.map((b) => b.id) as [KitBack, ...KitBack[]]

/**
 * Acabats (color) dels laterals de doble paret que es venen: el nom és el d'un material del 3D (`resolveFinish`: si no
 * és a Materials, el color surt de la paraula clau «blanc» / «gris» / «negre»). Només canvia el color al visor; els números
 * d'article del catàleg són els mateixos.
 */
export const KIT_FINISHES = [
  { id: "white", label: "Blanc seda", short: "Blanc", material: "Blanc seda" },
  { id: "grey", label: "Gris mat", short: "Gris", material: "Gris mat" },
  { id: "black", label: "Negre mat", short: "Negre", material: "Negre mat" },
] as const
export type KitFinish = (typeof KIT_FINISHES)[number]["id"]
const FINISH_IDS = KIT_FINISHES.map((f) => f.id) as [KitFinish, ...KitFinish[]]
export const kitFinishMaterial = (f: KitFinish): string => KIT_FINISHES.find((x) => x.id === f)!.material

/** Opcions triades a un calaix (`Front.kit`); sense, les primeres del joc. */
export const KitOptionsSchema = z.object({ closing: z.enum(CLOSING_IDS), back: z.enum(BACK_IDS), finish: z.enum(FINISH_IDS).optional() })
export type KitOptions = z.infer<typeof KitOptionsSchema>

/** Una llargada nominal del joc: números d'article i on van els cargols de la guia. */
export const KitVariantSchema = z.object({
  nl: mm.positive(),
  /** Número del joc complet (paquet) per tancament; sense, aquell tancament no es ven en aquesta NL. */
  kit: z.partialRecord(z.enum(CLOSING_IDS), z.string()),
  /** Números industrials: guies (per tancament) i joc de laterals del calaix. */
  slides: z.partialRecord(z.enum(CLOSING_IDS), z.string()),
  sideKit: z.string().optional(),
  /**
   * Columnes de cargols de la guia al lateral del moble, en `z` des del cantell de davant del lateral: `both` a les dues
   * fileres (davant i darrere), `top` només a la de dalt (les del mig). Vegeu `machining.side.rows`.
   */
  screws: z.object({ both: z.array(mm), top: z.array(mm) }),
})
export type KitVariant = z.infer<typeof KitVariantSchema>

/**
 * Una forma pot anar muntada en un altre lloc que el seu component (`mount`: una guia telescòpica és un sol article amb
 * el cos fix al moble i la corredora que surt amb el calaix) i tenir el seu material del 3D (`material`).
 */
const ShapeExtras = { mount: z.enum(["drawer", "cabinet"]).optional(), material: z.string().optional() }

/** Forma senzilla d'un component en coordenades del joc (sense GLB): caixa o cilindre. */
export const KitShapeSchema = z.discriminatedUnion("kind", [
  /** Caixa: cantonada mínima (x, y, z) i mides (w cap a dins, h amunt, d cap al fons). */
  z.object({ kind: z.literal("box"), x: KitExpr, y: KitExpr, z: KitExpr, w: KitExpr, h: KitExpr, d: KitExpr, ...ShapeExtras }),
  /** Cilindre al llarg de X (barra): inici x, centre (y, z), llargada i Ø. */
  z.object({ kind: z.literal("rod"), x: KitExpr, y: KitExpr, z: KitExpr, len: KitExpr, diameter: KitExpr, ...ShapeExtras }),
])
export type KitShape = z.infer<typeof KitShapeSchema>

/** D'on surt el número d'article d'un component. */
export const KitItemRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), item: z.string() }),
  /** El de la variant (NL): guies o joc de laterals. */
  z.object({ kind: z.literal("variant"), field: z.enum(["slides", "sideKit"]) }),
  /** Per amplada del moble: prefix + KB de la taula (la fila igual o la següent). */
  z.object({ kind: z.literal("byWidth"), prefix: z.string(), widths: z.array(mm.positive()).min(1) }),
  /** Sense número al catàleg (es demana al distribuïdor). */
  z.object({ kind: z.literal("none") }),
])
export type KitItemRef = z.infer<typeof KitItemRefSchema>

/** Quan hi va un component: segons les opcions triades i les regles d'amplada. */
export const KitWhenSchema = z.object({
  closing: z.array(z.enum(CLOSING_IDS)).optional(),
  back: z.array(z.enum(BACK_IDS)).optional(),
  /** Només si la regla d'amplada el recomana (nivell ≥ 1). */
  rule: z.enum(["stabilizer", "syncRod"]).optional(),
})
export type KitWhen = z.infer<typeof KitWhenSchema>

export const KitComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** A quin costat va: a cada lateral (`both`: es fa el mirall), o un de sol al mig. */
  side: z.enum(["both", "left", "right", "center"]),
  /** On va cargolat: al `drawer` (surt amb el calaix en obrir-lo) o al `cabinet` (la guia: fixa al lateral del moble). */
  mount: z.enum(["drawer", "cabinet"]).default("drawer"),
  /** Quants per calaix (per costat si `both`). */
  qty: z.number().int().positive(),
  item: KitItemRefSchema,
  when: KitWhenSchema.optional(),
  /** Llargada de tall (barres que es compren llargues), en mm. */
  cutLength: KitExpr.optional(),
  shapes: z.array(KitShapeSchema),
  /** Material del 3D (nom de Materials; sense, acer). */
  material: z.string().optional(),
  /** Pren l'acabat (color) triat al calaix (`KitOptions.finish`): els laterals de doble paret. */
  finish: z.boolean().optional(),
  note: z.string().optional(),
})
export type KitComponent = z.infer<typeof KitComponentSchema>

/** Peça de fusta que demana el joc (el fons A, el darrere B): mides per fórmula. */
const KitWoodPartSchema = z.object({
  key: z.enum(["bottom", "back"]),
  name: z.string().min(1),
  /** Amplada (de costat, X) i fondària (Z) o alçada (Y) segons la peça. */
  width: KitExpr,
  depth: KitExpr.optional(),
  height: KitExpr.optional(),
  /** Gruix: el del fons del calaix (`TB`) o el del tauler del cos (`G`). */
  thickness: z.enum(["bottom", "board"]),
  when: KitWhenSchema.optional(),
  /** Nota del catàleg (tolerància, «+1 / −0»). */
  note: z.string().optional(),
})

/** Nivell de recomanació del catàleg: − no · ○ recomanat · ● molt recomanat. */
export const KitLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)])
export type KitLevel = z.infer<typeof KitLevelSchema>
export const KIT_LEVEL_LABEL: Record<KitLevel, string> = { 0: "no cal", 1: "recomanat", 2: "molt recomanat" }

export const HardwareKitSchema = z.object({
  maker: z.string().min(1),
  series: z.string().min(1),
  family: z.literal("double-wall-drawer"),
  /** Classe d'alçada del catàleg (N · M · K · C · F) i les seves mides. */
  heightClass: z.object({ code: z.string().min(1), boxSideHeight: mm.positive(), backHeight: mm.positive() }),
  variants: z.array(KitVariantSchema).min(1),
  options: z.object({ closing: z.array(z.enum(CLOSING_IDS)).min(1), back: z.array(z.enum(BACK_IDS)).min(1), finish: z.array(z.enum(FINISH_IDS)).min(1).optional() }),
  rules: z.object({
    /** Fondària interior mínima: LT = NL + depthMargin. */
    depthMargin: mm.min(0),
    /** La guia comença aquí darrere del cantell de davant del lateral (3 mm). */
    slideSetback: mm.min(0),
    /** La vora inferior de la guia, per sobre del cantell de baix del front del calaix. */
    baseAboveFront: mm.min(0),
    /** Taula d'amplades KB → estabilitzador i barra de sincronització (la fila igual o la següent). */
    widths: z.array(z.object({ upTo: mm.positive(), stabilizer: KitLevelSchema, syncRod: KitLevelSchema })).min(1),
    /** Llargada de tall de la barra de sincronització per tancament (fórmula amb LW). */
    syncRodCut: z.partialRecord(z.enum(CLOSING_IDS), KitExpr),
    /** El darrere metàl·lic és per a laterals d'aquest gruix (amb un altre, cal un darrere a mida). */
    metalBackSideThickness: mm.positive().optional(),
  }),
  /** Mides del muntatge (coordenades del joc): on comença el lateral del calaix i el fons. */
  geometry: z.object({
    /** Cantell de baix del lateral del calaix per sobre de la vora inferior de la guia. */
    sideBase: mm,
    /** Gruix del lateral de doble paret. */
    sideThickness: mm.positive(),
    /** Cara de sota del fons del calaix per sobre de la vora inferior de la guia. */
    bottomBase: mm,
    /** Guia: alçada i gruix (cap a dins). */
    slideHeight: mm.positive(),
    slideThickness: mm.positive(),
  }),
  components: z.array(KitComponentSchema),
  wood: z.array(KitWoodPartSchema),
  machining: z.object({
    /** Lateral del moble: fileres de cargols de la guia (y des de la vora inferior de la guia), a les columnes de la variant. */
    side: z.object({ rows: z.array(mm).min(1) }),
    /** Front: forats dels suports de davant, a `x` de la cara interior del lateral del moble i a les alçades `ys` (y del joc). */
    front: z.object({ x: mm, ys: z.array(mm).min(1), minFromBottom: mm.min(0) }),
    /** Darrere de fusta: cargols dels suports de darrere, a `xFromEdge` de cada cantell i a `ys` des del cantell de baix, a la cara de darrere. */
    back: z.object({ xFromEdge: mm, ys: z.array(mm).min(1) }).optional(),
  }),
  /** Pàgines del catàleg d'on surt (per citar-les). */
  source: z.string().optional(),
  /** Foto del producte (camí dins de `public/`), retallada del catàleg. */
  photo: z.string().optional(),
  /** Hipòtesis de lectura del catàleg pendents de confirmar amb el taller. */
  hypotheses: z.array(z.string()).optional(),
})
export type HardwareKit = z.infer<typeof HardwareKitSchema>

/** Paràmetres de l'item d'un joc (`HardwareItem.params`): la prebroca dels cargols (0 = sense). */
export const KIT_PILOT_PARAMS = { pilotDiameter: 2, pilotDepth: 10 } as const

/** Regla del taller «prebroca dels cargols» (Preferències › Ferratges): activada, Ø i fondària. */
export const KitPilotSchema = z.object({ enabled: z.boolean(), diameter: z.number().finite().min(0.5).max(10), depth: z.number().finite().min(1).max(50) })
export type KitPilot = z.infer<typeof KitPilotSchema>
export const DEFAULT_KIT_PILOT: KitPilot = { enabled: true, diameter: KIT_PILOT_PARAMS.pilotDiameter, depth: KIT_PILOT_PARAMS.pilotDepth }

/**
 * **Una sola font** per a la prebroca (auditoria C6): la regla és `Settings.kitPilot`; els jocs de la biblioteca en
 * copien els números (`setKitPilot`) i les còpies dels mòduls la **segueixen en construir** (`planKit` llegeix la regla
 * vigent, com el moble s'adapta a la màquina i als materials de qui l'obre: és una regla del taller, no una dada del
 * moble). La posen les preferències en carregar-se (`setKitPilotRule`, `db/settingsStore.ts`); sense (tests, Node), els
 * `params` de cada còpia.
 */
let PILOT_RULE: KitPilot | null = null
export function setKitPilotRule(rule: KitPilot | null): void {
  PILOT_RULE = rule
}
export const kitPilotRule = (): KitPilot | null => PILOT_RULE

/** Variables de les fórmules d'un joc. */
interface KitVars {
  LW: number
  NL: number
  KB: number
  G: number
  TB: number
  H: number
  BH: number
}

export const kitVars = (kit: HardwareKit, v: Omit<KitVars, "H" | "BH">): Record<string, number> => ({ ...v, H: kit.heightClass.boxSideHeight, BH: kit.heightClass.backHeight })

export const evalKit = (e: Expr, vars: Record<string, number>): number => Math.round(evalExpr(e, vars) * 100) / 100

/** Les opcions d'un calaix, completes (les primeres del joc si en falta alguna o no s'hi venen). */
export function kitOptionsOf(kit: HardwareKit, o?: Partial<KitOptions>): KitOptions {
  const closing = o?.closing && kit.options.closing.includes(o.closing) ? o.closing : kit.options.closing[0]!
  const back = o?.back && kit.options.back.includes(o.back) ? o.back : kit.options.back[0]!
  // L'acabat només si el joc en ven més d'un (si no, el camp no surt i no compta: «res amagat compta»).
  const finishes = kit.options.finish ?? []
  const finish = finishes.length > 1 ? (o?.finish && finishes.includes(o.finish) ? o.finish : finishes[0]!) : undefined
  return { closing, back, ...(finish ? { finish } : {}) }
}

/**
 * La llargada nominal: la més gran amb NL + marge ≤ fondària disponible darrere del front, i que es vengui amb el
 * tancament triat. `null` si cap hi cap.
 */
export function chooseVariant(kit: HardwareKit, depth: number, closing: KitClosing): KitVariant | null {
  const fits = kit.variants.filter((v) => v.nl + kit.rules.depthMargin <= depth && v.kit[closing])
  return fits.sort((a, b) => b.nl - a.nl)[0] ?? null
}

/** La fila de la taula d'amplades per a KB (la igual o la següent); `null` si KB passa de la taula. */
export function widthRule(kit: HardwareKit, kb: number): { stabilizer: KitLevel; syncRod: KitLevel } | null {
  const rows = [...kit.rules.widths].sort((a, b) => a.upTo - b.upTo)
  return rows.find((row) => kb <= row.upTo + 1e-6) ?? null
}

/** Si un component o una peça hi va amb aquestes opcions i regles. */
export function kitApplies(when: KitWhen | undefined, o: KitOptions, rule: { stabilizer: KitLevel; syncRod: KitLevel } | null): boolean {
  if (!when) return true
  if (when.closing && !when.closing.includes(o.closing)) return false
  if (when.back && !when.back.includes(o.back)) return false
  if (when.rule) return !!rule && rule[when.rule] >= 1
  return true
}

/** El número d'article d'un component en una variant i una amplada. */
export function kitItemNumber(ref: KitItemRef, variant: KitVariant, closing: KitClosing, kb: number): string | undefined {
  switch (ref.kind) {
    case "fixed":
      return ref.item
    case "variant":
      return ref.field === "slides" ? variant.slides[closing] : variant.sideKit
    case "byWidth": {
      const w = [...ref.widths].sort((a, b) => a - b).find((x) => kb <= x + 1e-6)
      return w === undefined ? undefined : `${ref.prefix}${w}`
    }
    case "none":
      return undefined
  }
}

/** Resum d'una línia del joc per a la targeta: «M · 88 · NL 270–600 · 3 tancaments». */
export function kitSummary(kit: HardwareKit): string {
  const nls = kit.variants.map((v) => v.nl).sort((a, b) => a - b)
  const closings = kit.options.closing.length
  return `${kit.heightClass.code} · lateral ${fmtNum(kit.heightClass.boxSideHeight)} · NL ${nls[0]}–${nls.at(-1)} · ${closings} ${closings === 1 ? "tancament" : "tancaments"} · darrere ${kit.options.back.map((b) => KIT_BACKS.find((x) => x.id === b)!.short.toLowerCase()).join(" o ")}`
}
