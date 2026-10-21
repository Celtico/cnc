import { describe, expect, it } from "vitest"
import { defaultModule, zoneBacks, type Carcass, type Module, type Panel, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"
import { toCutList } from "../cutlist/toCutList"
import { toDxf } from "../export/dxf"
import { nest } from "../nesting/nest"

// Fons per zona (per decisió de l'usuari, 2026-10-21): els 4 valors del Fons del mòdul, heretats de la zona de més amunt.

const mod = (root: Zone, over: Partial<Carcass> = {}): Module => {
  const m = defaultModule("m", "M", { width: 900, height: 720, depth: 560, back: "groove", ...over })
  return { ...m, root }
}
const backs = (m: Module) => buildModule(m).panels.filter((p) => p.role === "back")
const area = (p: Panel) => p.length * p.width
/** El cantell de darrere de la peça (el que mira cap a z−), cantejat. */
const rearBanded = (p: Panel) => {
  const { xAxis: x, yAxis: y } = p.placement
  const side = x[2] === -1 ? "right" : x[2] === 1 ? "left" : y[2] === -1 ? "top" : "bottom"
  return p.edges[side]
}

/** Volum comú de dues peces (> 0,5 mm en cada eix). */
const overlaps = (a: Panel, b: Panel) => {
  const A = panelBox(a), B = panelBox(b)
  return [0, 1, 2].every((i) => Math.min(A.max[i]!, B.max[i]!) - Math.max(A.min[i]!, B.min[i]!) > 0.5)
}
const hits = (ps: Panel[]) => {
  const out: string[] = []
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (overlaps(ps[i]!, ps[j]!)) out.push(`${ps[i]!.id} × ${ps[j]!.id}`)
  return out
}

const plinthRoot = (back?: Carcass["back"]): Zone => ({
  id: "r",
  split: { dir: "h", sizes: [100, "auto"], children: [{ id: "socol", front: { kind: "panel", setback: 30 }, ...(back ? { back } : {}) }, { id: "dalt", shelves: { n: 1, adjustable: true } }] },
})
const columns = (mid: Partial<Zone>): Zone => ({
  id: "r",
  split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b", ...mid }, { id: "c" }] },
})

describe("fons per zona", () => {
  it("cada zona fa el de més amunt; en ranura i cargolat, només si el mòdul ho és", () => {
    const m = mod({ id: "r", back: "none", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b", back: "groove", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "b1" }, { id: "b2", back: "screwed" }] } }] } })
    const b = zoneBacks(m)
    expect(b.get("a")!.kind).toBe("none")
    expect(b.get("b1")!.kind).toBe("groove")
    // Cargolat en un mòdul en ranura: sí (per darrere de les peces que la tanquen).
    expect(b.get("b2")!.kind).toBe("screwed")
  })

  it("sense fons al sòcol fet amb zones: el fons s'acaba al prestatge fix, d'una peça", () => {
    const full = backs(mod(plinthRoot()))
    const cut = backs(mod(plinthRoot("none")))
    expect(full).toHaveLength(1)
    expect(cut).toHaveLength(1)
    expect(cut[0]!.outline).toBeUndefined()
    const m = mod(plinthRoot("none"))
    const fixed = buildModule(m).panels.find((p) => p.role === "fixedShelf")!
    const { grooveDepth: g, backClearance: cl } = m.carcass
    // El fons entra en una ranura de la cara de dalt del prestatge fix, que va fins al darrere de la caixa (al sòcol no hi ha fons).
    expect(panelBox(cut[0]!).min[1]).toBeCloseTo(panelBox(fixed).max[1] - g + cl / 2, 1)
    expect(panelBox(fixed).min[2]).toBe(0)
    expect(fixed.grooves).toEqual([expect.objectContaining({ face: "A", tag: "back", x: 0, w: fixed.length, depth: g })])
    // Les ranures dels laterals comencen on comença el fons.
    for (const s of buildModule(m).panels.filter((p) => p.role === "side")) expect(s.grooves.map((q) => q.x)).toEqual([panelBox(cut[0]!).min[1]])
    const xs = (q: Panel) => [panelBox(q).min[0], panelBox(q).max[0]]
    expect(xs(cut[0]!)).toEqual(xs(full[0]!))
  })

  it("sense fons a la columna del mig: dues peces, que s'acaben als divisors", () => {
    const m = mod(columns({ back: "none" }))
    const ps = backs(m)
    expect(ps).toHaveLength(2)
    expect(ps.map((p) => p.id).sort()).toEqual(["back", "back-2"])
    const divs = buildModule(m).panels.filter((p) => p.role === "divider").map(panelBox).sort((a, b) => a.min[0] - b.min[0])
    const xs = ps.map(panelBox).sort((a, b) => a.min[0] - b.min[0])
    // Cada tros entra en una ranura del seu divisor, a la cara del seu costat; els divisors van fins al darrere de la caixa.
    const { grooveDepth: g, backClearance: cl } = m.carcass
    expect(xs[0]!.max[0]).toBeCloseTo(divs[0]!.min[0] + g - cl / 2, 1)
    expect(xs[1]!.min[0]).toBeCloseTo(divs[1]!.max[0] - g + cl / 2, 1)
    const dps = buildModule(m).panels.filter((p) => p.role === "divider").sort((a, b) => panelBox(a).min[0] - panelBox(b).min[0])
    expect(dps.map((p) => panelBox(p).min[2])).toEqual([0, 0])
    expect(dps.map((p) => p.grooves.map((q) => q.face))).toEqual([["B"], ["A"]])
    // La base i la tapa: sense ranura al tros de la columna del mig.
    for (const p of buildModule(m).panels.filter((p) => p.role === "top" || p.role === "bottom")) expect(p.grooves).toHaveLength(2)
  })

  it("sense fons a una zona del mig de tot: una peça amb el forat", () => {
    const root: Zone = {
      id: "r",
      split: { dir: "h", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b", split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "b1" }, { id: "radiador", back: "none" }, { id: "b3" }] } }, { id: "c" }] },
    }
    const ps = backs(mod(root))
    expect(ps).toHaveLength(1)
    expect(ps[0]!.outline).toBeUndefined()
    expect(ps[0]!.cutouts).toHaveLength(1)
    expect(ps[0]!.cutouts![0]!.kind).toBe("polygon")
  })

  it("sense fons a una zona del mig: els prestatges fixos només van fins al darrere al tros de la zona, amb la ranura a l'altra cara", () => {
    const root: Zone = {
      id: "r",
      split: { dir: "h", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b", split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "b1" }, { id: "radiador", back: "none" }, { id: "b3" }] } }, { id: "c" }] },
    }
    // Lliure (no arrambat): els cantells que es veuen pel darrere es cantegen.
    const m = { ...mod(root), wallGap: 500 }
    const ps = buildModule(m).panels
    const fixed = ps.filter((p) => p.role === "fixedShelf")
    expect(fixed).toHaveLength(2)
    for (const f of fixed) {
      // Una llengüeta al darrere només al tros del radiador.
      expect(f.outline).toHaveLength(8)
      expect(panelBox(f).min[2]).toBe(0)
      expect(f.grooves.filter((q) => q.tag === "back")).toHaveLength(1)
    }
    // Els divisors del radiador, sencers fins al darrere; el fons i la resta de peces no es trepitgen.
    for (const dv of ps.filter((p) => p.role === "divider")) expect(panelBox(dv).min[2]).toBe(0)
    // Els cantells del darrere que ara es veuen (mòdul lliure: tots els que es veuen), cantejats.
    for (const p of [...fixed, ...ps.filter((p) => p.role === "divider")]) expect(rearBanded(p)).toBe(true)
    expect(hits(ps.filter((p) => p.role !== "back"))).toEqual([])
    expect(ps.filter((p) => p.role === "side" || p.role === "top" || p.role === "bottom").every((p) => p.grooves.filter((q) => q.tag === "back").length === 1)).toBe(true)
  })

  it("amb divisors gruixuts (buits): les dues pells i el llistó del darrere hi van, i la ranura és a la pell de l'altre costat", () => {
    const root: Zone = { id: "r", split: { dir: "v", sizes: ["auto", "auto"], thickness: 50, children: [{ id: "a", back: "none" }, { id: "b" }] } }
    const m = mod(root)
    const ps = buildModule(m).panels
    const skins = ps.filter((p) => p.role === "divider").sort((a, b) => panelBox(a).min[0] - panelBox(b).min[0])
    expect(skins).toHaveLength(2)
    for (const s of skins) expect(panelBox(s).min[2]).toBe(0)
    expect(panelBox(ps.find((p) => p.id.endsWith("spacer-back"))!).min[2]).toBe(0)
    // El fons (a la dreta) entra en una ranura de la cara de fora de la pell de la dreta.
    expect(skins.map((s) => s.grooves.map((q) => q.face))).toEqual([[], ["A"]])
    const { grooveDepth: g, backClearance: cl } = m.carcass
    expect(panelBox(backs(m)[0]!).min[0]).toBeCloseTo(panelBox(skins[1]!).max[0] - g + cl / 2, 1)
    expect(hits(ps.filter((p) => p.role !== "back"))).toEqual([])
  })

  it("cargolat a una zona d'un mòdul en ranura: per darrere de les peces que la tanquen, que hi arriben", () => {
    const m = mod(columns({ back: "screwed" }))
    const b = buildModule(m)
    const ps = b.panels
    const zb = ps.find((p) => p.id === "zone-back-1")!
    const divs = ps.filter((p) => p.role === "divider").sort((a, c) => panelBox(a).min[0] - panelBox(c).min[0])
    // Cobreix la columna i els dos divisors (fins a la cara de fora), i de dalt a baix de la caixa.
    expect(panelBox(zb).min[0]).toBeCloseTo(panelBox(divs[0]!).min[0], 1)
    expect(panelBox(zb).max[0]).toBeCloseTo(panelBox(divs[1]!).max[0], 1)
    expect([panelBox(zb).min[1], panelBox(zb).max[1]]).toEqual([0, m.carcass.height])
    // Darrere de la caixa (els divisors hi arriben) i ho diu.
    expect(panelBox(zb).max[2]).toBe(0)
    for (const dv of divs) expect(panelBox(dv).min[2]).toBe(0)
    expect(b.warnings.some((w) => w.code === "back-inset" && w.info && w.message.includes("sobresurt"))).toBe(true)
    // El fons del mòdul, a cada costat, entra en ranura al divisor.
    expect(backs(m).filter((p) => p.id.startsWith("back"))).toHaveLength(2)
    expect(divs.map((p) => p.grooves.map((q) => q.face))).toEqual([["B"], ["A"]])
    expect(hits(ps.filter((p) => p.role !== "back"))).toEqual([])
  })

  it("dues zones del costat sense fons: el divisor del mig no deixa cap tira de fons", () => {
    const root: Zone = { id: "r", split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "a", back: "none" }, { id: "b", back: "none" }, { id: "c" }] } }
    const ps = backs(mod(root))
    expect(ps).toHaveLength(1)
    expect(ps[0]!.outline).toBeUndefined()
  })

  it("tota la zona i les seves filles sense fons, però una filla torna a tenir el del mòdul", () => {
    const root: Zone = {
      id: "r",
      split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b", back: "none", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "b1" }, { id: "b2", back: "groove" }] } }] },
    }
    const ps = backs(mod(root))
    // La part de la filla b2 queda unida a la de la zona a: una peça en L.
    expect(ps).toHaveLength(1)
    expect(ps[0]!.outline).toHaveLength(6)
  })

  it("en ranura a una zona d'un mòdul cargolat: el seu fons, a les ranures de les peces que la tanquen", () => {
    const m = mod(columns({ back: "groove", shelves: { n: 1, adjustable: true } }), { back: "screwed" })
    const b = buildModule(m)
    const ps = b.panels
    const zb = ps.find((p) => p.id === "zone-back-1")!
    const divs = ps.filter((p) => p.role === "divider").sort((a, c) => panelBox(a).min[0] - panelBox(c).min[0])
    const { grooveDepth: g, backClearance: cl, backSetback: s } = m.carcass
    // Entre els dos divisors, dins de les seves ranures, i de la base a la tapa.
    expect(panelBox(zb).min[0]).toBeCloseTo(panelBox(divs[0]!).max[0] - g + cl / 2, 1)
    expect(panelBox(zb).max[0]).toBeCloseTo(panelBox(divs[1]!).min[0] + g - cl / 2, 1)
    expect(panelBox(zb).min[2]).toBeCloseTo(panelBox(ps.find((p) => p.id === "side-left")!).min[2] + s, 1)
    expect(divs.map((p) => p.grooves.map((q) => q.face))).toEqual([["A"], ["B"]])
    for (const id of ["bottom", "top"]) expect(ps.find((p) => p.id === id)!.grooves.filter((q) => q.tag === "back")).toHaveLength(1)
    // El fons cargolat del mòdul s'hi talla; el prestatge de la zona arriba fins al fons de la zona.
    expect(ps.filter((p) => p.id.startsWith("back"))).toHaveLength(2)
    const shelf = ps.find((p) => p.role === "shelf")!
    expect(panelBox(shelf).min[2]).toBeGreaterThanOrEqual(panelBox(zb).max[2] - 0.01)
    expect(hits(ps.filter((p) => p.role !== "back"))).toEqual([])
  })

  it("encastat a una zona: el fons del mòdul s'hi talla, la zona porta el seu, retirat i unit amb espigues", () => {
    const m = mod(columns({ back: "inset", backInsetSetback: 200, shelves: { n: 2, adjustable: true } }))
    const b = buildModule(m)
    expect(b.panels.filter((p) => p.id.startsWith("back"))).toHaveLength(2)
    const zb = b.panels.find((p) => p.id === "zone-back-1")!
    expect(zb.material).toBe(m.carcass.material)
    expect(zb.thickness).toBe(m.carcass.thickness)
    expect(panelBox(zb).min[2]).toBe(200)
    expect(zb.holes.filter((h) => h.tag === "dowel").length).toBeGreaterThanOrEqual(12)
    // Els prestatges de la zona van fins al seu fons: més curts que la fondària del mòdul.
    const shelves = b.panels.filter((p) => p.role === "shelf")
    expect(shelves).toHaveLength(2)
    for (const s of shelves) expect(panelBox(s).min[2]).toBeGreaterThanOrEqual(200 + zb.thickness - 0.01)
    // El fons de la zona no trepitja cap peça (el del mòdul entra a les ranures dels laterals, la base i la tapa).
    expect(hits(b.panels).filter((h) => h.includes("zone-back") || h.includes("shelf"))).toEqual([])
    expect(b.warnings.filter((w) => w.code === "back-inset" && !w.info)).toEqual([])
  })

  it("encastat més enrere que el fons del mòdul: es queda al pla del fons del mòdul i ho diu", () => {
    const m = mod(columns({ back: "inset", backInsetSetback: 0 }))
    const b = buildModule(m)
    const zb = b.panels.find((p) => p.id === "zone-back-1")!
    expect(panelBox(zb).min[2]).toBeCloseTo(m.carcass.backSetback + m.carcass.backThickness, 1)
    expect(b.warnings.some((w) => w.code === "back-inset" && w.info && w.zoneId === "b")).toBe(true)
  })

  it("un mòdul encastat amb una zona sense fons: les espigues només a les peces que queden", () => {
    const m = mod(plinthRoot("none"), { back: "inset", backMaterial: "Melamina blanca", backThickness: 19 })
    const ps = buildModule(m).panels
    const back = ps.filter((p) => p.role === "back")
    expect(back).toHaveLength(1)
    // Les espigues del fons, totes dins de la peça que queda; i menys que amb el fons sencer (cap a l'alçada del sòcol).
    const dowels = back[0]!.holes.filter((h) => h.tag === "dowel")
    expect(dowels.length).toBeGreaterThan(0)
    for (const h of dowels) {
      expect(h.x).toBeGreaterThanOrEqual(0)
      expect(h.x).toBeLessThanOrEqual(back[0]!.length)
      expect(h.y).toBeGreaterThanOrEqual(0)
      expect(h.y).toBeLessThanOrEqual(back[0]!.width)
    }
    const full = buildModule(mod(plinthRoot(), { back: "inset", backMaterial: "Melamina blanca", backThickness: 19 })).panels.find((p) => p.role === "back")!
    expect(dowels.length).toBeLessThan(full.holes.filter((h) => h.tag === "dowel").length)
  })

  it("les peces amb forat o contorn surten a la llista de tall, al DXF i al nesting", () => {
    const root: Zone = {
      id: "r",
      split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b", back: "none", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "b1" }, { id: "b2", back: "groove" }] } }] },
    }
    const built = buildComposition({ modules: [mod(root)], references: [] })
    expect(() => toCutList(built.panels)).not.toThrow()
    expect(() => toDxf(built.panels.filter((p) => p.role === "back"))).not.toThrow()
    expect(() => nest(built.panels.filter((p) => p.role === "back"))).not.toThrow()
    expect(area(built.panels.find((p) => p.role === "back")!)).toBeGreaterThan(0)
  })
})
