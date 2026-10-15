import { describe, expect, it, vi } from "vitest"
import { splitterPanels, splitterSizes, widthUpdates, type SplitPanelSpec } from "./splitSizes"

const workspace = (over: Partial<SplitPanelSpec> = {}): SplitPanelSpec[] => [
  { id: "tree", width: 280, setWidth: vi.fn(), min: 48, max: 900, hidden: false, onHide: vi.fn(), ...over },
  { id: "center" },
  { id: "props", width: 340, setWidth: vi.fn(), min: 48, max: 900, hidden: false },
]

describe("PanelSplit (Splitter de Chakra)", () => {
  it("els laterals en px, el flexible sense mida (la resta) i els plegats a 0", () => {
    const s = splitterSizes(workspace())
    expect(s).toHaveLength(3)
    expect(s[0]).toBe("280px")
    expect(1 in s).toBe(false)
    expect(s[2]).toBe("340px")
    expect(splitterSizes(workspace({ hidden: true }))[0]).toBe(0)
  })

  it("mínim i màxim en px; només els que es poden amagar es pleguen", () => {
    const [tree, center] = splitterPanels(workspace())
    expect(tree).toMatchObject({ id: "tree", minSize: "48px", maxSize: "900px", collapsible: true, collapsedSize: 0, resizeBehavior: "preserve-pixel-size" })
    expect(center).toEqual({ id: "center", minSize: undefined })
    expect(splitterPanels([{ id: "a", width: 300, min: 280 }])[0]?.collapsible).toBe(false)
  })

  it("dels percentatges a px: només els que canvien", () => {
    const panels = workspace()
    // Grup de 1000 px: 30 % = 300 px (l'estructura); 34 % = 340 px (les propietats, igual).
    const u = widthUpdates(panels, [30, 36, 34], 1000, "tree:center")
    expect(u).toEqual([{ panel: panels[0], width: 300 }])
    // Sense vora arrossegada (canvi de finestra): no es desa res.
    expect(widthUpdates(panels, [30, 36, 34], 1000)).toEqual([])
    // Arrossegant la vora de l'estructura, les propietats (encongides a 31 %) no es desen.
    expect(widthUpdates(panels, [30, 39, 31], 1000, "tree:center")).toEqual([{ panel: panels[0], width: 300 }])
  })

  it("arrossegar fins a 0 plega (sense tocar l'amplada desada); sense `onHide`, no", () => {
    const panels = workspace()
    expect(widthUpdates(panels, [0, 66, 34], 1000, "tree:center")).toEqual([{ panel: panels[0], width: null }])
    expect(widthUpdates(panels, [28, 72, 0], 1000, "center:props")).toEqual([])
    // Un panell plegat o un grup sense amplada no canvien res.
    expect(widthUpdates(workspace({ hidden: true }), [0, 66, 34], 1000, "tree:center")).toEqual([])
    expect(widthUpdates(panels, [30, 36, 34], 0, "tree:center")).toEqual([])
  })

  it("finestra estreta: els laterals s'encongeixen en proporció (fins al mínim) i el visor es queda el seu mínim", () => {
    const panels = [{ ...workspace()[0]!, width: 300 }, { id: "center", min: 300 }, { ...workspace()[2]!, width: 300 }]
    expect(splitterSizes(panels, 2000)).toEqual(["300px", undefined, "300px"])
    // 600 px: 300 per al visor; els laterals es reparteixen 300 (150 + 150).
    expect(splitterSizes(panels, 600)).toEqual(["150px", undefined, "150px"])
    // Molt estreta: no baixen del seu mínim.
    expect(splitterSizes(panels, 320)).toEqual(["48px", undefined, "48px"])
    expect(splitterPanels(panels)[1]).toEqual({ id: "center", minSize: "300px" })
  })
})

describe("amplada desada fora de límits", () => {
  it("es porta dins del mínim i el màxim d'ara", () => {
    const panels = [{ id: "main" }, { id: "assistant", width: 90, min: 320, max: 720, hidden: false }]
    expect(splitterSizes(panels, 2000)).toEqual([undefined, "320px"])
    expect(splitterSizes([{ id: "main" }, { ...panels[1]!, width: 2000 }], 3000)).toEqual([undefined, "720px"])
  })
})
