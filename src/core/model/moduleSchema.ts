import { z } from "zod"
import { ProfileNodeSchema } from "./panel"
import { PieceEditsSchema } from "./pieceEdits"
import { VIEW_FLAGS } from "./viewFlags"
import { HardwareItemObjectSchema, ModuleHardwareKitSchema, sanitizeImportedHardware, migrateModuleHardware, type HardwareItem } from "./hardware"
import { repairAtomically } from "./repair"
import { KitOptionsSchema, type KitOptions } from "./hardwareKit"
import type { RefObject } from "./compositionSchema"

/**
 * Model de composició: mòduls d'esquerra a dreta, cadascun amb una carcassa i un
 * arbre de zones (divisions i continguts). Totes les mides en mm.
 */

const mm = z.number().finite()
const sizeOrAuto = z.union([mm.positive(), z.literal("auto")])

// --- Ferratges per defecte ---------------------------------------------------------

/**
 * Ferratges del mòdul: una còpia dels items de la biblioteca (`ModuleHardware`, `core/model/hardware.ts`). Els mòduls desats
 * abans de la v19 hi porten els números d'abans: es converteixen en llegir-los (`migrateModuleHardware`), amb els mateixos
 * números (res no canvia de lloc).
 */
const ModuleHardwareSchema = z.preprocess(migrateModuleHardware, ModuleHardwareKitSchema)

// --- Carcassa ----------------------------------------------------------------------

/**
 * El ferratge propi d'un front (o la pota de la base) es llegeix **sencer o res** (`repairAtomically`): si és dolent (un
 * paràmetre que no és un número, un motor d'una versió més nova, un mecanitzat dolent) es treu i el front fa servir el del
 * mòdul; reparat camp a camp en quedaria mig (menys mecanitzats) i el front es fabricaria diferent sense dir-ho.
 */
const FrontHardwareSchema = repairAtomically(z.preprocess(sanitizeImportedHardware, HardwareItemObjectSchema))
/** Una còpia d'un ferratge de la biblioteca, llegida sencera o res (la pota i el sòcol del suport del moble). */
export const HardwareCopySchema = FrontHardwareSchema

/** Un ferratge triat o «Cap» (`"none"`): sense, el del mòdul («Com el mòdul»). */
const HardwareOrNoneSchema = z.union([FrontHardwareSchema, z.literal("none")])

/**
 * Sòcol de la base «Potes» (per decisió de l'usuari, 2026-10-14; els costats i l'alumini, 2026-10-15): sempre al davant,
 * a `setback` del davant del mòdul; opcionalment també al darrere i als laterals (`back`, `left`, `right`, a
 * `sideSetback` de cada cara; sense, la mateixa retirada del davant), amb les cantonades a tope (el davant i el darrere
 * passen per davant) o a inglet. De fusta (un tauler del gruix i material del cos, de terra fins a 5 mm sota la base) o,
 * amb `hardware`, un **sòcol d'alumini** de la biblioteca (motor `plinthProfile`, ferratge per metres): perfils tallats a
 * mida, clips a les potes i cantoneres (`core/build/plinth.ts`). Les mateixes opcions al sòcol corregut (`PlinthRun`).
 */
export const PlinthSidesSchema = z.object({
  back: z.boolean().optional(),
  left: z.boolean().optional(),
  right: z.boolean().optional(),
  sideSetback: mm.min(0).max(200).optional(),
  corners: z.enum(["butt", "mitre"]).optional(),
  hardware: FrontHardwareSchema.optional(),
})

export const BaseSchema = z.discriminatedUnion("kind", [
  /** Base a terra (com el mòdul de caixa actual). */
  z.object({ kind: z.literal("none") }),
  /** Sòcol: laterals fins a terra, base aixecada i frontal de sòcol retranquejat. */
  z.object({ kind: z.literal("plinth"), height: mm.positive(), setback: mm.min(0) }),
  /**
   * Potes: cap peça; el mòdul s'aixeca al 3D. `hardware`: la pota triada (còpia d'un item `leg` de la biblioteca, una
   * pota importada): forats a la cara de sota de la base a cada pota; sense, les potes només es veuen.
   */
  z.object({
    kind: z.literal("legs"),
    height: mm.positive(),
    hardware: FrontHardwareSchema.optional(),
    /**
     * Sòcol davant de les potes (per decisió de l'usuari, 2026-10-14): un tauler del gruix del cos, de tota l'amplada del
     * mòdul, a `setback` del davant, de terra fins a 5 mm sota la base (l'alçada del sòcol AXILO = H − 5); es fixa a les
     * potes del davant amb els clips (a mà, sense mecanitzat).
     */
    plinth: PlinthSidesSchema.extend({ setback: mm.min(0).max(200) }).optional(),
  }),
  /**
   * Sense base (d'abans): laterals fins a terra i el buit obert (cobreradiador). És el mateix que `{ kind: "none" }` amb
   * `Carcass.noBottom` (la forma d'ara: la UI ja no l'escriu; `hasBottom`, `visibleModule`).
   */
  z.object({ kind: z.literal("open") }),
  /**
   * Penjat a la paret: ni sòcol ni potes (la base hi és, si no és «Sense base», `Carcass.noBottom`); `height` = alçada de la base del mòdul des del terra. **Penjadors** (v45): un a
   * cada lateral (`hanger`: el triat, «Cap» o, sense, el del mòdul) i la **regleta** de paret on s'enganxen (`rail`:
   * igual; ferratge per metres, tallada a l'amplada dels penjats seguits). Sense penjadors, tampoc regleta.
   */
  z.object({ kind: z.literal("wall"), height: mm.min(0), hanger: HardwareOrNoneSchema.optional(), rail: HardwareOrNoneSchema.optional() }),
])
export type Base = z.infer<typeof BaseSchema>

