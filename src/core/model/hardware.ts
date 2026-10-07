import { z } from "zod"
import { DEFAULT_CABINET } from "./cabinet"
import { tryExpr } from "./expr"
import { deepEqual } from "./photoUpgrade"
import { repairAtomically, repairValue } from "./repair"
import { MachiningListSchema, migratePlacePos, PlacementTargetSchema, PlacePosSchema, RepeatSchema, stepValue, StepRuleSchema, type StepRule } from "./hardwareOps"
import { HardwareKitSchema, KIT_PILOT_PARAMS, kitSummary, type HardwareKit } from "./hardwareKit"
import { DTC_MAGIC_PRO_KITS } from "./kits/dtcMagicPro"

/**
 * Biblioteca de ferratges (millores v1, `docs/millores-v1/ferratges.md` §4): cada ferratge és **dades** (`HardwareItem`:
 * paràmetres, mecanitzats paramètrics en coordenades de peça, regla de quantitat) i el codi només porta el **motor**
 * (`core/build/hardware.ts`) i els valors inicials. Les preferències en guarden la biblioteca i quin fa servir cada lloc
 * per defecte (`hardwareDefaults`); cada mòdul en guarda una **còpia** (`Module.hardware`, un `ModuleHardware`), com abans
 * guardava els números: el moble és reproduïble encara que la biblioteca canviï. Una porta, un calaix o un abatible poden
 * triar-ne un altre de la biblioteca (`front.hardware`, també una còpia).
 */

const mm = z.number().finite()

/** Número o fórmula curta (`"cupOffset"`, `"-pitch/2"`); l'avalua `evalExpr` (sense `eval`). */
export const ExprSchema = z.union([mm, z.string().min(1).max(200)])

// --- Ferratges d'abans (preferències ≤ v18 i mòduls desats abans) -------------------------------------------------

/** Els números dels ferratges d'abans (`Settings.hardware` fins a la v18, `Module.hardware` dels mòduls d'abans). */
export const LegacyHardwareSchema = z.object({
  hinge: z.object({ cupDiameter: mm.positive(), cupDepth: mm.positive(), cupOffset: mm.positive() }),
  system32: z.object({ edgeOffset: mm.positive(), pitch: mm.positive(), diameter: mm.positive(), depth: mm.positive() }),
  dowel: z.object({ diameter: mm.positive(), faceDepth: mm.positive(), edgeDepth: mm.positive(), endOffset: mm.positive() }),
  drawer: z.object({
    /** Llargades de guia disponibles (mm). */
    slideLengths: z.array(mm.positive()).min(1),
    /** Joc lateral per costat entre caixa i lateral del moble (guia de boles: 12,5). */
    sideClearance: mm.min(0),
    /** Gruix dels laterals i el darrere de la caixa. */
    boxThickness: mm.positive(),
    /** Gruix del fons de la caixa (en ranura). */
    bottomThickness: mm.positive(),
    /** Alçada del front menys alçada de la caixa. */
    boxDrop: mm.min(0),
    /** Distància del fons del calaix a la vora inferior de la caixa (ranura). */
    bottomOffset: mm.min(0),
    /** Joc de la caixa amb el fons del moble. */
    backClearance: mm.min(0),
  }),
  magnet: z.object({ diameter: mm.positive(), depth: mm.positive(), cornerOffset: mm.positive() }),
})
export type LegacyHardware = z.infer<typeof LegacyHardwareSchema>

export const DEFAULT_LEGACY_HARDWARE: LegacyHardware = {
  hinge: DEFAULT_CABINET.hinge,
  system32: DEFAULT_CABINET.system32,
  dowel: DEFAULT_CABINET.dowel,
  drawer: {
    slideLengths: [250, 300, 350, 400, 450, 500, 550],
    sideClearance: 12.5,
    boxThickness: 16,
    bottomThickness: 10,
    boxDrop: 30,
    bottomOffset: 12,
    backClearance: 10,
  },
  magnet: { diameter: 10, depth: 5, cornerOffset: 60 },
}

// --- Model ---------------------------------------------------------------------------------------------------------

/** Categories (llista tancada, com `MATERIAL_CATEGORIES`): agrupen la graella de Preferències › Ferratges. */
export const HARDWARE_CATEGORIES = [
  { id: "hinge", label: "Frontisses", hint: "Cassoletes de les portes (i de les reixetes amb frontisses)." },
  { id: "plate", label: "Plaques de frontissa", hint: "Plaques al lateral, a la filera System 32." },
  { id: "slide", label: "Guies", hint: "Guies dels calaixos: forats al lateral del moble i a la caixa." },
  { id: "drawer-system", label: "Calaixos de doble paret", hint: "Jocs paramètrics del fabricant (guies + laterals metàl·lics + suports): el calaix no porta laterals de fusta; el fons i el darrere surten de les fórmules del catàleg." },
  { id: "lift", label: "Elevables i abatibles", hint: "Braços i frontisses dels abatibles." },
  { id: "connector", label: "Unions", hint: "Espigues i altres unions entre dues peces." },
  { id: "shelf-support", label: "Suports de prestatge", hint: "La filera System 32 dels laterals (prestatges regulables i plaques)." },
  { id: "leg", label: "Potes i sòcols", hint: "Potes del moble (forats a la cara de sota de la base), potes regulables i clips de sòcol." },
  { id: "table", label: "Taules", hint: "Estructures de taula i guies d'extensió (només 3D)." },
  { id: "door-system", label: "Portes corredisses i plegables", hint: "Sistemes de portes corredisses i plegables (només 3D)." },
  { id: "handle", label: "Tiradors", hint: "Forats dels tiradors de portes, calaixos i abatibles." },
  { id: "push", label: "Obertura per pressió i imants", hint: "Imants de les reixetes i trapes, push." },
  { id: "profile", label: "Perfils i marcs", hint: "Perfils d'alumini i de LED, marcs d'alumini per a portes de vidre (Cadro)." },
  { id: "wall", label: "Penjar", hint: "Penjadors i regletes." },
  { id: "misc", label: "Altres", hint: "Accessoris, electrònica, passacables, ventilació…" },
] as const
export type HardwareCategory = (typeof HARDWARE_CATEGORIES)[number]["id"]
const CATEGORY_IDS = HARDWARE_CATEGORIES.map((c) => c.id) as [HardwareCategory, ...HardwareCategory[]]

