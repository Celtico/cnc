import { describe, expect, it } from "vitest"
import { DEFAULT_GRILLE, DEFAULT_HARDWARE_KIT, defaultModule, setFront, setShelves, type Carcass, type Composition, type Front, type Module, type Zone } from "../model"
import { buildComposition } from "./buildComposition"
import { catalogCorpus, int, MATERIALS, pick, randomComposition, rng, type Rnd } from "./testCorpus"

/**
 * Regla «res amagat compta»: el que la UI amaga perquè la seva opció és apagada no pot canviar les peces ni els avisos.
 * La llista de camps amagats surt dels formularis (`CarcassForm`, `JoineryForm`, `MaterialsForm`, `ZonePanel`) i es
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
  // Ranura del fons (JoineryForm): només en ranura. El joc del fons en ranura no surt mai: només compta en ranura.
  if (c.back !== "groove") {
    c.backSetback = int(r, 0, 60)
    c.backClearance = pick(r, [0, 0.5, 1, 2, 4])
  }
  // Retirada del fons (JoineryForm): només encastat.
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
  // Tauler de taula: només amb la tapa sencera.
  if (c.top.kind !== "full")
    c.tableTop = r() < 0.5 ? { overhang: int(r, 0, 300) } : { overhang: int(r, 0, 300), shape: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }
  const fronts = { ...m.fronts }
  if (!fronts.style && r() < 0.5) fronts.style = "overlay"
  if (!fronts.handles && r() < 0.5) fronts.handles = "bar"
  return { ...m, carcass: c, fronts, root: scrambleZone(m.root, r, m.fronts.handles === "none") }
}

function randomShelves(r: Rnd): Zone["shelves"] {
  return { n: int(r, 0, 5), adjustable: r() < 0.5, ...(r() < 0.5 ? { thickness: pick(r, [40, 60]) } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
}

function scrambleZone(z: Zone, r: Rnd, noHandles: boolean): Zone {
  const out: Zone = { ...z }
  const f = z.front
  if (z.split) {
    // Un compartiment dividit no ensenya Prestatges (ni la barra).
    if (r() < 0.5) out.shelves = randomShelves(r)
    if (r() < 0.3) out.rail = true
    out.split = { ...z.split, children: z.split.children.map((c) => scrambleZone(c, r, noHandles)) }
  } else if (f?.kind === "drawers") {
    // Calaixos: la secció Prestatges (i la barra) no surt.
    if (r() < 0.6) out.shelves = randomShelves(r)
    if (r() < 0.3) out.rail = true
  } else {
    // Cap prestatge: «a ras» i el gruix no surten; regulables sí (i sense `shelves`, no regulables).
    const n = z.shelves?.n ?? 0
    if (n === 0 && !z.shelves?.adjustable) out.shelves = r() < 0.4 ? undefined : { n: 0, adjustable: false, ...(r() < 0.5 ? { thickness: 50 } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
    else if (n === 0) out.shelves = { n: 0, adjustable: true, ...(r() < 0.5 ? { thickness: 50 } : {}), ...(r() < 0.5 ? { flush: true } : {}) }
    if (!out.shelves) delete out.shelves
    if (!z.rail && r() < 0.3) out.rail = false
  }
  if (f) out.front = scrambleFront(f, r, noHandles)
  return out
}

/** Un tirador diferent del del mòdul (una altra distància i Ø): el que es triaria a «Tirador» d'un front. */
const OTHER_HANDLE = { ...DEFAULT_HARDWARE_KIT.handle, id: "hw-tirador-amagat", params: { ...DEFAULT_HARDWARE_KIT.handle.params, diameter: 8 }, pitch: { steps: [], else: 320 } }

function scrambleFront(f0: Front, r: Rnd, noHandles: boolean): Front {
  // Sense tiradors (push): el «Tirador» dels fronts no surt ni compta.
  const f = noHandles && (f0.kind === "door" || f0.kind === "drawers" || f0.kind === "flap") && r() < 0.6 ? { ...f0, handle: OTHER_HANDLE } : f0
  switch (f.kind) {
    case "drawers":
      // Només es veu el nombre de calaixos: les alçades de més no compten.
      return { ...f, heights: [...f.heights.slice(0, f.n), ...Array.from({ length: int(r, 0, 3) }, () => pick(r, ["auto", 120, 300] as const))] }
    case "door":
      // Dues portes: no surten les frontisses.
    {
      const d = f.mode === "double" ? { ...f, hinge: pick(r, ["left", "right"] as const) } : f
      // Porta de vidre: frontisses del perfil; la frontissa triada (cassoletes) no surt ni compta.
      // Ni el tirador triat.
      return f.glass && r() < 0.7 ? { ...d, hardware: { ...DEFAULT_HARDWARE_KIT.hinge, id: "hw-amagat", params: { ...DEFAULT_HARDWARE_KIT.hinge.params, cupDiameter: 26, cupOffset: 30 } }, ...(r() < 0.5 ? { handle: OTHER_HANDLE } : {}) } : d
    }
    case "grille": {
      const p = f.pattern
      const pattern = p.kind === "holes" ? { ...p, slotWidth: int(r, 3, 30), slotGap: int(r, 3, 40) } : { ...p, holeDiameter: int(r, 3, 30), holePitch: int(r, 8, 60) }
      // Les frontisses de la reixeta no surten mai; amb imants no compten.
      return { ...f, pattern, ...(f.mount === "removable" ? { hinge: pick(r, ["left", "right"] as const) } : {}) }
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
  it("portes: de dues fulles, la frontissa d'abans no compta", () => {
    expect(run([rootFront({ kind: "door", mode: "single", hinge: "right" }), rootFront({ kind: "door", mode: "double", hinge: "right" })])).toBe(run([rootFront({ kind: "door", mode: "double", hinge: "left" })]))
  })
})
