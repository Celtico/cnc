import { OptionPrefsSchema } from "./options/optionCascade"
import { z } from "zod"
import { HardwareDefaultsSchema, HardwareItemSchema } from "./hardware"
import { KitPilotSchema } from "./hardwareKit"
import { MachineRulesSchema, MachineSchema } from "./machine"

/**
 * Preferències de l'usuari: tot el que depèn de casa seva i del taller (referències de
 * foto, materials, taulers, ferratges, jocs, etiquetes) i que el codi només porta com a
 * valors inicials. Es guarden a Dexie amb versió per poder-les migrar.
 *
 * Canviar una preferència no modifica els mobles ja fets: només els mòduls nous (que en
 * prenen ferratges, jocs i materials) i les pantalles que llegeixen les llistes.
 */

const mm = z.number().finite()

/**
 * Versió de les preferències. v20: ferratges importats d'un fabricant (`HardwareItem.imported`, `plate`, motor
 * `plate`): additiu, cap item d'abans no canvia (una v19 es llegeix igual; una app v19 no pot desar sobre una v20).
 * v21: tiradors, potes i «només 3D» importats (motors `leg` i `model`, categories `table` i `door-system`): additiu; una
 * app v20 no les pot desar (perdria els items que no sap llegir).
 * v22: generador de mecanitzats dels ferratges (`HardwareItem.machining`, `hardwareOps.ts`): additiu, res a migrar; una
 * app v21 no les pot desar (trauria les operacions en silenci).
 * v23: jocs paramètrics de calaix de doble paret (`HardwareItem.kit`, motor `drawerKit`, categoria `drawer-system`,
 * `hardwareKit.ts`): additiu; els jocs inicials (DTC MAGIC-PRO) s'afegeixen a la biblioteca si no hi són (per id). Una
 * app v22 no les pot desar (perdria els jocs).
 * v24: els jocs inicials (`builtin`, id dels de l'app) reben les dades del joc d'ara (`kit`: guia telescòpica de dos
 * cossos, acabats dels laterals); el nom i la prebroca (`params`) de l'usuari es queden. Les còpies dels mobles no es
 * toquen.
 * v25: folgança de les peces de dins (`gaps.innerClearance`, 1 mm): additiu; les preferències d'abans la reben amb el
 * valor inicial (si ja n'hi ha una, es queda). Els mobles desats no canvien (sense el camp, 0).
 * v26: assistent IA (`assistant`: clau de l'API de Claude i model): additiu; sense, sense clau i el model per defecte.
 * La clau no surt mai a l'export (`settingsToJson`) i importar-ne unes no la toca (`importSettingsJson`).
 * v27: catàleg DTC 2026: els jocs MAGIC-STAR ULTRA, DRAGON-PRO i PURE-PRO HK i els push latch MS (`V27_ITEMS`)
 * s'afegeixen a la biblioteca si no hi són (per id, com la v23); l'acabat negre mat dels laterals. Additiu.
 * v28: la resta del catàleg DTC 2026 (`V28_ITEMS`, `core/model/dtc/`): frontisses i plaques, guies, elevables, portes
 * corredisses, unions, suports, frontissa D, door opener i els jocs PURE-BOX HL i PURE-PRO HQ. Additiu, per id.
 * v29: **fora els «només 3D»** (per decisió de l'usuari, 2026-10-13: «si no tenen mecanitzats, borra'ls»; «els que
 * posa només 3D i estan buits, treu-los»): tots els inicials del motor `model` (push latch, door opener, frontissa D,
 * elevable DQ, unions d'una v27/v28 anterior), els importats `model` sense `machining` i els inicials DTC que ja no són
 * a la biblioteca de l'app. Els llocs que hi apuntaven tornen a l'item de l'app (`fixHardwareDefaults`).
 * v30: la mateixa neteja que la v29 amb la regla sencera (la primera v29 només treia els `model` sense `machining`; les
 * preferències que ja eren a la 29 amb els push latch, unions, frontissa D i DQ desats no els perdien).
 * v31: jocs de llum Häfele Loox (`V31_ITEMS`), additiu.
 * v32: joc de l'ample de la ranura del fons (`gaps.grooveClearance`, 0): additiu; els mobles desats no canvien.
 * v33: el joc de la ranura per defecte passa a 0,8 (`DEFAULT_GROOVE_CLEARANCE`): unes preferències que el tenien a 0 (el
 * de la v32) o sense, el reben; un altre valor de l'usuari es queda. Els mobles desats no canvien (el porten al mòdul).
 * v34: potes de sòcol Häfele AXILO 78 (`V34_ITEMS`), additiu.
 * v35: catàleg general Häfele (`V35_ITEMS`: marcs d'alumini per a portes de vidre amb la placa de la Metallamat A,
 * tiradors, suports de prestatge i el perfil Loox d'11 mm per encastar), additiu.
 * v36: el material del que es veu d'un ferratge (`HardwareItem.material`): els marcs Häfele, «Alumini anoditzat plata»
 * (material nou, `FRAME_MATERIALS`, i els marcs de la v35 desats el reben si no en tenen); el de l'app es queda negre.
 * v37: la pota AXILO 78 (v34) com la munta el taller (clip cap al lateral, en mirall a la dreta, a 45 dels cantells):
 * la de la biblioteca es refà si encara és la de la v34 (`version` 1).
 * v38: la mateixa pota amb la placa per dibuixar-la al 3D (`plateU0`…): es refà si és d'una versió anterior de l'item.
 * v39: la pota AXILO 78 per cargolar per a mobles (`V39_ITEMS`; la de la v34 és la de cuina), additiu.
 * v40: els perfils de LED (motor `ledProfile`) passen de «Perfils i marcs» a «Llums» (per decisió de l'usuari).
 * v41: a les vitrines, la frontissa i el tirador es trien com a les portes de fusta (per decisió de l'usuari): la
 * frontissa Metallamat A (`V41_ITEMS`) porta la placa que abans era dins dels marcs Häfele (els marcs es refan, `version` 2).
 * v42: els tiradors Häfele per a marc de vitrina (`V42_ITEMS`, es claven al perfil), additiu.
 * v43: la frontissa Häfele Duomatic Premium 105° per a marc d'alumini (`V43_ITEMS`), additiu.
 * v44: la Duomatic 105° per a marc d'alumini estret (`V44_ITEMS`), additiu.
 * v45: els mòduls penjats porten penjadors (el penjador ocult regulable i la regleta de paret, llocs `hanger` i
 * `wallRail`) i els sòcols d'alumini per metres (`V45_ITEMS`), additiu.
 * v46: els electrodomèstics del catàleg (Bosch, Balay, Siemens i Teka; categoria «Electrodomèstics», motor `appliance`,
 * `V46_ITEMS`), additiu.
 * v47: el cos dels electrodomèstics té material (`HardwareItem.material`, per defecte `applianceBodyMaterial`): el vidre
 * negre dels forns, microones i plaques, «Electrodomèstic negre» (`APPLIANCE_MATERIALS`), additiu.
 * v48: opcions en cascada (`optionPrefs`: amagar una opció de l'Editor i el seu valor per defecte als elements nous,
 * `core/model/options/`), additiu; sense, cap d'amagada i els per defecte del codi. Una entrada dolenta només es treu.
 */
