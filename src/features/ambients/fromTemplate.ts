import { buildBounds, buildComposition } from "../../core/build/buildComposition"
import { uniqueName } from "../../core/file/mobleFile"
import { layoutTemplate, newId, resolveTemplateRef, templateWalls, type Ambient, type AmbientItem, type AmbientTemplate } from "../../core/model"
import { createAmbient, createProject, db, setAmbientsFolder } from "../../db/db"

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
 * plantilla, dins d'un grup amb el nom de l'ambient) i es col·loca enllaçat a l'ambient.
 * Torna l'id de l'ambient nou.
 */
export async function createAmbientFromTemplate(t: AmbientTemplate, client?: string): Promise<number> {
  // Per a un client (o projecte): l'ambient porta el seu nom i tot va al grup del client. Cada cop
  // que s'obre una escena es fan còpies noves: dos clients amb la mateixa escena no es toquen.
  const who = client?.trim() || undefined
  const ambients = (await db.ambients.toArray()).map((a) => a.name)
  const ambientName = uniqueName(who ? `${t.name} · ${who}` : t.name, ambients)
  const folder = who ?? ambientName
  const names = (await db.projects.toArray()).map((p) => p.name)
  const made = new Map<string, { id: number; w: number; d: number }>()
  for (const ref of [...new Set(t.items.map((i) => i.ref))]) {
    const tpl = resolveTemplateRef(ref)
    if (!tpl) continue
    const comp = { ...tpl.make(), kind: tpl.kind }
    const name = uniqueName(tpl.name, names)
    names.push(name)
    // Al grup de l'ambient (a Mobles i a Objectes): així no s'escampen per l'historial.
    // `auto`: no surt a Mobles / Objectes fins que es toca (és part de l'escena).
    const id = await createProject(name, undefined, { composition: comp, folder, auto: true })
    const b = buildBounds(buildComposition(comp))
    made.set(ref, { id, w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] })
  }
  const items: AmbientItem[] = layoutTemplate(t, (ref) => made.get(ref) ?? { w: 600, d: 600 }).flatMap((p) => {
    const m = made.get(p.ref)
    return m ? [{ id: newId("i"), kind: "moble" as const, projectId: m.id, x: Math.round(p.x), y: Math.round(p.y), rot: p.rot, ...(p.elevation ? { elevation: p.elevation } : {}), ...(p.group ? { group: p.group } : {}) }] : []
  })
  const data: Ambient = { walls: templateWalls(t), items, floorMaterial: t.floor, wallMaterial: t.wall }
  const id = await createAmbient(ambientName, data)
  if (who) await setAmbientsFolder([id], who)
  return id
}