/**
 * Motor (regla de col·locació) que fa servir un ferratge: on va i quants se'n posen ho decideix la regla de cada
 * contingut (la porta posa cassoletes a la filera System 32, el calaix forats de guia…); el ferratge en dona els números
 * i els mecanitzats. Els ferratges manuals (F4) en tindran un de genèric. `plate` (placa de muntatge importada) no té lloc
 * propi: la frontissa que s'hi aparella en copia els forats (`HardwareItem.plate`, target `side`). `leg` (pota importada):
 * tampoc, es tria a la base «Potes» del mòdul (`Base.hardware`): forats a la cara de sota de la base, a cada pota (target
 * `base`). `model` («només 3D»): un ferratge importat sense cap regla de mecanitzat (estructures de taula, portes
 * corredisses…): el model i el volum, **mai cap forat** (target `model` buit).
 */
export const HARDWARE_ENGINES = ["cup", "system32", "dowel", "slide", "flapArm", "magnet", "barHandle", "plate", "leg", "model", "drawerKit"] as const
export type HardwareEngine = (typeof HARDWARE_ENGINES)[number]

/** Mecanitzat en coordenades de la peça, relatiu al punt d'ancoratge (u al llarg, v a través). */
export const MachiningOpSchema = z.discriminatedUnion("kind", [
  /** Forat de cara (cec). */
  z.object({ kind: z.literal("drill"), face: z.enum(["A", "B"]), u: ExprSchema, v: ExprSchema, d: ExprSchema, depth: ExprSchema, tag: z.string().optional() }),
  /** Forat de cantell (a mig gruix). */
  z.object({ kind: z.literal("edgeDrill"), along: ExprSchema, d: ExprSchema, depth: ExprSchema, tag: z.string().optional() }),
  /** Forat passant (→ `Cutout` rodó, com els del tirador). */
  z.object({ kind: z.literal("through"), u: ExprSchema, v: ExprSchema, d: ExprSchema, tag: z.string().optional() }),
])
export type MachiningOp = z.infer<typeof MachiningOpSchema>

/** A quina peça va cada grup de mecanitzats (una unió en toca dues). */
export const HardwareTargetSchema = z.object({ key: z.string().min(1), label: z.string(), ops: z.array(MachiningOpSchema) })
export type HardwareTarget = z.infer<typeof HardwareTargetSchema>

const V3Schema = z.tuple([mm, mm, mm])

/**
 * Ferratge importat d'un fabricant (`core/import`, `docs/ferratges-import.md`): d'on surt, el model 3D i les vistes 2D
 * (`asset`, a Dexie: no viatja amb les còpies dels mòduls) i els mecanitzats tal com es van llegir (`proposed`, per tornar-hi).
 * **Fins que no es confirma (`confirmed`), no fa cap forat**: es pot triar, però el moble avisa i la porta queda sense
 * cassoletes (millor cap forat que un de dolent al taller).
 */
