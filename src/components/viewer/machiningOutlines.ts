import type { Panel } from "../../core/model"

/**
 * Les línies dels mecanitzats d'una peça al Filferro, dibuixades com les fa el Taulell (no tretes del tall, que les
 * parteix i en perd trossos; cel, 2026-11-08: «la misma propiedad que a la madera, a los agujeros»): de cada forat, o de
 * cada grup de forats encavalcats (les tres butxaques del Cabineo, una sola forma), la vora d'entrada, la del fons i una
 * ratlla de fondària a cada punta on es toquen dos cercles; de cada ranura, la boca, el fons i les quatre cantonades.
 * Segments en mm i coordenades locals de la peça (x llarg, y ample, z gruix), sis números per segment.
 */
export function machiningOutlines(p: Panel): number[] {
  const T = p.thickness,
    out: number[] = []
  const seg = (a: number[], b: number[]) =>
    out.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!)
  // Grups de forats del mateix pla (cara A, B o un cantell), mateix diàmetre i fondària, que es toquen.
  const groups = new Map<string, Panel["holes"][]>()
  for (const h of p.holes) {
    if (!(h.diameter > 0.5) || !(h.depth > 0.05)) continue
    const key = `${h.face}|${h.edge ?? ""}|${h.diameter}|${h.depth}|${h.face === "edge" ? (h.edge === "left" || h.edge === "right" ? h.x : h.y) : ""}`
    const list = groups.get(key) ?? []
    const touching = list.filter((g) =>
      g.some((o) => Math.hypot(o.x - h.x, o.y - h.y) < h.diameter - 1e-6),
    )
    const merged = [h, ...touching.flat()]
    groups.set(key, [...list.filter((g) => !touching.includes(g)), merged])
  }
  for (const list of groups.values())
    for (const hs of list) {
      const h = hs[0]!,
        r = h.diameter / 2
      // Centres al pla del forat (u, v) i com passar-los a 3D a una fondària t (0 = l'entrada).
      let cs: [number, number][],
        at: (u: number, v: number, t: number) => number[],
        depth: number
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
      const N = 72,
        pts: { u: number; v: number; c: number }[] = []
      cs.forEach(([cx, cy], ci) => {
        for (let a = 0; a < N; a++) {
          const t = (a / N) * Math.PI * 2,
            u = cx + r * Math.cos(t),
            v = cy + r * Math.sin(t)
          if (
            cs.every(
              ([ox, oy], oi) =>
                oi === ci || Math.hypot(u - ox, v - oy) >= r - 1e-6,
            )
          )
            pts.push({ u, v, c: ci })
        }
      })
      const mx = cs.reduce((s, c) => s + c[0], 0) / cs.length,
        my = cs.reduce((s, c) => s + c[1], 0) / cs.length
      pts.sort(
        (A, B) =>
          Math.atan2(A.v - my, A.u - mx) - Math.atan2(B.v - my, B.u - mx),
      )
      pts.forEach((q, i) => {
        const n = pts[(i + 1) % pts.length]!
        for (const t of [0, depth]) seg(at(q.u, q.v, t), at(n.u, n.v, t))
        // Punta entre dos cercles: la ratlla de la fondària.
        if (n.c !== q.c)
          seg(
            at((q.u + n.u) / 2, (q.v + n.v) / 2, 0),
            at((q.u + n.u) / 2, (q.v + n.v) / 2, depth),
          )
      })
    }
  for (const g of p.grooves) {
    if (!(g.depth > 0.05)) continue
    const x0 = Math.max(0, g.x),
      x1 = Math.min(p.length, g.x + g.w),
      y0 = Math.max(0, g.y),
      y1 = Math.min(p.width, g.y + g.h)
    const d = Math.min(g.depth, T),
      z = (t: number) => (g.face === "A" ? T - t : t)
    // Quants cantells de la peça toca un punt de la boca (on la ranura surt per un cantell, la boca no hi és: és buit).
    const edges = (x: number, y: number) =>
      +(x < 0.01) +
      +(x > p.length - 0.01) +
      +(y < 0.01) +
      +(y > p.width - 0.01)
    const c = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ] as const
    c.forEach(([x, y], i) => {
      const [nx, ny] = c[(i + 1) % 4]!
      const onEdge =
        (x === nx && (x < 0.01 || x > p.length - 0.01)) ||
        (y === ny && (y < 0.01 || y > p.width - 0.01))
      if (!onEdge) seg([x, y, z(0)], [nx, ny, z(0)])
      seg([x, y, z(d)], [nx, ny, z(d)])
      // La cantonada de la peça que el galze s'ha endut (toca dos cantells) ja no hi és.
      if (edges(x, y) < 2) seg([x, y, z(0)], [x, y, z(d)])
    })
  }
  return out
}

/**
 * Els segments (mm, coordenades locals) sense els trossos que passen per dins d'una ranura o un galze: l'aresta de la
 * peça sencera que el fresat s'ha endut no es dibuixa (cel, 2026-11-08: «queda fuera de la madera»).
 */
export function clipToGrooves(p: Panel, segs: number[]): number[] {
  const T = p.thickness,
    e = 0.01
  const boxes = p.grooves
    .filter((g) => g.depth > 0.05)
    .map((g) => {
      const d = Math.min(g.depth, T)
      return [
        g.x - e,
        g.y - e,
        g.face === "A" ? T - d + e : -e,
        g.x + g.w + e,
        g.y + g.h + e,
        g.face === "A" ? T + e : d - e,
      ]
    })
  if (!boxes.length) return segs
  const out: number[] = []
  for (let i = 0; i < segs.length; i += 6) {
    const a = segs.slice(i, i + 3),
      b = segs.slice(i + 3, i + 6)
    // Els trams [t0, t1] del segment (0..1) que queden fora de totes les caixes.
    let keep: [number, number][] = [[0, 1]]
    for (const bx of boxes) {
      let t0 = 0,
        t1 = 1
      for (let k = 0; k < 3; k++) {
        const dk = b[k]! - a[k]!
        if (Math.abs(dk) < 1e-9) {
          if (a[k]! < bx[k]! || a[k]! > bx[k + 3]!) {
            t0 = 1
            t1 = 0
          }
          continue
        }
        const u = (bx[k]! - a[k]!) / dk,
          v = (bx[k + 3]! - a[k]!) / dk
        t0 = Math.max(t0, Math.min(u, v))
        t1 = Math.min(t1, Math.max(u, v))
      }
      if (t1 <= t0) continue
      keep = keep.flatMap(([s, f]): [number, number][] =>
        [
          ...(t0 > s ? [[s, Math.min(f, t0)] as [number, number]] : []),
          ...(t1 < f ? [[Math.max(s, t1), f] as [number, number]] : []),
        ].filter(([x, y]) => y - x > 1e-6),
      )
    }
    for (const [s, f] of keep)
      out.push(
        ...[0, 1, 2].map((k) => a[k]! + (b[k]! - a[k]!) * s),
        ...[0, 1, 2].map((k) => a[k]! + (b[k]! - a[k]!) * f),
      )
  }
  return out
}
