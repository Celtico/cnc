import { describe, expect, it } from "vitest"
import { buildBounds, buildComposition } from "../build/buildComposition"
import { OBJECT_TEMPLATES, wallOpenings, wallSegments, wallLength } from "./ambient"
import { AMBIENT_TEMPLATES, layoutTemplate, resolveTemplateRef, templateWalls } from "./ambientTemplates"
import { MAG_FURNITURE } from "./magFurniture"

describe("catàleg d'ambients", () => {
  it("totes les referències existeixen", () => {
    for (const t of AMBIENT_TEMPLATES) for (const it of t.items) expect(resolveTemplateRef(it.ref), `${t.name}: ${it.ref}`).toBeDefined()
  })
  it("els elements arrambats queden dins de l'habitació", () => {
    for (const t of AMBIENT_TEMPLATES) {
      const size = (ref: string) => {
        const b = buildBounds(buildComposition(resolveTemplateRef(ref)!.make()))
        return { w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] }
      }
      for (const p of layoutTemplate(t, size)) {
        if (p.outside) {
          // Fora a posta: del tot fora de l'habitació (no a mig mur).
          const s = size(p.ref)
          expect(p.x + s.w / 2 <= 0 || p.x - s.w / 2 >= t.w || p.y + s.d / 2 <= 0 || p.y - s.d / 2 >= t.d, `${t.name}: ${p.ref} fora`).toBe(true)
          continue
        }
        const s = size(p.ref)
        const half = Math.max(s.w, s.d) / 2
        expect(p.x - Math.min(half, p.rot % 180 ? s.d / 2 : s.w / 2), `${t.name}: ${p.ref}`).toBeGreaterThanOrEqual(0)
        expect(p.x + Math.min(half, p.rot % 180 ? s.d / 2 : s.w / 2), `${t.name}: ${p.ref}`).toBeLessThanOrEqual(t.w)
        expect(p.y - Math.min(half, p.rot % 180 ? s.w / 2 : s.d / 2), `${t.name}: ${p.ref}`).toBeGreaterThanOrEqual(0)
        expect(p.y + Math.min(half, p.rot % 180 ? s.w / 2 : s.d / 2), `${t.name}: ${p.ref}`).toBeLessThanOrEqual(t.d)
      }
    }
  })
  it("parets de les plantilles: materials, obertures, baixes i obertes", () => {
    const t = AMBIENT_TEMPLATES.find((x) => x.id === "amb-mag-terrace")!
    const walls = templateWalls(t)
    expect(walls).toHaveLength(3)
    expect(walls.filter((w) => w.height === 1000)).toHaveLength(2)
    const n = walls[0]!
    expect(wallOpenings(n)).toHaveLength(1)
    // La vidriera de terra a sostre treu just el seu forat (a sobre hi queda la llinda).
    const segs = wallSegments(n)
    const L = wallLength(n)
    const covered = segs.reduce((a, s) => a + (s.u1 - s.u0) * (s.v1 - s.v0), 0)
    expect(covered).toBeCloseTo((L + n.thickness) * n.height - 2800 * 2400, 0)
    const attic = templateWalls(AMBIENT_TEMPLATES.find((x) => x.id === "amb-mag-attic")!)
    expect(attic[0]!.material).toBe("Pintura negra")
  })
  it("els objectes i mobles de revista es construeixen", () => {
    for (const t of [...OBJECT_TEMPLATES, ...MAG_FURNITURE]) {
      const b = buildBounds(buildComposition(t.make()))
      expect(b.max[0] - b.min[0], t.name).toBeGreaterThan(0)
    }
  })
})

describe("escenes amb el Render a punt (`render`, `eye`)", () => {
  it("«Saló al vespre»: vespre amb 24 mm, càmera d'interior, i la vitrina amb llum LED", async () => {
    const { AmbientRenderSchema, parseAmbient } = await import("./ambient")
    const t = AMBIENT_TEMPLATES.find((x) => x.id === "amb-evening-living")!
    expect(AmbientRenderSchema.parse(t.render)).toEqual({ mood: "night", focal: 24 })
    expect(t.eye).toBe(true)
    const vitrina = resolveTemplateRef(t.items[0]!.ref)!.make()
    expect(JSON.stringify(vitrina)).toContain('"led":true')
    // L'ambient el conserva en llegir-lo; un de dolent es descarta sense perdre la resta.
    expect(parseAmbient({ walls: [], items: [], render: { mood: "night", focal: 35 } }).render).toEqual({ mood: "night", focal: 35 })
    expect(parseAmbient({ walls: [], items: [], render: { mood: "xx" } }).render).toBeUndefined()
  })
})
