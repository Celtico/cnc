import { setWallEnds, type PlanPt, type Wall } from "../../../core/model"
import { samePt, type View } from "../planGeom"

/** Extrem d'una altra paret enganxat al que s'arrossega (es mira en començar: després només es mouen aquests). */
type Joined = { id: string; end: "a" | "b" }

export type Drag =
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "item"; ids: string[]; start: PlanPt; from: Map<string, PlanPt>; moved: boolean; walls?: Wall[] }
  | { kind: "wall"; id: string; start: PlanPt; a: PlanPt; b: PlanPt; moved: boolean; walls: Map<string, Wall>; joinedA: Joined[]; joinedB: Joined[] }
  | { kind: "end"; id: string; end: "a" | "b"; start: PlanPt; orig: PlanPt; moved: boolean; walls: Map<string, Wall>; joined: Joined[] }
  | { kind: "room"; start: PlanPt; cur: PlanPt }
  | { kind: "plan"; start: PlanPt; x: number; y: number }
  | { kind: "opening"; wallId: string; index: number; start: PlanPt; at: number; moved: boolean }
  | { kind: "ctrl"; id: string; c: "c1" | "c2"; start: PlanPt; orig: PlanPt; moved: boolean }
  | { kind: "pen"; start: PlanPt; at: PlanPt; wallId?: string; moved: boolean }

/** Mou l'extrem de `w` que era a `from` (una paret enganxada a la que s'arrossega). */
/** Extrems d'altres parets que són al punt `p` (enganxats a la paret `except`). */
export function joinedAt(walls: Wall[], p: PlanPt, except: string): Joined[] {
  const out: Joined[] = []
  for (const w of walls) {
    if (w.id === except) continue
    if (samePt(w.a, p)) out.push({ id: w.id, end: "a" })
    if (samePt(w.b, p)) out.push({ id: w.id, end: "b" })
  }
  return out
}

export const wallMap = (walls: Wall[]) => new Map(walls.map((w) => [w.id, w]))

/**
 * La paret amb els extrems nous (`ends`), calculada des de com era en començar a arrossegar (`orig`): les obertures es
 * queden al mateix punt i s'ajusten (`setWallEnds`) sense anar perdent posició pas a pas.
 */
/** La paret sencera desplaçada: els extrems i, corba, els punts de control (les obertures es queden al seu lloc de la paret). */
export function moveWhole(w: Wall, orig: Wall | undefined, a: PlanPt, b: PlanPt, ox: number, oy: number): Wall {
  const c = orig?.curve
  return { ...w, a, b, ...(c ? { curve: { c1: [c.c1[0] + ox, c.c1[1] + oy] as PlanPt, c2: [c.c2[0] + ox, c.c2[1] + oy] as PlanPt } } : {}) }
}

export function movedEnds(w: Wall, orig: Map<string, Wall>, ends: Partial<Record<"a" | "b", PlanPt>> | undefined): Wall {
  if (!ends) return w
  const w0 = orig.get(w.id) ?? w
  const moved = setWallEnds(w0, ends.a ?? w0.a, ends.b ?? w0.b)
  // La resta de camps (material, gruix…) són els d'ara.
  return { ...w, a: moved.a, b: moved.b, ...(moved.openings ? { openings: moved.openings } : {}), ...(moved.curve ? { curve: moved.curve } : {}) }
}