export const HardwareImportSchema = z.object({
  maker: z.string(),
  article: z.string(),
  /** Carpetes de la descàrrega (en alemany, com venen). */
  folders: z.array(z.string()),
  files: z.array(z.string()),
  /** Model 3D i vistes 2D (`hardwareAssets` de Dexie). */
  asset: z.string().optional(),
  /** Caixa del ferratge al seu marc (mm): u al llarg del cantell, v cap a dins, n fora de la cara. */
  bbox: z.object({ min: V3Schema, max: V3Schema }).optional(),
  /**
   * Com s'ha fet la caixa (`IMPORT_BOX_VERSION`): 1 = de la mateixa malla i el mateix marc que el GLB (coincideixen). Sense,
   * és d'abans (dels punts del STEP: als conjunts de Blum no coincidia amb el model) i es refà del GLB desat en obrir l'app.
   */
  boxVersion: z.number().int().min(0).optional(),
  /** Punts de connexió de les vistes 2D (capa CONNECTIONPOINTS), tal com venen. */
  points: z.array(V3Schema).optional(),
  /**
   * **Marc de muntatge** (coordenades del fitxer del fabricant, mm): l'origen i els eixos `u` (al llarg del cantell),
   * `v` (cap a dins de la peça) i `n` (fora de la cara, cap al cos del ferratge) amb què es va passar el model al seu
   * lloc (el GLB desat ja hi és). Per a una frontissa, l'eix de la cassoleta i el seu centre a la cara de la porta; per a
   * una placa, la cara del lateral i la referència; per a un tirador, la cara de muntatge i la línia dels forats; per a
   * una pota, la placa. El visor posa el GLB amb la mateixa transformació que el motor fa servir per al lloc, i el 3D
   * entra tal com es veuria col·locat. Els importats d'abans no en porten (el GLB ja era al marc de la proposta).
   */
  mountFrame: z.object({ origin: V3Schema, u: V3Schema, v: V3Schema, n: V3Schema }).optional(),
  /** D'on surt el marc: dels cilindres del STEP, estimat de la malla (`meshFrame.ts`) o el del fitxer tal qual. */
  frameFrom: z.enum(["step", "mesh", "file"]).optional(),
  /** Mecanitzats proposats en llegir els fitxers (els de `targets` són els editats). */
  proposed: z.array(HardwareTargetSchema),
  /**
   * Els números de la proposta que fan els forats (Ø i fondària de la cassoleta; Ø i distància, `pitch`, del tirador),
   * per saber si un fitxer nou en porta una altra (`mergeImported`). Els importats d'abans no en porten (els d'ara).
   */
  proposedParams: z.record(z.string(), mm).optional(),
  /**
   * **Proposta nova pendent de revisar**: s'ha tornat a importar l'article i els fitxers en donen una altra, però l'item
   * està confirmat (o se n'han editat els forats). No es toca res fins que l'usuari l'aplica (`applyImportUpdate`, que el
   * deixa sense confirmar) o la descarta.
   */
  update: z
    .object({
      targets: z.array(HardwareTargetSchema),
      params: z.record(z.string(), mm),
      notes: z.array(z.string()),
      bbox: z.object({ min: V3Schema, max: V3Schema }).optional(),
      /** Mecanitzats nous del generador (capes de mecanitzat d'un DXF del taller), si són uns altres. */
      machining: MachiningListSchema.optional(),
    })
    .optional(),
  /** Què s'hi ha trobat i què cal revisar. */
  notes: z.array(z.string()).optional(),
  confirmed: z.boolean(),
  /**
   * Malmès en llegir-lo (`sanitizeImportedHardware`): l'item desat no passava l'esquema i se n'ha quedat només la marca.
   * No es pot confirmar ni fa cap forat (avís «ferratge importat malmès: no es mecanitza»); cal tornar-lo a importar.
   */
  damaged: z.boolean().optional(),
})
export type HardwareImport = z.infer<typeof HardwareImportSchema>

/** Versió de la caixa dels importats (`HardwareImport.boxVersion`): si puja, la caixa es refà del model desat. */
export const IMPORT_BOX_VERSION = 1


/** L'item tal qual (sense la lectura dels importats malmesos, `HardwareItemSchema`). */
export const HardwareItemObjectSchema = z.object({
  /** `hinge-cup`… (inicials) o `hw-…` (de l'usuari). */
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(CATEGORY_IDS),
  engine: z.enum(HARDWARE_ENGINES),
  tags: z.array(z.string()).optional(),
  maker: z.string().optional(),
  ref: z.string().optional(),
  /** Paràmetres (mm): els noms que fan servir els mecanitzats i la regla del motor (`HARDWARE_PARAMS`). */
  params: z.record(z.string(), mm),
  /** Llargades disponibles (guies de calaix). */
  lengths: z.array(mm.positive()).min(1).optional(),
  /** Quantitat segons l'alçada (frontisses: 2/3/4/5). */
  count: StepRuleSchema.optional(),
  /** Distància entre forats segons l'espai (tiradors: 64/96/128). */
  pitch: StepRuleSchema.optional(),
  targets: z.array(HardwareTargetSchema).min(1),
  /** Versió de l'item (per saber si una còpia és d'abans). */
  version: z.number().int().min(1),
  /** Inicial de l'app (es pot editar; «Restaurar valors inicials» el torna a deixar com era). */
  builtin: z.boolean().optional(),
  /** Importat d'un fabricant (v20). */
  imported: HardwareImportSchema.optional(),
  /**
   * Frontisses: la placa de muntatge aparellada (els seus forats són al target `side`, copiats en triar-la; el model és
   * per veure-la al 3D).
   */
  plate: z.object({ id: z.string(), name: z.string(), asset: z.string().optional(), bbox: z.object({ min: V3Schema, max: V3Schema }).optional() }).optional(),
  /**
   * Generador de mecanitzats (v22, `hardwareOps.ts`): el que el ferratge fa a cada peça quan es **col·loca a mà** al moble
   * (`Composition.hardwarePlacements`). Tots o cap: una operació dolenta treu tota la llista en llegir-la. D'un importat,
   * només fa forats confirmat (`imported.confirmed`).
   */
  machining: MachiningListSchema.optional(),
  /**
   * Joc paramètric (v23, motor `drawerKit`, `hardwareKit.ts`): components, opcions, regles, peces de fusta i mecanitzats
   * llegits del catàleg del fabricant. Els `params` porten la prebroca dels cargols (`pilotDiameter`, `pilotDepth`; 0 =
   * sense) i els `targets` descriuen el forat de prebroca de cada peça (lateral, front, darrere).
   */
  kit: HardwareKitSchema.optional(),
})
export type HardwareItem = z.infer<typeof HardwareItemObjectSchema>

const IMPORT_MARKER = "ferratge importat malmès: no es mecanitza"

/**
 * Un importat que no passa l'esquema (un camp dolent a `imported`, un mecanitzat dolent…) **no es repara camp a camp**:
 * sense `imported` passaria a ser una frontissa normal que forada, i amb mitja dada podria fer mig ferratge. Es queda
 * **inert**: la marca (`imported.damaged`, sense mecanitzats ni confirmació) amb l'id, el nom, la categoria i el motor que
 * es puguin llegir; no fa cap forat i el moble avisa (`cupSpec`). Els que no són importats no es toquen (es reparen com
 * sempre). Per a les preferències (`hardwareLibrary`), els mòduls, els fronts i el `.moble`.
 */
