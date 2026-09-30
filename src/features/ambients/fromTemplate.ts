import { buildBounds, buildComposition } from "../../core/build/buildComposition"
import { uniqueName } from "../../core/file/mobleFile"
import { layoutTemplate, newId, resolveTemplateRef, templateWalls, type Ambient, type AmbientItem, type AmbientTemplate } from "../../core/model"
import { createAmbient, createProject, db } from "../../db/db"

const sizeOfRef = (ref: string) => {
  const b = buildBounds(buildComposition(resolveTemplateRef(ref)!.make()))
  return { w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] }
}

/** Ambient de previsualització (miniatura del catàleg): els elements com a blocs de la seva petjada. */
export function templatePreview(t: AmbientTemplate): Ambient {
  const sizes = new Map<string, { w: number; d: number }>()
  const size = (ref: string) => sizes.get(ref) ?? (sizes.set(ref, sizeOfRef(ref)), sizes.get(ref)!)
  const items: AmbientItem[] = layoutTemplate(t, size).map((p) => ({ id: newId("i"), kind: "block", name: p.ref, shape: "box", w: size(p.ref).w, h: 100, d: size(p.ref).d, material: "", x: p.x, y: p.y, rot: p.rot, ...(p.elevation ? { elevation: p.elevation } : {}) }))
  return { walls: templateWalls(t), items, floorMaterial: t.floor, wallMaterial: t.wall }
}

/**
 * Crea un ambient del catàleg: cada moble i objecte es crea a Mobles / Objectes (un per
 * plantilla) i es col·loca enllaçat a l'ambient. Torna l'id de l'ambient nou.
 */
export async function createAmbientFromTemplate(t: AmbientTemplate): Promise<number> {
  const names = (await db.projects.toArray()).map((p) => p.name)
  const made = new Map<string, { id: number; w: number; d: number }>()
  for (const ref of [...new Set(t.items.map((i) => i.ref))]) {
    const tpl = resolveTemplateRef(ref)
    if (!tpl) continue
    const comp = { ...tpl.make(), kind: tpl.kind }
    const name = uniqueName(tpl.name, names)
    names.push(name)
    const id = await createProject(name, undefined, { composition: comp })
    const b = buildBounds(buildComposition(comp))
    made.set(ref, { id, w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] })
  }
  const items: AmbientItem[] = layoutTemplate(t, (ref) => made.get(ref) ?? { w: 600, d: 600 }).flatMap((p) => {
    const m = made.get(p.ref)
    return m ? [{ id: newId("i"), kind: "moble" as const, projectId: m.id, x: Math.round(p.x), y: Math.round(p.y), rot: p.rot, ...(p.elevation ? { elevation: p.elevation } : {}), ...(p.group ? { group: p.group } : {}) }] : []
  })
  const ambients = (await db.ambients.toArray()).map((a) => a.name)
  const data: Ambient = { walls: templateWalls(t), items, floorMaterial: t.floor, wallMaterial: t.wall }
  return createAmbient(uniqueName(t.name, ambients), data)
}
