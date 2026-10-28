import type { RefObject } from "react"
import { moduleFromWorld, type CompositionBuild } from "../../core/build/buildComposition"
import { findZone, parentOf, type Composition } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { hoverKey, hoverTarget, zoneHoverKey } from "../../components/hoverLink"

/** Què tria un clic al 3D (mòdul, compartiment, peça o model; grups i Maj + clic com Figma). */
export function viewerPicks({
  comp,
  build,
  selection,
  select,
  selectModule,
  pick,
  shiftRef,
}: {
  comp: Composition
  build: CompositionBuild | undefined
  selection: Selection
  select: (s: Selection) => void
  selectModule: (id: string) => void
  pick: (s: Selection) => void
  shiftRef: RefObject<boolean>
}) {
  /**
   * Clic a una peça lliure al 3D (com Figma): si és d'un grup i no hi ha res del grup
   * seleccionat, selecciona el grup; si el grup (o una peça seva) ja ho està, la peça.
   */
  const selectPartFrom3D = (id: string) => {
    // Maj + clic: la peça sola, a la selecció múltiple.
    if (shiftRef.current) return pick({ kind: "part", id })
    const g = comp.parts?.find((p) => p.id === id)?.group
    const inside = g && ((selection.kind === "group" && selection.id === g) || (selection.kind === "part" && comp.parts?.find((p) => p.id === selection.id)?.group === g))
    select(g && !inside ? { kind: "group", id: g } : { kind: "part", id })
  }

  /**
   * El compartiment del punt `at` (mm, composició) del mòdul `id`, si el mòdul ja està seleccionat (o un compartiment
   * seu): com Figma, primer el mòdul i, un cop a dins, el que hi ha a dins. Sobre la carcassa (laterals, tapa, base) o
   * amb el mòdul no seleccionat, cap (el mòdul). Una sola regla per al clic i per al ratolí a sobre.
   */
  const zoneAt = (id: string, at?: [number, number, number]): string | null => {
    const inside = (selection.kind === "module" && selection.id === id) || (selection.kind === "zone" && selection.moduleId === id)
    const idx = comp.modules.findIndex((m) => m.id === id)
    const mb = build?.modules[idx]
    const mod = comp.modules[idx]
    if (!inside || !at || !mb || !mod) return null
    // El punt, al mòdul (també si està girat).
    const [lx] = moduleFromWorld(mb, at[0], at[2])
    const ly = at[1] - mb.y
    const inner = mb.build.layout.rects.get(mod.root.id)
    if (inner && (lx < inner.x0 || lx > inner.x1 || ly < inner.y0 || ly > inner.y1)) return null
    const tol = 25
    let best: { id: string; area: number } | null = null
    for (const z of mb.build.layout.leaves) {
      const r = mb.build.layout.rects.get(z.id)
      if (!r || lx < r.x0 - tol || lx > r.x1 + tol || ly < r.y0 - tol || ly > r.y1 + tol) continue
      const area = (r.x1 - r.x0) * (r.y1 - r.y0)
      if (!best || area < best.area) best = { id: z.id, area }
    }
    return best?.id ?? null
  }

  /** El que es ressalta amb el ratolí a sobre d'un mòdul (`useHoverLink`): el que triaria el clic. */
  const hoverKeyAt = (id: string, at?: [number, number, number]) => {
    const z = zoneAt(id, at)
    return z ? zoneHoverKey(id, z) : hoverKey("module", id)
  }

  /**
   * Clic al 3D. Un mòdul no seleccionat → el mòdul. Dins del mòdul seleccionat → el compartiment on s'ha clicat
   * (`zoneAt`). Sobre la carcassa → el mòdul. Tornar a clicar el compartiment ja seleccionat → puja al pare (fins al
   * mòdul).
   */
  const selectFrom3D = (id: string, at?: [number, number, number]) => {
    // Maj + clic a un mòdul: el mòdul sencer a la selecció múltiple.
    if (shiftRef.current) return pick({ kind: "module", id })
    // D'un grup (com les peces): el primer clic tria el grup; el segon, el mòdul.
    const grp = comp.modules.find((m) => m.id === id)?.group
    if (grp && !(selection.kind === "group" && selection.id === grp) && !((selection.kind === "module" && selection.id === id) || (selection.kind === "zone" && selection.moduleId === id))) return select({ kind: "group", id: grp })
    const mod = comp.modules.find((m) => m.id === id)
    const best = zoneAt(id, at)
    if (!best || !mod) return selectModule(id)
    // El mateix compartiment (o un dels seus fills) ja seleccionat: un nivell amunt.
    if (selection.kind === "zone" && selection.moduleId === id) {
      const sel = findZone(mod.root, selection.zoneId)
      if (sel && (sel.id === best || findZone(sel, best))) {
        const parent = parentOf(mod.root, sel.id)
        // Del compartiment es puja a la divisió, a l'«Interior» (l'arrel) i al mòdul (amb les portes de tot el mòdul).
        return parent ? select({ kind: "zone", moduleId: id, zoneId: parent.id }) : selectModule(id)
      }
    }
    select({ kind: "zone", moduleId: id, zoneId: best })
  }

  const selectModelFrom3D = (id: string) => {
    if (shiftRef.current) return pick({ kind: "model", id })
    // Com les peces: el primer clic a un model d'un grup tria el grup; el segon, el model.
    const g = comp.models?.find((m) => m.id === id)?.group
    const inside = g && ((selection.kind === "group" && selection.id === g) || (selection.kind === "model" && comp.models?.find((m) => m.id === selection.id)?.group === g))
    select(g && !inside ? { kind: "group", id: g } : { kind: "model", id })
  }

  /**
   * Botó dret al 3D: es tria el que hi ha sota el ratolí (el que es ressalta, `useHoverLink`), sense el «un nivell amunt»
   * del clic; a l'espai buit, el moble.
   */
  const selectHovered = (key: string | null) => {
    const t = hoverTarget(key)
    if (!t) return select({ kind: "moble" })
    if (t.kind === "zone") {
      const [moduleId, zoneId] = t.id.split("/")
      return moduleId && zoneId ? select({ kind: "zone", moduleId, zoneId }) : undefined
    }
    if (t.kind === "module") return selectModule(t.id)
    if (t.kind === "part" || t.kind === "ref" || t.kind === "model") select({ kind: t.kind, id: t.id })
  }

  return { selectFrom3D, selectPartFrom3D, selectModelFrom3D, hoverKeyAt, selectHovered }
}
