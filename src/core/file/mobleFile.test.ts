import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { TV_LIVING_ROOM, DEFAULT_SETTINGS, type RefPreset } from "../model"
import { DEFAULT_NEST_OPTIONS } from "../nesting/nest"
import { buildMobleFile, missingReferences, mobleFileName, mobleToJson, parseMobleFile, uniqueName, usedReferences } from "./mobleFile"

const comp = TV_LIVING_ROOM.make()
const radiator: RefPreset = { id: "u-rad", name: "Radiador 650 × 1100 × 110", w: 650, h: 1100, d: 110, plane: "wall", wallOffset: 0 }
const references = [...DEFAULT_SETTINGS.references, radiator]
const photo = { mime: "image/jpeg", width: 40, height: 30, exifFocal35: 26, data: btoa("\xff\xd8\xff\xe0fake-jpeg-bytes") }
const calibration = { points: [[1, 2], [3, 4], [5, 6], [7, 8]] as [number, number][], ref: { w: 1231, h: 717 }, plane: "wall" as const, focal35: 26, offset: [0, 0] as [number, number], refWallOffset: 200 }

describe("fitxer .moble", () => {
  it("anada i tornada: mateix moble (peces, mides i forats) i mateixa foto", () => {
    const file = buildMobleFile({ name: "Moble TV", composition: comp, nesting: DEFAULT_NEST_OPTIONS, calibration, references, photo, exportedAt: "2026-09-28T12:00:00Z" })
    const res = parseMobleFile(mobleToJson(file))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.warnings).toEqual([])
    expect(res.file.project.name).toBe("Moble TV")
    expect(res.file.photo).toEqual(photo)
    expect(res.file.project.photo).toEqual(calibration)
    const before = buildComposition(comp).panels
    const after = buildComposition(res.file.project.composition).panels
    expect(after).toEqual(before)
  })

  it("inclou només les referències que el moble fa servir", () => {
    const used = usedReferences({ composition: comp, calibration, references })
    const names = used.map((r) => r.name)
    expect(names).toContain("Radiador 650 × 1100 × 110")
    expect(names).toContain("TV Sony KD-55XD8505 (pantalla)")
    expect(names).not.toContain("Full A4 vertical")
    expect(used.every((r) => r.builtin === undefined)).toBe(true)
  })

  it("fitxer sense foto: el calibratge es conserva igualment", () => {
    const file = buildMobleFile({ name: "Sense foto", composition: comp, calibration, references })
    const res = parseMobleFile(mobleToJson(file))
    expect(res.ok && res.file.photo).toBeUndefined()
    expect(res.ok && res.file.project.photo?.ref).toEqual({ w: 1231, h: 717 })
  })

  it("referències que l'usuari no té s'afegeixen; les que ja té, no es dupliquen", () => {
    const file = buildMobleFile({ name: "x", composition: comp, calibration, references })
    const mine = DEFAULT_SETTINGS.references
    const missing = missingReferences(file, mine)
    expect(missing.map((r) => r.name)).toEqual(["Radiador 650 × 1100 × 110"])
    expect(missingReferences(file, [...mine, { ...radiator, id: "altre-id" }])).toEqual([])
  })

  it("fitxer invàlid o d'un altre programa → error clar", () => {
    expect(parseMobleFile("no json")).toEqual({ ok: false, error: "Aquest fitxer no és un moble (no és un JSON vàlid)." })
    expect(parseMobleFile(JSON.stringify({ hello: 1 }))).toEqual({ ok: false, error: "Aquest fitxer no és un moble." })
    expect(parseMobleFile(JSON.stringify({ format: "mobles-cnc", version: 99 }))).toEqual({ ok: false, error: "Fitxer d'una versió més nova de l'app: actualitza-la." })
    const bad = parseMobleFile(JSON.stringify({ format: "mobles-cnc", version: 1, exportedAt: "", project: { name: "x", composition: { modules: "?" } }, references: [] }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/no és un moble vàlid/)
  })

  it("foto malmesa: s'obre sense foto i avisa", () => {
    const file = buildMobleFile({ name: "x", composition: comp, references, photo })
    const json = JSON.parse(mobleToJson(file))
    json.photo = { mime: "image/jpeg", data: 42 }
    const res = parseMobleFile(JSON.stringify(json))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.photo).toBeUndefined()
    expect(res.warnings).toEqual(["La foto del fitxer està malmesa; s'ha obert sense foto."])
  })

  it("noms de fitxer i noms únics", () => {
    expect(mobleFileName("Moble TV: menjador/2026")).toBe("Moble TV- menjador-2026.moble")
    expect(uniqueName("Moble", ["Moble", "Moble (2)"])).toBe("Moble (3)")
    expect(uniqueName("Nou", ["Moble"])).toBe("Nou")
  })
})
