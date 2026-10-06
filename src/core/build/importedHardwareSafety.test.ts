import { describe, expect, it } from "vitest"
import { confirmProblem, hingeItem, pairImportedBatch, pairPlate, plateItem, setConfirmed, setHardwareParam, syncPairedPlates } from "../import/importItem"
import type { HettichArticle } from "../import/hettich"
import type { HardwareProposal } from "../import/proposal"
import {
  DEFAULT_HARDWARE_KIT,
  DEFAULT_SETTINGS,
  HardwareItemSchema,
  defaultModule,
  parseSettings,
  repairComposition,
  type Composition,
  type HardwareItem,
  type Module,
  type Panel,
  type Zone,
} from "../model"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { MIN_FITTING_DEPTH } from "./holeClash"
import { slotSpec } from "./hardware"

/**
 * Ferratges importats: mai foraden sense haver-se revisat ni a mitges («res surt de les peces / mai mig ferratge»). Els
 * casos que va trobar la revisió (dades malmeses, errors del motor, plaques a banda i banda d'un divisor, plaques massa
 * fondes o a la unió amb la base, portes baixes, fronts encastats, mòduls sense lateral) i la placa per referència.
 */

const frame = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], n: [0, 1, 0] } as HardwareProposal["frame"]
const hingeProposal: HardwareProposal = {
  kind: "hinge",
  frame,
  holes: [
    { role: "cup", u: 0, v: 0, d: 35, measured: 35, depth: 13, depthFrom: "file" },
    { role: "screw", u: -26, v: 5.5, d: 5, measured: 5, depth: 10, depthFrom: "default" },
    { role: "screw", u: 26, v: 5.5, d: 5, measured: 5, depth: 10, depthFrom: "default" },
  ],
  bbox: { min: [0, 0, 0], max: [1, 1, 1] },
  notes: [],
}
const plateProposal = (holes: [number, number, number, number][]): HardwareProposal => ({
  kind: "plate",
  frame,
  holes: holes.map(([u, v, d, depth]) => ({ role: "dowel", u, v, d, measured: d, depth, depthFrom: "file" })),
  bbox: { min: [0, 0, 0], max: [1, 1, 1] },
  notes: [],
})
const art = (a: string, k: "hinge" | "plate"): HettichArticle => ({ article: a, folders: ["x"], category: k, tags: [], label: `${k} ${a}`, group: "", kind: k, files: [] })
const hinge = hingeItem(hingeProposal, art("1", "hinge"), DEFAULT_HARDWARE_KIT.hinge, { id: "hw-h", files: [] })
const plate = setConfirmed(plateItem(plateProposal([[-16, 0, 10, 11.5], [16, 0, 10, 11.5]]), art("2", "plate"), { id: "hw-p", files: [] }), true)
const confirmed = setConfirmed(pairPlate(hinge, plate), true)

const comp = (m: Module): Composition => ({ modules: [m], references: [] }) as unknown as Composition
const door = (h: HardwareItem, side: "left" | "right" = "left"): Zone => ({ id: "r", front: { kind: "door", mode: "single", hinge: side, hardware: h } }) as Zone
const mod = (h: HardwareItem, size = { width: 500, height: 720, depth: 560 }): Module => ({ ...defaultModule("m", "x", size), root: door(h) })
const tagged = (panels: Panel[], re: RegExp) => panels.flatMap((p) => p.holes.filter((h) => re.test(h.tag ?? "")).map((h) => ({ panel: p, ...h })))
const hingeHoles = (panels: Panel[]) => tagged(panels, /^hinge/)
const plateHoles = (panels: Panel[]) => tagged(panels, /^plate$/)

