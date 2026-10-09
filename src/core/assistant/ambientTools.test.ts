import { describe, expect, it } from "vitest"
import { AmbientSchema, DEFAULT_SETTINGS, EMPTY_AMBIENT, footprintBox, resolveTemplateRef, type Ambient } from "../model"
import { AMBIENT_TOOL_INPUTS, againstWall, ambientPayload, ambientToolSet, catalogueEntries, runAmbientTool, type AmbientToolContext, type LibraryEntry } from "./ambientTools"
import type { ToolRun } from "./toolset"

/** Context fals (sense Dexie): la llista de l'usuari en memòria i «crear de plantilla» que hi afegeix. */
function fakeCtx(): AmbientToolContext & { lib: LibraryEntry[]; created: string[] } {
  const lib: LibraryEntry[] = [
    { id: 1, name: "Moble TV", kind: "moble", w: 1800, h: 450, d: 400 },
    { id: 2, name: "Sofà de 3 places", kind: "objecte", w: 2100, h: 850, d: 950, folder: "Client A" },
  ]
  const created: string[] = []
  return {
    lib,
    created,
    settings: DEFAULT_SETTINGS,
    library: () => lib,
    createFromTemplate: async (ref) => {
      created.push(ref)
      const e: LibraryEntry = { id: 100 + created.length, name: resolveTemplateRef(ref)?.name ?? ref, kind: "objecte", w: 600, h: 850, d: 650 }
      lib.push(e)
      return e
    },
  }
}

async function ok(a: Ambient, name: string, input: unknown, ctx: AmbientToolContext): Promise<Extract<ToolRun<Ambient>, { ok: true }>> {
  const r = await runAmbientTool(a, name, input, ctx)
  if (!r.ok) throw new Error(`${name}: ${r.error}`)
  expect(AmbientSchema.safeParse(r.doc).success).toBe(true)
  return r
}
async function err(a: Ambient, name: string, input: unknown, ctx: AmbientToolContext): Promise<string> {
  const r = await runAmbientTool(a, name, input, ctx)
  expect(r.ok).toBe(false)
  return r.ok ? "" : r.error
}
const empty = (): Ambient => structuredClone(EMPTY_AMBIENT)

