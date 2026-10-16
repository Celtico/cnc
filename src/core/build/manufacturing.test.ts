import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, DEFAULT_GRILLE, STORE_TEMPLATES, defaultModule, tableModule, type Module, type Panel, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { panelBox } from "./geometry"
import { buildModule, drawerBottomMaterial } from "./buildModule"
import { toWorld } from "./geometry"
import { layoutZones, resolveSizes } from "./layout"

/** Volum comú de dues peces (> 0,5 mm en cada eix). */
const overlaps = (a: Panel, b: Panel) => {
  const A = panelBox(a), B = panelBox(b)
  return [0, 1, 2].every((i) => Math.min(A.max[i]!, B.max[i]!) - Math.max(A.min[i]!, B.min[i]!) > 0.5)
}
const withRoot = (m: Module, root: Zone, inset = false): Module => ({ ...m, root, fronts: { ...m.fronts, ...(inset ? { style: "inset" as const } : {}) } })
const holesW = (p: Panel, tag: string) => p.holes.filter((h) => h.tag === tag).map((h) => toWorld(p, [h.x, h.y, 0]))
/** Rang X (del moble) d'una ranura de la peça. */
const grooveX = (p: Panel, tag = "back") => {
  const g = p.grooves.find((q) => q.tag === tag)!
  const a = toWorld(p, [g.x, g.y, 0]), b = toWorld(p, [g.x + g.w, g.y + g.h, 0])
  return [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
}

describe("1 · fronts encastats sobre una zona dividida", () => {
  it("«Nocturn»: cap porta trepitja un prestatge fix ni un divisor", () => {
    const b = buildComposition(STORE_TEMPLATES.find((t) => t.id === "store-dormitori-armari-3")!.make())
    const fronts = b.panels.filter((p) => p.role === "door")
    const inner = b.panels.filter((p) => p.role === "fixedShelf" || p.role === "divider")
    expect(fronts.length).toBeGreaterThan(0)
    for (const f of fronts) for (const s of inner) if (f.module === s.module) expect(overlaps(f, s), `${f.id} × ${s.id}`).toBe(false)
  })

  it("el fix i el divisor es retiren gruix + joc i les espigues segueixen el cantell nou", () => {
    const m = withRoot(defaultModule("m", "x", { width: 800, height: 1200, depth: 500 }), {
      id: "root",
      front: { kind: "door", mode: "double", hinge: "left" },
      split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a1" }, { id: "a2" }] } }, { id: "b" }] },
    }, true)
    const { panels } = buildModule(m)
    const { t } = { t: m.carcass.thickness }
    const D = m.carcass.depth
    const zFront = D - t - m.fronts.outerGap
    const fixed = panels.find((p) => p.role === "fixedShelf")!
    const div = panels.find((p) => p.role === "divider")!
    expect(panelBox(fixed).max[2]).toBe(zFront)
    expect(panelBox(div).max[2]).toBe(zFront)
    for (const door of panels.filter((p) => p.role === "door")) for (const s of [fixed, div]) expect(overlaps(door, s)).toBe(false)
    // Espigues del fix al lateral: l'última a endOffset del cantell nou.
    const side = panels.find((p) => p.id === "side-left")!
    const fy = panelBox(fixed).min[1] + t / 2
    const zs = holesW(side, "dowel").filter((w) => Math.abs(w[1] - fy) < 0.6).map((w) => w[2])
    expect(zs).toHaveLength(3)
    expect(Math.max(...zs)).toBe(zFront - m.hardware.dowel.params.endOffset!)
  })

  it("amb fronts recobrents no canvia res", () => {
    const m = withRoot(defaultModule("m", "x", { width: 800, height: 1200, depth: 500 }), {
      id: "root",
      front: { kind: "door", mode: "double", hinge: "left" },
      split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] },
    })
    expect(panelBox(buildModule(m).panels.find((p) => p.role === "fixedShelf")!).max[2]).toBe(500)
  })
})

