import { describe, expect, it } from "vitest"
import { defaultModule, STORE_TEMPLATES, type Composition, type Module, type Panel, type Zone } from "../model"
import { buildComposition, panelBox } from "./buildComposition"
import { dowelsAlong, toWorld } from "./geometry"
import { fitSizes } from "./layout"
import { sameMachining } from "./sameSize"

// Casos degenerats trobats amb un fuzzer: res fora de les peces, cap mitja unió i un avís quan no es pot fer.

const mod = (o: Partial<Module["carcass"]>, root: Zone, extra: Partial<Module> = {}): Module => ({ ...defaultModule(extra.id ?? "m1", extra.name ?? "M", o), root, ...extra })
const comp = (...modules: Module[]): Composition => ({ modules, references: [] })
const two: Zone = { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] } }

/** Forats de cara o de cantell que surten de la peça (amb el seu radi). */
function holesOutside(p: Panel): string[] {
  const out: string[] = []
  for (const h of p.holes) {
    const r = h.diameter / 2
    if (h.face === "edge") {
      const along = h.edge === "left" || h.edge === "right" ? h.y : h.x
      const span = h.edge === "left" || h.edge === "right" ? p.width : p.length
      if (along - r < -0.05 || along + r > span + 0.05) out.push(`${p.id} ${h.tag} edge ${along}`)
    } else if (h.x - r < -0.05 || h.x + r > p.length + 0.05 || h.y - r < -0.05 || h.y + r > p.width + 0.05) out.push(`${p.id} ${h.tag} (${h.x}, ${h.y})`)
  }
  for (const g of p.grooves) if (g.x < -0.05 || g.y < -0.05 || g.x + g.w > p.length + 0.05 || g.y + g.h > p.width + 0.05) out.push(`${p.id} groove`)
  return out
}

/** Espigues sense parella: un forat de cantell sense el de cara a l'altra peça (o al revés). */
function orphanDowels(panels: Panel[]): number {
  const pts = panels.flatMap((p) => p.holes.filter((h) => h.tag === "dowel").map((h) => ({ p, edge: h.face === "edge", w: toWorld(p, [h.x, h.y, h.face === "A" ? p.thickness : h.face === "B" ? 0 : p.thickness / 2]) })))
  const near = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!) < 1
  return pts.filter((a) => !pts.some((b) => b.p !== a.p && b.edge !== a.edge && near(a.w, b.w))).length
}

describe("espigues sobre el tram comú", () => {
  it("divisor contra una tapa amb ranura d'aire: les espigues no cauen a la ranura", () => {
    for (const back of ["none", "screwed", "groove", "inset"] as const) {
      const b = buildComposition(comp(mod({ width: 900, height: 720, depth: 400, thickness: 19, back, top: { kind: "ventSlot", gap: 40 } }, two)))
      expect(b.panels.flatMap(holesOutside), back).toEqual([])
      expect(orphanDowels(b.panels), back).toBe(0)
      const top = b.panels.find((p) => p.id === "m1:top")!
      expect(top.holes.filter((h) => h.tag === "dowel" && h.face !== "edge").length, back).toBe(3)
    }
  })

  it("dowelsAlong: dues, una al mig o cap segons el tram", () => {
    expect(dowelsAlong(0, 100, 30, 8)).toEqual([30, 70])
    expect(dowelsAlong(0, 50, 30, 8)).toEqual([25])
    expect(dowelsAlong(0, 10, 30, 8)).toEqual([])
  })
})

describe("calaixos baixos", () => {
  const drawers = (H: number, n: number) => comp(mod({ width: 600, height: H, depth: 500 }, { id: "r", front: { kind: "drawers", n, heights: Array.from({ length: n }, () => "auto" as const) } }))
  it("massa baixos: només el front i un avís", () => {
    for (const H of [300, 250]) {
      const b = buildComposition(drawers(H, 4))
      expect(b.warnings.some((w) => w.code === "drawer-box"), String(H)).toBe(true)
      expect(b.panels.filter((p) => p.role === "drawerSide")).toEqual([])
      expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(4)
      expect(b.panels.flatMap(holesOutside)).toEqual([])
    }
  })
  it("massa estrets: només el front i un avís", () => {
    const b = buildComposition(comp(mod({ width: 120, height: 500, depth: 500 }, { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } })))
    expect(b.warnings.some((w) => w.code === "drawer-box" && /estrets/.test(w.message))).toBe(true)
    expect(b.panels.filter((p) => p.role === "drawerBack")).toEqual([])
    expect(b.panels.flatMap(holesOutside)).toEqual([])
  })
  it("caixa baixa però vàlida: una espiga al mig, mai fora de la peça ni sense parella", () => {
    const b = buildComposition(drawers(100, 1))
    expect(b.warnings.filter((w) => w.code === "drawer-box")).toEqual([])
    const side = b.panels.find((p) => p.role === "drawerSide")!
    expect(side.width).toBeLessThan(68)
    expect(side.holes.filter((h) => h.tag === "dowel" && h.face === "edge")).toHaveLength(1)
    expect(b.panels.flatMap(holesOutside)).toEqual([])
    expect(orphanDowels(b.panels)).toBe(0)
  })
  it("fronts iguals, caixes iguals: el primer i l'últim calaix fan els mateixos mecanitzats que els del mig", () => {
    const b = buildComposition(drawers(720, 4))
    const fronts = b.panels.filter((p) => p.role === "drawerFront")
    const sides = b.panels.filter((p) => p.role === "drawerSide")
    for (const f of fronts.slice(1)) expect(sameMachining(fronts[0]!, f), f.id).toBe(true)
    expect(new Set(sides.map((s) => s.width)).size).toBe(1)
    expect(b.warnings.filter((w) => w.code === "same-size")).toEqual([])
  })
})

