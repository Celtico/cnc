import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, applySettingsToModule, emptyModule, parseSettings, splitZone, switchFront } from ".."
import { OPTION_NODES, hiddenBy, isOptionHidden, optionDefault, parseOptionPrefs, setOptionPref, validOptionValue, type OptionPrefs } from "./optionCascade"
import { applyModuleOptionDefaults, applyPartOptionDefaults, applyRefOptionDefaults, baseWithDefaults, frontWithDefaults, withNewZoneDefaults } from "./optionDefaults"

describe("registre de les opcions en cascada", () => {
  const nodes = [...OPTION_NODES.values()]
  it("les tries revelen o amaguen opcions que hi són", () => {
    const bad = nodes.flatMap((n) => (n.choices ?? []).flatMap((c) => [...(c.reveals ?? []), ...(c.hides ?? [])].filter((id) => !OPTION_NODES.has(id)).map((id) => `${n.id} → ${id}`)))
    expect(bad).toEqual([])
  })
  it("un per defecte que es pot triar té un control i un valor del codi vàlid", () => {
    const bad = nodes.filter((n) => n.defaultEditable && (n.default === undefined || !validOptionValue(n, n.default))).map((n) => n.id)
    expect(bad).toEqual([])
  })
  it("els apartats (`group`) no s'amaguen; els que no s'amaguen diuen per què", () => {
    expect(nodes.filter((n) => n.kind === "group" && n.hideable).map((n) => n.id)).toEqual([])
    expect(nodes.filter((n) => n.kind !== "group" && !n.hideable && !n.why).map((n) => n.id)).toEqual([])
  })
})

describe("amagar", () => {
  it("amaga l'opció i les de sota; una que no es pot amagar no s'amaga", () => {
    const prefs: OptionPrefs = { "module.carcass.back": { hidden: true }, "module.dims": { hidden: true } }
    expect(isOptionHidden(prefs, "module.carcass.back")).toBe(true)
    expect(hiddenBy(prefs, "module.carcass.backSetback")).toBe("module.carcass.back")
    expect(isOptionHidden(prefs, "module.carcass.top")).toBe(false)
    expect(isOptionHidden(prefs, "module.dims.width")).toBe(false)
    expect(isOptionHidden(undefined, "module.carcass.back")).toBe(false)
  })
  it("una preferència buida o amb el valor del codi es treu", () => {
    let p = setOptionPref({}, "module.carcass.back", { hidden: true })
    p = setOptionPref(p, "module.carcass.back", { default: "groove" })
    expect(p).toEqual({ "module.carcass.back": { hidden: true, default: "groove" } })
    p = setOptionPref(p, "module.carcass.back", { hidden: false, default: "none" })
    expect(p).toEqual({})
  })
  it("un per defecte que no és vàlid no compta", () => {
    expect(optionDefault({ "module.carcass.back": { default: "foo" } }, "module.carcass.back")).toBe("none")
    expect(optionDefault({ "module.dims.width": { default: 99999 } }, "module.dims.width")).toBe(600)
    expect(optionDefault({ "module.dims.width": { default: 800 } }, "module.dims.width")).toBe(800)
  })
})

describe("lectura (v48)", () => {
  it("unes preferències d'abans no en tenen cap; una entrada dolenta només treu aquella", () => {
    const { settings } = parseSettings({ ...DEFAULT_SETTINGS, version: 47, optionPrefs: undefined })
    expect(settings.optionPrefs).toEqual({})
    const problems: string[] = []
    expect(parseOptionPrefs({ a: { hidden: true }, b: { hidden: "sí" } }, problems)).toEqual({ a: { hidden: true } })
    expect(problems).toHaveLength(1)
  })
})

describe("per defecte dels elements nous", () => {
  const base = applySettingsToModule(DEFAULT_SETTINGS, emptyModule("m", "Mòdul"))
  it("sense preferències, el mòdul nou no canvia", () => {
    expect(applyModuleOptionDefaults(base, {})).toBe(base)
    expect(applyModuleOptionDefaults(base, undefined)).toBe(base)
  })
  it("mides, suport, fons, tapa, laterals i el compartiment de l'usuari", () => {
    const prefs: OptionPrefs = {
      "module.dims.height": { default: 720 },
      "module.carcass.support": { default: "plinth" },
      "module.carcass.plinthHeight": { default: 100 },
      "module.carcass.back": { default: "groove" },
      "module.carcass.top": { default: "full" },
      "module.carcass.sides": { default: "both" },
      "module.carcass.frontStyle": { default: "inset" },
      "zone.shelves.count": { default: 2 },
      "zone.front.kind": { default: "door" },
      "zone.front.door.mode": { default: "double" },
    }
    const m = applyModuleOptionDefaults(base, prefs)
    expect(m.carcass.height).toBe(720)
    expect(m.carcass.base).toEqual({ kind: "plinth", height: 100, setback: 30 })
    expect(m.carcass.back).toBe("groove")
    expect(m.carcass.top).toEqual({ kind: "full" })
    expect(m.carcass.sides).toEqual({ left: true, right: true })
    expect(m.fronts.style).toBe("inset")
    expect(m.root.shelves).toEqual({ n: 2, adjustable: true })
    expect(m.root.front).toEqual({ kind: "door", mode: "double", hinge: "left" })
    // El material i les folgances de Preferències es queden.
    expect(m.carcass.material).toBe(base.carcass.material)
  })
  it("el suport triat a la Caixa fa servir les mides per defecte de l'usuari", () => {
    expect(baseWithDefaults("plinth", undefined)).toEqual({ kind: "plinth", height: 60, setback: 30 })
    expect(baseWithDefaults("legs", { "module.carcass.legHeight": { default: 150 } })).toEqual({ kind: "legs", height: 150 })
  })
  it("el front que es posa per primer cop i els compartiments nous d'una divisió", () => {
    const prefs: OptionPrefs = { "zone.front.drawers.count": { default: 4 }, "zone.shelves.led": { default: true } }
    expect(frontWithDefaults("drawers", prefs)).toEqual({ kind: "drawers", n: 4, heights: ["auto", "auto", "auto", "auto"] })
    const root = { id: "r", shelves: { n: 1, adjustable: true } }
    const split = splitZone(root, "r", "v", 2)
    const next = withNewZoneDefaults(root, split, prefs)
    const [a, b] = next.split!.children
    expect(a!.shelves).toEqual({ n: 1, adjustable: true })
    expect(a!.led).toBeUndefined()
    expect(b!.led).toEqual({})
    // Un front recordat no es toca (switchFront el recupera sencer).
    const z = { id: "z", fronts: { drawers: { kind: "drawers" as const, n: 2, heights: ["auto" as const, "auto" as const] } } }
    expect(switchFront(z, "z", "drawers", (k) => frontWithDefaults(k, prefs)).front).toEqual(z.fronts.drawers)
  })
  it("peça lliure i objecte de referència", () => {
    const p = { id: "p", name: "P", orient: "front" as const, w: 600, h: 400, thickness: 19, material: "M", x: 0, y: 0, z: 0 }
    expect(applyPartOptionDefaults(p, { "part.cnc.edge": { default: true }, "part.material.grain": { default: "none" } })).toEqual({ ...p, edged: true, grain: "none" })
    expect(applyPartOptionDefaults(p, {})).toEqual(p)
    const r = { id: "r", name: "R", w: 1, h: 1, d: 1, x: 0, y: 0, z: 0 }
    expect(applyRefOptionDefaults(r, { "ref.effect": { default: "cut" } }).effect).toBe("cut")
  })
})
