import { describe, expect, it } from "vitest"
import { CarcassSchema, defaultModule, type Carcass, type Module, type Panel, type Zone } from "../model"
import { buildComposition, panelBox } from "./buildComposition"
import { buildModule } from "./buildModule"
import { toWorld } from "./geometry"
import { toCutList } from "../cutlist/toCutList"
import { toDxf } from "../export/dxf"
import { nest } from "../nesting/nest"

// Mòdul estàndard 600 × 720 × 560, cos de 19 i fons encastat de 19 del mateix tauler.
const mod = (over: Partial<Carcass> = {}, root?: Zone): Module => {
  const m = defaultModule("m", "M", { width: 600, height: 720, depth: 560, back: "inset", backMaterial: "Melamina blanca", backThickness: 19, ...over })
  return root ? { ...m, root } : m
}
const panelsOf = (m: Module) => buildComposition({ modules: [m], references: [] }).panels.map((p) => ({ ...p, id: p.id.replace(/^m:/, "") }))

/** Volum comú de dues peces (> 0,5 mm en cada eix). */
const overlaps = (a: Panel, b: Panel) => {
  const A = panelBox(a), B = panelBox(b)
  return [0, 1, 2].every((i) => Math.min(A.max[i]!, B.max[i]!) - Math.max(A.min[i]!, B.min[i]!) > 0.5)
}
// Cantonades a inglet (parets buides): dues pells comparteixen la caixa de la cantonada.
const cornerPair = (a: Panel, b: Panel) => (!!a.mitres && !!b.mitres) || (!!a.outline && !!b.outline)
// El fons del calaix entra a les ranures de la caixa: no compta.
const hits = (all: Panel[]) => {
  const ps = all.filter((p) => p.role !== "drawerBottom")
  const out: string[] = []
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (overlaps(ps[i]!, ps[j]!) && !cornerPair(ps[i]!, ps[j]!)) out.push(`${ps[i]!.id} × ${ps[j]!.id}`)
  return out
}
const sizes = (p: Panel) => [p.length, p.width].sort((a, b) => b - a)
const key = (w: number[]) => w.map((v) => Math.round(v * 10) / 10).join("|")
/** Centres (al moble) dels forats d'espiga: de cantell (a mig gruix) i de cara (a la cara). */
const dowelPts = (p: Panel, face: "edge" | "face") =>
  p.holes.filter((h) => h.tag === "dowel" && (face === "edge" ? h.face === "edge" : h.face !== "edge")).map((h) => key(toWorld(p, [h.x, h.y, face === "edge" ? p.thickness / 2 : h.face === "A" ? p.thickness : 0])))

