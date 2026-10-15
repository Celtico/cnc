import { describe, expect, it } from "vitest"
import { defaultModule, modulePlacements, type Composition } from "./composition"
import { copyGroup, copyItems, duplicateGroup, insertItemsCopy, parseClip } from "./clipOps"
import { groupItems, reorderModule, ungroupMulti } from "./editOps"

const part = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x: 0, y: 0, z: 0, ...extra })

/** A · B (grup G) · C · D a terra, tocant-se; una peça enganxada a B (del grup) i una de solta del grup. */
const comp = (): Composition => ({
  modules: [
    { ...defaultModule("a", "A", { width: 600 }), gapBefore: 0 },
    { ...defaultModule("b", "B", { width: 400 }), gapBefore: 0, group: "G" },
    { ...defaultModule("c", "C", { width: 500 }), gapBefore: 0, group: "G" },
    { ...defaultModule("d", "D", { width: 600 }), gapBefore: 0 },
  ],
  references: [],
  parts: [part("p1", { module: "b", group: "G", x: 10 }), part("p2", { group: "G", x: 3000 }), part("p3", { x: 5000 })],
})

describe("copiar, enganxar i duplicar grups", () => {
  it("duplicar un grup de mòduls: les còpies van a continuació a la fila, en un grup nou", () => {
    const d = duplicateGroup(comp(), "G")
    expect(d.group).toBe("G (còpia)")
    expect(d.comp.modules.map((m) => [m.name, m.group ?? ""])).toEqual([
      ["A", ""],
      ["B", "G"],
      ["C", "G"],
      ["B", "G (còpia)"],
      ["C", "G (còpia)"],
      ["D", ""],
    ])
    expect(new Set(d.comp.modules.map((m) => m.id)).size).toBe(6)
    // La peça enganxada a B va a la còpia de B (a la mateixa x relativa); la solta, al costat.
    const copies = d.comp.parts!.filter((p) => p.group === d.group)
    const bCopy = d.comp.modules[3]!.id
    expect(copies.map((p) => [p.module ?? "", p.x])).toEqual([[bCopy, 10], ["", 3000 + copyGroup(comp(), "G").dx]])
    // Un segon cop, un altre nom.
    expect(duplicateGroup(d.comp, "G").group).toBe("G (còpia 2)")
  })

  it("enganxar un grup en un altre moble: grup nou; la peça enganxada a un mòdul copiat segueix la còpia", () => {
    const clip = copyGroup(comp(), "G")
    const other: Composition = { modules: [{ ...defaultModule("x", "X", { width: 600 }), gapBefore: 0 }], references: [] }
    const r = insertItemsCopy(other, clip)
    expect(r.group).toBe("G (còpia)")
    expect(r.comp.modules.map((m) => m.name)).toEqual(["X", "B", "C"])
    expect(r.items.filter((x) => x.kind === "module")).toHaveLength(2)
    const p1 = r.comp.parts!.find((p) => p.module)!
    expect(p1.module).toBe(r.comp.modules[1]!.id)
  })

  it("selecció múltiple: duplicar deixa cada un al seu grup; enganxar en un grup els hi posa; sense grup, solts", () => {
    const c = comp()
    const clip = copyItems(c, [{ kind: "module", id: "c" }, { kind: "part", id: "p3" }])
    expect(clip.group).toBeUndefined()
    const dup = insertItemsCopy(c, clip)
    const [m, p] = dup.items
    expect(dup.comp.modules.find((x) => x.id === m!.id)!.group).toBe("G")
    expect(dup.comp.parts!.find((x) => x.id === p!.id)!.group).toBeUndefined()
    const into = insertItemsCopy(c, clip, { group: "H" })
    expect(groupItems(into.comp, "H")).toHaveLength(2)
    const loose = insertItemsCopy(c, clip, { group: null })
    expect(loose.comp.modules.find((x) => x.id === loose.items[0]!.id)!.group).toBeUndefined()
    // Amb un mòdul triat, el mòdul enganxat hi va a continuació.
    const after = insertItemsCopy(c, clip, { group: null, afterModule: "a" })
    expect(after.comp.modules[1]!.id).toBe(after.items[0]!.id)
  })

  it("el porta-retalls d'un grup es valida", () => {
    const clip = copyGroup(comp(), "G")
    expect(parseClip(JSON.parse(JSON.stringify({ kind: "items", data: clip, label: "G" })))?.kind).toBe("items")
    expect(parseClip({ kind: "items", data: { dx: 1 }, label: "G" })).toBeNull()
  })
})

describe("treure un mòdul del grup arrossegant-lo", () => {
  it("deixat al costat d'un mòdul sense grup, en surt; al costat d'un del grup, hi entra", () => {
    const out = reorderModule(comp(), "c", "d", true)
    expect(out.modules.map((m) => [m.id, m.group ?? ""])).toEqual([["a", ""], ["b", "G"], ["d", ""], ["c", ""]])
    const inn = reorderModule(comp(), "a", "c", true)
    expect(inn.modules.find((m) => m.id === "a")!.group).toBe("G")
  })
  it("a la zona «Treure del grup», en surt i no es mou", () => {
    const c = comp()
    const out = ungroupMulti(c, [{ kind: "module", id: "b" }])
    expect(out.modules.find((m) => m.id === "b")!.group).toBeUndefined()
    expect(modulePlacements(out)).toEqual(modulePlacements(c))
  })
})
