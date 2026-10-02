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

describe("cantell lacat o sense cantell", () => {
  it("un MDF lacat de color fa el cantell del seu color (no blanc)", () => {
    for (const n of ["MDF lacat antracita", "MDF lacat verd oliva", "MDF lacat negre", "MDF lacat"]) expect(resolveEdgeFinish(BUILTIN_MATERIALS, n), n).toEqual(finishOfPref(by(n)))
  })

  it("no agafa un altre material per la primera paraula del cantell", () => {
    const lacatBlanc = { id: "x", name: "Lacat blanc mat", thicknesses: [19], hasGrain: false, finish: { kind: "lacquer" as const, color: "#f1efea" }, edge: "Lacat (sense cantell)" }
    const list = [...BUILTIN_MATERIALS, lacatBlanc]
    expect(resolveEdgeFinish(list, "MDF lacat antracita")).toEqual(finishOfPref(by("MDF lacat antracita")))
    const pvc = { id: "y", name: "Tauler verd", thicknesses: [19], hasGrain: false, finish: { kind: "color" as const, color: "#00aa00" }, edge: "PVC melamina 1 mm" }
    // «melamina» és la primera paraula de «Melamina blanca», però el cantell no diu el nom sencer.
    expect(resolveEdgeFinish([...list, pvc], "Tauler verd")).toEqual(finishOfPref(pvc))
  })
})
