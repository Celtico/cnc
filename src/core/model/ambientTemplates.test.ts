import { describe, expect, it } from "vitest"
import { buildBounds, buildComposition } from "../build/buildComposition"
import { AMBIENT_TEMPLATES, layoutTemplate, resolveTemplateRef } from "./ambientTemplates"

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
})
