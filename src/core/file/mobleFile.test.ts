import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { TV_LIVING_ROOM, DEFAULT_HARDWARE_KIT, DEFAULT_SETTINGS, materialRefNames, type Composition, type RefPreset } from "../model"
import { DEFAULT_NEST_OPTIONS } from "../nesting/nest"
import { buildMobleFile, FileCalibrationSchema, MOBLE_BASE_VERSION, MOBLE_VERSION, missingMaterials, missingMaterialsWarning, missingReferences, usedUserModelIds, mobleFileName, mobleToJson, parseMobleFile, uniqueName, usedReferences, type FileCalibration } from "./mobleFile"
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
    expect(uniqueName("Moble (3)", ["Moble (3)"])).toBe("Moble (4)")
    expect(uniqueName("Moble (3)", ["Moble (3)", "Moble (4)"])).toBe("Moble (5)")
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
      points: true, ref: true, refAspect: true, measures: true, floorLine: true, applied: true, opacity: true, layer: true, render: true, shadows: true, plane: true, focal35: true, origin: true, originMm: true, originScale: true, offset: true, offsetZ: true, refWallOffset: true,
    }
    type Extra<A, B> = Exclude<keyof A, keyof B>
    const same: [Extra<Omit<PhotoCalibration, "photoId">, FileCalibration>, Extra<FileCalibration, Omit<PhotoCalibration, "photoId">>] extends [never, never] ? true : false = true
    expect(same).toBe(true)
    expect(Object.keys(FileCalibrationSchema.shape).sort()).toEqual(Object.keys(keys).sort())
  })
})

describe("materials que no són a les preferències de qui obre el .moble", () => {
  it("un moble del catàleg amb les preferències inicials: no en falta cap", () => {
    expect(missingMaterials(comp, DEFAULT_SETTINGS.materials)).toEqual([])
    expect(missingMaterialsWarning([])).toBeUndefined()
  })
  it("mira tots els camps de material (cos, fronts, fons, peces lliures, taulell, objectes, escena) i resol els àlies", () => {
    const m0 = comp.modules[0]!
    const c = {
      ...comp,
      modules: [{ ...m0, carcass: { ...m0.carcass, material: "Cos X", frontMaterial: "Front X", backMaterial: "Fons X" } }, ...comp.modules.slice(1)],
      parts: [{ id: "p", material: "Peça X", material2: "" }],
      runs: [{ id: "r", material: "Taulell X" }],
      refs: [{ id: "o", material: "Objecte X" }, { id: "o2", material: "Front X" }],
      // «Roure (foto)» és l'àlies de «Roure massís / xapat», que sí que hi és.
      scene: { floor: "Terra X", wall: "Roure (foto)" },
    } as unknown as Composition
    const names = materialRefNames(c)
    expect(names).toEqual(expect.arrayContaining(["Cos X", "Front X", "Fons X", "Peça X", "Taulell X", "Objecte X", "Terra X", "Roure (foto)"]))
    expect(names).not.toContain("")
    const missing = missingMaterials(c, DEFAULT_SETTINGS.materials)
    expect([...missing].sort()).toEqual(["Cos X", "Fons X", "Front X", "Objecte X", "Peça X", "Taulell X", "Terra X"])
    expect(missingMaterialsWarning(["A", "B"])).toBe(
      "Materials que no tens a Preferències: A, B; es veuran amb un color per defecte i al taller sortiran amb aquest nom. Afegeix-los a Preferències › Materials.",
    )
  })

  describe("versió: v2 només amb ferratges importats", () => {
    const imported = { ...DEFAULT_HARDWARE_KIT.hinge, id: "hw-imp", name: "Sensys", imported: { maker: "Hettich", article: "9071205", folders: [], files: [], proposed: [], confirmed: false } }
    const withImported = (where: "kit" | "front"): Composition => {
      const c = structuredClone(comp)
      const m = c.modules[0]!
      if (where === "kit") m.hardware = { ...m.hardware, hinge: imported }
      else m.root = { id: "r", front: { kind: "door", mode: "single", hinge: "left", hardware: imported } }
      return c
    }

    it("un moble sense importats es desa com a v1 (les apps d'abans l'obren)", () => {
      expect(MOBLE_BASE_VERSION).toBe(1)
      expect(buildMobleFile({ name: "x", composition: comp, references }).version).toBe(1)
    })

    for (const where of ["kit", "front"] as const)
      it(`amb un importat (${where === "kit" ? "frontissa del mòdul" : "triat a la porta"}) és v2 i es torna a llegir amb l'importat`, () => {
        const file = buildMobleFile({ name: "x", composition: withImported(where), references })
        expect(file.version).toBe(2)
        // Una app d'abans (només llegeix la v1: `version > 1` → rebutja) no el pot obrir i treure-li l'importat.
        expect(file.version).toBeGreaterThan(MOBLE_BASE_VERSION)
        const res = parseMobleFile(mobleToJson(file))
        expect(res.ok).toBe(true)
        if (!res.ok) return
        const m = res.file.project.composition.modules[0]!
        const got = where === "kit" ? m.hardware.hinge : (m.root.front as { hardware?: typeof imported }).hardware
        expect(got?.imported).toMatchObject({ article: "9071205", confirmed: false })
      })

    it("una versió més nova que la que llegeix l'app es rebutja com abans", () => {
      expect(MOBLE_VERSION).toBe(2)
      const file = buildMobleFile({ name: "x", composition: withImported("kit"), references })
      expect(parseMobleFile(JSON.stringify({ ...file, version: MOBLE_VERSION + 1 }))).toEqual({ ok: false, error: "Fitxer d'una versió més nova de l'app: actualitza-la." })
      expect(parseMobleFile(JSON.stringify({ ...file, version: 0 })).ok).toBe(false)
      // Un v1 d'abans continua obrint-se.
      expect(parseMobleFile(mobleToJson(buildMobleFile({ name: "x", composition: comp, references }))).ok).toBe(true)
    })
  })
})