export const GrillePatternSchema = z.object({
  kind: z.enum(["slotsV", "slotsH", "holes"]),
  slotWidth: mm.positive(),
  slotGap: mm.positive(),
  margin: mm.min(0),
  holeDiameter: mm.positive(),
  holePitch: mm.positive(),
})
export type GrillePattern = z.infer<typeof GrillePatternSchema>

export const DEFAULT_GRILLE: GrillePattern = {
  kind: "slotsV",
  slotWidth: 8,
  slotGap: 8,
  margin: 60,
  holeDiameter: 10,
  holePitch: 16,
}

export const TopSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("full") }),
  /** Tapa escurçada que deixa una ranura d'aire al darrere. */
  z.object({ kind: z.literal("ventSlot"), gap: mm.positive() }),
  z.object({ kind: z.literal("grille"), pattern: GrillePatternSchema }),
  z.object({ kind: z.literal("none") }),
  /**
   * Travessers (cel, 2026-11-07, la tapa del «Buc bàsic» del Taulell i dels mobles d'aigüera): en lloc de la tapa sencera,
   * una tira al davant i, amb `back`, una altra al darrere, de `width` mm de fondària; entre totes dues, obert. Sense el
   * de darrere, el fons encastat puja fins a dalt.
   */
  z.object({ kind: z.literal("rails"), width: mm.min(30).max(600), back: z.boolean() }),
])
export type Top = z.infer<typeof TopSchema>

