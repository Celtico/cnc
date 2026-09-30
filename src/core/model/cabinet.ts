import { z } from "zod"

const mm = z.number().finite()

/** Paràmetres d'un mòdul de caixa. Totes les mides en mm. */
export const CabinetParamsSchema = z.object({
  width: mm.min(100).max(2500),
  height: mm.min(100).max(2800),
  depth: mm.min(100).max(1200),

  panelThickness: mm.min(8).max(40),
  backThickness: mm.min(3).max(40),

  shelves: z.number().int().min(0).max(20),
  doors: z.union([z.literal(0), z.literal(1), z.literal(2)]),

  /** Fons encastat en ranura o cargolat sobreposat al darrere. */
  backType: z.enum(["groove", "screwed"]),

  // --- Fusteria (avançat) ---
  /** Joc entre porta i cos, per costat. */
  doorGap: mm.min(0).max(10),
  /** Joc entre dues portes. */
  doorGapBetween: mm.min(0).max(10),
  /** Retranqueig del front del prestatge respecte al front del cos. */
  shelfSetback: mm.min(0).max(100),
  /** Joc total del prestatge respecte a la llum interior. */
  shelfClearance: mm.min(0).max(5),
  /** Distància de la ranura del fons al cantell posterior (només `groove`). */
  backSetback: mm.min(0).max(60),
  /** Profunditat de la ranura del fons. */
  grooveDepth: mm.min(3).max(15),
  /** Joc total del fons dins de les ranures. */
  backClearance: mm.min(0).max(4),

  hinge: z.object({
    cupDiameter: mm.positive(),
    cupDepth: mm.positive(),
    /** Distància del centre de la cassoleta al cantell de la porta. */
    cupOffset: mm.positive(),
  }),

  system32: z.object({
    /** Distància de la filera al cantell davanter/posterior. */
    edgeOffset: mm.positive(),
    pitch: mm.positive(),
    diameter: mm.positive(),
    depth: mm.positive(),
  }),

  dowel: z.object({
    diameter: mm.positive(),
    /** Profunditat a la cara del lateral. */
    faceDepth: mm.positive(),
    /** Profunditat al cantell de la base/sostre. */
    edgeDepth: mm.positive(),
    /** Distància del primer i darrer forat als cantells. */
    endOffset: mm.positive(),
  }),

  material: z.string(),
  backMaterial: z.string(),
})

export type CabinetParams = z.infer<typeof CabinetParamsSchema>

export const DEFAULT_CABINET: CabinetParams = {
  width: 600,
  height: 720,
  depth: 560,
  panelThickness: 19,
  backThickness: 10,
  shelves: 1,
  doors: 1,
  backType: "groove",
  doorGap: 2,
  doorGapBetween: 3,
  shelfSetback: 20,
  shelfClearance: 1,
  backSetback: 10,
  grooveDepth: 8,
  backClearance: 1,
  hinge: { cupDiameter: 35, cupDepth: 13, cupOffset: 22.5 },
  system32: { edgeOffset: 37, pitch: 32, diameter: 5, depth: 12 },
  dowel: { diameter: 8, faceDepth: 12, edgeDepth: 20, endOffset: 40 },
  material: "Melamina 19",
  backMaterial: "DM 10",
}

/** Valida i completa uns paràmetres parcials amb els valors per defecte. */
export function parseCabinetParams(input: unknown): CabinetParams {
  const merged =
    typeof input === "object" && input !== null
      ? deepMerge(DEFAULT_CABINET, input as Record<string, unknown>)
      : DEFAULT_CABINET
  return CabinetParamsSchema.parse(merged)
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const b = out[k]
    if (isPlainObject(b) && isPlainObject(v)) {
      out[k] = deepMerge(b, v)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out as T
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}
