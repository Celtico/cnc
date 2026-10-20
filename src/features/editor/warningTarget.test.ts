import { describe, expect, it } from "vitest"
import { buildComposition } from "../../core/build/buildComposition"
import { defaultModule, type Composition } from "../../core/model"
import { fixLabel, framePose, warningKey, warningTarget } from "./warningTarget"

/** Un mòdul d'1000 d'ample amb un prestatge (avís `shelf-span`, del compartiment) i el fons de 19 en ranura (`back-groove`, del mòdul). */
function comp(): Composition {
  const m = defaultModule("m", "Ample", { width: 1000, height: 700, depth: 400 })
  return { modules: [{ ...m, carcass: { ...m.carcass, back: "groove", backThickness: 19 }, root: { id: "z", shelves: { n: 1, adjustable: false } } }], references: [] } as unknown as Composition
}

describe("anar a un avís (per decisió de l'usuari, 2026-10-17)", () => {
  it("d'un compartiment: el tria, marca les seves peces, enquadra i obre «Opcions de l'interior»", () => {
    const c = comp()
    const b = buildComposition(c)
    const w = b.warnings.find((x) => x.code === "shelf-span")!
    // Té opcions: cada una porta al seu lloc (la dels prestatges gruixuts, al Front, a sota del «Contingut»).
    expect(w.options?.length).toBeGreaterThan(0)
    expect(fixLabel(w)).toBeNull()
    const t = warningTarget(w, c, b, "shelves")
    expect(t.select).toEqual({ kind: "zone", moduleId: "m", zoneId: "z" })
    expect(t.panels.some((id) => id.includes("shelf"))).toBe(true)
    expect(t.box).not.toBeNull()
    expect(t.fix?.folds).toEqual(["zone-front", "zone-shelves-shelves"])
  })

  it("del mòdul: el tria i obre Caixa › Fons; la càmera mira el centre de la peça", () => {
    const c = comp()
    const b = buildComposition(c)
    const w = b.warnings.find((x) => x.code === "back-groove")!
    expect(w).toBeDefined()
    const t = warningTarget(w, c, b)
    expect(t.select).toEqual({ kind: "module", id: "m" })
    expect(t.fix?.folds).toEqual(["mod-structure", "mod-carcass-back"])
    const pose = framePose(t.box!, { width: 1000, height: 700, depth: 400 })
    expect(pose.position[2]).toBeGreaterThan(pose.target[2])
  })

  it("l'electrodomèstic d'un mòdul sense dividir s'arregla al mòdul (Tipus), no al compartiment", () => {
    const c = comp()
    const w = { code: "appliance" as const, message: "x", moduleId: "m", zoneId: "z" }
    const t = warningTarget(w, c, buildComposition(c), "appliance")
    expect(t.select).toEqual({ kind: "module", id: "m" })
    expect(t.fix?.folds).toEqual(["mod-type"])
  })

  it("la clau per acceptar un avís és la mateixa per al mateix avís al mateix lloc", () => {
    expect(warningKey({ code: "hanging", moduleId: "m", panelId: "side-right" })).toBe(warningKey({ code: "hanging", moduleId: "m", panelId: "side-right" }))
    expect(warningKey({ code: "hanging", moduleId: "m", panelId: "side-left" })).not.toBe(warningKey({ code: "hanging", moduleId: "m", panelId: "side-right" }))
  })
})
