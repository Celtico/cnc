import { useEffect, useRef, useState } from "react"
import type { PlanPt } from "../../../core/model"
import type { Tool } from "../planGeom"

/** Estat de les eines del plànol (ploma, habitació, calibrar, cursor) i les tecles: espai per desplaçar, Esc / Retorn. */
export function usePlanTools({ tool, onToolDone }: { tool: Tool; onToolDone: () => void }) {
  const [room, setRoom] = useState<{ a: PlanPt; b: PlanPt } | null>(null)
  const [chain, setChain] = useState<PlanPt[]>([])
  // La nansa de sortida de l'últim punt de la ploma (clic i arrossegar): la paret següent en surt corba.
  const [penOut, setPenOut] = useState<PlanPt | null>(null)
  // Maj apretada a la ploma: el tram surt recte (sense la nansa).
  const [penStraight, setPenStraight] = useState(false)
  const [cursor, setCursor] = useState<PlanPt | null>(null)
  const [calib, setCalib] = useState<PlanPt[]>([])
  const space = useRef(false)

  // Canviar d'eina buida la ploma i la calibració.
  useEffect(() => {
    setChain([])
    setPenOut(null)
    setCalib([])
    setRoom(null)
  }, [tool])

  // Espai: arrossegar per desplaçar (com Figma). Esc / Retorn acaben la ploma.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return
      if (e.code === "Space") space.current = true
      if (tool === "wall" && (e.key === "Escape" || e.key === "Enter")) {
        setChain([])
        onToolDone()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [tool, onToolDone])

  return { room, setRoom, chain, setChain, penOut, setPenOut, penStraight, setPenStraight, cursor, setCursor, calib, setCalib, space }
}

export type PlanTools = ReturnType<typeof usePlanTools>
