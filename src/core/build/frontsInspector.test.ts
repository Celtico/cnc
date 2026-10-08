import { describe, expect, it } from "vitest"
import { DEFAULT_MODULE_HARDWARE, carcassDowels, coveringZone, defaultModule, finishesSection, finishesSectionEmpty, frontOptionsUse, inheritedSlots, setFront, splitZone, usedHardwareSlots, type Carcass, type Front, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { int, pick, randomComposition, rng } from "./testCorpus"

/**
 * Mòdul › «Acabats» (`FinishesForm`, una sola secció): **un sol lloc per decisió** i només
 * el que la construcció llegeix (`frontOptionsUse`, `inheritedSlots`, `usedHardwareSlots` a `core/model/usedHardware.ts`).
 */

const mod = (overrides: Partial<Carcass> = {}): Module => defaultModule("m1", "M", overrides)
const withRoot = (m: Module, front: Front | null): Module => ({ ...m, root: setFront(m.root, m.root.id, front) })
const door: Front = { kind: "door", mode: "single", hinge: "left" }
const drawers3: Front = { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] }
/** Mòdul dividit en dos (de costat) amb un front a cada compartiment. */
function divided(a: Front | null, b: Front | null, base: Module = mod()): Module {
  let root: Zone = splitZone(base.root, base.root.id, "v", 2)
  const [l, r] = root.split!.children
  root = setFront(root, l!.id, a)
  root = setFront(root, r!.id, b)
  return { ...base, root }
}
const keys = (m: Map<string, unknown>) => [...m.keys()].sort()
const dowelHoles = (m: Module) => buildModule(m).panels.filter((p) => JSON.stringify(p).includes('"tag":"dowel"')).map((p) => p.id).sort()

describe("Per defecte dels compartiments (`inheritedSlots`): només on algun compartiment l'hereta", () => {
  it("l'Interior amb el seu propi front (sense divisió): cap per defecte, la tria és al Front de la mateixa pantalla", () => {
    const m = withRoot(mod(), door)
    expect(keys(inheritedSlots(m))).toEqual(["handle", "hinge"])
    expect(keys(inheritedSlots(m, new Set([m.root.id])))).toEqual([])
  })
  it("dividit: només els llocs que algun compartiment llegeix «Com el mòdul»", () => {
    const own = { ...door, hardware: structuredClone(DEFAULT_MODULE_HARDWARE.hinge) }
    const m = divided(own, drawers3)
    const inh = inheritedSlots(m, new Set([m.root.id]))
    expect(keys(inh)).toEqual(["handle", "slide"])
    expect(inh.get("handle")).toEqual({ count: 4, what: "portes, calaixos" })
    // Amb frontissa, guia i tirador propis a tots dos (o «Cap (push)»), cap per defecte.
    const both = divided({ ...own, handle: structuredClone(DEFAULT_MODULE_HARDWARE.handle) }, { ...drawers3, hardware: structuredClone(DEFAULT_MODULE_HARDWARE.slide), handle: "none" })
    expect(keys(inheritedSlots(both, new Set([both.root.id])))).toEqual([])
  })
  it("front fix o obert: cap ferratge", () => {
    expect(keys(usedHardwareSlots(withRoot(mod(), { kind: "panel" }))).filter((s) => s !== "dowel" && s !== "system32")).toEqual([])
    expect(keys(inheritedSlots(divided({ kind: "panel" }, null)))).toEqual([])
  })
  it("els fronts tapats pel front de tota la zona no compten (ni a «usats» ni a «per defecte»)", () => {
    const inner = divided(drawers3, { kind: "flap", dir: "down" })
    const m: Module = { ...inner, root: { ...inner.root, front: { kind: "door", mode: "double", hinge: "left" } } }
    const used = usedHardwareSlots(m)
    expect(used.has("slide")).toBe(false)
    expect(used.has("flap")).toBe(false)
    expect(used.get("hinge")).toEqual({ count: 2, what: "portes" })
    expect(keys(inheritedSlots(m, new Set([m.root.id])))).toEqual([])
  })
})

describe("la secció sencera (`finishesSection`, Mòdul › Acabats) i els compartiments tapats (`coveringZone`)", () => {
  it("una porta sola a l'Interior: estil i folgança front–cos, retranqueig (prestatge), la caixa i els per defecte que hereta", () => {
    const m = withRoot(mod(), door)
    const s = finishesSection(m)
    expect({ ...s, defaults: s.defaults.map((d) => d.slot) }).toEqual({ style: true, outerGap: true, betweenGap: false, shelfSetback: true, back: m.carcass.back === "groove" || m.carcass.back === "inset" ? m.carcass.back : undefined, dowel: true, defaults: ["handle", "hinge"] })
  })
  it("cap compartiment exclòs: l'Interior que hereta també compta (ja no és a la mateixa pantalla)", () => {
    const m = withRoot(mod(), door)
    expect(finishesSection(m).defaults.map((d) => d.slot)).toEqual(keys(inheritedSlots(m)))
  })
  it("dividit amb calaixos i una porta: el tirador primer i després la frontissa i la guia", () => {
    const s = finishesSection(divided(door, drawers3))
    expect(s.defaults.map((d) => d.slot)).toEqual(["handle", "hinge", "slide"])
  })
  it("la caixa: Ranura o Retirada del fons segons el fons, res sense fons", () => {
    expect(finishesSection(mod({ back: "groove" })).back).toBe("groove")
    expect(finishesSection(mod({ back: "inset" })).back).toBe("inset")
    expect(finishesSection(mod({ back: "none" })).back).toBeUndefined()
  })
  it("obert sense prestatges, sense fons ni espigues: res (la secció no surt)", () => {
    const m = withRoot(mod({ back: "none", joint: "mitre" }), null)
    const bare = { ...m, root: { ...m.root, shelves: undefined } }
    expect(carcassDowels(bare)).toEqual([])
    expect(finishesSectionEmpty(finishesSection(bare))).toBe(true)
    // Amb espigues a la caixa, l'Espiga sí: la secció surt.
    const butt = { ...bare, carcass: { ...bare.carcass, joint: undefined } }
    expect(finishesSectionEmpty(finishesSection(butt))).toBe(carcassDowels(butt).length === 0)
  })
  it("un compartiment sota les portes de tota la zona sap qui el tapa", () => {
    const inner = divided(drawers3, null)
    const m: Module = { ...inner, root: { ...inner.root, front: door } }
    const child = m.root.split!.children[0]!
    expect(coveringZone(m.root, child.id)?.id).toBe(m.root.id)
    expect(coveringZone(m.root, m.root.id)).toBeUndefined()
    expect(coveringZone(inner.root, child.id)).toBeUndefined()
  })
})

