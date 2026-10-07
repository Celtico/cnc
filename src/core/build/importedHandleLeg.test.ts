import { describe, expect, it } from "vitest"
import { confirmProblem, handleItem, legItem, modelItem, setConfirmed, setHandleDistance, setHardwareParam } from "../import/importItem"
import type { HettichArticle } from "../import/hettich"
import { modelProposal, type HardwareProposal } from "../import/proposal"
import { DEFAULT_MODULE_HARDWARE, HardwareItemSchema, ModuleSchema, defaultModule, usesImportedHardware, visibleModule, type HardwareItem, type Module, type Panel, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { hardwareMount, mountCamera, mountPlan } from "./hardwareMount"
import { hardwarePreview } from "./hardwarePreview"

/**
 * Tiradors i potes importats (Hettich `Griffe` i `Moebelfuesse`) al moble, i els «només 3D»: un tirador confirmat posa
 * els forats a la seva distància al front que el tria (porta, calaix, abatible) amb la regla de sempre; sense confirmar,
 * cap forat i avís. Una pota confirmada fa els forats de la placa a la cara de sota de la base, a cada pota. Un «només 3D»
 * mai fa cap forat, el posis on el posis.
 */

const art = (article: string, kind: HettichArticle["kind"], category: HettichArticle["category"]): HettichArticle => ({ article, folders: [], category, tags: [], label: `${kind} ${article}`, group: "", kind, files: [] })
const handleFrame = { origin: [64, 0, 0], u: [1, 0, 0], v: [0, 0, -1], n: [0, -1, 0] } as HardwareProposal["frame"]
const handleProposal = (dist: number, d = 5): HardwareProposal => ({
  kind: "handle",
  frame: handleFrame,
  holes: dist ? [-dist / 2, dist / 2].map((u) => ({ role: "hole" as const, u, v: 0, d, measured: 4, depth: 0, depthFrom: "default" as const })) : [{ role: "hole", u: 0, v: 0, d, measured: 4, depth: 0, depthFrom: "default" }],
  bbox: { min: [-dist / 2 - 6, -10, 0], max: [dist / 2 + 6, 10, 35] },
  notes: [],
})
const handle = (dist: number, id = `hw-t${dist}`) => handleItem(handleProposal(dist), art(String(dist), "handle", "handle"), DEFAULT_MODULE_HARDWARE.handle, { id, asset: "hwa-t", files: [] })
const h160 = setConfirmed(handle(160), true)
const knob = setConfirmed(handle(0, "hw-knob"), true)

const legProposal: HardwareProposal = {
  kind: "leg",
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] },
  holes: [
    [-22.5, -22.5],
    [-22.5, 22.5],
    [22.5, -22.5],
    [22.5, 22.5],
  ].map(([u, v]) => ({ role: "screw" as const, u: u!, v: v!, d: 2.5, measured: 4, depth: 12, depthFrom: "default" as const })),
  bbox: { min: [-30, -30, 0], max: [30, 30, 100] },
  notes: [],
}
const leg = legItem(legProposal, art("1225", "leg", "leg"), { id: "hw-leg", asset: "hwa-l", files: [] })
const legOk = setConfirmed(leg, true)
const only3d = modelItem(modelProposal(null, ["Només 3D: sense forats"]), art("9309751", "model", "table"), { id: "hw-3d", asset: "hwa-3", files: [] })

const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })
const withFront = (front: NonNullable<Zone["front"]>, m: Module = base): Module => ({ ...m, root: { id: "r", front } as Zone })
const handles = (p: Panel) => (p.cutouts ?? []).filter((c): c is Extract<NonNullable<Panel["cutouts"]>[number], { kind: "circle" }> => c.kind === "circle" && c.tag === "handle")
const front = (b: ReturnType<typeof buildModule>, role: Panel["role"]) => b.panels.find((p) => p.role === role)!
const gap = (cs: { x: number; y: number }[]) => Math.hypot(cs[1]!.x - cs[0]!.x, cs[1]!.y - cs[0]!.y)

