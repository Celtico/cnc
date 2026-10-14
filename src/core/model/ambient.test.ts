import { describe, expect, it } from "vitest"
import { buildBounds, buildComposition } from "../build/buildComposition"
import { addOpening, nearestWall, BLOCK_PRESETS, blockComposition, footprintBox, parseAmbient, resizeComposition, roomWalls, setWallEnds, snapToWalls } from "./ambient"
import { defaultModule, newId, type Composition } from "./composition"
import { BUILTIN_TEMPLATES } from "./templates"
import { STORE_TEMPLATES } from "./storeCatalog"

const size = (c: Parameters<typeof buildComposition>[0]) => {
  const b = buildBounds(buildComposition(c))
  return { w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], d: b.max[2] - b.min[2] }
}

describe("ambients", () => {
  it("canviar les mides generals d'un moble dona (gairebé) la mida demanada", () => {
    for (const t of [...BUILTIN_TEMPLATES.slice(0, 8), ...STORE_TEMPLATES.filter((_, i) => i % 15 === 0)]) {
      const comp = t.make()
      const cur = size(comp)
      const next = { w: Math.round(cur.w * 1.2), h: Math.round(cur.h * 0.9), d: Math.round(cur.d * 1.1) }
      const got = size(resizeComposition(comp, cur, next))
      // Els gruixos dels taulers no s'escalen: tolerància d'uns quants mm per moble.
      expect(Math.abs(got.w - next.w), `${t.name} ample`).toBeLessThan(Math.max(40, next.w * 0.03))
      expect(Math.abs(got.h - next.h), `${t.name} alt`).toBeLessThan(Math.max(40, next.h * 0.03))
      expect(Math.abs(got.d - next.d), `${t.name} fons`).toBeLessThan(Math.max(40, next.d * 0.05))
    }
  })

  it("canviar les mides generals també escala els models 3D", () => {
    const comp = { ...BUILTIN_TEMPLATES[0]!.make(), models: [{ id: "m1", name: "Falguera", src: "fern-02-c", x: 100, y: 200, z: 300, w: 600, h: 240, d: 500, rot: 30 }] }
    const out = resizeComposition(comp, { w: 1000, h: 1000, d: 1000 }, { w: 2000, h: 500, d: 1500 })
    expect(out.models).toEqual([{ id: "m1", name: "Falguera", src: "fern-02-c", x: 200, y: 100, z: 450, w: 1200, h: 120, d: 750, rot: 30 }])
  })

  it("els blocs fan la seva mida i no van al nesting", () => {
    for (const p of BLOCK_PRESETS) {
      const b = buildComposition(blockComposition(p))
      expect(b.panels).toHaveLength(0)
      const s = size(blockComposition(p))
      expect([Math.round(s.w), Math.round(s.h), Math.round(s.d)]).toEqual([p.w, p.h, p.d])
    }
  })

  it("imant a les parets i caixa girada", () => {
    const walls = roomWalls(0, 0, 4000, 3000, 100)
    // Un moble de 1000 × 500 a 80 mm de la paret de dalt (cara de dins a y = 50).
    const s = snapToWalls(2000, 50 + 80 + 250, 1000, 500, 0, walls)
    expect(s.snapped).toBe(true)
    expect(s.y).toBe(50 + 250)
    const b = footprintBox(0, 0, 1000, 500, 90)
    expect(Math.round(b.x1 - b.x0)).toBe(500)
    expect(Math.round(b.y1 - b.y0)).toBe(1000)
  })

  it("un ambient desat amb brossa es llegeix igualment", () => {
    const a = parseAmbient({ walls: [{ id: "w", a: [0, 0], b: [1000, 0], thickness: 100, height: 2600 }, { bad: 1 }], items: "x" })
    expect(a.walls).toHaveLength(1)
    expect(a.items).toEqual([])
  })
})

describe("plantilles d'objectes", async () => {
  const { OBJECT_TEMPLATES } = await import("./ambient")
  it("es fan, no van al nesting i no avisen de res greu", () => {
    for (const t of OBJECT_TEMPLATES) {
      const b = buildComposition(t.make())
      expect(b.panels, t.name).toHaveLength(0)
      expect(b.extras.length + b.models.length, t.name).toBeGreaterThan(0)
      expect(b.warnings.filter((w) => ["layout", "collision"].includes(w.code)), t.name).toEqual([])
    }
  })
})

