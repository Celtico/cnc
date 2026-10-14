import { describe, expect, it } from "vitest"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import {
  CompositionSchema,
  DEFAULT_HARDWARE_DEFAULTS,
  DEFAULT_MODULE_HARDWARE,
  DEFAULT_HARDWARE_KITS, DTC_CATALOGUE_ITEMS,
  ACCESSORY_ITEMS,
  V31_ITEMS,
  V34_ITEMS,
  V35_ITEMS,
  V39_ITEMS,
  V41_ITEMS,
  V42_ITEMS,
  V43_ITEMS,
  V44_ITEMS,
  DEFAULT_HARDWARE_LIBRARY,
  DEFAULT_LEGACY_HARDWARE,
  DEFAULT_SETTINGS,
  HardwareItemSchema,
  TV_LIVING_ROOM,
  copyHardwareItem,
  defaultModule,
  fixHardwareDefaults,
  hardwareChoices,
  hardwareRefIds,
  isCopyOf,
  kitFromLegacy,
  libraryFromLegacy,
  migrateModuleHardware,
  normalizeComposition,
  parseSettings,
  repairComposition,
  replaceHardwareRefs,
  sameHardware,
  stepValue,
  usesHardware,
  type Composition,
  type HardwareItem,
  type LegacyHardware,
  type Module,
  type Zone,
} from "../model"
import { buildComposition } from "./buildComposition"
import { buildModule } from "./buildModule"
import { hingeCount } from "./geometry"
import { applyHardware, cupSpec, handleSpec, resolveOps, slotSpec } from "./hardware"
import { hardwarePreview } from "./hardwarePreview"
import { catalogCorpus, randomComposition } from "./testCorpus"

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const withRoot = (m: Module, root: Zone): Module => ({ ...m, root })
const item = (id: string) => DEFAULT_HARDWARE_LIBRARY.find((x) => x.id === id)!
/** Una composició amb els ferratges com es desaven abans de la v19 (els números a `Module.hardware`). */
const legacy = (c: Composition, h: LegacyHardware = DEFAULT_LEGACY_HARDWARE): Composition => plain({ ...c, modules: c.modules.map((m) => ({ ...m, hardware: h })) }) as unknown as Composition

describe("motor de ferratges (F1)", () => {
  it("la quantitat de frontisses per alçada és la taula de `hingeCount`, com a dades", () => {
    const spec = cupSpec(item("hinge-cup"))
    for (let h = 100; h <= 3000; h += 50) expect(spec.count(h)).toBe(hingeCount(h))
    for (const h of [900, 900.01, 1600, 1600.01, 2100, 2100.01]) expect(spec.count(h)).toBe(hingeCount(h))
  })

  it("la distància dels forats del tirador: 128 / 96 / 64 segons l'espai, com abans", () => {
    const spec = handleSpec(item("handle-bar"))
    const before = (room: number) => (room >= 260 ? 128 : room >= 200 ? 96 : 64)
    for (const room of [100, 199.99, 200, 259.9, 260, 600]) expect(spec.pitch(room)).toBe(before(room))
  })

  it("mecanitzats paramètrics: cassoleta a l'esquerra i a la dreta (mirall), tirador girat", () => {
    const cup = item("hinge-cup")
    const left = applyHardware(cup, "door", {}, { at: { x: 132, y: 0 } })
    expect(left.holes).toEqual([{ x: 132, y: 22.5, diameter: 35, depth: 13, face: "A", tag: "hinge" }])
    const right = applyHardware(cup, "door", {}, { at: { x: 132, y: 0 }, mirrorY: 400 })
    expect(right.holes[0]).toMatchObject({ x: 132, y: 377.5 })
    const handle = applyHardware(item("handle-bar"), "front", { pitch: 96 }, { at: { x: 100.004, y: 50 }, axis: "y", round: true })
    expect(handle.cutouts).toEqual([
      { kind: "circle", x: 100, y: 2, diameter: 5, tag: "handle" },
      { kind: "circle", x: 100, y: 98, diameter: 5, tag: "handle" },
    ])
    expect(resolveOps(item("slide-ball"), "side").map((o) => (o.kind === "drill" ? o.u : null))).toEqual([37, 293])
  })

  it("un item dolent (fórmula, paràmetre que falta, un altre tipus) no fa mig ferratge: el d'inici i un avís", () => {
    const warn: string[] = []
    const bad = { ...item("hinge-cup"), targets: [{ key: "door", label: "Porta", ops: [{ kind: "drill" as const, face: "A" as const, u: 0, v: "cupOfset", d: "cupDiameter", depth: "cupDepth" }] }] }
    expect(slotSpec("hinge", bad, (m) => warn.push(m)).item).toBe(DEFAULT_MODULE_HARDWARE.hinge)
    expect(slotSpec("hinge", item("slide-ball"), (m) => warn.push(m)).item).toBe(DEFAULT_MODULE_HARDWARE.hinge)
    const { cupDepth: _c, ...params } = item("hinge-cup").params
    expect(slotSpec("hinge", { ...item("hinge-cup"), params }, (m) => warn.push(m)).item).toBe(DEFAULT_MODULE_HARDWARE.hinge)
    expect(warn).toHaveLength(3)
    expect(warn[0]).toMatch(/cupOfset/)
  })
})

