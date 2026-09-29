import { describe, expect, it } from "vitest"
import { defaultModule, type Composition } from "./composition"
import { insertModuleCopy, insertRefCopy, moveAllBy, moveModuleBy, movePartToGroup, pasteZone, reorderPart } from "./editOps"

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

describe("arrossegar per ordenar", () => {
  it("mòduls dins de la fila", async () => {
    const { reorderModule } = await import("./editOps")
    expect(reorderModule(comp(), "c", "a", false).modules.map((m) => m.id)).toEqual(["c", "a", "b"])
    expect(reorderModule(comp(), "a", "c", true).modules.map((m) => m.id)).toEqual(["b", "c", "a"])
  })
  it("objectes", async () => {
    const { reorderRef } = await import("./editOps")
    const c = { ...comp(), references: [...comp().references, { ...comp().references[0]!, id: "s" }] }
    expect(reorderRef(c, "s", "r", false).references.map((r) => r.id)).toEqual(["s", "r"])
  })
})

describe("grups de peces lliures", async () => {
  const { moveGroupBy, duplicateGroup, newGroupName } = await import("./editOps")
  const p = (id: string, x: number, group?: string) => ({ id, name: id, orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x, y: 10, z: 0, ...(group ? { group } : {}) })
  const comp = { modules: [], references: [], parts: [p("a", 0, "G"), p("b", 200, "G"), p("c", 500)] }
  it("es mouen juntes i no baixen de terra", () => {
    const c = moveGroupBy(comp, "G", 10, -50, 5)
    expect(c.parts!.map((q) => [q.x, q.y, q.z])).toEqual([[10, 0, 5], [210, 0, 5], [500, 10, 0]])
  })
  it("duplicar el grup: peces noves amb un grup nou, al costat", () => {
    const r = duplicateGroup(comp, "G")
    expect(r.group).toBe("G (còpia)")
    expect(r.comp.parts!.filter((q) => q.group === r.group).map((q) => q.x)).toEqual([350, 550])
    expect(newGroupName(comp)).toBe("Grup 1")
  })
})

describe("arrossegar peces lliures i grups", () => {
  const p = (id: string, group?: string) => ({ id, name: id, orient: "front" as const, w: 100, h: 100, thickness: 18, material: "Blanc", x: 0, y: 0, z: 0, ...(group ? { group } : {}) })
  const c = { modules: [], references: [], parts: [p("a", "G"), p("b", "G"), p("c")] }

  it("deixada sobre la fila del grup, hi entra (darrere de l'última)", () => {
    const r = movePartToGroup(c, "c", "G")
    expect(r.parts!.map((q) => [q.id, q.group])).toEqual([["a", "G"], ["b", "G"], ["c", "G"]])
  })

  it("deixada al costat d'una peça, n'agafa el grup; al costat d'una solta, en surt", () => {
    expect(reorderPart(c, "c", "a", false).parts!.find((q) => q.id === "c")!.group).toBe("G")
    const out = reorderPart(c, "a", "c", true)
    expect(out.parts!.find((q) => q.id === "a")!.group).toBeUndefined()
    expect(out.parts!.map((q) => q.id)).toEqual(["b", "c", "a"])
  })
})
