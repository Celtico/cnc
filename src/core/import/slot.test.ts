import { describe, expect, it } from "vitest"
import { buildModule } from "../build/buildModule"
import { DEFAULT_HARDWARE_KIT, HardwareItemSchema, HARDWARE_ROLES, defaultModule, isPlaceable, type HardwareItem, type Module, type Zone } from "../model"
import { groupHettich, hettichFileKind } from "./hettich"
import { applyProposal, articleItem, confirmProblem, proposalPlan, proposeArticle, retargetImported, setConfirmed } from "./importItem"
import { defaultFrame, partialProposal, type HardwareProposal } from "./proposal"
import type { StepFeatures } from "./stepGeometry"

/**
 * **El lloc d'un ferratge importat** (`engine`, «Què és» a l'editor): una frontissa de la carpeta de frontisses és una
 * frontissa encara que el fitxer no en doni el patró (proposta parcial, mai «només 3D»); l'usuari pot canviar el lloc
 * (`retargetImported`) i omplir-ne els números; les regles del mòdul el posen. Els «només 3D» són els únics que es
 * col·loquen a mà.
 */

const base = { hinge: DEFAULT_HARDWARE_KIT.hinge, handle: DEFAULT_HARDWARE_KIT.handle }
const art = (path: string) => groupHettich([{ path, kind: hettichFileKind(path) }])[0]!
/** Un STEP sense cap cilindre: cap patró de forats. */
const noCyl: StepFeatures = { schema: "AP214", unit: 1, cylinders: [], points: [[0, 0, 0], [60, 20, 70]], solids: 1 }

