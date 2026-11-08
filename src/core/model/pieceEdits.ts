import { z } from "zod"
import { EdgeBandingSchema, GrooveSchema, HoleSchema, type Groove, type Hole, type Panel } from "./panel"

/**
 * Retocs a mà d'una peça d'un mòdul (com al Taulell, cel 2026-11-07: «hi poses més mecanitzat i es queda»): el que l'usuari
 * canvia a una peça que fa el mòdul. Es desen al mòdul per l'id de la peça dins del mòdul («side-left», «top-front»...), així
 * que es conserven quan el mòdul es torna a fer (canviar l'amplada, un prestatge més); si la peça deixa d'existir, el retoc
 * no s'aplica. És una regla de tots els mòduls (a Mobles també), no només de Modelatge.
 */
export const PieceEditSchema = z.object({
  /** Cantells canviats (els que no hi són, com els posa el mòdul). */
  edges: EdgeBandingSchema.partial().optional(),
  /** Material de la peça en lloc del que li toca. */
  material: z.string().optional(),
  /** Forats afegits a mà. */
  holes: z.array(HoleSchema).optional(),
  /** Ranures afegides a mà. */
  grooves: z.array(GrooveSchema).optional(),
  /** Mecanitzats del mòdul que es treuen (`machiningKey`). */
  drop: z.array(z.string()).optional(),
})
export type PieceEdit = z.infer<typeof PieceEditSchema>
export const PieceEditsSchema = z.record(z.string(), PieceEditSchema)

/** Els forats o les ranures iguals que fa el mòdul van junts (una línia a l'arbre, es treuen junts). */
export function holeKey(h: Hole): string {
  return `h:${h.tag ?? ""}:${h.diameter}:${h.depth}`
}
export function grooveKey(g: Groove): string {
  return `g:${Math.min(g.w, g.h)}:${g.depth}`
}

/** Etiqueta dels forats i les ranures fets a mà: es distingeixen dels del mòdul (es treuen un a un). */
export const HAND_TAG = "hand"

/** La peça amb els seus retocs. */
export function applyPieceEdit(p: Panel, e: PieceEdit | undefined): Panel {
  if (!e) return p
  const drop = new Set(e.drop ?? [])
  return {
    ...p,
    ...(e.material ? { material: e.material } : {}),
    ...(e.edges ? { edges: { ...p.edges, ...e.edges } } : {}),
    holes: [...p.holes.filter((h) => !drop.has(holeKey(h))), ...(e.holes ?? []).map((h) => ({ ...h, tag: HAND_TAG }))],
    grooves: [...p.grooves.filter((g) => !drop.has(grooveKey(g))), ...(e.grooves ?? []).map((g) => ({ ...g, tag: HAND_TAG }))],
  }
}

/** Un retoc sense res és com no tenir-ne. */
export function isEmptyEdit(e: PieceEdit): boolean {
  return !e.material && !(e.edges && Object.keys(e.edges).length) && !e.holes?.length && !e.grooves?.length && !e.drop?.length
}
