import { OPTION_CASCADE } from "./optionCascade"
import { CONTROL_ICON, guessIcon, type DraftIcon } from "./draftIcons"
import type { OptionNode } from "./optionTypes"

/**
 * La **cascada d'opcions** de Preferències › Opcions en cascada, només per mirar (per decisió de l'usuari, 2026-10-21:
 * «que l'esquema vingui donat per la realitat, que no es pugui editar, només serà un visual»). Surt sempre del registre
 * (`appCascade`), que el test `src/optionCascade.test.ts` manté al dia amb els inspectors de l'Editor: nodes (secció,
 * opció, tria) i fletxes (a dins de, fa aparèixer, fa desaparèixer). Només dades i funcions pures.
 */

export type DraftNodeKind = "section" | "option" | "choice"
export type DraftEdgeKind = "contains" | "reveals" | "hides"

export const DRAFT_KIND_LABEL: Record<DraftNodeKind, string> = { section: "Secció", option: "Opció", choice: "Tria" }
export const DRAFT_EDGE_LABEL: Record<DraftEdgeKind, string> = { contains: "A dins de", reveals: "Fa aparèixer", hides: "Fa desaparèixer" }

const KIND_ICON: Record<DraftNodeKind, DraftIcon> = { section: "subsection", option: "option", choice: "choice" }

export interface DraftNode {
  id: string
  kind: DraftNodeKind
  label: string
  /** «Surt quan»: la condició en paraules. */
  when?: string
  /** Possible incoherència (la de l'auditoria del registre). */
  issue?: string
}
export interface DraftEdge {
  id: string
  /** `contains`: el pare (la secció, l'opció de la tria); `reveals`/`hides`: la tria que ho decideix. */
  source: string
  target: string
  kind: DraftEdgeKind
}
export interface CascadeDraft {
  nodes: DraftNode[]
  edges: DraftEdge[]
}

export const edgeId = (kind: DraftEdgeKind, source: string, target: string): string => `${kind}:${source}>${target}`
export const choiceId = (optionId: string, value: string): string => `${optionId}=${value}`

/** El node del registre d'un id del dibuix (la tria, el de la seva opció) i el `value` de la tria. */
export function registryRef(id: string): { optionId: string; value?: string } {
  const i = id.indexOf("=")
  return i < 0 ? { optionId: id } : { optionId: id.slice(0, i), value: id.slice(i + 1) }
}

/** La cascada i la icona de cada node (a part, perquè el node és només dades). */
function seed(): { draft: CascadeDraft; icons: Map<string, DraftIcon> } {
  const nodes: DraftNode[] = []
  const icons = new Map<string, DraftIcon>()
  const edges = new Map<string, DraftEdge>()
  const edge = (kind: DraftEdgeKind, source: string, target: string) => {
    const id = edgeId(kind, source, target)
    if (source !== target && !edges.has(id)) edges.set(id, { id, source, target, kind })
  }
  const visit = (n: OptionNode, parent?: string, sectionIcon?: DraftIcon) => {
    // «subsection» (l'engranatge) és la genèrica de les subseccions: abans, la que fa pensar el nom («Opcions del tirador»).
    const own = n.icon === "subsection" ? undefined : n.icon
    const icon: DraftIcon = own ?? guessIcon(n.label) ?? n.icon ?? (n.kind === "field" ? (n.control ? CONTROL_ICON[n.control] : "option") : (sectionIcon ?? KIND_ICON.section))
    nodes.push({ id: n.id, kind: n.kind === "field" ? "option" : "section", label: n.label, ...(n.showIf ? { when: n.showIf } : {}), ...(n.issue ? { issue: n.issue } : {}) })
    icons.set(n.id, icon)
    if (parent) edge("contains", parent, n.id)
    for (const c of n.choices ?? []) {
      const id = choiceId(n.id, c.value)
      nodes.push({ id, kind: "choice", label: c.label })
      icons.set(id, guessIcon(c.label) ?? "choice")
      edge("contains", n.id, id)
      for (const r of c.reveals ?? []) edge("reveals", id, r)
      for (const h of c.hides ?? []) edge("hides", id, h)
    }
    for (const c of n.children ?? []) visit(c, n.id, n.kind === "field" ? sectionIcon : icon)
  }
  for (const n of OPTION_CASCADE) visit(n)
  return { draft: { nodes, edges: [...edges.values()] }, icons }
}

let app: ReturnType<typeof seed> | undefined
/** La cascada que fa el codi ara (del registre): el que es dibuixa. */
export function appCascade(): CascadeDraft {
  app ??= seed()
  return app.draft
}

/** La icona d'un node: la de l'app (la secció de l'inspector, la que fa pensar el nom o la del control); si no, la que fa pensar el nom i, si no, la del tipus. */
export function draftIcon(n: DraftNode): DraftIcon {
  app ??= seed()
  return app.icons.get(n.id) ?? guessIcon(n.label) ?? KIND_ICON[n.kind]
}
