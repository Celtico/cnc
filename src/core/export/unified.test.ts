import { describe, expect, it } from "vitest"
import { z } from "zod"
import { buildCabinet } from "../build/buildCabinet"
import { DEFAULT_CABINET } from "../model"
import { nest } from "../nesting/nest"
import { deriveJoins, panelAabb, toUnifiedData } from "./unified"

// Esquema zod equivalent als tipus de `unified.types.ts` (contracte del taller).
const RoleSchema = z.enum(["lateral", "horizontal", "front", "back", "hw"])
const SideSchema = z.enum(["d", "e"]).nullable()
const Vec3 = z.tuple([z.number(), z.number(), z.number()])

const PieceSchema = z.object({
  ref: z.string(),
  name: z.string(),
  thick: z.number(),
  tab: z.number(),
  x: z.number(),
  y: z.number(),
  angle: z.number(),
  L: z.number(),
  W: z.number(),
  r3d: RoleSchema,
  side3d: SideSchema,
  dim: z.tuple([z.number(), z.number()]).nullable(),
  solid: z.number(),
  match: z.enum(["exact", "representative", "none"]),
  mec2: z.string().nullable().optional(),
  lam: z.array(z.string().nullable()).nullable().optional(),
})

const SolidSchema = z.object({
  min: Vec3,
  size: Vec3,
  role: RoleSchema,
  side: SideSchema,
  label: z.string().nullable().optional(),
  mach: z
    .array(
      z.object({
        u: z.number(),
        v: z.number(),
        r: z.number(),
        depth: z.number(),
        side: z.enum(["a", "b"]).nullable(),
        fit: z.string().optional(),
      }),
    )
    .optional(),
  edges: z
    .array(
      z.object({
        u: z.number(),
        v: z.number(),
        r: z.number(),
        depth: z.number(),
        edge: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        fit: z.string().optional(),
      }),
    )
    .optional(),
  pockets: z
    .array(
      z.object({
        depth: z.number(),
        side: z.enum(["a", "b"]),
        pts: z.array(z.tuple([z.number(), z.number()])),
      }),
    )
    .optional(),
})

const UnifiedDataSchema = z.object({
  mueble: z.string(),
  material: z.string(),
  boards: z.array(
    z.object({ tab: z.number(), name: z.string(), w: z.number(), h: z.number(), thick: z.number() }),
  ),
  tabs: z.array(z.number()),
  pieces: z.array(PieceSchema),
  solids: z.array(SolidSchema),
  ctr: Vec3,
  joins: z.array(z.object({ a: z.number(), b: z.number(), fit: z.string(), n: z.number() })).optional(),
})

