import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { DEFAULT_CABINET, NO_EDGES, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest, validateNesting, type NestOptions } from "./nest"

function panel(id: string, length: number, width: number, extra: Partial<Panel> = {}): Panel {
  return {
    id,
    name: id,
    label: id,
    role: "shelf",
    length,
    width,
    thickness: 19,
    material: "Melamina 19",
    grain: "x",
    edges: { ...NO_EDGES },
    holes: [],
    grooves: [],
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      explodeDir: [0, 0, 1],
    },
    ...extra,
  }
}

const opts: NestOptions = { sheet: { w: 2800, h: 2070 }, kerf: 6, margin: 10 }

describe("nest · mòdul per defecte", () => {
  const panels = buildCabinet({ ...DEFAULT_CABINET, doors: 2, shelves: 2 })
  const n = nest(panels, opts)

  it("col·loca totes les peces sense solapar-se ni sortir del tauler", () => {
    expect(n.unplaced).toEqual([])
    expect(validateNesting(n)).toEqual([])
    const placed = n.boards.flatMap((b) => b.placements.map((p) => p.panelId)).sort()
    expect(placed).toEqual(panels.map((p) => p.id).sort())
  })

  it("un tauler de melamina 19 i un de DM 10, numerats 1 i 2", () => {
    expect(n.boards).toHaveLength(2)
    expect(n.boards.map((b) => [b.tab, b.material, b.thickness])).toEqual([
      [1, "Melamina 19", 19],
      [2, "DM 10", 10],
    ])
  })

  it("respecta la veta: peces amb veta x a 0°, el fons (sense veta) pot girar", () => {
    const byId = new Map(n.boards.flatMap((b) => b.placements.map((p) => [p.panelId, p] as const)))
    for (const p of panels) {
      const pl = byId.get(p.id)!
      if (p.grain === "x") {
        expect(pl.angle).toBe(0)
        expect([pl.w, pl.h]).toEqual([p.length, p.width])
      }
      if (pl.angle === 90) expect([pl.w, pl.h]).toEqual([p.width, p.length])
    }
  })

  it("respecta marge i kerf", () => {
    for (const b of n.boards) {
      for (const pl of b.placements) {
        expect(pl.x).toBeGreaterThanOrEqual(opts.margin)
        expect(pl.y).toBeGreaterThanOrEqual(opts.margin)
        expect(pl.x + pl.w).toBeLessThanOrEqual(b.w - opts.margin)
        expect(pl.y + pl.h).toBeLessThanOrEqual(b.h - opts.margin)
      }
      // Entre dues peces de la mateixa franja hi ha almenys el kerf.
      const rows = new Map<number, typeof b.placements>()
      for (const pl of b.placements) (rows.get(pl.y) ?? rows.set(pl.y, []).get(pl.y)!).push(pl)
      for (const row of rows.values()) {
        const sorted = [...row].sort((a, c) => a.x - c.x)
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]!.x - (sorted[i - 1]!.x + sorted[i - 1]!.w)).toBeGreaterThanOrEqual(opts.kerf - 1e-9)
        }
      }
    }
  })

  it("el centre de cada peça és coherent amb la seva petjada", () => {
    for (const b of n.boards)
      for (const pl of b.placements) {
        expect(pl.cx).toBeCloseTo(pl.x + pl.w / 2, 6)
        expect(pl.cy).toBeCloseTo(pl.y + pl.h / 2, 6)
      }
  })

  it("aprofitament entre 0 i 1 i coherent amb les àrees", () => {
    const b = n.boards[0]!
    const area = b.placements.reduce((s, p) => s + p.w * p.h, 0)
    expect(b.efficiency).toBeCloseTo(area / (b.w * b.h), 2)
    expect(n.totalEfficiency).toBeGreaterThan(0)
    expect(n.totalEfficiency).toBeLessThanOrEqual(1)
  })

  it("és determinista", () => {
    expect(nest(panels, opts)).toEqual(n)
  })
})

