import { describe, expect, it } from "vitest"
import { extOf, IMPORT_ACCEPT, IMPORT_FORMATS, importFormatOf, MODEL_3D_KINDS } from "./formats"
import { hettichFileKind } from "./hettich"
import { has3d, importCandidate, importFileKind } from "./makers"

describe("formats de l'importador de ferratges", () => {
  it("el selector accepta tots els formats que llegeix el classificador (una sola taula)", () => {
    const accept = IMPORT_ACCEPT.split(",")
    for (const f of IMPORT_FORMATS) for (const e of f.ext) expect(accept).toContain(e)
    for (const e of [".dae", ".pgm", ".step", ".stp", ".igs", ".iges", ".3ds", ".dxf", ".dwg", ".pdf", ".zip", ".glb", ".gltf", ".mpr"]) expect(accept).toContain(e)
    // Amb el MIME del Collada: el diàleg del Mac no el deixa en gris.
    expect(accept).toContain("model/vnd.collada+xml")
  })

  it("cada extensió de la taula es classifica com diu la taula", () => {
    for (const f of IMPORT_FORMATS) {
      if (f.kind === "dxf" || f.kind === "pdf" || f.kind === "zip") continue
      for (const e of f.ext) {
        expect(hettichFileKind(`9071205${e}`)).toBe(f.kind)
        expect(hettichFileKind(`9071205${e.toUpperCase()}`)).toBe(f.kind)
      }
    }
    expect(hettichFileKind("readme.txt")).toBe("other")
    expect(importFormatOf("x/readme.txt")).toBeNull()
    expect(extOf("a.b/c.DAE")).toBe(".dae")
    expect(extOf("noext")).toBe("")
  })

  it("fitxers de Blum solts i barrejats: tots són candidats i amb el seu tipus", () => {
    const files = ["71T453T_41212141.step", "71T453T_41212141.dae", "71T453T_41212141.dxf", "71T453T_41212141_R.pgm", "71T453T_41212141.pdf", "71T453T_41212141.glb"]
    for (const f of files) expect(importCandidate(f)).toBe(true)
    expect(files.map(importFileKind)).toEqual(["step", "dae", "dxf3d", "pgm", "pdf", "glb"])
    expect(has3d([{ kind: "glb" }])).toBe(true)
    expect(MODEL_3D_KINDS[0]).toBe("step")
  })
})