describe("fons encastat", () => {
  it("mides: llum entre laterals × llum entre base i tapa, enrasat al darrere", () => {
    const back = panelsOf(mod()).find((p) => p.role === "back")!
    expect(sizes(back)).toEqual([720 - 2 * 19, 600 - 2 * 19])
    expect(back.thickness).toBe(19)
    expect(back.material).toBe("Melamina blanca")
    const b = panelBox(back)
    expect(b.min).toEqual([19, 19, 0])
    expect(b.max).toEqual([581, 701, 19])
    // Del mateix tauler que el cos: cap cantell (tots toquen una peça), veta vertical.
    expect(Object.values(back.edges).some(Boolean)).toBe(false)
  })

  it("els laterals fan tota la fondària i no hi ha cap avís de la ranura", () => {
    const b = buildModule(mod())
    expect(sizes(b.panels.find((p) => p.id === "side-left")!)).toEqual([720, 560])
    expect(b.warnings.filter((w) => w.code === "back-groove" || w.code === "back-inset")).toEqual([])
  })

  it("cap peça es trepitja (prestatges, calaixos, divisors, tapa, base, laterals)", () => {
    const root: Zone = {
      id: "r",
      split: {
        dir: "v",
        sizes: ["auto", "auto"],
        children: [
          { id: "a", shelves: { n: 2, adjustable: true }, front: { kind: "door", mode: "single", hinge: "left" } },
          { id: "b", split: { dir: "h", sizes: ["auto", "auto"], children: [{ id: "b1", front: { kind: "drawers", n: 2, heights: [] } }, { id: "b2", rail: false }] } },
        ],
      },
    }
    const ps = panelsOf(mod({}, root))
    expect(ps.some((p) => p.role === "divider")).toBe(true)
    expect(hits(ps)).toEqual([])
    // Cap forat es troba amb un altre per dins (espigues del fons, System 32, guies).
    expect(buildComposition({ modules: [mod({}, root)], references: [] }).warnings.filter((w) => w.code === "hole-clash" || w.code === "overlap" || w.code === "collision")).toEqual([])
  })

  it("espigues: forats de cantell al fons i de cara a laterals, base i tapa, als mateixos punts", () => {
    const ps = panelsOf(mod())
    const back = ps.find((p) => p.role === "back")!
    const edge = dowelPts(back, "edge")
    expect(edge).toHaveLength(12)
    const face = new Set(ps.filter((p) => p !== back).flatMap((p) => dowelPts(p, "face")))
    for (const k of edge) expect(face.has(k), k).toBe(true)
    // A mig gruix del fons (z = 9,5) i a 40 mm dels extrems (endOffset).
    for (const id of ["side-left", "side-right", "bottom", "top"]) {
      const p = ps.find((q) => q.id === id)!
      expect(dowelPts(p, "face").filter((k) => k.endsWith("|9.5")).length, id).toBe(3)
    }
  })

  it("els prestatges perden el gruix del fons", () => {
    const shelf = (m: Module) => panelsOf(m).find((p) => p.role === "shelf")!
    const none = shelf(mod({ back: "none" }))
    const inset = shelf(mod())
    expect(Math.min(none.length, none.width) - Math.min(inset.length, inset.width)).toBe(19)
    expect(panelBox(inset).min[2]).toBe(19)
  })

  it("retirada: el fons s'avança i l'interior i la filera de darrere també", () => {
    const ps = panelsOf(mod({ backInsetSetback: 20 }))
    const back = ps.find((p) => p.role === "back")!
    expect(panelBox(back).min[2]).toBe(20)
    expect(panelBox(ps.find((p) => p.role === "shelf")!).min[2]).toBe(39)
    const side = ps.find((p) => p.id === "side-left")!
    const zs = side.holes.filter((h) => h.tag === "system32").map((h) => toWorld(side, [h.x, h.y, 0])[2])
    expect(Math.min(...zs)).toBe(20 + 37)
    expect(hits(ps)).toEqual([])
  })

  it("amb sòcol: el fons va de sobre la base fins a sota la tapa", () => {
    const ps = panelsOf(mod({ base: { kind: "plinth", height: 100, setback: 50 } }))
    const back = ps.find((p) => p.role === "back")!
    expect(panelBox(back).min[1]).toBe(119)
    expect(sizes(back)).toEqual([720 - 100 - 2 * 19, 562])
    expect(hits(ps)).toEqual([])
    expect(dowelPts(back, "edge")).toHaveLength(12)
  })

  it("sense base (oberta) i sense laterals: fins a fora i el cantell que es veu, cantejat", () => {
    const ps = panelsOf(mod({ base: { kind: "open" }, sides: { left: false, right: true } }))
    const back = ps.find((p) => p.role === "back")!
    const b = panelBox(back)
    expect(b.min).toEqual([0, 0, 0])
    expect(b.max).toEqual([581, 701, 19])
    // Només espigues al lateral dret i a la tapa.
    expect(dowelPts(back, "edge")).toHaveLength(6)
    expect(Object.values(back.edges).filter(Boolean)).toHaveLength(2)
  })

  it("parets buides: entre les pells de dins, amb espigues a les pells", () => {
    const ps = panelsOf(mod({ hollow: { thickness: 60 } }))
    const back = ps.find((p) => p.role === "back")!
    expect(sizes(back)).toEqual([720 - 120, 600 - 120])
    expect(hits(ps)).toEqual([])
    const face = new Set(ps.filter((p) => p.id.endsWith("-inner")).flatMap((p) => dowelPts(p, "face")))
    for (const k of dowelPts(back, "edge")) expect(face.has(k), k).toBe(true)
    expect(dowelPts(back, "edge")).toHaveLength(12)
  })

  it("inglet, tapa amb ranura d'aire i tauler de taula: sense xocs; sense espigues on no hi ha tapa al darrere", () => {
    expect(hits(panelsOf(mod({ joint: "mitre" })))).toEqual([])
    const vent = panelsOf(mod({ top: { kind: "ventSlot", gap: 60 } }))
    expect(hits(vent)).toEqual([])
    expect(dowelPts(vent.find((p) => p.role === "back")!, "edge")).toHaveLength(9)
    const table = panelsOf(mod({ tableTop: { overhang: 20 } }))
    expect(hits(table)).toEqual([])
    expect(sizes(table.find((p) => p.role === "back")!)).toEqual([720 - 2 * 19, 562])
    expect(dowelPts(table.find((p) => p.role === "back")!, "edge")).toHaveLength(9)
  })

  it("fons prim (< 15 mm): sense espigues i avís per cargolar-lo", () => {
    const b = buildModule(mod({ backThickness: 10, backMaterial: "DM 10" }))
    const back = b.panels.find((p) => p.role === "back")!
    expect(back.holes).toEqual([])
    expect(b.warnings.some((w) => w.code === "back-inset")).toBe(true)
  })

  it("compatibilitat: els tipus d'abans es continuen llegint i la retirada és opcional", () => {
    const c = defaultModule("m", "M").carcass
    for (const back of ["groove", "screwed", "inset", "none"] as const) expect(CarcassSchema.safeParse({ ...c, back }).success).toBe(true)
    expect(CarcassSchema.safeParse({ ...c, back: "inset", backInsetSetback: 10 }).success).toBe(true)
    expect(CarcassSchema.safeParse({ ...c, back: "other" }).success).toBe(false)
  })

  it("és una peça de CNC més: llista de tall, nesting amb el cos i DXF amb les espigues", () => {
    const ps = panelsOf(mod())
    const item = toCutList(ps).items.find((i) => i.role === "back")!
    expect([item.length, item.width, item.thickness, item.material]).toEqual([682, 562, 19, "Melamina blanca"])
    // Mateix material i gruix que el cos: comparteix tauler.
    const n = nest(ps)
    expect(n.unplaced).toEqual([])
    const board = n.boards.find((b) => b.placements.some((q) => ps.find((p) => p.id === q.panelId)?.role === "back"))
    expect(board?.placements.length).toBeGreaterThan(1)
    expect(toDxf(ps)).toContain("DRILL_H_D8_P20")
  })

  it("fons gruixut (30, 40): la filera System 32 de darrere mai cau dins del fons; amb ranura, com sempre", () => {
    const rearZs = (m: Module) => {
      const side = panelsOf(m).find((p) => p.id === "side-left")!
      return side.holes.filter((h) => h.tag === "system32").map((h) => toWorld(side, [h.x, h.y, 0])[2])
    }
    const d = defaultModule("x", "X").hardware.system32.diameter
    // 30: a 37 del darrere (la cara del fons és a 30, el forat la passa de 7 − Ø/2).
    expect(Math.min(...rearZs(mod({ backThickness: 30, backMaterial: "Tauler 30" })))).toBe(37)
    // 40: a un Ø de la cara del fons (no a 37, que seria dins del fons).
    expect(Math.min(...rearZs(mod({ backThickness: 40, backMaterial: "Tauler 40" })))).toBe(40 + d)
    expect(Math.min(...rearZs(mod({ backThickness: 40, backMaterial: "Tauler 40", backInsetSetback: 10 })))).toBe(50 + d)
    for (const tb of [30, 40]) for (const z of rearZs(mod({ backThickness: tb, backMaterial: `Tauler ${tb}` }))) expect(z - d / 2).toBeGreaterThanOrEqual(tb)
    // Ranura: la filera de sempre (a 37 del darrere dels laterals).
    expect(Math.min(...rearZs(mod({ back: "groove", backThickness: 10, backMaterial: "DM 10" })))).toBe(37)
  })

  it("tapa de reixeta: les espigues del fons no cauen a cap ranura (la franja del fons queda sense ranures)", () => {
    for (const kind of ["slotsV", "slotsH", "holes"] as const) {
      const pattern = { kind, slotWidth: 8, slotGap: 8, holeDiameter: 8, holePitch: 14, margin: 30 }
      const b = buildModule(mod({ top: { kind: "grille", pattern } }))
      const top = b.panels.find((p) => p.id === "top")!
      expect(top.cutouts?.length, kind).toBeGreaterThan(0)
      const dowels = top.holes.filter((h) => h.tag === "dowel" && h.face !== "edge")
      expect(dowels.length, kind).toBe(3)
      for (const h of dowels) {
        const r = h.diameter / 2
        for (const c of top.cutouts!) {
          const box = c.kind === "circle" ? { x0: c.x - c.diameter / 2, x1: c.x + c.diameter / 2, y0: c.y - c.diameter / 2, y1: c.y + c.diameter / 2 } : c.kind === "polygon" ? null : { x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.h }
          if (!box) continue
          const inside = h.x + r > box.x0 && h.x - r < box.x1 && h.y + r > box.y0 && h.y - r < box.y1
          expect(inside, `${kind} (${h.x}, ${h.y})`).toBe(false)
        }
      }
    }
  })

  it("tapa amb ranura d'aire: avís si entre el fons i la tapa queden menys de 10 mm; el cantell de dalt del fons, cantejat", () => {
    const warns = (gap: number, over: Partial<Carcass> = {}) => buildModule(mod({ top: { kind: "ventSlot", gap }, ...over })).warnings.filter((w) => w.code === "back-inset" && /Ranura d'aire/.test(w.message))
    expect(warns(60)).toEqual([])
    expect(warns(25)).toHaveLength(1)
    expect(warns(25)[0]!.message).toMatch(/només queden 6 mm/)
    expect(warns(15)[0]!.message).toMatch(/queda tapada/)
    expect(warns(60, { backInsetSetback: 35 })).toHaveLength(1)
    const back = buildModule(mod({ top: { kind: "ventSlot", gap: 60 } })).panels.find((p) => p.role === "back")!
    // Un sol cantell (el de dalt; la peça va girada al costat llarg).
    expect(Object.values(back.edges).filter(Boolean)).toHaveLength(1)
  })

  it("poca fondària davant del fons: avís; si les fileres es trobarien, només la de davant", () => {
    const deep = buildModule(mod())
    expect(deep.warnings.filter((w) => w.code === "back-inset")).toEqual([])
    const shallow = (depth: number) => {
      const b = buildModule(mod({ depth }))
      const side = b.panels.find((p) => p.id === "side-left")!
      return { b, zs: [...new Set(side.holes.filter((h) => h.tag === "system32").map((h) => toWorld(side, [h.x, h.y, 0])[2]))] }
    }
    const s90 = shallow(90)
    expect(s90.b.warnings.some((w) => w.code === "back-inset" && /fondària/.test(w.message))).toBe(true)
    expect(s90.zs).toHaveLength(2)
    const s75 = shallow(75)
    expect(s75.b.warnings.some((w) => w.code === "back-inset" && /fondària/.test(w.message))).toBe(true)
    expect(s75.zs).toEqual([75 - 37])
  })
})
