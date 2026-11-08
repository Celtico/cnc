import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { fromTaulell } from "../import/taulell"
import { defaultModule, panelAabb, partBox, type Composition } from "../model"
import { quatFromBasis, toTaulell } from "./taulellExport"

const comp: Composition = { kind: "moble", modules: [defaultModule("m1", "Baix")], references: [], parts: [] }

describe("Baixa .taulell (cel, 2026-11-08)", () => {
  const { doc } = toTaulell(comp, "Cuina")
  const panels = buildComposition(comp).panels.filter((p) => p.role !== "hardware")

  it("cada peça del moble és una peça solta del Taulell, amb el comptador `next`", () => {
    expect(doc.parts).toHaveLength(panels.length)
    expect(doc.next).toBe(panels.length + 1)
    expect(doc.parts.every((p) => p.grp === "Baix")).toBe(true)
  })

  it("el quaternió és el de la base (identitat i un gir de 90° al voltant de y)", () => {
    expect(quatFromBasis([1, 0, 0], [0, 1, 0], [0, 0, 1])).toEqual([0, 0, 0, 1])
    const q = quatFromBasis([0, 0, -1], [0, 1, 0], [1, 0, 0])
    expect(q[1]).toBeCloseTo(Math.SQRT1_2, 5)
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it("tornat a obrir al cnc (com a peces soltes), cada peça rectangular és al mateix lloc i fa la mateixa mida", () => {
    const back = fromTaulell({ ...doc, parts: doc.parts.filter((p) => p.prof.type === "rect") }, () => "Melamina blanca")
    const rect = panels.filter((p) => !p.outline)
    expect(back.composition.parts).toHaveLength(rect.length)
    rect.forEach((p, i) => {
      const a = panelAabb(p)
      const b = partBox(back.composition.parts![i]!)
      for (let k = 0; k < 3; k++) {
        expect(b.min[k]).toBeCloseTo(a.min[k]!, 0)
        expect(b.max[k]).toBeCloseTo(a.max[k]!, 0)
      }
    })
  })

  it("els forats hi van, a la cara o al cantell", () => {
    const holes = panels.reduce((n, p) => n + p.holes.length, 0)
    expect(doc.parts.reduce((n, p) => n + p.feats.filter((f) => f.type === "hole").length, 0)).toBe(holes)
  })
})
