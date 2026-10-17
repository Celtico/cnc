import { useEffect, useRef, useState } from "react"
import { autoHandles, moveHandle, type PNode, type Vec2 } from "../../../core/model"
import { useLatest } from "../../../lib/useLatest"
import { useHistory } from "../../history/useHistory"
import type { History, SetOptions } from "../../history/history"
import { viewOf, type Drag, type Tool } from "./profileGeometry"

/** La forma del perfil (amb desfer/refer), la selecció, l'eina, l'arrossegada, la vista i les accions sobre els nodes. */
export type ProfileShape = ReturnType<typeof useProfileShape>

export function useProfileShape(open: boolean, initial: PNode[]) {
  // La forma amb desfer/refer: arrossegar és en viu (`commit: false`) i fa un sol pas en deixar anar.
  const history = useHistory<PNode[]>(initial)
  const { value: nodes, set: setNodes, commit, reset } = history
  const [sel, setSel] = useState<number | null>(null)
  const [tool, setTool] = useState<Tool>("edit")
  const [drag, setDrag] = useState<Drag | null>(null)
  // Maj premuda mentre s'arrossega un manegador: angle fixat (línia vermella, com a Figma).
  const [angleLock, setAngleLock] = useState(false)
  const [cursor, setCursor] = useState<Vec2 | null>(null)
  // Historial en començar la ploma: cancel·lar-la hi torna (sense deixar passos de la forma descartada).
  const beforePen = useRef<History<PNode[]> | null>(null)
  // Només en obrir-se: el pare pot tornar a renderitzar amb un `initial` nou (mateix contingut).
  const initialRef = useLatest(initial)
  useEffect(() => {
    if (open) {
      reset(initialRef.current)
      setView(viewOf(initialRef.current))
      setSel(null)
      setTool("edit")
    }
  }, [open, reset, initialRef])

  const drawing = tool === "pen"
  // Vista: es congela mentre s'arrossega o es dibuixa perquè el dibuix no salti.
  const [view, setView] = useState(() => viewOf(initial))
  useEffect(() => {
    if (drag === null && !drawing && nodes.length >= 2) setView(viewOf(nodes))
  }, [nodes, drag, drawing])

  const set = (i: number, n: PNode, opts?: SetOptions) => setNodes((cur) => cur.map((q, k) => (k === i ? n : q)), opts)

  const remove = (i: number) => {
    if (nodes.length <= 3) return
    setNodes((cur) => cur.filter((_, k) => k !== i))
    setSel(null)
  }
  const toggleSmooth = (i: number) => {
    const n = nodes[i]!
    if (n.in || n.out) set(i, { x: n.x, y: n.y })
    else set(i, autoHandles(nodes, i))
  }
  const setType = (i: number, t: "corner" | "smooth" | "symmetric") => {
    const n = nodes[i]!
    if (!n.in && !n.out && t !== "corner") {
      set(i, { ...autoHandles(nodes, i), t })
      return
    }
    let next: PNode = { ...n, t }
    // En passar a suau o simètric, alinea el manegador d'entrada amb el de sortida.
    if (t !== "corner" && n.out) next = moveHandle(next, "out", n.out)
    set(i, next)
  }
  const startPen = () => {
    beforePen.current = history.state
    setNodes([])
    setSel(null)
    setTool("pen")
  }
  const cancelPen = () => {
    if (beforePen.current) history.restore(beforePen.current)
    setDrag(null)
    setTool("edit")
    setCursor(null)
  }
  const finishPen = () => {
    if (nodes.length >= 3) {
      setTool("edit")
      setCursor(null)
    }
  }

  // Desfer/refer (⌘Z, ⇧⌘Z, Ctrl Y, només dins del diàleg). Amb la ploma, desfer treu l'últim node; sense cap node, la
  // cancel·la (torna la forma d'abans).
  const undo = () => {
    if (drawing && nodes.length === 0) return cancelPen()
    history.undo()
    setDrag(null)
    setSel(null)
  }
  const redo = () => {
    history.redo()
    setDrag(null)
    setSel(null)
  }

  return { history, nodes, setNodes, commit, sel, setSel, tool, setTool, drag, setDrag, angleLock, setAngleLock, cursor, setCursor, drawing, view, set, remove, toggleSmooth, setType, startPen, cancelPen, finishPen, undo, redo }
}