export function sanitizeImportedHardware(raw: unknown): unknown {
  if (!isRecord(raw) || raw.imported === undefined) return raw
  if (HardwareItemObjectSchema.safeParse(raw).success) return raw
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.length ? v : fb)
  const imp = isRecord(raw.imported) ? raw.imported : {}
  const engine = (HARDWARE_ENGINES as readonly unknown[]).includes(raw.engine) ? (raw.engine as HardwareEngine) : "cup"
  const category = engine === "plate" ? "plate" : engine === "cup" ? "hinge" : (CATEGORY_IDS as readonly unknown[]).includes(raw.category) ? (raw.category as HardwareCategory) : "misc"
  const key = engine === "plate" ? "side" : engine === "cup" ? "door" : engine === "leg" ? "base" : engine === "model" ? "model" : "front"
  const item: HardwareItem = {
    id: str(raw.id, "hw-damaged"),
    name: str(raw.name, "Ferratge importat"),
    category,
    engine,
    ...(typeof raw.maker === "string" ? { maker: raw.maker } : {}),
    ...(typeof raw.ref === "string" ? { ref: raw.ref } : {}),
    params: {},
    targets: [{ key, label: IMPORT_MARKER, ops: [] }],
    version: 1,
    imported: { maker: str(imp.maker, typeof raw.maker === "string" ? raw.maker : ""), article: str(imp.article, typeof raw.ref === "string" ? raw.ref : ""), folders: [], files: [], proposed: [], notes: [`El ${IMPORT_MARKER}: torna'l a importar.`], confirmed: false, damaged: true },
  }
  return item
}

/** Un item de la biblioteca o una còpia (un importat malmès es llegeix inert, `sanitizeImportedHardware`). */
export const HardwareItemSchema = z.preprocess(sanitizeImportedHardware, HardwareItemObjectSchema)

/** L'avís d'un importat malmès (el text que surt al moble). */
export const damagedImportMessage = (item: Pick<HardwareItem, "name">) => `«${item.name}»: ${IMPORT_MARKER} (torna'l a importar).`
export const isDamagedImport = (item: HardwareItem): boolean => !!item.imported?.damaged

/** Llocs de cada mòdul que fan servir un ferratge (el motor que hi va i la categoria de la biblioteca). */
export const HARDWARE_SLOTS = [
  { slot: "hinge", engine: "cup", category: "hinge", label: "Frontissa", uses: "portes i reixetes amb frontisses" },
  { slot: "system32", engine: "system32", category: "shelf-support", label: "Filera System 32", uses: "laterals (prestatges regulables i frontisses)" },
  { slot: "dowel", engine: "dowel", category: "connector", label: "Espiga", uses: "unions de la caixa, divisors, prestatges fixos i fons encastat" },
  { slot: "slide", engine: "slide", category: "slide", label: "Guia de calaix", uses: "calaixos" },
  { slot: "flap", engine: "flapArm", category: "lift", label: "Braç d'abatible", uses: "abatibles" },
  { slot: "magnet", engine: "magnet", category: "push", label: "Imant", uses: "reixetes desmuntables i trapes" },
  { slot: "handle", engine: "barHandle", category: "handle", label: "Tirador", uses: "portes, calaixos i abatibles amb tirador" },
] as const
export type HardwareSlot = (typeof HARDWARE_SLOTS)[number]["slot"]
export const slotOf = (s: HardwareSlot) => HARDWARE_SLOTS.find((x) => x.slot === s)!
export const slotForEngine = (e: HardwareEngine) => HARDWARE_SLOTS.find((x) => x.engine === e)!

/**
 * Si un item pot anar en un lloc: el motor del lloc o, a «Guia de calaix», també un joc de calaix de doble paret
 * (`drawerKit`): llavors els calaixos del mòdul sense guia pròpia es fan amb el joc.
 */
export const slotAccepts = (slot: HardwareSlot, item: Pick<HardwareItem, "engine">): boolean => item.engine === slotOf(slot).engine || (slot === "slide" && item.engine === "drawerKit")

/**
 * La còpia d'un lloc del mòdul es llegeix **sencera o res** (`repairAtomically`, com el ferratge d'un front): reparada camp
 * a camp, un joc de calaix amb el `kit` dolent (còpia d'una versió anterior, dada tocada) quedava amb nom de joc, motor
 * `drawerKit` i sense `kit`, i el constructor deia «no és del tipus que toca». Ara, si no passa l'esquema, el lloc agafa
 * l'item d'inici (el del mòdul de referència en reparar, `fallback`) amb l'avís de reparació.
 */
const moduleSlotSchema = () => repairAtomically(z.preprocess(sanitizeImportedHardware, HardwareItemObjectSchema))

/** Còpia dels ferratges d'un mòdul: un item per lloc. */
export const ModuleHardwareKitSchema = z.object({
  hinge: moduleSlotSchema(),
  system32: moduleSlotSchema(),
  dowel: moduleSlotSchema(),
  slide: moduleSlotSchema(),
  flap: moduleSlotSchema(),
  magnet: moduleSlotSchema(),
  handle: moduleSlotSchema(),
})
export type ModuleHardware = z.infer<typeof ModuleHardwareKitSchema>

/** Quin item de la biblioteca fa servir cada lloc als mòduls nous. */
export const HardwareDefaultsSchema = z.object({
  hinge: z.string(),
  system32: z.string(),
  dowel: z.string(),
  slide: z.string(),
  flap: z.string(),
  magnet: z.string(),
  handle: z.string(),
})
export type HardwareDefaults = z.infer<typeof HardwareDefaultsSchema>