describe("assistent IA: eines dels ambients", () => {
  it("les definicions són JSON Schema d'objecte i les instruccions diuen les coordenades", () => {
    const set = ambientToolSet(fakeCtx())
    expect(set.tools.map((t) => t.name)).toEqual(Object.keys(AMBIENT_TOOL_INPUTS))
    for (const t of set.tools) expect(t.input_schema.type).toBe("object")
    expect(set.system).toContain("y cap **avall**")
    expect(set.system).toContain("horari")
  })

  it("add_room als eixos o per dins; resum amb parets, llargades i m²", async () => {
    const ctx = fakeCtx()
    let a = (await ok(empty(), "add_room", { x: 0, y: 0, width: 4000, depth: 3000 }, ctx)).doc
    expect(a.walls).toHaveLength(4)
    let p = await ambientPayload("get_ambient", { doc: a, result: {} }, ctx)
    expect(p.ambient!.walls.map((w) => w.length)).toEqual([4000, 3000, 4000, 3000])
    expect(p.ambient!.floor_area_m2).toBe(12)
    expect(p.ambient!.closed_rooms).toBe(1)
    expect(p.materials).toContain("Parquet de roure")
    // Per dins: 3000 × 2500 de llum amb parets de 200 → eixos de 3200 × 2700.
    a = (await ok(empty(), "add_room", { x: 0, y: 0, width: 3000, depth: 2500, inner: true, thickness: 200 }, ctx)).doc
    p = await ambientPayload("get_ambient", { doc: a, result: {} }, ctx)
    expect(p.ambient!.walls[0]!.a).toEqual([-100, -100])
    expect(p.ambient!.walls.map((w) => w.length)).toEqual([3200, 2700, 3200, 2700])
  })

  it("obertures: per defecte al mig, ajustades a la paret (clampOpening) i sense trepitjar-se", async () => {
    const ctx = fakeCtx()
    let a = (await ok(empty(), "add_room", { x: 0, y: 0, width: 4000, depth: 3000 }, ctx)).doc
    const r = await ok(a, "add_opening", { wall: "Paret 1", kind: "window" }, ctx)
    a = r.doc
    expect(r.result).toMatchObject({ index: 0, kind: "window", at: 2000, width: 1200, height: 1200, sill: 900 })
    // Una porta massa a prop de l'extrem: es posa on hi cap.
    const door = await ok(a, "add_opening", { wall: a.walls[1]!.id, kind: "door", at: 100 }, ctx)
    expect(door.result).toMatchObject({ at: 450, adjusted: true })
    a = door.doc
    expect(await err(a, "add_opening", { wall: "1", kind: "door", at: 2300 }, ctx)).toContain("trepitja la 0")
    a = (await ok(a, "update_opening", { wall: "1", index: 0, width: 1600, sill: 1000 }, ctx)).doc
    expect(a.walls[0]!.openings![0]).toMatchObject({ w: 1600, sill: 1000 })
    a = (await ok(a, "remove_opening", { wall: "1", index: 0 }, ctx)).doc
    expect(a.walls[0]!.openings).toBeUndefined()
    expect(await err(a, "remove_opening", { wall: "1", index: 3 }, ctx)).toContain("cap obertura")
    expect(await err(a, "add_opening", { wall: "Paret 9", kind: "door" }, ctx)).toContain("No hi ha cap paret")
  })

  it("update_wall: extrems (les obertures es queden al seu lloc), alçada, material; remove_wall", async () => {
    const ctx = fakeCtx()
    let a = (await ok(empty(), "add_wall", { a: [0, 0], b: [3000, 0] }, ctx)).doc
    a = (await ok(a, "add_opening", { wall: "1", kind: "window", at: 2000 }, ctx)).doc
    a = (await ok(a, "update_wall", { wall: "1", a: [1000, 0], height: 2400, material: "Pintura blanca" }, ctx)).doc
    expect(a.walls[0]!.openings![0]!.at).toBe(1000)
    expect(a.walls[0]!.height).toBe(2400)
    expect(a.walls[0]!.material).toBe("Pintura blanca")
    expect(await err(a, "update_wall", { wall: "1", material: "Or massís" }, ctx)).toContain("no és a Preferències")
    a = (await ok(a, "remove_wall", { wall: a.walls[0]!.id }, ctx)).doc
    expect(a.walls).toHaveLength(0)
  })

  it("list_library: els de l'usuari i el catàleg, amb cerca sense accents", async () => {
    const ctx = fakeCtx()
    const r = await ok(empty(), "list_library", { query: "sofa" }, ctx)
    expect(r.result.mine).toEqual([{ project_id: 2, name: "Sofà de 3 places", kind: "objecte", w: 2100, h: 850, d: 950, folder: "Client A" }])
    const cat = r.result.catalogue as { template: string; name: string }[]
    expect(cat.length).toBeGreaterThan(0)
    expect(cat.every((t) => resolveTemplateRef(t.template))).toBe(true)
    const objects = await ok(empty(), "list_library", { source: "catalogue", kind: "objecte", limit: 5 }, ctx)
    expect((objects.result.catalogue as unknown[]).length).toBe(5)
    expect(objects.result.mine).toBeUndefined()
    // Totes les plantilles del catàleg es poden resoldre.
    expect(catalogueEntries().every((t) => resolveTemplateRef(t.ref))).toBe(true)
  })

  it("place_item: arrambat a una paret (el darrere contra la cara de dins, girat) i d'una plantilla del catàleg", async () => {
    const ctx = fakeCtx()
    let a = (await ok(empty(), "add_room", { x: 0, y: 0, width: 4000, depth: 3000 }, ctx)).doc
    // Paret de dalt (y = 0): el darrere mira amunt, rot 0; la cara de dins és a y = 50.
    let r = await ok(a, "place_item", { project_id: 1, against_wall: "Paret 1" }, ctx)
    a = r.doc
    expect(r.result).toMatchObject({ x: 2000, y: 50 + 200, rot: 0 })
    // Paret de la dreta (x = 4000): girat 90°, el darrere a x = 3950.
    r = await ok(a, "place_item", { project_id: 1, against_wall: "Paret 2", along: 1500 }, ctx)
    a = r.doc
    expect(r.result).toMatchObject({ x: 3950 - 200, y: 1500, rot: 90 })
    const it = a.items.at(-1)!
    expect(footprintBox(it.x, it.y, 1800, 400, it.rot).x1).toBeCloseTo(3950)
    // Paret de baix: rot 180; paret de l'esquerra: rot 270.
    expect(againstWall(a, a.walls[2]!, { w: 1800, d: 400 }, {}).rot).toBe(180)
    expect(againstWall(a, a.walls[3]!, { w: 1800, d: 400 }, {}).rot).toBe(270)
    // Plantilla: es crea (context) i es col·loca.
    const tpl = catalogueEntries().find((t) => t.ref === "object:object-fridge")!
    r = await ok(a, "place_item", { template: tpl.ref, x: 500, y: 2500, rot: 450 }, ctx)
    expect(ctx.created).toEqual(["object:object-fridge"])
    expect(r.result).toMatchObject({ name: "Nevera", rot: 90, created: true })
    a = r.doc
    expect(await err(a, "place_item", { project_id: 77 }, ctx)).toContain("list_library")
    expect(await err(a, "place_item", {}, ctx)).toContain("un dels dos")
    expect(await err(a, "place_item", { template: "object:no-hi-és" }, ctx)).toContain("No hi ha cap plantilla")
    const p = await ambientPayload("get_ambient", { doc: a, result: {} }, ctx)
    expect(p.ambient!.items.map((i) => [i.name, i.kind, i.w, i.d])).toEqual([
      ["Moble TV", "moble", 1800, 400],
      ["Moble TV", "moble", 1800, 400],
      ["Nevera", "objecte", 600, 650],
    ])
  })

  it("move_item, rotate_item, set_item_group (grup sencer), remove_item i set_materials", async () => {
    const ctx = fakeCtx()
    let a = (await ok(empty(), "add_room", { x: 0, y: 0, width: 4000, depth: 3000 }, ctx)).doc
    a = (await ok(a, "place_item", { project_id: 1, x: 2000, y: 1500 }, ctx)).doc
    a = (await ok(a, "place_item", { project_id: 2, x: 2000, y: 2200 }, ctx)).doc
    const [tv, sofa] = a.items
    a = (await ok(a, "move_item", { item: tv!.id, dx: 100, elevation: 300 }, ctx)).doc
    expect(a.items[0]).toMatchObject({ x: 2100, y: 1500, elevation: 300 })
    a = (await ok(a, "move_item", { item: "Sofà de 3 places", against_wall: "Paret 3" }, ctx)).doc
    expect(a.items[1]).toMatchObject({ y: 3000 - 50 - 475, rot: 180 })
    a = (await ok(a, "rotate_item", { item: tv!.id, by: -90 }, ctx)).doc
    expect(a.items[0]!.rot).toBe(270)
    a = (await ok(a, "set_item_group", { items: [tv!.id, sofa!.id], group: "Saló" }, ctx)).doc
    a = (await ok(a, "move_item", { group: "Saló", dy: -100 }, ctx)).doc
    expect(a.items.map((i) => i.y)).toEqual([1400, 3000 - 50 - 475 - 100])
    expect(await err(a, "move_item", { group: "Saló", x: 5 }, ctx)).toContain("dx, dy")
    a = (await ok(a, "rotate_item", { group: "Saló", by: 180 }, ctx)).doc
    a = (await ok(a, "set_materials", { floor: "Parquet de roure", ceiling: null }, ctx)).doc
    expect(a.floorMaterial).toBe("Parquet de roure")
    expect(await err(a, "set_materials", {}, ctx)).toContain("Cal algun material")
    a = (await ok(a, "remove_item", { group: "Saló" }, ctx)).doc
    expect(a.items).toHaveLength(0)
  })
})
