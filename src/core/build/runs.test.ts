import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, type Composition } from "../model"
import { buildComposition, panelBox } from "./buildComposition"

const kitchen = (): Composition => BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()

describe("peces corregudes (taulell i sòcol)", () => {
  it("el taulell és una sola peça de punta a punta sobre els baixos, amb els forats", () => {
    const c = kitchen()
    const b = buildComposition(c)
    const tops = b.panels.filter((p) => p.role === "worktop")
    expect(tops).toHaveLength(1)
    const t = tops[0]!
    expect(t.length).toBe(3000)
    // 560 de caixa + 19 de front + 20 de voladís
    expect(t.width).toBe(599)
    const box = panelBox(t)
    expect(box.min[1]).toBeCloseTo(870)
    expect(box.max[1]).toBeCloseTo(900)
    expect(t.cutouts?.map((x) => x.tag).sort()).toEqual(["hob", "sink"])
    // La placa centrada al mòdul de fogons (x 1400..2000).
    const hob = t.cutouts!.find((x) => x.tag === "hob")!
    expect(hob.kind).toBe("rect")
    if (hob.kind === "rect") expect(hob.x + hob.w / 2).toBeCloseTo(1700)
    // «same-size» és informatiu (el taller casa per mida): es revisa a part.
    expect(b.warnings.filter((w) => w.code !== "same-size")).toEqual([])
  })

  it("el sòcol corregut va de punta a punta, amb l'alçada de les potes i retranquejat", () => {
    const b = buildComposition(kitchen())
    const socols = b.panels.filter((p) => p.id.startsWith("run:") && p.role === "plinth")
    expect(socols).toHaveLength(1)
    const s = socols[0]!
    expect(s.length).toBe(3000)
    expect(s.width).toBe(100)
    const box = panelBox(s)
    expect(box.max[2]).toBeCloseTo(579 - 50)
  })

  it("sense potes, el sòcol corregut no es construeix i avisa", () => {
    const c = kitchen()
    for (const m of c.modules) if (m.carcass.base.kind === "legs") m.carcass.base = { kind: "none" }
    const b = buildComposition(c)
    expect(b.panels.some((p) => p.id.startsWith("run:") && p.role === "plinth")).toBe(false)
    expect(b.warnings.some((w) => /sòcol corregut/.test(w.message))).toBe(true)
  })
})

describe("taulell i sòcol segons el tipus", () => {
  it("només es construeixen a la cuina", async () => {
    const { BUILTIN_TEMPLATES } = await import("../model")
    const { buildComposition } = await import("./buildComposition")
    const k = BUILTIN_TEMPLATES.find((t) => t.id === "modern-kitchen")!.make()
    const has = (c: typeof k) => buildComposition(c).panels.some((p) => p.role === "worktop")
    expect(has(k)).toBe(true)
    expect(has({ ...k, kind: "moble" })).toBe(false)
    expect(has({ ...k, kind: "cuina" })).toBe(true)
  })
})

describe("taulell amb fronts encastats", () => {
  it("arriba a la cara dels fronts (el davant de la caixa) més el voladís, no un gruix més enllà", () => {
    const c = kitchen()
    const inset = { ...c, modules: c.modules.map((m) => ({ ...m, fronts: { ...m.fronts, style: "inset" as const } })) }
    const t = buildComposition(inset).panels.find((p) => p.role === "worktop")!
    expect(t.width).toBe(580) // 560 de caixa + 20 de voladís
  })
})