/** Paràmetres de cada motor (etiqueta i límits per a l'editor, `NumRow`). */
export interface HardwareParamSpec {
  key: string
  label: string
  min: number
  max: number
  step: number
  help?: string
}
const P = (key: string, label: string, min: number, max: number, step = 0.5, help?: string): HardwareParamSpec => ({ key, label, min, max, step, ...(help ? { help } : {}) })
export const HARDWARE_PARAMS: Record<HardwareEngine, HardwareParamSpec[]> = {
  cup: [
    P("cupDiameter", "Cassoleta (Ø)", 10, 60, 0.5),
    P("cupDepth", "Fondària", 5, 20, 0.5),
    P("cupOffset", "Al cantell", 5, 40, 0.5, "Del cantell de la porta al centre de la cassoleta."),
    P("endOffset", "Als extrems", 30, 300, 5, "Primera i última frontissa, des de dalt i des de baix (després s'ajusten a la filera System 32)."),
    P("gap", "Separació mínima", 0, 50, 1, "Entre cassoletes, a més del Ø (si no hi caben, se'n posen menys i s'avisa)."),
    P("margin", "Marge", 0, 20, 0.5, "Matèria al voltant de la cassoleta fins a la vora de la porta."),
  ],
  system32: [
    P("edgeOffset", "Al cantell", 10, 100, 0.5, "Fileres de davant i de darrere, des dels cantells del lateral."),
    P("pitch", "Pas", 16, 64, 1),
    P("diameter", "Diàmetre", 3, 10, 0.5),
    P("depth", "Fondària", 5, 20, 0.5),
  ],
  dowel: [
    P("diameter", "Diàmetre", 4, 12, 0.5),
    P("faceDepth", "A la cara", 5, 30, 0.5, "Fondària del forat a la cara de la peça que continua."),
    P("edgeDepth", "Al cantell", 5, 40, 0.5, "Fondària del forat al cantell de la peça que hi topa."),
    P("endOffset", "Als extrems", 20, 200, 1, "Primera i última espiga, des dels extrems de la unió."),
  ],
  slide: [
    P("sideClearance", "Joc lateral", 0, 30, 0.5, "Per costat, entre la caixa i el lateral del moble."),
    P("boxThickness", "Gruix de la caixa", 8, 25, 1),
    P("bottomThickness", "Gruix del fons", 3, 19, 1),
    P("boxDrop", "Front − caixa", 0, 100, 1, "Alçada del front menys alçada de la caixa."),
    P("bottomOffset", "Fons a", 0, 40, 1, "Del cantell de baix de la caixa a la ranura del fons."),
    P("backClearance", "Joc darrere", 0, 50, 1),
    P("frontOffset", "1r forat", 10, 200, 0.5, "Des del darrere del front."),
    P("secondOffset", "2n forat", 32, 600, 1, "Després del primer."),
    P("holeHeight", "Alçada", 5, 100, 0.5, "Dels forats, des de baix de la caixa."),
  ],
  flapArm: [
    P("offset", "Al cantell", 5, 60, 0.5, "Del cantell de gir als forats."),
    P("diameter", "Diàmetre", 3, 20, 0.5),
    P("depth", "Fondària", 3, 20, 0.5),
    P("endOffset", "Als costats", 20, 300, 5, "Dels costats de l'abatible (si és estret, a ¼ i ¾)."),
  ],
  magnet: [
    P("diameter", "Diàmetre", 3, 30, 0.5),
    P("depth", "Fondària", 2, 15, 0.5),
    P("cornerOffset", "A les cantonades", 10, 300, 5, "Des de dalt i des de baix."),
  ],
  barHandle: [
    P("diameter", "Diàmetre", 2, 12, 0.5),
    P("margin", "Marge", 0, 20, 0.5, "Matèria al voltant dels forats (vores i altres forats)."),
    P("inset", "Al cantell", 10, 200, 1, "A les portes i abatibles, del cantell que obre al tirador."),
  ],
  leg: [P("inset", "Als cantells", 20, 300, 1, "De la vora de fora del mòdul a l'eix de cada pota (de costat i de davant/darrere).")],
  model: [],
  drawerKit: [
    P("pilotDiameter", "Prebroca (Ø)", 0, 6, 0.5, "Forat guia a cada cargol de la guia, dels suports del front i del darrere (0 = cap)."),
    P("pilotDepth", "Prebroca (fondària)", 3, 30, 1),
  ],
  plate: [
    P("setback", "Del davant", 0, 200, 0.5, "Del cantell de davant del lateral a la referència de la placa (la filera System 32: 37)."),
    P("offset", "Alçada", -100, 100, 0.5, "Del centre de la cassoleta a la referència de la placa (amunt, positiu)."),
  ],
}

/** Col·locació de la placa d'una frontissa importada (paràmetres de la frontissa, copiats de la placa en aparellar-la). */
export const HINGE_PLATE_PARAMS: HardwareParamSpec[] = [
  P("plateSetback", "Placa: del davant", 0, 200, 0.5, "De la cara de darrere de la porta a la referència de la placa (la filera System 32: 37). Amb fronts encastats el gruix del front ja s'hi suma sol."),
  P("plateOffset", "Placa: alçada", -100, 100, 0.5, "Del centre de la cassoleta a la referència de la placa (amunt, positiu)."),
]

/** Importat i encara sense confirmar: no fa cap forat. */
export const isPendingImport = (item: HardwareItem): boolean => !!item.imported && !item.imported.confirmed

/**
 * **Què és** un ferratge importat (el seu *lloc*, `engine`): un dels motors paramètrics de l'app o «només 3D» (`model`,
 * cap regla: es col·loca a mà). L'usuari ho pot canviar a l'editor (`retargetImported`): les regles del lloc el posen al
 * moble i el model 3D entra pel seu marc. L'ordre és el de l'editor.
 */
