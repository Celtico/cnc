import { describe, expect, it } from "vitest"
import { hingeItem, pairPlate, plateItem, restoreProposal, setConfirmed } from "../import/importItem"
import type { HettichArticle } from "../import/hettich"
import type { HardwareProposal } from "../import/proposal"
import { DEFAULT_HARDWARE_KIT, HardwareItemSchema, defaultModule, hardwareChoices, isCopyOf, sameHardware, type Module, type Panel, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { cupSpec } from "./hardware"
import { hardwarePreview } from "./hardwarePreview"

/**
 * Ferratge importat (Hettich) al moble: la frontissa fa la cassoleta i els cargols a la porta amb les regles de sempre
 * (quantitat per alçada, a la filera System 32, a `cupOffset` del cantell, cara de dins) i la placa aparellada fa els
 * seus forats al lateral, a la filera de davant (37) i a l'alçada de cada cassoleta. Sense confirmar, cap forat.
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
const hinge = hingeItem(hingeProposal, art("9071205", "hinge"), DEFAULT_HARDWARE_KIT.hinge, { id: "hw-h", asset: "hwa-1", files: ["9071205.stp"] })
const plate = plateItem(plateProposal, art("9071615", "plate"), { id: "hw-p", asset: "hwa-2", files: ["9071615.stp"] })
const paired = setConfirmed(pairPlate(hinge, setConfirmed(plate, true)), true)

const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })
const withDoor = (hinge: "left" | "right", hardware?: typeof paired): Module => ({ ...base, root: { id: "r", front: { kind: "door", mode: "single", hinge, ...(hardware ? { hardware } : {}) } } as Zone })
const faceZ = (p: Panel, face: "A" | "B" | "edge") => (face === "A" ? p.thickness : 0)
const world = (p: Panel, h: { x: number; y: number; face: "A" | "B" | "edge" }) => toWorld(p, [h.x, h.y, faceZ(p, h.face)])

describe("ferratges importats al moble", () => {
  it("els items importats passen l'esquema i surten com a «sense confirmar»", () => {
    expect(HardwareItemSchema.safeParse(hinge).success).toBe(true)
    expect(HardwareItemSchema.safeParse(paired).success).toBe(true)
    expect(hinge.imported!.confirmed).toBe(false)
    expect(cupSpec(hinge).pending).toBe(true)
    expect(cupSpec(paired)).toMatchObject({ pending: false, plate: { setback: 37, offset: 0 } })
  })

  for (const side of ["left", "right"] as const)
    it(`porta amb la frontissa a ${side === "left" ? "l'esquerra" : "la dreta"}: cassoleta, cargols i placa`, () => {
      const b = buildModule(withDoor(side, paired))
      const door = b.panels.find((p) => p.role === "door")!
      const ref = buildModule(withDoor(side)).panels.find((p) => p.role === "door")!
      const cups = door.holes.filter((h) => h.tag === "hinge")
      // Les mateixes cassoletes que la frontissa de sempre (quantitat, alçades a la filera, a 22,5 del cantell, cara A).
      expect(cups).toEqual(ref.holes.filter((h) => h.tag === "hinge"))
      expect(cups).toHaveLength(2)
      const screws = door.holes.filter((h) => h.tag === "hinge-screw")
      expect(screws).toHaveLength(4)
      for (const c of cups) {
        const mine = screws.filter((s) => Math.abs(s.x - c.x) <= 26.01)
        expect(mine.map((s) => s.x - c.x).sort((a, b) => a - b)).toEqual([-26, 26])
        // 5,5 mm més lluny del cantell de les frontisses que el centre de la cassoleta.
        for (const s of mine) expect(Math.abs(s.y - c.y)).toBeCloseTo(5.5)
        for (const s of mine) expect(side === "left" ? s.y > c.y : s.y < c.y).toBe(true)
        expect(mine.every((s) => s.face === c.face && s.diameter === 5 && s.depth === 10)).toBe(true)
      }
      expect(door.fittings).toHaveLength(2)
      expect(door.fittings![0]).toMatchObject({ asset: "hwa-1", face: "A", v: [0, side === "left" ? 1 : -1] })

      // Lateral de les frontisses: dues espigues Ø10 × 11,5 per cassoleta, a ±16 de la seva alçada i 37 del davant, a la cara de dins.
      const lat = b.panels.find((p) => p.id === `side-${side}`)!
      const plates = lat.holes.filter((h) => h.tag === "plate")
      expect(plates).toHaveLength(4)
      expect(plates.every((h) => h.diameter === 10 && h.depth === 11.5)).toBe(true)
      const cupYs = cups.map((c) => world(door, c)[1]).sort((a, b) => a - b)
      const ys = plates.map((h) => world(lat, h)[1]).sort((a, b) => a - b)
      expect(ys).toEqual(cupYs.flatMap((y) => [y - 16, y + 16]))
      for (const h of plates) expect(world(lat, h)[2]).toBeCloseTo(560 - 37)
      // Cara de dins del moble: x cap al centre del mòdul.
      const xIn = world(lat, plates[0]!)[0]
      expect(side === "left" ? xIn > 0 : xIn < 500).toBe(true)
      expect(Math.abs(xIn - 250)).toBeLessThan(250 - 18)
      // El System 32 que coincideix amb un forat de la placa (Ø5) dona pas al de la placa (Ø10); cap forat repetit.
      const keys = lat.holes.map((h) => `${h.face}|${h.x}|${h.y}`)
      expect(new Set(keys).size).toBe(keys.length)
      expect(lat.fittings).toHaveLength(2)
      expect(lat.fittings![0]!.asset).toBe("hwa-2")
      // L'altre lateral, sense placa.
      expect(b.panels.find((p) => p.id === `side-${side === "left" ? "right" : "left"}`)!.holes.some((h) => h.tag === "plate")).toBe(false)
      expect(b.warnings.filter((w) => w.code === "hardware" || w.code === "hinge")).toEqual([])
    })

  it("una porta més ampla que alta (la peça es gira): el model segueix la cassoleta", () => {
    const wide: Module = { ...defaultModule("w", "x", { width: 900, height: 400, depth: 560 }), root: { id: "r", front: { kind: "door", mode: "single", hinge: "left", hardware: paired } } as Zone }
    const door = buildModule(wide).panels.find((p) => p.role === "door")!
    expect(door.length).toBeGreaterThan(door.width)
    const cups = door.holes.filter((h) => h.tag === "hinge")
    expect(cups.length).toBeGreaterThan(0)
    expect(door.fittings!.map((f) => [f.x, f.y])).toEqual(cups.map((h) => [h.x, h.y]))
    // v (cap a dins de la porta, lluny del cantell de les frontisses) es gira amb la peça: apunta de la cassoleta cap als cargols.
    const f = door.fittings![0]!
    const screws = door.holes.filter((h) => h.tag === "hinge-screw" && Math.hypot(h.x - f.x, h.y - f.y) < 30)
    const mid = { x: screws.reduce((a, h) => a + h.x, 0) / screws.length, y: screws.reduce((a, h) => a + h.y, 0) / screws.length }
    expect((mid.x - f.x) * f.v[0] + (mid.y - f.y) * f.v[1]).toBeCloseTo(5.5)
  })

  it("sense confirmar: cap forat a la porta ni al lateral, i un avís", () => {
    const pending = pairPlate(hinge, plate)
    const b = buildModule(withDoor("left", pending))
    const door = b.panels.find((p) => p.role === "door")!
    expect(door.holes.filter((h) => h.tag?.startsWith("hinge"))).toEqual([])
    expect(b.panels.find((p) => p.id === "side-left")!.holes.some((h) => h.tag === "plate")).toBe(false)
    expect(b.warnings.find((w) => w.code === "hardware")!.message).toMatch(/no està confirmada/)
  })

  it("una placa amb forats de cargol Ø5 × 12 a la filera fa els mateixos forats que el System 32 (no en repeteix cap)", () => {
    const euro = plateItem({ ...plateProposal, holes: plateProposal.holes.map((h) => ({ ...h, role: "screw", d: 5, depth: 12 })) }, art("9071620", "plate"), { id: "hw-e", files: [] })
    const b = buildModule(withDoor("left", setConfirmed(pairPlate(hinge, euro), true)))
    const ref = buildModule(withDoor("left"))
    const holes = (m: typeof b) => m.panels.find((p) => p.id === "side-left")!.holes
    expect(holes(b).length).toBe(holes(ref).length)
  })

  it("confirmar, desfer i tornar a la proposta; una còpia sense confirmar no és la confirmada", () => {
    expect(sameHardware(hinge, setConfirmed(hinge, true))).toBe(false)
    expect(isCopyOf(setConfirmed(hinge, true), setConfirmed(hinge, true))).toBe(true)
    // Les notes i el model no fan forats.
    expect(sameHardware(hinge, { ...hinge, imported: { ...hinge.imported!, notes: ["x"], asset: "altre" } })).toBe(true)
    const edited = { ...paired, targets: paired.targets.map((t) => (t.key === "door" ? { ...t, ops: t.ops.slice(0, 1) } : t)) }
    const back = restoreProposal(edited)
    expect(back.imported!.confirmed).toBe(false)
    expect(back.targets.find((t) => t.key === "door")!.ops).toHaveLength(3)
    expect(back.targets.some((t) => t.key === "side")).toBe(true)
    // Al selector d'una porta: la còpia del moble sense confirmar surt a part quan la biblioteca ja està confirmada.
    const { options, value } = hardwareChoices([paired], pairPlate(hinge, plate))
    expect(options.find((o) => o.key === value)!.own).toBe(true)
  })

  it("dibuix de Preferències: porta amb cassoleta i cargols i lateral amb la placa", () => {
    const pv = hardwarePreview(paired)
    expect(pv.panels.map((p) => p.id)).toEqual(["door", "side"])
    expect(pv.panels[0]!.holes).toHaveLength(6)
    expect(pv.panels[1]!.holes.map((h) => [h.y, h.diameter])).toEqual([[37, 10], [37, 10], [37, 10], [37, 10]])
    expect(hardwarePreview(plate).panels[0]!.holes.map((h) => h.x)).toEqual([344, 376])
  })
})