describe("importat malmès: inert, mai una frontissa que forada", () => {
  const mutations: [string, (h: Record<string, any>) => void][] = [
    ["sense confirmed", (h) => delete h.imported.confirmed],
    ["confirmed que no és booleà", (h) => (h.imported.confirmed = "sí")],
    ["maker que no és text", (h) => (h.imported.maker = 5)],
    ["files que no és llista", (h) => (h.imported.files = "x")],
    ["bbox amb null (NaN desat com a JSON)", (h) => (h.imported.bbox.min[0] = null)],
    ["un mecanitzat proposat dolent", (h) => (h.imported.proposed[0].ops[1].depth = null)],
    ["un mecanitzat del target dolent", (h) => (h.targets[0].ops[1].d = null)],
    ["imported null", (h) => (h.imported = null)],
  ]
  for (const [label, mut] of mutations) {
    const raw = () => {
      const r = JSON.parse(JSON.stringify(confirmed)) as Record<string, any>
      mut(r)
      return r
    }
    it(`${label}: al mòdul, al front, a les preferències`, () => {
      // Mòdul (kit) i front: es llegeix inert i no fa cap forat (ni la placa); avís «malmès».
      const m = { ...defaultModule("m", "x", { width: 500, height: 720, depth: 560 }), root: { id: "r", front: { kind: "door", mode: "single", hinge: "left" } } as Zone }
      const asKit = JSON.parse(JSON.stringify(comp({ ...m, hardware: { ...m.hardware, hinge: confirmed } })))
      asKit.modules[0].hardware.hinge = raw()
      const asFront = JSON.parse(JSON.stringify(comp(mod(confirmed))))
      asFront.modules[0].root.front.hardware = raw()
      for (const data of [asKit, asFront]) {
        const rep = repairComposition(data)
        expect(rep.composition).toBeTruthy()
        const b = buildComposition(rep.composition!)
        expect(hingeHoles(b.panels)).toEqual([])
        expect(plateHoles(b.panels)).toEqual([])
        expect(b.warnings.some((w) => w.code === "hardware" && /ferratge importat malmès: no es mecanitza/.test(w.message))).toBe(true)
      }
      // Preferències: l'item es queda a la biblioteca (inert, malmès), no es descarta ni es repara a mitges.
      const s = parseSettings({ ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), hardwareLibrary: [...DEFAULT_SETTINGS.hardwareLibrary, raw()] })
      const got = s.settings.hardwareLibrary.find((x) => x.id === "hw-h")!
      expect(got.imported).toMatchObject({ damaged: true, confirmed: false })
      expect(got.targets.flatMap((t) => t.ops)).toEqual([])
      expect(confirmProblem(got)).toMatch(/malmès/)
    })
  }

  it("un importat que passa l'esquema es llegeix tal qual; un que no és importat es repara camp a camp com sempre", () => {
    expect(HardwareItemSchema.parse(confirmed)).toEqual(confirmed)
    const builtin = JSON.parse(JSON.stringify(DEFAULT_HARDWARE_KIT.hinge))
    builtin.params.endOffset = "x"
    const m = JSON.parse(JSON.stringify(comp(defaultModule("m", "x", { width: 500, height: 720, depth: 560 }))))
    m.modules[0].hardware.hinge = builtin
    const rep = repairComposition(m)
    expect(rep.composition!.modules[0]!.hardware.hinge.imported).toBeUndefined()
    expect(rep.composition!.modules[0]!.hardware.hinge.params.endOffset).toBe(DEFAULT_HARDWARE_KIT.hinge.params.endOffset)
  })
})