export const HARDWARE_ROLES: readonly { engine: HardwareEngine; label: string; category: HardwareCategory; help: string }[] = [
  { engine: "cup", label: "Frontissa", category: "hinge", help: "Cassoleta a la porta (quantitat per alçada, a la filera System 32) i, si té placa, els forats de la placa al lateral." },
  { engine: "plate", label: "Placa de frontissa", category: "plate", help: "Es tria a una frontissa importada: els seus forats van al lateral de les frontisses, a l'alçada de cada cassoleta." },
  { engine: "barHandle", label: "Tirador", category: "handle", help: "Forats passants al front: centrat als calaixos, al cantell que obre a portes i abatibles." },
  { engine: "slide", label: "Guia de calaix", category: "slide", help: "Forats al lateral del moble i a la caixa del calaix." },
  { engine: "flapArm", label: "Braç d'abatible", category: "lift", help: "Forats a l'abatible, al cantell de gir." },
  { engine: "leg", label: "Pota", category: "leg", help: "Forats a la cara de sota de la base, a cada cantonada." },
  { engine: "magnet", label: "Imant", category: "push", help: "Forat al front i al cantell del lateral (reixetes i trapes)." },
  { engine: "dowel", label: "Espiga", category: "connector", help: "Unions de la caixa, divisors i prestatges fixos." },
  { engine: "system32", label: "Filera System 32", category: "shelf-support", help: "La filera de forats dels laterals." },
  { engine: "model", label: "Només 3D", category: "misc", help: "Cap regla de mecanitzat: el model i, si en té, els mecanitzats del generador; es col·loca a mà." },
]
export const roleOf = (e: HardwareEngine) => HARDWARE_ROLES.find((r) => r.engine === e)!

// --- Valors inicials (dels números d'abans) ------------------------------------------------------------------------

const HINGE_COUNT: StepRule = { steps: [{ upTo: 900, n: 2 }, { upTo: 1600, n: 3 }, { upTo: 2100, n: 4 }], else: 5 }
const HANDLE_PITCH: StepRule = { steps: [{ upTo: 200, n: 64 }, { upTo: 260, n: 96 }], else: 128, strict: true }

/** Els ferratges inicials amb els números d'unes preferències (o d'un mòdul) d'abans: res no canvia de lloc. */
export function libraryFromLegacy(h: LegacyHardware): HardwareItem[] {
  const fmt = (v: number) => String(v).replace(".", ",")
  return [
    {
      id: "hinge-cup",
      name: `Frontissa de cassoleta Ø${fmt(h.hinge.cupDiameter)}`,
      category: "hinge",
      engine: "cup",
      params: { ...h.hinge, endOffset: 100, gap: 10, margin: 3 },
      count: structuredClone(HINGE_COUNT),
      targets: [{ key: "door", label: "Porta", ops: [{ kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" }] }],
      version: 1,
      builtin: true,
    },
    {
      id: "system32",
      name: "Filera System 32",
      category: "shelf-support",
      engine: "system32",
      params: { ...h.system32 },
      targets: [{ key: "side", label: "Lateral", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "depth", tag: "system32" }] }],
      version: 1,
      builtin: true,
    },
    {
      id: "dowel",
      name: `Espiga Ø${fmt(h.dowel.diameter)}`,
      category: "connector",
      engine: "dowel",
      params: { ...h.dowel },
      targets: [
        { key: "butt", label: "Peça que hi topa (cantell)", ops: [{ kind: "edgeDrill", along: 0, d: "diameter", depth: "edgeDepth", tag: "dowel" }] },
        { key: "through", label: "Peça que continua (cara)", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "faceDepth", tag: "dowel" }] },
      ],
      version: 1,
      builtin: true,
    },
    {
      id: "slide-ball",
      name: "Guia de boles",
      category: "slide",
      engine: "slide",
      params: {
        sideClearance: h.drawer.sideClearance,
        boxThickness: h.drawer.boxThickness,
        bottomThickness: h.drawer.bottomThickness,
        boxDrop: h.drawer.boxDrop,
        bottomOffset: h.drawer.bottomOffset,
        backClearance: h.drawer.backClearance,
        // Abans era la distància de la filera System 32 al cantell (37): ara és de la guia.
        frontOffset: h.system32.edgeOffset,
        secondOffset: 256,
        holeHeight: 20,
      },
      lengths: [...h.drawer.slideLengths],
      targets: [
        {
          key: "side",
          label: "Lateral del moble",
          ops: [
            { kind: "drill", face: "A", u: "frontOffset", v: 0, d: 5, depth: 12, tag: "slide" },
            { kind: "drill", face: "A", u: "frontOffset+secondOffset", v: 0, d: 5, depth: 12, tag: "slide" },
          ],
        },
        {
          key: "box",
          label: "Lateral de la caixa",
          ops: [
            { kind: "drill", face: "A", u: "frontOffset", v: 0, d: 4, depth: 10, tag: "slide" },
            { kind: "drill", face: "A", u: "frontOffset+secondOffset", v: 0, d: 4, depth: 10, tag: "slide" },
          ],
        },
      ],
      version: 1,
      builtin: true,
    },
    {
      id: "flap-arm",
      name: "Braç d'abatible",
      category: "lift",
      engine: "flapArm",
      // Abans feia servir la distància de la cassoleta de la frontissa (22,5).
      params: { offset: h.hinge.cupOffset, diameter: 8, depth: 12, endOffset: 100 },
      targets: [{ key: "flap", label: "Abatible", ops: [{ kind: "drill", face: "A", u: "offset", v: 0, d: "diameter", depth: "depth", tag: "flap" }] }],
      version: 1,
      builtin: true,
    },
    {
      id: "magnet",
      name: `Imant Ø${fmt(h.magnet.diameter)}`,
      category: "push",
      engine: "magnet",
      params: { ...h.magnet },
      targets: [
        { key: "front", label: "Front (cara)", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "depth", tag: "magnet" }] },
        { key: "side", label: "Lateral (cantell)", ops: [{ kind: "edgeDrill", along: 0, d: "diameter", depth: "depth", tag: "magnet" }] },
      ],
      version: 1,
      builtin: true,
    },
    {
      id: "handle-bar",
      name: "Tirador de barra",
      category: "handle",
      engine: "barHandle",
      params: { diameter: 5, margin: 3, inset: 40 },
      pitch: structuredClone(HANDLE_PITCH),
      targets: [
        {
          key: "front",
          label: "Front",
          ops: [
            { kind: "through", u: "-pitch/2", v: 0, d: "diameter", tag: "handle" },
            { kind: "through", u: "pitch/2", v: 0, d: "diameter", tag: "handle" },
          ],
        },
      ],
      version: 1,
      builtin: true,
    },
  ]
}

