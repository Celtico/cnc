import { useCallback, useEffect, useRef } from "react"
import type { Vector3 } from "three"
import type { Panel } from "../../../core/model"
import { hoverKey, type HoverLink } from "../../hoverLink"
import { S } from "./constants"
import type { CabinetViewerProps } from "./types"

type Live = Pick<CabinetViewerProps, "onSelectModule" | "onSelectPart" | "onSelectHardware" | "modules" | "size" | "hoverAt">

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
  // Dins d'un mòdul triat, el compartiment del punt (`hoverAt`); en sortir, s'esborra el que s'havia marcat.
  const { enter, leave } = link
  const last = useRef<string | null>(null)
  const onPanelHover = useCallback((p: Panel, on: boolean, pt?: Vector3) => {
    const l = live.current
    if (!on) {
      if (last.current) leave(last.current)
      last.current = null
      return
    }
    const part = p.id.startsWith("part:")
    const id = part ? p.id.slice(5) : l.modules?.find((m) => m.index === p.module)?.id
    if (!id) return
    const key = part ? hoverKey("part", id) : l.hoverAt && pt ? l.hoverAt(id, toMm(pt, l.size)) : hoverKey("module", id)
    last.current = key
    enter(key)
  }, [enter, leave])
  const onPanelClick = useCallback((p: Panel, pt: Vector3) => {
    const l = live.current
    if (p.id.startsWith("part:")) return l.onSelectPart?.(p.id.slice(5))
    const id = l.modules?.find((m) => m.index === p.module)?.id
    if (id) l.onSelectModule?.(id, toMm(pt, l.size))
  }, [])
  return { onFittingSelect, onPanelHover, onPanelClick }
}

/** Punt de l'escena en mm de la composició (el grup està centrat a l'escena). */
function toMm(pt: Vector3, size: CabinetViewerProps["size"]): [number, number, number] {
  return [pt.x / S + size.width / 2, pt.y / S, pt.z / S + size.depth / 2]
}