describe("tirador importat", () => {
  it("passa l'esquema, entra sense confirmar i porta la distància del fitxer (sense graons)", () => {
    const t = handle(128)
    expect(HardwareItemSchema.safeParse(t).success).toBe(true)
    expect(t).toMatchObject({ engine: "barHandle", category: "handle", pitch: { steps: [], else: 128 }, params: { diameter: 5 } })
    expect(t.imported!.confirmed).toBe(false)
    expect(confirmProblem(t)).toBeNull()
    expect(hardwarePreview(t).panels.map((p) => gap(handles(p)))).toEqual([128, 128])
  })

  it("confirmat, a la porta: dos forats passants a 160 entre centres, al lloc del tirador de sempre", () => {
    const b = buildModule(withFront({ kind: "door", mode: "single", hinge: "left", handle: h160 }))
    const ref = buildModule(withFront({ kind: "door", mode: "single", hinge: "left" }))
    const door = front(b, "door")
    const hs = handles(door)
    expect(hs).toHaveLength(2)
    expect(gap(hs)).toBeCloseTo(160)
    expect(hs.every((c) => c.diameter === 5)).toBe(true)
    // El mateix centre que el tirador de l'app (a `inset` del cantell que obre, a mitja alçada).
    const mid = (cs: { x: number; y: number }[]) => [(cs[0]!.x + cs[1]!.x) / 2, (cs[0]!.y + cs[1]!.y) / 2]
    expect(mid(hs)).toEqual(mid(handles(front(ref, "door"))))
    expect(gap(handles(front(ref, "door")))).toBe(128)
    // El model del tirador a la cara de fora del front (la que mira cap al davant).
    expect(door.fittings).toEqual([expect.objectContaining({ kind: "handle", asset: "hwa-t" })])
    const f = door.fittings![0]!
    const n = toWorld(door, [0, 0, f.face === "A" ? 1 : -1])
    const o = toWorld(door, [0, 0, 0])
    expect(n[2] - o[2]).toBeGreaterThan(0)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
  })

  it("confirmat, al calaix i a l'abatible: la mateixa distància (no la de l'espai)", () => {
    const drawer = buildModule(withFront({ kind: "drawers", n: 2, heights: ["auto", "auto"], handle: h160 }))
    const fronts = drawer.panels.filter((p) => p.role === "drawerFront")
    expect(fronts).toHaveLength(2)
    for (const p of fronts) expect(gap(handles(p))).toBeCloseTo(160)
    const flap = buildModule(withFront({ kind: "flap", dir: "down", handle: h160 }))
    expect(gap(handles(front(flap, "flap")))).toBeCloseTo(160)
    // Un calaix estret on el tirador de 160 no hi cap: cap forat i l'avís de sempre.
    const narrow = buildModule(withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: setConfirmed(handle(320), true) }, defaultModule("n", "x", { width: 300, height: 200, depth: 500 })))
    expect(handles(front(narrow, "drawerFront"))).toEqual([])
    expect(narrow.warnings.some((w) => w.code === "handle")).toBe(true)
  })

  it("un pom (un sol forat): un forat al centre", () => {
    const b = buildModule(withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: knob }))
    const p = front(b, "drawerFront")
    const hs = handles(p)
    expect(hs).toHaveLength(1)
    expect(hs[0]).toMatchObject({ x: p.length / 2, y: p.width / 2, diameter: 5 })
  })

  it("sense confirmar: cap forat del tirador (ni el de l'app) i un avís; confirmar-lo els fa", () => {
    const pending = handle(160)
    for (const f of [
      { kind: "door", mode: "single", hinge: "left", handle: pending },
      { kind: "drawers", n: 1, heights: ["auto"], handle: pending },
      { kind: "flap", dir: "up", handle: pending },
    ] as NonNullable<Zone["front"]>[]) {
      const b = buildModule(withFront(f))
      const p = b.panels.find((x) => x.role === "door" || x.role === "drawerFront" || x.role === "flap")!
      expect(handles(p)).toEqual([])
      expect(p.fittings ?? []).toEqual([])
      expect(b.warnings.some((w) => w.code === "hardware" && /no està confirmat/.test(w.message))).toBe(true)
      // No passa a push (els fronts tenen tirador, només que encara no s'ha revisat).
      expect(p.push).toBeUndefined()
    }
    // Com a tirador de tot el mòdul (Fusteria), igual.
    const kit = buildModule({ ...withFront({ kind: "drawers", n: 1, heights: ["auto"] }), hardware: { ...base.hardware, handle: pending } })
    expect(handles(front(kit, "drawerFront"))).toEqual([])
    expect(kit.warnings.some((w) => w.code === "hardware")).toBe(true)
  })

  it("canviar la distància o el Ø el deixa sense confirmar; una distància absurda no es confirma", () => {
    expect(setHandleDistance(h160, 192)).toMatchObject({ pitch: { else: 192 }, imported: { confirmed: false } })
    expect(setHardwareParam(h160, "diameter", 6).imported!.confirmed).toBe(false)
    expect(setHardwareParam(h160, "margin", 4).imported!.confirmed).toBe(true)
    expect(confirmProblem(setHandleDistance(handle(160), 4))).toMatch(/Distància/)
  })

  it("malmès o que fa fallar el motor: cap forat, mai el tirador del mòdul", () => {
    const broken = { ...h160, targets: [{ key: "front", label: "Front", ops: [{ kind: "through" as const, u: "pitch/0+", v: 0, d: "diameter", tag: "handle" }] }] }
    const b = buildModule(withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: broken }))
    expect(handles(front(b, "drawerFront"))).toEqual([])
    expect(b.warnings.some((w) => w.code === "hardware" && /tirador importat/.test(w.message))).toBe(true)
    // Llegit d'un fitxer amb un camp dolent: inert (malmès), cap forat.
    const parsed = ModuleSchema.parse(withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: { ...h160, params: { ...h160.params, diameter: "x" } } as unknown as HardwareItem }))
    const pb = buildModule(parsed)
    expect(handles(front(pb, "drawerFront"))).toEqual([])
    expect(pb.warnings.some((w) => /malmès/.test(w.message))).toBe(true)
  })

  it("porta de vidre: el tirador triat no surt ni compta; mòdul push: el per defecte és cap, el tirador del front mana", () => {
    const glass = withFront({ kind: "door", mode: "single", hinge: "left", glass: true, handle: h160 })
    expect(visibleModule(glass).root.front).not.toHaveProperty("handle")
    // El mòdul és push (per defecte dels fronts): un calaix sense dir res és push; un amb tirador propi el porta.
    const push: Module = { ...withFront({ kind: "drawers", n: 1, heights: ["auto"] }), fronts: { ...base.fronts, handles: "none" } }
    expect(front(buildModule(push), "drawerFront").push).toBe(true)
    const own: Module = { ...withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: h160 }), fronts: { ...base.fronts, handles: "none" } }
    expect(gap(handles(front(buildModule(own), "drawerFront")))).toBeCloseTo(160)
    // I al revés: «Cap (push)» al front d'un mòdul amb tiradors.
    const none = withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: "none" })
    expect(handles(front(buildModule(none), "drawerFront"))).toEqual([])
    expect(front(buildModule(none), "drawerFront").push).toBe(true)
  })

  it("el moble que en porta un és un .moble v2 (una app d'abans no el llegiria a mitges)", () => {
    const comp = { modules: [withFront({ kind: "drawers", n: 1, heights: ["auto"], handle: h160 })] }
    expect(usesImportedHardware(comp)).toBe(true)
    expect(usesImportedHardware({ modules: [withFront({ kind: "drawers", n: 1, heights: ["auto"] })] })).toBe(false)
  })

  it("«Com va muntat»: el calaix d'exemple amb els dos forats a la seva distància (3D i pla)", () => {
    const m = hardwareMount(handle(160))
    expect(m.pending).toBe(true)
    expect(m.proposedTags).toEqual(["handle"])
    const p = m.panels.find((x) => x.role === "drawerFront")!
    expect(gap(handles(p))).toBeCloseTo(160)
    expect(p.fittings?.[0]).toMatchObject({ kind: "handle" })
    const plan = mountPlan(m)!
    expect(plan.dims.some((d) => d.label === "160")).toBe(true)
  })
})