export const CarcassSchema = z.object({
  width: mm.min(100).max(3000),
  height: mm.min(100).max(2800),
  depth: mm.min(100).max(1200),
  material: z.string(),
  thickness: mm.min(8).max(40),
  /** Material de portes, fronts de calaix, abatibles, reixetes i fronts fixos. Buit = el del cos. */
  frontMaterial: z.string().optional(),
  backMaterial: z.string(),
  backThickness: mm.min(3).max(40),
  /**
   * Material del **fons dels calaixos** (Materials › «Fons del calaix»). Buit = com fins ara: el del fons del mòdul
   * (adaptant-ne el gruix al que demana la guia o el joc) o, sense fons o si el cos fa el gruix, el del cos. El gruix
   * el demana sempre la guia (`bottomThickness`) o el joc (`TB`), no es tria aquí.
   */
  drawerBottomMaterial: z.string().optional(),
  base: BaseSchema,
  /**
   * **Sense base** (per decisió de l'usuari, 2026-10-15: «la base que es pugui treure, perquè igual no necessita la
   * base»): la peça de baix de la caixa no es fa, sigui quin sigui el suport (`base`: a terra, sòcol o penjat; amb potes
   * no compta: s'hi cargolen). Sense, hi és. Les dades d'abans amb `base: { kind: "open" }` són el mateix que
   * `{ kind: "none" }` + `noBottom` (`hasBottom`; `visibleModule` les passa a aquesta forma).
   */
  noBottom: z.boolean().optional(),
  /**
   * Fons: en ranura, cargolat per darrere, encastat (entre laterals, tapa i base, amb espigues:
   * pot ser del mateix tauler que el cos) o sense.
   */
  back: z.enum(["groove", "screwed", "inset", "none"]),
  top: TopSchema,
  /**
   * **Sòcol de dalt** (per petició de l'usuari, 2026-10-20: «el sòcol de la tapa», l'armari fins al sostre): un tauler del
   * gruix del cos, de tota l'amplada, dret sobre la tapa, `height` mm d'alt i retirat `setback` del davant de la caixa.
   * Tapa el buit fins al sostre. D'abans (cas 7 del model únic): només es llegeix, i en obrir el moble passa a la drecera
   * de zones (`addTopPlinth`, `withZonePlinths`); no es fa.
   */
  topFiller: z.object({ height: mm.min(10).max(600), setback: mm.min(0).max(200) }).optional(),
  sides: z.object({ left: z.boolean(), right: z.boolean() }),
  /**
   * El costat (o els dos) sense lateral on toca un altre mòdul, que en fa de lateral: els fronts compten com a aguantats
   * per aquell costat. No el tria ningú: el recalcula `withNeighbourSides` a partir de la posició dels mòduls (lateral
   * compartit, 2026-10-21; abans, només la cantonada en L, `addCorner`).
   */
  corner: z.enum(["left", "right", "both"]).optional(),
  /**
   * Unió de la tapa amb els laterals. Normal (per defecte): la tapa entre laterals, amb
   * espigues. Inglet: tapa i laterals tallats a 45° a la cantonada (no es veu cap cantell),
   * encolats amb lamel·les o Clamex.
   */
  joint: z.enum(["butt", "mitre"]).optional(),
  /**
   * Parets buides: laterals, base i tapa (sencera) fetes com una caixa de dues pells amb
   * llistons a dins i una tira al davant, amb aquest gruix aparent (mm). L'interior (portes,
   * calaixos, prestatges) va igual, contra la pell de dins.
   */
  hollow: z.object({ thickness: mm.min(20).max(300) }).optional(),
  /**
   * Tauler de taula: la tapa va per sobre dels laterals (que fan de potes), sobresurt
   * `overhang` mm per tot el voltant i pot tenir forma (`shape`: perfil de Bézier en mm,
   * s'escala a la mida del tauler). Només amb la tapa sencera.
   */
  tableTop: z.object({ overhang: mm.min(0).max(1000), shape: z.array(ProfileNodeSchema).min(3).optional() }).optional(),
  // Fusteria
  backSetback: mm.min(0).max(60),
  /** Fons encastat: distància del cantell posterior dels laterals al fons (0 = enrasat). */
  backInsetSetback: mm.min(0).max(60).optional(),
  grooveDepth: mm.min(3).max(15),
  /**
   * Joc de l'ample de la ranura del fons (Preferències › Folgances per defecte; per decisió de l'usuari, 2026-10-14:
   * «gruix + 0,8»): la ranura fa el gruix del fons + aquests mm, cap al davant (el cantell de darrere es queda a
   * `backSetback`). Sense (mòduls d'abans), 0: la fabricació no canvia.
   */
  grooveClearance: mm.min(0).max(2).optional(),
  backClearance: mm.min(0).max(4),
  shelfSetback: mm.min(0).max(100),
  /** Trencajunt (el del Taulell): la base, el sostre, els prestatges fixos i les divisions, aquests mm enrere del davant dels laterals. Sense: a ras. */
  breakJoint: mm.min(0).max(20).optional(),
  shelfClearance: mm.min(0).max(5),
  /**
   * Folgança de les peces de dins (Preferències › Folgances per defecte › «Peces de dins»): amb l'arrel dividida, **tots**
   * els divisors i prestatges fixos (de qualsevol nivell, també els de l'arrel) es fan aquests mm més curts de llarg, la
   * meitat a cada cap i centrats (els forats de les unions no es mouen). Sense dividir, els prestatges fixos van sencers;
   * la caixa, mai. Sense valor (mòduls d'abans): 0, la fabricació no canvia. Només compta amb l'arrel dividida
   * (`hasInnerPieces`).
   */
  innerClearance: mm.min(0).max(3).optional(),
  /**
   * **Llum a sota del moble** (per decisió de l'usuari, 2026-10-14: «a sota dels mobles hi posen leds»; com la cuina de
   * casa): la llum de sempre (el perfil LED o un joc de llum del catàleg, `hardware` = còpia pròpia, sense = la del mòdul)
   * a la **cara de sota de la base**, que il·lumina el taulell. Només als penjats i amb potes (`visibleModule`).
   */
  underLight: z.object({ hardware: FrontHardwareSchema.optional() }).optional(),
})
export type Carcass = z.infer<typeof CarcassSchema>

// --- Fronts i zones ----------------------------------------------------------------


/**
 * El tirador d'un front: sense, el del mòdul (`Module.hardware.handle`, o cap si el mòdul és push); una còpia d'un item
 * `barHandle` (p. ex. un d'importat); o **«Cap (push)»** (`"none"`): obertura per pressió, cap forat (`Panel.push`). Als
 * calaixos amb joc, el tancament del joc mana (`kitPush`): push-open ⇒ cap tirador.
 */
const FrontHandleSchema = z.union([FrontHardwareSchema, z.literal("none")])
export type FrontHandle = z.infer<typeof FrontHandleSchema>

