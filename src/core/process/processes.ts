import { EDGE_NUMBER, EDGE_SIDES, type Panel } from "../model"

/**
 * Post-processos: el que li toca a cada peça després de sortir tallada del nesting, en
 * l'ordre del taller. Es dedueixen de la peça (no es desen):
 *  - 2a cara: mecanitzats a la cara B, cal girar la peça i passar el programa `<ref>Volt`
 *    (columna SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO; el taller-cnc-nest en fa l'etiqueta);
 *  - inglet: serra a 45° als cantells `mitres`;
 *  - cantell: cantejadora als cantells folrats;
 *  - forats de cantell: perforadora horitzontal (espigues, excèntriques…);
 *  - encolar: muntar un conjunt abans del moble (p. ex. les parets buides);
 *  - push: front sense tirador, cal muntar-hi el ferratge d'obertura per pressió.
 */
export type ProcessKind = "secondFace" | "mitre" | "edge" | "edgeDrill" | "glue" | "push"

interface Process {
  kind: ProcessKind
  /** Nom curt per a l'etiqueta: «CANTELL». */
  label: string
  /** Detall: «1+3», «6 forats», «Lateral esquerre (paret buida)». */
  detail: string
}

const PROCESS_LABELS: Record<ProcessKind, string> = {
  secondFace: "2a cara",
  mitre: "Inglet 45°",
  edge: "Cantell",
  edgeDrill: "Forats de cantell",
  glue: "Encolar",
  push: "Push (Tip-On)",
}

const nums = (sides: readonly (typeof EDGE_SIDES)[number][]): string =>
  sides
    .map((s) => EDGE_NUMBER[s])
    .sort((a, b) => a - b)
    .join("+")

/** Té mecanitzats a la cara B (forats, ranures o buidats): cal un segon programa amb la peça girada. */
export function needsSecondFace(p: Panel): boolean {
  return p.holes.some((h) => h.face === "B") || p.grooves.some((g) => g.face === "B") || !!p.pockets?.some((k) => k.face === "B")
}

/** Nom del programa de 2a cara, com el de TopSolid: la ref + «Volt». */
export const secondFaceProgram = (ref: string): string => `${ref}Volt`

export function panelProcesses(p: Panel): Process[] {
  const out: Process[] = []
  if (needsSecondFace(p)) out.push({ kind: "secondFace", label: PROCESS_LABELS.secondFace, detail: "girar i mecanitzar la cara B" })
  if (p.mitres?.length) out.push({ kind: "mitre", label: PROCESS_LABELS.mitre, detail: `cantell ${nums(p.mitres)}` })
  const banded = EDGE_SIDES.filter((s) => p.edges[s])
  if (banded.length) out.push({ kind: "edge", label: PROCESS_LABELS.edge, detail: nums(banded) })
  const edgeHoles = p.holes.filter((h) => h.face === "edge").length
  if (edgeHoles) out.push({ kind: "edgeDrill", label: PROCESS_LABELS.edgeDrill, detail: `${edgeHoles} ${edgeHoles === 1 ? "forat" : "forats"}` })
  if (p.assembly) out.push({ kind: "glue", label: PROCESS_LABELS.glue, detail: p.assembly })
  if (p.push) out.push({ kind: "push", label: PROCESS_LABELS.push, detail: "ferratge d'obertura per pressió, sense tirador" })
  return out
}

/** Resum d'una línia: «Inglet 45° (cantell 2) → Cantell (1+3)». */
export function processSummary(p: Panel): string {
  return panelProcesses(p)
    .map((x) => `${x.label} (${x.detail})`)
    .join(" → ")
}