describe("mides fixes que no quadren", () => {
  it("fitSizes: l'última s'ajusta i es diu quant sumaven", () => {
    expect(fitSizes(682, [500, 500], 19)).toEqual({ sizes: [500, 163], mismatch: 1019 })
    expect(fitSizes(682, [200, 200], 19)).toEqual({ sizes: [200, 463], mismatch: 419 })
    expect(fitSizes(682, [800, 500], 19).sizes).toEqual([663, 0])
    expect(fitSizes(1000, [300, "auto"], 19)).toEqual({ sizes: [300, 681], mismatch: null })
  })
  it("zones i calaixos: avís `layout` i res fora del mòdul", () => {
    const cases = [
      mod({ width: 600, height: 720, depth: 500 }, { id: "r", split: { dir: "h", sizes: [500, 500], children: [{ id: "a" }, { id: "b", front: { kind: "door", mode: "single", hinge: "left" } }] } }),
      mod({ width: 600, height: 500, depth: 500 }, { id: "r", front: { kind: "drawers", n: 2, heights: [300, 300] } }),
      mod({ width: 600, height: 720, depth: 500 }, { id: "r", front: { kind: "drawers", n: 2, heights: [100, 100] } }),
    ]
    for (const m of cases) {
      const b = buildComposition(comp(m))
      expect(b.warnings.some((w) => w.code === "layout")).toBe(true)
      for (const p of b.panels) {
        const bx = panelBox(p)
        expect(bx.max[1]!, p.id).toBeLessThanOrEqual(m.carcass.height + 0.5)
        expect(bx.min[1]!, p.id).toBeGreaterThanOrEqual(-0.5)
      }
    }
  })
})

describe("tauler de taula amb voladís", () => {
  it("els fronts recobrents s'aturen a sota (no hi topen)", () => {
    const b = buildComposition(comp(mod({ width: 800, height: 750, depth: 450, tableTop: { overhang: 30 } }, { id: "r", front: { kind: "door", mode: "double", hinge: "left" } })))
    const top = panelBox(b.panels.find((p) => p.id === "m1:top")!)
    for (const d of b.panels.filter((p) => p.role === "door")) expect(panelBox(d).max[1]).toBeLessThanOrEqual(top.min[1]! - 1)
  })
})

describe("mòduls que es trepitgen", () => {
  it("una columna i un penjat a la mateixa X, i una illa sobre la fila: avís `overlap` amb els dos noms", () => {
    const tall = mod({ width: 600, height: 2100, depth: 580 }, { id: "r1" }, { id: "tall", name: "Columna" })
    const hung = mod({ width: 600, height: 700, depth: 350, base: { kind: "wall", height: 1400 } }, { id: "r2" }, { id: "hung", name: "Alt" })
    const w1 = buildComposition(comp(tall, hung)).warnings.filter((w) => w.code === "overlap")
    expect(w1).toHaveLength(1)
    expect(w1[0]!.message).toContain("«Columna»")
    expect(w1[0]!.message).toContain("«Alt»")
    const a = mod({ width: 600, height: 720, depth: 560 }, { id: "r3" }, { id: "a" })
    const isl = mod({ width: 600, height: 720, depth: 560 }, { id: "r4" }, { id: "isl", wallGap: 300, x: 200 })
    expect(buildComposition(comp(a, isl)).warnings.filter((w) => w.code === "overlap")).toHaveLength(1)
    // Al costat (sense trepitjar-se): cap avís.
    expect(buildComposition(comp(a, mod({ width: 600, height: 720, depth: 560 }, { id: "r5" }, { id: "b" }))).warnings.filter((w) => w.code === "overlap")).toEqual([])
  })
})

