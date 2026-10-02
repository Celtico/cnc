import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { TV_LIVING_ROOM, DEFAULT_SETTINGS, type RefPreset } from "../model"
import { DEFAULT_NEST_OPTIONS } from "../nesting/nest"
import { buildMobleFile, FileCalibrationSchema, missingReferences, usedUserModelIds, mobleFileName, mobleToJson, parseMobleFile, uniqueName, usedReferences, type FileCalibration } from "./mobleFile"
import type { PhotoCalibration } from "../../db/db"

const comp = TV_LIVING_ROOM.make()
const radiator: RefPreset = { id: "u-rad", name: "Radiador 650 × 1100 × 110", w: 650, h: 1100, d: 110, plane: "wall", wallOffset: 0 }
const references = [...DEFAULT_SETTINGS.references, radiator]
const photo = { mime: "image/jpeg", width: 40, height: 30, exifFocal35: 26, data: btoa("\xff\xd8\xff\xe0fake-jpeg-bytes") }
const calibration = { points: [[1, 2], [3, 4], [5, 6], [7, 8]] as [number, number][], ref: { w: 800, h: 600 }, plane: "wall" as const, focal35: 26, offset: [0, 0] as [number, number], refWallOffset: 40 }

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
    expect(names).toContain("Radiador 800 × 600")
    expect(names).not.toContain("Full A4 vertical")
    expect(used.every((r) => r.builtin === undefined)).toBe(true)
  })

  it("fitxer sense foto: el calibratge es conserva igualment", () => {
    const file = buildMobleFile({ name: "Sense foto", composition: comp, calibration, references })
    const res = parseMobleFile(mobleToJson(file))
    expect(res.ok && res.file.photo).toBeUndefined()
    expect(res.ok && res.file.project.photo?.ref).toEqual({ w: 800, h: 600 })
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

  describe("models 3D de l'usuari", () => {
    const withModels = { ...comp, models: [
      { id: "g1", name: "Planta", src: "user-abc123", x: 0, y: 0, z: 0, w: 500, h: 800, d: 400, rot: 0 },
      { id: "g2", name: "Falguera", src: "fern-02-a", x: 0, y: 0, z: 0, w: 552, h: 287, d: 613, rot: 0 },
      { id: "g3", name: "Planta 2", src: "user-abc123", x: 600, y: 0, z: 0, w: 500, h: 800, d: 400, rot: 0 },
    ] }
    const bytes = "glTF\x02\x00\x00\x00fake-glb"
    const model = { id: "user-abc123", name: "La meva planta", size: [500, 800, 400] as [number, number, number], mime: "model/gltf-binary", data: btoa(bytes) }
    const unused = { ...model, id: "user-zzz", name: "Sense fer servir" }

    it("només els de l'usuari que fa servir la composició, sense repetir", () => {
      expect(usedUserModelIds(withModels)).toEqual(["user-abc123"])
      expect(usedUserModelIds(comp)).toEqual([])
    })

    it("anada i tornada: nom, mida i bytes (base64) iguals; els que no fa servir no hi van", () => {
      const file = buildMobleFile({ name: "Amb planta", composition: withModels, references, models: [model, unused] })
      const res = parseMobleFile(mobleToJson(file))
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.warnings).toEqual([])
      expect(res.file.models).toEqual([model])
      expect(atob(res.file.models![0]!.data)).toBe(bytes)
      expect(res.file.project.composition.models?.map((m) => m.src)).toEqual(["user-abc123", "fern-02-a", "user-abc123"])
    })

    it("sense models de l'usuari el fitxer no porta `models` (com els antics, que s'obren igual)", () => {
      const file = buildMobleFile({ name: "x", composition: comp, references, models: [model] })
      expect("models" in file).toBe(false)
      const res = parseMobleFile(mobleToJson(file))
      expect(res.ok && res.file.models).toBeUndefined()
    })

    it("model malmès: s'obre sense ell i avisa", () => {
      const file = buildMobleFile({ name: "x", composition: withModels, references, models: [model] })
      const json = JSON.parse(mobleToJson(file))
      json.models.push({ id: "user-bad", data: 7 })
      const res = parseMobleFile(JSON.stringify(json))
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.file.models).toEqual([model])
      expect(res.warnings).toEqual(["Algun model 3D del fitxer està malmès; no es veurà."])
    })
  })
})

describe(".moble amb parts malmeses", () => {
  const good = () => JSON.parse(mobleToJson(buildMobleFile({ name: "x", composition: comp, nesting: DEFAULT_NEST_OPTIONS, calibration, references }))) as Record<string, any>

  it("un objecte de referència dolent del moble es treu i el moble s'obre", () => {
    const f = good()
    const n = f.project.composition.references.length
    f.project.composition.references.push({ id: "r1", name: "dolent", w: 0, h: 10, d: 10, x: 0, y: 0, z: 0 })
    const res = parseMobleFile(JSON.stringify(f))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.references).toHaveLength(n)
    expect(res.file.project.composition.modules.map((m) => m.id)).toEqual(comp.modules.map((m) => m.id))
    expect(res.warnings.some((w) => w.includes("dolent"))).toBe(true)
  })

  it("nesting, calibratge o referències dolents: es treuen amb un avís", () => {
    const f = good()
    f.project.nesting = { sheet: { w: 1, h: 1 }, kerf: 99, margin: 0 }
    f.project.photo = { ...calibration, focal35: "x" }
    f.references = [...f.references, { id: "a", name: "", w: 1, h: 1, plane: "wall", wallOffset: 0 }]
    const res = parseMobleFile(JSON.stringify(f))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.nesting).toBeUndefined()
    expect(res.file.project.photo).toBeUndefined()
    expect(res.file.references).toEqual(good().references)
    expect(res.warnings).toHaveLength(3)
  })

  it("calibratge amb un camp opcional dolent: es queda sense aquell camp", () => {
    const f = good()
    f.project.photo = { ...calibration, opacity: "mig" }
    const res = parseMobleFile(JSON.stringify(f))
    expect(res.ok && res.file.project.photo).toEqual(calibration)
  })

  it("aspecte de la foto (línies/realista i ombres) es conserva", () => {
    const cal = { ...calibration, render: "realistic" as const, shadows: false }
    const res = parseMobleFile(mobleToJson(buildMobleFile({ name: "x", composition: comp, calibration: cal, references })))
    expect(res.ok && res.file.project.photo).toEqual(cal)
  })

  it("el calibratge del fitxer té els mateixos camps que el de la base de dades", () => {
    // Si `PhotoCalibration` guanya o perd un camp, això no compila fins que s'afegeix a `FileCalibrationSchema`.
    const keys: Record<keyof Omit<PhotoCalibration, "photoId">, true> & Record<keyof FileCalibration, true> = {
      points: true, ref: true, refAspect: true, measures: true, floorLine: true, applied: true, opacity: true, layer: true, render: true, shadows: true, plane: true, focal35: true, origin: true, originMm: true, offset: true, offsetZ: true, refWallOffset: true,
    }
    type Extra<A, B> = Exclude<keyof A, keyof B>
    const same: [Extra<Omit<PhotoCalibration, "photoId">, FileCalibration>, Extra<FileCalibration, Omit<PhotoCalibration, "photoId">>] extends [never, never] ? true : false = true
    expect(same).toBe(true)
    expect(Object.keys(FileCalibrationSchema.shape).sort()).toEqual(Object.keys(keys).sort())
  })
})
