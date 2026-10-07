import { describe, expect, it } from "vitest"
import { DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, ModuleHardwareKitSchema, defaultModule, repairComposition, setFront, usedHardwareSlots, type HardwareItem, type Module } from "../model"
import { buildModule } from "./buildModule"
import { slotSpec } from "./hardware"

/**
 * Auditoria de coherència A1 + A2 (`docs/millores-v1/coherencia-editor.md`): els set llocs de ferratge del mòdul només
 * es llegeixen (i avisen) quan alguna peça els fa servir, i la còpia d'un lloc es llegeix sencera o res (un joc sense
 * `kit` no és «del tipus que no toca»).
 */

const kit14 = DEFAULT_HARDWARE_KITS.find((k) => k.id === "kit-dtc-ht14")!
const codes = (m: Module) => buildModule(m).warnings.filter((w) => w.code === "hardware").map((w) => w.message)
const withSlide = (slide: HardwareItem): Module => {
  const m = defaultModule("m1", "M")
  return { ...m, hardware: { ...DEFAULT_MODULE_HARDWARE, slide } }
}
const flap = (m: Module): Module => ({ ...m, root: setFront(m.root, m.root.id, { kind: "flap", dir: "down" }) })
const drawers = (m: Module): Module => ({ ...m, root: setFront(m.root, m.root.id, { kind: "drawers", n: 2, heights: ["auto", "auto"] }) })
const door = (m: Module): Module => ({ ...m, root: setFront(m.root, m.root.id, { kind: "door", mode: "single", hinge: "left" }) })

describe("A1: només els llocs que el mòdul fa servir es resolen", () => {
  it("joc de calaix al lloc «guia» i l'Interior passat a abatible: cap avís", () => {
    expect(codes(flap(withSlide(structuredClone(kit14))))).toEqual([])
  })
  it("item d'un altre tipus al lloc «frontissa» en un mòdul només de calaixos: cap avís; amb una porta, sí", () => {
    const m = defaultModule("m1", "M")
    const bad: Module = { ...m, hardware: { ...DEFAULT_MODULE_HARDWARE, hinge: structuredClone(DEFAULT_MODULE_HARDWARE.dowel) } }
    expect(codes(drawers(bad))).toEqual([])
    expect(codes(door(bad)).some((w) => w.startsWith("Frontissa:"))).toBe(true)
  })
  it("els llocs que diu `usedHardwareSlots` són els que avisen: un item dolent a tots els altres no fa res", () => {
    const m = door(defaultModule("m1", "M"))
    const used = usedHardwareSlots(m)
    expect([...used.keys()].sort()).toEqual(["dowel", "handle", "hinge", "system32"])
    const hw = { ...DEFAULT_MODULE_HARDWARE }
    for (const slot of ["slide", "flap", "magnet"] as const) hw[slot] = structuredClone(DEFAULT_MODULE_HARDWARE.dowel)
    const ref = buildModule(m)
    const b = buildModule({ ...m, hardware: hw })
    expect(b.warnings).toEqual(ref.warnings)
    expect(b.panels).toEqual(ref.panels)
  })
  it("un joc que no hi cap continua comptant com a «guia» (la fila surt per poder canviar-lo)", () => {
    const m = drawers(withSlide(structuredClone(kit14)))
    const shallow: Module = { ...m, carcass: { ...m.carcass, depth: 150 } }
    expect(usedHardwareSlots(shallow).get("slide")).toEqual({ count: 2, what: "calaixos" })
  })
})

describe("A2: la còpia del joc al mòdul es llegeix sencera o res", () => {
  const { kit: _k, ...stripped } = structuredClone(kit14)
  it("un joc sense `kit` a «guia»: amb calaixos avisa «joc de calaix malmès», amb abatible res", () => {
    expect(codes(flap(withSlide(stripped as HardwareItem)))).toEqual([])
    const w = codes(drawers(withSlide(stripped as HardwareItem)))
    expect(w).toHaveLength(1)
    expect(w[0]).toContain("joc de calaix malmès")
    expect(w[0]).not.toContain("no és del tipus que toca")
    const warnings: string[] = []
    expect(slotSpec("slide", stripped as HardwareItem, (x) => warnings.push(x)).failed).toBe(true)
    expect(warnings[0]).toContain("joc de calaix malmès")
  })
  it("un `kit` dolent no es treu de la còpia: el lloc sencer torna a l'item d'inici, amb avís de reparació", () => {
    const broken = { ...structuredClone(kit14), kit: { ...kit14.kit, variants: "x" } }
    // L'esquema del kit no deixa passar la còpia a mitges.
    expect(ModuleHardwareKitSchema.safeParse({ ...DEFAULT_MODULE_HARDWARE, slide: broken }).success).toBe(false)
    const m = drawers(withSlide(broken as unknown as HardwareItem))
    const rep = repairComposition({ modules: [m], references: [] })
    expect(rep.composition).not.toBeNull()
    const slide = rep.composition!.modules[0]!.hardware.slide
    expect(slide.engine).toBe("slide")
    expect(slide.id).toBe(DEFAULT_MODULE_HARDWARE.slide.id)
    expect(rep.problems.some((p) => /hardware\.slide|valor inicial/.test(p))).toBe(true)
    // El moble reparat no avisa de cap «tipus que no toca».
    expect(codes(rep.composition!.modules[0]!)).toEqual([])
  })
  it("una còpia sencera del joc passa l'esquema tal qual", () => {
    const p = ModuleHardwareKitSchema.safeParse({ ...DEFAULT_MODULE_HARDWARE, slide: structuredClone(kit14) })
    expect(p.success && !!p.data.slide.kit).toBe(true)
  })
})