export const FrontSchema = z.discriminatedUnion("kind", [
  /** `glass`: porta de vidre amb marc de perfil d'alumini (vitrina): no és de CNC (`glassDoor`); `frame` = el marc triat
   * (còpia d'un item `glassFrame`); sense, el del mòdul (`Module.hardware.glassFrame`, o el d'inici). */
  // `hardware`: el ferratge triat per a aquest front (còpia d'un item de la biblioteca: frontissa, guia o braç); sense, el
  // del mòdul (`Module.hardware`). `handle`: el tirador triat (`FrontHandle`); sense, el del mòdul.
  z.object({ kind: z.literal("door"), mode: z.enum(["single", "double"]), hinge: z.enum(["left", "right"]), glass: z.boolean().optional(), frame: FrontHardwareSchema.optional(), hardware: FrontHardwareSchema.optional(), handle: FrontHandleSchema.optional() }),
  // `kit`: les opcions del joc paramètric (tancament, darrere) si `hardware` és un joc de calaix (`drawerKit`); sense, les
  // primeres del joc. Res amagat compta: amb una guia normal no es llegeix (`visibleZone`).
  z.object({
    kind: z.literal("drawers"),
    n: z.number().int().min(1).max(10),
    heights: z.array(sizeOrAuto),
    hardware: FrontHardwareSchema.optional(),
    handle: FrontHandleSchema.optional(),
    kit: KitOptionsSchema.partial().optional(),
    /**
     * Tirador a la part de dalt del front: mm del cantell de dalt a l'eix del tirador (per decisió de l'usuari,
     * 2026-10-13). Sense: centrat. Com a molt, el mig del front.
     */
    handleTop: z.number().min(0).max(1000).optional(),
    /**
     * La guia de cada calaix de baix a dalt (per decisió de l'usuari, 2026-10-14), amb un joc de calaix: la del primer és
     * `hardware` (la «Guia de calaix»); `drawerSlides[i]` (i ≥ 1) és la del calaix i o, `null`, la del de sota.
     */
    drawerSlides: z.array(FrontHardwareSchema.nullable()).max(10).optional(),
    /**
     * Front de vidre (per decisió de l'usuari, 2026-10-20, com l'armari de la foto): cap front de fusta; el vidre és el
     * davant de la caixa, en ranura als laterals del calaix (sense marc). Amb tirador o amb un joc de calaix, avís.
     */
    glass: z.boolean().optional(),
    /**
     * Retirada (mm, per decisió de l'usuari, 2026-10-20): el front, més endins que els altres fronts. Sense: 0, a ras. Si
     * entra a la caixa, el front va dins de la llum. Darrere d'una porta amb massa poca retirada, avís (no es retira sol).
     */
    setback: z.number().min(0).max(300).optional(),
    /**
     * Front metàl·lic del fabricant (per decisió de l'usuari, 2026-10-16: «calaixos sense frontal, tot ferratge»): amb un
     * joc de calaix, cap front de fusta; la comanda del joc el demana. Sense joc, avís (es fa de fusta).
     */
    kitFront: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("flap"),
    dir: z.enum(["down", "up"]),
    /** Abatible de vidre amb marc de perfil d'alumini (vitrina, com la porta de vidre): `frame` = el marc triat. */
    glass: z.boolean().optional(),
    frame: FrontHardwareSchema.optional(),
    hardware: FrontHardwareSchema.optional(),
    handle: FrontHandleSchema.optional(),
    /** Tirador: mm del cantell que obre a l'eix (per decisió de l'usuari, 2026-10-13). Sense: el `inset` del tirador. */
    handleInset: z.number().min(0).max(1000).optional(),
  }),
  z.object({
    kind: z.literal("grille"),
    pattern: GrillePatternSchema,
    mount: z.enum(["removable", "hinged"]),
    hinge: z.enum(["left", "right"]),
    /** Trapa petita, en coordenades de la zona (des de baix-esquerra de la llum). */
    hatch: z.object({ x: mm, y: mm, w: mm.positive(), h: mm.positive() }).optional(),
    /** L'imant triat (reixeta desmuntable i trapa; còpia d'un item `magnet`); sense, el del mòdul. */
    hardware: FrontHardwareSchema.optional(),
  }),
  /**
   * Front fix. `setback` (per decisió de l'usuari, 2026-10-20: «el sòcol és una divisió amb un front fix retirat»): el
   * front va dins de la llum (amb la folgança front–cos a cada costat), retirat aquests mm del davant de la caixa, com el
   * sòcol d'un moble. Sense: com els altres fronts (recobrent o encastat, segons el mòdul).
   */
  z.object({ kind: z.literal("panel"), setback: mm.min(0).max(300).optional() }),
])
export type Front = z.infer<typeof FrontSchema>

/**
 * Accessori d'un compartiment (barra de penjar, tira LED): hi és (`{}`) amb el ferratge del mòdul (o el d'inici), o amb
 * una còpia pròpia (`hardware`). Els `true`/`false` d'abans es llegeixen com a `{}` / cap (`ZoneAccessorySchema`).
 */