export const SETTINGS_VERSION = 48


// --- Objectes de referència (foto i editor) ------------------------------------------

export const RefPresetSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Cal un nom"),
  /** Cara del davant: amplada × alçada (per calibrar la foto). */
  w: mm.min(1, "Amplada entre 1 i 10.000 mm").max(10000, "Amplada entre 1 i 10.000 mm"),
  h: mm.min(1, "Alçada entre 1 i 10.000 mm").max(10000, "Alçada entre 1 i 10.000 mm"),
  /** Fondària (opcional per a referències planes: A4, rajola). Sense fondària no pot ser fantasma 3D. */
  d: mm.min(1).max(10000).optional(),
  plane: z.enum(["wall", "floor"]),
  /** Distància de la cara del davant a la paret (mm). */
  wallOffset: mm.min(0).max(5000),
  /** Valor inicial del codi: es pot amagar, no esborrar. */
  builtin: z.boolean().optional(),
  hidden: z.boolean().optional(),
})
export type RefPreset = z.infer<typeof RefPresetSchema>

// --- Materials ---------------------------------------------------------------------

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
/** Imatge d'un acabat: data URL o un fitxer de l'app a `public/textures/`. */
const imageSrc = z.string().refine((s) => s.startsWith("data:image/") || /^textures\/[\w.-]+\/[\w.-]+\.(jpe?g|png|webp)$/.test(s), "Imatge invàlida")

