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
