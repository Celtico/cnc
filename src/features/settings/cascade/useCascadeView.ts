import { useReactFlow, type Edge, type NodeChange } from "@xyflow/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ancestorIds, appCascade, branchIds, draftTree, type DraftTree } from "../../../core/model"
import { useLatest } from "../../../lib/useLatest"
import { usePersistentFlag } from "../../../lib/usePersistentFlag"
import { buildFlow, flowPositions, searchMatches, type CascadeFlowNode } from "./cascadeFlow"

const FIT = { padding: 0.15, maxZoom: 1, duration: 250 }

/** D'entrada: les arrels obertes i la resta de branques plegades (es veuen els inspectors i les seves seccions). */
function initialCollapsed(tree: DraftTree): Set<string> {
  const roots = new Set(tree.roots)
  return new Set(branchIds(tree).filter((id) => !roots.has(id)))
}

/**
 * L'estat de la vista de la cascada (només per mirar): la cascada de l'app (`appCascade`, sempre la del codi), les branques
 * plegades, el node triat, les mides mesurades dels nodes i la cerca. Res no es desa ni s'edita.
 */
export function useCascadeView() {
  const draft = appCascade()
  const tree = useMemo(() => draftTree(draft), [draft])
  const rf = useReactFlow<CascadeFlowNode, Edge>()
  // D'entrada, només l'arbre (les fletxes «a dins de»).
  const [showLinks, setShowLinks] = usePersistentFlag("mobles:cascade-links-v2", false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(tree))
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | undefined>()
  const [sizes, setSizes] = useState<ReadonlyMap<string, { w: number; h: number }>>(new Map())
  const matches = useMemo(() => searchMatches(draft, query), [draft, query])

  // Plegar o desplegar sense que el node es mogui a la pantalla: es desplaça la vista el que s'ha mogut el node.
  const live = useLatest({ draft, tree, collapsed, sizes })
  const toggle = useCallback(
    (id: string) => {
      const cur = live.current
      const next = new Set(cur.collapsed)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const before = flowPositions(cur).get(id)
      const after = flowPositions({ ...cur, collapsed: next }).get(id)
      if (before && after) {
        const vp = rf.getViewport()
        void rf.setViewport({ x: vp.x - (after.x - before.x) * vp.zoom, y: vp.y - (after.y - before.y) * vp.zoom, zoom: vp.zoom })
      }
      setCollapsed(next)
    },
    [live, rf],
  )

  // Després d'un canvi que ho demana: encaixar-ho tot o uns nodes (quan ja són al dibuix).
  const pending = useRef<{ fit: "all" } | { fit: "nodes"; ids: string[] } | null>(null)
  const flow = useMemo(() => buildFlow({ draft, tree, collapsed, sizes, showLinks, matches, selected, onToggle: toggle }), [draft, tree, collapsed, sizes, showLinks, matches, selected, toggle])
  useEffect(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    requestAnimationFrame(() => void rf.fitView(p.fit === "all" ? FIT : { ...FIT, nodes: p.ids.map((id) => ({ id })) }))
  }, [flow, rf])

  /** Triar un node i anar-hi (es despleguen els de sobre). */
  const focus = useCallback(
    (id: string) => {
      const up = ancestorIds(live.current.tree, id)
      if (up.some((a) => live.current.collapsed.has(a))) setCollapsed(new Set([...live.current.collapsed].filter((c) => !up.includes(c))))
      setSelected(id)
      pending.current = { fit: "nodes", ids: [id] }
    },
    [live],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia el text de la cerca
  }, [query])

  // Només les mides que mesura React Flow (no es mou ni es tria res des del llenç).
  const onNodesChange = useCallback((changes: NodeChange<CascadeFlowNode>[]) => {
    const dims = changes.flatMap((c) => (c.type === "dimensions" && c.dimensions ? [{ id: c.id, w: c.dimensions.width, h: c.dimensions.height }] : []))
    if (!dims.length) return
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

  return {
    draft,
    flow,
    query,
    setQuery,
    matchCount: matches.size,
    selected: selected === undefined ? undefined : draft.nodes.find((n) => n.id === selected),
    focus,
    showLinks,
    setShowLinks,
    canvas: { onNodesChange, onNodeClick: setSelected, onPaneClick: () => setSelected(undefined), onNodeDoubleClick: toggle },
    collapseAll: () => {
      setCollapsed(new Set(branchIds(tree)))
      pending.current = { fit: "all" }
    },
    expandAll: () => {
      setCollapsed(new Set())
      pending.current = { fit: "all" }
    },
  }
}
