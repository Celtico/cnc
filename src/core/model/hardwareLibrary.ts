import { repairValue } from "./repair"
import type { StepRule } from "./hardwareOps"
import { KIT_PILOT_PARAMS, type HardwareKit } from "./hardwareKit"
import { DTC_HINGES } from "./dtc/dtcHinges"
import { DTC_SUPPORTS } from "./dtc/dtcMisc"
import { DTC_PLATES } from "./dtc/dtcPlates"
import { DTC_SLIDES } from "./dtc/dtcSlides"
import { DTC_DRAGON_PRO_KITS } from "./kits/dtcDragonPro"
import { DTC_MAGIC_PRO_KITS } from "./kits/dtcMagicPro"
import { DTC_MAGIC_STAR_KITS } from "./kits/dtcMagicStarUltra"
import { DTC_PURE_BOX_KITS } from "./kits/dtcPureBox"
import { DTC_PURE_PRO_GLASS_KITS, DTC_PURE_PRO_KITS } from "./kits/dtcPurePro"
import { HAFELE_LOOX_ITEMS, HAFELE_LOOX_PROFILES } from "./lights/hafeleLoox"
import { HAFELE_CATALOGUE_ITEMS, HAFELE_DUOMATIC_ALU, HAFELE_DUOMATIC_ALU_NARROW, HAFELE_GAS_STRUTS, HAFELE_GLASS_PULLS, HAFELE_PROFILE_HINGES } from "./hafele/hafeleCatalog"
import { HAFELE_LEGS } from "./hafele/hafeleLegs"
import { HANGER_ITEM, PLINTH_PROFILE_ITEMS, WALL_RAIL_ITEM } from "./hangingHardware"
import { APPLIANCE_ITEMS } from "./appliances/applianceCatalog"
import type { Appliance } from "./appliance"
import { DEFAULT_LEGACY_HARDWARE, HARDWARE_SLOTS, LegacyHardwareSchema, slotAccepts, slotOf, type HardwareDefaults, type HardwareEngine, type HardwareItem, type HardwareSlot, type LegacyHardware, type ModuleHardware } from "./hardwareSchema"

/** Una còpia amb tots els llocs (la d'un mòdul nou, `kitFrom`). */
type FullModuleHardware = Required<ModuleHardware>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

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

/**
 * Els jocs inicials de l'app, llegits del catàleg DTC 2026 (`docs/ferratges-jocs.md`): MAGIC-PRO (HT10–HT14, de la N a
 * la F; el primer, v23), MAGIC-STAR ULTRA (HD11–HD14), DRAGON-PRO (HB01–HB04 i HB0C) i PURE-PRO HK (HK11–HK13) (v27).
 */
export const DEFAULT_HARDWARE_KITS: HardwareItem[] = [...DTC_MAGIC_PRO_KITS, ...DTC_MAGIC_STAR_KITS, ...DTC_DRAGON_PRO_KITS, ...DTC_PURE_PRO_KITS, ...DTC_PURE_PRO_GLASS_KITS, ...DTC_PURE_BOX_KITS].map((k) => kitItem(k.id, k.name, k.kit))

const V27_KIT_IDS = new Set([...DTC_MAGIC_STAR_KITS, ...DTC_DRAGON_PRO_KITS, ...DTC_PURE_PRO_KITS].map((k) => k.id))
/** Els items inicials que la v27 afegeix si no hi són: els jocs nous (els push latch d'aquella versió es van treure a la v29). */
export const V27_ITEMS: HardwareItem[] = DEFAULT_HARDWARE_KITS.filter((k) => V27_KIT_IDS.has(k.id))

/**
 * La resta del catàleg DTC 2026 (v28, `core/model/dtc/`): frontisses de cassoleta i plaques, guies (ocultes, de boles,
 * de rodets), suports de prestatge i els jocs PURE-BOX HL i PURE-PRO HQ (vidre). Només els que un motor de l'app
 * col·loca i mecanitza (per decisió de l'usuari: cap «només 3D»).
 */
