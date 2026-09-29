import { EDGE_NUMBER, EDGE_SIDES, type Panel } from "../model"

/**
 * Post-processos: el que li toca a cada peça després de sortir tallada del nesting, en
 * l'ordre del taller. Es dedueixen de la peça (no es desen):
 *  - inglet: serra a 45° als cantells `mitres`;
 *  - cantell: cantejadora als cantells folrats;
 *  - forats de cantell: perforadora horitzontal (espigues, excèntriques…);
 *  - encolar: muntar un conjunt abans del moble (p. ex. les parets buides).
 */
export type ProcessKind = "mitre" | "edge" | "edgeDrill" | "glue"

export interface Process {
  kind: ProcessKind
  /** Nom curt per a l'etiqueta: «CANTELL». */
  label: string
  /** Detall: «1+3», «6 forats», «Lateral esquerre (paret buida)». */
  detail: string
}

export const PROCESS_LABELS: Record<ProcessKind, string> = {
  mitre: "Inglet 45°",
  edge: "Cantell",
  edgeDrill: "Forats de cantell",
  glue: "Encolar",
}

const nums = (sides: readonly (typeof EDGE_SIDES)[number][]): string =>
  sides
    .map((s) => EDGE_NUMBER[s])
    .sort((a, b) => a - b)
    .join("+")

export function panelProcesses(p: Panel): Process[] {
  const out: Process[] = []
  if (p.mitres?.length) out.push({ kind: "mitre", label: PROCESS_LABELS.mitre, detail: `cantell ${nums(p.mitres)}` })
  const banded = EDGE_SIDES.filter((s) => p.edges[s])
  if (banded.length) out.push({ kind: "edge", label: PROCESS_LABELS.edge, detail: nums(banded) })
  const edgeHoles = p.holes.filter((h) => h.face === "edge").length
  if (edgeHoles) out.push({ kind: "edgeDrill", label: PROCESS_LABELS.edgeDrill, detail: `${edgeHoles} ${edgeHoles === 1 ? "forat" : "forats"}` })
  if (p.assembly) out.push({ kind: "glue", label: PROCESS_LABELS.glue, detail: p.assembly })
  return out
}

/** Resum d'una línia: «Inglet 45° (cantell 2) → Cantell (1+3)». */
export function processSummary(p: Panel): string {
  return panelProcesses(p)
    .map((x) => `${x.label} (${x.detail})`)
    .join(" → ")
}
