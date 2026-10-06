import { describe, expect, it } from "vitest"
import { hingeItem, pairPlate, plateItem, setConfirmed } from "../import/importItem"
import type { HettichArticle } from "../import/hettich"
import type { HardwareProposal } from "../import/proposal"
import { DEFAULT_HARDWARE_KIT, DEFAULT_HARDWARE_LIBRARY, defaultModule, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { hardwareMount, mountPlan } from "./hardwareMount"

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
const hinge = hingeItem(hingeProposal, art("9071205", "hinge"), DEFAULT_HARDWARE_KIT.hinge, { id: "hw-h", asset: "hwa-1", files: [] })
const plate = plateItem(plateProposal, art("9071615", "plate"), { id: "hw-p", asset: "hwa-2", files: [] })

const labels = (item: Parameters<typeof hardwareMount>[0]) => mountPlan(hardwareMount(item))!.dims.map((d) => d.label)

describe("ferratge muntat", () => {
  it("frontissa de l'app: porta i lateral del motor, cotes del muntatge", () => {
    const m = hardwareMount(DEFAULT_HARDWARE_KIT.hinge)
    expect(m.error).toBeUndefined()
    expect(m.pending).toBe(false)
    expect(m.panels.map((p) => p.id)).toEqual(["side-left", "door"])
    expect(m.hinge).toEqual({ doorId: "door", sideId: "side-left" })
    // Les mateixes peces que un mòdul igual fet a mà.
    const base = defaultModule("mount", "Muntatge")
    const same: Module = { ...base, carcass: { ...base.carcass, width: 400, height: 450, depth: 320 }, root: { id: "mount-root", front: { kind: "door", mode: "single", hinge: "left" } } as Zone }
    const ref = buildModule(same).panels
    for (const p of m.panels) expect(p.holes).toEqual(ref.find((x) => x.id === p.id)!.holes)
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
    const m = hardwareMount(DEFAULT_HARDWARE_KIT.hinge, { ...base, carcass: { ...base.carcass, thickness: 16 } })
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
      expect(m.focus, item.engine).not.toBeNull()
      const plan = mountPlan(m)!
      expect(plan.rects.length, item.engine).toBeGreaterThan(0)
      expect(plan.dims.length, item.engine).toBeGreaterThan(0)
      expect(plan.view.w).toBeGreaterThan(0)
    }
    expect(labels(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === "system32")!)).toContain("37")
    expect(labels(DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === "barHandle")!)).toContain("128")
  })
})
