import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { DEFAULT_SETTINGS, TV_LIVING_ROOM, OBJECT_TEMPLATES, roomWalls, type Ambient, type RefPreset } from "../model"
import { DEFAULT_NEST_OPTIONS } from "../nesting/nest"
import { AMBIENT_FORMAT, AMBIENT_VERSION, ambientFileName, ambientToJson, buildAmbientFile, fileKind, missingAmbientMaterials, missingAmbientReferences, parseAmbientFile } from "./ambientFile"
import { buildMobleFile, mobleToJson, MOBLE_VERSION, type FileModel } from "./mobleFile"

const tv = TV_LIVING_ROOM.make()
const sofaTemplate = OBJECT_TEMPLATES[0]!
const sofa = { ...sofaTemplate.make(), kind: "objecte" as const }
const glb: FileModel = { id: "user-abc", name: "Planta", size: [300, 900, 300], mime: "model/gltf-binary", data: btoa("glTF-fake") }
const plant = { ...sofaTemplate.make(), kind: "objecte" as const, models: [{ id: "m1", name: "Planta", src: "user-abc", x: 0, y: 0, z: 0, w: 300, h: 900, d: 300, rot: 0 }] }
const radiator: RefPreset = { id: "u-rad", name: "Radiador 650 × 1100 × 110", w: 650, h: 1100, d: 110, plane: "wall", wallOffset: 0 }
const photo = { mime: "image/jpeg", width: 40, height: 30, exifFocal35: 26, data: btoa("\xff\xd8\xff\xe0fake") }
const calibration = { points: [[1, 2], [3, 4], [5, 6], [7, 8]] as [number, number][], ref: { w: 650, h: 1100 }, plane: "wall" as const, focal35: 26, offset: [0, 0] as [number, number] }

const ambient: Ambient = {
  walls: roomWalls(0, 0, 4000, 3000).map((w, i) => (i === 0 ? { ...w, material: "Pintura verda", openings: [{ kind: "window", at: 1500, w: 1200, h: 1200, sill: 900 }] } : w)),
  items: [
    { id: "i1", kind: "moble", projectId: 12, x: 1200, y: 300, rot: 0, group: "Saló" },
    { id: "i2", kind: "moble", projectId: 40, x: 2000, y: 1500, rot: 90, group: "Saló" },
    // El mateix moble dues vegades (com «Duplicar» dins l'ambient).
    { id: "i3", kind: "moble", projectId: 12, x: 3000, y: 300, rot: 0, elevation: 200 },
    { id: "i4", kind: "moble", projectId: 41, x: 500, y: 2500, rot: 0 },
    { id: "b1", kind: "block", name: "Catifa", shape: "box", w: 2000, h: 10, d: 3000, material: "Catifa beix", x: 2000, y: 1500, rot: 0 },
    // Un moble esborrat: no va al fitxer.
    { id: "i5", kind: "moble", projectId: 99, x: 100, y: 100, rot: 0 },
  ],
  plan: { src: "data:image/jpeg;base64,AAAA", pxW: 2400, pxH: 1800, mmPerPx: 2, x: -100, y: -100, opacity: 0.5, locked: true },
  floorMaterial: "Parquet de roure",
  wallMaterial: "Pintura blanca",
  ceilingMaterial: "Pintura blanca",
  outsideFloorMaterial: "Gespa",
  camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 55, pose: "eye" },
  render: { mood: "dusk", focal: 24 },
}

const references = [...DEFAULT_SETTINGS.references, radiator]
const furniture = new Map([
  [12, buildMobleFile({ name: "Moble TV", composition: tv, nesting: DEFAULT_NEST_OPTIONS, calibration, references, photo, exportedAt: "x" })],
  [40, buildMobleFile({ name: "Sofà", composition: sofa, references, exportedAt: "x" })],
  [41, buildMobleFile({ name: "Planta", composition: plant, references, models: [glb], exportedAt: "x" })],
])
const render = { mood: "dusk", res: "1600", opts: { bounces: 6 } }
const built = buildAmbientFile({ name: "Saló de casa", ambient, furniture, render, exportedAt: "2026-10-08T10:00:00Z" })
const { file } = built

