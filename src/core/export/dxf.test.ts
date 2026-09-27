import { describe, expect, it } from "vitest"
import { buildCabinet } from "../build/buildCabinet"
import { buildModule } from "../build/buildModule"
import { DEFAULT_CABINET, DEFAULT_GRILLE, defaultModule } from "../model"
import {
  arrangePanels,
  dxfLayers,
  fmt,
  panelToDxf,
  parseDxfEntities,
  parseDxfPairs,
  toDxf,
} from "./dxf"

const panels = buildCabinet(DEFAULT_CABINET)
const dxf = toDxf(panels)

describe("toDxf · estructura R12", () => {
  it("comença amb SECTION HEADER i acaba amb EOF", () => {
    expect(dxf.startsWith("0\r\nSECTION\r\n2\r\nHEADER\r\n")).toBe(true)
    expect(dxf.endsWith("0\r\nEOF\r\n")).toBe(true)
  })

  it("té un nombre parell de línies (parells codi/valor) i versió AC1009", () => {
    const pairs = parseDxfPairs(dxf)
    expect(pairs.some(([c, v]) => c === 1 && v === "AC1009")).toBe(true)
    const lines = dxf.split("\r\n")
    lines.pop()
    expect(lines.length % 2).toBe(0)
  })

  it("conté les seccions HEADER, TABLES, BLOCKS i ENTITIES", () => {
    for (const s of ["HEADER", "TABLES", "BLOCKS", "ENTITIES"]) {
      expect(dxf).toContain(`0\r\nSECTION\r\n2\r\n${s}\r\n`)
    }
  })

  it("declara totes les capes que fan servir les entitats", () => {
    const declared = new Set<string>()
    const pairs = parseDxfPairs(dxf)
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i]![0] === 0 && pairs[i]![1] === "LAYER" && pairs[i + 1]?.[0] === 2) {
        declared.add(pairs[i + 1]![1])
      }
    }
    const used = new Set(parseDxfEntities(dxf).map((e) => e.layer).filter((l) => l !== null))
    for (const l of used) expect(declared.has(l)).toBe(true)
  })
})

describe("toDxf · contingut", () => {
  const entities = parseDxfEntities(dxf)

  it("una peça per bloc, i un INSERT per peça", () => {
    expect(entities.filter((e) => e.type === "BLOCK")).toHaveLength(panels.length)
    expect(entities.filter((e) => e.type === "INSERT")).toHaveLength(panels.length)
  })

  it("capes esperades: CONTOUR i forats per diàmetre/profunditat", () => {
    const layers = dxfLayers(panels)
    expect(layers).toContain("CONTOUR")
    expect(layers).toContain("DRILL_D5_P12") // System 32
    expect(layers).toContain("DRILL_D8_P12") // espiga a la cara del lateral
    expect(layers).toContain("DRILL_H_D8_P20") // espiga al cantell de base/sostre
    expect(layers).toContain("DRILL_D35_P13") // cassoleta
    expect(layers).toContain("GROOVE_W10_P8") // ranura del fons
  })

  it("un CIRCLE per forat (106) i un contorn tancat de 4 vèrtexs per peça", () => {
    const circles = entities.filter((e) => e.type === "CIRCLE")
    expect(circles).toHaveLength(106)
    const contours = entities.filter((e) => e.type === "POLYLINE" && e.layer === "CONTOUR")
    expect(contours).toHaveLength(panels.length)
    for (const c of contours) expect(c.values[70]).toEqual(["1"])
    const vertices = entities.filter((e) => e.type === "VERTEX" && e.layer === "CONTOUR")
    expect(vertices).toHaveLength(panels.length * 4)
  })

  it("el contorn del lateral fa 720 × 560", () => {
    const vs = entities.filter((e) => e.type === "VERTEX" && e.layer === "CONTOUR").slice(0, 4)
    const pts = vs.map((v) => [Number(v.values[10]![0]), Number(v.values[20]![0])])
    expect(pts).toEqual([
      [0, 0],
      [720, 0],
      [720, 560],
      [0, 560],
    ])
  })

  it("les cassoletes són cercles de radi 17,5 a DRILL_D35_P13", () => {
    const cups = entities.filter((e) => e.type === "CIRCLE" && e.layer === "DRILL_D35_P13")
    expect(cups).toHaveLength(2)
    for (const c of cups) expect(c.values[40]).toEqual(["17.5"])
  })

  it("etiqueta amb el nom del taller a la capa LABEL", () => {
    const labels = entities.filter((e) => e.type === "TEXT" && e.layer === "LABEL")
    expect(labels).toHaveLength(panels.length)
    expect(labels.map((l) => l.values[1]![0])).toContainEqual("lat e 720.0x560.0x19.0")
  })

  it("sense etiquetes si es demana", () => {
    const noLabels = toDxf(panels, { labels: false })
    expect(noLabels).not.toContain("LABEL")
  })
})