export interface ZoneAccessory {
  hardware?: HardwareItem
}
const ZoneAccessorySchema = z.preprocess((v) => (v === true ? {} : v === false ? undefined : v), z.object({ hardware: FrontHardwareSchema.optional() }).optional())

/**
 * **Electrodomèstic** d'un compartiment (v46; per petició de l'usuari, 2026-10-15: «un moble sense res ha de poder portar
 * una porta, això és per ficar el rentaplats o la nevera»; `core/build/module/appliances.ts`): `hardware` és la còpia
 * d'un item de la biblioteca (motor `appliance`). Si l'aparell ocupa el compartiment (`fillsNiche`), el compartiment és el
 * nínxol: no fa el seu Front, prestatges ni accessoris (es conserven). Si porta front de moble (`takesFront`): `front`
 * (sense = sí; `false` = sense front, l'aparell a la vista), `hinge` (el costat on obre: les frontisses de la rentadora i
 * del frigorífic de porta lliscant, o el tirador), `plinth` (del terra al cantell de baix del front, als aparells de terra
 * sense peça a sota; sense, 100), `handle` (el tirador del front, com als altres fronts) i `panelMaterial` (v47; per
 * petició de l'usuari: «si és panelable s'hauria de poder ficar el material que va panelat»: el material del front de
 * moble, un nom de Preferències › Materials; sense, el dels fronts del mòdul, com fins ara).
 */
export interface ZoneAppliance {
  hardware: HardwareItem
  front?: boolean
  hinge?: "left" | "right"
  plinth?: number
  handle?: FrontHandle
  panelMaterial?: string
}
const ZoneApplianceSchema = repairAtomically(
  z.object({ hardware: FrontHardwareSchema, front: z.boolean().optional(), hinge: z.enum(["left", "right"]).optional(), plinth: mm.min(0).max(400).optional(), handle: FrontHandleSchema.optional(), panelMaterial: z.string().min(1).optional() }),
)

/** Tipus de front (contingut) d'un compartiment. */
export const FRONT_KINDS = ["door", "drawers", "flap", "grille", "panel"] as const satisfies readonly Front["kind"][]

export interface Zone {
  id: string
  /**
   * `thickness`: divisors gruixuts (buits; per petició de l'usuari, 2026-10-20: «al fer divisions ficar l'opció de
   * gruixuts (buits)»): el gruix aparent (mm) dels divisors (o prestatges fixos) d'aquesta divisió, fets com els
   * prestatges gruixuts: dues pells, llistons i una tira al davant. Sense: del gruix del tauler.
   */
  split?: { dir: "v" | "h"; sizes: (number | "auto")[]; children: Zone[]; thickness?: number }
  shelves?: {
    n: number
    adjustable: boolean
    thickness?: number
    flush?: boolean
    /**
     * Retranqueig dels prestatges d'aquest compartiment (mm, del davant de la caixa al cantell del prestatge; sense: el del
     * mòdul, Mòdul). Amb un pistó d'abatible al lateral, la construcció els retira encara més si cal perquè no hi
     * topin (per decisió de l'usuari, 2026-10-17).
     */
    setback?: number
  }
  front?: Front
  /**
   * L'últim front de cada tipus que ha tingut el compartiment (res amagat compta: canviar el contingut de calaixos a
   * abatible i tornar recupera el nombre de calaixos, les alçades, el joc i les seves opcions, el ferratge i el tirador).
   * Només per a la UI (`setFront`): la construcció no els llegeix (`visibleZone` els treu).
   */
  fronts?: Partial<Record<Front["kind"], Front>>
  /** Barra de penjar (tub d'inox de lateral a lateral, sota el sostre del compartiment; ferratge `rail`). */
  rail?: ZoneAccessory
  /** Llum LED: perfil amb tira LED sota el sostre del compartiment i sota cada prestatge (ferratge `ledProfile`; render i llista; no és de CNC). */
  led?: ZoneAccessory
  /** Electrodomèstic (v46): l'aparell que hi va i, si en porta, el front de moble muntat com diu el fabricant. */
  appliance?: ZoneAppliance
  /** Calaixos interiors, darrere de la porta (`InnerDrawers`). */
  innerDrawers?: InnerDrawers
  /**
   * Fons de la zona (per decisió de l'usuari, 2026-10-21: «agafa el valor del primer, si es canvia en un, que ho faci»):
   * els mateixos 4 valors que el Fons del mòdul. Sense: el de la zona de més amunt (i, a l'Interior, el del mòdul). Tots 4
   * a qualsevol zona: el fons del mòdul s'hi talla i, en ranura, cargolat o encastat, la zona porta el seu, unit a les
   * peces que la tanquen (`zoneBackRegions`).
   */
  back?: Carcass["back"]
  /** Retirada del fons encastat de la zona (mm des del cantell posterior de la caixa). Sense: la de més amunt. */
  backInsetSetback?: number
  /**
   * Costats de la zona sense paret (per decisió de l'usuari, 2026-10-21: «per defecte surten els laterals, però es
   * podrien treure per fer formes»): el divisor o el prestatge fix d'una divisió que la tanca per aquell costat no hi
   * passa (es fa més curt o en dos trossos) i la zona del costat guanya l'espai. Només els que són d'una divisió (la caixa
   * del mòdul es tria a Mòdul; `ZoneBounds.inner`).
   */
  noWalls?: ZoneSide[]
}

