import { z } from "zod"
import { HardwareCopySchema } from "./moduleSchema"

const mm = z.number().finite()

/** Els costats d'un tram on va el sòcol, a més del davant (que hi és sempre). */
export const TramSidesSchema = z.object({
  back: z.boolean().optional(),
  left: z.boolean().optional(),
  right: z.boolean().optional(),
})
export type TramSides = z.infer<typeof TramSidesSchema>

/**
 * **Suport dels mòduls de terra** (per decisió de l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per
 * a cada un»; «el sòcol no pot anar per cada mòdul, és una peça global»): un sol suport per a tot el moble. Els mòduls de
 * terra el porten (`withSupport` l'escriu a la base de cadascun) i el sòcol és **una peça per tram** (`floorTrams`: els
 * mòduls de terra que es toquen), mai una per mòdul.
 * - `floor`: directe a terra.
 * - `plinth`: **sòcol**: els mòduls sobre potes (`height`, `leg`) i, al davant, el sòcol continu de cada tram (`plinth`).
 * - `legs`: **potes vistes**, sense sòcol.
 */
export const FloorSupportSchema = z.object({
  kind: z.enum(["floor", "plinth", "legs"]),
  /** Alçada de les potes: del terra a la base dels mòduls. */
  height: mm.positive().max(500).default(100),
  /** La pota (una còpia d'un item `leg` de la biblioteca): forats a la base; sense, genèriques que només es veuen. */
  leg: HardwareCopySchema.optional(),
  /** El sòcol (amb `kind: "plinth"`). */
  plinth: z
    .object({
      /** De la cara dels fronts a la cara de davant del sòcol. */
      setback: mm.min(0).max(200),
      /** Retirada dels costats i del darrere (de la cara del lateral o del darrere); sense, la del davant. */
      sideSetback: mm.min(0).max(200).optional(),
      /** Cantonades de la fusta: a tope (per defecte) o a inglet. */
      corners: z.enum(["butt", "mitre"]).optional(),
      /** Sòcol d'alumini de la biblioteca (motor `plinthProfile`, per metres); sense, de fusta. */
      hardware: HardwareCopySchema.optional(),
      /** De fusta: material i gruix; sense, els del cos del primer mòdul del tram. */
      material: z.string().optional(),
      thickness: mm.positive().max(60).optional(),
    })
    .default({ setback: 20 }),
  /**
   * Els costats de cada tram (per l'id d'un dels seus mòduls). Sense: només el davant; un tram lliure al terra (illa),
   * tot el voltant.
   */
  trams: z.record(z.string(), TramSidesSchema).optional(),
})
export type FloorSupport = z.infer<typeof FloorSupportSchema>
