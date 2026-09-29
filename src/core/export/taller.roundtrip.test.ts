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
import { BUILTIN_TEMPLATES, DEFAULT_CABINET, cabinetToComposition, type Panel } from "../model"
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
    const tv = BUILTIN_TEMPLATES.find((t) => t.id === "tv-living-room")!.make()
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
  const comp = BUILTIN_TEMPLATES.find((t) => t.id === "tv-living-room")!.make()
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
