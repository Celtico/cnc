import { describe, expect, it } from "vitest"
import { copyItems, defaultModule, insertItemsCopy, moduleFootprint, moduleFrontFace, modulePlacements, mountModule, moveModuleBy, moveMultiBy, rightWallX, wallSides, withRightWall, type Composition, type Module } from "."

/** Tres baixos a la fila (A, B, C, de 600, a 800 l'un de l'altre) i un lliure al terra (F) on diguem. */
const comp = (fx: number, fz: number, rot?: 90 | 270 | 180): Composition => {
  const m = (id: string, gap = 0): Module => ({ ...defaultModule(id, id), gapBefore: gap })
  return { kind: "moble", modules: [m("A"), m("B", 800), m("C", 800), { ...m("F"), x: fx, wallGap: fz, ...(rot ? { rot } : {}) }], references: [] }
}
const feet = (c: Composition) => {
  const ps = modulePlacements(c)
  return Object.fromEntries(c.modules.map((m, i) => { const f = moduleFootprint(m, ps[i]!, moduleFrontFace(m)); return [m.id, [f.x0, f.x1, f.z0, f.z1].map(Math.round)] }))
}

describe("arrambat o penjat: a la paret del seu darrere (segons els fronts), sense saltar", () => {
  it("fronts endavant: a la paret del fons, entra a la fila on és, i els altres no es mouen", () => {
    const c = comp(2100, 40)
    const out = mountModule(c, "F", "wall", 2100)
    const a = feet(c), b = feet(out)
    for (const id of ["A", "B", "C"]) expect(b[id]).toEqual(a[id])
    expect(out.modules.map((m) => m.id)).toEqual(["A", "B", "F", "C"])
    expect(b.F![2]).toBe(0)
    expect(wallSides(out)[2]).toBe("back")
  })
  it("fronts a la dreta: el primer de la fila, d'esquena a ella, a la mateixa distància del fons", () => {
    const c = comp(0, 1500, 90)
    const out = mountModule(c, "F", "hung", 0)
    // Penjat: és el primer (l'únic) de la fila dels penjats.
    const f = out.modules.find((m) => m.id === "F")!
    expect(f.rot).toBe(90)
    // A la mateixa distància del fons on era: el mateix tros de paret.
    expect(feet(out).F![2]).toBe(feet(c).F![2])
    expect(wallSides(out)[out.modules.indexOf(f)]).toBe("left")
    const a = feet(c), b = feet(out)
    for (const id of ["A", "B", "C"]) expect(b[id]).toEqual(a[id])
  })
  it("fronts a l'esquerra: l'últim de la fila, d'esquena a ella", () => {
    const c = comp(3000, 1200, 270)
    const out = mountModule(c, "F", "wall", 3000)
    const f = out.modules.find((m) => m.id === "F")!
    expect(f.rot).toBe(270)
    expect(wallSides(out)[out.modules.indexOf(f)]).toBe("right")
    const a = feet(c), b = feet(out)
    for (const id of ["A", "B", "C"]) expect(b[id]).toEqual(a[id])
  })
  it("fronts enrere (illa): la paret més a prop", () => {
    const out = mountModule(comp(0, 1500, 180), "F", "wall", 0)
    const f = out.modules.find((m) => m.id === "F")!
    expect(f.rot).toBe(90)
    expect(wallSides(out)[out.modules.indexOf(f)]).toBe("left")
  })
  it("un de la fila que es penja: el següent de la fila no es mou", () => {
    const c = comp(5000, 3000)
    const out = mountModule(c, "B", "hung", 0)
    const a = feet(c), b = feet(out)
    expect(b.C).toEqual(a.C)
    expect(b.A).toEqual(a.A)
  })

  it("a la paret d'un costat: enganxat a la paret sigui on sigui de la llista, i la fila del fons no el compta", () => {
    const c = comp(0, 1500, 90)
    const out = mountModule(c, "F", "wall", 0)
    const b = feet(out)
    expect(b.F![0]).toBe(0)
    expect(b.A).toEqual(feet(c).A)
  })
  it("moure per la paret un d'abans (girat a l'inici de la fila): passa a la paret i els de la fila no es mouen", () => {
    const c: Composition = { kind: "moble", modules: [{ ...defaultModule("A", "A"), rot: 90 }, defaultModule("B", "B")], references: [] }
    const out = moveModuleBy(c, "A", 0, 0, 300)
    expect(feet(out).B).toEqual(feet(c).B)
    expect(feet(out).A![2]).toBe(feet(c).A![2]! + 300)
  })
  it("copiar i enganxar un de la paret del costat: la còpia, a la mateixa paret, a continuació", () => {
    const c = mountModule(comp(0, 1500, 90), "F", "wall", 0)
    const res = insertItemsCopy(c, copyItems(c, [{ kind: "module", id: "F" }]))
    const id = res.items[0]!.id
    const ps = modulePlacements(res.comp)
    const fp = (k: number) => moduleFootprint(res.comp.modules[k]!, ps[k]!, moduleFrontFace(res.comp.modules[k]!))
    const f = fp(res.comp.modules.findIndex((m) => m.id === "F")), g = fp(res.comp.modules.findIndex((m) => m.id === id))
    expect(Math.round(g.x0)).toBe(0)
    expect(Math.round(g.z0)).toBe(Math.round(f.z1))
    expect(feet(res.comp).A).toEqual(feet(c).A)
  })
})