describe("fitxer .ambient", () => {
  it("anada i tornada: el mateix ambient i els mateixos mobles", () => {
    const res = parseAmbientFile(ambientToJson(file))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.warnings).toEqual([])
    // Igual que el fitxer desat (en llegir-lo, cada moble passa a la versió actual del `.moble`, com en obrir un `.moble`).
    const saved = JSON.parse(ambientToJson(file)) as typeof file
    expect(res.file).toEqual({ ...saved, furniture: saved.furniture.map((f) => ({ ...f, moble: { ...f.moble, version: MOBLE_VERSION } })) })
    // I tornar-lo a desar el deixa igual.
    expect(parseAmbientFile(ambientToJson(res.file))).toEqual(res)
    expect(res.file.ambient.name).toBe("Saló de casa")
    const data = res.file.ambient.data
    expect(data.walls).toEqual(ambient.walls)
    expect(data.plan).toEqual(ambient.plan)
    expect(data.camera).toEqual(ambient.camera)
    expect(data.render).toEqual(ambient.render)
    expect(data.ceilingMaterial).toBe("Pintura blanca")
    expect(res.file.render).toEqual(render)
    // Les peces del moble són les mateixes, i la foto i el calibratge hi són.
    const tvCopy = res.file.furniture.find((f) => f.moble.project.name === "Moble TV")!.moble
    expect(buildComposition(tvCopy.project.composition).panels).toEqual(buildComposition(tv).panels)
    expect(tvCopy.photo).toEqual(photo)
    expect(tvCopy.project.photo).toEqual(calibration)
  })

  it("els elements apunten a la clau del moble al fitxer; el mateix moble, la mateixa clau; els esborrats no hi van", () => {
    expect(built.dropped).toBe(1)
    const items = file.ambient.data.items
    expect(items.map((i) => i.id)).toEqual(["i1", "i2", "i3", "i4", "b1"])
    const keyOf = (id: string) => {
      const it = items.find((i) => i.id === id)!
      return it.kind === "moble" ? it.projectId : null
    }
    expect(keyOf("i1")).toBe(0)
    expect(keyOf("i3")).toBe(0)
    expect(keyOf("i2")).toBe(1)
    expect(keyOf("i4")).toBe(2)
    expect(file.furniture.map((f) => [f.key, f.moble.project.name])).toEqual([
      [0, "Moble TV"],
      [1, "Sofà"],
      [2, "Planta"],
    ])
    // Grups i alçada es conserven.
    expect(items.find((i) => i.id === "i3")!.elevation).toBe(200)
    expect(items.filter((i) => i.group === "Saló").length).toBe(2)
  })

  it("models 3D de l'usuari: un sol cop a dalt, no a cada moble", () => {
    expect(file.models).toEqual([glb])
    expect(file.furniture.every((f) => f.moble.models === undefined)).toBe(true)
    const twice = buildAmbientFile({ name: "x", ambient: { ...ambient, items: [ambient.items[3]!, { id: "i9", kind: "moble", projectId: 42, x: 0, y: 0, rot: 0 }] }, furniture: new Map([...furniture, [42, furniture.get(41)!]]) })
    expect(twice.file.models).toEqual([glb])
  })

  it("errors en català: no és JSON, és un moble, d'un altre programa, d'una versió més nova", () => {
    expect(parseAmbientFile("no json")).toEqual({ ok: false, error: "Aquest fitxer no és un ambient (no és un JSON vàlid)." })
    expect(parseAmbientFile(mobleToJson(furniture.get(12)!))).toEqual({ ok: false, error: "Aquest fitxer és un moble, no un ambient." })
    expect(parseAmbientFile(JSON.stringify({ hello: 1 }))).toEqual({ ok: false, error: "Aquest fitxer no és un ambient." })
    expect(parseAmbientFile(JSON.stringify({ ...file, version: AMBIENT_VERSION + 1 }))).toEqual({ ok: false, error: "Fitxer d'una versió més nova de l'app: actualitza-la." })
    // Un moble de dins d'una versió més nova: tot el fitxer (si no, sortiria un ambient a mitges sense dir per què).
    const newer = { ...file, furniture: [{ ...file.furniture[0]!, moble: { ...file.furniture[0]!.moble, version: MOBLE_VERSION + 1 } }, ...file.furniture.slice(1)] }
    expect(parseAmbientFile(JSON.stringify(newer))).toEqual({ ok: false, error: "Fitxer d'una versió més nova de l'app: actualitza-la." })
    expect(parseAmbientFile(JSON.stringify({ format: AMBIENT_FORMAT, version: 1 })).ok).toBe(false)
  })

  it("parts malmeses: es treuen amb un avís i la resta s'obre", () => {
    const raw = JSON.parse(ambientToJson(file)) as Record<string, unknown> & typeof file
    // Un moble amb la composició il·legible, un model malmès, el render que no és un objecte i una paret dolenta.
    raw.furniture[1]!.moble.project.composition = { modules: "?" } as never
    ;(raw.models as unknown[]).push({ id: "user-bad", data: 3 })
    ;(raw as Record<string, unknown>).render = "dolent"
    ;(raw.ambient.data.walls as unknown[]).push({ id: "w-bad", a: [0, 0] })
    const res = parseAmbientFile(JSON.stringify(raw))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.furniture.map((f) => f.moble.project.name)).toEqual(["Moble TV", "Planta"])
    // L'element del moble que no s'ha pogut llegir es treu (no queda un enllaç a res).
    expect(res.file.ambient.data.items.map((i) => i.id)).toEqual(["i1", "i3", "i4", "b1"])
    expect(res.file.models).toEqual([glb])
    expect(res.file.render).toBeUndefined()
    expect(res.file.ambient.data.walls).toHaveLength(4)
    expect(res.warnings.join(" ")).toMatch(/«Sofà» del fitxer està malmès/)
    expect(res.warnings.join(" ")).toMatch(/Un element de l'ambient no tenia el seu moble/)
    expect(res.warnings.join(" ")).toMatch(/model 3D/)
    expect(res.warnings.join(" ")).toMatch(/render/)
    expect(res.warnings.join(" ")).toMatch(/dades malmeses de l'ambient/)
  })

  it("un moble de dins amb una part malmesa es repara com el .moble (la foto fora, el moble es queda)", () => {
    const raw = JSON.parse(ambientToJson(file)) as typeof file
    raw.furniture[0]!.moble.photo = { mime: "image/jpeg" } as never
    const res = parseAmbientFile(JSON.stringify(raw))
    expect(res.ok && res.file.furniture[0]!.moble.photo).toBeUndefined()
    expect(res.ok && res.warnings).toEqual(["«Moble TV»: La foto del fitxer està malmesa; s'ha obert sense foto."])
  })

  it("claus repetides: el segon moble es treu", () => {
    const raw = JSON.parse(ambientToJson(file)) as typeof file
    raw.furniture[1]!.key = 0
    const res = parseAmbientFile(JSON.stringify(raw))
    expect(res.ok && res.file.furniture.map((f) => f.moble.project.name)).toEqual(["Moble TV", "Planta"])
  })

  it("materials que falten: de l'ambient i dels mobles; referències que falten, un sol cop", () => {
    const names = missingAmbientMaterials(file, DEFAULT_SETTINGS.materials)
    expect(names).toContain("Pintura verda")
    expect(names).not.toContain("Parquet de roure")
    expect(missingAmbientMaterials(file, [...DEFAULT_SETTINGS.materials, { name: "Pintura verda" } as never])).not.toContain("Pintura verda")
    const refs = missingAmbientReferences(file, DEFAULT_SETTINGS.references)
    expect(refs.map((r) => r.name)).toEqual(["Radiador 650 × 1100 × 110"])
  })

  it("nom del fitxer i tipus de fitxer", () => {
    expect(ambientFileName("Saló: casa/pis")).toBe("Saló- casa-pis.ambient")
    expect(ambientFileName("  ")).toBe("ambient.ambient")
    expect(fileKind(file)).toBe("ambient")
    expect(fileKind(furniture.get(12))).toBe("moble")
    expect(fileKind({ format: "x" })).toBeNull()
  })
})