/**
 * Paràmetres del generador de fusta (textura procedural): colors, veta, catedrals, porus i la mida
 * real d'una repetició. Sense, els de l'espècie (`WOOD_PRESETS`).
 */
export const WoodGenSchema = z.object({
  /** Color de fons i de la veta. */
  base: hex,
  dark: hex,
  /** Densitat de la veta (vetes per repetició). */
  lines: z.number().min(2).max(80),
  /** Ondulació de les fibres (0 recta, 0,25 molt ondulada). */
  wobble: z.number().min(0).max(0.25),
  /** Franges amples de to clar/fosc. */
  bands: z.number().int().min(0).max(60),
  /** Contrast de les fibres (0 suau, 1 marcat). */
  contrast: z.number().min(0).max(1),
  /** Vetes «de catedral» (arcs). */
  figure: z.number().int().min(0).max(8),
  /** Porus (traços curts). */
  pores: z.number().int().min(0).max(5000),
  /** Gra fi (soroll). */
  grain: z.number().min(0).max(30),
  /** Mida real d'una repetició (mm). */
  tileMm: z.number().min(200).max(4000),
  /** Llavor: cada número fa una variació diferent amb els mateixos paràmetres. */
  seed: z.number().int().min(1),
})
export type WoodGen = z.infer<typeof WoodGenSchema>

/** Paràmetres inicials de cada espècie (punt de partida del generador). */
export const WOOD_PRESETS: Record<"oak" | "walnut" | "ash", WoodGen> = {
  oak: { base: "#d6b684", dark: "#a88354", lines: 26, wobble: 0.06, bands: 26, contrast: 0.5, figure: 2, pores: 2200, grain: 8, tileMm: 600, seed: 101 },
  walnut: { base: "#6e4e34", dark: "#422a1a", lines: 22, wobble: 0.05, bands: 26, contrast: 0.5, figure: 2, pores: 1400, grain: 8, tileMm: 600, seed: 202 },
  ash: { base: "#e4d6b8", dark: "#baa47e", lines: 18, wobble: 0.09, bands: 26, contrast: 0.5, figure: 3, pores: 2200, grain: 8, tileMm: 600, seed: 303 },
}