describe("pota importada", () => {
  const withLegs = (hardware?: HardwareItem, m: Module = base): Module => ({ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100, ...(hardware ? { hardware } : {}) } } })

  it("confirmada: els forats de la placa a la cara de sota de la base, a cada pota", () => {
    const b = buildModule(withLegs(legOk))
    const bottom = b.panels.find((p) => p.role === "bottom")!
    const hs = bottom.holes.filter((h) => h.tag === "leg")
    expect(hs).toHaveLength(16)
    expect(hs.every((h) => h.diameter === 2.5 && h.depth === 12)).toBe(true)
    // A Y = 0 (cara de sota) i al voltant de les quatre cantonades a 50 mm de les vores de fora.
    const w = hs.map((h) => toWorld(bottom, [h.x, h.y, h.face === "A" ? bottom.thickness : 0]))
    expect(w.every((p) => Math.abs(p[1]) < 0.01)).toBe(true)
    const xs = [...new Set(w.map((p) => p[0]))].sort((a, b) => a - b)
    const zs = [...new Set(w.map((p) => p[2]))].sort((a, b) => a - b)
    expect(xs).toEqual([27.5, 72.5, 427.5, 472.5])
    expect(zs).toEqual([27.5, 72.5, 487.5, 532.5])
    expect(bottom.fittings?.filter((f) => f.kind === "leg")).toHaveLength(4)
    expect(b.warnings.filter((w) => w.code === "hardware")).toEqual([])
    // Sense pota triada (les genèriques), cap forat.
    expect(buildModule(withLegs()).panels.find((p) => p.role === "bottom")!.holes.some((h) => h.tag === "leg")).toBe(false)
  })

  it("sense confirmar: cap forat i avís", () => {
    const b = buildModule(withLegs(leg))
    expect(b.panels.find((p) => p.role === "bottom")!.holes.some((h) => h.tag === "leg")).toBe(false)
    expect(b.warnings.some((w) => w.code === "hardware" && /pota importada i encara no està confirmada/.test(w.message))).toBe(true)
  })

  it("totes o cap: si la placa no hi cap a la base (sota els laterals), cap forat i avís", () => {
    const tight = setHardwareParam(legOk, "inset", 20)
    expect(tight.imported!.confirmed).toBe(false)
    const b = buildModule(withLegs(setConfirmed(tight, true)))
    expect(b.panels.find((p) => p.role === "bottom")!.holes.some((h) => h.tag === "leg")).toBe(false)
    expect(b.warnings.some((w) => /no hi cap sencera/.test(w.message))).toBe(true)
  })

  it("una pota d'una altra alçada que la base avisa; al .moble és v2", () => {
    const tall = setConfirmed({ ...legOk, imported: { ...legOk.imported!, bbox: { min: [-30, -30, 0], max: [30, 30, 150] } } }, true)
    expect(buildModule(withLegs(tall)).warnings.some((w) => /fa 150 mm/.test(w.message))).toBe(true)
    expect(usesImportedHardware({ modules: [withLegs(legOk)] })).toBe(true)
  })

  it("«Com va muntat»: la base amb les quatre plaques", () => {
    const m = hardwareMount(leg)
    const bottom = m.panels.find((p) => p.role === "bottom")!
    expect(bottom.holes.filter((h) => h.tag === "leg")).toHaveLength(16)
    expect(m.proposedTags).toEqual(["leg"])
    expect(mountPlan(m)).not.toBeNull()
    // La càmera (editor i miniatura): la pota sencera amb la cantonada de la base, de davant i una mica de sota.
    const c = mountCamera(m)
    expect(c.target[1]).toBeLessThan(m.focus!.at[1])
    expect(c.target[1]).toBeGreaterThan(m.focus!.at[1] - 100)
    expect(c.dir[2]).toBeGreaterThan(0.8)
    expect(Math.abs(c.dir[1])).toBeLessThan(0.1)
    // La regió: de sota la pota fins a dins la base, només la cantonada (no les quatre potes).
    expect(m.region.min[1]).toBeLessThan(m.focus!.at[1] - 100)
    expect(m.region.max[0] - m.region.min[0]).toBeLessThan(300)
  })
})

