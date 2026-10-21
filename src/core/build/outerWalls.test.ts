import { describe, expect, it } from "vitest"
import { defaultModule, setOuterWall, visibleModule, zoneBounds, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"
import { wallRemovers } from "./wallNeighbours"

// La tapa, la base i els laterals del mòdul a trams (per decisió de l'usuari, 2026-10-21: «no pots ficar una tapa que
// surti de la seva divisió?», «tapa, base, lateral dret, lateral esquerre»): cada zona que hi toca en treu el seu.

const mod = (root: Zone, c: Partial<Module["carcass"]> = {}): Module => {
  const m = defaultModule("m", "M", { width: 1000, height: 900, depth: 400, back: "none" })
  return { ...m, carcass: { ...m.carcass, ...c }, root }
}
/** Dues columnes: l'esquerra (dues files) i la dreta. */
const cols = (): Zone => ({
  id: "r",
  split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "a1" }, { id: "a2" }] } }, { id: "b" }] },
})
const of = (m: Module, role: string) => buildModule(m).panels.filter((p) => p.role === role).map(panelBox)

describe("caixa del mòdul a trams", () => {
  it("sense cap tram tret, el mateix de sempre", () => {
    const m = mod(cols())
    const s = setOuterWall(m, "a", "top", true)
    expect(buildModule({ ...m, ...s }).panels).toEqual(buildModule(m).panels)
  })

  it("una columna treu la tapa: la tapa només cobreix l'altra i el divisor", () => {
    const m = mod(cols())
    const s = setOuterWall(m, "a", "top", false)
    expect(s.root.split!.children[0]!.noWalls).toEqual(["top"])
    const tops = of({ ...m, ...s }, "top")
    expect(tops).toHaveLength(1)
    const div = of(m, "divider")[0]!
    expect(tops[0]!.min[0]).toBeCloseTo(div.min[0], 0)
    expect(tops[0]!.max[0]).toBeCloseTo(1000 - 19, 0)
    // La zona de sota ja no té tapa: com un mòdul «Sense tapa», els fronts s'aguanten igual.
    expect(zoneBounds({ ...m, ...s }, "a2")).toMatchObject({ top: false, noTop: true })
  })

  it("posar la tapa a una sola zona d'un mòdul sense tapa: el mòdul la torna a tenir i les altres en treuen el tram", () => {
    const m = mod(cols(), { top: { kind: "none" } })
    const s = setOuterWall(m, "b", "top", true)
    expect(s.carcass.top.kind).toBe("full")
    expect(s.root.split!.children[0]!.noWalls).toEqual(["top"])
    expect(s.root.split!.children[1]!.noWalls).toBeUndefined()
    expect(of({ ...m, ...s }, "top")).toHaveLength(1)
  })

  it("la lletra E: el lateral dret només a la fila de baix i la de dalt", () => {
    const rows: Zone = { id: "r", split: { dir: "h", sizes: ["auto", "auto", "auto"], children: [{ id: "baix" }, { id: "mig" }, { id: "dalt" }] } }
    const m = mod(rows, { sides: { left: true, right: false } })
    let s = setOuterWall(m, "baix", "right", true)
    expect(s.carcass.sides.right).toBe(true)
    expect(s.root.split!.children.map((z) => z.noWalls)).toEqual([undefined, ["right"], ["right"]])
    s = setOuterWall({ ...m, ...s }, "dalt", "right", true)
    expect(s.root.split!.children.map((z) => z.noWalls)).toEqual([undefined, ["right"], undefined])
    const sides = of({ ...m, ...s }, "side").filter((b) => b.min[0] > 500)
    expect(sides).toHaveLength(2)
    expect(sides.map((b) => [Math.round(b.min[1]), Math.round(b.max[1])]).sort((x, y) => x[0]! - y[0]!)).toEqual([
      [0, expect.any(Number)],
      [expect.any(Number), 900],
    ])
    // Cada tros cobreix el prestatge fix del costat de la fila del mig (l'aguanta).
    const fixed = of({ ...m, ...s }, "fixedShelf")
    for (const f of fixed) expect(sides.some((b) => b.min[1] <= f.min[1] + 0.5 && b.max[1] >= f.max[1] - 0.5)).toBe(true)
    expect(buildModule({ ...m, ...s }).warnings.filter((w) => ["collision", "overlap", "no-side"].includes(w.code))).toEqual([])
  })

  it("a l'Interior, Sense tapa la treu de tot el mòdul i Sencera la torna sencera", () => {
    const m = mod(cols())
    const off = setOuterWall(m, "r", "top", false)
    expect(off.carcass.top.kind).toBe("none")
    const part = setOuterWall(m, "a", "top", false)
    const on = setOuterWall({ ...m, ...part }, "r", "top", true)
    expect(visibleModule({ ...m, ...on }).root.split!.children[0]!.noWalls).toBeUndefined()
  })

  it("la base d'un mòdul amb potes és sencera", () => {
    const m = mod(cols(), { base: { kind: "legs", height: 100 } as Module["carcass"]["base"] })
    const s = setOuterWall(m, "a", "bottom", false)
    expect(of({ ...m, ...s }, "bottom")).toHaveLength(1)
  })
})

describe("el divisor que treu la zona del costat", () => {
  it("l'altra zona el veu tret i el pot tornar a posar (la lletra E)", () => {
    const root: Zone = { id: "r", split: { dir: "v", sizes: ["auto", "auto", "auto"], children: [{ id: "a" }, { id: "b", noWalls: ["left"] }, { id: "c" }] } }
    const m = mod(root)
    const { layout } = buildModule(m)
    expect(wallRemovers(layout, root, "a", "right")).toEqual({ ids: ["b"], full: true })
    expect(wallRemovers(layout, root, "c", "left")).toEqual({ ids: [], full: false })
  })
})
