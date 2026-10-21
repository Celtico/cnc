import { describe, expect, it } from "vitest"
import { defaultModule, visibleModule, zoneBounds, type Module, type Panel, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"
import { wallSpans } from "./module/zones"

// Costats d'una zona sense paret (Caixa de la zona, per decisió de l'usuari, 2026-10-21): la columna de prestatges que no
// arriba a dalt de l'armari (la foto de l'usuari).

const mod = (root: Zone): Module => ({ ...defaultModule("m", "M", { width: 1000, height: 2000, depth: 580, back: "groove" }), root })

/** Penjador a l'esquerra; a la dreta, una columna de prestatges amb el seu sostre i, a sobre, el que treu el lateral. */
const wardrobe = (noWalls?: Zone["noWalls"]): Zone => ({
  id: "r",
  split: {
    dir: "v",
    sizes: ["auto", 350],
    children: [
      { id: "penjar", rail: {} },
      { id: "dreta", split: { dir: "h", sizes: [1400, "auto"], children: [{ id: "columna", shelves: { n: 3, adjustable: true } }, { id: "sobre", ...(noWalls ? { noWalls } : {}) }] } },
    ],
  },
})

const edgeDir = (p: Panel, s: "left" | "right" | "bottom" | "top") => {
  const { xAxis, yAxis } = p.placement
  const a = s === "left" || s === "right" ? xAxis : yAxis
  return a.map((c) => (s === "left" || s === "bottom" ? -c : c))
}
const overlaps = (a: Panel, b: Panel) => {
  const A = panelBox(a), B = panelBox(b)
  return [0, 1, 2].every((i) => Math.min(A.max[i]!, B.max[i]!) - Math.max(A.min[i]!, B.min[i]!) > 0.5)
}
const hits = (ps: Panel[]) => {
  const inside = ps.filter((p) => p.role !== "back" && p.role !== "side" && p.role !== "top" && p.role !== "bottom")
  const out: string[] = []
  for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) if (overlaps(inside[i]!, inside[j]!)) out.push(`${inside[i]!.id} × ${inside[j]!.id}`)
  return out
}

