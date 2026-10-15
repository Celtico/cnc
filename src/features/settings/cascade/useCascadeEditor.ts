import { useReactFlow, type Edge, type EdgeChange, type NodeChange, type OnConnect, type OnDelete } from "@xyflow/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addDraftNode,
  ancestorIds,
  appCascade,
  branchIds,
  connectDraft,
  diffDraft,
  draftTree,
  newId,
  removeFromDraft,
  restoreAppEdge,
  restoreAppNode,
  setDraftEdgeKind,
  updateDraftNode,
  type CascadeDraft,
  type DraftNode,
  type DraftEdgeKind,
  type LayoutDir,
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
  const { history, collapsed, setCollapsed, loaded } = useCascadeDraft()
  const draft = history.value
  const rf = useReactFlow<CascadeFlowNode, Edge>()
  const [tb, setTb] = usePersistentFlag("mobles:cascade-tb", false)
  const [showLinks, setShowLinks] = usePersistentFlag("mobles:cascade-links", true)
  const [showDiff, setShowDiff] = usePersistentFlag("mobles:cascade-diff", true)
  const [query, setQuery] = useState("")
  const [selNodes, setSelNodes] = useState<ReadonlySet<string>>(new Set())
  const [selEdges, setSelEdges] = useState<ReadonlySet<string>>(new Set())
  const [sizes, setSizes] = useState<ReadonlyMap<string, { w: number; h: number }>>(new Map())
  const dir: LayoutDir = tb ? "TB" : "LR"
  const tree = useMemo(() => draftTree(draft), [draft])
  const diff = useMemo(() => diffDraft(draft), [draft])
  const matches = useMemo(() => searchMatches(draft, query), [draft, query])

  // Plegar o desplegar sense que el node es mogui a la pantalla: es desplaça la vista el que s'ha mogut el node.
  const live = useLatest({ draft, tree, collapsed, sizes, dir })
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
    () => buildFlow({ draft, tree, collapsed, sizes, dir, diff: showDiff ? diff : null, showLinks, matches, selectedNodes: selNodes, selectedEdges: selEdges, onToggle: toggle }),
    [draft, tree, collapsed, sizes, dir, diff, showDiff, showLinks, matches, selNodes, selEdges, toggle],
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

  const onNodesChange = useCallback((changes: NodeChange<CascadeFlowNode>[]) => {
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
  }, [])
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
  const { set } = history
  const onConnect: OnConnect = useCallback((c) => set((d) => connectDraft(d, c.source, c.target)), [set])
  const onDelete: OnDelete<CascadeFlowNode, Edge> = useCallback(
    ({ nodes, edges }) => {
      set((d) => removeFromDraft(d, nodes.map((n) => n.id), edges.map((e) => e.id)))
      setSelNodes(new Set())
      setSelEdges(new Set())
    },
    [set],
  )

  /** Un node nou: a dins del triat (una tria si és una opció) o, sense, un de solt. */
  const addNode = useCallback(
    (parent?: string) => {
      const cur = live.current
      const p = parent ? cur.draft.nodes.find((n) => n.id === parent) : undefined
      const kind = !p ? "section" : p.kind === "option" ? "choice" : "option"
      const node: DraftNode = { id: newId("n-"), kind, label: kind === "section" ? "Secció nova" : kind === "choice" ? "Tria nova" : "Opció nova" }
      set((d) => addDraftNode(d, node, p?.id))
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
    draft,
    diff,
    flow,
    history,
    query,
    setQuery,
    matches,
    selected: { node: one ? draft.nodes.find((n) => n.id === one) : undefined, edge: selEdges.size === 1 && !selNodes.size ? draft.edges.find((e) => selEdges.has(e.id)) : undefined, count: selNodes.size + selEdges.size },
    view: { tb, setTb, showLinks, setShowLinks, showDiff, setShowDiff },
    canvas: { onNodesChange, onEdgesChange, onConnect, onDelete, onNodeDoubleClick: toggle, onPaneDoubleClick: () => addNode() },
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
    fitAll: () => void rf.fitView(FIT),
    reloadFromApp: () => replace(appCascade()),
    replace,
    actions,
  }
}