describe("nest · casos límit", () => {
  it("una peça més gran que el tauler útil queda sense col·locar", () => {
    const n = nest([panel("big", 2790, 500), panel("ok", 500, 300)], opts)
    expect(n.unplaced).toEqual(["big"])
    expect(n.boards).toHaveLength(1)
    expect(n.boards[0]!.placements.map((p) => p.panelId)).toEqual(["ok"])
  })

  it("una peça llarga cap en un tauler entrat dret (es gira el tauler, no la peça)", () => {
    const n = nest([panel("tall", 2000, 500, { grain: "none" })], { sheet: { w: 1220, h: 2440 }, kerf: 6, margin: 10 })
    expect(n.unplaced).toEqual([])
    expect(n.boards[0]).toMatchObject({ w: 2440, h: 1220 })
    expect(n.boards[0]!.placements[0]!.angle).toBe(0)
  })

  it("una peça amb veta y es col·loca a 90°", () => {
    const n = nest([panel("p", 600, 300, { grain: "y" })], opts)
    const pl = n.boards[0]!.placements[0]!
    expect(pl.angle).toBe(90)
    expect([pl.w, pl.h]).toEqual([300, 600])
  })

  it("obre un tauler nou quan el primer és ple", () => {
    // 2780 útils d'ample: 4 peces de 690 + 3 kerfs de 6 = 2778 → caben 4 per franja.
    // 2050 útils d'alt: 4 franges de 500 + 3 kerfs = 2018 → 16 peces per tauler.
    const many = Array.from({ length: 20 }, (_, i) => panel(`p${i}`, 690, 500))
    const n = nest(many, opts)
    expect(validateNesting(n)).toEqual([])
    expect(n.boards).toHaveLength(2)
    expect(n.boards[0]!.placements).toHaveLength(16)
    expect(n.boards[1]!.placements).toHaveLength(4)
    expect(n.boards[1]!.tab).toBe(2)
  })

  it("omple els forats d'una franja amb peces més baixes abans d'obrir-ne una de nova", () => {
    // 10 + 2000 + 6 + 350 + 6 + 350 = 2722 ≤ 2790: les tres caben a la primera franja.
    const n = nest([panel("a", 2000, 600), panel("b", 350, 300), panel("c", 350, 200)], opts)
    const pls = n.boards[0]!.placements
    expect(pls).toHaveLength(3)
    // Totes a la mateixa franja (y = marge).
    expect(new Set(pls.map((p) => p.y)).size).toBe(1)
  })

  it("materials diferents van a taulers diferents encara que hi hagi espai", () => {
    const n = nest([panel("a", 600, 400), panel("b", 600, 400, { material: "Roure 19" })], opts)
    expect(n.boards).toHaveLength(2)
    expect(n.boards.map((b) => b.material)).toEqual(["Melamina 19", "Roure 19"])
  })

  it("sense peces: cap tauler", () => {
    const n = nest([], DEFAULT_NEST_OPTIONS)
    expect(n.boards).toEqual([])
    expect(n.totalEfficiency).toBe(0)
  })

  it("validateNesting detecta solapaments i sortides", () => {
    const n = nest([panel("a", 600, 400)], opts)
    const bad = structuredClone(n)
    bad.boards[0]!.placements.push({ panelId: "z", x: 0, y: 0, w: 700, h: 500, angle: 0, cx: 350, cy: 250 })
    bad.boards[0]!.placements.push({ panelId: "y", x: 2700, y: 2000, w: 300, h: 300, angle: 0, cx: 0, cy: 0 })
    const problems = validateNesting(bad)
    expect(problems.some((p) => p.includes("solapen"))).toBe(true)
    expect(problems.some((p) => p.includes("surt del tauler"))).toBe(true)
  })
})

describe("nest · tauler dret i decimals", () => {
  it("un tauler dret (alt > ample) es fa servir apaïsat: la veta segueix el costat llarg i no es perden peces", () => {
    const panels = [panel("a", 1500, 400, { grain: "x" }), panel("b", 1100, 300, { grain: "y" }), panel("c", 800, 500, { grain: "none" })]
    const portrait = nest(panels, { sheet: { w: 1220, h: 2440 }, kerf: 6, margin: 10 })
    const flat = nest(panels, { sheet: { w: 2440, h: 1220 }, kerf: 6, margin: 10 })
    expect(portrait.unplaced).toEqual([])
    expect(validateNesting(portrait)).toEqual([])
    expect(portrait.boards.every((b) => b.w === 2440 && b.h === 1220)).toBe(true)
    // El mateix resultat que amb el tauler entrat apaïsat.
    expect(portrait.boards).toEqual(flat.boards)
    const angle = (id: string) => portrait.boards.flatMap((b) => b.placements).find((pl) => pl.panelId === id)!.angle
    expect(angle("a")).toBe(0)
    expect(angle("b")).toBe(90)
  })

  it("també els taulers per material", () => {
    const panels = [panel("a", 2000, 400, { material: "Roure" })]
    const n = nest(panels, { ...opts, sheetsByMaterial: { Roure: { w: 1220, h: 2440 } } })
    expect(n.unplaced).toEqual([])
    expect(n.boards[0]).toMatchObject({ w: 2440, h: 1220 })
    expect(n.boards[0]!.placements[0]!.angle).toBe(0)
  })

  it("amb kerf 0 i mides amb decimals, les peces no se solapen (x, y, w, h coherents)", () => {
    const panels = Array.from({ length: 12 }, (_, i) => panel(`p${i}`, 333.335 + i * 0.001, 100.005, { grain: "x" }))
    const n = nest(panels, { sheet: { w: 2800, h: 2070 }, kerf: 0, margin: 0 })
    expect(n.unplaced).toEqual([])
    for (const b of n.boards) {
      const pls = [...b.placements].filter((p) => p.y === b.placements[0]!.y).sort((a, c) => a.x - c.x)
      for (let i = 1; i < pls.length; i++) expect(pls[i]!.x).toBeGreaterThanOrEqual(pls[i - 1]!.x + pls[i - 1]!.w)
      for (const pl of b.placements) {
        expect(pl.cx).toBe(pl.x + pl.w / 2)
        expect(pl.cy).toBe(pl.y + pl.h / 2)
      }
    }
    expect(validateNesting(n)).toEqual([])
  })
})
