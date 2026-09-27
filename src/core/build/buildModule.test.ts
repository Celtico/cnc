import { describe, expect, it } from "vitest"
import {
  DEFAULT_CABINET,
  DEFAULT_GRILLE,
  cabinetToComposition,
  cabinetToModule,
  cutoutArea,
  defaultModule,
  type Hole,
  type Module,
  type Panel,
} from "../model"
import { buildCabinet } from "./buildCabinet"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { grilleCutouts } from "./grille"
import { resolveSizes } from "./layout"

const holeKey = (h: Hole) => [h.face, h.edge ?? "", h.x, h.y, h.diameter, h.depth, h.tag ?? ""].join("|")
const sortedHoles = (p: Panel) => [...p.holes].sort((a, b) => holeKey(a).localeCompare(holeKey(b)))
const comparable = (p: Panel) => ({ ...p, holes: sortedHoles(p), cutouts: undefined, module: undefined })

describe("migració: buildModule(cabinetToModule(p)) == buildCabinet(p)", () => {
  const cases: Partial<typeof DEFAULT_CABINET>[] = [
    {},
    { doors: 2, shelves: 3 },
    { doors: 0, shelves: 0 },
    { backType: "screwed", doors: 1, height: 2000 },
    { width: 900, height: 400, depth: 300, doors: 2 },
  ]
  for (const over of cases) {
    it(`mateixes peces, mides, forats i ranures amb ${JSON.stringify(over)}`, () => {
      const p = { ...DEFAULT_CABINET, ...over }
      const old = buildCabinet(p).map(comparable)
      const { panels, warnings } = buildModule(cabinetToModule(p))
      const byId = new Map(panels.map((x) => [x.id, comparable(x)]))
      expect(panels).toHaveLength(old.length)
      for (const o of old) expect(byId.get(o.id)).toEqual(o)
      expect(warnings.filter((w) => w.code !== "door-too-wide" && w.code !== "shelf-span")).toEqual([])
    })
  }
})

describe("resolveSizes", () => {
  it("reparteix l'espai restant entre els auto descomptant els gruixos", () => {
    expect(resolveSizes(1812, ["auto", "auto", "auto"], 19)).toEqual([591.33, 591.33, 591.33])
    expect(resolveSizes(1000, [300, "auto"], 19)).toEqual([300, 681])
  })
})

describe("divisions", () => {
  const m: Module = {
    ...defaultModule("m", "Test", { width: 1850, height: 480, depth: 420 }),
    root: {
      id: "root",
      split: {
        dir: "v",
        sizes: ["auto", "auto", "auto"],
        children: [
          { id: "a", shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "left" } },
          { id: "b", shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "left" } },
          { id: "c", shelves: { n: 1, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } },
        ],
      },
    },
  }
  const { panels, layout, warnings } = buildModule(m)

  it("mòdul de 1.850 en 3 zones auto → 2 divisors i 3 llums iguals", () => {
    const dividers = panels.filter((p) => p.role === "divider")
    expect(dividers).toHaveLength(2)
    const rects = ["a", "b", "c"].map((id) => layout.rects.get(id)!)
    const widths = rects.map((r) => r.x1 - r.x0)
    // (1850 − 2·19 − 2·19) / 3 = 591,33
    for (const w of widths) expect(w).toBeCloseTo(591.33, 1)
    // Els divisors van de la base a la tapa i tenen la fondària útil.
    for (const d of dividers) expect([d.length, d.width]).toEqual([442, 400])
  })

  it("els divisors porten espigues de cantell a baix i a dalt, i base/tapa els forats de cara", () => {
    const div = panels.find((p) => p.id === "divider-1")!
    const edge = div.holes.filter((h) => h.face === "edge" && h.tag === "dowel")
    expect(edge).toHaveLength(6)
    const bottom = panels.find((p) => p.id === "bottom")!
    const faceDowels = bottom.holes.filter((h) => h.face !== "edge" && h.tag === "dowel")
    expect(faceDowels).toHaveLength(6) // 3 per divisor
  })

  it("cada zona té 3 portes i cadascuna 2 frontisses (480 d'alt)", () => {
    const doors = panels.filter((p) => p.role === "door")
    expect(doors).toHaveLength(3)
    for (const d of doors) expect(d.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
    // Amplada: llum 591,33 + mig divisor − joc entre fronts… la porta central:
    const central = doors[1]!
    expect(Math.max(central.length, central.width)).toBeCloseTo(591.33 + 19 - 3, 1)
  })

  it("el divisor té fileres a les dues cares (A per la zona dreta, B per l'esquerra)", () => {
    const div = panels.find((p) => p.id === "divider-1")!
    const s32 = div.holes.filter((h) => h.tag === "system32")
    expect(s32.some((h) => h.face === "A")).toBe(true)
    expect(s32.some((h) => h.face === "B")).toBe(true)
  })

  it("prestatge de 591 no avisa; un de 900 sí", () => {
    expect(warnings.filter((w) => w.code === "shelf-span")).toEqual([])
    const wide = buildModule({ ...defaultModule("w", "W", { width: 1000 }), root: { id: "r", shelves: { n: 1, adjustable: true } } })
    expect(wide.warnings.some((w) => w.code === "shelf-span")).toBe(true)
  })
})