/** Un costat d'una zona: esquerra, dreta, a sota, a sobre. */
export type ZoneSide = "left" | "right" | "bottom" | "top"

/**
 * **Calaixos interiors** (per decisió de l'usuari, 2026-10-16: «posar calaixos darrere una porta»): contingut del
 * compartiment, com els prestatges, a baix de tot (els prestatges es reparteixen per sobre). Només es fan darrere d'una
 * porta (la del compartiment o la d'una zona de més amunt). Cada calaix porta un **front interior baix** (de l'alçada de
 * la caixa) **retirat** `setback` mm del davant de la caixa. Sense suplements (per decisió de l'usuari, 2026-10-20: «0
 * casos especials»): el marge per a les frontisses és una zona estreta oberta al costat (`addSideMargin`).
 */
export interface InnerDrawers {
  n: number
  /** Alçada de cada calaix (mm, el lloc que ocupa: la caixa és una mica més baixa, com els calaixos de sempre). */
  height: number
  /**
   * Alçada a mida de cada calaix, de baix a dalt (sense, o un que falti: `height`). Per decisió de l'usuari, 2026-10-20:
   * els calaixos interiors amb les mateixes opcions que els de fora (`innerDrawerHeights`).
   */
  heights?: number[]
  /** La guia o el joc (sense: la del mòdul). */
  hardware?: HardwareItem
  kit?: Partial<KitOptions>
  /** Com `Front.drawerSlides`: amb un joc i alçades diferents, la guia de cada calaix (i ≥ 1; `null`, la del de sota). */
  drawerSlides?: (HardwareItem | null)[]
  /** Retirada del front interior des del davant de la caixa (mm; sense: 25, Preferències › Folgances per defecte). */
  setback?: number
  /**
   * El front: de fusta (sense: el front interior baix) o, amb un joc de calaix, **metàl·lic del fabricant** (`"kit"`; per
   * decisió de l'usuari, 2026-10-16: «calaixos sense frontal, tot ferratge»): cap peça de fusta al davant; la comanda del
   * joc diu que cal el front interior del fabricant. Amb una caixa de fusta, no compta.
   */
  front?: "kit"
  glass?: boolean
  /**
   * Només a la construcció (`visibleZone`, no es desa): els **Calaixos** d'un compartiment tapat per les portes d'una zona
   * de més amunt (per decisió de l'usuari, 2026-10-20: «si el Front tingués les opcions, no farien falta els calaixos
   * interiors»). Les alçades del front de calaixos («auto» reparteix): omplen tot el compartiment, com els de fora.
   */
  sizes?: (number | "auto")[]
  /** Només a la construcció (`visibleZone`): el front de Calaixos del compartiment tapat, tal com és (regla 1). */
  drawers?: Extract<Front, { kind: "drawers" }>
}

export const ZoneSchema: z.ZodType<Zone> = z.lazy(() =>
  z.preprocess(migrateInnerDrawers, z.object({
    id: z.string(),
    split: z
      .object({
        dir: z.enum(["v", "h"]),
        sizes: z.array(sizeOrAuto),
        children: z.array(ZoneSchema).min(2),
        thickness: mm.min(20).max(200).optional(),
      })
      .optional(),
    shelves: z
      .object({
        n: z.number().int().min(0).max(20),
        adjustable: z.boolean(),
        /**
         * Prestatges gruixuts (buits): gruix aparent en mm. Dues pells, llistons i una tira al
         * davant, com les parets buides. Sense: del gruix del tauler.
         */
        thickness: mm.min(20).max(200).optional(),
        /** A ras del davant de la caixa (a sang), sense retranqueig: per als compartiments oberts. */
        flush: z.boolean().optional(),
        setback: mm.min(0).max(300).optional(),
      })
      .optional(),
    front: FrontSchema.optional(),
    fronts: z.preprocess(dropMismatchedFronts, z.object({ door: FrontSchema.optional(), drawers: FrontSchema.optional(), flap: FrontSchema.optional(), grille: FrontSchema.optional(), panel: FrontSchema.optional() })).optional(),
    rail: ZoneAccessorySchema,
    led: ZoneAccessorySchema,
    appliance: ZoneApplianceSchema.optional(),
    innerDrawers: z
      .object({
        n: z.number().int().min(1).max(10),
        height: mm.min(60).max(1000),
        heights: z.array(mm.min(60).max(1000)).max(10).optional(),
        hardware: FrontHardwareSchema.optional(),
        kit: KitOptionsSchema.partial().optional(),
        drawerSlides: z.array(FrontHardwareSchema.nullable()).max(10).optional(),
        setback: mm.min(0).max(100).optional(),
        front: z.literal("kit").optional(),
        glass: z.boolean().optional(),
      })
      .optional(),
    back: z.enum(["groove", "screwed", "inset", "none"]).optional(),
    backInsetSetback: mm.min(0).max(600).optional(),
    noWalls: z.array(z.enum(["left", "right", "bottom", "top"])).max(4).optional(),
  })),
)