describe("2 · portes d'una zona dividida: filera System 32 per a la placa", () => {
  it("vestidor: cada cassoleta té els forats de la placa (±16) al lateral del seu costat", () => {
    const comp = BUILTIN_TEMPLATES.find((x) => x.id === "walk-in-wardrobe")!.make()
    const m = comp.modules[0]!
    const { panels } = buildModule(m)
    const doors = panels.filter((p) => p.role === "door")
    expect(doors).toHaveLength(2)
    for (const door of doors) {
      const cups = holesW(door, "hinge")
      expect(cups.length).toBeGreaterThanOrEqual(2)
      const left = cups[0]![0] < m.carcass.width / 2
      const side = panels.find((p) => p.id === (left ? "side-left" : "side-right"))!
      const rows = holesW(side, "system32")
      for (const c of cups)
        for (const dy of [-16, 16]) expect(rows.some((w) => Math.abs(w[1] - (c[1] + dy)) < 0.6 && w[2] > m.carcass.depth - 60), `${door.id} y=${c[1] + dy}`).toBe(true)
    }
  })
})

describe("3 · forats de guia dels calaixos encastats", () => {
  const drawers = (inset: boolean) => buildModule(withRoot(defaultModule("m", "x", { width: 600, height: 720, depth: 560 }), { id: "root", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }, inset))
  const slideZs = (inset: boolean) => [...new Set(holesW(drawers(inset).panels.find((p) => p.id === "side-left")!, "slide").map((w) => w[2]))].sort((a, b) => b - a)
  it("recobrents: a 37 i 293 del davant; encastats: un gruix més endins", () => {
    expect(slideZs(false)).toEqual([560 - 37, 560 - 293])
    expect(slideZs(true)).toEqual([560 - 19 - 37, 560 - 19 - 293])
  })
  it("els forats del lateral del moble i de la caixa coincideixen", () => {
    const { panels } = drawers(true)
    const box = holesW(panels.find((p) => p.id === "drawer-1-side-left")!, "slide").map((w) => w[2])
    for (const z of box) expect(slideZs(true)).toContain(z)
  })
})

describe("4 · peces sense mida", () => {
  it("calaixos que no hi caben: es treuen i s'avisa amb el nom de la peça", () => {
    const m = withRoot(defaultModule("m", "x", { width: 600, height: 400, depth: 500 }), { id: "root", front: { kind: "drawers", n: 2, heights: [400, "auto"] } })
    const b = buildComposition({ modules: [m], references: [] })
    for (const p of b.panels) expect(p.length > 0 && p.width > 0 && p.thickness > 0, p.id).toBe(true)
    for (const p of b.modules[0]!.build.panels) expect(p.length > 0 && p.width > 0, p.id).toBe(true)
    const w = b.warnings.filter((x) => x.code === "invalid-part")
    expect(w.length).toBeGreaterThan(0)
    expect(w.some((x) => x.message.includes("Front calaix 2"))).toBe(true)
  })
})

