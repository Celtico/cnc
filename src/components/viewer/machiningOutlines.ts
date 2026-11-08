import type { Panel } from "../../core/model"

/**
 * Les línies dels mecanitzats d'una peça al Filferro, dibuixades com les fa el Taulell (no tretes del tall, que les
 * parteix i en perd trossos; cel, 2026-11-08: «la misma propiedad que a la madera, a los agujeros»): de cada forat, o de
 * cada grup de forats encavalcats (les tres butxaques del Cabineo, una sola forma), la vora d'entrada, la del fons i una
 * ratlla de fondària a cada punta on es toquen dos cercles; de cada ranura, la boca, el fons i les quatre cantonades.
 * Segments en mm i coordenades locals de la peça (x llarg, y ample, z gruix), sis números per segment.
 */
export function machiningOutlines(p: Panel): number[] {
  const T = p.thickness, out: number[] = []
  const seg = (a: number[], b: number[]) => out.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!)
  // Grups de forats del mateix pla (cara A, B o un cantell), mateix diàmetre i fondària, que es toquen.
  const groups = new Map<string, Panel["holes"][]>()
  for (const h of p.holes) {
    if (!(h.diameter > 0.5) || !(h.depth > 0.05)) continue
    const key = `${h.face}|${h.edge ?? ""}|${h.diameter}|${h.depth}|${h.face === "edge" ? (h.edge === "left" || h.edge === "right" ? h.x : h.y) : ""}`
    const list = groups.get(key) ?? []
    const touching = list.filter((g) => g.some((o) => Math.hypot(o.x - h.x, o.y - h.y) < h.diameter - 1e-6))
    const merged = [h, ...touching.flat()]
    groups.set(key, [...list.filter((g) => !touching.includes(g)), merged])
  }
  for (const list of groups.values())
    for (const hs of list) {
      const h = hs[0]!, r = h.diameter / 2
      // Centres al pla del forat (u, v) i com passar-los a 3D a una fondària t (0 = l'entrada).
      let cs: [number, number][], at: (u: number, v: number, t: number) => number[], depth: number
      if (h.face === "A" || h.face === "B") {
        depth = Math.min(h.depth, T)
        cs = hs.map((o) => [o.x, o.y])
        at = (u, v, t) => [u, v, h.face === "A" ? T - t : t]
      } else if (h.edge === "left" || h.edge === "right") {
        depth = h.depth
        const s = h.edge === "left" ? 1 : -1
        cs = hs.map((o) => [o.y, T / 2])
        at = (u, v, t) => [h.x + s * t, u, v]
      } else {
        depth = h.depth
        const s = h.edge === "bottom" ? 1 : -1
        cs = hs.map((o) => [o.x, T / 2])
        at = (u, v, t) => [u, h.y + s * t, v]
      }
      // El contorn de la unió dels cercles (com el `cabiApply` del Taulell): els punts de cada cercle que no són dins d'un altre.
      const N = 72, pts: { u: number; v: number; c: number }[] = []
      cs.forEach(([cx, cy], ci) => {
        for (let a = 0; a < N; a++) {
          const t = (a / N) * Math.PI * 2, u = cx + r * Math.cos(t), v = cy + r * Math.sin(t)
          if (cs.every(([ox, oy], oi) => oi === ci || Math.hypot(u - ox, v - oy) >= r - 1e-6)) pts.push({ u, v, c: ci })
        }
      })
      const mx = cs.reduce((s, c) => s + c[0], 0) / cs.length, my = cs.reduce((s, c) => s + c[1], 0) / cs.length
      pts.sort((A, B) => Math.atan2(A.v - my, A.u - mx) - Math.atan2(B.v - my, B.u - mx))
      pts.forEach((q, i) => {
        const n = pts[(i + 1) % pts.length]!
        for (const t of [0, depth]) seg(at(q.u, q.v, t), at(n.u, n.v, t))
        // Punta entre dos cercles: la ratlla de la fondària.
        if (n.c !== q.c) seg(at((q.u + n.u) / 2, (q.v + n.v) / 2, 0), at((q.u + n.u) / 2, (q.v + n.v) / 2, depth))
      })
    }
  for (const g of p.grooves) {
    if (!(g.depth > 0.05)) continue
    const x0 = Math.max(0, g.x), x1 = Math.min(p.length, g.x + g.w), y0 = Math.max(0, g.y), y1 = Math.min(p.width, g.y + g.h)
    const d = Math.min(g.depth, T), z = (t: number) => (g.face === "A" ? T - t : t)
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const
    c.forEach(([x, y], i) => {
      const [nx, ny] = c[(i + 1) % 4]!
      seg([x, y, z(0)], [nx, ny, z(0)])
      seg([x, y, z(d)], [nx, ny, z(d)])
      seg([x, y, z(0)], [x, y, z(d)])
    })
  }
  return out
}