export const DTC_CATALOGUE_ITEMS: HardwareItem[] = [...DTC_HINGES, ...DTC_PLATES, ...DTC_SLIDES, ...DTC_SUPPORTS]
const V28_KIT_IDS = new Set([...DTC_PURE_PRO_GLASS_KITS, ...DTC_PURE_BOX_KITS].map((k) => k.id))
/** Els items inicials que la v28 afegeix si no hi són. */
export const V28_ITEMS: HardwareItem[] = [...DEFAULT_HARDWARE_KITS.filter((k) => V28_KIT_IDS.has(k.id)), ...DTC_CATALOGUE_ITEMS]

/**
 * Accessoris inicials (abans eren interruptors de fusta a Prestatges i a la porta; auditoria B): la geometria d'ara, tal
 * qual. **Sense mecanitzat** de moment: els suports de la barra i la ranura del perfil LED al prestatge els ha de dir el
 * taller (el `label` del target ho recorda); les frontisses del marc de vitrina també.
 */
export const ACCESSORY_ITEMS: HardwareItem[] = [
  {
    id: "rail-inox-25",
    name: "Barra de penjar Ø25 inox",
    category: "wall",
    engine: "rail",
    params: { diameter: 25, drop: 50 },
    targets: [{ key: "side", label: "Lateral (suports: mecanitzat pendent del taller)", ops: [] }],
    version: 1,
    builtin: true,
  },
  {
    id: "led-profile-16x8",
    name: "Perfil LED 16 × 8",
    category: "light",
    engine: "ledProfile",
    params: { width: 16, height: 8, setback: 20 },
    targets: [{ key: "shelf", label: "Prestatge (ranura del perfil: pendent del taller)", ops: [] }],
    version: 1,
    builtin: true,
  },
  {
    id: "glass-frame-20",
    name: "Marc d'alumini negre 20 mm",
    category: "profile",
    engine: "glassFrame",
    params: { frame: 20, glass: 5 },
    targets: [{ key: "frame", label: "Marc (frontisses de perfil: pendent del taller)", ops: [] }],
    version: 1,
    builtin: true,
  },
]

/**
 * v54: les unions del Taulell (cel, 2026-11-08: «només tinc una unió»), a «Unions» i triables al lloc de la unió de la caixa
 * (Caixa › Laterals › Unió). Cabineo 12 de Lamello: tres buidats Ø15 encavalcats a la cara de la peça que hi topa, a tocar
 * del cantell, i el cargol Ø5 a l'altra. Cargols: forat passant Ø4 a la peça que continua. Repartits a `margin` dels caps,
 * com a molt cada `pitch`. Els fons encastats i els calaixos continuen amb l'espiga de l'app.
 */
export const V54_ITEMS: HardwareItem[] = [
  {
    id: "cabineo-12",
    name: "Cabineo 12 (Lamello)",
    category: "connector",
    engine: "cabineo",
    params: { pocketD: 15, pocketDepth: 11, first: 3.6, step: 11.2, axis: 5, screwD: 5, screwDepth: 12, margin: 50, pitch: 300 },
    targets: [
      { key: "butt", label: "Peça que porta el connector (cara)", ops: [{ kind: "drill", face: "A", u: 0, v: "first", d: "pocketD", depth: "pocketDepth", tag: "cabineo" }, { kind: "drill", face: "A", u: 0, v: "first+step", d: "pocketD", depth: "pocketDepth", tag: "cabineo" }, { kind: "drill", face: "A", u: 0, v: "first+2*step", d: "pocketD", depth: "pocketDepth", tag: "cabineo" }] },
      { key: "through", label: "Peça que continua (cargol)", ops: [{ kind: "drill", face: "A", u: 0, v: "axis", d: "screwD", depth: "screwDepth", tag: "cabineo" }] },
    ],
    version: 1,
    builtin: true,
  },
  {
    id: "screw-4",
    name: "Cargols Ø4",
    category: "connector",
    engine: "screw",
    params: { d: 4, margin: 50, pitch: 300 },
    targets: [{ key: "through", label: "Peça que continua (forat passant)", ops: [{ kind: "through", u: 0, v: 0, d: "d", tag: "screw" }] }],
    version: 1,
    builtin: true,
  },
]

