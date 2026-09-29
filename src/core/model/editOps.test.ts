import { describe, expect, it } from "vitest"
import { defaultModule, type Composition } from "./composition"
import { insertModuleCopy, insertRefCopy, moveAllBy, moveModuleBy, pasteZone } from "./editOps"

const comp = (): Composition => ({
  modules: [
    { ...defaultModule("a", "A", { width: 600 }), gapBefore: 100 },
    { ...defaultModule("b", "B", { width: 600 }), gapBefore: 50 },
    { ...defaultModule("c", "C", { width: 600 }), gapBefore: 0 },
  ],
  references: [{ id: "r", name: "Columna", w: 300, h: 2500, d: 300, x: 0, y: 0, z: 0 }],
})

describe("edició: moure, copiar i enganxar", () => {
  it("moure un mòdul no mou els de la dreta", () => {
    const c = moveModuleBy(comp(), "b", 200)
    expect(c.modules.map((m) => m.gapBefore)).toEqual([100, 250, 0])
    const back = moveModuleBy(c, "b", -300)
    expect(back.modules[1]!.gapBefore).toBe(0)
  })

  it("moure tot el moble a l'esquerra més enllà de l'origen mou els objectes a la dreta", () => {
    const c = moveAllBy(comp(), -150)
    expect(c.modules[0]!.gapBefore).toBe(0)
    expect(c.references[0]!.x).toBe(50)
  })

  it("copiar un mòdul i un objecte", () => {
    const m = insertModuleCopy(comp(), comp().modules[0]!, "a")
    expect(m.comp.modules).toHaveLength(4)
    expect(m.comp.modules[1]!.id).toBe(m.id)
    const r = insertRefCopy(comp(), comp().references[0]!)
    expect(r.comp.references[1]!.x).toBe(300)
  })

  it("enganxar un compartiment conserva l'id de la zona de destí", () => {
    const root = { id: "root", split: { dir: "v" as const, sizes: ["auto" as const, "auto" as const], children: [{ id: "z1" }, { id: "z2" }] } }
    const src = { id: "x", front: { kind: "drawers" as const, n: 2, heights: ["auto" as const, "auto" as const] } }
    const out = pasteZone(root as never, "z2", src as never)
    const z2 = (out as typeof root).split.children[1] as { id: string; front?: unknown }
    expect(z2.id).toBe("z2")
    expect(z2.front).toBeTruthy()
  })
})
