import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import { bendEdge, moveHandle, snapAngle45, splitEdge, type PNode, type Vec2 } from "../../../core/model"
import { LIVE, r1 } from "./profileGeometry"
import type { ProfileShape } from "./useProfileShape"

/**
 * El punter sobre el dibuix del perfil: ploma (nodes nous), arrossegar nodes, manegadors i costats, i els clics de Corbar i
 * Esborrar. `unit`: 1 % de la vista (mm); `minor`: el pas de l'imant (mm).
 */
export function useProfilePointer(shape: ProfileShape, unit: number, minor: number) {
  const { nodes, setNodes, commit, setSel, tool, setTool, drag, setDrag, setAngleLock, setCursor, drawing, set, remove, toggleSmooth, finishPen } = shape
  const svg = useRef<SVGSVGElement>(null)

  const toMm = (e: { clientX: number; clientY: number }): Vec2 => {
    const el = svg.current
    if (!el) return [0, 0]
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return [q.x, -q.y]
  }
  const snap = (v: number, fine: boolean) => (fine ? r1(v) : Math.round(v / minor) * minor)

  const capture = (e: ReactPointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (!drawing) {
      setSel(null)
      // Clic fora dels punts amb Corbar o Esborrar: torna a Moure.
      if (tool !== "edit") setTool("edit")
      return
    }
    // Ploma: nou node (si és a prop del primer, tanca la forma).
    const [x, y] = toMm(e)
    const first = nodes[0]
    if (first && nodes.length >= 3 && Math.hypot(first.x - x, first.y - y) < unit * 2.5) {
      finishPen()
      return
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    // Maj: angle a passos de 45° des del node d'abans (com a Figma); Ctrl/⌘: sense imant.
    const prev = nodes[nodes.length - 1]
    const fine = e.ctrlKey || e.metaKey
    const p: PNode = e.shiftKey && prev
      ? (([dx, dy]) => ({ x: r1(prev.x + dx), y: r1(prev.y + dy) }))(snapAngle45([x - prev.x, y - prev.y]))
      : { x: snap(x, fine), y: snap(y, fine) }
    setNodes((cur) => [...cur, p], LIVE)
    setDrag({ kind: "pen", i: nodes.length, x: e.clientX, y: e.clientY, moved: false })
  }
  const onMove = (e: ReactPointerEvent) => {
    const at = toMm(e)
    if (drawing) setCursor(at)
    if (!drag) return
    if (!drag.moved && drag.kind !== "handle" && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return
    if (!drag.moved) {
      setDrag({ ...drag, moved: true })
      if (drag.kind === "node" && drag.from) setTool("edit")
    }
    const [x, y] = at
    setAngleLock(e.shiftKey && (drag.kind === "handle" || drag.kind === "pen"))
    if (drag.kind === "node") {
      const n = nodes[drag.i]!
      const fine = e.ctrlKey || e.metaKey
      set(drag.i, { ...n, x: snap(x, fine), y: snap(y, fine) }, LIVE)
    } else if (drag.kind === "handle") {
      const n = nodes[drag.i]!
      const raw: Vec2 = [r1(x - n.x), r1(y - n.y)]
      const h: Vec2 = e.shiftKey ? snapAngle45(raw) : raw
      set(drag.i, moveHandle(e.altKey ? { ...n, t: "corner" } : n, drag.which, h), LIVE)
    } else if (drag.kind === "edge") {
      setNodes((cur) => bendEdge(cur, drag.i, [x, y]), LIVE)
    } else {
      // Ploma arrossegant: manegadors simètrics del node nou.
      const n = nodes[drag.i]!
      const raw: Vec2 = [r1(x - n.x), r1(y - n.y)]
      const h: Vec2 = e.shiftKey ? snapAngle45(raw) : raw
      set(drag.i, { x: n.x, y: n.y, out: h, in: [-h[0], -h[1]], t: "symmetric" }, LIVE)
    }
  }
  const onUp = () => {
    // Un pas per arrossegada (i per node de la ploma).
    commit()
    setAngleLock(false)
    if (drag?.kind === "node" && !drag.moved && drag.from === "bend") toggleSmooth(drag.i)
    if (drag?.kind === "node" && !drag.moved && drag.from === "erase") remove(drag.i)
    if (drag?.kind === "edge" && !drag.moved) {
      setNodes((cur) => splitEdge(cur, drag.i))
      setSel(drag.i + 1)
    }
    setDrag(null)
  }

  // Cercle del mig d'un costat: clic = node nou, arrossegar = corbar.
  const onEdgeDown = (ev: ReactPointerEvent, i: number) => {
    capture(ev)
    setDrag({ kind: "edge", i, x: ev.clientX, y: ev.clientY, moved: false })
  }
  const onHandleDown = (ev: ReactPointerEvent, i: number, which: "in" | "out") => {
    if (drawing) return
    capture(ev)
    setSel(i)
    setDrag({ kind: "handle", i, which, moved: false })
  }
  const onNodeDown = (ev: ReactPointerEvent, i: number) => {
    if (drawing) {
      if (i === 0 && nodes.length >= 3) {
        ev.stopPropagation()
        finishPen()
      }
      return
    }
    // A Corbar i Esborrar, el clic fa l'acció en deixar anar; si s'arrossega, mou el node
    // i torna a l'eina Moure.
    capture(ev)
    setSel(i)
    setDrag({ kind: "node", i, x: ev.clientX, y: ev.clientY, moved: false, from: tool === "bend" || tool === "erase" ? tool : undefined })
  }
  const onNodeDoubleClick = (i: number) => !drawing && toggleSmooth(i)

  return { svg, onBackgroundDown, onMove, onUp, onEdgeDown, onHandleDown, onNodeDown, onNodeDoubleClick }
}