export const FinishSchema = z.discriminatedUnion("kind", [
  /** Color llis o lacat; `roughness` (0 mirall, 1 mat) per al brillant. */
  z.object({ kind: z.literal("color"), color: z.string(), roughness: z.number().min(0).max(1).optional() }),
  z.object({ kind: z.literal("lacquer"), color: z.string(), roughness: z.number().min(0).max(1).optional() }),
  /** Fusta procedural: l'espècie és el punt de partida; `gen`, els paràmetres del generador. */
  z.object({ kind: z.literal("wood"), species: z.enum(["oak", "walnut", "ash"]), gen: WoodGenSchema.optional() }),
  /** Pedra o marbre procedural: color, vetes i mida real. */
  z.object({
    kind: z.literal("stone"),
    color: z.string(),
    vein: z.string(),
    veins: z.number().min(0).max(1),
    size: mm.min(100).max(4000),
    seed: z.number().int().min(1),
    /** Tipus: marbre (vetes), granit (gra de tres colors), travertí (franges i porus) o formigó (núvols i porus). */
    style: z.enum(["marble", "granite", "travertine", "concrete"]).optional(),
    /** Gra o porus (0–1). */
    grain: z.number().min(0).max(1).optional(),
    /** Polit (0 mat, 1 brillant). */
    polish: z.number().min(0).max(1).optional(),
  }),
  /** Metall (ferro, inox, llautó): brillant i reflectant. */
  z.object({
    kind: z.literal("metal"),
    color: z.string(),
    /** Acabat: polit (mirall), raspallat (ratlles fines) o martellejat (cops). */
    surface: z.enum(["polished", "brushed", "hammered"]).optional(),
    /** Rugositat (0 mirall, 1 mat) i intensitat del raspallat o dels cops. */
    roughness: z.number().min(0).max(1).optional(),
    strength: z.number().min(0).max(1).optional(),
  }),
  /** Vidre: translúcid. */
  z.object({
    kind: z.literal("glass"),
    color: z.string(),
    /** Opacitat (0 invisible, 1 opac) i glaçat (0 transparent, 1 mat). */
    opacity: z.number().min(0.05).max(0.95).optional(),
    frost: z.number().min(0).max(1).optional(),
  }),
  /** Teixit (sofàs, cortines, catifes): trama procedural del color. Materials de simulació. */
  z.object({
    kind: z.literal("fabric"),
    color: z.string(),
    /** Fils per repetició (trama més fina o més grossa), irregularitat dels fils i mida real (mm). */
    threads: z.number().int().min(8).max(240).optional(),
    slub: z.number().min(0).max(1).optional(),
    tileMm: mm.min(20).max(2000).optional(),
  }),
  /** Rajola: peces quadrades de `size` mm amb junta. Materials de simulació (terres, parets). */
  z.object({
    kind: z.literal("tiles"),
    color: z.string(),
    grout: z.string(),
    size: mm.min(20).max(1500),
    /** Gruix de la junta (mm), variació de to entre peces i col·locació (quadrícula o trencajunts). */
    joint: mm.min(0).max(30).optional(),
    variation: z.number().min(0).max(0.4).optional(),
    layout: z.enum(["grid", "brick"]).optional(),
  }),
  /**
   * Foto real del tauler (textura): imatge reduïda en data URL i l'amplada real que hi surt
   * (mm), perquè la veta tingui la mida de debò al 3D.
   */
  z.object({
    kind: z.literal("image"),
    /** Data URL (foto pròpia) o fitxer de l'app (`textures/<id>/diff.jpg`, jocs de `textureSets.ts`). */
    src: imageSrc,
    /** Mapes PBR opcionals (mateix format): normal (convenció OpenGL) i rugositat (canal G). */
    normalMap: imageSrc.optional(),
    roughMap: imageSrc.optional(),
    /**
     * El normal de l'usuari venia en convenció DirectX: se n'ha invertit el verd en carregar-lo (el desat ja és
     * OpenGL). Només recorda l'interruptor «Invertir el verd».
     */
    normalDx: z.boolean().optional(),
    /** Amplada de tauler de debò que mostra la foto (mm, d'esquerra a dreta). */
    tileMm: mm.min(50).max(5000),
    /** Alçada ÷ amplada de la foto: l'alçada real és tileMm × aspect (sense, quadrada). */
    aspect: z.number().positive().optional(),
    /** Textura feta per repetir (seamless): es repeteix normal; si no, en mirall (sense costures). */
    seamless: z.boolean().optional(),
    /** Direcció de la veta a la foto: `y` = vertical (es gira perquè vagi com la de la peça); sense, horitzontal. */
    grain: z.enum(["x", "y"]).optional(),
    /** Multiplicador del mapa de rugositat (o rugositat, sense mapa). */
    roughness: z.number().min(0).max(2).optional(),
    /** Color mitjà de la foto (STEP, mostres). */
    color: z.string().optional(),
  }),
])
export type Finish = z.infer<typeof FinishSchema>

export const MaterialPrefSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Cal un nom"),
  thicknesses: z.array(mm.min(3, "Gruix entre 3 i 60 mm").max(60, "Gruix entre 3 i 60 mm")).min(1, "Cal almenys un gruix"),
  hasGrain: z.boolean(),
  finish: FinishSchema,
  /**
   * Acabats d'abans per tipus (`kind` → acabat): en canviar l'Acabat es guarda el que hi havia i, si es torna
   * a aquell tipus, es recupera (p. ex. la foto amb els mapes de relleu). Només aspecte, no fabricació.
   */
  previousFinishes: z.record(z.string(), FinishSchema).optional(),
  /** Cantell per defecte (nom lliure: "PVC blanc 1 mm", "Xapa de roure"). */
  edge: z.string(),
  /** Apte per a fons (DM 10, contraxapat...). */
  forBacks: z.boolean().optional(),
  /**
   * false: no es talla a la CNC (ferro, pedra, vidre…). Les peces lliures d'aquest material
   * no van al nesting: surten a «Elements sense nesting».
   */
  cnc: z.boolean().optional(),
  /**
   * Massís (fusta massissa): les peces d'aquest material **no es cantegen** (cap cantell al llistat, al CSV ni al
   * LLEGEIX-ME; al 3D, el cantell és el mateix material). Per decisió de l'usuari (2026-10-13). Sense: es canteja.
   */
  solid: z.boolean().optional(),
  /**
   * Categoria (Preferències › Materials i selectors). Sense: es dedueix (`materialCategory`).
   * `sim` = de simulació: només es veu (blocs i parets dels ambients, coixins…), no es fabrica.
   */
  category: z.enum(["board", "back", "hard", "sim"]).optional(),
  /**
   * Render: llum que emet (radiància, ~1 paper blanc al sol tènue; pantalla de làmpada ≈ 4,
   * bombeta ≈ 30). Al visor es veu encès. v5.
   */
  glow: z.number().min(0).max(200).optional(),
  /** Render: translucidesa (0–1), llum difusa que passa a l'altra cara (fulles, cortines, pantalles). v5. */
  translucent: z.number().min(0).max(1).optional(),
  /** Render: vernís (0–1), un reflex nítid a sobre (lacat brillant, marbre polit). Sense, el de l'app (`materialCoat`). */
  coat: z.number().min(0).max(1).optional(),
  /** Render: vellut (0–1), la tela s'aclareix a les vores. Sense, el de l'app (`materialSheen`). */
  sheen: z.number().min(0).max(1).optional(),
})
export type MaterialPref = z.infer<typeof MaterialPrefSchema>

