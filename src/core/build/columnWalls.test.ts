import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type RefObject } from "../model"
import { buildComposition, panelBox } from "./buildComposition"
import { legPoints } from "./columnWalls"

const mod = (back: "groove" | "screwed" = "groove") => ({ ...defaultModule("m", "x", { width: 1000, height: 800, depth: 500, back }), gapBefore: 0 })
const comp = (o: RefObject, back?: "groove" | "screwed"): Composition => ({ modules: [mod(back)], references: [o] })
const col = (x: number, z: number, w = 250, d = 250): RefObject => ({ id: "c", name: "Columna", w, h: 2600, d, x, y: 0, z, effect: "cut", axis: "y" })

describe("moble tancat al voltant d'una columna", () => {
  it("columna a la cantonada de darrere a l'esquerra: el fons del davant i el del costat, amb les ranures a la base i a la tapa", () => {
    const b = buildComposition(comp(col(-60, -60)))
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(2)
    for (const w of walls) {
      expect(w.role).toBe("back")
      expect(w.thickness).toBe(10)
      const box = panelBox(w)
      // Fora de la columna (a 10 mm, la retirada del fons) i dins del mòdul.
      const inColumn = box.min[0] < 190 - 0.5 && box.min[2] < 190 - 0.5
      expect(inColumn).toBe(false)
      expect(box.min[0]).toBeGreaterThanOrEqual(0)
      expect(box.max[0]).toBeLessThanOrEqual(1000)
    }
    const front = walls.find((w) => Math.abs(w.placement.zAxis[2]) === 1)!
    expect(panelBox(front).min[2]).toBeCloseTo(200, 0)
    const side = walls.find((w) => Math.abs(w.placement.zAxis[0]) === 1)!
    expect(panelBox(side).min[0]).toBeCloseTo(200, 0)
    for (const role of ["bottom", "top"]) {
      const p = b.panels.find((q) => q.role === role && q.id === `m:${role}`)!
      expect(p.grooves.filter((g) => g.tag === "back").length, role).toBeGreaterThanOrEqual(3)
      for (const g of p.grooves) expect(Math.min(g.w, g.h), role).toBeCloseTo(10, 6)
    }
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
  })

  it("columna al mig del darrere: el fons del davant i els dos dels costats, i el fons de darrere en dos trossos", () => {
    // El tros gran a la dreta (columna a 250) o a l'esquerra (columna a 400): cada tros al seu costat.
    for (const [cx, back] of [[400, "groove"], [400, "screwed"], [250, "groove"], [250, "screwed"]] as const) {
      const b = buildComposition(comp(col(cx, -60), back))
      expect(b.panels.filter((p) => p.id.includes("colback")), back).toHaveLength(3)
      const backs = b.panels.filter((p) => p.id === "m:back" || p.id.startsWith("m:back-"))
      expect(backs, back).toHaveLength(2)
      // Cada tros, d'un costat de la columna (400–650).
      const boxes = backs.map((p) => panelBox(p))
      expect(boxes.some((x) => x.max[0] <= cx + 0.5 && x.min[0] < cx - 100), `${back} ${cx}`).toBe(true)
      expect(boxes.some((x) => x.min[0] >= cx + 250 - 0.5), `${back} ${cx}`).toBe(true)
      expect(b.warnings.filter((w) => w.code === "ref-cut"), back).toEqual([])
    }
  })

  it("amb el fons cargolat: fons nous a la cara de la columna, sense ranures, i la base retallada un gruix de fons més", () => {
    const b = buildComposition(comp(col(-60, -60), "screwed"))
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(2)
    const base = b.panels.find((q) => q.id === "m:bottom")!
    expect(base.grooves.filter((g) => g.tag === "back")).toHaveLength(0)
    // Els fons nous toquen la columna (x o z = 190) i no es trepitgen amb la base.
    const front = walls.find((w) => Math.abs(w.placement.zAxis[2]) === 1)!
    expect(panelBox(front).min[2]).toBeCloseTo(190, 0)
    const bb = panelBox(base)
    const wb = panelBox(front)
    const overlapY = Math.min(bb.max[1], wb.max[1]) - Math.max(bb.min[1], wb.min[1])
    expect(overlapY).toBeGreaterThan(0)
    // La base no arriba on hi ha el fons nou: el seu contorn comença un gruix de fons més enllà de la columna.
    const insideWall = (x: number, z: number) => x >= wb.min[0] && x <= wb.max[0] && z > wb.min[2] + 0.5 && z < wb.max[2] - 0.5
    expect(base.outline!.some((q) => insideWall(base.placement.origin[0] + q[0], base.placement.origin[2] - q[1]))).toBe(false)
  })

  it("amb el fons encastat: fons nous a la llum, amb espigues a la base, la tapa i el lateral", () => {
    const m = { ...mod(), carcass: { ...mod().carcass, back: "inset" as const, backThickness: 16, backMaterial: mod().carcass.material } }
    const b = buildComposition({ modules: [m], references: [col(-60, -60)] })
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(2)
    for (const w of walls) {
      expect(w.thickness).toBe(16)
      expect(w.holes.filter((h) => h.face === "edge").length, w.label).toBeGreaterThanOrEqual(6)
    }
    const base = b.panels.find((q) => q.id === "m:bottom")!
    const bb = panelBox(base)
    for (const w of walls) {
      const wb = panelBox(w)
      expect(wb.min[1]).toBeCloseTo(bb.max[1], 1)
    }
    expect(base.grooves.filter((g) => g.tag === "back")).toHaveLength(0)
  })

  it("una columna que travessa tot el mòdul no s'hi tanca: avís", () => {
    const b = buildComposition(comp(col(400, -60, 200, 700)))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(0)
    expect(b.warnings.some((w) => w.code === "ref-cut" && /travessa tot el mòdul/.test(w.message))).toBe(true)
  })
})