describe("toUnifiedData", () => {
  const panels = buildCabinet(DEFAULT_CABINET)
  const data = toUnifiedData(panels, { name: "Mòdul prova" })

  it("valida contra l'esquema del contracte i sobreviu a JSON", () => {
    expect(() => UnifiedDataSchema.parse(JSON.parse(JSON.stringify(data)))).not.toThrow()
  })

  it("una peça i un sòlid per panell, lligats 1:1 amb match exact", () => {
    expect(data.pieces).toHaveLength(panels.length)
    expect(data.solids).toHaveLength(panels.length)
    data.pieces.forEach((p, i) => {
      expect(p.solid).toBe(i)
      expect(p.match).toBe("exact")
      expect(p.dim).toEqual([p.L, p.W])
    })
  })

  it("noms i rols amb el vocabulari que reconeix pieceRole del taller", () => {
    const byName = Object.fromEntries(data.pieces.map((p) => [p.name, p]))
    expect(byName["lat e"]).toMatchObject({ r3d: "lateral", side3d: "e" })
    expect(byName["lat d"]).toMatchObject({ r3d: "lateral", side3d: "d" })
    expect(byName["trassera"]).toMatchObject({ r3d: "back", side3d: null })
    expect(byName["baix"]).toMatchObject({ r3d: "horizontal" })
    expect(byName["dalt"]).toMatchObject({ r3d: "horizontal" })
    expect(byName["estanter"]).toMatchObject({ r3d: "horizontal" })
    expect(byName["porta"]).toMatchObject({ r3d: "front" })
  })

  it("refs estil ÍNDICE_3D úniques: A.<mòdul>.<tipus>.<n>", () => {
    const refs = data.pieces.map((p) => p.ref)
    expect(new Set(refs).size).toBe(refs.length)
    for (const r of refs) expect(r).toMatch(/^A\.1\.[LHTF]\.\d+$/)
    expect(data.pieces[0]!.ref).toBe("A.1.L.1")
  })

  it("laminat en numeració 1..4 amb el material als cantells folrats", () => {
    const door = data.pieces.find((p) => p.name === "porta")!
    expect(door.lam).toEqual(["Melamina 19", "Melamina 19", "Melamina 19", "Melamina 19"])
    const back = data.pieces.find((p) => p.name === "trassera")!
    expect(back.lam).toEqual([null, null, null, null])
  })

  it("els sòlids porten mecanitzats de cara (u,v,r), forats de cantell i buidats", () => {
    const left = data.solids[0]!
    expect(left.mach).toHaveLength(46)
    expect(left.mach![0]).toMatchObject({ r: 2.5, depth: 12, side: "a", fit: "system32" })
    expect(left.pockets).toHaveLength(1)
    expect(left.pockets![0]!.pts).toHaveLength(4)
    const bottom = data.solids.find((s) => s.label === "baix")!
    expect(bottom.edges).toHaveLength(6)
    for (const e of bottom.edges!) expect([2, 4]).toContain(e.edge)
  })

  it("caixa englobant en coordenades del moble i centre", () => {
    expect(panelAabb(panels[0]!)).toEqual({ min: [0, 0, 0], size: [19, 720, 560] })
    expect(data.ctr).toEqual([300, 360, 289.5])
  })

  it("unions: 4 d'espigues i 1 de frontisses", () => {
    const joins = deriveJoins(panels)
    expect(joins.filter((j) => j.fit === "espiga")).toHaveLength(4)
    for (const j of joins.filter((j) => j.fit === "espiga")) expect(j.n).toBe(3)
    const hinges = joins.filter((j) => j.fit === "frontissa")
    expect(hinges).toHaveLength(1)
    expect(hinges[0]!.n).toBe(2)
    expect(hinges[0]!.b).toBe(0) // lateral esquerre
  })

  it("sense nesting: un tauler virtual 2800×2070 per material/gruix, i cada peça hi apunta", () => {
    expect(data.boards).toHaveLength(2)
    expect(data.boards[0]).toMatchObject({ tab: 1, w: 2800, h: 2070, thick: 19 })
    expect(data.boards[1]).toMatchObject({ tab: 2, w: 2800, h: 2070, thick: 10 })
    expect(data.tabs).toEqual([1, 2])
    const tabs = new Set(data.boards.map((b) => b.tab))
    for (const p of data.pieces) {
      expect(tabs.has(p.tab)).toBe(true)
      expect(p.tab).toBe(p.thick === 10 ? 2 : 1)
      // Centre de la peça a la cantonada del tauler.
      expect([p.x, p.y]).toEqual([p.L / 2, p.W / 2])
      expect(p.angle).toBe(0)
    }
  })

  it("mida de tauler configurable", () => {
    const d = toUnifiedData(panels, { name: "x", sheet: { w: 2440, h: 1220 } })
    expect(d.boards[0]).toMatchObject({ w: 2440, h: 1220 })
    expect(d.boards[0]!.name).toContain("2440x1220")
  })

  it("amb nesting: taulers reals i posició (centre, angle) de cada peça", () => {
    const nesting = nest(panels, { sheet: { w: 2800, h: 2070 }, kerf: 6, margin: 10 })
    const d = toUnifiedData(panels, { name: "x", nesting })
    expect(() => UnifiedDataSchema.parse(JSON.parse(JSON.stringify(d)))).not.toThrow()
    expect(d.boards.map((b) => b.tab)).toEqual(nesting.boards.map((b) => b.tab))
    expect(d.boards[0]!.name).toBe("Melamina 19 2800x2070 #01")
    for (const piece of d.pieces) {
      const board = nesting.boards.find((b) => b.tab === piece.tab)!
      const pl = board.placements.find((p) => p.panelId === panels[piece.solid]!.id)!
      expect([piece.x, piece.y, piece.angle]).toEqual([pl.cx, pl.cy, pl.angle])
    }
  })

  it("amb nesting: les peces que no caben van a un tauler extra i el JSON segueix vàlid", () => {
    const nesting = nest(panels, { sheet: { w: 700, h: 700 }, kerf: 6, margin: 10 })
    expect(nesting.unplaced.length).toBeGreaterThan(0)
    const d = toUnifiedData(panels, { name: "x", nesting })
    expect(() => UnifiedDataSchema.parse(d)).not.toThrow()
    const extra = d.boards.at(-1)!
    expect(extra.name).toBe("(sense col·locar)")
    const tabs = new Set(d.boards.map((b) => b.tab))
    for (const p of d.pieces) expect(tabs.has(p.tab)).toBe(true)
  })
})