describe("ferratges per front (porta, calaix, abatible)", () => {
  const base = defaultModule("m", "x", { width: 500, height: 720, depth: 560 })

  it("una porta amb una altra frontissa fa les seves cassoletes; sense, les del mòdul", () => {
    const small: HardwareItem = { ...copyHardwareItem(item("hinge-cup"), "hw-26", "Cassoleta Ø26"), params: { ...item("hinge-cup").params, cupDiameter: 26, cupOffset: 20 } }
    const door = (hardware?: HardwareItem) => buildModule(withRoot(base, { id: "r", front: { kind: "door", mode: "single", hinge: "right", ...(hardware ? { hardware } : {}) } })).panels.find((p) => p.role === "door")!
    const std = door().holes.filter((h) => h.tag === "hinge")
    const mine = door(small).holes.filter((h) => h.tag === "hinge")
    expect(std.map((h) => h.diameter)).toEqual([35, 35])
    expect(mine.map((h) => h.diameter)).toEqual([26, 26])
    expect(mine.map((h) => h.y)).toEqual(std.map((h) => h.y + 22.5 - 20))
    expect(mine.map((h) => h.x)).toEqual(std.map((h) => h.x))
  })

  it("un calaix amb una altra guia (llargades i forats); un abatible amb un altre braç", () => {
    const slide: HardwareItem = { ...copyHardwareItem(item("slide-ball"), "hw-slide", "Guia curta"), lengths: [300], params: { ...item("slide-ball").params, frontOffset: 50 } }
    const b = buildModule(withRoot(base, { id: "r", front: { kind: "drawers", n: 2, heights: ["auto", "auto"], hardware: slide } }))
    expect(b.panels.filter((p) => p.role === "drawerSide").every((p) => [p.length, p.width].includes(300))).toBe(true)
    const side = b.panels.find((p) => p.id === "side-left")!
    expect(side.holes.filter((h) => h.tag === "slide")).toHaveLength(2) // 300 mm: el segon forat (a 50 + 256) no hi cap
    const arm: HardwareItem = { ...copyHardwareItem(item("flap-arm"), "hw-arm", "Braç"), params: { ...item("flap-arm").params, diameter: 10, offset: 30 } }
    const flap = buildModule(withRoot(base, { id: "r", front: { kind: "flap", dir: "down", hardware: arm } })).panels.find((p) => p.role === "flap")!
    expect(flap.holes.filter((h) => h.tag === "flap").map((h) => [h.x, h.diameter])).toEqual([[30, 10], [30, 10]])
  })

  it("un ferratge de front que no serveix: el del mòdul i l'avís `hardware`", () => {
    const b = buildModule(withRoot(base, { id: "r", front: { kind: "door", mode: "single", hinge: "left", hardware: item("slide-ball") } }))
    const ref = buildModule(withRoot(base, { id: "r", front: { kind: "door", mode: "single", hinge: "left" } }))
    expect(b.panels).toEqual(ref.panels)
    expect(b.warnings.filter((w) => w.code === "hardware")).toHaveLength(1)
  })
})

