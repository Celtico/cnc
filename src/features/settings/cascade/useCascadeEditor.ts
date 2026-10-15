import { useReactFlow, type Edge, type EdgeChange, type NodeChange, type OnConnect, type OnDelete, type OnNodeDrag } from "@xyflow/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addDraftNode,
  ancestorIds,
  appCascade,
  branchIds,
  clearDraftPositions,
  diffDraft,
  draftTree,
  moveDraftNodes,
  newId,
  removeFromDraft,
  reparentDraft,
  restoreAppEdge,
  restoreAppNode,
  setDraftEdgeKind,
  updateDraftNode,
  type CascadeDraft,
  type DraftNode,
  type DraftEdgeKind,
  type DraftPoint,
} from "../../../core/model"
import { useLatest } from "../../../lib/useLatest"
import { usePersistentFlag } from "../../../lib/usePersistentFlag"
import { useUndoKeys } from "../../history/useHistory"
import { buildFlow, flowPositions, searchMatches, type CascadeFlowNode } from "./cascadeFlow"
import type { DetailActions } from "./CascadeDetail"
import { initialCollapsed, useCascadeDraft } from "./useCascadeDraft"

const FIT = { padding: 0.15, maxZoom: 1, duration: 250 }

/**
 * L'estat del dibuix de la cascada: l'esborrany (amb desfer/refer i desat), les branques plegades, la selecció, les mides
 * mesurades dels nodes, la cerca i els gestos (unir, esborrar, plegar sense que el node es mogui de lloc, afegir).
 */