describe("grups d'elements", async () => {
  const m = await import("./ambient")
  const base = { ...m.EMPTY_AMBIENT, items: [
    { id: "a", kind: "block" as const, name: "A", shape: "box" as const, w: 100, h: 100, d: 100, material: "x", x: 0, y: 0, rot: 0 },
    { id: "b", kind: "block" as const, name: "B", shape: "box" as const, w: 100, h: 100, d: 100, material: "x", x: 1000, y: 0, rot: 0 },
  ] }
  it("agrupar, moure, girar, duplicar i esborrar", () => {
    const g = m.setItemGroup(base, ["a", "b"], m.newItemGroupName(base))
    expect(m.groupIds(g, "Grup 1")).toEqual(["a", "b"])
    const mv = m.moveItems(g, ["a", "b"], 10, 20)
    expect(mv.items.map((i) => [i.x, i.y])).toEqual([[10, 20], [1010, 20]])
    const r = m.rotateItems(g, ["a", "b"], 90)
    expect(r.items.map((i) => [i.x, i.y, i.rot])).toEqual([[500, -500, 90], [500, 500, 90]])
    const d = m.duplicateItems(g, ["a", "b"])
    expect(d.group).toBe("Grup 2")
    expect(d.ambient.items).toHaveLength(4)
    expect(m.removeItems(d.ambient, d.ids).items).toHaveLength(2)
  })
  it("arrossegar a l'arbre: ordre, entrar i sortir d'un grup, i el grup sencer", () => {
    const c = { ...base, items: [...base.items, { ...base.items[0]!, id: "c", name: "C" }] }
    const g = m.setItemGroup(c, ["b", "c"], "Grup 1")
    // «a» deixada després de «c»: entra al grup.
    const r = m.reorderItems(g, ["a"], "c", true)
    expect(r.items.map((i) => [i.id, i.group])).toEqual([["b", "Grup 1"], ["c", "Grup 1"], ["a", "Grup 1"]])
    // «b» deixada abans d'«a» (solta): en surt.
    const out = m.reorderItems(g, ["b"], "a", false)
    expect(out.items.map((i) => [i.id, i.group])).toEqual([["b", undefined], ["a", undefined], ["c", "Grup 1"]])
    // El grup sencer, abans d'«a»: es queda el seu grup.
    const whole = m.reorderItems(g, ["b", "c"], "a", false)
    expect(whole.items.map((i) => [i.id, i.group])).toEqual([["b", "Grup 1"], ["c", "Grup 1"], ["a", undefined]])
    expect(m.moveItemToGroup(g, "a", "Grup 1").items.map((i) => [i.id, i.group])).toEqual([["b", "Grup 1"], ["c", "Grup 1"], ["a", "Grup 1"]])
  })
  it("duplicar un element d'un grup: la còpia es queda al grup", () => {
    const g = m.setItemGroup(base, ["a", "b"], "Grup 1")
    const d = m.duplicateItems(g, ["a"])
    expect(d.group).toBeUndefined()
    expect(d.ambient.items.find((i) => i.id === d.ids[0])!.group).toBe("Grup 1")
  })
})