describe("migració dels ferratges (v19)", () => {
  it("els items inicials surten dels números d'abans, i el kit d'un mòdul d'abans és el mateix que el d'un de nou", () => {
    expect([...libraryFromLegacy(DEFAULT_LEGACY_HARDWARE), ...DEFAULT_HARDWARE_KITS, ...DTC_CATALOGUE_ITEMS, ...V31_ITEMS, ...V34_ITEMS, ...V35_ITEMS, ...V39_ITEMS, ...V41_ITEMS, ...V42_ITEMS, ...V43_ITEMS, ...V44_ITEMS, ...ACCESSORY_ITEMS]).toEqual(DEFAULT_HARDWARE_LIBRARY)
    expect(kitFromLegacy(DEFAULT_LEGACY_HARDWARE)).toEqual(DEFAULT_MODULE_HARDWARE)
    expect(defaultModule("m", "x").hardware).toEqual(DEFAULT_MODULE_HARDWARE)
    for (const it of DEFAULT_HARDWARE_LIBRARY) expect(HardwareItemSchema.safeParse(it).success).toBe(true)
  })

  it("mobles desats abans (catàleg i aleatoris): llegits amb l'esquema, les mateixes peces, forats i avisos", () => {
    const comps = [...catalogCorpus().slice(0, 40).map((t) => t.make()), ...Array.from({ length: 40 }, (_, i) => randomComposition(i + 1))]
    for (const c of comps) {
      const old = legacy(c)
      const parsed = CompositionSchema.parse(old)
      expect(parsed.modules.every((m) => m.hardware.hinge.engine === "cup")).toBe(true)
      const ref = buildComposition(c)
      const viaSchema = buildComposition(parsed)
      // Sense passar per l'esquema (dades crues): el constructor també els llegeix.
      const raw = buildComposition(old)
      for (const b of [viaSchema, raw]) {
        expect(b.panels).toEqual(ref.panels)
        expect(b.warnings).toEqual(ref.warnings)
      }
    }
  })

  it("números d'abans que no eren els inicials: els forats els segueixen", () => {
    const h: LegacyHardware = { ...plain(DEFAULT_LEGACY_HARDWARE), hinge: { cupDiameter: 30, cupDepth: 11, cupOffset: 21 }, magnet: { diameter: 8, depth: 4, cornerOffset: 50 } }
    h.system32.edgeOffset = 40
    const m = { ...withRoot(defaultModule("m", "x", { width: 500, height: 720, depth: 560 }), { id: "r", front: { kind: "door", mode: "single", hinge: "left" } }), hardware: h } as unknown as Module
    const door = buildModule(m).panels.find((p) => p.role === "door")!
    expect(door.holes.filter((h) => h.tag === "hinge").map((x) => [x.y, x.diameter, x.depth])).toEqual([[21, 30, 11], [21, 30, 11]])
    const kit = migrateModuleHardware(h) as typeof DEFAULT_MODULE_HARDWARE
    expect(kit.slide.params.frontOffset).toBe(40)
    expect(kit.flap.params.offset).toBe(21)
    expect(kit.magnet.params).toEqual({ diameter: 8, depth: 4, cornerOffset: 50 })
  })

  it("idempotent: migrar dues vegades (mòdul, composició, preferències) no canvia res", () => {
    const kit = migrateModuleHardware(DEFAULT_LEGACY_HARDWARE)
    expect(migrateModuleHardware(kit)).toBe(kit)
    const old = legacy(TV_LIVING_ROOM.make())
    const once = normalizeComposition(old)
    expect(normalizeComposition(once)).toEqual(once)
    expect(CompositionSchema.parse(once)).toEqual(once)

    const { hardwareLibrary: _l, hardwareDefaults: _d, ...rest } = plain(DEFAULT_SETTINGS)
    const v18 = { ...rest, version: 18, hardware: plain(DEFAULT_LEGACY_HARDWARE) }
    const a = parseSettings(v18)
    expect(a.migrated).toBe(true)
    expect(a.problems).toEqual([])
    expect(a.settings.hardwareLibrary).toEqual(DEFAULT_HARDWARE_LIBRARY)
    expect(a.settings.hardwareDefaults).toEqual(DEFAULT_HARDWARE_DEFAULTS)
    expect("hardware" in a.settings).toBe(false)
    const b = parseSettings(plain(a.settings))
    expect(b.migrated).toBe(false)
    expect(b.settings).toEqual(a.settings)
  })

  it("un .moble d'abans s'obre amb els ferratges com a kit i fa les mateixes peces", () => {
    const c = TV_LIVING_ROOM.make()
    const file = plain(buildMobleFile({ name: "Vell", composition: c, references: [] })) as Record<string, any>
    file.project.composition = legacy(c)
    const res = parseMobleFile(JSON.stringify(file))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.file.project.composition.modules[0]!.hardware).toEqual(DEFAULT_MODULE_HARDWARE)
    expect(buildComposition(res.file.project.composition).panels).toEqual(buildComposition(c).panels)
    // I un d'ara: anada i tornada amb la frontissa d'una porta.
    const mine = copyHardwareItem(item("hinge-cup"), "hw-1", "Meva")
    const withDoor = { ...c, modules: c.modules.map((m, i) => (i === 0 ? withRoot(m, { id: "r", front: { kind: "door" as const, mode: "single" as const, hinge: "left" as const, hardware: mine } }) : m)) }
    const again = parseMobleFile(mobleToJson(buildMobleFile({ name: "Nou", composition: withDoor, references: [] })))
    expect(again.ok && again.file.project.composition.modules[0]!.root.front).toEqual({ kind: "door", mode: "single", hinge: "left", hardware: mine })
  })

  it("reparació: els ferratges d'un mòdul d'abans es migren i es reparen camp a camp", () => {
    const old = legacy(TV_LIVING_ROOM.make()) as unknown as Record<string, any>
    old.modules[0].hardware.drawer.slideLengths = [300, 0]
    const r = repairComposition(old)
    expect(r.composition!.modules[0]!.hardware.slide.lengths).toEqual([300])
    expect(r.composition!.modules[0]!.hardware.hinge).toEqual(DEFAULT_MODULE_HARDWARE.hinge)
  })

  it("preferències coherents: cada lloc apunta a un item del seu tipus (si no, el primer o l'inicial)", () => {
    const lib = DEFAULT_HARDWARE_LIBRARY.filter((x) => x.engine !== "slide")
    const mine = copyHardwareItem(item("hinge-cup"), "hw-1", "Meva")
    const fixed = fixHardwareDefaults([...lib, mine, mine], { ...DEFAULT_HARDWARE_DEFAULTS, hinge: "hw-1", dowel: "hinge-cup" })
    expect(fixed.changed).toBe(true)
    expect(fixed.defaults.hinge).toBe("hw-1")
    expect(fixed.defaults.dowel).toBe("dowel")
    expect(fixed.defaults.slide).toBe("slide-ball")
    expect(fixed.library.filter((x) => x.id === "hw-1")).toHaveLength(1)
    expect(fixed.library.some((x) => x.id === "slide-ball")).toBe(true)
    expect(stepValue({ steps: [], else: 7 }, 1)).toBe(7)
  })
})

