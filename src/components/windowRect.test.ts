import { describe, expect, it } from "vitest"
import { defaultWindowRect, keepGrabbable, fitWindowRect, MIN_SIZE } from "./windowRect"

const desk = { width: 1600, height: 1000 }

describe("defaultWindowRect", () => {
  it("una tria: estreta, alta i enganxada a la dreta", () => {
    const r = defaultWindowRect("picker", desk)
    expect(r).toEqual({ x: 1600 - 380 - 16, y: 16, width: 380, height: 1000 - 32 })
    expect(defaultWindowRect("picker", desk, { width: 480 }).width).toBe(480)
  })

  it("un editor: gran i al mig de la zona de treball, sense tapar el menú lateral", () => {
    const r = defaultWindowRect("editor", desk)
    // Gran però amb lloc al voltant per moure-la.
    expect(r.width).toBeLessThanOrEqual(1000)
    expect(r.width).toBeLessThan(desk.width - 236)
    expect(r.height).toBeLessThan(desk.height)
    expect(r.x).toBeGreaterThanOrEqual(236)
    expect(r.x + r.width).toBeLessThanOrEqual(desk.width)
    // Una mida petita demanada (desar com a fitxer) es respecta.
    expect(defaultWindowRect("editor", desk, { width: 520, height: 380 })).toMatchObject({ width: 520, height: 380 })
  })

  it("en una finestra del navegador petita, mai més petita que el mínim", () => {
    const r = defaultWindowRect("editor", { width: 500, height: 300 })
    expect(r.width).toBeGreaterThanOrEqual(MIN_SIZE.width)
    expect(r.height).toBeGreaterThanOrEqual(MIN_SIZE.height)
  })
})

describe("fitWindowRect", () => {
  it("deixa igual la que hi cap", () => {
    const r = { x: 100, y: 50, width: 600, height: 400 }
    expect(fitWindowRect(r, desk)).toEqual(r)
  })

  it("la recordada d'una pantalla més gran s'encongeix i es mou fins que hi cap", () => {
    expect(fitWindowRect({ x: 1500, y: 900, width: 1200, height: 900 }, { width: 1024, height: 700 })).toEqual({ x: 0, y: 0, width: 1024, height: 700 })
    expect(fitWindowRect({ x: 900, y: 600, width: 400, height: 300 }, { width: 1024, height: 700 })).toEqual({ x: 624, y: 400, width: 400, height: 300 })
  })
})

describe("keepGrabbable", () => {
  it("pot sortir en part, però la barra de títol sempre es pot agafar", () => {
    const view = { width: 1400, height: 900 }
    expect(keepGrabbable({ x: 300, y: 100, width: 1000, height: 700 }, view)).toEqual({ x: 300, y: 100 })
    expect(keepGrabbable({ x: 1350, y: -50, width: 1000, height: 700 }, view)).toEqual({ x: 1280, y: 0 })
    expect(keepGrabbable({ x: -990, y: 880, width: 1000, height: 700 }, view)).toEqual({ x: -880, y: 852 })
  })
})
