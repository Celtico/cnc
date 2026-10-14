import { describe, expect, it } from "vitest"
import { DEFAULT_GRILLE, DEFAULT_HARDWARE_KITS, DEFAULT_MODULE_HARDWARE, HARDWARE_SLOTS, defaultModule, isLegacyHardware, setFront, setShelves, usedHardwareSlots, type Carcass, type Composition, type Front, type Module, type ModuleHardware, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { catalogCorpus, int, MATERIALS, pick, randomComposition, rng, type Rnd } from "./testCorpus"

/**
 * Regla «res amagat compta»: el que la UI amaga perquè la seva opció és apagada no pot canviar les peces ni els avisos.
 * La llista de camps amagats surt dels formularis (`CarcassForm`, `JointForm`, `MaterialsForm`, `ZonePanel`) i es
 * reescriu aquí a part (no amb `visibleModule`), perquè el test no es doni la raó a si mateix.
 */

/** Cantonades surt a l'inspector (CarcassForm): hi ha laterals, no són parets buides i hi ha tapa o base a baix de tot. */
const jointShown = (c: Carcass) => (c.sides.left || c.sides.right) && !c.hollow && !(c.top.kind === "none" && (c.base.kind === "open" || c.base.kind === "plinth"))

/** Omple a l'atzar tots els camps que l'inspector no ensenya (o que valen el mateix que el valor per defecte). */
function scrambleHidden(m: Module, r: Rnd): Module {
  const c: Carcass = { ...m.carcass }
  // Sense fons: material i gruix del fons no surten (MaterialsForm, `hasBack`).
  if (c.back === "none") {
    c.backMaterial = pick(r, MATERIALS)
    c.backThickness = pick(r, [3, 8, 10, 16, 19, 30])
  }
  // Ranura del fons (Mòdul › Caixa): només en ranura. El joc del fons en ranura no surt mai: només compta en ranura.
  if (c.back !== "groove") {
    c.backSetback = int(r, 0, 60)
    c.backClearance = pick(r, [0, 0.5, 1, 2, 4])
  }
  // Retirada del fons (Mòdul › Caixa): només encastat.
  if (c.back !== "inset") {
    if (r() < 0.5) delete c.backInsetSetback
    else c.backInsetSetback = int(r, 0, 60)
  }
  // Cantonades: si el control no surt, qualsevol valor; si surt, «Normals» = buit = "butt".
  if (!jointShown(c)) {
    const j = pick(r, [undefined, "butt", "mitre"] as const)
    if (j) c.joint = j
    else delete c.joint
  } else if ((c.joint ?? "butt") === "butt") {
    if (r() < 0.5) c.joint = "butt"
    else delete c.joint
  }
  // Fons del calaix (MaterialsForm): només amb calaixos.
  if (!anyBuiltDrawers(m.root, { left: c.sides.left, right: c.sides.right }) && r() < 0.5) c.drawerBottomMaterial = pick(r, MATERIALS)
  // Tauler de taula: només amb la tapa sencera.
  if (c.top.kind !== "full")
    c.tableTop = r() < 0.5 ? { overhang: int(r, 0, 300) } : { overhang: int(r, 0, 300), shape: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }
  const fronts = { ...m.fronts }
  if (!fronts.style && r() < 0.5) fronts.style = "overlay"
  if (!fronts.handles && r() < 0.5) fronts.handles = "bar"
  // Mòdul › Caixa: sense cap front que es faci (els tapats no compten) no surten l'estil ni les folgances;
  // sense cap prestatge (ni llum) que es retiri, el retranqueig.
  if (!anyBuiltFront(m.root, { left: c.sides.left, right: c.sides.right })) {
    // Materials › Fronts tampoc no surt.
    if (r() < 0.5) c.frontMaterial = pick(r, MATERIALS)
    if (r() < 0.5) fronts.style = pick(r, ["overlay", "inset"] as const)
    fronts.outerGap = pick(r, [0, 1.5, 4, 10])
    fronts.betweenGap = pick(r, [0, 2, 6])
  }
  if (!anyRetiredShelf(m.root, { left: c.sides.left, right: c.sides.right })) c.shelfSetback = int(r, 0, 100)
  // Interior › Divisió › «Peces de dins»: sense dividir l'arrel no surt (i 0 = sense valor).
  if (!anyInnerPiece(m.root)) {
    const g = pick(r, [undefined, 0, 0.5, 1, 3])
    if (g === undefined) delete c.innerClearance
    else c.innerClearance = g
  } else if (!c.innerClearance && r() < 0.5) c.innerClearance = 0
  // Llocs de ferratge que el mòdul no fa servir (Mòdul › Unió només ensenya l'espiga si `usedHardwareSlots` la té): un item
  // d'un altre tipus o un joc sense `kit` no canvia res ni avisa.
  const used = usedHardwareSlots(m)
  const hardware = isLegacyHardware(m.hardware) ? m.hardware : { ...(m.hardware as ModuleHardware) }
  if (!isLegacyHardware(m.hardware))
    for (const { slot } of HARDWARE_SLOTS) {
      if (used.has(slot) || r() < 0.4) continue
      ;(hardware as ModuleHardware)[slot] = r() < 0.5 ? structuredClone(DEFAULT_MODULE_HARDWARE.dowel) : { ...structuredClone(DEFAULT_MODULE_HARDWARE.slide), engine: "drawerKit", name: "Joc sense dades" }
    }
  return { ...m, carcass: c, fronts, hardware, root: scrambleZone(m.root, r, m.fronts.handles === "none", false, { left: c.sides.left, right: c.sides.right }, false, true) }
}

/**
 * Algun front que es fa: el d'un compartiment aguantat pels quatre costats que no és dins d'un altre amb front (escrit a
 * part de `walkBuiltZones` i `zoneBoundsMap`).
 */
function anyBuiltFront(z: Zone, sides: Sides, covered = false, isRoot = true): boolean {
  const built = frontBuilt(z, sides, covered, isRoot)
  if (built) return true
  const n = z.split?.children.length ?? 0
  return !!z.split?.children.some((c, i) => anyBuiltFront(c, childSides(sides, z.split!.dir, i, n), covered, false))
}

/** Algun calaix que es fa (com `anyBuiltFront`, només els calaixos). */
function anyBuiltDrawers(z: Zone, sides: Sides, covered = false, isRoot = true): boolean {
  const built = frontBuilt(z, sides, covered, isRoot)
  if (built && z.front!.kind === "drawers") return true
  const n = z.split?.children.length ?? 0
  return !!z.split?.children.some((c, i) => anyBuiltDrawers(c, childSides(sides, z.split!.dir, i, n), covered || built, false))
}

/**
 * Algun compartiment final (no de calaixos ni de front fix que es fan, ni tapat per un front fix de tota la zona que es
 * fa) amb prestatges o amb llum.
 */
function anyRetiredShelf(z: Zone, sides: Sides, covered = false, fixedCover = false, isRoot = true): boolean {
  const built = frontBuilt(z, sides, covered, isRoot)
  if (z.split) {
    const n = z.split.children.length
    return z.split.children.some((c, i) => anyRetiredShelf(c, childSides(sides, z.split!.dir, i, n), covered || built, fixedCover || (built && z.front!.kind === "panel"), false))
  }
  if (fixedCover || z.front?.kind === "drawers" || (z.front?.kind === "panel" && !covered)) return false
  return (z.shelves?.n ?? 0) > 0 || !!z.led
}

/** Peces de dins: l'arrel és dividida (tots els divisors i prestatges fixos la porten; sense dividir, cap). */
function anyInnerPiece(root: Zone): boolean {
  return (root.split?.children.length ?? 0) > 1
}

function randomShelves(r: Rnd): Zone["shelves"] {
  return { n: int(r, 0, 5), adjustable: r() < 0.5, ...(r() < 0.5 ? { thickness: pick(r, [40, 60]) } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
}

/**
 * Sense una peça a cada costat del compartiment (lateral o divisor, escrit a part de `zoneBoundsMap`) no surten
 * Prestatges ni Accessoris: cap prestatge, filera, barra ni llum no compta.
 */
type Sides = { left: boolean; right: boolean }

const childSides = (sides: Sides, dir: "v" | "h", i: number, n: number): Sides => (dir === "v" ? { left: sides.left || i > 0, right: sides.right || i < n - 1 } : sides)

/**
 * Un front només es fa aguantat pels quatre costats. A sota i a sobre sempre ho és: la base o la tapa del mòdul, la que
 * falta («Sense base», «Sense tapa», per decisió de l'usuari: es queda com està) o un travesser. Queden els costats.
 */
const frontHeld = (sides: Sides): boolean => sides.left && sides.right

/**
 * El front de la zona es fa: aguantat, no tapat i, en una zona dividida, només les portes de l'arrel (Mòdul › Portes; el
 * front fix de tota la zona i els fronts de les divisions de dins no es fan).
 */
const frontBuilt = (z: Zone, sides: Sides, covered: boolean, isRoot: boolean): boolean =>
  !!z.front && frontHeld(sides) && !covered && (!z.split || (isRoot && z.front.kind === "door"))

/** `fixedCover`: tapat per un front fix de tota la zona que es fa (ni Prestatges ni Accessoris, com el front fix propi). */
function scrambleZone(z: Zone, r: Rnd, noHandles: boolean, covered: boolean, sides: Sides, fixedCover: boolean, isRoot = false): Zone {
  const out: Zone = { ...z }
  const f = z.front
  if (r() < 0.5) {
    const fronts: NonNullable<Zone["fronts"]> = {}
    for (const rf of REMEMBERED) if (rf.kind !== f?.kind && r() < 0.5) fronts[rf.kind] = structuredClone(rf)
    if (Object.keys(fronts).length) out.fronts = fronts
  }
  const held = frontHeld(sides)
  const built = frontBuilt(z, sides, covered, isRoot)
  if (z.split && built) {
    // Portes de tota la zona: els fronts dels compartiments de dins queden tapats i no es fan (es conserven).
    out.split = { ...z.split, children: z.split.children.map((c) => (r() < 0.5 ? coverFront(c, r) : c)) }
  }
  if (z.split) {
    // Un compartiment dividit no ensenya Prestatges (ni la barra).
    if (r() < 0.5) out.shelves = randomShelves(r)
    if (r() < 0.3) out.rail = {}
    if (r() < 0.3) out.led = { hardware: { ...DEFAULT_MODULE_HARDWARE.led, params: { ...DEFAULT_MODULE_HARDWARE.led.params, height: 12 } } }
    const n = out.split!.children.length
    const v = out.split!.dir === "v"
    out.split = { ...out.split!, children: out.split!.children.map((c, i) => scrambleZone(c, r, noHandles, covered || built, childSides(sides, v ? "v" : "h", i, n), fixedCover || (built && z.front?.kind === "panel"))) }
  } else if (!sides.left || !sides.right) {
    // Res a cada costat per aguantar-los: ni Prestatges ni Accessoris.
    if (r() < 0.6) out.shelves = randomShelves(r)
    if (r() < 0.3) out.rail = {}
    if (r() < 0.3) out.led = {}
  } else if (((f?.kind === "drawers" || f?.kind === "panel") && !covered) || fixedCover) {
    // Calaixos o front fix (el seu o el de tota la zona que el tapa): les seccions Prestatges i Accessoris no surten.
    if (r() < 0.6) out.shelves = randomShelves(r)
    if (r() < 0.3) out.rail = {}
    if (r() < 0.3) out.led = {}
  } else {
    // Cap prestatge: «a ras» i el gruix no surten; regulables sí (i sense `shelves`, no regulables).
    const n = z.shelves?.n ?? 0
    if (n === 0 && !z.shelves?.adjustable) out.shelves = r() < 0.4 ? undefined : { n: 0, adjustable: false, ...(r() < 0.5 ? { thickness: 50 } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
    else if (n === 0) out.shelves = { n: 0, adjustable: true, ...(r() < 0.5 ? { thickness: 50 } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
    if (!out.shelves) delete out.shelves
    // Un `false` d'abans (fitxers antics): cap barra.
    if (!z.rail && r() < 0.3) (out as { rail?: unknown }).rail = false
  }
  if ((!held || (z.split && !isRoot)) && !covered) {
    // Sense un lateral o divisor a cada costat el front no es fa (el compartiment és com obert): qualsevol front o cap.
    // Tampoc el d'una divisió de dins (només les portes de l'arrel tapen tota la zona).
    const any = pick(r, [undefined, ...REMEMBERED, { kind: "door", mode: "single", hinge: "right", hardware: structuredClone(DEFAULT_MODULE_HARDWARE.dowel) } as Front])
    if (any) out.front = structuredClone(any)
    else delete out.front
  } else if (f) out.front = scrambleFront(f, r, noHandles)
  return out
}

/** Un front qualsevol (amb ferratges propis dolents) a un compartiment tapat pel front d'una zona de més amunt. */
function coverFront(z: Zone, r: Rnd): Zone {
  if (z.split) return { ...z, split: { ...z.split, children: z.split.children.map((c) => coverFront(c, r)) } }
  const bad = structuredClone(DEFAULT_MODULE_HARDWARE.dowel)
  const front = pick(r, [
    { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"], hardware: bad },
    { kind: "flap", dir: "down", hardware: bad, handle: OTHER_HANDLE },
    { kind: "door", mode: "single", hinge: "left", hardware: bad },
    { kind: "grille", pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left" },
    { kind: "panel" },
  ] as Front[])
  return { ...z, front }
}

/** Un tirador diferent del del mòdul (una altra distància i Ø): el que es triaria a «Tirador» d'un front. */
const OTHER_HANDLE = { ...DEFAULT_MODULE_HARDWARE.handle, id: "hw-tirador-amagat", params: { ...DEFAULT_MODULE_HARDWARE.handle.params, diameter: 8 }, pitch: { steps: [], else: 320 } }

/** Un front recordat d'un altre tipus (`Zone.fronts`, el que es recupera en tornar a aquell contingut): no construeix res. */
const REMEMBERED: Front[] = [
  { kind: "drawers", n: 4, heights: [150, "auto", "auto", "auto"], kit: { closing: "push", back: "metal" }, handle: OTHER_HANDLE },
  { kind: "door", mode: "double", hinge: "right", glass: true },
  { kind: "flap", dir: "up", hardware: { ...DEFAULT_MODULE_HARDWARE.flap, params: { ...DEFAULT_MODULE_HARDWARE.flap.params, diameter: 10 } } },
  { kind: "grille", pattern: DEFAULT_GRILLE, mount: "hinged", hinge: "right", hatch: { x: 50, y: 50, w: 120, h: 120 } },
  { kind: "panel" },
]

function scrambleFront(f: Front, r: Rnd, _noHandles: boolean): Front {
  // (El «Tirador» de cada front compta sempre, també amb el mòdul push: el del mòdul només és el per defecte.)
  switch (f.kind) {
    case "drawers":
      // Només es veu el nombre de calaixos: les alçades de més no compten. Les opcions del joc de calaix (tancament,
      // darrere) només surten amb un joc triat a «Guia»: amb la guia normal no compten.
      return {
        ...f,
        heights: [...f.heights.slice(0, f.n), ...Array.from({ length: int(r, 0, 3) }, () => pick(r, ["auto", 120, 300] as const))],
        ...(f.hardware?.engine !== "drawerKit" && r() < 0.5 ? { kit: { closing: pick(r, ["push", "pushSoft"] as const), back: "metal" as const } } : {}),
        // El joc de cada calaix: amb la guia normal no compta (ni els dels calaixos de més).
        ...(f.hardware?.engine !== "drawerKit" && r() < 0.5 ? { drawerSlides: [null, structuredClone(DEFAULT_HARDWARE_KITS[0]!)] } : {}),
      }
    case "door":
      // Dues portes: no surten les frontisses.
    {
      const d = f.mode === "double" ? { ...f, hinge: pick(r, ["left", "right"] as const) } : f
      // Porta de vidre: frontisses del perfil; la frontissa triada (cassoletes) no surt ni compta. Ni el tirador triat.
      // Sense vidre, el marc de vitrina triat no compta.
      // De vidre, la frontissa i el tirador es trien i compten (per decisió de l'usuari, v41): res amagat.
      if (f.glass) return d
      return r() < 0.5 ? { ...d, frame: { ...DEFAULT_MODULE_HARDWARE.glassFrame, params: { frame: 30, glass: 6 } } } : d
    }
    case "grille": {
      const p = f.pattern
      const pattern = p.kind === "holes" ? { ...p, slotWidth: int(r, 3, 30), slotGap: int(r, 3, 40) } : { ...p, holeDiameter: int(r, 3, 30), holePitch: int(r, 8, 60) }
      // Les frontisses de la reixeta no surten mai; amb imants no compten. L'imant triat només compta amb imants (desmuntable o trapa).
      const magnet = f.mount === "hinged" && !f.hatch && r() < 0.5 ? { hardware: { ...DEFAULT_MODULE_HARDWARE.magnet, params: { ...DEFAULT_MODULE_HARDWARE.magnet.params, diameter: 20 } } } : {}
      return { ...f, pattern, ...magnet, ...(f.mount === "removable" ? { hinge: pick(r, ["left", "right"] as const) } : {}) }
    }
    default:
      return f
  }
}

/** El que en surt per fabricar i mostrar: peces, elements sense nesting i avisos. */
const out = (c: Composition) => {
  const b = buildComposition(c)
  return JSON.stringify({ panels: b.panels, extras: b.extras, warnings: b.warnings })
}

const scrambled = (c: Composition, r: Rnd): Composition => ({ ...c, modules: c.modules.map((m) => scrambleHidden(m, r)) })

describe("res amagat compta: els camps de les opcions apagades no canvien res", () => {
  it("plantilles del catàleg", () => {
    const bad: string[] = []
    const r = rng(7)
    for (const t of catalogCorpus()) {
      const c = t.make()
      const ref = out(c)
      for (let k = 0; k < 2; k++) if (out(scrambled(c, r)) !== ref) bad.push(t.id)
    }
    expect([...new Set(bad)]).toEqual([])
  })
  it("mòduls aleatoris (fons, cantonades, fronts, base, parets buides, tauler de taula, ranura d'aire, calaixos, portes, prestatges, abatibles, reixetes)", () => {
    const bad: number[] = []
    const r = rng(11)
    for (let seed = 1; seed <= 300; seed++) {
      const c = randomComposition(seed)
      const ref = out(c)
      for (let k = 0; k < 3; k++) if (out(scrambled(c, r)) !== ref) bad.push(seed)
    }
    expect([...new Set(bad)]).toEqual([])
  })
  it("mòduls aleatoris amb la folgança de les peces de dins (1 mm): només compta amb l'arrel dividida", () => {
    const bad: number[] = []
    const r = rng(13)
    for (let seed = 1; seed <= 150; seed++) {
      const base = randomComposition(seed)
      const c = { ...base, modules: base.modules.map((m) => ({ ...m, carcass: { ...m.carcass, innerClearance: 1 } })) }
      const ref = out(c)
      for (let k = 0; k < 2; k++) if (out(scrambled(c, r)) !== ref) bad.push(seed)
    }
    expect([...new Set(bad)]).toEqual([])
  })
})

// --- Independència del camí: les mateixes accions de la UI en un altre ordre ---------------------------------------

type Op = (m: Module) => Module
const carcass = (patch: Partial<Carcass>): Op => (m) => ({ ...m, carcass: { ...m.carcass, ...patch } })
/** CarcassForm › Fons (passar a encastat amb un fons prim el posa «Com el cos»). */
const setBack = (back: Carcass["back"]): Op => (m) => {
  const c = m.carcass
  return carcass(back === "inset" && c.back !== "inset" && c.backThickness < 15 ? { back, backMaterial: c.material, backThickness: c.thickness } : { back })(m)
}
/** CarcassForm › Cantonades. */
const setJoint = (joint: "butt" | "mitre"): Op => carcass({ joint: joint === "butt" ? undefined : joint })
/** MaterialsForm › Fons «Com el cos» (mateix material i gruix). */
const backLikeBody: Op = (m) => carcass({ backMaterial: m.carcass.material, backThickness: m.carcass.thickness })(m)
/** ZonePanel › Contingut del compartiment arrel. */
const rootFront = (front: Front | null): Op => (m) => ({ ...m, root: setFront(m.root, m.root.id, front) })
const drawers = rootFront({ kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] })
/** ZonePanel › Prestatges › Quantitat i Regulables. */
const shelvesN = (n: number): Op => (m) => {
  const z = m.root
  return { ...m, root: setShelves(z, z.id, n > 0 || z.shelves ? { ...z.shelves, n: Math.max(0, n), adjustable: z.shelves?.adjustable ?? true } : null) }
}
const adjustable = (on: boolean): Op => (m) => ({ ...m, root: setShelves(m.root, m.root.id, { ...m.root.shelves, n: m.root.shelves?.n ?? 0, adjustable: on }) })
const thickShelves: Op = (m) => ({ ...m, root: setShelves(m.root, m.root.id, { n: m.root.shelves?.n ?? 0, adjustable: m.root.shelves?.adjustable ?? true, thickness: 50 }) })
/** CarcassForm › Tapa, base i tauler de taula. */
const setTop = (k: "full" | "ventSlot" | "grille" | "none"): Op => carcass({ top: k === "ventSlot" ? { kind: "ventSlot", gap: 60 } : k === "grille" ? { kind: "grille", pattern: DEFAULT_GRILLE } : { kind: k } })
const tableTop = (on: boolean): Op => carcass({ tableTop: on ? { overhang: 30 } : undefined })
const plinth = carcass({ base: { kind: "plinth", height: 60, setback: 30 } })
const handlesNone: Op = (m) => ({ ...m, fronts: { ...m.fronts, handles: "none" } })

/** Mòdul en blanc amb els valors inicials de les preferències (cos de 19 de melamina, fons de DM de 10). */
const start = (): Module => defaultModule("m1", "Mòdul 1", { material: "Melamina blanca", backMaterial: "DM (fons)", backThickness: 10 })
const run = (ops: Op[]) => out({ modules: [ops.reduce((m, op) => op(m), start())], references: [] })

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
}

describe("independència del camí: el mateix estat visible fa el mateix moble", () => {
  it("el cas de l'usuari: fons de 19 mm, calaixos, inglet i treure el fons, en qualsevol ordre", () => {
    const ref = run([drawers, setJoint("mitre"), setBack("none")])
    // Tal com ho va fer: fons «com el cos» (19 mm), calaixos, inglet, treure el fons…
    expect(run([backLikeBody, drawers, setJoint("mitre"), setBack("none")])).toBe(ref)
    // …i el camí que va fer per treure l'avís.
    expect(run([backLikeBody, drawers, setJoint("mitre"), setBack("none"), setBack("groove"), setJoint("butt"), setBack("none"), setJoint("mitre")])).toBe(ref)
    // Fons encastat (passa a 19 mm sol) i després sense fons.
    expect(run([setBack("inset"), drawers, setJoint("mitre"), setBack("none")])).toBe(ref)
    for (const p of permutations([drawers, setJoint("mitre"), setBack("none"), handlesNone])) {
      const want = run([drawers, setJoint("mitre"), setBack("none"), handlesNone])
      expect(run(p)).toBe(want)
      expect(run([backLikeBody, ...p])).toBe(want)
    }
  })
  it("cantonades amagades (sense tapa i amb sòcol): l'inglet d'abans no compta", () => {
    const ref = run([drawers, setTop("none"), plinth])
    for (const p of permutations([setJoint("mitre"), setTop("none"), plinth])) expect(run([drawers, ...p])).toBe(ref)
  })
  it("tauler de taula amagat (la tapa ja no és sencera)", () => {
    expect(run([tableTop(true), setTop("ventSlot")])).toBe(run([setTop("ventSlot")]))
    expect(run([tableTop(true), setJoint("mitre"), setTop("grille")])).toBe(run([setJoint("mitre"), setTop("grille")]))
  })
  it("prestatges: calaixos i cap prestatge", () => {
    // Prestatges i després calaixos (la secció Prestatges desapareix) = calaixos.
    expect(run([shelvesN(3), thickShelves, drawers])).toBe(run([drawers]))
    // Tres prestatges gruixuts, no regulables, i després cap = mai cap prestatge.
    expect(run([shelvesN(3), thickShelves, adjustable(false), shelvesN(0)])).toBe(run([shelvesN(0), adjustable(false)]))
    const noShelves: Op = (m) => ({ ...m, root: setShelves(m.root, m.root.id, null) })
    expect(run([shelvesN(0), adjustable(false)])).toBe(run([noShelves]))
    // Regulables sense cap prestatge (es veu): les fileres hi són, vingui d'on vingui.
    expect(run([shelvesN(2), thickShelves, shelvesN(0)])).toBe(run([noShelves, adjustable(true)]))
  })
  it("sense un lateral, els prestatges, les fileres, la barra i la llum d'abans no compten (ni prestatges flotants)", () => {
    const noLeft = carcass({ sides: { left: false, right: true } })
    const noShelves: Op = (m) => ({ ...m, root: setShelves(m.root, m.root.id, null) })
    const rail: Op = (m) => ({ ...m, root: { ...m.root, rail: {}, led: {} } })
    const ref = run([noLeft, noShelves])
    for (const p of permutations([shelvesN(3), thickShelves, rail, noLeft])) expect(run(p)).toBe(ref)
    // Tornar a posar el lateral recupera els prestatges que hi havia.
    expect(run([shelvesN(3), noLeft, carcass({ sides: { left: true, right: true } })])).toBe(run([shelvesN(3)]))
  })
  it("front fix: els prestatges, les fileres, la barra i la llum d'abans no compten i tornen en canviar el contingut", () => {
    const noShelves: Op = (m) => ({ ...m, root: setShelves(m.root, m.root.id, null) })
    const rail: Op = (m) => ({ ...m, root: { ...m.root, rail: {}, led: {} } })
    const panel = rootFront({ kind: "panel" })
    const ref = run([noShelves, panel])
    for (const p of permutations([shelvesN(3), thickShelves, rail, panel])) expect(run(p)).toBe(ref)
    expect(run([shelvesN(2), adjustable(true), panel])).toBe(ref)
    // Tornar a obert o a porta: els prestatges i els accessoris hi tornen.
    expect(run([shelvesN(3), rail, panel, rootFront(null)])).toBe(run([shelvesN(3), rail]))
    const door = rootFront({ kind: "door", mode: "single", hinge: "left" })
    expect(run([shelvesN(3), rail, panel, door])).toBe(run([shelvesN(3), rail, door]))
  })
  it("front de tota la zona: només les portes de l'arrel es fan; el front fix i els de les divisions de dins es conserven sense fer-se", () => {
    // L'«Interior» dividit en dos (ids fixos) i els seus compartiments.
    const split = (dir: "v" | "h"): Op => (m) => ({ ...m, root: { id: m.root.id, split: { dir, sizes: ["auto", "auto"], children: [{ id: "a" }, { id: "b" }] } } })
    const at = (id: string, f: (z: Zone) => Zone): Op => (m) => ({ ...m, root: { ...m.root, split: { ...m.root.split!, children: m.root.split!.children.map((c) => (c.id === id ? f(c) : c)) } } })
    const shelves = at("a", (z) => ({ ...z, shelves: { n: 3, adjustable: true, thickness: 50 } }))
    const rows = at("b", (z) => ({ ...z, shelves: { n: 0, adjustable: true } }))
    const acc = at("b", (z) => ({ ...z, rail: {}, led: {} }))
    const panel = rootFront({ kind: "panel" })
    const door = rootFront({ kind: "door", mode: "double", hinge: "left" })
    // El front fix de tota la zona ja no es tria (Mòdul › Portes: només portes): no es fa ni amaga res (res amagat compta).
    const ref = run([split("h"), shelves, rows, acc])
    for (const p of permutations([shelves, rows, acc, panel])) expect(run([split("h"), ...p])).toBe(ref)
    // Les portes de l'arrel, sí (armari amb penjador darrere): prestatges i accessoris hi són i el front fix d'abans no compta.
    expect(run([split("h"), shelves, rows, acc, panel, door])).toBe(run([split("h"), shelves, rows, acc, door]))
    expect(run([split("h"), shelves, rows, acc, door])).not.toBe(ref)
    expect(run([split("h"), shelves, rows, acc, door])).not.toBe(run([split("h"), door]))
    // Treure les portes: com sense front.
    expect(run([split("h"), shelves, acc, door, rootFront(null)])).toBe(run([split("h"), shelves, acc]))
    // Una divisió de dins amb front (portes o fix): no es fa i no tapa els seus compartiments (el seu front es fa).
    const nested = (front?: Front): Op => (m) => ({ ...m, root: { id: m.root.id, split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "p", ...(front ? { front } : {}), split: { dir: "v", sizes: ["auto", "auto"], children: [{ id: "a", shelves: { n: 2, adjustable: false } }, { id: "c", front: { kind: "drawers", n: 2, heights: ["auto", "auto"] } }] } }, { id: "b" }] } } })
    expect(run([nested({ kind: "door", mode: "double", hinge: "left" })])).toBe(run([nested()]))
    expect(run([nested({ kind: "panel" })])).toBe(run([nested()]))
    // Amb les portes de l'arrel, tot el de dins queda tapat (també el front de la divisió de dins, que no compta).
    expect(run([nested({ kind: "panel" }), door])).toBe(run([nested(), door]))
    expect(run([nested(), door])).not.toBe(run([nested()]))
  })
  it("sense un lateral, el front d'abans no es fa (com obert) i torna amb el lateral; sense tapa o sense base, sí", () => {
    const noRight = carcass({ sides: { left: true, right: false } })
    const both = carcass({ sides: { left: true, right: true } })
    const fronts: Front[] = [
      { kind: "door", mode: "single", hinge: "left" },
      { kind: "drawers", n: 3, heights: ["auto", "auto", "auto"] },
      { kind: "flap", dir: "down" },
      { kind: "grille", pattern: DEFAULT_GRILLE, mount: "hinged", hinge: "left" },
      { kind: "panel" },
    ]
    const ref = run([noRight])
    for (const f of fronts) {
      for (const p of permutations([rootFront(f), noRight])) expect(run(p)).toBe(ref)
      expect(run([rootFront(f), noRight, both])).toBe(run([rootFront(f)]))
      // «Sense tapa» o «Sense base» (la de cuina, el cobreradiador): el front es fa igual.
      expect(run([rootFront(f), setTop("none")])).not.toBe(run([setTop("none")]))
      expect(run([rootFront(f), carcass({ base: { kind: "open" } })])).not.toBe(run([carcass({ base: { kind: "open" } })]))
    }
  })
  it("portes: de dues fulles, la frontissa d'abans no compta", () => {
    expect(run([rootFront({ kind: "door", mode: "single", hinge: "right" }), rootFront({ kind: "door", mode: "double", hinge: "right" })])).toBe(run([rootFront({ kind: "door", mode: "double", hinge: "left" })]))
  })
})