describe("la paret dreta no es mou («si ja hi ha un moble a la paret»)", () => {
  const withRight = (): Composition => {
    const m = (id: string, gap = 0): Module => ({ ...defaultModule(id, id), gapBefore: gap })
    const r = (id: string, along: number, depth: number): Module => ({ ...m(id), rot: 270, sideAlong: along, carcass: { ...m(id).carcass, depth } })
    return { kind: "moble", modules: [m("A"), m("B", 800), m("C", 800), r("R", 1200, 560), r("S", 2400, 300)], references: [] }
  }
  it("tots els de la paret dreta hi van d'esquena, siguin de la fondària que siguin", () => {
    const c = withRight(), f = feet(c)
    expect(f.R![1]).toBe(f.S![1])
    expect(f.R![0]).toBe(f.C![1])
  })
  it("si el de la fila s'aparta, la paret i els seus mòduls no es mouen", () => {
    const c = withRight()
    const moved = { ...c, modules: c.modules.map((m) => (m.id === "C" ? { ...m, gapBefore: 100 } : m)) }
    const out = withRightWall(c, moved)
    expect(feet(out).R).toEqual(feet(c).R)
    expect(feet(out).S).toEqual(feet(c).S)
    // Un mòdul nou a la paret dreta s'hi alinea.
    const more = withRightWall(out, { ...out, modules: [...out.modules, { ...defaultModule("T", "T"), rot: 270, sideAlong: 3600 }] })
    expect(feet(more).T![1]).toBe(feet(c).R![1])
  })
  it("si un de la fila la passaria, s'allunya i s'hi queda", () => {
    const c = withRight(), before = rightWallX(c)!
    const out = withRightWall(c, { ...c, modules: c.modules.map((m) => (m.id === "C" ? { ...m, gapBefore: 1300 } : m)) })
    expect(rightWallX(out)).toBe(before + 500)
    expect(out.scene?.rightWallX).toBe(before + 500)
  })
  it("el primer que s'hi posa la deixa on acabava el moble", () => {
    const c = comp(4500, 1200, 270), end = Math.max(...Object.values(feet(c)).map((f) => f[1]!))
    const out = withRightWall(c, mountModule(c, "F", "wall", 4500))
    expect(rightWallX(out)).toBe(end)
  })
})

describe("un mòdul lliure al terra no mou la paret dreta", () => {
  it("el que era a la paret dreta passa a lliure al terra: la paret i els altres no es mouen", () => {
    const m = (id: string, gap = 0): Module => ({ ...defaultModule(id, id), gapBefore: gap })
    const c: Composition = { kind: "moble", modules: [m("A"), m("B", 800), { ...m("R"), rot: 270, sideAlong: 1200 }, { ...m("S"), rot: 270, sideAlong: 2400 }], references: [] }
    const fixed = withRightWall(c, c), before = rightWallX(fixed)!
    const out = withRightWall(fixed, mountModule(fixed, "S", "floor", Math.round(feet(fixed).S![0]!)))
    expect(rightWallX(out)).toBe(before)
    expect(feet(out).R).toEqual(feet(fixed).R)
  })
})

describe("moure junts un mòdul i un objecte de referència: no se separen", () => {
  const m = (id: string, gap = 0): Module => ({ ...defaultModule(id, id), gapBefore: gap })
  const c: Composition = {
    kind: "moble",
    modules: [m("A"), m("B", 800), { ...m("R"), rot: 270, sideAlong: 1200 }],
    references: [{ id: "P", name: "Pilar", w: 300, h: 2400, d: 300, x: 2000, y: 0, z: 1000 } as Composition["references"][number]],
  }
  const items = [{ kind: "module", id: "R" }, { kind: "ref", id: "P" }] as const
  it("de costat, el de la paret dreta no pot: l'objecte tampoc", () => {
    const out = moveMultiBy(c, items, 500, 0, 0)
    expect(feet(out).R).toEqual(feet(c).R)
    expect(out.references[0]!.x).toBe(2000)
  })
  it("al llarg de la paret, tots dos igual", () => {
    const out = moveMultiBy(c, items, 0, 0, 300)
    expect(feet(out).R![2]! - feet(c).R![2]!).toBe(300)
    expect(out.references[0]!.z).toBe(1300)
    // Els de la fila del fons no es toquen.
    expect(out.modules.map((x) => x.gapBefore)).toEqual(c.modules.map((x) => x.gapBefore))
  })
})
