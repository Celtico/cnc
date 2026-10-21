import { describe, expect, it } from "vitest"
import { defaultModule, flatten, pointInPolygon, type Composition, type Module, type Panel, type RefObject, type Vec3 } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox, toLocal } from "./geometry"
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
    // Una columna a prop del lateral (una tira estreta de base al costat): cap parell de potes que es trepitgi.
    const near = buildComposition(comp(col(30, -60, 120, 250))).panels.find((q) => q.id === "m:bottom")!
    const np = legPoints(near, 50)!
    for (let i = 0; i < np.length; i++) for (let j = i + 1; j < np.length; j++) expect(Math.hypot(np[i]![0] - np[j]![0], np[i]![1] - np[j]![1])).toBeGreaterThanOrEqual(110)
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
    // Penjat: es cantegen els cantells de davant i els de sota (el fons només té el de sota).
    const m = { ...m0, carcass: { ...m0.carcass, base: { kind: "wall" as const, height: 1200 }, backMaterial: m0.carcass.material, backThickness: m0.carcass.thickness } }
    const b = buildComposition({ modules: [m], references: [col(400, -60)] })
    const backs = b.panels.filter((p) => p.id === "m:back" || p.id.startsWith("m:back-"))
    expect(backs).toHaveLength(2)
    // Cada tros: el de sota amb cantell; el del tall i la resta, sense.
    for (const p of backs) expect(Object.values(p.edges).filter(Boolean), p.id).toHaveLength(1)
    // El mateix sense la columna: el de sota d'un sol fons sencer.
    const whole = buildComposition({ modules: [m], references: [] }).panels.find((p) => p.id === "m:back")!
    expect(Object.values(whole.edges).filter(Boolean)).toHaveLength(1)
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

describe("potes AXILO 78 en una base retallada per una columna", () => {
  it("una a cada cantonada que queda, la placa sencera dins de la base, cap a la columna", async () => {
    const { HAFELE_LEGS } = await import("../model/hafele/hafeleLegs")
    const axilo = structuredClone(HAFELE_LEGS[0]!)
    const m = mod()
    const legs = { ...m, carcass: { ...m.carcass, base: { kind: "legs" as const, height: 100, hardware: axilo } } }
    const b = buildComposition({ modules: [legs], references: [col(-60, -60)] })
    const base = b.panels.find((q) => q.id === "m:bottom")!
    const fit = base.fittings!.filter((f) => f.kind === "leg" && f.leg)
    expect(fit.length).toBeGreaterThanOrEqual(4)
    // Cap pota dins de la columna (fins a 190 en x i z).
    for (const f of fit) {
      const w = [base.placement.origin[0] + f.x * base.placement.xAxis[0] + f.y * base.placement.yAxis[0], base.placement.origin[2] + f.x * base.placement.xAxis[2] + f.y * base.placement.yAxis[2]]
      expect(w[0]! < 190 && w[1]! < 190).toBe(false)
    }
    // 4 forats per pota que es fa.
    expect(base.holes.filter((h) => h.tag === "leg")).toHaveLength(fit.length * 4)
  })
})

describe("llums amb una columna a la cantonada", () => {
  it("el cable i l'alimentador no entren a la columna (cap passant ni tros de cable dins)", async () => {
    const { HAFELE_LOOX_ITEMS } = await import("../model")
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const m = { ...mod(), root: { id: "z", shelves: { n: 1, adjustable: false }, led: { hardware: item } } }
    const b = buildComposition({ modules: [m], references: [col(-60, -60)] } as never)
    // L'alimentador se'n va a un lloc sense columna (i el cable de xarxa hi pot sortir pel fons).
    const driver = panelBox(b.extras.find((p) => p.id.endsWith("wiring-driver"))!)
    expect(driver.min[0] >= 190 || driver.min[2] >= 190).toBe(true)
    for (const p of b.extras.filter((q) => q.id.includes(":wiring-"))) {
      const bx = panelBox(p)
      const inColumn = bx.max[0] > -60 + 0.5 && bx.min[0] < 190 - 0.5 && bx.min[2] < 190 - 0.5 && bx.max[2] > -60
      expect(inColumn, p.id).toBe(false)
    }
  })
})