describe("importat amb un error del motor: cap forat, mai la frontissa d'inici", () => {
  for (const [label, item] of [
    ["sense confirmar", { ...hinge, targets: [{ ...hinge.targets[0]!, ops: hinge.targets[0]!.ops.map((o, i) => (i === 1 ? { ...o, d: 0 } : o)) }] }],
    ["confirmat", setConfirmed({ ...hinge, targets: [{ ...hinge.targets[0]!, ops: hinge.targets[0]!.ops.map((o, i) => (i === 1 ? { ...o, d: "nope*2" } : o)) }] }, true)],
    ["confirmat sense paràmetre", setConfirmed({ ...hinge, params: { ...hinge.params, cupOffset: Number.NaN } }, true)],
  ] as [string, HardwareItem][])
    it(label, () => {
      expect(slotSpec("hinge", item).failed).toBe(true)
      expect(slotSpec("hinge", item).spec).toMatchObject({ pending: true })
      // Al front i com a frontissa del mòdul.
      for (const m of [mod(item), { ...mod(confirmed), root: { id: "r", front: { kind: "door", mode: "single", hinge: "left" } } as Zone, hardware: { ...DEFAULT_HARDWARE_KIT, hinge: item } }]) {
        const b = buildModule(m)
        const d = b.panels.find((p) => p.role === "door")!
        expect(d.holes).toEqual([])
        expect(b.warnings.some((w) => w.code === "hardware" && w.message.includes(`«${item.name}»`))).toBe(true)
      }
    })

  it("un ferratge normal que falla al front continua fent servir el del mòdul", () => {
    const bad = { ...DEFAULT_HARDWARE_KIT.hinge, id: "x", params: { ...DEFAULT_HARDWARE_KIT.hinge.params, cupOffset: Number.NaN } }
    const d = buildModule(mod(bad)).panels.find((p) => p.role === "door")!
    expect(d.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
  })
})

describe("la placa al lateral", () => {
  const world = (p: Panel, h: { x: number; y: number; face: string }) => toWorld(p, [h.x, h.y, h.face === "A" ? p.thickness : 0])

  it("a banda i banda d'un divisor: s'escurcen amb avís, mai per sota del mínim", () => {
    const base = defaultModule("m", "x", { width: 900, height: 720, depth: 560 })
    const two = (h: HardwareItem, t?: number): Module => ({
      ...base,
      ...(t ? { carcass: { ...base.carcass, thickness: t } } : {}),
      root: { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ ...door(h, "right"), id: "a" }, { ...door(h, "left"), id: "b" }] } } as unknown as Zone,
    })
    const b = buildComposition(comp(two(confirmed)))
    const div = b.panels.find((p) => p.role === "divider")!
    const holes = div.holes.filter((h) => h.tag === "plate")
    expect(holes).toHaveLength(8)
    expect(holes.every((h) => h.depth === 9 && h.depth >= MIN_FITTING_DEPTH)).toBe(true)
    expect(b.warnings.filter((w) => w.code === "hole-clash" && /placa/.test(w.message)).length).toBe(4)
    // Divisor de 16: (16 − 1)/2 = 7 < 8 → no es toquen i l'avís ho diu clar.
    const thin = buildComposition(comp(two(confirmed, 16)))
    const dt = thin.panels.find((p) => p.role === "divider")!
    expect(dt.holes.filter((h) => h.tag === "plate").every((h) => h.depth === 11.5)).toBe(true)
    expect(thin.warnings.some((w) => w.code === "hole-clash" && /no es poden escurçar prou/.test(w.message))).toBe(true)
  })

  it("System 32 contra System 32 a un divisor: com sempre, sense avís", () => {
    const base = defaultModule("m", "x", { width: 900, height: 720, depth: 560 })
    const b = buildComposition(comp({ ...base, root: { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", shelves: { n: 2, adjustable: true } }, { id: "b", shelves: { n: 2, adjustable: true } }] } } as unknown as Zone }))
    expect(b.warnings.filter((w) => w.code === "hole-clash")).toEqual([])
  })

  it("més fonda que el lateral: a gruix − 1 i avís", () => {
    const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })
    const b = buildModule({ ...base, carcass: { ...base.carcass, thickness: 10 }, root: door(confirmed) })
    const side = b.panels.find((p) => p.id === "side-left")!
    const holes = side.holes.filter((h) => h.tag === "plate")
    expect(holes.length).toBe(4)
    expect(holes.every((h) => h.depth === 9)).toBe(true)
    expect(b.warnings.some((w) => w.code === "hinge" && /massa fondo/.test(w.message))).toBe(true)
  })

  it("portes baixes: tot el patró (cassoleta i cargols, placa) dins de les peces o res d'aquella frontissa", () => {
    for (let H = 100; H <= 400; H += 10) {
      const b = buildComposition(comp(mod(confirmed, { width: 400, height: H, depth: 400 })))
      const d = b.panels.find((p) => p.role === "door")
      if (!d) continue
      for (const h of d.holes) {
        expect(h.x - h.diameter / 2).toBeGreaterThanOrEqual(0)
        expect(h.x + h.diameter / 2).toBeLessThanOrEqual(d.length)
      }
      // Tantes plaques com cassoletes (2 forats cadascuna): mai mitja frontissa.
      const cups = d.holes.filter((h) => h.tag === "hinge").length
      const side = b.panels.find((p) => p.id.endsWith("side-left"))!
      const plates = side.holes.filter((h) => h.tag === "plate")
      expect(plates.length).toBe(cups * 2)
      // Cap forat de la placa a la unió amb la base o la tapa.
      const bottom = b.panels.find((p) => p.role === "bottom")!
      const top = b.panels.find((p) => p.role === "top")!
      const [yb0, yb1] = [0, bottom.thickness].map((z) => toWorld(bottom, [0, 0, z])[1]).sort((a, b) => a - b)
      const yt0 = Math.min(...[0, top.thickness].map((z) => toWorld(top, [0, 0, z])[1]))
      for (const h of plates) {
        const y = world(side, h)[1]
        expect(y - h.diameter / 2 >= yb1! || y + h.diameter / 2 <= yb0!).toBe(true)
        expect(y + h.diameter / 2).toBeLessThanOrEqual(yt0)
      }
      if (cups < 2) expect(b.warnings.some((w) => w.code === "hinge")).toBe(true)
    }
  })

  it("fronts encastats: la placa un gruix de front més endins (37 des del darrere de la porta)", () => {
    const over = buildModule(mod(confirmed))
    const ins = buildModule({ ...mod(confirmed), fronts: { ...mod(confirmed).fronts, style: "inset" } })
    const z = (b: ReturnType<typeof buildModule>) => [...new Set(b.panels.find((p) => p.id === "side-left")!.holes.filter((h) => h.tag === "plate").map((h) => world(b.panels.find((p) => p.id === "side-left")!, h)[2]))]
    expect(z(over)).toEqual([560 - 37])
    expect(z(ins)).toEqual([560 - 19 - 37])
  })

  it("sense lateral a les frontisses: avís de la placa (i la porta fa les cassoletes)", () => {
    const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })
    const b = buildModule({ ...base, carcass: { ...base.carcass, sides: { left: false, right: true } }, root: door(confirmed) })
    expect(plateHoles(b.panels)).toEqual([])
    expect(b.warnings.some((w) => w.code === "hinge" && /placa/.test(w.message) && /no en té/.test(w.message))).toBe(true)
  })
})