export function useCascadeEditor() {
  const { history, collapsed, setCollapsed, loaded, save } = useCascadeDraft()
  const draft = history.value
  const rf = useReactFlow<CascadeFlowNode, Edge>()
  // D'entrada, només l'arbre (les fletxes «a dins de»), com el dibuix de l'usuari.
  const [showLinks, setShowLinks] = usePersistentFlag("mobles:cascade-links-v2", false)
  const [showDiff, setShowDiff] = usePersistentFlag("mobles:cascade-diff", true)
  const [query, setQuery] = useState("")
  const [selNodes, setSelNodes] = useState<ReadonlySet<string>>(new Set())
  const [selEdges, setSelEdges] = useState<ReadonlySet<string>>(new Set())
  const [sizes, setSizes] = useState<ReadonlyMap<string, { w: number; h: number }>>(new Map())
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const tree = useMemo(() => draftTree(draft), [draft])
  const diff = useMemo(() => diffDraft(draft), [draft])
  const matches = useMemo(() => searchMatches(draft, query), [draft, query])

  // Plegar o desplegar sense que el node es mogui a la pantalla: es desplaça la vista el que s'ha mogut el node.
  const live = useLatest({ draft, tree, collapsed, sizes })
  const setCollapsedKeeping = useCallback(
    (next: Set<string>, keep?: string) => {
      if (keep) {
        const cur = live.current
        const before = flowPositions(cur).get(keep)
        const after = flowPositions({ ...cur, collapsed: next }).get(keep)
        if (before && after) {
          const vp = rf.getViewport()
          void rf.setViewport({ x: vp.x - (after.x - before.x) * vp.zoom, y: vp.y - (after.y - before.y) * vp.zoom, zoom: vp.zoom })
        }
      }
      setCollapsed(next)
    },
    [live, rf, setCollapsed],
  )
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(live.current.collapsed)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setCollapsedKeeping(next, id)
    },
    [live, setCollapsedKeeping],
  )

  // Després d'un canvi que ho demana: encaixar-ho tot, uns nodes o anar a un node (quan ja és al dibuix).
  const pending = useRef<{ fit: "all" } | { fit: "nodes"; ids: string[] } | null>(null)
  const flow = useMemo(
    () => buildFlow({ draft, tree, collapsed, sizes, diff: showDiff ? diff : null, showLinks, matches, selectedNodes: selNodes, selectedEdges: selEdges, dropTarget, onToggle: toggle }),
    [draft, tree, collapsed, sizes, diff, showDiff, showLinks, matches, selNodes, selEdges, dropTarget, toggle],
  )
  useEffect(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    requestAnimationFrame(() => void rf.fitView(p.fit === "all" ? FIT : { ...FIT, nodes: p.ids.map((id) => ({ id })), maxZoom: 1 }))
  }, [flow, rf])
  const fitLater = () => (pending.current = { fit: "all" })

  /** Triar un node i anar-hi (es despleguen els de sobre). */
  const focus = useCallback(
    (id: string) => {
      const up = ancestorIds(live.current.tree, id)
      if (up.some((a) => live.current.collapsed.has(a))) setCollapsed(new Set([...live.current.collapsed].filter((c) => !up.includes(c))))
      setSelNodes(new Set([id]))
      setSelEdges(new Set())
      pending.current = { fit: "nodes", ids: [id] }
    },
    [live, setCollapsed],
  )

  // La cerca obre el camí fins als que coincideixen i hi va (amb un petit retard mentre s'escriu).
  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(() => {
      const found = searchMatches(live.current.draft, query)
      if (!found.size) return
      const open = new Set([...found].flatMap((id) => ancestorIds(live.current.tree, id)))
      setCollapsed(new Set([...live.current.collapsed].filter((c) => !open.has(c))))
      pending.current = { fit: "nodes", ids: [...found] }
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia el text de la cerca (no en editar l'esborrany)
  }, [query])

  const { set, commit } = history
  const onNodesChange = useCallback((changes: NodeChange<CascadeFlowNode>[]) => {
    // Arrossegar: en viu (sense pas de desfer); el pas es fa en deixar-lo (`onNodeDragStop`).
    const moves: Record<string, DraftPoint> = {}
    for (const c of changes) if (c.type === "position" && c.position) moves[c.id] = c.position
    if (Object.keys(moves).length) set((d) => moveDraftNodes(d, moves), { commit: false })
    const sel = changes.filter((c) => c.type === "select")
    if (sel.length)
      setSelNodes((cur) => {
        const next = new Set(cur)
        for (const c of sel) if (c.selected) next.add(c.id)
        else next.delete(c.id)
        return next
      })
    const dims = changes.flatMap((c) => (c.type === "dimensions" && c.dimensions ? [{ id: c.id, w: c.dimensions.width, h: c.dimensions.height }] : []))
    if (dims.length)
      setSizes((cur) => {
        const changed = dims.filter((d) => {
          const o = cur.get(d.id)
          return !o || Math.abs(o.w - d.w) > 0.5 || Math.abs(o.h - d.h) > 0.5
        })
        if (!changed.length) return cur
        const next = new Map(cur)
        for (const d of changed) next.set(d.id, { w: d.w, h: d.h })
        return next
      })
  }, [set])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const sel = changes.filter((c) => c.type === "select")
    if (sel.length)
      setSelEdges((cur) => {
        const next = new Set(cur)
        for (const c of sel) if (c.selected) next.add(c.id)
        else next.delete(c.id)
        return next
      })
  }, [])
  // De la nansa de sota d'un node a la de dalt d'un altre: el segon passa a ser fill del primer.
  const onConnect: OnConnect = useCallback((c) => set((d) => reparentDraft(d, c.target, c.source)), [set])
  // Deixar un node a sobre d'un altre: en passa a ser fill (el de sota s'il·lumina mentre s'arrossega).
  const targetUnder = useCallback(
    (node: CascadeFlowNode, dragged: CascadeFlowNode[]): string | null => {
      if (dragged.length > 1) return null
      const hit = rf.getIntersectingNodes(node).find((n) => n.id !== node.id && !ancestorIds(live.current.tree, n.id).includes(node.id))
      return hit?.id ?? null
    },
    [rf, live],
  )
  const onNodeDrag: OnNodeDrag<CascadeFlowNode> = useCallback((_, node, dragged) => setDropTarget(targetUnder(node, dragged)), [targetUnder])
  const onNodeDragStop: OnNodeDrag<CascadeFlowNode> = useCallback(
    (_, node, dragged) => {
      const target = targetUnder(node, dragged)
      // A dins del nou pare, va sol (sota seu); si no es pot (faria un cercle), es queda on l'han deixat.
      if (target) set((d) => {
        const next = reparentDraft(d, node.id, target)
        return next === d ? d : moveDraftNodes(next, { [node.id]: null })
      }, { commit: false })
      commit()
      setDropTarget(null)
    },
    [targetUnder, set, commit],
  )
  const onDelete: OnDelete<CascadeFlowNode, Edge> = useCallback(
    ({ nodes, edges }) => {
      // Un node que es queda sense pare (s'ha tret la fletxa) no es mou de lloc.
      const pos = flowPositions(live.current)
      const gone = new Set(nodes.map((n) => n.id))
      const pins: Record<string, DraftPoint> = {}
      for (const e of live.current.draft.edges) if (e.kind === "contains" && edges.some((x) => x.id === e.id) && !gone.has(e.target) && pos.get(e.target)) pins[e.target] = pos.get(e.target)!
      set((d) => moveDraftNodes(removeFromDraft(d, gone, edges.map((e) => e.id)), pins))
      setSelNodes(new Set())
      setSelEdges(new Set())
    },
    [set, live],
  )

  /** Un node nou: a dins del triat (una tria si és una opció) o, sense, un de solt. */
  const addNode = useCallback(
    (parent?: string, at?: DraftPoint) => {
      const cur = live.current
      const p = parent ? cur.draft.nodes.find((n) => n.id === parent) : undefined
      const kind = !p ? "section" : p.kind === "option" ? "choice" : "option"
      const node: DraftNode = { id: newId("n-"), kind, label: kind === "section" ? "Secció nova" : kind === "choice" ? "Tria nova" : "Opció nova" }
      set((d) => {
        const next = addDraftNode(d, node, p?.id)
        return at ? moveDraftNodes(next, { [node.id]: at }) : next
      })
      if (p && cur.collapsed.has(p.id)) setCollapsed(new Set([...cur.collapsed].filter((c) => c !== p.id)))
      setSelNodes(new Set([node.id]))
      setSelEdges(new Set())
      pending.current = { fit: "nodes", ids: [node.id] }
    },
    [live, set, setCollapsed],
  )
  const one = selNodes.size === 1 ? [...selNodes][0] : undefined
  const removeSelected = () => onDelete({ nodes: [...selNodes].map((id) => ({ id }) as CascadeFlowNode), edges: [...selEdges].map((id) => ({ id }) as Edge) })

  const actions: DetailActions = {
    updateNode: (id, patch, group) => set((d) => updateDraftNode(d, id, patch), group ? { group } : undefined),
    setEdgeKind: (id: string, kind: DraftEdgeKind) => {
      set((d) => setDraftEdgeKind(d, id, kind))
      setSelEdges(new Set())
    },
    remove: removeSelected,
    addChild: (id) => addNode(id),
    restoreNode: (id) => set((d) => restoreAppNode(d, id)),
    restoreEdge: (id) => set((d) => restoreAppEdge(d, id)),
    focus,
  }

  useUndoKeys(history.undo, history.redo)

  /** Un esborrany sencer nou (importat o el de l'app): es pot desfer. */
  const replace = (next: CascadeDraft) => {
    set(next)
    setCollapsed(initialCollapsed(next))
    setSelNodes(new Set())
    setSelEdges(new Set())
    fitLater()
  }

  return {
    loaded,
    save,
    draft,
    diff,
    flow,
    history,
    query,
    setQuery,
    matches,
    selected: { node: one ? draft.nodes.find((n) => n.id === one) : undefined, edge: selEdges.size === 1 && !selNodes.size ? draft.edges.find((e) => selEdges.has(e.id)) : undefined, count: selNodes.size + selEdges.size },
    view: { showLinks, setShowLinks, showDiff, setShowDiff },
    canvas: {
      onNodesChange,
      onEdgesChange,
      onConnect,
      onDelete,
      onNodeDrag,
      onNodeDragStop,
      onNodeDoubleClick: toggle,
      // Doble clic al buit: un node solt on s'ha fet.
      onPaneDoubleClick: (client: { x: number; y: number }) => addNode(undefined, rf.screenToFlowPosition(client)),
    },
    addNode: () => addNode(one),
    removeSelected,
    collapseAll: () => {
      setCollapsed(new Set(branchIds(tree)))
      fitLater()
    },
    expandAll: () => {
      setCollapsed(new Set())
      fitLater()
    },
    /** «Reordenar automàticament»: tots els nodes tornen a anar sols, en arbre de dalt a baix (es pot desfer). */
    relayout: () => {
      set((d) => clearDraftPositions(d))
      fitLater()
    },
    reloadFromApp: () => replace(appCascade()),
    replace,
    actions,
  }
}