/**
 * Els **Calaixos interiors** d'abans (`innerDrawers`, una opció pròpia) passen a ser el que són amb el model únic
 * (2026-10-20, regla 3: el front d'una zona dividida tapa, no esborra): una zona amb Contingut «Calaixos». Si el
 * compartiment no tenia res més, els calaixos són el seu Front (els tapa la porta de més amunt); si tenia la seva porta o
 * prestatges a sobre, es divideix en horitzontal: els calaixos a baix, la resta a dalt, i la porta tapa totes dues.
 */
function migrateInnerDrawers(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw
  const z = raw as Record<string, unknown> & { id?: unknown; innerDrawers?: Record<string, unknown>; split?: unknown; front?: unknown; shelves?: unknown; rail?: unknown; led?: unknown }
  const d = z.innerDrawers
  if (!d || typeof d !== "object" || z.split || typeof z.id !== "string") return raw
  const n = typeof d.n === "number" ? d.n : 1
  const height = typeof d.height === "number" ? d.height : 150
  const hs = Array.from({ length: n }, (_, i) => (Array.isArray(d.heights) && typeof d.heights[i] === "number" ? (d.heights[i] as number) : height))
  const front: Record<string, unknown> = { kind: "drawers", n, heights: [...hs.slice(0, n - 1), "auto"], setback: typeof d.setback === "number" ? d.setback : 25 }
  for (const k of ["hardware", "kit", "drawerSlides", "glass"] as const) if (d[k] !== undefined) front[k] = d[k]
  if (d.front === "kit") front.kitFront = true
  const { innerDrawers: _d, ...rest } = z
  const busy = (z.shelves && typeof z.shelves === "object" && ((z.shelves as { n?: number }).n ?? 0) > 0) || !!z.rail || !!z.led
  if (!z.front && !busy) return { ...rest, front }
  const { front: own, shelves, rail, led, ...parent } = rest
  const top: Record<string, unknown> = { id: `${z.id}-a` }
  if (shelves !== undefined) top.shelves = shelves
  if (rail !== undefined) top.rail = rail
  if (led !== undefined) top.led = led
  return {
    ...parent,
    ...(own ? { front: own } : {}),
    split: { dir: "h", sizes: [hs.reduce((a, b) => a + b, 0), "auto"], children: [{ id: `${z.id}-c`, front }, top] },
  }
}

/** Un front recordat sota la clau d'un altre tipus (dada tocada) no es llegeix. */
function dropMismatchedFronts(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "object" && v !== null && (v as { kind?: unknown }).kind === k) out[k] = v
  return out
}

/**
 * Passacables: forat passant al centre (x, y) d'una peça de la carcassa, en coordenades
 * del mòdul segons la peça: fons → x des de l'esquerra, y des de baix; tapa i base → x des
 * de l'esquerra, y des del darrere; laterals → x des del darrere, y des de baix.
 * Rodó (Ø) o rectangular (w × h: w en la direcció de x). Amb `ref`, el centre segueix
 * l'objecte de referència (x i y es recalculen en construir la composició).
 */
export const CableHoleSchema = z.object({
  panel: z.enum(["back", "top", "bottom", "left", "right"]),
  x: mm,
  y: mm,
  diameter: mm.positive(),
  shape: z.enum(["circle", "rect"]).optional(),
  w: mm.positive().optional(),
  h: mm.positive().optional(),
  ref: z.string().optional(),
})
export type CableHole = z.infer<typeof CableHoleSchema>

/**
 * Centre (i mida de l'objecte, per a «mida de l'objecte») d'un objecte de referència
 * projectat sobre una peça de la carcassa, en les coordenades del passacables.
 * `at` = cantonada baix-esquerra-darrere del mòdul a la composició.
 */
export function refOnPanel(r: RefObject, panel: CableHole["panel"], at: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
  const cx = r.x + r.w / 2 - at.x
  const cy = r.y + r.h / 2 - at.y
  const cz = r.z + r.d / 2
  if (panel === "back") return { x: cx, y: cy, w: r.w, h: r.h }
  if (panel === "top" || panel === "bottom") return { x: cx, y: cz, w: r.w, h: r.d }
  return { x: cz, y: cy, w: r.d, h: r.h }
}