describe("placa aparellada per referència", () => {
  it("la frontissa agafa els forats de la placa d'ara i torna a quedar sense confirmar", () => {
    const edited = { ...plate, targets: [{ ...plate.targets[0]!, ops: plate.targets[0]!.ops.map((o) => ({ ...o, depth: 12 })) }] }
    const lib = syncPairedPlates([confirmed, edited])
    const h = lib[0]!
    expect(h.targets.find((t) => t.key === "side")!.ops.every((o) => o.kind === "drill" && o.depth === 12)).toBe(true)
    expect(h.imported!.confirmed).toBe(false)
    // Sense canvis, la mateixa llista.
    const same = [confirmed, plate]
    expect(syncPairedPlates(same)).toBe(same)
    // La placa eliminada: la instantània es queda.
    expect(syncPairedPlates([confirmed])[0]).toBe(confirmed)
  })

  it("un lot amb una sola placa s'aparella; amb dues, cap", () => {
    const p2 = plateItem(plateProposal([[-16, 0, 5, 12], [16, 0, 5, 12]]), art("3", "plate"), { id: "hw-p2", files: [] })
    const one = pairImportedBatch([hinge, plate])
    expect(one).toMatchObject({ paired: 1, plates: 1 })
    expect(one.items[0]!.plate?.id).toBe("hw-p")
    const two = pairImportedBatch([hinge, plate, p2])
    expect(two).toMatchObject({ paired: 0, plates: 2 })
    expect(two.items[0]!.plate).toBeUndefined()
  })

  it("no es confirma una frontissa amb la placa sense confirmar; ni una placa sense forats", () => {
    const pending = setConfirmed(plate, false)
    const h = pairPlate(hinge, pending)
    expect(confirmProblem(h, [h, pending])).toMatch(/placa .* encara no està confirmada/)
    expect(confirmProblem(h, [h, plate])).toBeNull()
    const empty = plateItem(plateProposal([]), art("4", "plate"), { id: "hw-p4", files: [] })
    expect(confirmProblem(empty)).toMatch(/cap forat/)
  })

  it("canviar el Ø o la fondària de la cassoleta o on va la placa d'un importat el desconfirma", () => {
    for (const key of ["cupDiameter", "cupDepth", "plateSetback", "plateOffset"]) expect(setHardwareParam(confirmed, key, 3).imported!.confirmed).toBe(false)
    expect(setHardwareParam(confirmed, "endOffset", 120).imported!.confirmed).toBe(true)
    expect(setHardwareParam(DEFAULT_HARDWARE_KIT.hinge, "cupDepth", 12).params.cupDepth).toBe(12)
  })
})