/**
 * Un joc paramètric com a item de la biblioteca (motor `drawerKit`): el joc a `kit`, la prebroca als `params` i un forat de
 * prebroca per peça als `targets` (el constructor en pren el Ø i la fondària, `drawerKit.ts`).
 */
export function kitItem(id: string, name: string, kit: HardwareKit, pilot: { pilotDiameter: number; pilotDepth: number } = KIT_PILOT_PARAMS): HardwareItem {
  const pilotOp = (tag: string) => ({ kind: "drill" as const, face: "A" as const, u: 0, v: 0, d: "pilotDiameter", depth: "pilotDepth", tag })
  return {
    id,
    name,
    category: "drawer-system",
    engine: "drawerKit",
    maker: kit.maker,
    ref: kit.series,
    params: { ...pilot },
    targets: [
      { key: "side", label: "Lateral del moble (cargols de la guia)", ops: [pilotOp("kit-slide")] },
      { key: "front", label: "Front del calaix (suports de davant)", ops: [pilotOp("kit-front")] },
      { key: "back", label: "Darrere del calaix (suports de darrere)", ops: [pilotOp("kit-back")] },
    ],
    version: 1,
    builtin: true,
    kit: structuredClone(kit),
  }
}

/** Els jocs inicials de l'app (DTC MAGIC-PRO, de la N a la F). */
export const DEFAULT_HARDWARE_KITS: HardwareItem[] = DTC_MAGIC_PRO_KITS.map((k) => kitItem(k.id, k.name, k.kit))

export const DEFAULT_HARDWARE_LIBRARY: HardwareItem[] = [...libraryFromLegacy(DEFAULT_LEGACY_HARDWARE), ...DEFAULT_HARDWARE_KITS]

/** Un item és un joc paramètric que es pot fer servir (motor `drawerKit` amb el joc). */
export const isDrawerKit = (item: HardwareItem): item is HardwareItem & { kit: HardwareKit } => item.engine === "drawerKit" && !!item.kit

export const DEFAULT_HARDWARE_DEFAULTS: HardwareDefaults = {
  hinge: "hinge-cup",
  system32: "system32",
  dowel: "dowel",
  slide: "slide-ball",
  flap: "flap-arm",
  magnet: "magnet",
  handle: "handle-bar",
}

/** Els ferratges inicials d'un mòdul, amb els números d'abans (`Module.hardware` d'un mòdul desat abans de la v19). */
export function kitFromLegacy(h: LegacyHardware): ModuleHardware {
  const lib = libraryFromLegacy(h)
  return kitFrom(lib, DEFAULT_HARDWARE_DEFAULTS)
}

/** Un kit (còpia) amb els items per defecte de cada lloc (`fixHardwareDefaults` ja garanteix que hi són). */
export function kitFrom(library: readonly HardwareItem[], defaults: HardwareDefaults): ModuleHardware {
  const pick = (slot: HardwareSlot): HardwareItem => {
    const engine = slotOf(slot).engine
    const hit = library.find((x) => x.id === defaults[slot] && slotAccepts(slot, x)) ?? library.find((x) => x.engine === engine) ?? DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === engine)!
    return structuredClone(hit)
  }
  return { hinge: pick("hinge"), system32: pick("system32"), dowel: pick("dowel"), slide: pick("slide"), flap: pick("flap"), magnet: pick("magnet"), handle: pick("handle") }
}

export const DEFAULT_MODULE_HARDWARE: ModuleHardware = kitFromLegacy(DEFAULT_LEGACY_HARDWARE)

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Un `Module.hardware` d'abans (els números: `hinge.cupDiameter`, `drawer`…), no un kit. */
export function isLegacyHardware(v: unknown): boolean {
  return isRecord(v) && isRecord(v.hinge) && "cupDiameter" in v.hinge && !("engine" in v.hinge)
}

/**
 * Migració en llegir (v19): un `Module.hardware` d'abans passa a kit amb els mateixos números (res no canvia de lloc);
 * un kit, tal qual. Un número d'abans dolent torna a l'inicial (camp a camp).
 */
export function migrateModuleHardware(v: unknown): unknown {
  if (!isLegacyHardware(v)) return v
  // Un número dolent només torna aquell número a l'inicial (camp a camp, com la resta del mòdul).
  const legacy = repairValue(LegacyHardwareSchema, v, DEFAULT_LEGACY_HARDWARE, () => {})
  return legacy ? kitFromLegacy(legacy) : v
}