describe("costats de la zona", () => {
  it("trams que queden d'un divisor", () => {
    expect(wallSpans(0, 100, [])).toEqual([[0, 100]])
    expect(wallSpans(0, 100, [[60, 100]])).toEqual([[0, 60]])
    expect(wallSpans(0, 100, [[20, 40], [30, 50]])).toEqual([[0, 20], [50, 100]])
    expect(wallSpans(0, 100, [[0, 100]])).toEqual([])
  })

  it("la zona de sobre de la columna treu el lateral esquerre: el divisor s'acaba a dalt del sostre de la columna", () => {
    const full = buildModule(mod(wardrobe())).panels.filter((p) => p.role === "divider")
    const b = buildModule(mod(wardrobe(["left"])))
    const divs = b.panels.filter((p) => p.role === "divider")
    expect(full).toHaveLength(1)
    expect(divs).toHaveLength(1)
    const fixed = panelBox(b.panels.find((p) => p.role === "fixedShelf")!)
    const div = panelBox(divs[0]!)
    // Fins a la cara de dalt del sostre de la columna (el prestatge fix hi topa de costat).
    expect(div.max[1]).toBeCloseTo(fixed.max[1], 0)
    expect(div.max[1]).toBeLessThan(panelBox(full[0]!).max[1] - 100)
    expect(hits(b.panels)).toEqual([])
  })

  it("el cap del divisor tallat queda a la vista: porta cantell, també arrambat i penjat (per decisió de l'usuari, 2026-10-21)", () => {
    // La columna de prestatges a dalt; a sota, la zona que treu el lateral: el divisor comença a sota del fix.
    const root: Zone = { id: "r", split: { dir: "v", sizes: ["auto", 350], children: [{ id: "penjar", rail: {} }, { id: "dreta", split: { dir: "h", sizes: ["auto", 1200], children: [{ id: "sota", noWalls: ["left"] }, { id: "columna", shelves: { n: 3, adjustable: true } }] } }] } }
    for (const base of [undefined, { kind: "wall" as const, height: 1500 }]) {
      const m = mod(root)
      const b = buildModule(base ? { ...m, carcass: { ...m.carcass, base } } : m)
      // Els caps: els cantells que miren amunt o avall (divisor) o de costat (prestatge fix).
      const end = (p: Panel, dir: 1 | 0, sign: 1 | -1) => (["left", "right", "bottom", "top"] as const).find((s) => edgeDir(p, s)[dir]! * sign > 0.9)!
      const div = b.panels.find((p) => p.role === "divider")!
      // El divisor: a baix, res (cantell); a dalt, el sostre.
      expect(div.edges[end(div, 1, -1)]).toBe(true)
      expect(div.edges[end(div, 1, 1)]).toBe(false)
      // El prestatge fix hi topa de costat, i a la dreta el lateral: cap dels dos caps.
      const fixed = b.panels.find((p) => p.role === "fixedShelf")!
      expect(fixed.edges[end(fixed, 0, -1)]).toBe(false)
      expect(fixed.edges[end(fixed, 0, 1)]).toBe(false)
    }
  })

  it("on quatre zones treuen les parets que es creuen, no queda el nus del mig", () => {
    const cell = (...w: NonNullable<Zone["noWalls"]>): Zone => ({ id: `c${Math.random()}`, noWalls: w })
    const root: Zone = { id: "r", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "baix", split: { dir: "v", sizes: ["auto", "auto"], children: [cell("right", "top"), cell("left", "top")] } }, { id: "dalt", split: { dir: "v", sizes: ["auto", "auto"], children: [cell("right", "bottom"), cell("left", "bottom")] } }] } }
    const b = buildModule(mod(root))
    expect(b.panels.filter((p) => p.role === "divider" || p.role === "fixedShelf")).toEqual([])
  })

  it("els costats: la zona que el treu ja no en té; la del costat, sí (el divisor hi continua)", () => {
    const m = mod(wardrobe(["left"]))
    expect(zoneBounds(m, "sobre")!.left).toBe(false)
    expect(zoneBounds(m, "penjar")!.right).toBe(true)
    expect(zoneBounds(m, "columna")!.left).toBe(true)
    expect(zoneBounds(m, "sobre")!.inner).toEqual(["left", "bottom"])
  })

  it("un costat que és la caixa del mòdul: la zona en treu el seu tram (outerWalls.test.ts)", () => {
    const m = mod(wardrobe(["left", "right", "top"]))
    expect(visibleModule(m).root.split!.children[1]!.split!.children[1]!.noWalls).toEqual(["left", "right", "top"])
    // A l'Interior no: la seva caixa és la del mòdul.
    const r = mod({ ...wardrobe(), noWalls: ["right", "top"] })
    expect(visibleModule(r).root.noWalls).toBeUndefined()
    expect(buildModule(r).panels).toEqual(buildModule(mod(wardrobe())).panels)
  })

  it("treure la base d'una zona d'una divisió horitzontal: el prestatge fix no hi passa", () => {
    const root: Zone = { id: "r", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "b1", noWalls: ["bottom"] }, { id: "b2" }] } }] } }
    const shelves = buildModule(mod(root)).panels.filter((p) => p.role === "fixedShelf")
    expect(shelves).toHaveLength(1)
    // Només sota la zona b2 (la meitat dreta).
    expect(panelBox(shelves[0]!).min[0]).toBeGreaterThan(400)
  })

  it("una zona del mig que treu tots dos laterals parteix els dos divisors", () => {
    const root: Zone = {
      id: "r",
      split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b", split: { dir: "h", sizes: ["auto", "auto", "auto"], children: [{ id: "b1" }, { id: "forat", noWalls: ["left", "right"] }, { id: "b3" }] } }, { id: "c" }] },
    }
    const divs = buildModule(mod(root)).panels.filter((p) => p.role === "divider")
    expect(divs).toHaveLength(4)
  })

  it("la zona del costat fa servir el tros de divisor que queda: fileres només al seu tram, i avisa del prestatge que no s'aguanta", () => {
    const root = wardrobe(["left"])
    const penjar = root.split!.children[0]!
    root.split!.children[0] = { ...penjar, shelves: { n: 3, adjustable: true }, front: { kind: "door", mode: "single", hinge: "right" } }
    const b = buildModule(mod(root))
    const div = b.panels.find((p) => p.role === "divider")!
    const top = panelBox(div).max[1]
    // Forats de la filera a la cara esquerra del divisor, tots dins de la peça.
    expect(div.holes.filter((h) => h.tag === "system32").length).toBeGreaterThan(0)
    for (const h of div.holes) expect(h.x).toBeLessThanOrEqual(div.length)
    expect(b.warnings.some((w) => w.code === "no-side" && w.zoneId === "penjar" && w.message.includes("no s'hi aguanta"))).toBe(true)
    expect(b.warnings.some((w) => w.code === "no-side" && w.message.includes("filera"))).toBe(false)
    expect(top).toBeLessThan(1600)
  })
})