/** Mecanitzats extra de la carcassa que no depenen de cap zona. */
const CarcassExtrasSchema = z.object({
  /** Passacables (forats passants) a les peces de la carcassa. */
  cableHoles: z.array(CableHoleSchema),
})

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  ...VIEW_FLAGS,
  /** Grup (nom), el mateix espai de noms que el de les peces lliures i els models: es mouen, s'amaguen i es bloquegen junts. */
  group: z.string().optional(),
  /** Retocs a mà de les seves peces, per l'id de la peça dins del mòdul (`pieceEdits.ts`): es conserven en refer el mòdul. */
  pieceEdits: PieceEditsSchema.optional(),
  /**
   * **Tipus** (per decisió de l'usuari, 2026-10-15: «canviem Posició per tipus de moble»): Baix, Columna o Electrodomèstic
   * triats a mà; el Penjat és el de la base «wall». Sense, es dedueix (`moduleType`): electrodomèstic si el mòdul ho és,
   * columna si fa 1.200 mm o més d'alçada, baix si no.
   */
  type: z.enum(["base", "tall", "appliance"]).optional(),
  /** Separació respecte al mòdul anterior de la seva fila (o a l'origen si és el primer). */
  gapBefore: mm.min(0),
  /**
   * Només a terra. Sense: «A la paret» (arrambat, el darrere tocant la paret). Amb valor:
   * «Al terra», lliure: a aquesta distància de la paret (mm) i es mou pel terra.
   */
  wallGap: mm.min(0).optional(),
  /**
   * D'esquena a la paret d'un costat (girat i al primer o l'últim lloc de la fila, `wallSides`): la distància des de la
   * paret del fons, al llarg de la del costat (per decisió de l'usuari, 2026-10-22: «primer ha de mirar la posició»). Es
   * mou per aquella paret com els altres per la del fons.
   */
  sideAlong: mm.min(0).optional(),
  /**
   * Només «Lliure al terra»: girat 180° al voltant del vertical (els fronts miren enrere), per fer una illa amb dos mòduls
   * d'esquena (per decisió de l'usuari, 2026-10-13). El mòdul es construeix igual; només canvia com es col·loca
   * (`buildComposition`, al voltant del centre de la caixa de les seves peces: ocupa el mateix lloc). Res amagat compta:
   * en un altre muntatge no es llegeix (`moduleRot`).
   */
  turned: z.boolean().optional(),
  /**
   * Cap on miren els fronts: el gir al voltant del vertical, en graus (vist de dalt, antihorari: amb 90 els fronts miren a
   * la dreta, +X; amb 270, a l'esquerra), per posar un mòdul a l'extrem d'una illa (per decisió de l'usuari, 2026-10-16) i,
   * des del 2026-10-20, en qualsevol muntatge (arrambat i penjat, 90 o 270; 180 només lliure al terra). Mana sobre `turned`
   * (el 180 d'abans). Es construeix igual i es gira: lliure, al voltant del centre de la caixa de les seves peces; a la fila,
   * al del seu lloc, amb un lateral a la paret (`moduleRot`, `modulePlacements`).
   */
  rot: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional(),
  /**
   * Només «Al terra» (lliure): posició X pròpia (mm des de l'origen). No segueix la fila ni
   * n'empeny els altres: així es pot posar una illa davant de la cuina. Sense: segueix la fila.
   */
  x: mm.optional(),
  carcass: CarcassSchema,
  root: ZoneSchema,
  fronts: z.object({
    outerGap: mm.min(0).max(10),
    betweenGap: mm.min(0).max(10),
    /**
     * Com van els fronts respecte a la caixa. Recobrents (per defecte): per davant, tapant els
     * cantells dels laterals. Encastats: dins de la llum, a nivell amb el davant de la caixa.
     */
    style: z.enum(["overlay", "inset"]).optional(),
    /** Tiradors: barra (per defecte, dos forats Ø5) o cap (obertura per pressió: cal un ferratge push). */
    handles: z.enum(["bar", "none"]).optional(),
  }),
  hardware: ModuleHardwareSchema,
  extras: CarcassExtrasSchema,
  /**
   * OBSOLET: ancoratge a un altre mòdul (versions anteriors). Ja no es crea: en carregar
   * es converteix a les dues files amb `normalizeComposition`.
   */
  anchor: z
    .object({
      module: z.string(),
      dx: mm,
      /** On es col·loca respecte a l'altre: a sobre (per defecte), a la dreta o a l'esquerra. */
      at: z.enum(["top", "right", "left"]).optional(),
    })
    .optional(),
})
export type Module = z.infer<typeof ModuleSchema>