describe("taulell i sòcol correguts", () => {
  const legs = { kind: "legs" as const, height: 100 }
  it("no arriben a l'illa (Al terra amb X pròpia)", () => {
    const a = mod({ width: 600, height: 720, depth: 560, base: legs }, { id: "ra" }, { id: "a" })
    const isl = mod({ width: 1200, height: 720, depth: 600, base: legs }, { id: "ri" }, { id: "isl", wallGap: 1500, x: 3000 })
    const b = mod({ width: 600, height: 720, depth: 560, base: legs }, { id: "rb" }, { id: "b" })
    const c: Composition = {
      kind: "cuina",
      modules: [a, isl, b],
      references: [],
      runs: [
        { id: "wt", kind: "worktop", from: "a", to: "b", material: "Roure", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [] },
        { id: "pl", kind: "plinth", from: "a", to: "b", material: "Roure", thickness: 16, setback: 30 },
      ],
    }
    const bld = buildComposition(c)
    expect(bld.panels.find((p) => p.id === "run:wt")!.length).toBe(1200)
    expect(Math.max(bld.panels.find((p) => p.id === "run:pl")!.length, bld.panels.find((p) => p.id === "run:pl")!.width)).toBe(1200)
  })
  it("un forat que travessa el contorn no es fa i s'avisa", () => {
    const s = mod({ width: 400, height: 720, depth: 560, base: legs }, { id: "rs" }, { id: "s" })
    const c: Composition = { kind: "cuina", modules: [s], references: [], runs: [{ id: "wt", kind: "worktop", from: "s", to: "s", material: "Roure", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [{ id: "k", kind: "sink", module: "s", w: 740, d: 440, dx: 0 }] }] }
    const b = buildComposition(c)
    expect(b.panels.find((p) => p.id === "run:wt")!.cutouts).toBeUndefined()
    expect(b.warnings.some((w) => w.code === "layout" && /surt del taulell/.test(w.message))).toBe(true)
  })
})

describe("fronts i prestatges degenerats", () => {
  it("porta massa estreta: sense cassoleta ni tirador, amb avís", () => {
    const b = buildComposition(comp(mod({ width: 70, height: 700, depth: 400 }, { id: "r", front: { kind: "door", mode: "single", hinge: "left" } })))
    const door = b.panels.find((p) => p.role === "door")!
    expect(door.cutouts ?? []).toEqual([])
    expect(b.warnings.some((w) => w.code === "handle")).toBe(true)
    expect(b.panels.flatMap(holesOutside)).toEqual([])
    const tiny = buildComposition(comp(mod({ width: 40, height: 700, depth: 400, thickness: 16 }, { id: "r", front: { kind: "door", mode: "single", hinge: "left" } })))
    expect(tiny.panels.find((p) => p.role === "door")!.holes.filter((h) => h.tag === "hinge")).toEqual([])
    expect(tiny.warnings.some((w) => w.code === "hinge")).toBe(true)
  })
  it("prestatges regulables a la mateixa filera: un per filera i avís", () => {
    const b = buildComposition(comp(mod({ width: 600, height: 400, depth: 400 }, { id: "r", shelves: { n: 20, adjustable: true } })))
    const ys = b.panels.filter((p) => p.role === "shelf").map((p) => panelBox(p).min[1]!)
    expect(new Set(ys).size).toBe(ys.length)
    expect(ys.length).toBeLessThan(20)
    expect(b.warnings.some((w) => w.code === "shelves")).toBe(true)
  })
  it("massa prestatges fixos: només els que hi caben, sense trepitjar-se", () => {
    const b = buildComposition(comp(mod({ width: 600, height: 400, depth: 400 }, { id: "r", shelves: { n: 20, adjustable: false } })))
    const ys = b.panels.filter((p) => p.role === "shelf").map((p) => panelBox(p).min[1]!).sort((x, y) => x - y)
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(19 + 10 - 0.01)
    expect(b.warnings.some((w) => w.code === "shelves")).toBe(true)
  })
})

describe("lliteres del catàleg", () => {
  it("la barana no entra dins del sostre de la llitera", () => {
    for (const t of STORE_TEMPLATES.filter((x) => x.id.startsWith("store-juvenil-lliteres"))) {
      const b = buildComposition(t.make())
      const rail = b.panels.find((p) => p.label === "Barana")
      if (!rail) continue
      const r = panelBox(rail)
      for (const p of b.panels.filter((q) => q !== rail)) {
        const q = panelBox(p)
        const ov = [0, 1, 2].map((k) => Math.min(r.max[k]!, q.max[k]!) - Math.max(r.min[k]!, q.min[k]!))
        expect(ov.every((o) => o > 0.5), `${t.id}: ${p.label}`).toBe(false)
      }
    }
  })
})
