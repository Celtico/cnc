import { useCallback, useEffect, useRef } from "react"
import type { Vector3 } from "three"
import type { Panel } from "../../../core/model"
import { hoverKey, type HoverLink } from "../../hoverLink"
import { S } from "./constants"
import type { CabinetViewerProps } from "./types"

type Live = Pick<CabinetViewerProps, "onSelectModule" | "onSelectPart" | "onSelectHardware" | "modules" | "size">

/** Callbacks estables per a totes les peces (clic, ratolí a sobre, ferratge col·locat). */
export function usePanelHandlers(current: Live, link: Pick<HoverLink, "enter" | "leave">) {
  // Callbacks estables per a totes les peces (la peça arriba com a dada): el que fan llegeix les props d'ara.
  const live = useRef(current)
  useEffect(() => {
    live.current = current
  })
  // Ferratges col·locats: callbacks estables (les peces no es tornen a dibuixar en canviar la selecció d'una altra).
  const onFittingSelect = useCallback((id: string) => live.current.onSelectHardware?.(id), [])
  // La peça és d'una peça lliure o d'un mòdul: la clau de la seva fila a l'arbre (`useHoverLink`).
  const { enter, leave } = link
  const onPanelHover = useCallback((p: Panel, on: boolean) => {
    const id = p.id.startsWith("part:") ? p.id.slice(5) : live.current.modules?.find((m) => m.index === p.module)?.id
    if (!id) return
    const key = hoverKey(p.id.startsWith("part:") ? "part" : "module", id)
    if (on) enter(key)
    else leave(key)
  }, [enter, leave])
  const onPanelClick = useCallback((p: Panel, pt: Vector3) => {
    const l = live.current
    if (p.id.startsWith("part:")) return l.onSelectPart?.(p.id.slice(5))
    const id = l.modules?.find((m) => m.index === p.module)?.id
    // Punt clicat en mm de la composició (el grup està centrat a l'escena).
    if (id) l.onSelectModule?.(id, [pt.x / S + l.size.width / 2, pt.y / S, pt.z / S + l.size.depth / 2])
  }, [])
  return { onFittingSelect, onPanelHover, onPanelClick }
}
