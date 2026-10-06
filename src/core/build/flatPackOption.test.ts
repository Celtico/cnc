import { describe, expect, it } from "vitest"
import { buildMobleFile, mobleToJson, parseMobleFile } from "../file/mobleFile"
import {
  activeRuns,
  BUILTIN_TEMPLATES,
  defaultModule,
  flatPackDesk,
  flatPackShelf,
  flatPackStool,
  migrateFlatPack,
  migrateRuns,
  normalizeComposition,
  partJoinery,
  STORE_TEMPLATES,
  type Composition,
  type FreePart,
  type Run,
} from "../model"
import { buildComposition } from "./buildComposition"

/**
 * Millores v1 (bloc D): el Flat-pack deixa de ser un tipus de moble i passa a ser l'opció «Encaixos» de cada peça lliure
 * (`FreePart.joinery`, expressa), i el taulell i el sòcol correguts es poden posar a qualsevol moble. Les migracions són
 * en llegir (`normalizeComposition`, `.moble`) i no canvien la fabricació.
 */

const part = (p: Partial<FreePart> & Pick<FreePart, "id" | "orient" | "w" | "h">): FreePart => ({ name: p.id, thickness: 18, material: "Blanc", x: 0, y: 0, z: 0, ...p })
// Un lateral i un prestatge que hi entra (T): fan pestanyes si totes dues tenen encaixos.
const side = (extra: Partial<FreePart> = {}) => part({ id: "side", orient: "side", w: 300, h: 600, x: 400, ...extra })
const shelf = (extra: Partial<FreePart> = {}) => part({ id: "shelf", orient: "flat", w: 800, h: 300, y: 200, ...extra })
const comp = (kind: Composition["kind"], parts: FreePart[], extra: Partial<Composition> = {}): Composition => ({ kind, modules: [defaultModule("m1", "Mòdul 1")], references: [], parts, ...extra })

/** El que es fabrica d'un moble (peces, avisos i encaixos). */
const made = (c: Composition) => {
  const b = buildComposition(c)
  return { panels: b.panels, extras: b.extras, warnings: b.warnings, joints: b.joints }
}

const flatPacks = (): { name: string; make: () => Composition }[] => [
  { name: "prestatgeria", make: flatPackShelf },
  { name: "tamboret", make: flatPackStool },
  { name: "escriptori", make: flatPackDesk },
  ...BUILTIN_TEMPLATES.filter((t) => t.kind === "lliure").map((t) => ({ name: t.name, make: () => ({ ...t.make(), kind: t.kind }) })),
  ...STORE_TEMPLATES.filter((t) => t.kind === "lliure").map((t) => ({ name: t.name, make: () => ({ ...t.make(), kind: t.kind }) })),
]

describe("Flat-pack: migració dels d'abans (tipus `lliure`)", () => {
  it("cada peça porta l'opció expressa amb el valor d'abans i es treu el camp vell", () => {
    const c = comp("lliure", [side(), shelf({ joints: false }), part({ id: "x", orient: "front", w: 100, h: 100, joints: true })])
    const m = migrateFlatPack(c)
    expect(m.parts!.map((p) => p.joinery)).toEqual([true, false, true])
    expect(m.parts!.every((p) => !("joints" in p))).toBe(true)
  })

  it("és idempotent i no toca el que ja és migrat ni l'opció triada", () => {
    const once = migrateFlatPack(comp("lliure", [side(), shelf()]))
    expect(migrateFlatPack(once)).toBe(once)
    const off = { ...once, parts: once.parts!.map((p) => (p.id === "shelf" ? { ...p, joinery: false } : p)) }
    expect(migrateFlatPack(off)).toBe(off)
    expect(partJoinery(off, off.parts![1]!)).toBe(false)
  })

  it("a la resta de mobles les peces no passen a fer encaixos (només es treu el camp vell)", () => {
    const m = migrateFlatPack(comp("moble", [side(), shelf({ joints: false })]))
    expect(m.parts!.map((p) => p.joinery)).toEqual([undefined, undefined])
    expect(m.parts!.every((p) => !("joints" in p))).toBe(true)
    expect(m.parts!.some((p) => partJoinery(m, p))).toBe(false)
    const clean = comp("moble", [side(), shelf()])
    expect(migrateFlatPack(clean)).toBe(clean)
  })

  it("els objectes mai fan encaixos", () => {
    const c = comp("objecte", [side({ joinery: true }), shelf({ joinery: true })])
    expect(c.parts!.some((p) => partJoinery(c, p))).toBe(false)
    expect(buildComposition(c).joints).toEqual([])
  })

  it("normalizeComposition la fa (projectes desats i mobles dels ambients)", () => {
    const n = normalizeComposition(comp("lliure", [side(), shelf()]))
    expect(n.parts!.map((p) => p.joinery)).toEqual([true, true])
  })

  it("la fabricació no canvia: totes les plantilles flat-pack, abans i després de migrar", () => {
    const all = flatPacks()
    expect(all.length).toBeGreaterThan(3)
    for (const t of all) {
      const raw = t.make()
      const before = made(raw)
      const after = made(normalizeComposition(raw))
      expect(after, t.name).toEqual(before)
    }
    // I els flat-pack d'encaix de debò en fan.
    expect(made(flatPackShelf()).joints.length).toBeGreaterThan(0)
  })

  it("un .moble d'abans s'obre migrat i dona les mateixes peces", () => {
    const raw = flatPackStool()
    const res = parseMobleFile(mobleToJson(buildMobleFile({ name: "Tamboret", composition: raw, references: [] })))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const c = res.file.project.composition
    expect(c.parts!.every((p) => p.joinery === true && !("joints" in p))).toBe(true)
    expect(made(c)).toEqual(made(raw))
  })
})