describe("proposta parcial: el tipus se sap, el patró no", () => {
  it("una frontissa sense cassoleta al STEP surt frontissa (motor `cup`) amb els números per defecte, sense confirmar", () => {
    const a = art("STEP_Scharniere/Scharniere/Scharniere_Topf_26mm/Oeffnungswinkel_95/einliegend/72966.stp")
    expect(a.kind).toBe("hinge")
    const p = proposeArticle(a, noCyl)
    expect(p.kind).toBe("hinge")
    expect(p.partial).toBe(true)
    expect(p.holes).toEqual([])
    expect(p.frame).toEqual(defaultFrame("hinge"))
    expect(proposalPlan(p)).toMatch(/^Frontissa · sense patró/)
    const item = articleItem(p, a, base, { id: "hw-1", files: ["72966.stp"] })
    expect(item.engine).toBe("cup")
    expect(item.category).toBe("hinge")
    expect(item.params).toMatchObject({ cupDiameter: 35, cupDepth: 13, cupOffset: DEFAULT_HARDWARE_KIT.hinge.params.cupOffset })
    expect(item.targets[0]!.ops).toHaveLength(1)
    expect(item.imported).toMatchObject({ confirmed: false, frameFrom: "file" })
    expect(item.imported!.notes!.join(" ")).toMatch(/Entra la cassoleta i els cargols a l'editor/)
    // Es pot confirmar un cop revisada (la cassoleta hi és) i va al lloc de la frontissa: les regles la posen.
    expect(confirmProblem(item)).toBeNull()
    expect(isPlaceable(item)).toBe(false)
  })
  it("un tirador sense patró: el tirador de l'app (dos forats, distància per regla); una pota o una placa, sense forats fins que s'entren", () => {
    const handle = articleItem(partialProposal("handle", noCyl, "Res."), art("STEP_Griffe/Griffe/Classic/9070102.stp"), base, { id: "hw-h", files: [] })
    expect(handle.engine).toBe("barHandle")
    expect(handle.targets[0]!.ops).toHaveLength(2)
    expect(handle.pitch).toEqual(DEFAULT_HARDWARE_KIT.handle.pitch)
    const leg = articleItem(partialProposal("leg", noCyl, "Res."), art("STEP_Moebelfuesse/Moebelfuesse/Stahl_Moebelfuesse/1225.stp"), base, { id: "hw-l", files: [] })
    expect(leg.engine).toBe("leg")
    expect(confirmProblem(leg)).toMatch(/no té cap forat/)
    const plate = articleItem(partialProposal("plate", noCyl, "Res."), art("STEP_Scharniere/Scharniere/Montageplatten/System_8099/Zum_Einpressen/9071615.stp"), base, { id: "hw-p", files: [] })
    expect(plate.engine).toBe("plate")
    expect(confirmProblem(plate)).toMatch(/no té cap forat/)
  })
  it("els items parcials passen l'esquema (no són «malmesos»)", () => {
    const item = articleItem(partialProposal("hinge", noCyl, "Res."), art("STEP_Scharniere/Scharniere/Sensys/Oeffnungswinkel_110/aufliegend/9071205.stp"), base, { id: "hw-1", files: [] })
    const parsed = HardwareItemSchema.parse(item) as HardwareItem
    expect(parsed.imported?.damaged).toBeUndefined()
    expect(parsed.imported?.mountFrame).toEqual(defaultFrame("hinge"))
  })
})

const only3d: HardwareItem = {
  id: "hw-m",
  name: "Frontissa CLIP top · 71T453T",
  category: "hinge",
  engine: "model",
  maker: "Blum",
  ref: "71T453T",
  params: {},
  targets: [{ key: "model", label: "Només 3D", ops: [] }],
  version: 1,
  machining: [{ id: "pgm0", part: "front", kind: "drill", face: "A", d: 10, depth: 6, p: { from: "min", at: 0 }, q: { from: "min", at: -16 } }],
  imported: { maker: "Blum", article: "71T453T", folders: [], files: ["71T453T_46020103.step"], asset: "hwa-x", bbox: { min: [-48, -22, -38], max: [-2, 22, 44] }, proposed: [{ key: "model", label: "Només 3D", ops: [] }], notes: [], confirmed: false },
}

describe("canviar «què és» (retargetImported)", () => {
  it("un «només 3D» passa a frontissa: motor cup, números de la frontissa d'inici, sense confirmar; es queden la identitat, el model i els mecanitzats del generador", () => {
    const h = retargetImported(only3d, "cup")
    expect(h).toMatchObject({ id: "hw-m", name: only3d.name, maker: "Blum", ref: "71T453T", engine: "cup", category: "hinge" })
    expect(h.params).toEqual(DEFAULT_HARDWARE_KIT.hinge.params)
    expect(h.count).toEqual(DEFAULT_HARDWARE_KIT.hinge.count)
    expect(h.targets).toEqual(DEFAULT_HARDWARE_KIT.hinge.targets)
    expect(h.imported).toMatchObject({ asset: "hwa-x", bbox: only3d.imported!.bbox, confirmed: false, proposed: DEFAULT_HARDWARE_KIT.hinge.targets, proposedParams: { cupDiameter: 35, cupDepth: 13 } })
    expect(h.machining).toEqual(only3d.machining)
    // Ja no es col·loca a mà: el posen les regles.
    expect(isPlaceable(h)).toBe(false)
    expect(confirmProblem(h)).toBeNull()
    // I torna: el mateix motor, el mateix item.
    expect(retargetImported(h, "cup")).toBe(h)
    expect(retargetImported(h, "model")).toMatchObject({ engine: "model", category: "misc", params: {}, targets: only3d.targets })
  })
  it("cada motor té el seu lloc: placa i pota sense forats (s'entren), guia amb llargades, filera amb pas", () => {
    expect(retargetImported(only3d, "plate")).toMatchObject({ engine: "plate", category: "plate", params: { setback: 37, offset: 0 }, targets: [{ key: "side", ops: [] }] })
    expect(retargetImported(only3d, "leg")).toMatchObject({ engine: "leg", category: "leg", params: { inset: 50 }, targets: [{ key: "base", ops: [] }] })
    const slide = retargetImported(only3d, "slide")
    expect(slide.engine).toBe("slide")
    expect(slide.lengths).toEqual(DEFAULT_HARDWARE_KIT.slide.lengths)
    expect(retargetImported(only3d, "system32").params).toEqual(DEFAULT_HARDWARE_KIT.system32.params)
    expect(retargetImported(only3d, "barHandle").pitch).toEqual(DEFAULT_HARDWARE_KIT.handle.pitch)
    // Una frontissa que deixa de ser-ho perd la placa aparellada.
    const hinge = { ...retargetImported(only3d, "cup"), plate: { id: "pl", name: "Placa" } }
    expect(retargetImported(hinge, "barHandle").plate).toBeUndefined()
    // Un que no és importat no canvia.
    expect(retargetImported(DEFAULT_HARDWARE_KIT.hinge, "plate")).toBe(DEFAULT_HARDWARE_KIT.hinge)
  })
  it("tots els llocs de «Què és» són motors de l'app, amb la categoria de la biblioteca que toca", () => {
    for (const r of HARDWARE_ROLES) {
      const it = retargetImported(only3d, r.engine)
      expect(it.engine).toBe(r.engine)
      if (r.engine !== only3d.engine) expect(it.category).toBe(r.category)
      expect(HardwareItemSchema.safeParse(it).success).toBe(true)
    }
  })
  it("la proposta estimada de la malla s'aplica al nou lloc: forats, números, caixa, marc i notes, sense confirmar", () => {
    const h = retargetImported(only3d, "cup")
    const p: HardwareProposal = {
      kind: "hinge",
      frame: { origin: [-27, 0, 38.5], u: [0, 1, 0], v: [1, 0, 0], n: [0, 0, -1] },
      holes: [
        { role: "cup", u: 0, v: 0, d: 35, measured: 0, depth: 13, depthFrom: "default" },
        { role: "dowel", u: -16, v: 0, d: 10, measured: 9.85, depth: 6, depthFrom: "file" },
        { role: "dowel", u: 16, v: 0, d: 10, measured: 9.85, depth: 6, depthFrom: "file" },
      ],
      bbox: { min: [-22, -21, -6], max: [22, 25, 77] },
      boxFromMesh: true,
      notes: ["Marc estimat del model 3D."],
      frameFrom: "mesh",
    }
    const out = applyProposal(h, p, base)
    expect(out.engine).toBe("cup")
    expect(out.targets[0]!.ops.map((o) => (o.kind === "drill" ? [o.u, o.v, o.d, o.depth, o.tag] : []))).toEqual([
      [0, "cupOffset", "cupDiameter", "cupDepth", "hinge"],
      [-16, "cupOffset", 10, 6, "hinge-dowel"],
      [16, "cupOffset", 10, 6, "hinge-dowel"],
    ])
    expect(out.params).toMatchObject({ cupDiameter: 35, cupDepth: 13 })
    expect(out.imported).toMatchObject({ confirmed: false, bbox: p.bbox, boxVersion: 1, frameFrom: "mesh", notes: p.notes, proposed: out.targets })
    // Una proposta d'un altre tipus no s'aplica.
    expect(applyProposal(h, { ...p, kind: "plate" }, base)).toBe(h)
  })
  it("confirmada, les regles del mòdul la posen a la porta (cassoletes a la filera) com qualsevol frontissa", () => {
    const hinge = setConfirmed(retargetImported(only3d, "cup"), true)
    const m: Module = defaultModule("m1", "Armari")
    const door: Zone = { ...m.root, front: { kind: "door", hinge: "left" } } as Zone
    const built = buildModule({ ...m, root: door, hardware: { ...m.hardware, hinge } })
    const doorPanel = built.panels.find((p) => p.role === "door")!
    const cups = doorPanel.holes.filter((h) => h.tag === "hinge")
    expect(cups.length).toBeGreaterThanOrEqual(2)
    expect(cups[0]!.diameter).toBe(35)
    // I el model 3D a cada cassoleta (el GLB de l'asset, al marc de muntatge).
    expect(doorPanel.fittings?.filter((f) => f.asset === "hwa-x")).toHaveLength(cups.length)
    expect(built.warnings.some((w) => w.code === "hardware")).toBe(false)
  })
})