describe("potes d'una base retallada per una columna", () => {
  it("una a cada cantonada que queda (cinc amb una columna a la cantonada), cap dins de la columna", () => {
    const b = buildComposition(comp(col(-60, -60)))
    const base = b.panels.find((q) => q.id === "m:bottom")!
    const pts = legPoints(base, 50)!
    expect(pts).toHaveLength(5)
    for (const [x, z] of pts) expect(x < 190 && z < 190).toBe(false)
    const plain = buildComposition({ modules: [mod()], references: [] }).panels.find((q) => q.id === "m:bottom")!
    expect(legPoints(plain, 50)).toBeUndefined()
  })
})

describe("columna que no arriba a la tapa", () => {
  it("no es tanca i ho diu", () => {
    const b = buildComposition(comp({ ...col(-60, -60), h: 500 }))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(0)
    expect(b.warnings.some((w) => w.code === "ref-cut" && /no arriba a la tapa/.test(w.message))).toBe(true)
  })
})

describe("cantells de les peces retallades", () => {
  it("el costat tallat (contra la columna) no es canteja; els de fora, sí", () => {
    const m0 = mod("screwed")
    const m = { ...m0, carcass: { ...m0.carcass, backMaterial: m0.carcass.material, backThickness: m0.carcass.thickness } }
    const b = buildComposition({ modules: [m], references: [col(400, -60)] })
    const backs = b.panels.filter((p) => p.id === "m:back" || p.id.startsWith("m:back-"))
    expect(backs).toHaveLength(2)
    // Cada tros: tres costats amb cantell (dalt, baix i el de fora) i el del tall sense.
    for (const p of backs) expect(Object.values(p.edges).filter(Boolean), p.id).toHaveLength(3)
  })
})

describe("trams del tall (sense cantell al 3D)", () => {
  it("la base retallada per la columna diu quins trams del contorn són el tall", () => {
    const b = buildComposition(comp(col(-60, -60)))
    const base = b.panels.find((q) => q.id === "m:bottom")!
    // L'osca de la cantonada: dos trams nous (el del davant i el del costat de la columna).
    expect(base.rawSides).toHaveLength(2)
  })
})

describe("calaixos davant d'una columna", () => {
  it("la guia i la caixa del calaix es fan més curtes, fins al fons nou de davant de la columna", async () => {
    const { defaultFront } = await import("../model")
    const m0 = mod()
    const m = { ...m0, root: { ...m0.root, front: { ...defaultFront("drawers"), n: 2 } } }
    const sides = (c: Composition) => buildComposition(c).panels.filter((p) => p.role === "drawerSide")
    const free = sides({ modules: [m], references: [] })
    const withCol = buildComposition({ modules: [m], references: [col(400, -60)] })
    const box = withCol.panels.filter((p) => p.role === "drawerSide")
    expect(free.length).toBeGreaterThan(0)
    expect(box.length).toBe(free.length)
    // La columna arriba a z = 190 i el fons nou de davant a 210: la caixa del calaix no hi passa.
    for (const p of box) expect(panelBox(p).min[2], p.label).toBeGreaterThanOrEqual(210 - 0.5)
    expect(Math.max(...box.map((p) => p.length))).toBeLessThan(Math.max(...free.map((p) => p.length)))
    // Cap calaix retallat per la columna.
    expect(box.some((p) => p.outline)).toBe(false)
  })
})