describe("referències als mobles desats (eliminar amb substitut)", () => {
  it("troba i canvia les còpies (dels mòduls, també d'abans, i de les portes)", () => {
    const c = TV_LIVING_ROOM.make()
    const mine = copyHardwareItem(item("hinge-cup"), "hw-1", "Meva")
    const doors = { ...c, modules: c.modules.map((m, i) => (i === 0 ? withRoot(m, { id: "r", split: { dir: "v" as const, sizes: ["auto", "auto"] as ("auto" | number)[], children: [{ id: "a", front: { kind: "door" as const, mode: "single" as const, hinge: "left" as const, hardware: mine } }, { id: "b" }] } }) : m)) }
    expect(hardwareRefIds(doors)).toEqual(expect.arrayContaining(["hinge-cup", "hw-1", "slide-ball"]))
    // Els jocs de calaix no tenen lloc al mòdul: només hi són si es trien a un calaix.
    // Els jocs de calaix i els push latch («només 3D») no tenen lloc al mòdul: només hi són si es trien.
    // (El catàleg DTC tampoc: només els items de l'app són el per defecte de cada lloc.)
    expect(hardwareRefIds(legacy(c))).toEqual(expect.arrayContaining(libraryFromLegacy(DEFAULT_LEGACY_HARDWARE).map((x) => x.id)))
    const other = copyHardwareItem(item("hinge-cup"), "hw-2", "Altra")
    const out = replaceHardwareRefs(doors, mine, other)
    expect(hardwareRefIds(out)).not.toContain("hw-1")
    expect(out.modules[0]!.root.split!.children[0]!.front).toMatchObject({ hardware: { id: "hw-2" } })
    expect(replaceHardwareRefs(doors, copyHardwareItem(mine, "res", "Res"), other)).toBe(doors)
    const fromLegacy = replaceHardwareRefs(legacy(c), item("hinge-cup"), other)
    expect(fromLegacy.modules.every((m) => m.hardware.hinge.id === "hw-2")).toBe(true)
  })
})

