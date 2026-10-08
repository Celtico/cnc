import { describe, expect, it } from "vitest"
import { hingeItem, pairPlate, plateItem, setConfirmed } from "../import/importItem"
import type { HettichArticle } from "../import/hettich"
import type { HardwareProposal } from "../import/proposal"
import { ACCESSORY_ITEMS, DEFAULT_MODULE_HARDWARE, DEFAULT_HARDWARE_LIBRARY, defaultModule, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { hardwareMount, modelCamera, MOUNT_CAMERA_DIST, mountCamera, mountPlan } from "./hardwareMount"

/**
 * Ferratge muntat (Preferències › Ferratges, 3D · Pla): les peces surten del motor de sempre (`buildModule`) amb l'item
 * al seu lloc; un importat sense confirmar mostra els forats proposats (que el moble encara no fa).
 */

const frame = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], n: [0, 1, 0] } as HardwareProposal["frame"]
const hingeProposal: HardwareProposal = {
  kind: "hinge",
  frame,
  holes: [
    { role: "cup", u: 0, v: 0, d: 35, measured: 35, depth: 13, depthFrom: "file" },
    { role: "screw", u: -26, v: 5.5, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
    { role: "screw", u: 26, v: 5.5, d: 5, measured: 5.2, depth: 10, depthFrom: "default" },
  ],
  bbox: { min: [-33.6, -4.3, -12.8], max: [33.6, 19.1, 71] },
  notes: [],
}
const plateProposal: HardwareProposal = {
  kind: "plate",
  frame: { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], n: [1, 0, 0] },
  holes: [
    { role: "dowel", u: -16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
    { role: "dowel", u: 16, v: 0, d: 10, measured: 10, depth: 11.5, depthFrom: "file" },
  ],
  bbox: { min: [-27.7, -22.6, -11.4], max: [27.7, 69.5, 6.4] },
  notes: [],
}
const art = (article: string, kind: "hinge" | "plate"): HettichArticle => ({ article, folders: [], category: kind, tags: [], label: `${kind} ${article}`, group: "", kind, files: [] })
const hinge = hingeItem(hingeProposal, art("9071205", "hinge"), DEFAULT_MODULE_HARDWARE.hinge, { id: "hw-h", asset: "hwa-1", files: [] })
const plate = plateItem(plateProposal, art("9071615", "plate"), { id: "hw-p", asset: "hwa-2", files: [] })

const labels = (item: Parameters<typeof hardwareMount>[0]) => mountPlan(hardwareMount(item))!.dims.map((d) => d.label)

describe("ferratge muntat", () => {
  it("frontissa de l'app: porta i lateral del motor, cotes del muntatge", () => {
    const m = hardwareMount(DEFAULT_MODULE_HARDWARE.hinge)
    expect(m.error).toBeUndefined()
    expect(m.pending).toBe(false)
    expect(m.panels.map((p) => p.id)).toEqual(["side-left", "door"])
    expect(m.hinge).toEqual({ doorId: "door", sideId: "side-left" })
    // Les mateixes peces que un mòdul igual fet a mà (sense les espigues de la caixa: només es dibuixen al de l'espiga).
    const base = defaultModule("mount", "Muntatge")
    const same: Module = { ...base, carcass: { ...base.carcass, width: 400, height: 450, depth: 320 }, root: { id: "mount-root", front: { kind: "door", mode: "single", hinge: "left" } } as Zone }
    const ref = buildModule(same).panels
    for (const p of m.panels) expect(p.holes).toEqual(ref.find((x) => x.id === p.id)!.holes.filter((h) => h.tag !== "dowel"))
    // La primera cassoleta (la de baix), a la cara de dins de la porta.
    expect(m.focus).toMatchObject({ panelId: "door", hole: { tag: "hinge", diameter: 35 }, normal: [0, 0, -1] })
    const plan = mountPlan(m)!
    expect(plan.rects.map((x) => x.id)).toEqual(["side-left", "door"])
    // Joc 2 · recobriment 17 · centre 22,5 · C 5 · fondària 13 · filera System 32 a 37 del davant.
    expect(plan.dims.map((d) => d.label)).toEqual(["2", "17", "22,5", "C 5", "13", "37"])
    expect(plan.fittings).toHaveLength(1)
    expect(plan.holes.filter((h) => h.cut && h.tag === "hinge")).toHaveLength(1)
  })

  it("el gruix del tauler per defecte canvia el muntatge", () => {
    const base = defaultModule("mount", "Muntatge")
    const m = hardwareMount(DEFAULT_MODULE_HARDWARE.hinge, { ...base, carcass: { ...base.carcass, thickness: 16 } })
    expect(m.panels.every((p) => p.thickness === 16)).toBe(true)
    expect(mountPlan(m)!.dims.map((d) => d.label)).toContain("14")
  })

  it("importada sense confirmar: els forats proposats (cassoleta, cargols i placa) es veuen marcats com a proposta", () => {
    const pending = pairPlate(hinge, setConfirmed(plate, true))
    expect(pending.imported!.confirmed).toBe(false)
    const m = hardwareMount(pending)
    expect(m.pending).toBe(true)
    expect(new Set(m.proposedTags)).toEqual(new Set(["hinge", "hinge-screw", "plate"]))
    const door = m.panels.find((p) => p.role === "door")!
    expect(door.holes.filter((h) => h.tag === "hinge-screw")).toHaveLength(4)
    expect(door.fittings).toHaveLength(2)
    const side = m.panels.find((p) => p.id === "side-left")!
    expect(side.holes.filter((h) => h.tag === "plate")).toHaveLength(4)
    const plan = mountPlan(m)!
    expect(plan.holes.filter((h) => h.proposed).length).toBeGreaterThan(0)
    expect(plan.holes.filter((h) => h.tag === "system32").every((h) => !h.proposed)).toBe(true)
    // La placa: forats Ø10 a 37 del davant del lateral.
    expect(plan.dims.find((d) => d.title.startsWith("Placa"))!.label).toBe("37")
    // Confirmada: res proposat.
    expect(hardwareMount(setConfirmed(pending, true)).proposedTags).toEqual([])
  })

  it("una placa sola es veu amb la frontissa del mòdul (la de l'app)", () => {
    const m = hardwareMount(plate)
    expect(m.error).toBeUndefined()
    expect(m.pending).toBe(true)
    expect(m.proposedTags).toEqual(["plate"])
    expect(m.panels.find((p) => p.id === "side-left")!.holes.filter((h) => h.tag === "plate")).toHaveLength(4)
    expect(m.panels.find((p) => p.role === "door")!.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
    expect(labels(plate)).toContain("37")
  })

  it("tots els ferratges de l'app es poden muntar i tenen pla", () => {
    for (const item of DEFAULT_HARDWARE_LIBRARY) {
      const m = hardwareMount(item)
      expect(m.error, item.engine).toBeUndefined()
      // Els accessoris (barra, perfil LED, marc de vitrina) encara no fan cap forat: es miren pel mig del que es veu (`aim`).
      if (ACCESSORY_ITEMS.includes(item)) {
        expect(m.aim, item.engine).toBeDefined()
        expect(m.panels.some((p) => p.role === "part"), item.engine).toBe(true)
      } else expect(m.focus, item.engine).not.toBeNull()
      const plan = mountPlan(m)!
      expect(plan.rects.length, item.engine).toBeGreaterThan(0)
      expect(plan.dims.length, item.engine).toBeGreaterThan(0)
      expect(plan.view.w).toBeGreaterThan(0)
    }
    expect(labels(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === "system32")!)).toContain("37")
    expect(labels(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === "barHandle")!)).toContain("128")
  })

  it("la càmera de «Com va muntat» (editor i miniatura): al forat principal, des de la cara on entra", () => {
    const len = (v: number[]) => Math.hypot(v[0]!, v[1]!, v[2]!)
    // Frontissa: des de dins del moble (la cara de la cassoleta mira enrere), de dalt i cap a dins (+X).
    const h = hardwareMount(DEFAULT_MODULE_HARDWARE.hinge)
    const c = mountCamera(h)
    // Mira el mig del que enquadra (la frontissa de baix amb la placa), a tocar del forat principal.
    for (const k of [0, 1, 2]) expect(Math.abs(c.target[k]! - h.focus!.at[k]!)).toBeLessThan(40)
    expect(len(c.dir)).toBeCloseTo(1, 6)
    expect(c.dir[2]).toBeLessThan(0)
    expect(c.dir[0]).toBeGreaterThan(0)
    expect(c.dir[1]).toBeGreaterThan(0)
    expect(c.dist).toBeGreaterThanOrEqual(MOUNT_CAMERA_DIST.min)
    expect(c.dist).toBeLessThan(600)
    // La regió: la cassoleta de baix (Ø35 × 13) amb el braç i la placa al lateral, no la de dalt.
    expect(h.region.max[1] - h.region.min[1]).toBeLessThan(250)
    expect(h.region.min[1]).toBeLessThan(h.focus!.at[1])
    // Tirador: des de fora del front.
    const t = mountCamera(hardwareMount(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === "barHandle")!))
    expect(t.dir[2]).toBeGreaterThan(0)
    expect(t.dist).toBeGreaterThanOrEqual(MOUNT_CAMERA_DIST.min)
    expect(t.dist).toBeLessThanOrEqual(MOUNT_CAMERA_DIST.max)
    // Només 3D: tota la caixa a la imatge, la càmera tan a prop com es pot (`modelCamera`).
    const model = { ...plate, id: "hw-m", engine: "model" as const, targets: [], imported: { ...plate.imported!, bbox: { min: [0, 0, 0] as [number, number, number], max: [100, 40, 400] as [number, number, number] } } }
    const mm = mountCamera(hardwareMount(model))
    expect(len(mm.dir)).toBeCloseTo(1, 6)
    expect(mm.dist).toBeGreaterThan(200)
    expect(mm.dist).toBeLessThan(1500)
  })

  /** On cau cada vèrtex de la caixa a la imatge (−1…1) i el tros que ocupa la secció de l'extrem de davant. */
  function project(b: { min: number[]; max: number[] }, aspect: number) {
    const c = modelCamera(b as { min: [number, number, number]; max: [number, number, number] }, aspect)
    const cam = c.target.map((v, i) => v + c.dir[i]! * c.dist)
    const f = c.dir.map((v) => -v)
    const unit = (a: number[]) => a.map((x) => x / Math.hypot(...a))
    const r = unit([f[1]! * 0 - f[2]! * 1, f[2]! * 0 - f[0]! * 0, f[0]! * 1 - f[1]! * 0])
    const u = [r[1]! * f[2]! - r[2]! * f[1]!, r[2]! * f[0]! - r[0]! * f[2]!, r[0]! * f[1]! - r[1]! * f[0]!]
    const t = Math.tan((32 * Math.PI) / 360)
    const pts: [number, number, number][] = []
    for (const x of [b.min[0]!, b.max[0]!]) for (const y of [b.min[1]!, b.max[1]!]) for (const z of [b.min[2]!, b.max[2]!]) pts.push([x, y, z])
    const ndc = pts.map((p) => {
      const d = p.map((v, i) => v - cam[i]!)
      const z = d[0]! * f[0]! + d[1]! * f[1]! + d[2]! * f[2]!
      return { x: (d[0]! * r[0]! + d[1]! * r[1]! + d[2]! * r[2]!) / (z * t * aspect), y: (d[0]! * u[0]! + d[1]! * u[1]! + d[2]! * u[2]!) / (z * t), z, p }
    })
    return { c, ndc }
  }

  it("un «només 3D» llarg i prim (perfil de 1560 × 12,5 × 6,5) no surt com una ratlla: mirat al llarg, la secció es veu", () => {
    const b = { min: [0, 0, 0], max: [1560, 12.5, 6.5] }
    for (const aspect of [1.6, 2]) {
      const { ndc } = project(b, aspect)
      // Tots els vèrtexs, davant de la càmera i dins la imatge.
      for (const q of ndc) {
        expect(q.z).toBeGreaterThan(5)
        expect(Math.abs(q.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(q.y)).toBeLessThanOrEqual(1)
      }
      // La secció de l'extrem de davant (x = 0) ocupa un bon tros de l'alçada (de costat seria < 1 %).
      const near = ndc.filter((q) => q.p[0] === 0)
      const h = Math.max(...near.map((q) => q.y)) - Math.min(...near.map((q) => q.y))
      expect(h / 2).toBeGreaterThan(0.12)
      // I tot el llarg també hi és: la imatge s'omple d'esquerra a dreta.
      const w = Math.max(...ndc.map((q) => q.x)) - Math.min(...ndc.map((q) => q.x))
      expect(w / 2).toBeGreaterThan(0.5)
    }
    // El mateix perfil al llarg de Z.
    const { ndc } = project({ min: [0, 0, 0], max: [6.5, 12.5, 1560] }, 1.6)
    for (const q of ndc) expect(Math.abs(q.x)).toBeLessThanOrEqual(1)
  })

  it("un «només 3D» compacte omple la imatge (de 3/4)", () => {
    const { ndc } = project({ min: [-50, 0, -30], max: [50, 80, 30] }, 1.6)
    const w = Math.max(...ndc.map((q) => q.x)) - Math.min(...ndc.map((q) => q.x))
    const h = Math.max(...ndc.map((q) => q.y)) - Math.min(...ndc.map((q) => q.y))
    expect(Math.max(w, h) / 2).toBeGreaterThan(0.8)
    for (const q of ndc) expect(Math.max(Math.abs(q.x), Math.abs(q.y))).toBeLessThanOrEqual(1)
  })
})
