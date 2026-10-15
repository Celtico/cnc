import { z } from "zod"
import { DEFAULT_CABINET } from "./cabinet"
import { repairAtomically } from "./repair"
import { MachiningListSchema, StepRuleSchema } from "./hardwareOps"
import { HardwareKitSchema } from "./hardwareKit"
import { LightKitSchema } from "./lightKit"
import { ApplianceSchema } from "./appliance"

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
const ExprSchema = z.union([mm, z.string().min(1).max(200)])

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
  { id: "profile", label: "Perfils i marcs", hint: "Perfils i marcs d'alumini per a portes de vidre (Cadro). Els perfils de LED són a Llums." },
  { id: "light", label: "Llums", hint: "Làmpades LED de 24 V per encastar al prestatge o a la tapa (forat o rebaix, forat del cable) amb l'alimentador, l'interruptor i els cables per connectar-les a la xarxa." },
  { id: "wall", label: "Penjar", hint: "Penjadors dels mòduls penjats, regletes de paret i barres de penjar." },
  { id: "appliance", label: "Electrodomèstics", hint: "Rentaplats, frigorífics, rentadores, forns, microones, plaques i campanes integrables del catàleg del fabricant: el nínxol que demanen, com es munta el front de moble (es tria a cada compartiment, «Electrodomèstic») i la foto per al 3D i el render." },
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
 * corredisses…): el model i el volum, **mai cap forat** (target `model` buit). `hanger` (penjador de moble alt) i
 * `wallRail` (la regleta de paret on s'enganxa): llocs del mòdul penjat (`Base.hanger`, `Base.rail`). `plinthProfile`
 * (sòcol d'alumini): sense lloc, es tria al sòcol de la base «Potes» (`Base.plinth.hardware`), com la pota. `appliance`
 * (electrodomèstic, v46): sense lloc, es tria a cada compartiment («Electrodomèstic», `Zone.appliance`).
 */
export const HARDWARE_ENGINES = ["cup", "system32", "dowel", "slide", "flapArm", "magnet", "barHandle", "plate", "leg", "model", "drawerKit", "rail", "ledProfile", "glassFrame", "hanger", "wallRail", "plinthProfile", "appliance"] as const
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
const HardwareImportSchema = z.object({
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

/** Versió de la caixa dels importats (`HardwareImport.boxVersion`): si puja, la caixa es refà del model desat. */
export const IMPORT_BOX_VERSION = 1


/**
 * **Ferratge per metres** (v45, `docs/funcional/model.md` › Ferratges per metres): es compra en barres de `params.stock`
 * mm (0 = es ven per metres) i es talla a mida; la secció és `params.height` × `params.depth`. Les regles el posen al
 * moble (la regleta al llarg dels mòduls penjats, el sòcol d'alumini al voltant de la base) i la comanda en suma els
 * trossos, les barres, els clips (un cada `params.clipSpacing`, a `params.clipEnd` dels extrems, dos per tros com a mínim)
 * i les cantonades (`buildLinearOrders`).
 */
const LinearSchema = z.object({
  /** El clip o la fixació que va amb el perfil (clip de sòcol a la pota, cargol i tac de la regleta). */
  clip: z.object({ name: z.string().min(1), ref: z.string().optional() }).optional(),
  /** La peça de cantonada (sòcol): una a cada cantonada entre dos trams. */
  corner: z.object({ name: z.string().min(1), ref: z.string().optional() }).optional(),
})

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
  /**
   * El material del que es veu, un nom de Preferències › Materials (v36): el perfil d'un marc de vitrina («Alumini
   * anoditzat plata» als Häfele). Sense, el de l'app (el marc negre).
   */
  material: z.string().min(1).optional(),
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
  /**
   * Joc de llum (v31, motor `ledProfile`, `lightKit.ts`): una làmpada del catàleg amb el mecanitzat per encastar-la a la
   * peça de sobre del compartiment i el sistema elèctric (alimentador, distribuïdor, interruptor, cables) a la comanda.
   */
  light: LightKitSchema.optional(),
  /** Ferratge per metres (v45): la regleta de paret, el sòcol d'alumini (`LinearSchema`). */
  linear: LinearSchema.optional(),
  /**
   * Electrodomèstic (v46, motor `appliance`, `appliance.ts`): les dades del catàleg del fabricant (nínxol, sistema de
   * porta, alçades i pes del front, sòcol, ventilació, retalls, foto). Els `params` i els `targets` són el que l'app
   * mecanitza al front de moble (`appliances/applianceCatalog.ts`).
   */
  appliance: ApplianceSchema.optional(),
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

/**
 * Llocs de cada mòdul que fan servir un ferratge (el motor que hi va i la categoria de la biblioteca). Els set primers són
 * els de sempre (cada mòdul en porta una còpia); els **accessoris** (barra de penjar, tira LED, marc de vitrina) i els
 * **del mòdul penjat** (penjador i regleta, v45) són opcionals a la còpia del mòdul: sense, l'item d'inici de l'app. Cada compartiment o porta en pot
 * triar un altre (`Zone.rail.hardware`, `Zone.led.hardware`, `front.frame`).
 */
export const HARDWARE_SLOTS = [
  { slot: "hinge", engine: "cup", category: "hinge", label: "Frontissa", uses: "portes i reixetes amb frontisses" },
  { slot: "system32", engine: "system32", category: "shelf-support", label: "Filera System 32", uses: "laterals (prestatges regulables i frontisses)" },
  { slot: "dowel", engine: "dowel", category: "connector", label: "Espiga", uses: "unions de la caixa, divisors, prestatges fixos i fons encastat" },
  { slot: "slide", engine: "slide", category: "slide", label: "Guia de calaix", uses: "calaixos" },
  { slot: "flap", engine: "flapArm", category: "lift", label: "Braç d'abatible", uses: "abatibles" },
  { slot: "magnet", engine: "magnet", category: "push", label: "Imant", uses: "reixetes desmuntables i trapes" },
  { slot: "handle", engine: "barHandle", category: "handle", label: "Tirador", uses: "portes, calaixos i abatibles amb tirador" },
  { slot: "rail", engine: "rail", category: "wall", label: "Barra de penjar", uses: "compartiments amb barra de penjar" },
  { slot: "led", engine: "ledProfile", category: "light", label: "Tira LED", uses: "compartiments amb llum" },
  { slot: "glassFrame", engine: "glassFrame", category: "profile", label: "Marc de vitrina", uses: "portes de vidre" },
  { slot: "hanger", engine: "hanger", category: "wall", label: "Penjador", uses: "mòduls penjats a la paret" },
  { slot: "wallRail", engine: "wallRail", category: "wall", label: "Regleta de penjar", uses: "mòduls penjats a la paret (on s'enganxen els penjadors)" },
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

/** Còpia dels ferratges d'un mòdul: un item per lloc (els accessoris, opcionals: sense, l'item d'inici). */
export const ModuleHardwareKitSchema = z.object({
  hinge: moduleSlotSchema(),
  system32: moduleSlotSchema(),
  dowel: moduleSlotSchema(),
  slide: moduleSlotSchema(),
  flap: moduleSlotSchema(),
  magnet: moduleSlotSchema(),
  handle: moduleSlotSchema(),
  rail: moduleSlotSchema().optional(),
  led: moduleSlotSchema().optional(),
  glassFrame: moduleSlotSchema().optional(),
  hanger: moduleSlotSchema().optional(),
  wallRail: moduleSlotSchema().optional(),
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
  rail: z.string().optional(),
  led: z.string().optional(),
  glassFrame: z.string().optional(),
  hanger: z.string().optional(),
  wallRail: z.string().optional(),
})
export type HardwareDefaults = z.infer<typeof HardwareDefaultsSchema>

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}
