import { MarkerType, Position, type Edge, type Node } from "@xyflow/react"
import { DRAFT_EDGE_LABEL, descendantCount, effectivePositions, visibleIds, type CascadeDraft, type DraftDiff, type DraftEdgeKind, type DraftNode, type DraftTree } from "../../../core/model"
import { fold } from "../../projects/galleryGrid"

/**
 * De l'esborrany de la cascada (`core/model/options/cascadeDraft.ts`) als nodes i fletxes de React Flow: on és cada node
 * (el que l'usuari ha mogut o, si no, sol de dalt a baix: `effectivePositions`), el que es veu amb les branques plegades,
 * les diferències amb l'app i la cerca.
 */

/** Amplada fixa dels nodes (l'alçada la mesura React Flow; abans, `estimateSize`). */
export const NODE_W = 180
/** Separacions de la disposició automàtica (de dalt a baix). */
const GAP = { level: 70, sibling: 24, tree: 60 }

export interface CascadeNodeData extends Record<string, unknown> {
  node: DraftNode
  /** Diferent de l'app (amb «Diferències» encès). */
  status?: "added" | "changed"
  /** Quants en té a dins (tots els nivells). */
  inside: number
  collapsed: boolean
  /** Coincideix amb la cerca. */
  match: boolean
  /** S'hi deixarà a sobre el node que s'arrossega (passarà a ser-ne fill). */
  dropTarget: boolean
  onToggle: (id: string) => void
}
export type CascadeFlowNode = Node<CascadeNodeData, "cascade">

/** L'alçada d'un node abans que React Flow el mesuri (el nom en dues línies com a molt i la condició en tres). */
function estimateSize(n: DraftNode): { w: number; h: number } {
  const lines = (text: string | undefined, perLine: number, max: number) => (text ? Math.min(max, Math.ceil(text.length / perLine)) : 0)
  return { w: NODE_W, h: 22 + lines(n.label, 20, 2) * 20 }
}

/** Els nodes que coincideixen amb la cerca (nom, condició, nota, incoherència; sense accents). */
export function searchMatches(draft: CascadeDraft, query: string): Set<string> {
  const q = fold(query.trim())
  if (!q) return new Set()
  return new Set(draft.nodes.filter((n) => fold([n.label, n.when, n.note, n.issue].filter(Boolean).join(" ")).includes(q)).map((n) => n.id))
}

interface FlowInput {
  draft: CascadeDraft
  tree: DraftTree
  collapsed: ReadonlySet<string>
  sizes: ReadonlyMap<string, { w: number; h: number }>
  diff: DraftDiff | null
  /** Les fletxes «fa aparèixer» i «fa desaparèixer» (les «a dins de» sempre). */
  showLinks: boolean
  matches: ReadonlySet<string>
  selectedNodes: ReadonlySet<string>
  selectedEdges: ReadonlySet<string>
  dropTarget: string | null
  onToggle: (id: string) => void
}

/** La mida d'un node: la mesurada o, si encara no, l'estimada. */
function sizeOf(input: Pick<FlowInput, "draft" | "sizes">): (id: string) => { w: number; h: number } {
  const byId = new Map(input.draft.nodes.map((n) => [n.id, n]))
  return (id) => input.sizes.get(id) ?? estimateSize(byId.get(id)!)
}

/** On va cada node que es veu. */
export function flowPositions(input: Pick<FlowInput, "draft" | "tree" | "collapsed" | "sizes">) {
  return effectivePositions(input.draft, input.tree, input.collapsed, sizeOf(input), GAP)
}

const COLOR: Record<DraftEdgeKind, string> = {
  contains: "var(--chakra-colors-fg-subtle)",
  reveals: "var(--chakra-colors-wood-solid)",
  hides: "var(--chakra-colors-red-solid)",
}
const ADDED = "var(--chakra-colors-green-solid)"
const REMOVED = "var(--chakra-colors-red-fg)"

export function buildFlow(input: FlowInput): { nodes: CascadeFlowNode[]; edges: Edge[] } {
  const { draft, tree, collapsed, sizes, diff } = input
  const pos = flowPositions(input)
  const shown = new Set(visibleIds(tree, collapsed))
  const nodes: CascadeFlowNode[] = []
  for (const n of draft.nodes) {
    const p = pos.get(n.id)
    if (!p || !shown.has(n.id)) continue
    const size = sizes.get(n.id)
    nodes.push({
      id: n.id,
      type: "cascade",
      position: p,
      ...(size ? { measured: { width: size.w, height: size.h } } : {}),
      selected: input.selectedNodes.has(n.id),
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        node: n,
        status: diff?.added.has(n.id) ? "added" : diff?.changed.has(n.id) ? "changed" : undefined,
        inside: descendantCount(tree, n.id),
        collapsed: collapsed.has(n.id),
        match: input.matches.has(n.id),
        dropTarget: input.dropTarget === n.id,
        onToggle: input.onToggle,
      },
    })
  }
  const edges: Edge[] = []
  for (const e of draft.edges) {
    if (!shown.has(e.source) || !shown.has(e.target)) continue
    // La fletxa «a dins de» que fa l'arbre: corba simple de la nansa de sota a la de dalt; les altres (fa aparèixer, fa
    // desaparèixer, un segon pare), a ratlles i només amb l'interruptor.
    const inTree = e.kind === "contains" && tree.parent.get(e.target) === e.source
    if (!inTree && !input.showLinks) continue
    const added = !!diff?.addedEdges.has(e.id)
    const stroke = added ? ADDED : COLOR[e.kind]
    const selected = input.selectedEdges.has(e.id)
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
      selected,
      ...(inTree ? {} : { markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 } }),
      ...(selected && !inTree ? { label: DRAFT_EDGE_LABEL[e.kind] } : {}),
      style: { stroke: selected ? "var(--chakra-colors-wood-solid)" : stroke, strokeWidth: selected ? 2.5 : added ? 2 : 1.5, ...(inTree ? {} : { strokeDasharray: "6 4" }) },
      zIndex: inTree ? 0 : 1,
    })
  }
  // Les fletxes de l'app que s'han tret, entre dos nodes que es veuen: fantasmes (no es poden triar).
  for (const e of diff?.removedEdges ?? []) {
    if (!shown.has(e.source) || !shown.has(e.target)) continue
    if (e.kind !== "contains" && !input.showLinks) continue
    edges.push({
      id: `removed:${e.id}`,
      source: e.source,
      target: e.target,
      type: "default",
      selectable: false,
      deletable: false,
      focusable: false,
      style: { stroke: REMOVED, strokeWidth: 1.5, strokeDasharray: "2 4", opacity: 0.6 },
    })
  }
  return { nodes, edges }
}