describe("Acabats: estil, folgances i retranqueig (`frontOptionsUse`)", () => {
  it("sense fronts no surt res dels fronts; amb prestatges, el retranqueig", () => {
    expect(frontOptionsUse(withRoot(mod(), null))).toEqual({ style: false, outerGap: false, betweenGap: false, shelfSetback: true })
    const bare = withRoot(mod(), null)
    expect(frontOptionsUse({ ...bare, root: { ...bare.root, shelves: undefined } }).shelfSetback).toBe(false)
  })
  it("front fix a tot el mòdul: estil i folgança front–cos, cap folgança entre fronts", () => {
    const m = withRoot(mod(), { kind: "panel" })
    expect(frontOptionsUse({ ...m, root: { ...m.root, shelves: undefined } })).toEqual({ style: true, outerGap: true, betweenGap: false, shelfSetback: false })
  })
  it("folgança entre fronts: dues portes, dos calaixos o un front recobrent al costat d'un divisor", () => {
    expect(frontOptionsUse(withRoot(mod(), door)).betweenGap).toBe(false)
    expect(frontOptionsUse(withRoot(mod(), { ...door, mode: "double" })).betweenGap).toBe(true)
    expect(frontOptionsUse(withRoot(mod(), drawers3)).betweenGap).toBe(true)
    expect(frontOptionsUse(divided(door, null)).betweenGap).toBe(true)
    // Encastats: cada front dins de la seva llum, sense res a repartir amb el divisor.
    const inset = divided(door, null)
    expect(frontOptionsUse({ ...inset, fronts: { ...inset.fronts, style: "inset" } }).betweenGap).toBe(false)
  })
  it("el que no es llegeix no canvia res (mòduls aleatoris, escrit amb `frontOptionsUse`)", () => {
    const r = rng(23)
    const out = (c: ReturnType<typeof randomComposition>) => {
      const b = buildComposition(c)
      return JSON.stringify({ panels: b.panels, extras: b.extras, warnings: b.warnings })
    }
    const bad: number[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const c = randomComposition(seed)
      const ref = out(c)
      const scrambled = {
        ...c,
        modules: c.modules.map((m) => {
          const use = frontOptionsUse(m)
          const fronts = { ...m.fronts }
          if (!use.style) fronts.style = pick(r, ["overlay", "inset"] as const)
          if (!use.outerGap) fronts.outerGap = pick(r, [0, 3, 10])
          if (!use.betweenGap) fronts.betweenGap = pick(r, [0, 4, 10])
          return { ...m, fronts, carcass: use.shelfSetback ? m.carcass : { ...m.carcass, shelfSetback: int(r, 0, 100) } }
        }),
      }
      if (out(scrambled) !== ref) bad.push(seed)
    }
    expect(bad).toEqual([])
  })
})

describe("Cantonades a inglet: les espigues s'adapten", () => {
  it("tapa i base a inglet no porten espigues; amb sòcol, la base sí", () => {
    const butt = mod({ base: { kind: "none" } })
    expect(carcassDowels(butt)).toEqual(["tapa", "base"])
    const mitre = mod({ base: { kind: "none" }, joint: "mitre" })
    expect(carcassDowels(mitre)).toEqual([])
    expect(dowelHoles(mitre)).toEqual([])
    const plinth = mod({ base: { kind: "plinth", height: 60, setback: 30 }, joint: "mitre" })
    expect(carcassDowels(plinth)).toEqual(["base"])
    expect(dowelHoles(plinth)).toEqual(["bottom", "side-left", "side-right"])
  })
  it("tot a inglet, sense divisions ni fons encastat: la Fusteria no ensenya l'espiga", () => {
    expect(usedHardwareSlots(mod({ base: { kind: "none" }, joint: "mitre" })).has("dowel")).toBe(false)
    // Una divisió, sí (divisors i prestatges fixos amb espigues).
    expect(usedHardwareSlots(divided(null, null, mod({ base: { kind: "none" }, joint: "mitre" }))).get("dowel")?.what).toBe("divisions")
  })
  it("fronts dels calaixos a inglet: cap espiga del mòdul a la caixa", () => {
    const m = withRoot(mod({ base: { kind: "none" }, joint: "mitre", back: "groove" }), drawers3)
    const b = buildModule(m)
    expect(b.panels.some((p) => p.id.includes("drawer") && p.id.endsWith("front") && p.mitres?.length)).toBe(true)
    expect(dowelHoles(m).filter((id) => !id.startsWith("drawer-"))).toEqual([])
  })
})
