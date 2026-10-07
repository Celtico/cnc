import { describe, expect, it } from "vitest"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import { buildModule } from "../build/buildModule"
import { DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, ZoneSchema, defaultModule, repairComposition, setFront, switchFront, visibleModule, type Front, type Zone } from "./index"

/**
 * Auditoria de coherència E1: canviar el contingut d'un compartiment no llença el front d'abans. L'últim front de cada
 * tipus es recorda (`Zone.fronts`) i tornar-hi el recupera sencer; els prestatges, la barra i la llum no es toquen.
 */

const kit14 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht14")!
const drawers: Front = { kind: "drawers", n: 4, heights: [150, "auto", "auto", "auto"], hardware: structuredClone(kit14), kit: { closing: "push", back: "metal" }, handle: { ...DEFAULT_MODULE_HARDWARE.handle, id: "hw-t" } }
const start = (): Zone => ({ id: "r", shelves: { n: 2, adjustable: true }, rail: {}, led: {} })

describe("E1: el front de cada tipus es recorda", () => {
  it("calaixos → abatible → calaixos: n, alçades, joc, opcions, ferratge i tirador tornen", () => {
    let z = setFront(start(), "r", drawers)
    z = switchFront(z, "r", "flap")
    expect(z.front).toEqual({ kind: "flap", dir: "down", handle: drawers.handle })
    expect(z.fronts?.drawers).toEqual(drawers)
    z = switchFront(z, "r", "drawers")
    expect(z.front).toEqual(drawers)
    expect(z.fronts?.flap).toEqual({ kind: "flap", dir: "down", handle: drawers.handle })
    expect(z.fronts?.drawers).toBeUndefined()
  })
  it("setFront no toca els prestatges, la barra ni la llum (amb calaixos no es veuen; tornen amb el contingut d'abans)", () => {
    let z = setFront(start(), "r", drawers)
    expect(z.shelves).toEqual({ n: 2, adjustable: true })
    expect(z.rail).toEqual({})
    expect(z.led).toEqual({})
    z = switchFront(z, "r", "none")
    expect(z.front).toBeUndefined()
    expect(z.shelves).toEqual({ n: 2, adjustable: true })
    expect(z.fronts?.drawers).toEqual(drawers)
    // Tornar al mateix tipus no fa res.
    const d = switchFront(z, "r", "drawers")
    expect(switchFront(d, "r", "drawers")).toBe(d)
  })
  it("un tipus mai triat surt en blanc (amb el tirador del front d'abans si en pot portar)", () => {
    let z = setFront(start(), "r", drawers)
    z = switchFront(z, "r", "door")
    expect(z.front).toEqual({ kind: "door", mode: "single", hinge: "left", handle: drawers.handle })
    z = switchFront(z, "r", "grille")
    expect(z.front).toMatchObject({ kind: "grille", mount: "removable" })
    expect(z.fronts && Object.keys(z.fronts).sort()).toEqual(["door", "drawers"])
  })
  it("res amagat compta: els fronts recordats no canvien les peces ni els avisos", () => {
    const m = defaultModule("m1", "M")
    const a = { ...m, root: switchFront(setFront(start(), "r", drawers), "r", "flap") }
    const b = { ...m, root: { ...a.root, fronts: undefined } }
    delete (b.root as Zone).fronts
    expect(visibleModule(a).root.fronts).toBeUndefined()
    const ba = buildModule(a), bb = buildModule(b)
    expect(ba.panels).toEqual(bb.panels)
    expect(ba.warnings).toEqual(bb.warnings)
    expect(ba.extras).toEqual(bb.extras)
    // I cap avís `hardware` pel joc del calaix que ja no és (A5).
    expect(ba.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })
  it("viatja al .moble i torna igual", () => {
    const m = defaultModule("m1", "M")
    const comp = { modules: [{ ...m, root: switchFront(setFront(start(), "r", drawers), "r", "flap") }], references: [] }
    const res = parseMobleFile(mobleToJson(buildMobleFile({ name: "x", composition: comp, references: [] })))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.modules[0]!.root.fronts?.drawers).toEqual(drawers)
    expect(res.warnings).toEqual([])
  })
  it("en llegir: un front recordat sota una altra clau o dolent es treu; la resta es queda (idempotent)", () => {
    const raw = { id: "r", front: { kind: "panel" }, fronts: { drawers: { kind: "door", mode: "single", hinge: "left" }, door: { kind: "door", mode: "single", hinge: "left" }, flap: { kind: "flap", dir: "sideways" } } }
    const once = ZoneSchema.safeParse(raw)
    expect(once.success).toBe(false)
    const m = { ...defaultModule("m1", "M"), root: raw }
    const rep = repairComposition({ modules: [m], references: [] })
    const fronts = rep.composition!.modules[0]!.root.fronts
    expect(fronts).toEqual({ door: { kind: "door", mode: "single", hinge: "left" } })
    const again = repairComposition(rep.composition)
    expect(again.problems).toEqual([])
    expect(again.composition!.modules[0]!.root).toEqual(rep.composition!.modules[0]!.root)
  })
})