describe("obertures de les parets", () => {
  const wall = { id: "w", a: [0, 0] as [number, number], b: [4000, 0] as [number, number], thickness: 100, height: 2600 }
  it("troba la paret clicada i hi posa una finestra ajustada", () => {
    const hit = nearestWall([wall], [3900, 30], 20)!
    expect(hit.wall.id).toBe("w")
    expect(hit.at).toBe(3900)
    const w = addOpening(wall, "window", hit.at)!
    expect(w.openings).toEqual([{ kind: "window", at: 3400, w: 1200, h: 1200, sill: 900 }])
    expect(nearestWall([wall], [2000, 500], 20)).toBeNull()
  })
  it("una porta va fins a terra i no passa de l'alçada de la paret", () => {
    const w = addOpening({ ...wall, height: 2000 }, "door", 2000)!
    expect(w.openings![0]).toMatchObject({ sill: 0, h: 2000 })
  })
  it("una obertura nova no trepitja les que hi ha: forat lliure més proper o cap", () => {
    const one = addOpening({ ...wall, b: [3000, 0] }, "window", 1000)!
    const two = addOpening(one, "door", 1300)!
    // La finestra ocupa 400–1600: la porta (900) va just a la dreta.
    expect(two.openings![1]!.at).toBe(2050)
    expect(addOpening({ ...wall, b: [2000, 0], openings: [{ kind: "glazing", at: 1000, w: 1800, h: 2400, sill: 0 }] }, "door", 1000)).toBeNull()
  })
  it("moure l'extrem `a` no fa lliscar les obertures; escurçar la paret les hi manté a dins", () => {
    const w = { ...wall, openings: [{ kind: "window" as const, at: 2000, w: 1200, h: 1200, sill: 900 }] }
    expect(setWallEnds(w, [500, 0], [4000, 0]).openings![0]!.at).toBe(1500)
    expect(setWallEnds(w, [-500, 0], [4000, 0]).openings![0]!.at).toBe(2500)
    expect(setWallEnds(w, [0, 0], [2200, 0]).openings![0]!.at).toBe(1600)
  })
})

describe("imant i mides generals (casos límit)", () => {
  it("l'imant no estira un element a través de la paret", () => {
    const walls = roomWalls(0, 0, 4000, 3000, 200)
    // Element dins l'habitació amb la vora de dalt 30 mm dins del cos de la paret de dalt (cara de dins a y = 100).
    // Abans la cara de fora (y = −100) l'estirava 70 mm cap a fora, a través de la paret.
    expect(snapToWalls(2000, 470, 1000, 1000, 0, walls, 120).y).toBe(470)
    expect(snapToWalls(2000, 470, 1000, 1000, 0, walls, 200).y).toBe(600)
  })
  it("una divisió amb totes les mides fixes: l'última passa a «auto» en canviar l'ample", () => {
    const m0 = defaultModule("a", "A", { width: 800 })
    const m = { ...m0, gapBefore: 0, root: { id: m0.root.id, split: { dir: "v" as const, sizes: [380, 381], children: [{ id: newId() }, { id: newId() }] } } }
    const comp: Composition = { modules: [m], references: [] }
    const out = resizeComposition(comp, { w: 800, h: m.carcass.height, d: m.carcass.depth }, { w: 1600, h: m.carcass.height, d: m.carcass.depth })
    expect(out.modules[0]!.root.split!.sizes).toEqual([760, "auto"])
    const b = buildComposition(out)
    expect(b.warnings.filter((x) => x.code === "layout")).toEqual([])
  })
})


describe("ambient desat amb dades malmeses", () => {
  it("una obertura o un material de paret dolents no treuen la paret", () => {
    const amb = {
      walls: [
        { id: "w1", a: [0, 0], b: [3000, 0], thickness: 100, height: 2600, material: 5, openings: [{ kind: "window", at: 1000, w: 800, h: 1000, sill: 900 }, { kind: "window", at: 2000, w: 0, h: 1000, sill: 900 }] },
        { id: "w2", a: [3000, 0], b: [3000, 3000], thickness: 100, height: 2600 },
        { id: "w3", a: [0, 0], b: "?", thickness: 100, height: 2600 },
      ],
      items: [],
      camera: { position: "?" },
    }
    const p = parseAmbient(amb)
    expect(p.walls.map((w) => w.id)).toEqual(["w1", "w2"])
    expect(p.walls[0]!.openings).toEqual([{ kind: "window", at: 1000, w: 800, h: 1000, sill: 900 }])
    expect(p.walls[0]!.material).toBeUndefined()
  })
})

describe("terra de fora", () => {
  it("es desa i es llegeix, també d'un ambient amb alguna cosa dolenta", () => {
    expect(parseAmbient({ walls: [], items: [], outsideFloorMaterial: "Grava" }).outsideFloorMaterial).toBe("Grava")
    expect(parseAmbient({ walls: "dolent", items: [], outsideFloorMaterial: "Grava" }).outsideFloorMaterial).toBe("Grava")
    expect(parseAmbient({ walls: [], items: [] }).outsideFloorMaterial).toBeUndefined()
  })
})

