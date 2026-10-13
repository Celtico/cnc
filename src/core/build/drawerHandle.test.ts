import { describe, expect, it } from "vitest"
import { defaultModule, type Composition, type Front, type Module } from "../model"
import { buildComposition } from "./buildComposition"

const withDrawers = (front: Extract<Front, { kind: "drawers" }>): Composition => {
  const m: Module = defaultModule("m1", "M")
  return { kind: "moble", modules: [{ ...m, root: { ...m.root, front } }], references: [] }
}
/** Y local (cap avall des del cantell de dalt) dels forats del tirador de cada front de calaix. */
const handleYs = (c: Composition) =>
  buildComposition(c)
    .panels.filter((p) => p.role === "drawerFront")
    .map((p) => ({ fh: p.width, ys: [...new Set((p.cutouts ?? []).filter((x) => x.kind === "circle" && x.tag === "handle").map((x) => (x.kind === "circle" ? x.y : 0)))] }))

describe("posició del tirador dels calaixos", () => {
  it("sense `handleTop`, centrat; amb, a aquells mm del cantell de dalt (mai per sota del mig)", () => {
    const base = { kind: "drawers" as const, n: 2, heights: ["auto", "auto"] as ("auto" | number)[] }
    for (const f of handleYs(withDrawers(base))) expect(f.ys).toEqual([f.fh / 2])
    for (const f of handleYs(withDrawers({ ...base, handleTop: 40 }))) expect(f.ys).toEqual([40])
    for (const f of handleYs(withDrawers({ ...base, handleTop: 1000 }))) expect(f.ys).toEqual([f.fh / 2])
  })
})

describe("distància del tirador de l'abatible", () => {
  const withFlap = (handleInset?: number): Composition => {
    const m: Module = defaultModule("m1", "M")
    const front: Extract<Front, { kind: "flap" }> = { kind: "flap", dir: "down", ...(handleInset !== undefined ? { handleInset } : {}) }
    return { kind: "moble", modules: [{ ...m, root: { ...m.root, front } }], references: [] }
  }
  // X local de l'abatible = alçada; avall, el cantell que obre és el de dalt (x = llarg): el tirador a llarg − distància.
  const handleX = (c: Composition) => {
    const flap = buildComposition(c).panels.find((p) => p.role === "flap")!
    const xs = [...new Set((flap.cutouts ?? []).filter((x) => x.kind === "circle" && x.tag === "handle").map((x) => (x.kind === "circle" ? x.x : 0)))]
    return { L: flap.length, xs }
  }
  it("amb `handleInset`, el tirador a aquella distància del cantell que obre", () => {
    const def = handleX(withFlap())
    expect(def.xs).toHaveLength(1)
    const own = handleX(withFlap(80))
    expect(own.xs).toEqual([own.L - 80])
    expect(own.xs).not.toEqual(def.xs)
  })
})