describe("5 · 6 · 7 · fons amb tauler de taula, inglets i ranura d'aire", () => {
  it("tauler de taula + fons en ranura: la ranura del lateral no surt de la peça i el fons entra a la de la tapa", () => {
    const m = tableModule("t", "T", { width: 1200, height: 750, depth: 600, joint: "butt", back: "groove", tableTop: { overhang: 50 } })
    const { panels } = buildModule(m)
    const g = m.carcass.grooveDepth
    const side = panels.find((p) => p.id === "side-left")!
    for (const gr of side.grooves) {
      expect(gr.x).toBeGreaterThanOrEqual(0)
      expect(gr.x + gr.w).toBeLessThanOrEqual(side.length)
    }
    const top = panels.find((p) => p.role === "top")!
    const back = panels.find((p) => p.role === "back")!
    const bb = panelBox(back)
    // El fons acaba dins de la ranura de la tapa (no més amunt) i aquesta el cobreix d'una punta a l'altra.
    expect(bb.max[1]).toBeGreaterThan(panelBox(top).min[1])
    expect(bb.max[1]).toBeLessThanOrEqual(panelBox(top).min[1] + g)
    const [x0, x1] = grooveX(top)
    expect(x0).toBeLessThanOrEqual(bb.min[0])
    expect(x1).toBeGreaterThanOrEqual(bb.max[0])
  })

  it("tauler de taula + fons cargolat: el fons s'acaba a sota de la tapa", () => {
    const m = tableModule("t", "T", { width: 1200, height: 750, depth: 600, joint: "butt", back: "screwed", tableTop: { overhang: 50 } })
    const { panels } = buildModule(m)
    const back = panels.find((p) => p.role === "back")!
    const top = panels.find((p) => p.role === "top")!
    expect(panelBox(back).max[1]).toBe(panelBox(top).min[1])
    expect(overlaps(back, top)).toBe(false)
  })

  it("inglet: les ranures de la tapa i de la base arriben on arriba el fons", () => {
    const m = defaultModule("m", "x", { width: 600, height: 720, depth: 560, joint: "mitre", back: "groove" })
    const { panels } = buildModule(m)
    const bb = panelBox(panels.find((p) => p.role === "back")!)
    expect([bb.min[0], bb.max[0]]).toEqual([11.5, 588.5])
    for (const role of ["top", "bottom"] as const) {
      const [x0, x1] = grooveX(panels.find((p) => p.role === role)!)
      expect([x0, x1], role).toEqual([11, 589])
    }
  })

  it("sense inglet, les ranures queden igual (d'un cap a l'altre de la peça)", () => {
    const { panels } = buildModule(defaultModule("m", "x", { width: 600, height: 720, depth: 560, back: "groove" }))
    for (const role of ["top", "bottom"] as const) expect(grooveX(panels.find((p) => p.role === role)!)).toEqual([19, 581])
  })

  it("8 · tapa amb ranura d'aire: el fons s'atura a sota (la tapa no porta ranura)", () => {
    for (const gap of [5, 60]) {
      const m = defaultModule("m", "x", { width: 600, height: 720, depth: 560, back: "groove", top: { kind: "ventSlot", gap } })
      const { panels } = buildModule(m)
      const top = panels.find((p) => p.role === "top")!
      const back = panels.find((p) => p.role === "back")!
      expect(top.grooves).toEqual([])
      expect(overlaps(back, top)).toBe(false)
      expect(panelBox(back).max[1]).toBe(720 - 19)
      const side = panels.find((p) => p.id === "side-left")!
      expect(side.grooves[0]!.x + side.grooves[0]!.w).toBe(720 - 19)
    }
  })
})

describe("9 · frontisses de portes baixes", () => {
  const door = (H: number) => {
    const m = withRoot(defaultModule("m", "x", { width: 500, height: H, depth: 400 }), { id: "root", front: { kind: "door", mode: "single", hinge: "left" } })
    const b = buildModule(m)
    // Alçada de cada cassoleta des de baix de la porta (la peça pot sortir girada si és més ampla que alta).
    const d = b.panels.find((p) => p.role === "door")!
    const y0 = panelBox(d).min[1]
    return { cups: holesW(d, "hinge").map((w) => w[1] - y0), warnings: b.warnings.filter((w) => w.code === "hinge") }
  }
  it("porta de 200 mm: la filera només dona dos punts mitjos a 32 mm, no dues cassoletes al mateix lloc", () => {
    const { cups, warnings } = door(204)
    expect(cups).toHaveLength(1)
    expect(warnings).toHaveLength(1)
  })
  for (const H of [254, 300])
    it(`porta de ${H - 4} mm: dues cassoletes separades almenys Ø + 10`, () => {
      const { cups, warnings } = door(H)
      expect(cups).toHaveLength(2)
      expect(Math.abs(cups[0]! - cups[1]!)).toBeGreaterThanOrEqual(45)
      for (const x of cups) {
        expect(x).toBeGreaterThanOrEqual(17.5)
        expect(x).toBeLessThanOrEqual(H - 4 - 17.5)
      }
      expect(warnings).toEqual([])
    })
  it("si no n'hi caben dues, en posa una i avisa", () => {
    // Sense filera (llum massa baixa): dins de la porta i separades, o una sola.
    expect(door(100).cups).toHaveLength(2)
    const { cups, warnings } = door(80)
    expect(cups).toHaveLength(1)
    expect(warnings).toHaveLength(1)
  })
  it("el nombre de frontisses és el mateix a tots dos constructors (5 per sobre de 2100)", () => {
    const { cups } = door(2160)
    expect(cups).toHaveLength(5)
    expect(new Set(cups).size).toBe(5)
  })
})