describe("només 3D", () => {
  it("no fa mai cap forat, el posis on el posis", () => {
    expect(HardwareItemSchema.safeParse(only3d).success).toBe(true)
    expect(only3d).toMatchObject({ engine: "model", category: "table", targets: [{ key: "model", ops: [] }] })
    expect(confirmProblem(only3d)).toMatch(/només 3D/)
    expect(hardwarePreview(only3d).panels).toEqual([])
    const m = hardwareMount(only3d)
    expect(m.panels).toEqual([])
    expect(m.model).toMatchObject({ asset: "hwa-3" })
    // Encara que se'l forci com a tirador, frontissa o pota (i confirmat): cap forat.
    const forced = setConfirmed(only3d, true)
    const ref = buildModule(withFront({ kind: "door", mode: "single", hinge: "left" }))
    const asHandle = buildModule(withFront({ kind: "door", mode: "single", hinge: "left", handle: forced }))
    expect(handles(front(asHandle, "door"))).toEqual([])
    const asHinge = buildModule(withFront({ kind: "door", mode: "single", hinge: "left", hardware: forced }))
    expect(front(asHinge, "door").holes.filter((h) => h.tag === "hinge")).toEqual([])
    const asLeg = buildModule({ ...base, carcass: { ...base.carcass, base: { kind: "legs", height: 100, hardware: forced } } })
    expect(asLeg.panels.find((p) => p.role === "bottom")!.holes).toEqual(buildModule({ ...base, carcass: { ...base.carcass, base: { kind: "legs", height: 100 } } }).panels.find((p) => p.role === "bottom")!.holes)
    // Al kit del mòdul (tirador): inert.
    const kit = buildModule({ ...withFront({ kind: "door", mode: "single", hinge: "left" }), hardware: { ...base.hardware, handle: forced } })
    expect(handles(front(kit, "door"))).toEqual([])
    expect(handles(front(ref, "door"))).toHaveLength(2)
  })
})
