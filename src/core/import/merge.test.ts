import { describe, expect, it } from "vitest"
import { buildModule } from "../build/buildModule"
import { DEFAULT_MODULE_HARDWARE, DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type GenOp, type HardwareItem, type Module, type Zone } from "../model"
import { groupHettich, hettichFileKind, type HettichArticle } from "./hettich"
import { legacyHettichLabel, migrateImportedNames } from "./hettichNames"
import { articleItem, pairPlate, plateItem, setConfirmed, setHandleDistance } from "./importItem"
import { applyBoxRepair, applyImportUpdate, dismissImportUpdate, isUnedited, mergeImported, mergePreview, mergeText, needsBoxRepair } from "./merge"
import { modelProposal, type HardwareProposal } from "./proposal"

/**
 * Tornar a importar un article que ja és a la biblioteca: s'amplia (3D, vistes, plànols, la proposta si no en tenia) i
 * **mai es toca un mecanitzat confirmat** (la proposta nova queda pendent de revisar).
 */

const frame = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], n: [0, 1, 0] } as HardwareProposal["frame"]
const hingeP = (screwV = 5.5, cupDepth = 13): HardwareProposal => ({
  kind: "hinge",
  frame,
  holes: [
    { role: "cup", u: 0, v: 0, d: 35, measured: 35, depth: cupDepth, depthFrom: "file" },
    { role: "screw", u: -26, v: screwV, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
    { role: "screw", u: 26, v: screwV, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
  ],
  bbox: { min: [-33.6, -4.3, -12.8], max: [33.6, 19.1, 71] },
  notes: [],
})
const plateP: HardwareProposal = {
  kind: "plate",
  frame: { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], n: [1, 0, 0] },
  holes: [
    { role: "dowel", u: -16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
    { role: "dowel", u: 16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
  ],
  bbox: { min: [-27.7, -22.6, -11.4], max: [27.7, 69.5, 6.4] },
  notes: [],
}
const base = { hinge: DEFAULT_MODULE_HARDWARE.hinge, handle: DEFAULT_MODULE_HARDWARE.handle }

/** L'article tal com el dona `groupHettich` amb uns fitxers. */
function article(paths: string[]): HettichArticle {
  return groupHettich(paths.map((path) => ({ path, kind: hettichFileKind(path) })))[0]!
}
const DIR = "Scharniere/Sensys/Oeffnungswinkel_110/aufliegend"
const step = `STEP_Scharniere/${DIR}/9071205.stp`
const views = [`DWG_DXF_Scharniere/${DIR}/9071205_2D_front_view.dxf`, `DWG_DXF_Scharniere/${DIR}/9071205_2D_side_view.dxf`]

const fromStep = (p: HardwareProposal, id = "hw-h") => {
  const a = article([step])
  return articleItem(p, a, base, { id, asset: "hwa-1", files: a.files.map((f) => f.path.split("/").pop()!) })
}
const fromDxf = (id = "hw-h") => {
  const a = article(views)
  return articleItem(modelProposal(null, [a.plan!]), a, base, { id, asset: "hwa-1", files: a.files.map((f) => f.path.split("/").pop()!), points: [[0, 0, 0]] })
}

/** Els forats que fa una frontissa en una porta (el que rep el taller). */
function doorHoles(item: HardwareItem) {
  const m = defaultModule("m", "M")
  const mod: Module = { ...m, hardware: { ...m.hardware, hinge: item }, root: { id: "r", front: { kind: "door", mode: "single", hinge: "left" } } as Zone }
  return buildModule(mod).panels.find((p) => p.role === "door")!.holes
}

describe("tornar a importar un article: s'amplia", () => {
  it("el diàleg diu si és nou o què s'hi afegeix", () => {
    const lib = [fromDxf()]
    const a = article([step, ...views])
    const m = mergePreview(lib, a)!
    expect(m.items.map((x) => x.id)).toEqual(["hw-h"])
    expect(m.adds).toEqual(["3D i forats proposats"])
    expect(mergeText(m)).toBe("Ja existeix · s'hi afegeix: 3D i forats proposats")
    expect(mergePreview([], a)).toBeNull()
    // Amb el STEP i les vistes, un DXF de nou no hi afegeix res.
    const full = { ...fromStep(hingeP()), imported: { ...fromStep(hingeP()).imported!, files: ["9071205.stp", "9071205_2D_front_view.dxf", "9071205_2D_side_view.dxf"] } }
    expect(mergeText(mergePreview([full], article(views))!)).toBe("Ja existeix · res de nou")
    expect(mergePreview([fromStep(hingeP())], article(views))!.adds).toEqual(["vistes 2D"])
  })

  it("només DXF (només 2D) + STEP: passa a frontissa amb els forats proposats, el mateix id i nom, sense confirmar", () => {
    const old = { ...fromDxf(), name: "La meva frontissa" }
    expect(old.engine).toBe("model")
    expect(old.category).toBe("hinge")
    expect(old.imported!.bbox).toBeUndefined()
    const r = mergeImported(old, fromStep(hingeP()), true)
    expect(r.upgraded).toBe(true)
    expect(r.pendingUpdate).toBe(false)
    expect(r.item).toMatchObject({ id: "hw-h", name: "La meva frontissa", engine: "cup", category: "hinge" })
    expect(r.item.imported!.confirmed).toBe(false)
    expect(r.item.imported!.bbox).toBeDefined()
    expect(r.item.imported!.files.sort()).toEqual(["9071205.stp", "9071205_2D_front_view.dxf", "9071205_2D_side_view.dxf"])
    expect(r.item.imported!.points).toEqual([[0, 0, 0]])
    // Sense confirmar: cap forat al moble.
    expect(doorHoles(r.item)).toEqual([])
  })

  it("una frontissa confirmada no es toca: la proposta nova queda pendent i, aplicada, sense confirmar", () => {
    const ok = setConfirmed(fromStep(hingeP()), true)
    const before = doorHoles(ok)
    expect(before.length).toBeGreaterThan(0)
    const r = mergeImported(ok, fromStep(hingeP(7)), true)
    expect(r.pendingUpdate).toBe(true)
    // Els forats i la confirmació, igual: el moble fa els mateixos forats.
    expect(r.item.targets).toEqual(ok.targets)
    expect(r.item.params).toEqual(ok.params)
    expect(r.item.imported!.confirmed).toBe(true)
    expect(doorHoles(r.item)).toEqual(before)
    expect(r.item.imported!.update).toBeDefined()
    // Passa l'esquema (preferències, mòduls, `.moble`): no es llegeix com a malmès.
    expect(HardwareItemSchema.parse(r.item).imported!.damaged).toBeUndefined()
    // Aplicar-la: els forats nous, sense confirmar (cap forat fins que es torni a confirmar).
    const applied = applyImportUpdate(r.item)
    expect(applied.imported!.update).toBeUndefined()
    expect(applied.imported!.confirmed).toBe(false)
    expect(applied.targets).not.toEqual(ok.targets)
    expect(doorHoles(applied)).toEqual([])
    expect(doorHoles(setConfirmed(applied, true)).filter((h) => h.tag === "hinge-screw").length).toBeGreaterThan(0)
    // Descartar-la: com era.
    expect(dismissImportUpdate(r.item)).toEqual(ok)
  })

  it("la mateixa proposta: res pendent; i la Ø/fondària de la cassoleta compten", () => {
    const ok = setConfirmed(fromStep(hingeP()), true)
    const same = mergeImported(ok, fromStep(hingeP()), true)
    expect(same.pendingUpdate).toBe(false)
    expect(same.item).toEqual(ok)
    expect(mergeImported(ok, fromStep(hingeP(5.5, 12)), true).pendingUpdate).toBe(true)
  })

  it("sense confirmar: si no s'ha editat, els forats nous directament; si s'ha editat, pendent", () => {
    const pending = fromStep(hingeP())
    expect(isUnedited(pending)).toBe(true)
    const r = mergeImported(pending, fromStep(hingeP(7)), true)
    expect(r.pendingUpdate).toBe(false)
    expect(r.upgraded).toBe(true)
    expect(r.item.imported!.update).toBeUndefined()
    expect(r.item.targets).toEqual(fromStep(hingeP(7)).targets)
    const edited = { ...pending, targets: [{ ...pending.targets[0]!, ops: pending.targets[0]!.ops.slice(0, 2) }] }
    expect(isUnedited(edited)).toBe(false)
    const e = mergeImported(edited, fromStep(hingeP(7)), true)
    expect(e.pendingUpdate).toBe(true)
    expect(e.item.targets).toEqual(edited.targets)
  })

  it("la placa aparellada es queda (els forats del lateral són de la placa)", () => {
    const plate = setConfirmed(plateItem(plateP, { ...article([step]), kind: "plate", category: "plate" }, { id: "hw-p", files: [] }), true)
    const h = pairPlate(fromStep(hingeP()), plate)
    const r = mergeImported(h, fromStep(hingeP(7)), true)
    expect(r.item.plate?.id).toBe("hw-p")
    expect(r.item.targets.find((t) => t.key === "side")).toEqual(h.targets.find((t) => t.key === "side"))
  })

  it("un tirador confirmat amb una altra distància al fitxer: pendent, la distància d'ara es queda", () => {
    const hp = (d: number): HardwareProposal => ({ kind: "handle", frame, holes: [{ role: "screw", u: -d / 2, v: 0, d: 5, measured: 4, depth: 0, depthFrom: "default" }, { role: "screw", u: d / 2, v: 0, d: 5, measured: 4, depth: 0, depthFrom: "default" }], bbox: { min: [0, 0, 0], max: [140, 10, 30] }, notes: [] })
    const a = { ...article(["STEP_Griffe/Griffe/Classic/115001.stp"]) }
    const ok = setConfirmed(articleItem(hp(128), a, base, { id: "hw-t", files: [] }), true)
    const fresh = articleItem(hp(160), a, base, { id: "hw-t", files: [] })
    const r = mergeImported(ok, fresh, true)
    expect(r.pendingUpdate).toBe(true)
    expect(r.item.pitch!.else).toBe(128)
    expect(applyImportUpdate(r.item).pitch!.else).toBe(160)
    // Una distància canviada a mà (i confirmada) i el mateix fitxer: no hi ha res de nou per revisar.
    const mine = setConfirmed(setHandleDistance(ok, 130), true)
    expect(mergeImported(mine, articleItem(hp(128), a, base, { id: "hw-t", files: [] }), true).pendingUpdate).toBe(false)
  })

  it("un DXF sobre un que ja té el STEP: només s'hi afegeixen els fitxers i els punts", () => {
    const ok = setConfirmed(fromStep(hingeP()), true)
    const r = mergeImported(ok, fromDxf(), false)
    expect(r.item.targets).toEqual(ok.targets)
    expect(r.item.engine).toBe("cup")
    expect(r.item.imported!.confirmed).toBe(true)
    expect(r.item.imported!.files).toContain("9071205_2D_front_view.dxf")
    expect(r.item.imported!.points).toEqual([[0, 0, 0]])
  })

  it("mecanitzats del generador (DXF del taller): s'afegeixen a un sense confirmar; confirmats, mai es toquen", () => {
    const op = (d: number): GenOp => ({ id: "a", part: "top", kind: "drill", face: "A", d, depth: 12, p: { from: "ref", at: 10 }, q: { from: "ref", at: 30 } })
    // Sense confirmar i sense mecanitzats: els rep.
    const pending = fromStep(hingeP())
    const add = mergeImported(pending, { ...fromStep(hingeP()), machining: [op(5)] }, true)
    expect(add.item.machining).toEqual([op(5)])
    expect(add.item.imported!.confirmed).toBe(false)
    expect(add.pendingUpdate).toBe(false)
    // Confirmat amb mecanitzats: uns altres van a la proposta pendent; els d'ara i els forats es queden.
    const ok = setConfirmed({ ...fromStep(hingeP()), machining: [op(5)] }, true)
    const r = mergeImported(ok, { ...fromStep(hingeP()), machining: [op(8)] }, true)
    expect(r.pendingUpdate).toBe(true)
    expect(r.item.machining).toEqual([op(5)])
    expect(r.item.targets).toEqual(ok.targets)
    expect(r.item.imported!.confirmed).toBe(true)
    expect(r.item.imported!.update!.machining).toEqual([op(8)])
    expect(HardwareItemSchema.parse(r.item).imported!.damaged).toBeUndefined()
    // Aplicar-la: només canvien els mecanitzats (els forats d'ara es queden), sense confirmar.
    const applied = applyImportUpdate(r.item)
    expect(applied.machining).toEqual([op(8)])
    expect(applied.targets).toEqual(ok.targets)
    expect(applied.imported!.confirmed).toBe(false)
    expect(applied.imported!.update).toBeUndefined()
    // Un import sense mecanitzats no treu els que hi ha.
    expect(mergeImported(ok, fromStep(hingeP()), true).item.machining).toEqual([op(5)])
    // Un «només 3D» confirmat amb mecanitzats no es reemplaça per la proposta nova.
    const m3d = setConfirmed({ ...fromDxf(), machining: [op(5)] }, true)
    const r3 = mergeImported(m3d, fromStep(hingeP()), true)
    expect(r3.item.engine).toBe("model")
    expect(r3.item.machining).toEqual([op(5)])
    expect(r3.item.imported!.confirmed).toBe(true)
    // El diàleg diu que un DXF del taller hi afegeix mecanitzats.
    expect(mergePreview([pending], article([step, `${DIR}/9071205_porta.dxf`]))!.adds).toContain("mecanitzats del DXF del taller")
  })

  it("un importat malmès es torna a fer (mateix id i nom), sense confirmar", () => {
    const damaged = HardwareItemSchema.parse({ ...fromStep(hingeP()), name: "Frontissa X", imported: { maker: "Hettich", article: "9071205", confirmed: "sí" } })
    expect(damaged.imported!.damaged).toBe(true)
    const r = mergeImported(damaged, fromStep(hingeP()), true)
    expect(r.item).toMatchObject({ id: "hw-h", name: "Frontissa X", engine: "cup" })
    expect(r.item.imported!.damaged).toBeUndefined()
    expect(r.item.imported!.confirmed).toBe(false)
  })
})

describe("noms dels importats d'abans", () => {
  const legacy = ["ferratges", "DWG_DXF_Schiebetuersysteme", "Schiebetuersysteme", "SlideLine_55"]
  const item = (name: string): HardwareItem => ({ ...fromDxf(), id: "hw-s", name, category: "door-system", imported: { ...fromDxf().imported!, article: "9060402", folders: legacy } })

  it("el nom automàtic d'abans passa al d'ara; el que l'usuari ha canviat es queda", () => {
    expect(legacyHettichLabel(legacy, "9060402")).toBe("Porta corredissa ferratges DWG DXF Schiebetuersysteme SlideLine 55 9060402")
    const auto = item(legacyHettichLabel(legacy, "9060402"))
    const r = migrateImportedNames([auto, item(`${legacyHettichLabel(legacy, "9060402")} 2`), item("El meu perfil")])
    expect(r.changed).toBe(true)
    expect(r.library.map((x) => x.name)).toEqual(["Porta corredissa SlideLine 55 · 9060402", "Porta corredissa SlideLine 55 · 9060402 2", "El meu perfil"])
    // Les carpetes, netes (també la del que no es reanomena).
    expect(r.library.every((x) => x.imported!.folders.join("/") === "Schiebetuersysteme/SlideLine_55")).toBe(true)
    // Idempotent.
    expect(migrateImportedNames(r.library).changed).toBe(false)
    // Un nom d'abans sense brossa (importat d'un ZIP, no d'una carpeta): «Frontissa Sensys 110° recobrent 9071205».
    const h = { ...fromStep(hingeP()), name: "Frontissa Sensys 110° recobrent 9071205", imported: { ...fromStep(hingeP()).imported!, folders: ["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"] } }
    expect(migrateImportedNames([h]).library[0]!.name).toBe("Frontissa Sensys 110° · 9071205")
  })

  it("en llegir les preferències", () => {
    const auto = item(legacyHettichLabel(legacy, "9060402"))
    const res = parseSettings({ ...DEFAULT_SETTINGS, hardwareLibrary: [...DEFAULT_SETTINGS.hardwareLibrary, auto] })
    expect(res.settings.hardwareLibrary.find((x) => x.id === "hw-s")!.name).toBe("Porta corredissa SlideLine 55 · 9060402")
    expect(res.migrated).toBe(true)
    // Les inicials no canvien.
    expect(res.settings.hardwareLibrary.filter((x) => !x.imported)).toEqual(DEFAULT_SETTINGS.hardwareLibrary)
  })
})

describe("caixa del model (boxVersion)", () => {
  const box = (s: number) => ({ min: [0, 0, 0] as [number, number, number], max: [s, s, s] as [number, number, number] })
  it("la feta del model (la del GLB) marca la versió; la d'abans es refà del GLB i, en tornar a importar, passa davant", () => {
    const old = fromStep({ ...hingeP(), bbox: box(10) })
    expect(old.imported?.boxVersion).toBeUndefined()
    expect(needsBoxRepair(old)).toBe(true)
    const fresh = fromStep({ ...hingeP(), bbox: box(20), boxFromMesh: true })
    expect(fresh.imported?.boxVersion).toBe(1)
    expect(needsBoxRepair(fresh)).toBe(false)
    // Tornar a importar: la del model substitueix la dels punts; al revés, no.
    expect(mergeImported(old, fresh, true).item.imported?.bbox).toEqual(box(20))
    expect(mergeImported(fresh, old, true).item.imported).toMatchObject({ bbox: box(20), boxVersion: 1 })
    // Reparació en obrir l'app: amb el model, la seva caixa; sense, es queda com era.
    const fixed = applyBoxRepair([old], new Map([[old.id, box(30)]]))
    expect(fixed.changed).toBe(true)
    expect(fixed.library[0]!.imported).toMatchObject({ bbox: box(30), boxVersion: 1 })
    expect(applyBoxRepair([old], new Map([[old.id, null]]))).toEqual({ library: [old], changed: false })
    expect(applyBoxRepair(fixed.library, new Map([[old.id, box(40)]])).changed).toBe(false)
  })
})