/**
 * Clau per comparar noms de material (únics a Preferències): sense majúscules ni espais repetits o als extrems
 * («Melamina  blanca » = «melamina blanca»).
 */
export function materialNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ca")
}

/**
 * Materials massissos de l'usuari (`MaterialPref.solid`): el constructor no llegeix preferències, així que els posen
 * les preferències en carregar-se i en desar-se (`setSolidMaterials`, `db/settingsStore.ts`), com la prebroca dels
 * jocs. Sense (tests, Node), cap: tot es canteja com sempre.
 */
let SOLID_MATERIALS = new Set<string>()
export function setSolidMaterials(materials: readonly Pick<MaterialPref, "name" | "solid">[]): void {
  SOLID_MATERIALS = new Set(materials.filter((m) => m.solid).map((m) => materialNameKey(m.name)))
}
export const isSolidMaterial = (name: string): boolean => SOLID_MATERIALS.has(materialNameKey(name))

/** Llista de materials amb noms únics (`materialNameKey`): el Zod de les preferències la rebutja si no. */
const MaterialListSchema = z.array(MaterialPrefSchema).min(1).superRefine((list, ctx) => {
  const seen = new Set<string>()
  list.forEach((m, i) => {
    const k = materialNameKey(m.name)
    if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "name"], message: `Nom repetit: «${m.name.trim()}»` })
    seen.add(k)
  })
})
/**
 * Categories: Taulers · Fons · Simulació. «Metall, pedra i vidre» (`hard`, a l'esquema per als desats antics) és
 * Simulació (per decisió de l'usuari: és el mateix, no es tallen a la CNC).
 */
export type MaterialCategory = "board" | "back" | "sim"

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string; hint: string }[] = [
  { id: "board", label: "Taulers", hint: "Es tallen a la CNC: cossos, fronts, taulells." },
  { id: "back", label: "Fons", hint: "Taulers prims per als fons." },
  { id: "sim", label: "Simulació", hint: "No es tallen a la CNC, només es veuen: metall, pedra, vidre, teixits, parquet, pintura… per als ambients i els objectes. Una peça lliure d'aquests materials surt a «Elements sense nesting»." },
]

/** Categoria d'un material: la triada o, als antics, deduïda dels interruptors (`hard` antic = Simulació). */
export function materialCategory(m: Pick<MaterialPref, "category" | "forBacks" | "cnc">): MaterialCategory {
  const c = m.category ?? (m.forBacks ? "back" : m.cnc === false ? "sim" : "board")
  return c === "hard" ? "sim" : c
}

/** Canvia la categoria d'un material mantenint coherents `forBacks` i `cnc`. */
export function withCategory(m: MaterialPref, category: MaterialCategory): MaterialPref {
  const { forBacks: _f, cnc: _c, category: _k, ...rest } = m
  return { ...rest, category, ...(category === "back" ? { forBacks: true } : {}), ...(category === "sim" ? { cnc: false } : {}) }
}

// --- Taulers i nesting ---------------------------------------------------------------

const SheetPrefSchema = z.object({
  /** Material al qual s'aplica; buit = tots els altres. */
  material: z.string(),
  w: mm.min(300).max(6000),
  h: mm.min(300).max(6000),
})

const BoardsPrefSchema = z.object({
  sheets: z.array(SheetPrefSchema).min(1),
  kerf: mm.min(0).max(30),
  margin: mm.min(0).max(100),
  /** Permetre girar les peces 90° encara que tinguin veta. */
  ignoreGrain: z.boolean(),
})

