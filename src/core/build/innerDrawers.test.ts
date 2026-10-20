import { describe, expect, it } from "vitest"
import { addSideMargin, defaultModule, DEFAULT_HARDWARE_LIBRARY, type Front, type Module } from "../model"
import { buildModule } from "./buildModule"
import { panelBox } from "./geometry"

/**
 * Calaixos darrere d'una porta (regla 1 del model únic: un calaix és el mateix a fora o a dins). Una columna amb porta:
 * a baix, un compartiment amb Calaixos; a dalt, prestatges. Tot el que porten els calaixos de fora (tirador, vidre,
 * alçades, Retirada, joc) compta igual; no es retiren sols (per decisió de l'usuari, 2026-10-20): avís a la Retirada.
 */
const D = 560
const T = 19
const col = (patch: Partial<Extract<Front, { kind: "drawers" }>> = {}, hinge: "left" | "right" = "left"): Module => {
  const m = defaultModule("c", "Columna", { width: 600, height: 2100, depth: D, thickness: T })
  const drawers: Front = { kind: "drawers", n: 2, heights: [200, "auto"], setback: 25, ...patch }
  return {
    ...m,
    root: {
      id: "r",
      front: { kind: "door", mode: "single", hinge },
      split: { dir: "h", sizes: [500, "auto"], children: [{ id: "a", front: drawers }, { id: "b", shelves: { n: 3, adjustable: true } }] },
    },
  }
}
const drawerFronts = (m: Module) => buildModule(m).panels.filter((p) => p.role === "drawerFront")

describe("calaixos darrere d'una porta", () => {
  it("amb Retirada: el front, retirat dins de la llum, darrere de la porta", () => {
    const b = buildModule(col())
    const fronts = b.panels.filter((p) => p.role === "drawerFront")
    expect(fronts).toHaveLength(2)
    const door = b.panels.find((p) => p.role === "door")!
    for (const f of fronts) {
      expect(panelBox(f).max[2]).toBeCloseTo(D + T - 25)
      expect(panelBox(f).max[2]).toBeLessThan(panelBox(door).min[2])
      expect(panelBox(f).min[0]).toBeGreaterThanOrEqual(T)
    }
    expect(b.warnings.some((w) => w.option === "zone.front.drawers.setback")).toBe(false)
  })
  it("sense Retirada no es retiren sols: avís a sota de la Retirada", () => {
    const b = buildModule(col({ setback: undefined }))
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(2)
    expect(b.warnings.find((w) => w.option === "zone.front.drawers.setback")?.message).toContain("Retirada")
  })
  it("el tirador triat es fa (com a fora)", () => {
    const handle = DEFAULT_HARDWARE_LIBRARY.find((h) => h.category === "handle")!
    expect(drawerFronts(col({ handle })).every((f) => (f.cutouts ?? []).some((h) => h.tag === "handle"))).toBe(true)
  })
  it("les alçades a mida: el de baix fa el que diu", () => {
    const lo = (m: Module) => Math.min(...drawerFronts(m).map((f) => panelBox(f).max[1] - panelBox(f).min[1]))
    expect(lo(col({ heights: [150, "auto"] }))).toBeLessThan(lo(col({ heights: [220, "auto"] })))
  })
  it("el marge a les frontisses és una zona oberta: la guia va al divisor i no avisa", () => {
    const m = col()
    const root = addSideMargin(m.root, "a", "left")
    const b = buildModule({ ...m, root })
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(2)
    expect(b.panels.find((p) => p.role === "divider")?.holes.length).toBeGreaterThan(0)
    expect(b.warnings.some((w) => w.option === "zone.front.drawers.margin")).toBe(false)
  })
  it("tocant el lateral de les frontisses, avisa a sota del Marge", () => {
    expect(buildModule(col()).warnings.some((w) => w.option === "zone.front.drawers.margin")).toBe(true)
  })
})

describe("calaixos darrere d'una porta amb un joc de calaix", () => {
  const kit = DEFAULT_HARDWARE_LIBRARY.find((h) => h.engine === "drawerKit")!
  it("el joc va al lateral, amb el seu front", () => {
    const b = buildModule(col({ hardware: kit }))
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(2)
    expect(b.panels.find((p) => p.id === "side-left")!.holes.some((h) => h.tag === "kit-slide")).toBe(true)
    expect(b.hardwareKits.length).toBe(2)
  })
  it("Front metàl·lic: cap front de fusta, es veu i la comanda el demana", () => {
    const b = buildModule(col({ hardware: kit, kitFront: true }))
    expect(b.panels.some((p) => p.role === "drawerFront")).toBe(false)
    expect(b.extras.filter((p) => p.id.endsWith("kit-innerFront"))).toHaveLength(2)
    expect(b.hardwareKits.every((k) => k.lines.some((l) => l.component === "innerFront"))).toBe(true)
  })
  it("Front metàl·lic sense joc: es fa de fusta i avisa a sota del Front", () => {
    const b = buildModule(col({ kitFront: true }))
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(2)
    expect(b.warnings.some((w) => w.option === "zone.front.drawers.face")).toBe(true)
  })
  it("el tancament i la guia de cada calaix arriben a la comanda", () => {
    const kits = DEFAULT_HARDWARE_LIBRARY.filter((h) => h.engine === "drawerKit")
    const closing = kit.kit!.options.closing.at(-1)!
    expect(buildModule(col({ hardware: kit, kit: { closing } })).hardwareKits.every((k) => k.options.closing === closing)).toBe(true)
    const other = kits.find((h) => h.name !== kit.name)
    if (!other) return
    const per = buildModule(col({ hardware: kit, heights: [200, 300], drawerSlides: [null, other] }))
    expect(per.hardwareKits.map((k) => k.item)).toContain(other.name)
  })
})
