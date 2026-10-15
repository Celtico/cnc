import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import type { Vector3 } from "three"
import type { Panel } from "../../../core/model"
import { S } from "./constants"
import type { CabinetViewerProps } from "./types"

type Live = Pick<CabinetViewerProps, "onSelectModule" | "onSelectPart" | "onSelectHardware" | "modules" | "size">

/** Callbacks estables per a totes les peces (clic, ratolí a sobre, ferratge col·locat). */
export function usePanelHandlers(current: Live, setHoverModule: Dispatch<SetStateAction<number | null>>) {
  // Callbacks estables per a totes les peces (la peça arriba com a dada): el que fan llegeix les props d'ara.
  const live = useRef(current)
  useEffect(() => {
    live.current = current
  })
  // Ferratges col·locats: callbacks estables (les peces no es tornen a dibuixar en canviar la selecció d'una altra).
  const onFittingSelect = useCallback((id: string) => live.current.onSelectHardware?.(id), [])
  const onPanelHover = useCallback((p: Panel, on: boolean) => {
    setHoverModule((h) => (on ? (p.module ?? null) : h === p.module ? null : h))
  }, [setHoverModule])
  const onPanelClick = useCallback((p: Panel, pt: Vector3) => {
    const l = live.current
    if (p.id.startsWith("part:")) return l.onSelectPart?.(p.id.slice(5))
    const id = l.modules?.find((m) => m.index === p.module)?.id
    // Punt clicat en mm de la composició (el grup està centrat a l'escena).
    if (id) l.onSelectModule?.(id, [pt.x / S + l.size.width / 2, pt.y / S, pt.z / S + l.size.depth / 2])
  }, [])
  return { onFittingSelect, onPanelHover, onPanelClick }
}