describe("portes", () => {
  it("porta de 720 → 2 frontisses; de 1.700 → 4", () => {
    const low = buildModule(cabinetToModule({ ...DEFAULT_CABINET, height: 724, doors: 1 }))
    expect(low.panels.find((p) => p.role === "door")!.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
    const tall = buildModule(cabinetToModule({ ...DEFAULT_CABINET, height: 1704, doors: 1 }))
    expect(tall.panels.find((p) => p.role === "door")!.holes.filter((h) => h.tag === "hinge")).toHaveLength(4)
  })
  it("porta de més de 600 d'ample avisa", () => {
    const { warnings } = buildModule(cabinetToModule({ ...DEFAULT_CABINET, width: 700, doors: 1 }))
    expect(warnings.some((w) => w.code === "door-too-wide")).toBe(true)
  })
})

describe("calaixos", () => {
  const m: Module = {
    ...defaultModule("m", "Calaixera", { width: 600, height: 800, depth: 500 }),
    root: { id: "root", front: { kind: "drawers", n: 4, heights: ["auto", "auto", "auto", "auto"] } },
  }
  const { panels, warnings } = buildModule(m)

  it("4 fronts que sumen l'alçada amb els jocs", () => {
    const fronts = panels.filter((p) => p.role === "drawerFront")
    expect(fronts).toHaveLength(4)
    const sum = fronts.reduce((s, f) => s + f.width, 0) // width = alçada del front (costat curt)
    expect(sum).toBeCloseTo(800 - 2 * 2 - 3 * 3, 1)
  })

  it("la guia és la més llarga que hi cap: fondària útil 500 − 18 = 482, menys 10 → 450", () => {
    const side = panels.find((p) => p.id === "drawer-1-side-left")!
    expect(side.length).toBe(450)
    expect(warnings.filter((w) => w.code === "drawer-no-slide")).toEqual([])
  })

  it("caixa: 2 laterals, darrere, fons en ranura i forats de guia al lateral del moble", () => {
    const k1 = panels.filter((p) => p.id.startsWith("drawer-1-"))
    expect(k1.map((p) => p.role).sort()).toEqual(["drawerBack", "drawerBottom", "drawerFront", "drawerSide", "drawerSide"])
    const sideL = k1.find((p) => p.id === "drawer-1-side-left")!
    expect(sideL.grooves).toHaveLength(1)
    // Alçada de la caixa = alçada del front (196,75) − 30.
    expect(sideL.width).toBeCloseTo(196.75 - 30, 2)
    const cabinetSide = panels.find((p) => p.id === "side-left")!
    expect(cabinetSide.holes.filter((h) => h.tag === "slide").length).toBe(4 * 2)
  })

  it("una fondària massa curta per a cap guia avisa", () => {
    const shallow = buildModule({ ...m, carcass: { ...m.carcass, depth: 250 } })
    expect(shallow.warnings.some((w) => w.code === "drawer-no-slide")).toBe(true)
  })
})

describe("reixeta", () => {
  it("patró conegut: 10 ranures de 8 en un front de 400 × 300 amb marge 60", () => {
    // Amplada útil = 300 − 120 = 180 → floor((180 + 8) / 16) = 11 ranures de 8 × 280.
    const g = grilleCutouts(400, 300, DEFAULT_GRILLE)
    expect(g.cutouts).toHaveLength(11)
    for (const c of g.cutouts) {
      expect(c.kind).toBe("slot")
      if (c.kind !== "slot") continue
      expect(c.x).toBeGreaterThanOrEqual(60)
      expect(c.x + c.w).toBeLessThanOrEqual(340)
      expect(c.y).toBeGreaterThanOrEqual(60)
      expect(c.y + c.h).toBeLessThanOrEqual(240)
    }
    const area = g.cutouts.reduce((s, c) => s + cutoutArea(c), 0)
    expect(g.openRatio).toBeCloseTo(area / (400 * 300), 3)
    // 11 × (8·272 + π·16) ≈ 24.489 → 20,4 %
    expect(g.openRatio).toBeCloseTo(0.204, 2)
  })

  it("forats al tresbolillo dins dels marges", () => {
    const g = grilleCutouts(400, 300, { ...DEFAULT_GRILLE, kind: "holes", margin: 20 })
    expect(g.cutouts.length).toBeGreaterThan(50)
    for (const c of g.cutouts) {
      if (c.kind !== "circle") continue
      expect(c.x - c.diameter / 2).toBeGreaterThanOrEqual(20 - 1e-6)
      expect(c.x + c.diameter / 2).toBeLessThanOrEqual(380 + 1e-6)
    }
  })

  it("cobreradiador: sense base ni fons, tapa amb ranura d'aire, front de reixeta desmuntable amb trapa", () => {
    const m: Module = {
      ...defaultModule("rad", "Cobreradiador", {
        width: 790,
        height: 1390,
        depth: 420,
        base: { kind: "open" },
        back: "none",
        top: { kind: "ventSlot", gap: 60 },
      }),
      root: {
        id: "root",
        front: {
          kind: "grille",
          pattern: { ...DEFAULT_GRILLE, margin: 40, slotWidth: 10, slotGap: 6 },
          mount: "removable",
          hinge: "left",
          hatch: { x: 600, y: 900, w: 120, h: 120 },
        },
      },
    }
    const { panels, warnings, openRatios } = buildModule(m)
    expect(panels.find((p) => p.role === "bottom")).toBeUndefined()
    expect(panels.find((p) => p.role === "back")).toBeUndefined()
    const top = panels.find((p) => p.role === "top")!
    expect([top.length, top.width]).toEqual([752, 360])
    const grille = panels.find((p) => p.role === "grille")!
    expect(grille.cutouts!.some((c) => c.kind === "rect" && c.tag === "hatch")).toBe(true)
    expect(grille.holes.filter((h) => h.tag === "magnet").length).toBe(4 + 4)
    const side = panels.find((p) => p.id === "side-left")!
    expect(side.holes.filter((h) => h.tag === "magnet" && h.face === "edge")).toHaveLength(2)
    expect(panels.find((p) => p.role === "hatch")).toBeDefined()
    expect(openRatios.root).toBeGreaterThan(0.4)
    expect(warnings.some((w) => w.code === "material-heat")).toBe(true)
    expect(warnings.some((w) => w.code === "grille-open-ratio")).toBe(false)
  })
})

describe("buildComposition", () => {
  it("dos mòduls amb separació: el segon queda desplaçat i les ids són úniques", () => {
    const a = defaultModule("a", "A", { width: 600 })
    const b = { ...defaultModule("b", "B", { width: 400 }), gapBefore: 50 }
    const { panels, warnings } = buildComposition({ modules: [a, b], references: [] })
    const ids = panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sideB = panels.find((p) => p.id === "b:side-left")!
    expect(sideB.placement.origin[0]).toBe(650)
    expect(sideB.module).toBe(2)
    expect(warnings).toEqual([])
  })

  it("potes: el mòdul s'aixeca al 3D sense generar peces", () => {
    const m = defaultModule("l", "L", { base: { kind: "legs", height: 100 } })
    const { panels } = buildComposition({ modules: [m], references: [] })
    expect(panels.find((p) => p.role === "plinth")).toBeUndefined()
    expect(panels.find((p) => p.id === "l:bottom")!.placement.origin[1]).toBe(100)
  })

  it("un objecte fantasma que xoca amb una peça avisa", () => {
    const comp = cabinetToComposition(DEFAULT_CABINET)
    comp.references.push({ id: "r", name: "Radiador", w: 300, h: 300, d: 100, x: 100, y: 100, z: 100 })
    expect(buildComposition(comp).warnings.some((w) => w.code === "collision")).toBe(true)
    comp.references[0]!.x = 1000
    expect(buildComposition(comp).warnings).toEqual([])
  })
})