// --- Jocs, etiquetes, visualització ---------------------------------------------------

export const GapsPrefSchema = z.object({
  outerGap: mm.min(0).max(10),
  betweenGap: mm.min(0).max(10),
  shelfClearance: mm.min(0).max(5),
  shelfSetback: mm.min(0).max(100),
  backClearance: mm.min(0).max(4),
  backSetback: mm.min(0).max(60),
  grooveDepth: mm.min(3).max(15),
  /** Joc de l'ample de la ranura del fons (v32): la ranura = gruix del fons + aquest joc. Es copia a cada mòdul nou. */
  grooveClearance: mm.min(0).max(2),
  /**
   * Peces de dins (v25): divisors i prestatges fixos d'un mòdul dividit (de qualsevol nivell), tants mm menys de llarg
   * (la meitat a cada cap). Es copia a cada mòdul nou (`Carcass.innerClearance`).
   */
  innerClearance: mm.min(0).max(3),
})

const LabelPrefSchema = z.object({ w: mm.min(10).max(300), h: mm.min(10).max(300) })

const DisplayPrefSchema = z.object({ unit: z.enum(["mm", "cm"]) })

/**
 * Models de l'assistent IA (docs/xat-ia.md, comprovats a la documentació de l'API el 2026-10-09): Sonnet per defecte
 * (més barat i ràpid), Opus per a les feines més difícils. Preus en $ per milió de tokens d'entrada / sortida.
 */
export const ASSISTANT_MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", price: "2 $ / 10 $", hint: "ràpid i més barat" },
  { id: "claude-opus-5-5", label: "Opus 5.5", price: "4 $ / 20 $", hint: "el més capaç, el doble de car" },
] as const
type AssistantModel = (typeof ASSISTANT_MODELS)[number]["id"]

/**
 * Assistent IA (v26): la clau de l'API de Claude de l'usuari (el navegador crida l'API directament; només es desa en
 * aquest dispositiu, mai a l'export ni al `.moble`) i el model.
 */
export const AssistantPrefSchema = z.object({
  apiKey: z.string().optional(),
  model: z.enum(ASSISTANT_MODELS.map((m) => m.id) as [AssistantModel, ...AssistantModel[]]),
})
export type AssistantPref = z.infer<typeof AssistantPrefSchema>

export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  references: z.array(RefPresetSchema),
  materials: MaterialListSchema,
  boards: BoardsPrefSchema,
  /**
   * Biblioteca de ferratges (v19): frontisses, guies, espigues… com a dades (`core/model/hardware.ts`). Abans eren uns
   * números (`hardware`); la migració en fa els items inicials amb aquells números.
   */
  hardwareLibrary: z.array(HardwareItemSchema),
  /** Quin item de la biblioteca fa servir cada lloc als mòduls nous (`HARDWARE_SLOTS`). */
  hardwareDefaults: HardwareDefaultsSchema,
  /** Regla del taller «prebroca dels cargols» dels jocs (una sola font; els jocs de la biblioteca i les còpies la segueixen). */
  kitPilot: KitPilotSchema,
  gaps: GapsPrefSchema,
  label: LabelPrefSchema,
  display: DisplayPrefSchema,
  /** Materials per defecte dels mòduls nous (noms de `materials`: es canvien amb el nom, `renameMaterialInSettings`). */
  defaults: z.object({ material: z.string(), thickness: mm, backMaterial: z.string(), backThickness: mm }),
  /** Màquines CNC importades de Maestro (v10). */
  machines: z.array(MachineSchema),
  /**
   * Regles de mecanitzat del taller (v11): les mateixes per a totes les màquines (per decisió de l'usuari: «en un taller
   * les regles són les mateixes per a les dues CNC»). Les eines van pel nom a la màquina que exporta (`findRuleTool`).
   * Abans eren per màquina (`Machine.rules`): la migració agafa les de la màquina per defecte.
   */
  machiningRules: MachineRulesSchema,
  /** Assistent IA (v26): clau de l'API i model. La clau no s'exporta (`settingsToJson`). */
  assistant: AssistantPrefSchema,
  /**
   * Opcions en cascada (v48): per id del registre (`OPTION_CASCADE`), si s'amaga a l'Editor i el valor per defecte dels
   * mòduls, compartiments i peces nous. Els mobles fets no canvien.
   */
  optionPrefs: OptionPrefsSchema,
})
export type Settings = z.infer<typeof SettingsSchema>