describe("arrangePanels", () => {
  it("no encavalca peces i salta de fila quan s'esgota l'amplada", () => {
    const placed = arrangePanels(panels, 100, 1500)
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!
        const b = placed[j]!
        const overlapX = a.x < b.x + b.panel.length && b.x < a.x + a.panel.length
        const overlapY = a.y < b.y + b.panel.width && b.y < a.y + a.panel.width
        expect(overlapX && overlapY).toBe(false)
      }
    }
    expect(new Set(placed.map((p) => p.y)).size).toBeGreaterThan(1)
  })
})

describe("panelToDxf i fmt", () => {
  it("fmt escriu sempre decimal", () => {
    expect(fmt(5)).toBe("5.0")
    expect(fmt(22.5)).toBe("22.5")
    expect(fmt(296.49999)).toBe("296.5")
    expect(fmt(0.1 + 0.2)).toBe("0.3")
  })

  it("panelToDxf insereix el bloc a l'origen", () => {
    const single = panelToDxf(panels[0]!)
    const inserts = parseDxfEntities(single).filter((e) => e.type === "INSERT")
    expect(inserts).toHaveLength(1)
    expect(inserts[0]!.values[10]).toEqual(["0.0"])
    expect(inserts[0]!.values[20]).toEqual(["0.0"])
  })
})

describe("talls passants → capa CUT_THROUGH", () => {
  const m = {
    ...defaultModule("g", "Reixeta", { width: 600, height: 700, depth: 300 }),
    root: { id: "root", front: { kind: "grille" as const, pattern: DEFAULT_GRILLE, mount: "removable" as const, hinge: "left" as const, hatch: { x: 400, y: 100, w: 100, h: 100 } } },
  }
  const { panels } = buildModule(m)
  const out = toDxf(panels)
  const entities = parseDxfEntities(out)

  it("declara la capa i hi posa les ranures (bulge 1 als semicercles), la trapa i cap forat", () => {
    expect(dxfLayers(panels)).toContain("CUT_THROUGH")
    const cut = entities.filter((e) => e.layer === "CUT_THROUGH")
    const polys = cut.filter((e) => e.type === "POLYLINE")
    const grille = panels.find((p) => p.role === "grille")!
    expect(polys).toHaveLength(grille.cutouts!.length)
    const bulges = cut.filter((e) => e.type === "VERTEX" && e.values[42]?.[0] === "1.0")
    expect(bulges.length).toBe((grille.cutouts!.length - 1) * 2) // 2 semicercles per ranura, cap a la trapa
    expect(cut.some((e) => e.type === "CIRCLE")).toBe(false)
  })

  it("el contorn continua a CONTOUR, separat", () => {
    const contours = entities.filter((e) => e.type === "POLYLINE" && e.layer === "CONTOUR")
    expect(contours).toHaveLength(panels.length)
  })
})
