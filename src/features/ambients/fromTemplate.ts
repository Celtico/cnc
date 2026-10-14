import { buildBounds, buildComposition } from "../../core/build/buildComposition"
import { uniqueName } from "../../core/file/mobleFile"
import { layoutTemplate, newId, resolveTemplateRef, templateWalls, withInnerClearance, type Ambient, type AmbientItem, type AmbientTemplate } from "../../core/model"
import { createAmbient, createProject, db, setAmbientsFolder } from "../../db/db"
import { currentSettings } from "../../db/settingsStore"
import { eyePose } from "./planGeom"

/**
 * Crea un ambient del catàleg: cada moble i objecte es crea a Mobles / Objectes (un per
 * plantilla; a l'Historial, o al grup del client si n'hi ha) i es col·loca enllaçat a l'ambient.
 * Torna l'id de l'ambient nou.
 */
export async function createAmbientFromTemplate(t: AmbientTemplate, client?: string): Promise<number> {
  // Per a un client (o projecte): l'ambient porta el seu nom i tot va al grup del client. Cada cop
  // que s'obre una escena es fan còpies noves: dos clients amb la mateixa escena no es toquen.
  const who = client?.trim() || undefined
  const ambients = (await db.ambients.toArray()).map((a) => a.name)
  const ambientName = uniqueName(who ? `${t.name} · ${who}` : t.name, ambients)
  // Sense client, a l'Historial (de pas); amb client, al seu grup de Projectes.
  const folder = who
  const names = (await db.projects.toArray()).map((p) => p.name)
  const made = new Map<string, { id: number; w: number; d: number }>()
  // Els mobles nous prenen la folgança de les peces de dins de Preferències (com un mòdul nou).
  const { gaps } = await currentSettings()
  for (const ref of [...new Set(t.items.map((i) => i.ref))]) {
    const tpl = resolveTemplateRef(ref)
    if (!tpl) continue
    const comp = withInnerClearance({ ...tpl.make(), kind: tpl.kind }, gaps.innerClearance, gaps.grooveClearance)
    const name = uniqueName(tpl.name, names)
    names.push(name)
    const id = await createProject(name, undefined, { composition: comp, ...(folder ? { folder } : {}) })
    const b = buildBounds(buildComposition(comp))
    made.set(ref, { id, w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] })
  }
  const items: AmbientItem[] = layoutTemplate(t, (ref) => made.get(ref) ?? { w: 600, d: 600 }).flatMap((p) => {
    const m = made.get(p.ref)
    return m ? [{ id: newId("i"), kind: "moble" as const, projectId: m.id, x: Math.round(p.x), y: Math.round(p.y), rot: p.rot, ...(p.elevation ? { elevation: p.elevation } : {}), ...(p.group ? { group: p.group } : {}) }] : []
  })
  const data: Ambient = { walls: templateWalls(t), items, floorMaterial: t.floor, wallMaterial: t.wall, ...(t.render ? { render: t.render } : {}) }
  // Escenes «com una foto»: el 3D s'obre amb la càmera d'Interior (a l'alçada dels ulls; fov 55 com el botó).
  const eye = t.eye ? eyePose(data) : null
  if (eye) data.camera = { position: eye.pos, target: eye.target, fov: 55, pose: "eye" }
  const id = await createAmbient(ambientName, data)
  if (who) await setAmbientsFolder([id], who)
  return id
}
