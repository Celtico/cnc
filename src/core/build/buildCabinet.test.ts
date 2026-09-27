import { describe, expect, it } from "vitest"
import { DEFAULT_CABINET, type CabinetParams, type Panel } from "../model"
import { buildCabinet, normalizePanel } from "./buildCabinet"

const base: CabinetParams = {
  ...DEFAULT_CABINET,
  width: 600,
  height: 720,
  depth: 560,
  panelThickness: 19,
  backThickness: 10,
  shelves: 1,
  doors: 1,
  backType: "groove",
}

function byRole(panels: Panel[], role: Panel["role"]): Panel[] {
  return panels.filter((p) => p.role === role)
}

function dims(p: Panel): [number, number, number] {
  return [p.length, p.width, p.thickness]
}

describe("buildCabinet · mides 600×720×560, tauler 19, fons 10 en ranura", () => {
  const panels = buildCabinet(base)

  it("genera 2 laterals, base, sostre, fons, 1 prestatge i 1 porta", () => {
    expect(byRole(panels, "side")).toHaveLength(2)
    expect(byRole(panels, "bottom")).toHaveLength(1)
    expect(byRole(panels, "top")).toHaveLength(1)
    expect(byRole(panels, "back")).toHaveLength(1)
    expect(byRole(panels, "shelf")).toHaveLength(1)
    expect(byRole(panels, "door")).toHaveLength(1)
    expect(panels).toHaveLength(7)
  })

  it("els laterals abracen base i sostre: 720 × 560 × 19", () => {
    for (const s of byRole(panels, "side")) expect(dims(s)).toEqual([720, 560, 19])
  })

  it("base i sostre van entre laterals: 562 × 560 × 19", () => {
    expect(dims(byRole(panels, "bottom")[0]!)).toEqual([562, 560, 19])
    expect(dims(byRole(panels, "top")[0]!)).toEqual([562, 560, 19])
  })

  it("el fons entra 8 mm a cada ranura amb 1 mm de joc: 697 × 577 × 10 (costat llarg a x)", () => {
    expect(dims(byRole(panels, "back")[0]!)).toEqual([697, 577, 10])
  })

  it("el prestatge té 1 mm de joc i 20 mm de retranqueig darrere el fons: 561 × 520", () => {
    expect(dims(byRole(panels, "shelf")[0]!)).toEqual([561, 520, 19])
  })

  it("la porta cobreix el cos amb 2 mm de joc per costat: 716 × 596", () => {
    expect(dims(byRole(panels, "door")[0]!)).toEqual([716, 596, 19])
  })

  it("tots els ids són únics", () => {
    const ids = panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("buildCabinet · variants", () => {
  it("dues portes: (600 − 2·2 − 3) / 2 = 296,5 d'ample cadascuna", () => {
    const doors = byRole(buildCabinet({ ...base, doors: 2 }), "door")
    expect(doors).toHaveLength(2)
    for (const d of doors) expect(dims(d)).toEqual([716, 296.5, 19])
  })

  it("sense portes ni prestatges: només 5 peces", () => {
    expect(buildCabinet({ ...base, doors: 0, shelves: 0 })).toHaveLength(5)
  })

  it("fons cargolat sobreposat: laterals 550 de fons, fons 720 × 600, prestatge 530", () => {
    const panels = buildCabinet({ ...base, backType: "screwed" })
    for (const s of byRole(panels, "side")) expect(dims(s)).toEqual([720, 550, 19])
    expect(dims(byRole(panels, "bottom")[0]!)).toEqual([562, 550, 19])
    expect(dims(byRole(panels, "back")[0]!)).toEqual([720, 600, 10])
    expect(dims(byRole(panels, "shelf")[0]!)).toEqual([561, 530, 19])
    expect(panels.every((p) => p.grooves.length === 0)).toBe(true)
  })

  it("el fons de 3 prestatges es reparteix i queda sobre forats System 32", () => {
    const panels = buildCabinet({ ...base, shelves: 3 })
    const shelves = byRole(panels, "shelf")
    expect(shelves).toHaveLength(3)
    const ys = shelves.map((s) => s.placement.origin[1]).sort((a, b) => a - b)
    for (const y of ys) expect((y - 56) % 32).toBe(0)
    expect(ys[0]!).toBeLessThan(ys[1]!)
    expect(ys[1]!).toBeLessThan(ys[2]!)
  })
})

describe("buildCabinet · forats", () => {
  const panels = buildCabinet(base)
  const [left, right] = byRole(panels, "side") as [Panel, Panel]

  it("System 32 als laterals: 2 fileres × 20 forats Ø5 P12, pas 32, a 37 dels cantells", () => {
    for (const side of [left, right]) {
      const s32 = side.holes.filter((h) => h.tag === "system32")
      expect(s32).toHaveLength(40)
      for (const h of s32) {
        expect(h.diameter).toBe(5)
        expect(h.depth).toBe(12)
        expect(h.face).toBe("A")
        expect([37, 523]).toContain(h.y)
        expect((h.x - 56) % 32).toBe(0)
      }
      const xs = s32.map((h) => h.x)
      expect(Math.min(...xs)).toBe(56)
      expect(Math.max(...xs)).toBe(664)
    }
  })

  it("el lateral dret és la imatge mirall de l'esquerre (front a y = 0)", () => {
    const frontRowLeft = left.holes.filter((h) => h.tag === "system32" && h.y === 523)
    const frontRowRight = right.holes.filter((h) => h.tag === "system32" && h.y === 37)
    expect(frontRowLeft).toHaveLength(20)
    expect(frontRowRight).toHaveLength(20)
    expect(left.edges.top).toBe(true) // cantell frontal (y = width) folrat
    expect(right.edges.bottom).toBe(true) // cantell frontal (y = 0) folrat
  })

  it("espigues Ø8: 3 per unió a la cara del lateral (P12) i al cantell de base/sostre (P20)", () => {
    for (const side of [left, right]) {
      const dowels = side.holes.filter((h) => h.tag === "dowel")
      expect(dowels).toHaveLength(6)
      for (const h of dowels) {
        expect(h.diameter).toBe(8)
        expect(h.depth).toBe(12)
        expect(h.face).toBe("A")
        expect([9.5, 710.5]).toContain(h.x)
      }
    }
    for (const role of ["bottom", "top"] as const) {
      const p = byRole(panels, role)[0]!
      const dowels = p.holes.filter((h) => h.tag === "dowel")
      expect(dowels).toHaveLength(6)
      for (const h of dowels) {
        expect(h.face).toBe("edge")
        expect(["left", "right"]).toContain(h.edge)
        expect(h.diameter).toBe(8)
        expect(h.depth).toBe(20)
        expect([0, 562]).toContain(h.x)
      }
    }
  })

  it("cassoletes Ø35 P13 a 22,5 del cantell de frontissa, alineades a mig pas del System 32", () => {
    const door = byRole(panels, "door")[0]!
    const cups = door.holes.filter((h) => h.tag === "hinge")
    expect(cups).toHaveLength(2)
    for (const c of cups) {
      expect(c.diameter).toBe(35)
      expect(c.depth).toBe(13)
      expect(c.face).toBe("A")
      expect(c.y).toBe(22.5)
      // Y al moble = x local + joc (2). Punt mig entre forats: 72 + 32k.
      expect((c.x + 2 - 72) % 32).toBe(0)
    }
    expect(cups.map((c) => c.x).sort((a, b) => a - b)).toEqual([102, 614])
  })

  it("amb dues portes, la dreta té les cassoletes al cantell dret", () => {
    const doors = byRole(buildCabinet({ ...base, doors: 2 }), "door")
    const cupYs = doors.map((d) => d.holes[0]!.y).sort((a, b) => a - b)
    expect(cupYs).toEqual([22.5, 296.5 - 22.5])
  })

  it("una porta alta porta més frontisses", () => {
    const door = byRole(buildCabinet({ ...base, height: 2000 }), "door")[0]!
    expect(door.holes.filter((h) => h.tag === "hinge").length).toBeGreaterThanOrEqual(4)
  })

  it("recompte total de forats del mòdul per defecte: 92 + 12 + 2 = 106", () => {
    const total = panels.reduce((n, p) => n + p.holes.length, 0)
    expect(total).toBe(106)
  })
})

describe("buildCabinet · ranura del fons", () => {
  const panels = buildCabinet(base)

  it("laterals: ranura de 10 d'ample × 8 de fons a 10 mm del darrere, aturada a 11 mm dels extrems", () => {
    const [left, right] = byRole(panels, "side") as [Panel, Panel]
    expect(left.grooves).toEqual([
      { x: 11, y: 10, w: 698, h: 10, depth: 8, face: "A", tag: "back" },
    ])
    expect(right.grooves).toEqual([
      { x: 11, y: 540, w: 698, h: 10, depth: 8, face: "A", tag: "back" },
    ])
  })

  it("base i sostre: ranura passant a tota la llargada", () => {
    const bottom = byRole(panels, "bottom")[0]!
    const top = byRole(panels, "top")[0]!
    expect(bottom.grooves[0]).toMatchObject({ x: 0, w: 562, y: 540, h: 10, depth: 8 })
    expect(top.grooves[0]).toMatchObject({ x: 0, w: 562, y: 10, h: 10, depth: 8 })
  })
})

describe("buildCabinet · col·locació 3D", () => {
  const panels = buildCabinet(base)

  it("cada base és ortonormal i dextrogira", () => {
    for (const p of panels) {
      const { xAxis: x, yAxis: y, zAxis: z } = p.placement
      // `|| 0` converteix -0 en +0 perquè toEqual/toBe fan servir Object.is.
      const dot = (a: number[], b: number[]) => (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) || 0
      expect(dot(x, y)).toBe(0)
      expect(dot(y, z)).toBe(0)
      expect(dot(x, z)).toBe(0)
      // x × y == z
      const cross = [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ].map((v) => v || 0)
      expect(cross).toEqual(z.map((v) => v || 0))
    }
  })

  it("el conjunt ocupa exactament 600 × 720 × (560 + 19 de porta)", () => {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const p of panels) {
      const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
      for (const cx of [0, p.length])
        for (const cy of [0, p.width])
          for (const cz of [0, p.thickness])
            for (let i = 0; i < 3; i++) {
              const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
              min[i] = Math.min(min[i]!, v)
              max[i] = Math.max(max[i]!, v)
            }
    }
    expect(min.map((v) => Math.round(v * 100) / 100)).toEqual([0, 0, 0])
    expect(max.map((v) => Math.round(v * 100) / 100)).toEqual([600, 720, 579])
  })
})

describe("normalizePanel · costat llarg sempre a x", () => {
  const panel: Panel = {
    id: "p",
    name: "p",
    label: "p",
    role: "back",
    length: 100,
    width: 200,
    thickness: 10,
    material: "m",
    grain: "x",
    edges: { left: true, right: false, bottom: false, top: true },
    holes: [{ x: 10, y: 20, diameter: 5, depth: 12, face: "A" }],
    grooves: [{ x: 10, y: 30, w: 80, h: 8, depth: 8, face: "A" }],
    placement: {
      origin: [5, 6, 7],
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      zAxis: [1, 0, 0],
      explodeDir: [1, 0, 0],
    },
  }
  const n = normalizePanel(panel)
  const world = (p: Panel, x: number, y: number): number[] => {
    const { origin: o, xAxis: a, yAxis: b } = p.placement
    return [0, 1, 2].map((i) => o[i]! + x * a[i]! + y * b[i]!)
  }

  it("intercanvia mides, veta i cantells", () => {
    expect([n.length, n.width]).toEqual([200, 100])
    expect(n.grain).toBe("y")
    // bottom→left, top→right, left→top, right→bottom
    expect(n.edges).toEqual({ left: false, right: true, bottom: false, top: true })
  })

  it("gira forats i ranures 90° mantenint la posició al moble", () => {
    expect(n.holes[0]).toMatchObject({ x: 20, y: 90 })
    expect(world(n, 20, 90)).toEqual(world(panel, 10, 20))
    expect(n.grooves[0]).toMatchObject({ x: 30, y: 10, w: 8, h: 80 })
    // cantonades del rectangle: (10,30) i (90,38) → (30,10)…(38,90)
    expect(world(n, 30, 90)).toEqual(world(panel, 10, 30))
    expect(world(n, 38, 10)).toEqual(world(panel, 90, 38))
  })

  it("una peça ja normalitzada no canvia", () => {
    expect(normalizePanel(n)).toBe(n)
  })

  it("un mòdul baix (400 d'alt) manté el volum total encara que els laterals es girin", () => {
    const panels = buildCabinet({ ...base, height: 400, shelves: 0 })
    for (const s of byRole(panels, "side")) expect(dims(s)).toEqual([560, 400, 19])
    const maxY = Math.max(
      ...panels.map((p) => {
        const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
        return Math.max(
          ...[0, p.length].flatMap((cx) =>
            [0, p.width].flatMap((cy) =>
              [0, p.thickness].map((cz) => o[1]! + cx * x[1]! + cy * y[1]! + cz * z[1]!),
            ),
          ),
        )
      }),
    )
    expect(Math.round(maxY)).toBe(400)
  })
})
