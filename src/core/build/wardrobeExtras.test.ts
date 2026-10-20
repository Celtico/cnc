import { describe, expect, it } from "vitest"
import { DEFAULT_HARDWARE_LIBRARY, bottomPlinthZone, defaultModule, topPlinthZone, withZonePlinths, type Module } from "../model"
import { buildModule } from "./buildModule"

const base = (): Module => defaultModule("a", "Armari", { width: 800, height: 2000, depth: 560 })

describe("sòcols d'abans (casos 6 i 7 del model únic: només les dreceres de zones)", () => {
  it("la peça de sobre la tapa passa al sòcol de dalt fet amb una zona: mateixa alçada total i retirada", () => {
    const m = base()
    const [o] = withZonePlinths({ modules: [{ ...m, carcass: { ...m.carcass, topFiller: { height: 80, setback: 10 } } }] }).modules
    expect(o!.carcass.topFiller).toBeUndefined()
    expect(o!.carcass.height).toBe(m.carcass.height + 80)
    expect(topPlinthZone(o!)).toMatchObject({ height: 80, setback: 10 })
    expect(buildModule(o!).panels.some((p) => p.id === "top-filler")).toBe(false)
  })
  it("al moble normal, el sòcol de la caixa passa al de baix fet amb una zona; a la cuina es queda", () => {
    const m = base()
    const plinth = { ...m, carcass: { ...m.carcass, base: { kind: "plinth" as const, height: 70, setback: 25 } } }
    const [o] = withZonePlinths({ modules: [plinth] }).modules
    expect(o!.carcass.base.kind).toBe("none")
    expect(bottomPlinthZone(o!)).toMatchObject({ height: 70, setback: 25 })
    expect(withZonePlinths({ kind: "cuina", modules: [plinth] }).modules[0]).toBe(plinth)
  })
})

describe("fronts de calaix de vidre (l'armari de la foto: el vidre és el front, en ranura, sense marc)", () => {
  it.each([2, 4])("cap front de fusta; els laterals amb la ranura del vidre; el vidre a part (%i calaixos)", (n) => {
    const m = base()
    const b = buildModule({ ...m, root: { id: "r", front: { kind: "drawers", n, heights: Array(n).fill("auto"), glass: true } as never } })
    expect(b.panels.filter((p) => p.role === "drawerFront")).toHaveLength(0)
    const sides = b.panels.filter((p) => p.role === "drawerSide")
    expect(sides).toHaveLength(2 * n)
    for (const s of sides) expect(s.grooves.some((g) => g.tag === "glass")).toBe(true)
    expect(b.extras.filter((p) => p.material === "Vidre")).toHaveLength(n)
  })
  it("amb tirador, els forats al vidre", () => {
    const m = base()
    const handle = DEFAULT_HARDWARE_LIBRARY.find((h) => h.category === "handle")!
    const b = buildModule({ ...m, root: { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"], glass: true, handle } as never } })
    expect(b.extras.filter((p) => p.material === "Vidre").every((g) => (g.cutouts ?? []).some((h) => h.tag === "handle"))).toBe(true)
  })
})
