import { describe, expect, it } from "vitest"
import { arcOf, bulgeOf, cubicAt, cubicToArcs, profileToOutline, splitEdge, sampleProfile, type PNode, type Vec2 } from "./polygon"

/** Distància d'un punt al contorn de rectes i arcs (aprox. pel mostreig de cada tram). */
function distToOutline(p: Vec2, out: ReturnType<typeof cubicToArcs>, end: Vec2): number {
  let best = Infinity
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!
    const c = i + 1 < out.length ? out[i + 1]! : end
    const b = bulgeOf(a)
    if (Math.abs(b) < 1e-9) {
      const dx = c[0] - a[0], dy = c[1] - a[1]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)))
    } else {
      // Distància exacta al cercle de l'arc (si el punt cau dins de l'escombrada).
      const f = arcOf(a, c, b)
      let ang = Math.atan2(p[1] - f.cy, p[0] - f.cx) - f.start
      if (f.sweep > 0) while (ang < 0) ang += Math.PI * 2
      else while (ang > 0) ang -= Math.PI * 2
      if (Math.abs(ang) <= Math.abs(f.sweep) + 1e-9) best = Math.min(best, Math.abs(Math.hypot(p[0] - f.cx, p[1] - f.cy) - f.r))
      best = Math.min(best, Math.hypot(p[0] - a[0], p[1] - a[1]), Math.hypot(p[0] - c[0], p[1] - c[1]))
    }
  }
  return best
}

describe("corbes de Bézier", () => {
  it("una cúbica en S es converteix en arcs amb error < 0,05 mm", () => {
    const p0: Vec2 = [0, 0], p1: Vec2 = [100, 200], p2: Vec2 = [200, -200], p3: Vec2 = [300, 0]
    const out = cubicToArcs(p0, p1, p2, p3, 0.02)
    expect(out.length).toBeGreaterThan(2)
    for (let k = 0; k <= 50; k++) expect(distToOutline(cubicAt(p0, p1, p2, p3, k / 50), out, p3)).toBeLessThan(0.05)
  })

  it("partir un costat corbat no en canvia la forma", () => {
    const nodes: PNode[] = [{ x: 0, y: 0, out: [50, 80] }, { x: 200, y: 0, in: [-50, 80] }, { x: 100, y: -100 }]
    const before = sampleProfile(nodes, 200)
    const after = splitEdge(nodes, 0)
    expect(after).toHaveLength(4)
    const mid = cubicAt([0, 0], [50, 80], [150, 80], [200, 0], 0.5)
    expect(after[1]!.x).toBeCloseTo(mid[0], 6)
    expect(after[1]!.y).toBeCloseTo(mid[1], 6)
    const s = sampleProfile(after, 200)
    // Tots els punts del perfil partit són sobre el perfil original.
    for (const q of s.filter((_, i) => i % 7 === 0)) {
      const d = Math.min(...before.map((b) => Math.hypot(b[0] - q[0], b[1] - q[1])))
      expect(d).toBeLessThan(1)
    }
  })

  it("el contorn d'un perfil amb corbes té arcs i rectes", () => {
    const out = profileToOutline([{ x: 0, y: 0 }, { x: 300, y: 0, out: [0, 100] }, { x: 0, y: 200, in: [200, 0] }])
    expect(out.some((p) => bulgeOf(p) !== 0)).toBe(true)
    expect(out[0]).toEqual([0, 0])
  })
})