/** v31: els jocs de llum Häfele Loox (additiu: s'afegeixen si no hi són). */
export const V31_ITEMS: HardwareItem[] = HAFELE_LOOX_ITEMS

/** v34: les potes de sòcol Häfele AXILO 78 (additiu: s'afegeixen si no hi són). */
export const V34_ITEMS: HardwareItem[] = HAFELE_LEGS.filter((x) => x.id === "leg-hafele-axilo78-screw")
/** v41: la frontissa Metallamat A per a perfil d'alumini (la placa de les vitrines, abans dins del marc), additiu. */
export const V41_ITEMS: HardwareItem[] = HAFELE_PROFILE_HINGES
/** v42: els tiradors per a marc de vitrina (es claven al perfil, cap forat), additiu. */
export const V42_ITEMS: HardwareItem[] = HAFELE_GLASS_PULLS
/** v43: la frontissa Häfele Duomatic Premium 105° per a marc d'alumini (additiu). */
export const V43_ITEMS: HardwareItem[] = HAFELE_DUOMATIC_ALU
/** v44: la frontissa Häfele Duomatic 105° per a marc d'alumini estret (additiu). */
export const V44_ITEMS: HardwareItem[] = [...HAFELE_DUOMATIC_ALU_NARROW, ...HAFELE_GAS_STRUTS]
/** v45: el penjador ocult dels mòduls penjats, la regleta de paret i els sòcols d'alumini (ferratges per metres), additiu. */
export const V45_ITEMS: HardwareItem[] = [HANGER_ITEM, WALL_RAIL_ITEM, ...PLINTH_PROFILE_ITEMS]
/** v46: els electrodomèstics del catàleg (Bosch, Balay, Siemens i Teka; `docs/electrodomestic/`), additiu. */
export const V46_ITEMS: HardwareItem[] = APPLIANCE_ITEMS
/** v39: la mateixa pota per a mobles (el davant per confirmar), additiu. */
export const V39_ITEMS: HardwareItem[] = HAFELE_LEGS.filter((x) => x.id !== "leg-hafele-axilo78-screw")

/** v35: perfils d'alumini per a portes de vidre, tiradors, suports de prestatge i el perfil Loox per encastar (Häfele, additiu). */
export const V35_ITEMS: HardwareItem[] = [...HAFELE_CATALOGUE_ITEMS, ...HAFELE_LOOX_PROFILES]

// En l'ordre en què les migracions els afegeixen (v23 jocs, v27 push, v28 catàleg, v31 llums, v34 potes, v35 catàleg Häfele i, al final, els accessoris que falten).
export const DEFAULT_HARDWARE_LIBRARY: HardwareItem[] = [...libraryFromLegacy(DEFAULT_LEGACY_HARDWARE), ...DEFAULT_HARDWARE_KITS, ...DTC_CATALOGUE_ITEMS, ...V31_ITEMS, ...V34_ITEMS, ...V35_ITEMS, ...V39_ITEMS, ...V41_ITEMS, ...V42_ITEMS, ...V43_ITEMS, ...V44_ITEMS, ...V45_ITEMS, ...V46_ITEMS, ...V54_ITEMS, ...ACCESSORY_ITEMS]

/** Un item és un electrodomèstic amb les dades del catàleg (motor `appliance`). */
export const isAppliance = (item: HardwareItem): item is HardwareItem & { appliance: Appliance } => item.engine === "appliance" && !!item.appliance