describe("10 · material del fons dels calaixos", () => {
  it("el del fons del moble si té el mateix gruix; si el nom porta el gruix, el canvia; si no, avisa", () => {
    expect(drawerBottomMaterial("DM (fons)", 10, 10)).toEqual({ name: "DM (fons)", warn: false })
    expect(drawerBottomMaterial("DM 10", 10, 8)).toEqual({ name: "DM 8", warn: false })
    expect(drawerBottomMaterial("Contraxapat 4mm", 4, 10)).toEqual({ name: "Contraxapat 10mm", warn: false })
    expect(drawerBottomMaterial("DM 100", 10, 8)).toEqual({ name: "DM 100", warn: true })
    expect(drawerBottomMaterial("Melamina negra", 19, 10)).toEqual({ name: "Melamina negra", warn: true })
  })
  it("al mòdul: material coherent amb el gruix i un sol avís", () => {
    const m = withRoot(defaultModule("m", "x", { width: 600, height: 720, depth: 560, backMaterial: "Melamina negra", backThickness: 16 }), { id: "root", front: { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] } })
    const b = buildModule(m)
    const bottoms = b.panels.filter((p) => p.role === "drawerBottom")
    expect(bottoms.every((p) => p.thickness === m.hardware.slide.params.bottomThickness)).toBe(true)
    expect(b.warnings.filter((w) => w.code === "drawer-bottom")).toHaveLength(1)
  })
})

describe("11 · trapa de la reixeta amb fronts encastats", () => {
  const grille = (inset: boolean) =>
    buildModule(
      withRoot(
        defaultModule("m", "x", { width: 800, height: 600, depth: 300 }),
        { id: "root", front: { kind: "grille", pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left", hatch: { x: 200, y: 150, w: 200, h: 150 } } },
        inset,
      ),
    ).panels
  for (const inset of [false, true])
    it(inset ? "encastada: darrere del front, sense trepitjar-lo" : "recobrent: com sempre, a z = D", () => {
      const ps = grille(inset)
      const g = ps.find((p) => p.role === "grille")!
      const h = ps.find((p) => p.role === "hatch")!
      expect(overlaps(g, h)).toBe(false)
      expect(panelBox(h).max[2]).toBe(panelBox(g).min[2])
      expect(panelBox(h).max[2]).toBe(inset ? 300 - 19 : 300)
      // Els imants de la reixeta, a la cara de dins (la que toca la trapa).
      expect(g.holes.filter((x) => x.tag === "magnet").every((x) => x.face === "A")).toBe(true)
    })
})

describe("repartiment: l'última zona es queda el que sobra", () => {
  it("la suma de les zones és exactament la llum", () => {
    const sizes = resolveSizes(1000, ["auto", "auto", "auto"], 0)
    expect(sizes).toEqual([333.33, 333.33, 333.34])
    const lay = layoutZones({ id: "r", split: { dir: "h", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b" }, { id: "c" }] } }, { x0: 19, x1: 581, y0: 19, y1: 1001 }, 0)
    expect(lay.rects.get("c")!.y1).toBe(1001)
  })
})