describe("copiar i enganxar elements dels ambients", () => {
  const it0 = (id: string, group?: string) => ({ kind: "moble", id, projectId: 7, x: 1000, y: 1000, rot: 0, ...(group ? { group } : {}) })
  const amb = (items: unknown[]) => parseAmbient({ walls: [], items })
  it("ids nous i desplaçats; d'un altre ambient, al mateix lloc", async () => {
    const { pasteItems, parseAmbientClip } = await import("./ambient")
    const a = amb([it0("a")])
    const clip = parseAmbientClip({ kind: "ambient-items", items: a.items })!
    const r = pasteItems(a, clip.items, 300)
    expect(r.ambient.items).toHaveLength(2)
    expect(r.ids[0]).not.toBe("a")
    expect([r.ambient.items[1]!.x, r.ambient.items[1]!.y]).toEqual([1300, 1300])
    expect(pasteItems(amb([]), clip.items, 0).ambient.items[0]!.x).toBe(1000)
    expect(parseAmbientClip({ kind: "ambient-items", items: [] })).toBeNull()
    expect(parseAmbientClip("res")).toBeNull()
  })
  it("grups: el sencer fa un grup nou; una part s'hi queda; un d'un altre ambient amb el mateix nom, nou", async () => {
    const { pasteItems } = await import("./ambient")
    const a = amb([it0("a", "Grup 1"), it0("b", "Grup 1")])
    expect(pasteItems(a, a.items, 300).group).toBe("Grup 2")
    expect(pasteItems(a, [a.items[0]!], 300).ambient.items[2]!.group).toBe("Grup 1")
    const other = amb([it0("x", "Grup 1")])
    expect(pasteItems(other, a.items, 0).group).toBe("Grup 2")
    expect(pasteItems(amb([]), a.items, 0).group).toBe("Grup 1")
  })
})

describe("alinear i repartir als ambients", async () => {
  const m = await import("./ambient")
  const blk = (id: string, x: number) => ({ id, kind: "block" as const, name: id, shape: "box" as const, w: 100, h: 100, d: 100, material: "x", x, y: 0, rot: 0 })
  const a = { ...m.EMPTY_AMBIENT, items: [blk("a", 0), blk("b", 300), blk("c", 1000)] }
  const box = (i: { x: number; y: number; rot: number }) => m.footprintBox(i.x, i.y, 100, 100, i.rot)
  it("alinear a l'esquerra i repartir amb el mateix espai o amb un espai donat", () => {
    expect(m.alignItems(a, ["a", "b", "c"], box, "x", "min").items.map((i) => i.x)).toEqual([0, 0, 0])
    expect(m.distributeItems(a, ["a", "b", "c"], box, "x").items.map((i) => i.x)).toEqual([0, 500, 1000])
    expect(m.distributeItems(a, ["a", "b"], box, "x", 20).items.map((i) => i.x)).toEqual([0, 120, 1000])
  })
})

describe("parets corbes", async () => {
  const m = await import("./ambient")
  const w = { id: "w", a: [0, 0] as [number, number], b: [1000, 0] as [number, number], thickness: 100, height: 2500, curve: { c1: [0, 500] as [number, number], c2: [1000, 500] as [number, number] } }
  it("la corba passa pels extrems, és més llarga que la recta i es fa de trams rectes", () => {
    const pts = m.wallPoints(w, 4)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[4]).toEqual([1000, 0])
    expect(pts[2]![1]).toBeCloseTo(375)
    expect(m.wallLength(w)).toBeGreaterThan(1000)
    const parts = m.expandWalls([w], 8)
    expect(parts).toHaveLength(8)
    expect(parts.every((p) => !p.curve && p.id.startsWith("w~"))).toBe(true)
  })
  it("moure un extrem mou el seu punt de control", () => {
    const moved = m.setWallEnds(w, [100, 0], w.b)
    expect(moved.curve!.c1).toEqual([100, 500])
    expect(moved.curve!.c2).toEqual([1000, 500])
  })
})