describe("llums sota la base amb una columna al mig", () => {
  it("l'alimentador i els cables de sota la base no passen per l'osca de la columna", async () => {
    const { HAFELE_LOOX_ITEMS } = await import("../model")
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const base = mod()
    const m = { ...base, carcass: { ...base.carcass, base: { kind: "legs", height: 100 } }, root: { id: "z", led: { hardware: item } } }
    const b = buildComposition({ modules: [m], references: [col(400, -60, 200, 250)] } as never)
    // L'alimentador, lluny de les potes (les de les cantonades i les del costat de l'osca).
    const drv = panelBox(b.extras.find((p) => p.id.endsWith("wiring-driver"))!)
    const legs = legPoints(b.panels.find((q) => q.id === "m:bottom")!, 50) ?? []
    for (const [x, z] of legs) expect(x > drv.min[0] - 50 && x < drv.max[0] + 50 && z > drv.min[2] - 45 && z < drv.max[2] + 45, `pota a ${x}, ${z}`).toBe(false)
    for (const p of b.extras.filter((q) => q.id.includes(":wiring-"))) {
      const bx = panelBox(p)
      const inColumn = bx.max[0] > 400 + 0.5 && bx.min[0] < 600 - 0.5 && bx.min[2] < 190 - 0.5
      expect(inColumn, p.id).toBe(false)
    }
  })
})

describe("llums sota la base amb una columna que no toca el darrere", () => {
  it("l'alimentador no va on hi ha la columna (encara que no entri pel darrere)", async () => {
    const { HAFELE_LOOX_ITEMS } = await import("../model")
    const item = structuredClone(HAFELE_LOOX_ITEMS.find((x) => x.light && x.light.recess.shape === "round")!)
    const base = mod()
    const m = { ...base, carcass: { ...base.carcass, base: { kind: "legs", height: 100 } }, root: { id: "z", led: { hardware: item } } }
    const b = buildComposition({ modules: [m], references: [col(420, 150, 160, 160)] } as never)
    const drv = panelBox(b.extras.find((p) => p.id.endsWith("wiring-driver"))!)
    expect(drv.max[0] <= 420 - 110 || drv.min[0] >= 580 + 110).toBe(true)
  })
})

describe("potes AXILO d'una base retallada per una columna", () => {
  it("les del davant i les de les cantonades de fora, al mateix lloc que en un mòdul sense columna", async () => {
    const { HAFELE_LEGS } = await import("../model/hafele/hafeleLegs")
    const { toWorld } = await import("./geometry")
    const leg = HAFELE_LEGS[0]!
    const m = (id: string) => {
      const b = defaultModule(id, id, { width: 600, height: 800, depth: 560 })
      return { ...b, carcass: { ...b.carcass, base: { kind: "legs" as const, height: 100, hardware: leg } } }
    }
    const b = buildComposition({ modules: [m("a"), m("b")], references: [col(800, -50, 250, 150)] })
    const legsOf = (id: string) => {
      const p = b.panels.find((q) => q.id === id)!
      return p.fittings!.filter((f) => f.kind === "leg").map((f) => toWorld(p, [f.x, f.y, 0])).map((w) => [Math.round(w[0]), Math.round(w[2])].join(",")).sort()
    }
    expect(b.panels.find((q) => q.id === "b:bottom")!.outline).toBeDefined()
    // El mòdul «b» és 600 mm més a la dreta: les seves potes, les mateixes desplaçades.
    const shifted = legsOf("a:bottom").map((s) => s.split(",").map(Number)).map(([x, z]) => `${x! + 600},${z}`).sort()
    expect(legsOf("b:bottom")).toEqual(shifted)
  })
})

