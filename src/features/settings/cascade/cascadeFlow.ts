import { MarkerType, Position, type Edge, type Node } from "@xyflow/react"
import type { IconType } from "react-icons"
import { LuCircleDot, LuFolder, LuSlidersHorizontal } from "react-icons/lu"
import { DRAFT_EDGE_LABEL, descendantCount, optionNode, registryRef, layoutDraft, visibleIds, type CascadeDraft, type DraftDiff, type DraftEdgeKind, type DraftNode, type DraftTree, type LayoutDir } from "../../../core/model"
import { fold } from "../../projects/galleryGrid"
import { OPTION_ICONS } from "../optionIcons"

/**
 * De l'esborrany de la cascada (`core/model/options/cascadeDraft.ts`) als nodes i fletxes de React Flow: la disposició
 * automàtica (`layoutDraft`), el que es veu amb les branques plegades, les diferències amb l'app i la cerca.
 */

/** Amplada fixa dels nodes (l'alçada la mesura React Flow; abans, `estimateSize`). */
export const NODE_W = 272

export interface CascadeNodeData extends Record<string, unknown> {
  node: DraftNode
  /** Diferent de l'app (amb «Diferències» encès). */
  status?: "added" | "changed"
  /** Quants en té a dins (tots els nivells). */
  inside: number
  collapsed: boolean
  /** Coincideix amb la cerca. */
  match: boolean
  dir: LayoutDir
  onToggle: (id: string) => void
}
export type CascadeFlowNode = Node<CascadeNodeData, "cascade">

/** L'alçada d'un node abans que React Flow el mesuri (el nom en dues línies com a molt i la condició en tres). */
function estimateSize(n: DraftNode): { w: number; h: number } {
  const lines = (text: string | undefined, perLine: number, max: number) => (text ? Math.min(max, Math.ceil(text.length / perLine)) : 0)
  return { w: NODE_W, h: 20 + 26 + lines(n.label, 28, 2) * 20 + lines(n.when, 40, 3) * 16 }
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
  dir: LayoutDir
  diff: DraftDiff | null
  /** Les fletxes «fa aparèixer» i «fa desaparèixer» (les «a dins de» sempre). */
  showLinks: boolean
  matches: ReadonlySet<string>
  selectedNodes: ReadonlySet<string>
  selectedEdges: ReadonlySet<string>
  onToggle: (id: string) => void
}

/** La mida d'un node: la mesurada o, si encara no, l'estimada. */
function sizeOf(input: Pick<FlowInput, "draft" | "sizes">): (id: string) => { w: number; h: number } {
  const byId = new Map(input.draft.nodes.map((n) => [n.id, n]))
  return (id) => input.sizes.get(id) ?? estimateSize(byId.get(id)!)
}

/** On va cada node que es veu. */
export function flowPositions(input: Pick<FlowInput, "draft" | "tree" | "collapsed" | "sizes" | "dir">) {
  return layoutDraft(input.tree, input.collapsed, sizeOf(input), input.dir)
}

const COLOR: Record<DraftEdgeKind, string> = {
  contains: "var(--chakra-colors-border-emphasized)",
  reveals: "var(--chakra-colors-wood-solid)",
  hides: "var(--chakra-colors-red-solid)",
}
const ADDED = "var(--chakra-colors-green-solid)"
const REMOVED = "var(--chakra-colors-red-fg)"

export function buildFlow(input: FlowInput): { nodes: CascadeFlowNode[]; edges: Edge[] } {
  const { draft, tree, collapsed, sizes, dir, diff } = input
  const pos = flowPositions(input)
  const shown = new Set(visibleIds(tree, collapsed))
  const lr = dir === "LR"
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
      sourcePosition: lr ? Position.Right : Position.Bottom,
      targetPosition: lr ? Position.Left : Position.Top,
      data: {
        node: n,
        status: diff?.added.has(n.id) ? "added" : diff?.changed.has(n.id) ? "changed" : undefined,
        inside: descendantCount(tree, n.id),
        collapsed: collapsed.has(n.id),
        match: input.matches.has(n.id),
        dir,
        onToggle: input.onToggle,
      },
    })
  }
  const edges: Edge[] = []
  for (const e of draft.edges) {
    if (!shown.has(e.source) || !shown.has(e.target)) continue
    // La fletxa «a dins de» que fa l'arbre: contínua; les altres (fa aparèixer, fa desaparèixer, un segon pare), a ratlles.
    const inTree = e.kind === "contains" && tree.parent.get(e.target) === e.source
    if (!inTree && !input.showLinks) continue
    const added = !!diff?.addedEdges.has(e.id)
    const stroke = added ? ADDED : COLOR[e.kind]
    const selected = input.selectedEdges.has(e.id)
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: inTree ? "smoothstep" : "default",
      selected,
      ...(inTree ? {} : { markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 } }),
      ...(selected || (added && !inTree) ? { label: `${DRAFT_EDGE_LABEL[e.kind]}${added ? " · nova" : ""}` } : {}),
      style: { stroke, strokeWidth: selected ? 3 : added ? 2 : 1.25, ...(inTree ? {} : { strokeDasharray: "6 4" }) },
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
      label: `${DRAFT_EDGE_LABEL[e.kind]} · treta`,
      style: { stroke: REMOVED, strokeWidth: 1.5, strokeDasharray: "2 4", opacity: 0.7 },
    })
  }
  return { nodes, edges }
}


const KIND_ICON: Record<DraftNode["kind"], IconType> = { section: LuFolder, option: LuSlidersHorizontal, choice: LuCircleDot }

/** La icona d'un node: la de la seva secció a l'inspector (si és de l'app i en té) o la del tipus. */
export function nodeIcon(n: DraftNode): IconType {
  const icon = n.kind === "choice" ? undefined : optionNode(registryRef(n.id).optionId)?.icon
  return icon ? OPTION_ICONS[icon] : KIND_ICON[n.kind]
}
