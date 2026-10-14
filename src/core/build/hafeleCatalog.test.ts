import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, HardwareItemSchema, defaultModule, parseSettings, type HardwareItem, type Zone } from "../model"
import { HAFELE_CATALOGUE_ITEMS, HAFELE_DUOMATIC_ALU, HAFELE_GAS_STRUTS, HAFELE_GLASS_FRAMES, HAFELE_HANDLES, HAFELE_PROFILE_HINGES } from "../model/hafele/hafeleCatalog"
import { HAFELE_LOOX_PROFILES } from "../model/lights/hafeleLoox"
import { V35_ITEMS } from "../model/hardware"
import { buildModule } from "./buildModule"
import { handleSpec } from "./hardware"
import { hardwareMount } from "./hardwareMount"
import { builtinSolids, fixedSolids } from "./hardwareSolids"

/** Ferratges del catàleg general Häfele (preferències v35): marcs d'alumini, tiradors, suports i el perfil Loox per encastar. */
const item = (id: string): HardwareItem => structuredClone(V35_ITEMS.find((x) => x.id === id)!)
const mod = (root: Omit<Zone, "id">, size = { width: 500, height: 720, depth: 400 }) => ({ ...defaultModule("m", "Vitrina", size), root: { id: "z", ...root } })

describe("catàleg Häfele (v35)", () => {
  it("items vàlids, a la biblioteca inicial, ids únics i amb el seu mecanitzat", () => {
    expect(V35_ITEMS.length).toBeLessThanOrEqual(20)
    expect(new Set(V35_ITEMS.map((x) => x.id)).size).toBe(V35_ITEMS.length)
    for (const it of V35_ITEMS) {
      expect(HardwareItemSchema.safeParse(it).success, it.id).toBe(true)
      expect(DEFAULT_SETTINGS.hardwareLibrary.some((x) => x.id === it.id), it.id).toBe(true)
      // Tots amb mecanitzat, llevat dels marcs de vitrina (el perfil no es mecanitza, com el marc de l'app).
      if (it.engine !== "glassFrame") expect(it.targets.some((t) => t.ops.length > 0), it.id).toBe(true)
    }
    expect(HAFELE_CATALOGUE_ITEMS.every((x) => x.maker === "Häfele" && x.builtin)).toBe(true)
  })

  it("porta de vidre: la frontissa es tria com a les de fusta; la Metallamat A fa la placa al lateral, el marc sol no", () => {
    const frame = HAFELE_GLASS_FRAMES[0]!
    const hinge = structuredClone(HAFELE_PROFILE_HINGES[0]!)
    const door = { kind: "door" as const, mode: "single" as const, hinge: "left" as const, glass: true }
    // Només el marc (la frontissa de l'app, sense placa): cap forat de placa.
    const plain = buildModule(mod({ front: { ...door, frame: structuredClone(frame) } }))
    expect(plain.panels.flatMap((p) => p.holes).filter((h) => h.tag === "plate")).toHaveLength(0)
    expect(plain.panels.some((p) => p.role === "door")).toBe(false)
    // Amb la Metallamat A: la placa (Ø5 × 12) a la filera del lateral esquerre, dues frontisses en una porta de ~720.
    const b = buildModule(mod({ front: { ...door, frame: structuredClone(frame), hardware: hinge } }))
    const left = b.panels.find((p) => p.id === "side-left")!
    expect(left.holes.filter((h) => h.tag === "plate")).toHaveLength(4)
    expect(b.panels.find((p) => p.id === "side-right")!.holes.filter((h) => h.tag === "plate")).toHaveLength(0)
    expect(b.warnings.filter((w) => w.code === "hinge")).toEqual([])
    // Cap cassoleta enlloc (el perfil no es mecanitza) i el perfil, de plata.
    expect(b.panels.flatMap((p) => p.holes).some((h) => h.tag === "hinge")).toBe(false)
    const bar = b.extras.find((p) => p.id.endsWith("-left") && p.name === "perfil vitrina")!
    expect(bar.width).toBe(frame.params.frame)
    expect(bar.material).toBe("Alumini anoditzat plata")
    expect(DEFAULT_SETTINGS.materials.some((m) => m.name === "Alumini anoditzat plata")).toBe(true)
    expect(buildModule(mod({ front: door })).extras.find((p) => p.name === "perfil vitrina")!.material).toBe("Alumini negre")
  })

  it("porta de vidre: la frontissa es veu com és (cassoleta al perfil, braç i placa al lateral)", () => {
    const b = buildModule(mod({ front: { kind: "door", mode: "single", hinge: "left", glass: true, frame: structuredClone(HAFELE_GLASS_FRAMES[0]!), hardware: structuredClone(HAFELE_DUOMATIC_ALU[0]!) } }))
    const bar = b.extras.find((p) => p.name === "perfil vitrina" && p.id.endsWith("-left"))!
    const cups = bar.holes.filter((h) => h.tag === "hinge")
    expect(cups).toHaveLength(2)
    expect(cups[0]).toMatchObject({ diameter: 35.7, face: "A", edge: "bottom", y: 19.35 })
    // La cassoleta i el braç van amb el perfil (s'obren); la placa, al lateral esquerre.
    expect(builtinSolids(bar).length).toBeGreaterThanOrEqual(8)
    const fixed = fixedSolids([...b.panels, ...b.extras])
    expect(fixed.get("side-left")).toHaveLength(2)
    // Cap forat del perfil va a la CNC: el perfil és a extras.
    expect(b.panels.some((p) => p.holes.some((h) => h.tag === "hinge"))).toBe(false)
  })

  it("abatible de vidre que obre amunt: frontisses al perfil de dalt i la placa a la tapa, com la vitrina de casa", () => {
    const b = buildModule(mod({ front: { kind: "flap", dir: "up", glass: true, frame: structuredClone(HAFELE_GLASS_FRAMES[0]!) } }, { width: 600, height: 400, depth: 330 }))
    const top = b.extras.find((p) => p.name === "perfil vitrina" && p.id.endsWith("-top"))!
    expect(top.holes.filter((h) => h.tag === "hinge")).toHaveLength(2)
    const tapa = b.panels.find((p) => p.role === "top")!
    expect(tapa.holes.filter((h) => h.tag === "plate")).toHaveLength(4)
    expect(fixedSolids([...b.panels, ...b.extras]).get(tapa.id)).toHaveLength(2)
    expect(b.warnings.filter((w) => w.code === "hinge")).toEqual([])
  })

  it("pistó de gas (FF 4.224): el bracket al lateral, dos forats Ø5 a 32, a G del cantell de gir i a 37 del davant; es dibuixa", () => {
    const gas = structuredClone(HAFELE_GAS_STRUTS[0]!)
    const b = buildModule(mod({ front: { kind: "flap", dir: "up", glass: true, frame: structuredClone(HAFELE_GLASS_FRAMES[0]!), hardware: gas } }, { width: 600, height: 400, depth: 330 }))
    for (const id of ["side-left", "side-right"]) {
      const hs = b.panels.find((p) => p.id === id)!.holes.filter((h) => h.tag === "flap")
      expect(hs, id).toHaveLength(2)
      expect(Math.abs(hs[0]!.x - hs[1]!.x) + Math.abs(hs[0]!.y - hs[1]!.y)).toBeCloseTo(32)
    }
    expect(b.extras.filter((p) => p.label.endsWith(": pistó"))).toHaveLength(2)
    // Una porta de vidre no porta la filera System 32: només els forats de la placa.
    const door = buildModule(mod({ front: { kind: "door", mode: "single", hinge: "left", glass: true, frame: structuredClone(HAFELE_GLASS_FRAMES[0]!), hardware: structuredClone(HAFELE_PROFILE_HINGES[0]!) } }))
    expect(door.panels.flatMap((p) => p.holes).filter((h) => h.tag === "system32")).toHaveLength(0)
  })

  it("tiradors: la distància entre centres més gran que hi cap al front", () => {
    const h1935 = handleSpec(HAFELE_HANDLES.find((x) => x.id === "handle-hafele-h1935")!)
    expect(h1935.pitch(150)).toBe(128)
    expect(h1935.pitch(230)).toBe(160)
    expect(h1935.pitch(500)).toBe(192)
    const b = buildModule(mod({ front: { kind: "drawers", n: 1, heights: ["auto"], handle: item("handle-hafele-d12") } }, { width: 600, height: 200, depth: 500 }))
    const front = b.panels.find((p) => p.role === "drawerFront")!
    const holes = (front.cutouts ?? []).filter((c) => c.tag === "handle")
    expect(holes).toHaveLength(2)
    if (holes[0]!.kind === "circle" && holes[1]!.kind === "circle") expect(Math.abs(holes[0]!.x - holes[1]!.x)).toBe(480)
  })

  it("perfil Loox d'11 mm per encastar: la ranura de 18 × 11 a la tapa i la tira a la comanda", () => {
    const b = buildModule(mod({ led: { hardware: structuredClone(HAFELE_LOOX_PROFILES[0]!) } }, { width: 800, height: 600, depth: 450 }))
    const g = b.panels.find((p) => p.role === "top")!.grooves.filter((x) => x.tag === "light")
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ h: 18, depth: 11 })
    expect(b.lightKits[0]!.lines[0]).toMatchObject({ item: "833.72.846" })
  })

  it("«Com va muntat» de tots, sense error", () => {
    for (const it of V35_ITEMS) expect(hardwareMount(it).error, it.id).toBeUndefined()
  })

  it("v36: un marc Häfele desat a la v35 sense material rep la plata, i el material s'afegeix", () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    old.version = 35
    old.materials = old.materials.filter((m: { name: string }) => m.name !== "Alumini anoditzat plata")
    for (const x of old.hardwareLibrary) if (x.engine === "glassFrame") delete x.material
    const res = parseSettings(old)
    expect(res.settings.hardwareLibrary.find((x) => x.id === HAFELE_GLASS_FRAMES[0]!.id)!.material).toBe("Alumini anoditzat plata")
    expect(res.settings.hardwareLibrary.find((x) => x.id === "glass-frame-20")!.material).toBeUndefined()
    expect(res.settings.materials.some((m) => m.name === "Alumini anoditzat plata")).toBe(true)
  })

  it("v35: s'afegeixen a unes preferències d'abans (per id)", () => {
    const v34 = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), version: 34, hardwareLibrary: DEFAULT_SETTINGS.hardwareLibrary.filter((x) => !V35_ITEMS.some((k) => k.id === x.id)) }
    const res = parseSettings(v34)
    expect(res.migrated).toBe(true)
    for (const it of V35_ITEMS) expect(res.settings.hardwareLibrary.some((x) => x.id === it.id), it.id).toBe(true)
    expect(parseSettings(JSON.parse(JSON.stringify(res.settings))).migrated).toBe(false)
  })
})
