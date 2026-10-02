import { describe, expect, it } from "vitest"
import { BUILTIN_MATERIALS } from "../../core/model"
import { finishOfPref, resolveEdgeFinish } from "./textures"

const by = (name: string) => BUILTIN_MATERIALS.find((m) => m.name === name)!

describe("acabat dels cantells", () => {
  it("les xapes de foto fan el cantell de la seva foto (no d'un altre material de nom semblant)", () => {
    for (const n of ["Noguera xapada", "Roure massís / xapat", "Fusta fosca", "Noguera fumada"]) expect(resolveEdgeFinish(BUILTIN_MATERIALS, n), n).toEqual(finishOfPref(by(n)))
  })

  it("una melamina de la mateixa foto agafa la del material que diu el cantell", () => {
    expect(resolveEdgeFinish(BUILTIN_MATERIALS, "Melamina roure")).toEqual(finishOfPref(by("Roure massís / xapat")))
  })

  it("sense foto, com abans: el material que diu el cantell o les paraules clau", () => {
    expect(resolveEdgeFinish(BUILTIN_MATERIALS, "Freixe xapat")).toEqual(finishOfPref(by("Freixe xapat")))
    expect(resolveEdgeFinish(BUILTIN_MATERIALS, "Melamina blanca")).toMatchObject({ kind: "color", color: "#f2f0eb" })
  })
})
