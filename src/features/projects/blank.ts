import { applySettingsToModule, defaultModule, newId, type Composition, type Settings } from "../../core/model"

/** Moble en blanc: un mòdul amb els valors de les preferències (botó «Nou moble»). */
export function blankMoble(settings: Settings): Composition {
  return { kind: "moble", modules: [applySettingsToModule(settings, defaultModule(newId("m"), "Mòdul 1"))], references: [] }
}

/** Objecte en blanc: una peça de 600 × 600 × 600 de material de simulació (botó «Nou objecte»). */
export function blankObject(): Composition {
  return {
    kind: "objecte",
    modules: [defaultModule(newId("m"), "Mòdul 1")],
    references: [],
    parts: [{ id: newId("p"), name: "Peça", orient: "flat", material: "Microciment gris", w: 600, h: 600, thickness: 600, x: 0, y: 0, z: 0, nest: false, joints: false }],
  }
}