/**
 * Les preferències de ferratges coherents: cada lloc apunta a un item de la biblioteca amb el motor que toca (si no, el
 * primer que en té i, si no n'hi ha cap, el d'inici, que s'hi torna a afegir). Ids únics (els repetits fora).
 */
export function fixHardwareDefaults(library: readonly HardwareItem[], defaults: Partial<HardwareDefaults>): { library: HardwareItem[]; defaults: HardwareDefaults; changed: boolean } {
  let changed = false
  const seen = new Set<string>()
  const lib: HardwareItem[] = []
  for (const it of library) {
    if (seen.has(it.id)) {
      changed = true
      continue
    }
    seen.add(it.id)
    lib.push(it)
  }
  const out = { ...DEFAULT_HARDWARE_DEFAULTS }
  for (const { slot, engine } of HARDWARE_SLOTS) {
    const want = defaults[slot]
    const hit = lib.find((x) => x.id === want && slotAccepts(slot, x)) ?? lib.find((x) => x.engine === engine)
    if (hit) {
      out[slot] = hit.id
      if (hit.id !== want) changed = true
      continue
    }
    const builtin = structuredClone(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === engine)!)
    lib.push(builtin)
    out[slot] = builtin.id
    changed = true
  }
  return { library: lib, defaults: out, changed }
}

/** Variables d'un item per a les seves fórmules: els paràmetres i les mides que doni qui l'aplica. */
export function hardwareVars(item: HardwareItem, extra: Record<string, number> = {}): Record<string, number> {
  return { ...item.params, ...extra }
}

/** Resum d'una línia (targeta i capçalera de l'editor): els forats que fa i on. */
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

// --- Referències als mobles desats (eliminar amb substitut) ---------------------------------------------------------

/** Les fronts que poden triar un ferratge propi (`front.hardware`). */
const FRONT_SLOT: Record<string, HardwareSlot> = { door: "hinge", drawers: "slide", flap: "flap" }

/** Recorre els ferratges d'una composició desada (també d'abans: `Module.hardware` amb els números). */
function eachHardware(comp: unknown, visit: (item: HardwareItem) => HardwareItem | null): unknown {
  if (!isRecord(comp) || !Array.isArray(comp.modules)) return comp
  const zone = (z: unknown): unknown => {
    if (!isRecord(z)) return z
    let out: Record<string, unknown> = z
    const f = z.front
    if (isRecord(f) && typeof f.kind === "string" && FRONT_SLOT[f.kind]) {
      // El ferratge propi del front (frontissa, guia, braç) i el tirador triat (`front.handle`).
      let front: Record<string, unknown> = f
      for (const key of ["hardware", "handle"] as const) {
        if (!isRecord(f[key])) continue
        const parsed = HardwareItemSchema.safeParse(f[key])
        const next = parsed.success ? visit(parsed.data) : null
        if (next) front = { ...front, [key]: next }
      }
      if (front !== f) out = { ...out, front }
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
        const v = visit(next[slot])
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
 * prou amb l'id): «<nom> (del moble)», per veure el que es fabrica de debò i poder-hi tornar. `value` = l'opció de
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
  const inheritedKey = inherited ? resolve(inherited, `${inherited.name} (del moble)`) : undefined
  const value = resolve(current, `${current.name} (del moble)`)
  // Dues còpies diferents amb el mateix nom (la del front i la del mòdul): la del mòdul es diu «del mòdul».
  const own = options.filter((o) => o.own)
  if (inheritedKey && own.length === 2 && own[0]!.label === own[1]!.label) own.find((o) => o.key === inheritedKey)!.label = `${inherited!.name} (del mòdul)`
  return { options, value, ...(inheritedKey ? { inheritedKey } : {}) }
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

/** Canvia els mecanitzats del generador; d'un importat, el deixa sense confirmar (cal tornar-lo a revisar). */
export function setMachining(item: HardwareItem, ops: HardwareItem["machining"]): HardwareItem {
  const { machining: _old, ...rest } = item
  const next: HardwareItem = ops?.length ? { ...rest, machining: ops } : rest
  return next.imported ? { ...next, imported: { ...next.imported, confirmed: false } } : next
}

/**
 * Es pot col·locar a mà: només els **«només 3D»** (`model`: sense cap lloc al moble; amb els mecanitzats del generador
 * o sense). Els d'un lloc (frontissa, placa, tirador…) els posen les regles del mòdul: no es col·loquen a mà (els
 * col·locats d'abans d'un d'aquests es continuen llegint i fabricant, `hardwarePlace.ts`).
 */
export const isPlaceable = (item: HardwareItem): boolean => item.engine === "model"

// --- Prebroca dels cargols (regla del taller) -----------------------------------------------------------------------

/** La prebroca que fan els jocs de la biblioteca (la del primer joc; cap joc → la inicial). */
export function kitPilot(library: readonly HardwareItem[]): { enabled: boolean; diameter: number; depth: number } {
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
export function setKitPilot(library: readonly HardwareItem[], pilot: { enabled: boolean; diameter: number; depth: number }): HardwareItem[] {
  return library.map((x) => {
    if (x.engine !== "drawerKit") return x
    const { pilotOffDiameter: _o, ...rest } = x.params
    const params = pilot.enabled ? { ...rest, pilotDiameter: pilot.diameter, pilotDepth: pilot.depth } : { ...rest, pilotDiameter: 0, pilotDepth: pilot.depth, pilotOffDiameter: pilot.diameter }
    return { ...x, params }
  })
}
