/**
 * Prova d'anada i tornada: el CSV i el STEP generats es passen pels parsers del taller
 * (`~/Desktop/taller-cnc-nest`, importats del seu codi font, només lectura).
 *
 * Aquest fitxer queda fora del `tsc` del projecte (el codi del taller es compila amb
 * unes altres opcions); Vitest sí que l'executa. Si el repo del taller no hi és, se salta.
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { BUILTIN_TEMPLATES, TV_LIVING_ROOM, DEFAULT_CABINET, cabinetToComposition, type Panel } from "../model"
import { DEFAULT_NEST_OPTIONS, nest } from "../nesting/nest"
import { toStep } from "./step"
import { toTopsolidCsv } from "./topsolidCsv"

const TALLER = resolve(__dirname, "../../../../taller-cnc-nest/src/nesting/assemble.ts")

type Solid = {
  min: number[]
  size: number[]
  role: string
  side: string | null
  label?: string | null
  mach?: { u: number; v: number; r: number; depth: number; side: string | null }[]
  edges?: { u: number; v: number; r: number; depth: number; edge: number }[]
  pockets?: { depth: number; side: string; pts: [number, number][] }[]
}
type Piece = { ref: string; name: string; thick: number; tab: number; L: number; W: number; r3d: string; side3d: string | null; solid: number; match: string; lam?: (string | null)[] | null }
type Unified = { mueble: string; material: string; boards: { tab: number; name: string; w: number; h: number; thick: number }[]; pieces: Piece[]; solids: Solid[] }
type Assemble = (csv: string, step: string, mueble: string) => Unified

const sortDesc = (a: number[]) => [...a].sort((x, y) => y - x)

describe.skipIf(!existsSync(TALLER))("anada i tornada amb els parsers del taller", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  const panels = buildComposition(cabinetToComposition(DEFAULT_CABINET)).panels
  const nesting = nest(panels, DEFAULT_NEST_OPTIONS)
  const csv = toTopsolidCsv(panels, nesting, { project: "Prova" })
  const step = toStep(panels, { name: "Prova" })
  const data = assemble(csv.text, step.text, "Prova")
  const byRef = new Map(csv.rows.map((r) => [r.ref, r.panelId]))
  const panelOf = (piece: Piece): Panel => panels.find((p) => p.id === byRef.get(piece.ref))!

  it("es detecten totes les peces i tots els taulers, amb el material correcte", () => {
    expect(data.pieces).toHaveLength(panels.length)
    expect(data.boards).toHaveLength(nesting.boards.length)
    expect(data.material).toBe(DEFAULT_CABINET.material)
    for (const b of data.boards) {
      expect(b.w).toBe(2800)
      expect(b.h).toBe(2070)
    }
    expect(data.solids).toHaveLength(panels.length)
  })

  it("cada peça queda lligada a un sòlid de la seva mida", () => {
    for (const piece of data.pieces) {
      expect(piece.match).not.toBe("none")
      const s = data.solids[piece.solid]!
      expect(sortDesc(s.size)).toEqual(sortDesc([piece.L, piece.W, piece.thick]))
    }
  })

  it("rols correctes: laterals d/e, base i sostre horitzontals, trassera back, porta front", () => {
    const byName = (n: string) => data.pieces.find((p) => p.name === n)!
    expect(byName("lat e")).toMatchObject({ r3d: "lateral", side3d: "e" })
    expect(byName("lat d")).toMatchObject({ r3d: "lateral", side3d: "d" })
    expect(byName("baix").r3d).toBe("horizontal")
    expect(byName("dalt").r3d).toBe("horizontal")
    expect(byName("estanter").r3d).toBe("horizontal")
    expect(byName("trassera").r3d).toBe("back")
    expect(byName("porta").r3d).toBe("front")
    // I els rols que el taller dedueix de la geometria del STEP.
    const solidOf = (n: string) => data.solids[byName(n).solid]!
    expect(solidOf("lat e")).toMatchObject({ role: "lateral", side: "e", label: "lat e" })
    expect(solidOf("lat d")).toMatchObject({ role: "lateral", side: "d" })
    expect(solidOf("baix").role).toBe("horizontal")
    expect(solidOf("trassera").role).toBe("back")
    expect(solidOf("porta").role).toBe("front")
  })

  it("el nombre de forats (mach + edges) coincideix, amb diàmetres i fondàries a ±0,1 mm", () => {
    for (const piece of data.pieces) {
      const p = panelOf(piece)
      const s = data.solids[piece.solid]!
      const faceHoles = p.holes.filter((h) => h.face !== "edge")
      const edgeHoles = p.holes.filter((h) => h.face === "edge")
      expect((s.mach ?? []).length, `${p.name}: forats de cara`).toBe(faceHoles.length)
      expect((s.edges ?? []).length, `${p.name}: forats de cantell`).toBe(edgeHoles.length)
      const ours = [...faceHoles.map((h) => `${h.diameter}|${h.depth}`)].sort()
      const theirs = (s.mach ?? []).map((m) => `${Math.round(m.r * 20) / 10}|${Math.round(m.depth * 10) / 10}`).sort()
      expect(theirs).toEqual(ours)
      const oursE = [...edgeHoles.map((h) => `${h.diameter}|${h.depth}`)].sort()
      const theirsE = (s.edges ?? []).map((m) => `${Math.round(m.r * 20) / 10}|${Math.round(m.depth * 10) / 10}`).sort()
      expect(theirsE).toEqual(oursE)
    }
  })

  it("posicions dels forats: el mateix conjunt (u, v) mòdul mirall", () => {
    for (const piece of data.pieces) {
      const p = panelOf(piece)
      const s = data.solids[piece.solid]!
      const faceHoles = p.holes.filter((h) => h.face !== "edge")
      if (!faceHoles.length) continue
      const L = p.length
      const W = p.width
      const norm = (u: number, v: number) => `${Math.round(Math.min(u, L - u))}|${Math.round(Math.min(v, W - v))}`
      const ours = faceHoles.map((h) => norm(h.x, h.y)).sort()
      const theirs = (s.mach ?? []).map((m) => norm(m.u, m.v)).sort()
      expect(theirs).toEqual(ours)
    }
  })

  it("pockets per a les ranures del fons (i cap altre buidat)", () => {
    for (const piece of data.pieces) {
      const p = panelOf(piece)
      const s = data.solids[piece.solid]!
      const pockets = s.pockets ?? []
      expect(pockets.length, `${p.name}: ranures`).toBe(p.grooves.length)
      for (const g of p.grooves) {
        const pk = pockets.find((k) => Math.abs(k.depth - g.depth) < 0.1)
        expect(pk).toBeDefined()
        expect(pk!.pts).toHaveLength(4)
        const us = pk!.pts.map((q) => q[0])
        const vs = pk!.pts.map((q) => q[1])
        const du = Math.max(...us) - Math.min(...us)
        const dv = Math.max(...vs) - Math.min(...vs)
        expect([du, dv].sort((a, b) => b - a)).toEqual([g.w, g.h].sort((a, b) => b - a))
      }
    }
  })

  it("moble de TV + cobreradiador (portes, reixeta, passacables) i calaixera: tot lligat", () => {
    const tv = TV_LIVING_ROOM.make()
    const drawers = BUILTIN_TEMPLATES.find((t) => t.name.startsWith("Calaixera"))!.make()
    for (const comp of [tv, drawers]) {
      const ps = buildComposition(comp).panels
      const ns = nest(ps, DEFAULT_NEST_OPTIONS)
      const c = toTopsolidCsv(ps, ns, { project: "TV" })
      const s = toStep(ps, { name: "TV" })
      expect(s.warnings).toEqual([])
      const d = assemble(c.text, s.text, "TV")
      expect(d.pieces).toHaveLength(ps.length)
      expect(d.solids).toHaveLength(ps.length)
      expect(d.pieces.filter((p) => p.match === "none")).toEqual([])
      const refs = new Set(d.pieces.map((p) => p.ref))
      expect(refs.size).toBe(ps.length)
      // Passacables i ranures de reixeta (passants) no compten com a forats al taller.
      for (const piece of d.pieces) {
        const p = ps.find((x) => x.id === c.rows.find((r) => r.ref === piece.ref)!.panelId)!
        const sol = d.solids[piece.solid]!
        expect((sol.mach ?? []).length + (sol.edges ?? []).length, p.id).toBe(p.holes.length)
      }
    }
  })

  it("els cantells del CSV van a l'eix que el taller dibuixa", () => {
    // El taller numera 4 = u mínim · 2 = u màxim · 1 = v mínim · 3 = v màxim.
    const door = data.pieces.find((p) => p.name === "porta")!
    expect(door.lam).toEqual(["canto 1mm", "canto 1mm", "canto 1mm", "canto 1mm"])
    const shelf = data.pieces.find((p) => p.name === "estanter")!
    // El prestatge només porta cantell al davant: a un sol eix.
    expect((shelf.lam ?? []).filter(Boolean)).toHaveLength(1)
  })
})

describe.skipIf(!existsSync(TALLER))("2a cara: el taller rep el programa de les peces amb mecanitzats a la cara B", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: (csv: string, step: string, mueble: string) => { pieces: { ref: string; mec2?: string | null }[] } }
  const { needsSecondFace } = await import("../process/processes")
  const comp = TV_LIVING_ROOM.make()
  const panels = buildComposition(comp).panels
  const nesting = nest(panels, DEFAULT_NEST_OPTIONS)
  const csv = toTopsolidCsv(panels, nesting, { project: "Prova" })
  const data = assemble(csv.text, toStep(panels, { name: "Prova" }).text, "Prova")
  it("mec2 = <ref>Volt a les peces amb cara B, i buit a la resta", () => {
    const withB = csv.rows.filter((r) => needsSecondFace(panels.find((p) => p.id === r.panelId)!))
    expect(withB.length).toBeGreaterThan(0)
    for (const r of csv.rows) {
      const piece = data.pieces.find((p) => p.ref === r.ref)!
      expect(piece.mec2 ?? null).toBe(withB.includes(r) ? `${r.ref}Volt` : null)
    }
  })
})

describe.skipIf(!existsSync(TALLER))("flat-pack: peces lliures amb encaixos al taller", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  const { flatPackShelf, flatPackStool } = await import("../model")
  it("prestatgeria d'encaix i tamboret: totes les peces lligades a un sòlid", () => {
    for (const comp of [flatPackShelf(), flatPackStool()]) {
      const ps = buildComposition(comp).panels
      const ns = nest(ps, DEFAULT_NEST_OPTIONS)
      const c = toTopsolidCsv(ps, ns, { project: "FP" })
      const s = toStep(ps, { name: "FP" })
      const d = assemble(c.text, s.text, "FP")
      expect(d.pieces).toHaveLength(ps.length)
      expect(d.pieces.filter((p) => p.match === "none")).toEqual([])
    }
  })
})

describe.skipIf(!existsSync(TALLER))("el STEP de TopSolid (amb conjunts, ingletes i colors) el taller el llegeix igual", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  const { toStepCad } = await import("./step")
  const { stepCadGroups } = await import("./stepGroups")
  const count = (u: Unified) => ({
    matched: u.pieces.filter((p) => p.match !== "none").length,
    mach: u.solids.reduce((n, s) => n + (s.mach?.length ?? 0), 0),
    edges: u.solids.reduce((n, s) => n + (s.edges?.length ?? 0), 0),
    pockets: u.solids.reduce((n, s) => n + (s.pockets?.length ?? 0), 0),
    roles: u.solids.map((s) => s.role).join(","),
  })
  for (const t of BUILTIN_TEMPLATES) {
    it(t.id, () => {
      const comp = t.make()
      const b = buildComposition(comp)
      const csv = toTopsolidCsv(b.panels, nest(b.panels, DEFAULT_NEST_OPTIONS), { project: "X" }).text
      const plain = assemble(csv, toStep(b.panels, { name: "X" }).text, "X")
      const cad = assemble(csv, toStepCad(stepCadGroups(comp, b), { name: "X", color: () => [0.5, 0.4, 0.3] }).text, "X")
      // El camí real del botó STEP: sense ferro, pedra ni vidre (unions falses al taller).
      expect(cad.solids).toHaveLength(b.panels.length)
      expect(count(cad)).toEqual(count(plain))
      expect(cad.pieces.filter((p) => p.match === "none")).toEqual([])
    })
  }
})

describe.skipIf(!existsSync(TALLER))("noms amb `;`, `:` i accents: el taller els llegeix sencers, iguals al CSV i al STEP", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  const { toStepCad } = await import("./step")
  const { stepCadGroups } = await import("./stepGroups")
  const comp = cabinetToComposition(DEFAULT_CABINET)
  const b = buildComposition(comp)
  const rename: Record<string, string> = { "lat e": "Lateral 40;60", "lat d": "Prestatge: dalt", porta: "Porta façana" }
  const ps = b.panels.map((p) => (rename[p.name] ? { ...p, name: rename[p.name]!, label: `${rename[p.name]!}; app` } : p))
  const csv = toTopsolidCsv(ps, nest(ps, DEFAULT_NEST_OPTIONS), { project: "Prova; v2" })
  const steps = {
    taller: toStep(ps, { name: "Prova; v2" }).text,
    topsolid: toStepCad(stepCadGroups(comp, { ...b, panels: ps }), { name: "Prova; v2", color: () => [0.5, 0.4, 0.3] }).text,
  }
  for (const [kind, text] of Object.entries(steps)) {
    it(kind, () => {
      const d = assemble(csv.text, text, "Prova; v2")
      expect(d.pieces).toHaveLength(ps.length)
      expect(d.solids).toHaveLength(ps.length)
      expect(d.pieces.filter((p) => p.match === "none")).toEqual([])
      const names = d.pieces.map((p) => p.name)
      expect(names).toEqual(expect.arrayContaining(["Lateral 40,60", "Prestatge- dalt", "Porta facana"]))
      // Mateix vocabulari: els noms dels sòlids són els de les peces del CSV.
      expect(d.solids.map((s) => s.label).sort()).toEqual([...names].sort())
    })
  }
})

describe.skipIf(!existsSync(TALLER))("cassoleta Ø35 × 13 en tauler de 12: el taller la veu (a gruix − 1)", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  it("mach amb fondària 11", () => {
    const ps = buildComposition(cabinetToComposition(DEFAULT_CABINET)).panels
    const door = ps.find((p) => p.name === "porta")!
    const thin: Panel = { ...door, thickness: 12, holes: [{ x: 22, y: 100, diameter: 35, depth: 13, face: "B" }] }
    const all = ps.map((p) => (p === door ? thin : p))
    const s = toStep(all, { name: "X" })
    expect(s.warnings.some((w) => w.includes("Ø35") && w.includes("massa fondo"))).toBe(true)
    const d = assemble(toTopsolidCsv(all, nest(all, DEFAULT_NEST_OPTIONS), { project: "X" }).text, s.text, "X")
    const sol = d.solids[d.pieces.find((p) => p.name === "porta")!.solid]!
    expect((sol.mach ?? []).map((m) => [Math.round(m.r * 20) / 10, m.depth])).toEqual([[35, 11]])
  })
})

describe.skipIf(!existsSync(TALLER))("fons encastat del mateix tauler: el taller el llegeix (rol back, espigues de cantell i de cara)", async () => {
  const { assemble } = (await import(/* @vite-ignore */ TALLER)) as { assemble: Assemble }
  const insetOf = (comp: ReturnType<typeof cabinetToComposition>) => ({
    ...comp,
    modules: comp.modules.map((m) => ({ ...m, carcass: { ...m.carcass, back: "inset" as const, backMaterial: m.carcass.material, backThickness: m.carcass.thickness } })),
  })
  const comps = {
    caixa: insetOf(cabinetToComposition(DEFAULT_CABINET)),
    calaixera: insetOf(BUILTIN_TEMPLATES.find((t) => t.name.startsWith("Calaixera"))!.make()),
  }
  for (const [name, comp] of Object.entries(comps)) {
    it(name, () => {
      const ps = buildComposition(comp).panels
      const c = toTopsolidCsv(ps, nest(ps, DEFAULT_NEST_OPTIONS), { project: "X" })
      const s = toStep(ps, { name: "X" })
      expect(s.warnings).toEqual([])
      const d = assemble(c.text, s.text, "X")
      expect(d.pieces).toHaveLength(ps.length)
      expect(d.pieces.filter((p) => p.match === "none")).toEqual([])
      for (const piece of d.pieces) {
        const p = ps.find((x) => x.id === c.rows.find((r) => r.ref === piece.ref)!.panelId)!
        const sol = d.solids[piece.solid]!
        expect((sol.mach ?? []).length, `${p.id}: forats de cara`).toBe(p.holes.filter((h) => h.face !== "edge").length)
        expect((sol.edges ?? []).length, `${p.id}: forats de cantell`).toBe(p.holes.filter((h) => h.face === "edge").length)
      }
      const backs = d.pieces.filter((p) => p.name === "trassera")
      expect(backs.length).toBeGreaterThan(0)
      for (const b of backs) {
        expect(b.r3d).toBe("back")
        // El rol del sòlid el taller el dedueix només del gruix (≤ 12 = back): un fons de 19 hi surt
        // com a «front», igual que un fons cargolat de 19. La peça (pel nom) sí que és «back».
        expect(b.thick).toBe(19)
        expect((d.solids[b.solid]!.edges ?? []).length).toBe(12)
      }
    })
  }
})
