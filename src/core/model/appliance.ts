import { z } from "zod"

/**
 * **Electrodomèstics** (v46, `docs/electrodomestic/README.md`; per petició de l'usuari, 2026-10-15: «posa'ls com a
 * ferratges electrodomèstics amb el seu mecanitzat i guarda la foto per fer la simulació i el render»): un electrodomèstic
 * és un `HardwareItem` de la biblioteca (categoria «Electrodomèstics», motor `appliance`) que porta aquestes dades del
 * catàleg del fabricant (`HardwareItem.appliance`). Un compartiment l'allotja (`Zone.appliance`): el nínxol es comprova
 * amb les mides del catàleg, el front de moble (si en porta) es fa i es munta com diu el fabricant i el que cal mecanitzar
 * al moble (ventilació, retalls) surt del que el catàleg dona. **Res que el catàleg no doni**: un rang sense `min` o sense
 * `max` és obert per aquell costat; el que no hi és, no es comprova (i, si cal, un avís ho diu).
 */

const mm = z.number().finite()

/** Rang del catàleg (mm, kg o cm²): `min`, `max` o tots dos. */
export const RangeSchema = z.object({ min: mm.optional(), max: mm.optional() })
export type Range = z.infer<typeof RangeSchema>

/**
 * Alçada d'un front que depèn del moble (frigorífics BSH: «1041+S», «703+A», «1772+A+S»): el rang més el gruix de la base
 * on seu l'aparell (`plusBase`, la A del catàleg) i/o el de la peça de sobre (`plusTop`, la S).
 */
const FrontRangeSchema = RangeSchema.extend({ plusBase: z.boolean().optional(), plusTop: z.boolean().optional() })
export type FrontRange = z.infer<typeof FrontRangeSchema>

/** Tipus d'electrodomèstic (decideix les regles: què ocupa, si porta front de moble, com es munta). */
const APPLIANCE_KINDS = ["dishwasher", "fridge", "washer", "oven", "microwave", "hob", "hood"] as const
type ApplianceKind = (typeof APPLIANCE_KINDS)[number]

/**
 * Com va el front de moble (el que diu el fabricant; per decisió de l'usuari, 2026-10-15):
 * - `fixed` (porta fixa) i `doorOnDoor` (Teka «Door to Door»): el front es cargola a la porta de l'aparell, sense
 *   frontisses de moble;
 * - `sliding` (porta lliscant): al rentaplats, el front també es cargola a la porta de l'aparell (llisca respecte d'ella);
 *   al frigorífic, el front penja de frontisses de moble (cassoletes, plaques al lateral) i s'uneix a la porta de l'aparell
 *   amb les guies lliscants;
 * - `hinges` (rentadora): el front penja de frontisses que es cargolen a l'aparell (cassoletes al front, les del catàleg).
 */
const APPLIANCE_DOORS = ["fixed", "doorOnDoor", "sliding", "hinges"] as const
type ApplianceDoor = (typeof APPLIANCE_DOORS)[number]

export const ApplianceSchema = z.object({
  kind: z.enum(APPLIANCE_KINDS),
  /** Família del catàleg (`dishwasher_60`, `fridge_column`…; `docs/electrodomestic/appliances.json`). */
  family: z.string().min(1),
  /** On va: sota el taulell (`base`), en columna (`tall`), penjat (`wall`) o al taulell (`worktop`). */
  mount: z.enum(["base", "tall", "wall", "worktop"]),
  /** Sistema de porta (només els que porten front de moble). */
  door: z.enum(APPLIANCE_DOORS).optional(),
  /** L'aparell (mm), per dibuixar-lo: ample, alt i fondo (els que el catàleg dona amb un rang, el mínim). */
  size: z.object({ w: mm.positive(), h: mm.positive(), d: mm.positive() }),
  /** El nínxol que demana (la llum del compartiment). */
  niche: z.object({ w: RangeSchema, h: RangeSchema, d: RangeSchema }).partial().optional(),
  /** Alçada del nínxol en columna (forns BSH: 585-595 en columna, 600-604 sota taulell). */
  tallNicheH: RangeSchema.optional(),
  /** Nínxol en un moble penjat (microones BSH: 362-365, fons ≥ 300). */
  wallNiche: z.object({ h: RangeSchema, d: RangeSchema }).partial().optional(),
  /** El moble on va (campana telescòpica: moble de 600, fons ≥ 300, alçada interior ≥ 420): mides de fora del mòdul. */
  cabinet: z.object({ w: RangeSchema, d: RangeSchema, h: RangeSchema }).partial().optional(),
  /** El front de moble: alçada (un front, o el de baix i el de dalt d'un combi), junta, pes i gruix. */
  front: z
    .object({
      h: FrontRangeSchema.optional(),
      lower: FrontRangeSchema.optional(),
      upper: FrontRangeSchema.optional(),
      joint: mm.min(0).optional(),
      weightKg: RangeSchema.optional(),
      thickness: RangeSchema.optional(),
    })
    .optional(),
  /** Alçada del sòcol (del terra al cantell de baix del front). */
  plinth: RangeSchema.optional(),
  /** Ventilació (cm²): entrada pel sòcol, sortida per dalt al darrere. */
  ventilation: z.object({ inletCm2: mm.positive().optional(), outletCm2: mm.positive().optional() }).optional(),
  /** Retall a la peça de sobre (placa: el taulell) o de sota (grup filtrant: la base del moble penjat). */
  cutout: z.object({ w: RangeSchema, d: RangeSchema, at: z.enum(["top", "bottom"]), fromFront: mm.min(0).optional(), board: RangeSchema.optional() }).optional(),
  /** Foto de l'aparell (camí a `public/`, `appliances/<marca>-<ref>.webp`): la miniatura i la cara vista al 3D i al render. */
  image: z.string().optional(),
  /** D'on surt (catàleg i pàgina del PDF). */
  source: z.object({ doc: z.string(), page: z.number().int().positive() }),
  notes: z.array(z.string()).optional(),
})
export type Appliance = z.infer<typeof ApplianceSchema>

