import { describe, expect, it } from "vitest"
import { carcassDowels, coveringZone, defaultModule, frontOptionsUse, moduleRows, setFront, splitZone, usedHardwareSlots, type Carcass, type Front, type Module, type Zone } from "../model"
import { buildModule } from "./buildModule"
import { buildComposition } from "./buildComposition"
import { int, pick, randomComposition, rng } from "./testCorpus"

/**
 * Les files de l'inspector del mòdul que depenen del que té (`moduleRows`): Caixa (fons, estil, folgances, retranqueig),
 * Materials › Fronts i Caixa › Laterals › Espiga. **Un sol lloc per decisió** i només el que la construcció llegeix
 * (`frontOptionsUse`, `usedHardwareSlots` a `core/model/usedHardware.ts`). Sense «Acabats» ni per defecte dels compartiments.
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

describe("ferratges que el mòdul fa servir (`usedHardwareSlots`)", () => {
  it("front fix o obert: cap ferratge", () => {
    expect(keys(usedHardwareSlots(withRoot(mod(), { kind: "panel" }))).filter((s) => s !== "dowel" && s !== "system32")).toEqual([])
  })
  it("els fronts tapats pel front de tota la zona no compten, llevat dels calaixos (es fan per dins: regla 3)", () => {
    const inner = divided(drawers3, { kind: "flap", dir: "down" })
    const m: Module = { ...inner, root: { ...inner.root, front: { kind: "door", mode: "double", hinge: "left" } } }
    const used = usedHardwareSlots(m)
    expect(used.get("slide")?.count).toBe(3)
    expect(used.has("flap")).toBe(false)
    expect(used.get("hinge")).toEqual({ count: 2, what: "portes" })
  })
})

describe("les files de cada secció (`moduleRows`: Caixa, Materials) i els compartiments tapats (`coveringZone`)", () => {
  it("una porta sola a l'Interior: estil i folgança front–cos i retranqueig (prestatge) a la Caixa, Fronts a Materials, Espiga a Laterals", () => {
    const m = withRoot(mod(), door)
    expect(moduleRows(m)).toEqual({ style: true, outerGap: true, betweenGap: false, shelfSetback: true, back: m.carcass.back === "groove" || m.carcass.back === "inset" ? m.carcass.back : undefined, frontMaterial: true, dowel: true })
  })
  it("Materials › Fronts només amb algun front que es fa (com l'Estil)", () => {
    expect(moduleRows(withRoot(mod(), null)).frontMaterial).toBe(false)
    expect(moduleRows(withRoot(mod(), { kind: "panel" })).frontMaterial).toBe(true)
    // Tapats pel front de tota la zona: compta el de la zona.
    const inner = divided(drawers3, null)
    expect(moduleRows({ ...inner, root: { ...inner.root, front: door } }).frontMaterial).toBe(true)
  })
  it("Caixa: Ranura o Retirada del fons segons el fons, res sense fons", () => {
    expect(moduleRows(mod({ back: "groove" })).back).toBe("groove")
    expect(moduleRows(mod({ back: "inset" })).back).toBe("inset")
    expect(moduleRows(mod({ back: "none" })).back).toBeUndefined()
    expect(moduleRows(mod({ back: "screwed" })).back).toBeUndefined()
  })
  it("Laterals: l'Espiga només si la caixa en fa (sense, la fila no surt)", () => {
    const m = withRoot(mod({ back: "none", joint: "mitre" }), null)
    const bare = { ...m, root: { ...m.root, shelves: undefined } }
    expect(carcassDowels(bare)).toEqual([])
    expect(moduleRows(bare)).toEqual({ style: false, outerGap: false, betweenGap: false, shelfSetback: false, back: undefined, frontMaterial: false, dowel: false })
    const butt = { ...bare, carcass: { ...bare.carcass, joint: undefined } }
    expect(moduleRows(butt).dowel).toBe(carcassDowels(butt).length > 0)
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

describe("Caixa: estil, folgances i retranqueig (`frontOptionsUse`)", () => {
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
  it("tot a inglet, sense divisions ni fons encastat: Laterals no ensenya l'espiga", () => {
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
