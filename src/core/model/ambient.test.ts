import { describe, expect, it } from "vitest"
import { buildBounds, buildComposition } from "../build/buildComposition"
import { BLOCK_PRESETS, blockComposition, footprintBox, parseAmbient, resizeComposition, roomWalls, snapToWalls } from "./ambient"
import { BUILTIN_TEMPLATES } from "./templates"
import { STORE_TEMPLATES } from "./storeCatalog"

const size = (c: Parameters<typeof buildComposition>[0]) => {
  const b = buildBounds(buildComposition(c))
  return { w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] }
}

describe("ambients", () => {
  it("canviar les mides generals d'un moble dona (gairebé) la mida demanada", () => {
    for (const t of [...BUILTIN_TEMPLATES.slice(0, 8), ...STORE_TEMPLATES.filter((_, i) => i % 15 === 0)]) {
      const comp = t.make()
      const cur = size(comp)
      const next = { w: Math.round(cur.w * 1.2), h: Math.round(cur.h * 0.9), d: Math.round(cur.d * 1.1) }
      const got = size(resizeComposition(comp, cur, next))
      // Els gruixos dels taulers no s'escalen: tolerància d'uns quants mm per moble.
      expect(Math.abs(got.w - next.w), `${t.name} ample`).toBeLessThan(Math.max(40, next.w * 0.03))
      expect(Math.abs(got.h - next.h), `${t.name} alt`).toBeLessThan(Math.max(40, next.h * 0.03))
      expect(Math.abs(got.d - next.d), `${t.name} fons`).toBeLessThan(Math.max(40, next.d * 0.05))
    }
  })

  it("els blocs fan la seva mida i no van al nesting", () => {
    for (const p of BLOCK_PRESETS) {
      const b = buildComposition(blockComposition(p))
      expect(b.panels).toHaveLength(0)
      const s = size(blockComposition(p))
      expect([Math.round(s.w), Math.round(s.h), Math.round(s.d)]).toEqual([p.w, p.h, p.d])
    }
  })

  it("imant a les parets i caixa girada", () => {
    const walls = roomWalls(0, 0, 4000, 3000, 100)
    // Un moble de 1000 × 500 a 80 mm de la paret de dalt (cara de dins a y = 50).
    const s = snapToWalls(2000, 50 + 80 + 250, 1000, 500, 0, walls)
    expect(s.snapped).toBe(true)
    expect(s.y).toBe(50 + 250)
    const b = footprintBox(0, 0, 1000, 500, 90)
    expect(Math.round(b.x1 - b.x0)).toBe(500)
    expect(Math.round(b.y1 - b.y0)).toBe(1000)
  })

  it("un ambient desat amb brossa es llegeix igualment", () => {
    const a = parseAmbient({ walls: [{ id: "w", a: [0, 0], b: [1000, 0], thickness: 100, height: 2600 }, { bad: 1 }], items: "x" })
    expect(a.walls).toHaveLength(1)
    expect(a.items).toEqual([])
  })
})

describe("plantilles d'objectes", async () => {
  const { OBJECT_TEMPLATES } = await import("./ambient")
  it("es fan, no van al nesting i no avisen de res greu", () => {
    for (const t of OBJECT_TEMPLATES) {
      const b = buildComposition(t.make())
      expect(b.panels, t.name).toHaveLength(0)
      expect(b.extras.length, t.name).toBeGreaterThan(0)
      expect(b.warnings.filter((w) => ["layout", "collision"].includes(w.code)), t.name).toEqual([])
    }
  })
})

describe("grups d'elements", async () => {
  const m = await import("./ambient")
  const base = { ...m.EMPTY_AMBIENT, items: [
    { id: "a", kind: "block" as const, name: "A", shape: "box" as const, w: 100, h: 100, d: 100, material: "x", x: 0, y: 0, rot: 0 },
    { id: "b", kind: "block" as const, name: "B", shape: "box" as const, w: 100, h: 100, d: 100, material: "x", x: 1000, y: 0, rot: 0 },
  ] }
  it("agrupar, moure, girar, duplicar i esborrar", () => {
    const g = m.setItemGroup(base, ["a", "b"], m.newItemGroupName(base))
    expect(m.groupIds(g, "Grup 1")).toEqual(["a", "b"])
    const mv = m.moveItems(g, ["a", "b"], 10, 20)
    expect(mv.items.map((i) => [i.x, i.y])).toEqual([[10, 20], [1010, 20]])
    const r = m.rotateItems(g, ["a", "b"], 90)
    expect(r.items.map((i) => [i.x, i.y, i.rot])).toEqual([[500, -500, 90], [500, 500, 90]])
    const d = m.duplicateItems(g, ["a", "b"])
    expect(d.group).toBe("Grup 2")
    expect(d.ambient.items).toHaveLength(4)
    expect(m.removeItems(d.ambient, d.ids).items).toHaveLength(2)
  })
})