describe("Flat-pack: l'opció «Encaixos» de la peça (a qualsevol moble)", () => {
  it("sense l'opció, les peces d'un moble van soles (com abans)", () => {
    const b = buildComposition(comp("moble", [side(), shelf()]))
    expect(b.joints).toEqual([])
  })

  it("amb l'opció a totes dues, encaix com al Flat-pack", () => {
    const b = buildComposition(comp("moble", [side({ joinery: true }), shelf({ joinery: true })]))
    const flat = buildComposition(comp("lliure", [side(), shelf()]))
    expect(b.joints).toEqual([{ kind: "lap", a: "side", b: "shelf" }])
    expect(b.joints).toEqual(flat.joints)
    const pick = (x: typeof b) => x.panels.filter((p) => p.role === "part").map(({ module: _m, ...rest }) => rest)
    // Les mateixes peces que al Flat-pack d'abans (només canvia el número de mòdul de les refs: aquí hi ha un mòdul).
    expect(pick(b)).toEqual(pick(flat))
  })

  it("si només una la té, no hi ha encaix (i avisa si s'encavalquen)", () => {
    const b = buildComposition(comp("moble", [side({ joinery: true }), shelf()]))
    expect(b.joints).toEqual([])
    expect(b.warnings.some((w) => w.message.includes("una no fa encaixos"))).toBe(true)
  })

  it("dues peces sense l'opció no avisen ni que s'encavalquin", () => {
    const b = buildComposition(comp("moble", [side(), shelf()]))
    expect(b.warnings.some((w) => w.message.includes("encaix"))).toBe(false)
  })
})

describe("Taulell i sòcol a qualsevol moble", () => {
  const withRuns = (kind: Composition["kind"], off?: boolean): Composition => {
    const m = defaultModule("m1", "Baix")
    const run: Run = { id: "r1", kind: "plinth", from: "m1", to: "m1", material: "Blanc", thickness: 16, setback: 50, ...(off === undefined ? {} : { off }) }
    return { kind, modules: [{ ...m, carcass: { ...m.carcass, base: { kind: "legs", height: 100 } } }], references: [], runs: [run] }
  }

  it("els d'un moble que no era cuina queden apagats (es conserven, no es fan)", () => {
    const c = withRuns("moble")
    const m = migrateRuns(c)
    expect(m.runs![0]!.off).toBe(true)
    expect(activeRuns(c)).toEqual([])
    expect(made(c)).toEqual(made(m))
    expect(migrateRuns(m)).toBe(m)
  })

  it("a la cuina (o deduïda cuina) no es toquen i es fan com sempre", () => {
    for (const c of [withRuns("cuina"), withRuns(undefined)]) {
      expect(migrateRuns(c)).toBe(c)
      expect(activeRuns(c)).toHaveLength(1)
    }
  })

  it("un de nou (off: false) es fa a qualsevol moble; apagat, no", () => {
    const on = buildComposition(withRuns("moble", false))
    const off = buildComposition(withRuns("moble", true))
    expect(on.panels.length).toBe(off.panels.length + 1)
    expect(on.panels.at(-1)!.module).toBe(2)
    expect(buildComposition(withRuns("armari", false)).panels.length).toBe(on.panels.length)
  })

  it("mai als mobles només de peces", () => {
    expect(activeRuns(withRuns("lliure", false))).toEqual([])
  })
})
