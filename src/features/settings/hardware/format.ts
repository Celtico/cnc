import type { MachiningOp, StepRule } from "../../../core/model"

export const fmt = (e: number | string) => (typeof e === "number" ? String(e).replace(".", ",") : e)
/** Un mecanitzat en una línia: «Ø cupDiameter × cupDepth, cara A (u 0 · v cupOffset)». */
export function opText(op: MachiningOp): string {
  if (op.kind === "edgeDrill") return `Forat de cantell Ø ${fmt(op.d)} × ${fmt(op.depth)} (al llarg ${fmt(op.along)})`
  if (op.kind === "through") return `Forat passant Ø ${fmt(op.d)} (u ${fmt(op.u)} · v ${fmt(op.v)})`
  return `Forat Ø ${fmt(op.d)} × ${fmt(op.depth)}, cara ${op.face} (u ${fmt(op.u)} · v ${fmt(op.v)})`
}

/** Resum d'una regla per graons per a la insígnia («2–5», «64–128 mm»). */
export function stepBadge(rule: StepRule, unit: string): string {
  const all = [...rule.steps.map((x) => x.n), rule.else]
  const lo = Math.min(...all), hi = Math.max(...all)
  return `${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`}${unit}`
}
