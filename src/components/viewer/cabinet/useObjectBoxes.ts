import { useMemo } from "react"
import { modelFootprint, partSize, partsBox, type RefObject } from "../../../core/model"
import type { SnapTargets } from "./RefGhost"
import type { CabinetViewerProps } from "./types"

type Args = Pick<CabinetViewerProps, "size" | "modules" | "parts" | "models" | "ghosts" | "selectedSet" | "selectedPartId" | "selectedModelId" | "selectedGroup">

/** Caixes dels objectes que es mouen amb el gizmo (peces lliures, models, grup, selecció múltiple) i les arestes on s'enganxen. */
export function useObjectBoxes({ size, modules, parts, models, ghosts, selectedSet, selectedPartId, selectedModelId, selectedGroup }: Args) {
  // Arestes on s'enganxen els objectes en arrossegar-los: mòduls, altres objectes, terra i paret.
  const snapTargets = useMemo((): SnapTargets => {
    const t: SnapTargets = { x: [0, size.width], y: [0, size.height], z: [0, size.depth] }
    for (const m of modules ?? []) {
      t.x.push(m.x, m.x + m.width)
      t.y.push(m.y, m.y + m.height)
      t.z.push(m.depth)
    }
    return t
  }, [modules, size.width, size.height, size.depth])
  // Caixa de cada peça lliure com a «objecte» (per reutilitzar l'arrossegament i el gizmo).
  const partBoxes = useMemo((): RefObject[] => (parts ?? []).map((p) => {
    const s = partSize(p)
    return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, w: s[0], h: s[1], d: s[2] }
  }), [parts])
  const selectedPartBox = partBoxes.find((b) => b.id === selectedPartId)
  // Caixa de cada model 3D, amb el gir (per al contorn, el gizmo i l'imant dels altres).
  const modelBoxes = useMemo((): RefObject[] => (models ?? []).map((m) => {
    const f = modelFootprint(m)
    return { id: m.id, name: m.name, x: f.x, y: m.y, z: f.z, w: f.w, h: m.h, d: f.d }
  }), [models])
  const selectedModelBox = modelBoxes.find((b) => b.id === selectedModelId)
  // La caixa de la selecció múltiple (peces, models i objectes de referència).
  const setBox = useMemo((): RefObject | null => {
    if (!selectedSet?.length) return null
    const boxes = selectedSet.flatMap((x) => {
      if (x.kind === "module") {
        const m = modules?.find((q) => q.id === x.id)
        return m ? [{ x: m.x, y: m.y, z: m.z ?? 0, w: m.width, h: m.height, d: m.depth }] : []
      }
      const b = x.kind === "part" ? partBoxes.find((q) => q.id === x.id) : x.kind === "model" ? modelBoxes.find((q) => q.id === x.id) : ghosts?.find((q) => q.id === x.id)
      return b ? [b] : []
    })
    if (!boxes.length) return null
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y)), z0 = Math.min(...boxes.map((b) => b.z))
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h)), z1 = Math.max(...boxes.map((b) => b.z + b.d))
    return { id: "multi", name: `${boxes.length} elements`, x: x0, y: y0, z: z0, w: x1 - x0, h: y1 - y0, d: z1 - z0 }
  }, [selectedSet, partBoxes, modelBoxes, ghosts, modules])
  const selectedModel = models?.find((m) => m.id === selectedModelId)
  // La caixa del grup triat: les seves peces lliures i els seus models 3D.
  const groupBox = useMemo((): RefObject | null => {
    const members = (parts ?? []).filter((p) => p.group && p.group === selectedGroup)
    const ms = (models ?? []).filter((m) => m.group && m.group === selectedGroup)
    if (!members.length && !ms.length) return null
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    if (members.length) {
      const b = partsBox(members)
      for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, b.min[k]!)
      max[k] = Math.max(max[k]!, b.max[k]!)
    }
    }
    for (const m of ms) {
      const f = modelFootprint(m)
      const lo = [f.x, m.y, f.z], hi = [f.x + f.w, m.y + m.h, f.z + f.d]
      for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, lo[k]!)
      max[k] = Math.max(max[k]!, hi[k]!)
    }
    }
    return { id: `group:${selectedGroup}`, name: selectedGroup!, x: min[0]!, y: min[1]!, z: min[2]!, w: max[0]! - min[0]!, h: max[1]! - min[1]!, d: max[2]! - min[2]! }
  }, [parts, models, selectedGroup])
  return { snapTargets, partBoxes, selectedPartBox, modelBoxes, selectedModelBox, setBox, selectedModel, groupBox }
}
