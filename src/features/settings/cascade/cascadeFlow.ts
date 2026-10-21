import { MarkerType, Position, type Edge, type Node } from "@xyflow/react"
import { descendantCount, stackedLayout, visibleIds, type CascadeDraft, type DraftEdgeKind, type DraftNode, type DraftTree } from "../../../core/model"
import { fold } from "../../projects/galleryGrid"

/**
 * De la cascada de l'app (`core/model/options/cascadeDraft.ts`) als nodes i fletxes de React Flow: on és cada node (els
 * arbres un sota l'altre: `stackedLayout`), el que es veu amb les branques plegades i la cerca. Només per mirar.
 */

/** Amplada fixa dels nodes (l'alçada la mesura React Flow; abans, `estimateSize`). */
export const NODE_W = 180
/** Separacions de la disposició (de dalt a baix; `tree`: entre un arbre i el de sota). */
const GAP = { level: 70, sibling: 24, tree: 90 }

export interface CascadeNodeData extends Record<string, unknown> {
  node: DraftNode
  /** Quants en té a dins (tots els nivells). */
  inside: number
  collapsed: boolean
  /** Coincideix amb la cerca. */
  match: boolean
  onToggle: (id: string) => void
}
export type CascadeFlowNode = Node<CascadeNodeData, "cascade">

/** L'alçada d'un node abans que React Flow el mesuri (el nom en dues línies com a molt). */
function estimateSize(n: DraftNode): { w: number; h: number } {
  const lines = (text: string | undefined, perLine: number, max: number) => (text ? Math.min(max, Math.ceil(text.length / perLine)) : 0)
  return { w: NODE_W, h: 22 + lines(n.label, 20, 2) * 20 }
}

/** Els nodes que coincideixen amb la cerca (nom, condició, incoherència; sense accents). */
export function searchMatches(draft: CascadeDraft, query: string): Set<string> {
  const q = fold(query.trim())
  if (!q) return new Set()
  return new Set(draft.nodes.filter((n) => fold([n.label, n.when, n.issue].filter(Boolean).join(" ")).includes(q)).map((n) => n.id))
}

interface FlowInput {
  draft: CascadeDraft
  tree: DraftTree
  collapsed: ReadonlySet<string>
  sizes: ReadonlyMap<string, { w: number; h: number }>
  /** Les fletxes «fa aparèixer» i «fa desaparèixer» (les «a dins de» sempre). */
  showLinks: boolean
  matches: ReadonlySet<string>
  selected: string | undefined
  onToggle: (id: string) => void
}

/** On va cada node que es veu (amb la mida mesurada o, si encara no, l'estimada). */
export function flowPositions(input: Pick<FlowInput, "draft" | "tree" | "collapsed" | "sizes">) {
  const byId = new Map(input.draft.nodes.map((n) => [n.id, n]))
  return stackedLayout(input.tree, input.collapsed, (id) => input.sizes.get(id) ?? estimateSize(byId.get(id)!), GAP)
}

const COLOR: Record<DraftEdgeKind, string> = {
  contains: "var(--chakra-colors-fg-subtle)",
  reveals: "var(--chakra-colors-wood-solid)",
  hides: "var(--chakra-colors-red-solid)",
}

export function buildFlow(input: FlowInput): { nodes: CascadeFlowNode[]; edges: Edge[] } {
  const { draft, tree, collapsed, sizes } = input
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
      selected: input.selected === n.id,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: { node: n, inside: descendantCount(tree, n.id), collapsed: collapsed.has(n.id), match: input.matches.has(n.id), onToggle: input.onToggle },
    })
  }
  const edges: Edge[] = []
  for (const e of draft.edges) {
    if (!shown.has(e.source) || !shown.has(e.target)) continue
    // La fletxa «a dins de» que fa l'arbre: corba simple de sota el pare a dalt del fill; les altres (fa aparèixer, fa
    // desaparèixer), a ratlles i només amb l'interruptor.
    const inTree = e.kind === "contains" && tree.parent.get(e.target) === e.source
    if (!inTree && !input.showLinks) continue
    const stroke = COLOR[e.kind]
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
      selectable: false,
      focusable: false,
      ...(inTree ? {} : { markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 } }),
      style: { stroke, strokeWidth: 1.5, ...(inTree ? {} : { strokeDasharray: "6 4" }) },
      zIndex: inTree ? 0 : 1,
    })
  }
  return { nodes, edges }
}