describe("còpies que no són l'item de la biblioteca amb el mateix id", () => {
  // Un mòdul d'abans migrat amb una cassoleta de 30: id `hinge-cup`, però no és el `hinge-cup` de la biblioteca.
  const lib = DEFAULT_HARDWARE_LIBRARY.filter((x) => x.engine === "cup")
  const cup30: HardwareItem = { ...item("hinge-cup"), params: { ...item("hinge-cup").params, cupDiameter: 30 } }

  it("sameHardware compara el que es fabrica (no el nom, el fabricant, la versió ni `builtin`)", () => {
    const renamed = { ...copyHardwareItem(item("hinge-cup"), "hinge-cup", "Un altre nom"), maker: "Blum", version: 7 }
    expect(sameHardware(renamed, item("hinge-cup"))).toBe(true)
    expect(isCopyOf(renamed, item("hinge-cup"))).toBe(true)
    expect(sameHardware(cup30, item("hinge-cup"))).toBe(false)
    expect(isCopyOf(copyHardwareItem(item("hinge-cup"), "hw-1", "Meva"), item("hinge-cup"))).toBe(false)
  })

  it("hardwareChoices: una còpia diferent surt a part, «còpia pròpia», i és la triada", () => {
    const res = hardwareChoices(lib, cup30)
    expect(res.options.map((o) => o.key)).toEqual([...lib.map((x) => x.id), expect.stringMatching(/^moble:.*:hinge-cup$/)])
    const own = res.options.at(-1)!
    expect(own).toMatchObject({ own: true, label: `${cup30.name} (còpia pròpia)`, item: cup30 })
    expect(res.value).toBe(own.key)
    expect(new Set(res.options.map((o) => o.key)).size).toBe(res.options.length)
    // Igual a la de la biblioteca (també amb `builtin` i un altre nom): la de la biblioteca, sense opció de més.
    const same = hardwareChoices(lib, copyHardwareItem(item("hinge-cup"), "hinge-cup", "Nom vell"))
    expect(same.options).toHaveLength(lib.length)
    expect(same.value).toBe("hinge-cup")
    // Un que ja no és a la biblioteca.
    const gone = hardwareChoices(lib, copyHardwareItem(item("hinge-cup"), "hw-esborrat", "Esborrada"))
    expect(gone.options.at(-1)).toMatchObject({ own: true, label: "Esborrada (còpia pròpia)" })
  })

  it("hardwareChoices en un front: el del mòdul (`inheritedKey`) i el propi, cadascun on toca", () => {
    // Sense propi: el del mòdul (diferent de la biblioteca) és el triat i el que treu el propi.
    const a = hardwareChoices(lib, cup30, cup30)
    expect(a.options.filter((o) => o.own)).toHaveLength(1)
    expect(a.value).toBe(a.inheritedKey)
    // Propi de la biblioteca i mòdul d'abans: dues opcions diferents.
    const b = hardwareChoices(lib, item("hinge-cup"), cup30)
    expect(b.value).toBe("hinge-cup")
    expect(b.inheritedKey).toMatch(/^moble:/)
    // Propi i mòdul, tots dos còpies diferents amb el mateix nom: es distingeixen.
    const cup32: HardwareItem = { ...cup30, params: { ...cup30.params, cupDiameter: 32 } }
    const c = hardwareChoices(lib, cup32, cup30)
    const own = c.options.filter((o) => o.own)
    expect(own.map((o) => o.label).sort()).toEqual([`${cup30.name} (còpia pròpia)`, `${cup30.name} (com el mòdul)`].sort())
    expect(c.value).not.toBe(c.inheritedKey)
    expect(own.find((o) => o.key === c.inheritedKey)!.item).toBe(cup30)
  })

  it("eliminar amb substitut només canvia les còpies iguals a l'item (no les d'abans amb el mateix id)", () => {
    const c = TV_LIVING_ROOM.make()
    const other = copyHardwareItem(item("hinge-cup"), "hw-2", "Altra")
    const door = (h: HardwareItem) => ({ kind: "door" as const, mode: "single" as const, hinge: "left" as const, hardware: h })
    const comp: Composition = {
      ...c,
      modules: c.modules.map((m, i) =>
        i === 0
          ? withRoot({ ...m, hardware: { ...m.hardware, hinge: cup30 } }, { id: "r", split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", front: door(cup30) }, { id: "b", front: door(item("hinge-cup")) }] } })
          : m,
      ),
    }
    expect(usesHardware(comp, item("hinge-cup"))).toBe(true)
    const out = replaceHardwareRefs(comp, item("hinge-cup"), other)
    const m0 = out.modules[0]!
    expect(m0.hardware.hinge).toEqual(cup30)
    expect(m0.root.split!.children[0]!.front).toMatchObject({ hardware: cup30 })
    expect(m0.root.split!.children[1]!.front).toMatchObject({ hardware: { id: "hw-2" } })
    // La resta de mòduls (còpies iguals) hi passen.
    expect(out.modules.slice(1).every((m) => m.hardware.hinge.id === "hw-2")).toBe(true)
    // Un moble que només té la còpia d'abans no fa servir l'item (no cal substitut per ell) i no canvia.
    const onlyOld: Composition = { ...c, modules: c.modules.map((m) => ({ ...m, hardware: { ...m.hardware, hinge: cup30 } })) }
    expect(usesHardware(onlyOld, item("hinge-cup"))).toBe(false)
    expect(replaceHardwareRefs(onlyOld, item("hinge-cup"), other)).toBe(onlyOld)
  })
})

describe("dibuix del patró (Preferències › Ferratges)", () => {
  it("cada ferratge inicial dibuixa les seves peces d'exemple amb el motor", () => {
    for (const it of DEFAULT_HARDWARE_LIBRARY) {
      const p = hardwarePreview(it)
      expect(p.error, it.id).toBeUndefined()
      // Els accessoris no mecanitzen res (pendent del taller): cap peça d'exemple.
      if (ACCESSORY_ITEMS.includes(it) || it.engine === "model" || it.targets.every((t) => !t.ops.length)) {
        expect(p.panels).toEqual([])
        continue
      }
      expect(p.panels.length, it.id).toBeGreaterThan(0)
      expect(p.panels.reduce((n, x) => n + x.holes.length + (x.cutouts?.length ?? 0), 0), it.id).toBeGreaterThan(0)
    }
    const door = hardwarePreview(item("hinge-cup")).panels[0]!
    expect(door.holes.map((h) => [h.x, h.y, h.diameter])).toEqual([[100, 22.5, 35], [620, 22.5, 35]])
    const handles = hardwarePreview(item("handle-bar")).panels.map((p) => p.cutouts!.map((c) => (c.kind === "circle" ? c.x : 0)))
    expect(handles).toEqual([[236, 364], [67, 163]])
  })

  it("un item que no es pot fer servir: l'error, sense peces", () => {
    const bad = { ...item("hinge-cup"), params: {} }
    expect(hardwarePreview(bad).error).toMatch(/cupDiameter|falta/)
  })
})