/** Un item és un joc paramètric que es pot fer servir (motor `drawerKit` amb el joc). */
export const isDrawerKit = (item: HardwareItem): item is HardwareItem & { kit: HardwareKit } => item.engine === "drawerKit" && !!item.kit

export const DEFAULT_HARDWARE_DEFAULTS: Required<HardwareDefaults> = {
  hinge: "hinge-cup",
  system32: "system32",
  dowel: "dowel",
  slide: "slide-ball",
  flap: "flap-arm",
  magnet: "magnet",
  handle: "handle-bar",
  rail: "rail-inox-25",
  led: "led-profile-16x8",
  glassFrame: "glass-frame-20",
  hanger: HANGER_ITEM.id,
  wallRail: WALL_RAIL_ITEM.id,
}

/** Els ferratges inicials d'un mòdul, amb els números d'abans (`Module.hardware` d'un mòdul desat abans de la v19). */
export function kitFromLegacy(h: LegacyHardware): FullModuleHardware {
  const lib = libraryFromLegacy(h)
  return kitFrom(lib, DEFAULT_HARDWARE_DEFAULTS)
}

/** Un kit (còpia) amb els items per defecte de cada lloc (`fixHardwareDefaults` ja garanteix que hi són). */
/** El primer item d'un motor, preferint els de l'app (sense fabricant) als del catàleg DTC (el per defecte d'un lloc). */
export const appItemOfEngine = (list: readonly HardwareItem[], engine: HardwareEngine): HardwareItem | undefined => list.find((x) => x.engine === engine && !x.maker) ?? list.find((x) => x.engine === engine)

export function kitFrom(library: readonly HardwareItem[], defaults: HardwareDefaults): FullModuleHardware {
  const pick = (slot: HardwareSlot): HardwareItem => {
    const engine = slotOf(slot).engine
    const hit = library.find((x) => x.id === defaults[slot] && slotAccepts(slot, x)) ?? appItemOfEngine(library, engine) ?? appItemOfEngine(DEFAULT_HARDWARE_LIBRARY, engine)!
    return structuredClone(hit)
  }
  const out = {} as FullModuleHardware
  for (const { slot } of HARDWARE_SLOTS) out[slot] = pick(slot)
  return out
}

export const DEFAULT_MODULE_HARDWARE: FullModuleHardware = kitFromLegacy(DEFAULT_LEGACY_HARDWARE)

/** L'item d'un lloc d'un mòdul: la seva còpia o, als accessoris sense còpia, l'item d'inici. */
export const moduleSlotItem = (hw: ModuleHardware, slot: HardwareSlot): HardwareItem => hw[slot] ?? DEFAULT_MODULE_HARDWARE[slot]

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
 * Les preferències de ferratges coherents: cada lloc apunta a un item de la biblioteca amb el motor que toca (si no,
 * l'item de l'app que en té —no un del catàleg DTC— i, si no n'hi ha cap, el d'inici, que s'hi torna a afegir). Ids
 * únics (els repetits fora).
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
  const out: Required<HardwareDefaults> = { ...DEFAULT_HARDWARE_DEFAULTS }
  for (const { slot, engine } of HARDWARE_SLOTS) {
    const want = defaults[slot]
    // Sense el triat: l'item de l'app d'aquell motor (sense fabricant), mai un del catàleg DTC; si tampoc hi és,
    // torna el d'inici de l'app.
    const hit = lib.find((x) => x.id === want && slotAccepts(slot, x)) ?? lib.find((x) => x.engine === engine && !x.maker)
    if (hit) {
      out[slot] = hit.id
      if (hit.id !== want) changed = true
      continue
    }
    const builtin = structuredClone(appItemOfEngine(DEFAULT_HARDWARE_LIBRARY, engine)!)
    lib.push(builtin)
    out[slot] = builtin.id
    changed = true
  }
  return { library: lib, defaults: out, changed }
}
