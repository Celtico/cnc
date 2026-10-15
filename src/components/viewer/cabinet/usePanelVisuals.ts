import { useMemo, useRef } from "react"
import { fixedSolids, shelfPins, type HwSolid } from "../../../core/build/hardwareSolids"
import type { Hole, Panel } from "../../../core/model"
import { panelVisualKey } from "../exportablePanel"
import { movingGroups, type MovingGroup } from "../opening"

/** Dades derivades de les peces per dibuixar-les: grup mòbil, signatura visual i ferratges (per referència estable). */
export function usePanelVisuals(panels: Panel[], holesDrawn: boolean, hardware: boolean) {
  const groups = useMemo(() => movingGroups(panels), [panels])
  const groupOf = useMemo(() => {
    const m = new Map<string, MovingGroup>()
    for (const g of groups) for (const id of g.panelIds) m.set(id, g)
    return m
  }, [groups])
  // Signatura visual i col·locació de cada peça (es calculen un cop per construcció, no a cada render): `PanelMesh`
  // només es torna a dibuixar si canvien, així passar per sobre, arrossegar o editar un altre mòdul no refà les
  // geometries, els materials ni les textures de totes les peces.
  const panelKeys = useMemo(() => {
    const m = new Map<string, { sig: string; place: string }>()
    // `place` porta també el mòdul: el clic i el ressaltat el llegeixen de la peça (no és visual, però no pot quedar vell).
    for (const p of panels) m.set(p.id, { sig: panelVisualKey(p, holesDrawn), place: `${p.module ?? ""}|${JSON.stringify(p.placement)}` })
    return m
  }, [panels, holesDrawn])
  // Suports de prestatge (forats System 32 just sota un prestatge) per peça, per al dibuix dels ferratges. La mateixa
  // llista (referència) mentre no canviï: les peces que no hi tenen res nou no es tornen a dibuixar.
  const pinCache = useRef(new Map<string, { key: string; holes: Hole[] }>())
  const pinsOf = useMemo(() => {
    const out = new Map<string, Hole[]>()
    if (!hardware) return out
    const next = new Map<string, { key: string; holes: Hole[] }>()
    for (const [id, holes] of shelfPins(panels)) {
      const key = JSON.stringify(holes)
      const prev = pinCache.current.get(id)
      const keep = prev && prev.key === key ? prev : { key, holes }
      next.set(id, keep)
      out.set(id, keep.holes)
    }
    pinCache.current = next
    return out
  }, [panels, hardware])
  // Les parts fixes dels ferratges dels fronts (placa de la frontissa, cos del push) per la peça que les porta, amb la
  // mateixa memòria per referència.
  const fixedCache = useRef(new Map<string, { key: string; solids: HwSolid[] }>())
  const fixedOf = useMemo(() => {
    const out = new Map<string, HwSolid[]>()
    if (!hardware) return out
    const next = new Map<string, { key: string; solids: HwSolid[] }>()
    for (const [id, solids] of fixedSolids(panels)) {
      const key = JSON.stringify(solids)
      const prev = fixedCache.current.get(id)
      const keep = prev && prev.key === key ? prev : { key, solids }
      next.set(id, keep)
      out.set(id, keep.solids)
    }
    fixedCache.current = next
    return out
  }, [panels, hardware])
  return { groupOf, panelKeys, pinsOf, fixedOf }
}