describe("potes AXILO que no hi caben just a la seva distància (per decisió de l'usuari, 2026-10-16: «l'illa no respecta les potes»)", () => {
  const axiloModule = async (id: string, size: { width: number; height: number; depth: number; back?: "groove" | "screwed" }) => {
    const { HAFELE_LEGS } = await import("../model/hafele/hafeleLegs")
    const b = defaultModule(id, id, size)
    return { ...b, gapBefore: 0, carcass: { ...b.carcass, backThickness: 19, base: { kind: "legs" as const, height: 100, hardware: HAFELE_LEGS[0]! } } }
  }
  it("fons cargolat de 19 (l'illa): les quatre plaques, la del darrere moguda cap a dins", async () => {
    const m = await axiloModule("m", { width: 550, height: 770, depth: 450, back: "screwed" })
    const b = buildComposition({ modules: [m], references: [] })
    const base = b.panels.find((q) => q.id === "m:bottom")!
    expect(base.fittings!.filter((f) => f.kind === "leg")).toHaveLength(4)
    expect(base.holes.filter((h) => h.tag === "leg")).toHaveLength(16)
    expect(b.warnings.some((w) => /s'ha mogut/.test(w.message))).toBe(true)
    expect(b.warnings.some((w) => /no hi cap sencera/.test(w.message))).toBe(false)
  })
  it("una pota que cau a l'osca d'una columna (darrere a la dreta): les altres i les de l'osca, cap avís de «no hi cap»", async () => {
    const m = await axiloModule("m", { width: 800, height: 770, depth: 580 })
    const b = buildComposition({ modules: [m], references: [col(400, -60, 500, 250)] })
    const base = b.panels.find((q) => q.id === "m:bottom")!
    expect(base.outline).toBeDefined()
    expect(base.fittings!.filter((f) => f.kind === "leg").length).toBeGreaterThanOrEqual(4)
    expect(b.warnings.some((w) => /no hi cap sencera/.test(w.message))).toBe(false)
  })
})

// Per decisió de l'usuari, 2026-10-21 («la trasera no s'adapta a les columnes?»): els fons nous segueixen el fons de cada
// zona, sense base també, i una caixa llisa és un pilar tingui la direcció que tingui.
describe("columna amb fons per zona", () => {
  /** Un punt dins del material de la peça (contorn, sense els retalls ni les ranures). */
  const inside = (p: Panel, w: Vec3) => {
    const l = toLocal(p, w)
    if (l[2] < 0.3 || l[2] > p.thickness - 0.3) return false
    const ring = p.outline ? flatten(p.outline) : ([[0, 0], [p.length, 0], [p.length, p.width], [0, p.width]] as [number, number][])
    if (!pointInPolygon([l[0], l[1]], ring)) return false
    for (const g of p.grooves) if (l[0] > g.x - 0.2 && l[0] < g.x + g.w + 0.2 && l[1] > g.y - 0.2 && l[1] < g.y + g.h + 0.2 && (g.face === "A" ? l[2] > p.thickness - g.depth - 0.3 : l[2] < g.depth + 0.3)) return false
    return true
  }
  /** Les peces on un fons nou es fica (punts d'una graella al volum comú). */
  const clashes = (ps: Panel[]) => {
    const out: string[] = []
    for (const w of ps.filter((p) => p.id.includes("colback"))) {
      const W = panelBox(w)
      for (const p of ps) {
        if (p === w) continue
        const P = panelBox(p)
        const lo = [0, 1, 2].map((i) => Math.max(W.min[i]!, P.min[i]!)), hi = [0, 1, 2].map((i) => Math.min(W.max[i]!, P.max[i]!))
        if (![0, 1, 2].every((i) => hi[i]! - lo[i]! > 0.6)) continue
        const at = (t: number, i: number) => lo[i]! + (hi[i]! - lo[i]!) * t
        const ts = [0.1, 0.3, 0.5, 0.7, 0.9]
        if (ts.some((a) => ts.some((c) => ts.some((d) => { const q: Vec3 = [at(a, 0), at(c, 1), at(d, 2)]; return inside(p, q) && inside(w, q) })))) out.push(`${w.id} × ${p.id}`)
      }
    }
    return out
  }
  const zoned = (): Module => ({
    ...defaultModule("m", "x", { width: 1000, height: 800, depth: 500, back: "groove", base: { kind: "none" } }),
    gapBefore: 0,
    root: { id: "r", split: { dir: "h", sizes: [400, "auto"], children: [{ id: "baix", shelves: { n: 1, adjustable: true } }, { id: "dalt", back: "none" }] } },
  })

  it("una caixa sense direcció (la de per defecte) també és un pilar", () => {
    const { axis: _axis, ...o } = col(400, -60)
    const b = buildComposition(comp(o))
    expect(b.panels.filter((p) => p.id.includes("colback"))).toHaveLength(3)
  })

  it("dues columnes que es trepitgen: un sol tancament al voltant de totes dues", () => {
    const b = buildComposition({ modules: [mod()], references: [col(300, -60), { ...col(450, -60), id: "c2" }] })
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(3)
    const front = walls.find((w) => Math.abs(w.placement.zAxis[2]) === 1)!
    expect(panelBox(front).min[0]).toBeLessThan(300)
    expect(panelBox(front).max[0]).toBeGreaterThan(700)
  })

  it("sense base, la zona de dalt sense fons: només es tanca la de baix, i el prestatge s'atura davant", () => {
    const b = buildComposition({ modules: [zoned()], references: [col(400, -60)] })
    const walls = b.panels.filter((p) => p.id.includes("colback"))
    expect(walls).toHaveLength(3)
    const fixed = b.panels.find((p) => p.role === "fixedShelf")!
    for (const w of walls) expect(panelBox(w).max[1]).toBeLessThanOrEqual(panelBox(fixed).max[1])
    expect(clashes(b.panels)).toEqual([])
    // Cap tros de fons amagat darrere la columna.
    for (const p of b.panels.filter((q) => q.role === "back" && !q.id.includes("colback"))) {
      const q = panelBox(p)
      expect(q.min[0] >= 400 - 1 && q.max[0] <= 650 + 1, p.id).toBe(false)
    }
  })

  it("fons de zona encastat o cargolat al costat de la columna: fons nous del mateix tipus, sense trepitjar res", () => {
    for (const back of ["inset", "screwed"] as const) {
      const m = zoned()
      const root = { ...m.root!, split: { ...m.root!.split!, children: [{ id: "baix", back, shelves: { n: 1, adjustable: true } }, { id: "dalt", back: "none" as const }] } }
      const b = buildComposition({ modules: [{ ...m, root }], references: [col(400, -60)] })
      const walls = b.panels.filter((p) => p.id.includes("colback"))
      expect(walls.length, back).toBeGreaterThanOrEqual(2)
      expect(clashes(b.panels), back).toEqual([])
    }
  })

  it("mòdul girat a un costat (90° i 270°): els mateixos fons nous que endavant, sense trepitjar res", () => {
    const straight = buildComposition(comp(col(400, -60))).panels.filter((p) => p.id.includes("colback")).length
    for (const rot of [90, 270] as const) {
      const m = { ...mod(), rot }
      const empty = buildComposition({ modules: [m], references: [] })
      // La columna, al mig del fons del mòdul girat (el fons va al llarg de z), entrant 250 des de la paret.
      const q = panelBox(empty.panels.find((p) => p.id === "m:back")!)
      const zc = (q.min[2] + q.max[2]) / 2
      const behind = q.min[0] < (panelBox(empty.panels.find((p) => p.id === "m:bottom")!).min[0] + 50)
      const x = behind ? q.min[0] - 60 : q.max[0] + 60 - 250
      const b = buildComposition({ modules: [m], references: [col(x, zc - 125)] })
      expect(b.panels.filter((p) => p.id.includes("colback")).length, `${rot}`).toBe(straight)
      expect(clashes(b.panels), `${rot}`).toEqual([])
      expect(b.warnings.filter((w) => w.code === "ref-cut"), `${rot}`).toEqual([])
    }
  })

  it("mòdul penjat entre dues columnes que es mengen el darrere dels dos laterals: també es tanca", () => {
    const m = { ...mod(), carcass: { ...mod().carcass, base: { kind: "wall" as const, height: 1450 } } }
    const b = buildComposition({ modules: [m], references: [{ ...col(-100, 0, 200, 100), id: "a" }, { ...col(900, 0, 200, 100), id: "b" }] })
    expect(b.panels.filter((p) => p.id.includes("colback")).length).toBeGreaterThan(0)
    expect(clashes(b.panels)).toEqual([])
    expect(b.warnings.filter((w) => w.code === "ref-cut")).toEqual([])
  })
})


// Per decisió de l'usuari, 2026-10-21 («si en interior te una cagolat no miris el prinsipal»): un mòdul sense fons amb la
// zona de fons cargolat es fa com un de cargolat (la caixa deixa el lloc del fons), i el pilar s'hi tanca a la seva cara.
describe("columna amb el fons cargolat a la zona", () => {
  it("mòdul sense fons, interior cargolat: el fons dins la caixa, els fons nous a la cara de la columna, res es trepitja", () => {
    const m = { ...defaultModule("m", "x", { width: 1000, height: 800, depth: 500, back: "none" }), gapBefore: 0 }
    const b = buildComposition({ modules: [{ ...m, root: { ...m.root!, back: "screwed" } }], references: [col(400, -60)] })
    const backs = b.panels.filter((p) => p.role === "back" && !p.id.includes("colback"))
    expect(backs.length).toBeGreaterThan(0)
    for (const p of backs) expect(panelBox(p).min[2]).toBeGreaterThanOrEqual(-0.5)
    const front = b.panels.find((p) => p.id.includes("colback") && Math.abs(p.placement.zAxis[2]) === 1)!
    expect(panelBox(front).min[2]).toBeCloseTo(190, 0)
    expect(new Set(b.panels.map((p) => p.id)).size).toBe(b.panels.length)
  })
})
