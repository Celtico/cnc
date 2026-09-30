import { describe, expect, it } from "vitest"
import { tidyMm, tidyPart, type FreePart } from "./freePart"
import { normalizeComposition, defaultModule } from "./composition"
import { MAG_OBJECTS } from "./magObjects"

const part = (patch: Partial<FreePart> = {}): FreePart => ({ id: "p", name: "Peça", orient: "flat", material: "M", w: 600, h: 600, thickness: 19, x: 0, y: 0, z: 0, nest: false, joints: false, ...patch })

describe("tidyMm", () => {
  it("arrodoneix els decimals llargs i respecta els que escriu l'usuari", () => {
    expect(tidyMm(453.5763027)).toBe(454)
    expect(tidyMm(22.5)).toBe(22.5)
    expect(tidyMm(19)).toBe(19)
    expect(tidyMm(-12.349)).toBe(-12)
  })

  it("torna la mateixa peça si ja és neta", () => {
    const p = part({ thickness: 22.5 })
    expect(tidyPart(p)).toBe(p)
    expect(tidyPart(part({ w: 463.57, x: 10.001 }))).toMatchObject({ w: 464, x: 10 })
  })

  it("en carregar, les peces lliures queden al mm", () => {
    const comp = normalizeComposition({ kind: "objecte", modules: [defaultModule("m", "Mòdul 1")], references: [], parts: [part({ w: 423.3645, z: 0.123456 })] })
    expect(comp.parts![0]).toMatchObject({ w: 423, z: 0 })
  })

  it("els objectes de revista es creen amb mides netes", () => {
    for (const o of MAG_OBJECTS) {
      for (const p of o.make().parts ?? []) for (const k of ["x", "y", "z", "w", "h", "thickness"] as const) expect(tidyMm(p[k]), `${o.name} · ${p.name} · ${k}`).toBe(p[k])
    }
  })
})