export const APPLIANCE_LABELS: Record<ApplianceKind, string> = {
  dishwasher: "Rentaplats",
  fridge: "Frigorífic",
  washer: "Rentadora",
  oven: "Forn",
  microwave: "Microones",
  hob: "Placa",
  hood: "Campana",
}

export const DOOR_LABELS: Record<ApplianceDoor, string> = {
  fixed: "porta fixa",
  doorOnDoor: "porta sobre porta",
  sliding: "porta lliscant",
  hinges: "frontisses a l'aparell",
}

/** Les famílies del catàleg (`Appliance.family`): la sèrie on s'agrupen a la biblioteca. */
const FAMILY_LABELS: Record<string, string> = {
  dishwasher_60: "Rentaplats 60",
  dishwasher_45: "Rentaplats 45",
  fridge_column: "Frigorífics de columna",
  fridge_undercounter: "Frigorífics sota taulell",
  oven_60: "Forns 60",
  compact_45: "Compactes 45",
  microwave_38: "Microones 38",
  hob: "Plaques",
  hood_telescopic: "Campanes telescòpiques",
  hood_integrated: "Grups filtrants",
  washer_integrated: "Rentadores",
}

/** La sèrie d'un electrodomèstic a la biblioteca (la seva família), o `null` si no n'és. */
export const applianceSeries = (item: { appliance?: Appliance }): { id: string; label: string } | null =>
  item.appliance ? { id: `appliance:${item.appliance.family}`, label: FAMILY_LABELS[item.appliance.family] ?? item.appliance.family } : null

/** Porta front de moble (rentaplats, frigorífics, rentadora): el compartiment el fa amb les regles de l'aparell. */
export const takesFront = (a: Appliance): boolean => a.door !== undefined

/**
 * Ocupa el compartiment (el nínxol): rentaplats, frigorífic, rentadora, forn i microones. Llavors el compartiment no té
 * el seu Front, ni prestatges, ni accessoris, ni es divideix (res amagat compta: es conserven). La placa i la campana no:
 * van a la peça de sobre o de sota i el compartiment conserva el seu contingut (els calaixos sota la placa, la porta del
 * moble de la campana).
 */
export const fillsNiche = (a: Appliance): boolean => a.kind !== "hob" && a.kind !== "hood"

/** Va a terra, davant del sòcol: es pot triar l'alçada del sòcol quan el compartiment no té peça a sota. */
export const standsOnFloor = (a: Appliance): boolean => a.mount === "base" && fillsNiche(a)

/** El front és com una porta (frigorífic, rentadora: tirador vertical al costat que obre) o com un abatible (rentaplats). */
export const doorLikeFront = (a: Appliance): boolean => a.kind === "fridge" || a.kind === "washer"

/** El front penja de frontisses de moble (frigorífic de porta lliscant): cal un lateral o un divisor al costat. */
export const furnitureHinges = (a: Appliance): boolean => a.kind === "fridge" && a.door === "sliding"

/** Sòcol per defecte (del terra al cantell de baix del front) dels aparells de terra sense peça a sota (`ZoneAppliance.plinth`). */
export const DEFAULT_APPLIANCE_PLINTH = 100

/** Quants fronts de moble porta: dos els combis (el de baix i el de dalt), un la resta. */
export const applianceFronts = (a: Appliance): number => (a.front?.lower && a.front.upper ? 2 : 1)

/** «600–604», «≥ 550», «≤ 765» (un rang, en text). */
export function rangeText(r: Range | undefined, unit = "mm"): string {
  if (!r || (r.min === undefined && r.max === undefined)) return "—"
  const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
  const u = unit ? ` ${unit}` : ""
  if (r.min !== undefined && r.max !== undefined) return r.min === r.max ? `${n(r.min)}${u}` : `${n(r.min)}–${n(r.max)}${u}`
  return r.min !== undefined ? `≥ ${n(r.min)}${u}` : `≤ ${n(r.max!)}${u}`
}

/** El valor és dins del rang (amb mig mil·límetre de marge). */
export const inRange = (v: number, r: Range | undefined): boolean => !r || ((r.min === undefined || v >= r.min - 0.5) && (r.max === undefined || v <= r.max + 0.5))

/** «Rentaplats · porta fixa · nínxol 600 × 815–875 × ≥ 550» (la targeta i el selector). */
export function applianceSummary(a: Appliance): string {
  const niche = a.niche ? `nínxol ${rangeText(a.niche.w, "")} × ${rangeText(a.niche.h, "")} × ${rangeText(a.niche.d, "")} mm` : a.cutout ? `retall ${rangeText(a.cutout.w, "")} × ${rangeText(a.cutout.d, "")} mm` : a.cabinet ? `moble ${rangeText(a.cabinet.w, "")} × ${rangeText(a.cabinet.d, "")} mm` : "nínxol no publicat"
  return [APPLIANCE_LABELS[a.kind], a.door ? DOOR_LABELS[a.door] : "sense front de moble", niche].join(" · ")
}
