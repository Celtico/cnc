import { describe, expect, it } from "vitest"
import { defaultModule, modulePlacements, resolveParts, type Composition, type Module, type Run } from "./composition"
import {
  duplicateGroup,
  insertModelCopy,
  insertModuleCopy,
  insertPartCopy,
  insertRefCopy,
  moveAllBy,
  moveModuleBy,
  movePartToGroup,
  parseClip,
  pasteZone,
  removeModule,
  removePartFromGroup,
  reorderPart,
} from "./editOps"

const comp = (): Composition => ({
  modules: [
    { ...defaultModule("a", "A", { width: 600 }), gapBefore: 100 },
    { ...defaultModule("b", "B", { width: 600 }), gapBefore: 50 },
    { ...defaultModule("c", "C", { width: 600 }), gapBefore: 0 },
  ],
  references: [{ id: "r", name: "Columna", w: 300, h: 2500, d: 300, x: 0, y: 0, z: 0 }],
})

describe("edició: moure, copiar i enganxar", () => {
  it("duplicar un model 3D el posa a la dreta amb un id nou", () => {
    const g = { id: "g1", name: "Falguera", src: "fern-02-b", x: 100, y: 0, z: 50, w: 990, h: 428, d: 894, rot: 30 }
    const res = insertModelCopy({ ...comp(), models: [g] }, g)
    expect(res.comp.models).toHaveLength(2)
    const copy = res.comp.models![1]!
    expect(copy.id).toBe(res.id)
    expect(copy.id).not.toBe("g1")
    expect(copy).toMatchObject({ name: "Falguera (còpia)", x: 1110, y: 0, z: 50, w: 990, rot: 30 })
  })
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

describe("grups amb models 3D", async () => {
  const { moveGroupBy, duplicateGroup, newGroupName, removeGroup, renameGroup, reorderModel, setModelGroup, groupNames } = await import("./editOps")
  const p = { id: "a", name: "a", orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x: 0, y: 10, z: 0, group: "G" }
  const m = (id: string, x: number, group?: string) => ({ id, name: id, src: "fern", x, y: 0, z: 0, w: 200, h: 300, d: 200, rot: 0, ...(group ? { group } : {}) })
  const comp = { modules: [], references: [], parts: [p], models: [m("m1", 300, "G"), m("m2", 900)] }
  it("el grup mou i duplica les peces i els models", () => {
    const c = moveGroupBy(comp, "G", 10, 0, 0)
    expect(c.models!.map((q) => q.x)).toEqual([310, 900])
    const d = duplicateGroup(comp, "G")
    expect(d.comp.models!.filter((q) => q.group === d.group)).toHaveLength(1)
    expect(d.comp.parts!.filter((q) => q.group === d.group)).toHaveLength(1)
    expect(groupNames(comp)).toEqual(["G"])
    expect(newGroupName({ ...comp, parts: [] })).toBe("Grup 1")
  })
  it("un model entra i surt d'un grup, s'ordena, i el grup es desagrupa o s'esborra sencer", () => {
    expect(setModelGroup(comp, "m2", "G").models!.map((q) => [q.id, q.group])).toEqual([["m1", "G"], ["m2", "G"]])
    expect(reorderModel(comp, "m2", "m1", false).models!.map((q) => [q.id, q.group])).toEqual([["m2", "G"], ["m1", "G"]])
    expect(renameGroup(comp, "G", undefined).models!.every((q) => !q.group)).toBe(true)
    const r = removeGroup(comp, "G")
    expect([r.parts!.length, r.models!.map((q) => q.id)]).toEqual([0, ["m2"]])
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

  it("arrossegada a «Treure del grup», queda solta al final", () => {
    const r = removePartFromGroup(c, "a")
    expect(r.parts!.map((q) => [q.id, q.group])).toEqual([["b", "G"], ["c", undefined], ["a", undefined]])
  })
})

describe("moure tot el moble amb peces enganxades", () => {
  it("una peça enganxada a un mòdul el segueix una sola vegada; una de solta es mou amb el moble", () => {
    const part = (id: string, module?: string) => ({ id, name: id, orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x: 10, y: 0, z: 0, ...(module ? { module } : {}) })
    const c = moveAllBy({ ...comp(), parts: [part("p", "a"), part("q")] }, 100)
    expect(c.modules[0]!.gapBefore).toBe(200)
    expect(c.parts!.find((x) => x.id === "p")!.x).toBe(10)
    expect(c.parts!.find((x) => x.id === "q")!.x).toBe(110)
  })
})

const part = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x: 10, y: 20, z: 30, ...extra })
const island = (id: string, x: number): Module => ({ ...defaultModule(id, "Illa", { width: 800 }), gapBefore: 0, x, wallGap: 1500 })

describe("illes (X pròpia) i veïns de la fila", () => {
  it("moure un mòdul de la fila no toca la illa que hi ha entre ell i el veí", () => {
    const c: Composition = { ...comp(), modules: [comp().modules[0]!, island("i", 3000), comp().modules[1]!, comp().modules[2]!] }
    const before = modulePlacements(c).map((p) => p.x)
    const after = modulePlacements(moveModuleBy(c, "a", 30)).map((p) => p.x)
    expect(after[0]).toBe(before[0]! + 30)
    expect(after.slice(1)).toEqual(before.slice(1))
  })
  it("duplicar una illa la posa al costat (amplada + 20)", () => {
    const c: Composition = { ...comp(), modules: [...comp().modules, island("i", 3000)] }
    const r = insertModuleCopy(c, c.modules[3]!, "i")
    expect(r.comp.modules.find((m) => m.id === r.id)!.x).toBe(3820)
  })
})

describe("eliminar un mòdul (removeModule)", () => {
  const runs = (): Run[] => [
    { id: "w", kind: "worktop", from: "a", to: "c", material: "M", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [{ id: "k", kind: "sink", module: "b", w: 400, d: 300, dx: 0 }, { id: "h", kind: "hob", module: "c", w: 400, d: 300, dx: 0 }] },
    { id: "s", kind: "plinth", from: "c", to: "c", material: "M", thickness: 19, setback: 40 },
  ]
  it("les peces enganxades queden soltes al mateix lloc", () => {
    const c: Composition = { ...comp(), parts: [part("p", { module: "b" }), part("q")] }
    const before = resolveParts(c).find((p) => p.id === "p")!
    const r = removeModule(c, "b")
    const p = r.comp.parts!.find((x) => x.id === "p")!
    expect(p.module).toBeUndefined()
    expect([p.x, p.y, p.z]).toEqual([before.x, before.y, before.z])
    expect(r.comp.parts!.find((x) => x.id === "q")!.x).toBe(10)
  })
  it("taulell i sòcol: passen al mòdul més proper del tram o es treuen; els forats del mòdul, fora", () => {
    const r = removeModule({ ...comp(), runs: runs() }, "c")
    expect(r.comp.runs).toHaveLength(1)
    expect(r.comp.runs![0]).toMatchObject({ id: "w", from: "a", to: "b" })
    expect((r.comp.runs![0] as Extract<Run, { kind: "worktop" }>).cutouts.map((k) => k.id)).toEqual(["k"])
    expect(r.notes).toHaveLength(2)
    const r2 = removeModule({ ...comp(), runs: runs() }, "a")
    expect(r2.comp.runs![0]).toMatchObject({ from: "b", to: "c" })
    expect(r2.notes).toEqual([])
  })
})

describe("porta-retalls", () => {
  it("parseClip valida amb els esquemes", () => {
    const m = comp().modules[0]!
    expect(parseClip({ kind: "module", data: m, label: "A" })?.kind).toBe("module")
    expect(parseClip({ kind: "module", data: { id: "x" }, label: "A" })).toBeNull()
    expect(parseClip({ kind: "virus", data: {}, label: "" })).toBeNull()
    expect(parseClip("text")).toBeNull()
  })
  it("una peça enganxada a un mòdul d'un altre moble queda solta; del mateix, enganxada", () => {
    const foreign = insertPartCopy(comp(), part("p", { module: "zz" }))
    expect(foreign.comp.parts![0]!.module).toBeUndefined()
    const own = insertPartCopy(comp(), part("p", { module: "a" }))
    expect(own.comp.parts![0]!.module).toBe("a")
  })
})

describe("duplicar un grup amb peces enganxades", () => {
  it("la còpia va a la dreta de la caixa real del grup (coordenades de la composició)", () => {
    const c: Composition = { ...comp(), modules: [{ ...defaultModule("a", "A", { width: 600 }), gapBefore: 2000 }], parts: [part("p1", { module: "a", group: "G", x: 0, y: 0, z: 0 }), part("p2", { group: "G", x: 2500, y: 0, z: 0 })] }
    const abs = resolveParts(c).filter((p) => p.group === "G").map((p) => p.x)
    const d = duplicateGroup(c, "G")
    const copy = resolveParts(d.comp).filter((p) => p.group === d.group).map((p) => p.x)
    const w = Math.max(...abs) + 100 - Math.min(...abs)
    expect(copy.map((x, i) => x - abs[i]!)).toEqual([w + 50, w + 50])
  })
})

describe("selecció múltiple", async () => {
  const { moveMultiBy, removeMulti, groupMulti, toggleMulti, multiBox } = await import("./editOps")
  const p = { id: "a", name: "a", orient: "front" as const, w: 100, h: 100, thickness: 19, material: "M", x: 0, y: 10, z: 0 }
  const m = { id: "m1", name: "m1", src: "fern", x: 300, y: 0, z: 0, w: 200, h: 300, d: 200, rot: 0 }
  const r = { id: "r", name: "r", w: 50, h: 50, d: 50, x: 1000, y: 100, z: 0 }
  const comp = { modules: [], references: [r], parts: [p], models: [m] }
  const items = [{ kind: "part" as const, id: "a" }, { kind: "model" as const, id: "m1" }, { kind: "ref" as const, id: "r" }]
  it("mou, agrupa, treu i calcula la caixa de tots els triats", () => {
    const c = moveMultiBy(comp, items, 10, -5, 0)
    expect([c.parts![0]!.x, c.models![0]!.x, c.references[0]!.x]).toEqual([10, 310, 1010])
    expect(c.models![0]!.y).toBe(0) // no baixa de terra (el model ja hi era)
    expect(groupMulti(comp, items, "G").parts![0]!.group).toBe("G")
    const rm = removeMulti(comp, items)
    expect([rm.parts!.length, rm.models!.length, rm.references.length]).toEqual([0, 0, 0])
    expect(multiBox(comp, items)!.max[0]).toBe(1050)
    expect(toggleMulti(items, { kind: "ref", id: "r" })).toHaveLength(2)
  })
})
