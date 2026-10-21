import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, parseSettings } from ".."
import { OPTION_NODES } from "./optionCascade"
import { DRAFT_ICONS, guessIcon } from "./draftIcons"
import { appCascade, choiceId, draftIcon, edgeId, type CascadeDraft } from "./cascadeDraft"
import { ancestorIds, descendantCount, draftTree, layoutDraft, stackedLayout, visibleIds } from "./cascadeLayout"

describe("registre de les opcions en cascada", () => {
  const nodes = [...OPTION_NODES.values()]
  it("les tries revelen o amaguen opcions que hi són", () => {
    const bad = nodes.flatMap((n) => (n.choices ?? []).flatMap((c) => [...(c.reveals ?? []), ...(c.hides ?? [])].filter((id) => !OPTION_NODES.has(id)).map((id) => `${n.id} → ${id}`)))
    expect(bad).toEqual([])
  })
  it("els apartats (`group`) no s'amaguen; els que no s'amaguen diuen per què", () => {
    expect(nodes.filter((n) => n.kind === "group" && n.hideable).map((n) => n.id)).toEqual([])
    expect(nodes.filter((n) => n.kind !== "group" && !n.hideable && !n.why).map((n) => n.id)).toEqual([])
  })
})

describe("v49: les preferències de la v48 (amagar i per defecte) es treuen", () => {
  it("una v48 amb `optionPrefs` es llegeix sense", () => {
    const { settings } = parseSettings({ ...DEFAULT_SETTINGS, version: 48, optionPrefs: { "module.carcass.back": { hidden: true } } })
    expect(settings).not.toHaveProperty("optionPrefs")
  })
})

describe("cascada: la llavor de l'app", () => {
  const app = appCascade()
  it("un node per opció del registre i un per tria, amb els tipus", () => {
    const choices = [...OPTION_NODES.values()].reduce((s, n) => s + (n.choices?.length ?? 0), 0)
    expect(app.nodes).toHaveLength(OPTION_NODES.size + choices)
    expect(app.nodes.find((n) => n.id === "module.carcass.back")?.kind).toBe("option")
    expect(app.nodes.find((n) => n.id === "module")?.kind).toBe("section")
    expect(app.nodes.find((n) => n.id === choiceId("module.position.mount", "hung"))).toMatchObject({ kind: "choice", label: "Penjat" })
  })
  it("fletxes: a dins de (l'arbre), fa aparèixer i fa desaparèixer", () => {
    const ids = new Set(app.edges.map((e) => e.id))
    expect(ids.has(edgeId("contains", "module.position", "module.position.mount"))).toBe(true)
    expect(ids.has(edgeId("contains", "module.position.mount", choiceId("module.position.mount", "hung")))).toBe(true)
    expect(ids.has(edgeId("reveals", choiceId("module.position.mount", "hung"), "module.position.height"))).toBe(true)
    expect(ids.has(edgeId("hides", choiceId("module.position.mount", "floor"), "module.position.gap"))).toBe(true)
  })
  it("les possibles incoherències i les condicions vénen del registre", () => {
    const withIssue = [...OPTION_NODES.values()].filter((n) => n.issue).length
    expect(app.nodes.filter((n) => n.issue)).toHaveLength(withIssue)
    expect(app.nodes.find((n) => n.id === "module.position.height")?.when).toBe("Fila = Penjat")
  })
  it("les arrels són les del registre, en el seu ordre", () => {
    expect(draftTree(app).roots).toEqual(["structure", "moble", "module", "zone", "part", "ref", "multi"])
  })
})

describe("cascada: plegar i disposició", () => {
  const d: CascadeDraft = {
    nodes: ["r", "a", "b", "a1", "a2", "s"].map((id) => ({ id, kind: "section" as const, label: id })),
    edges: [["r", "a"], ["r", "b"], ["a", "a1"], ["a", "a2"], ["a2", "r"]].map(([s, t]) => ({ id: edgeId("contains", s!, t!), source: s!, target: t!, kind: "contains" as const })),
  }
  const tree = draftTree(d)
  it("l'arbre (el cercle a2 → r no compta) i el que es veu amb una branca plegada", () => {
    expect(tree.roots).toEqual(["r", "s"])
    expect(descendantCount(tree, "r")).toBe(4)
    expect(visibleIds(tree, new Set(["a"]))).toEqual(["r", "a", "b", "s"])
    expect(ancestorIds(tree, "a2")).toEqual(["a", "r"])
  })
  it("d'esquerra a dreta: nivells en columnes, el pare al mig dels fills, sense trepitjar-se", () => {
    const pos = layoutDraft(tree, new Set(), () => ({ w: 100, h: 20 }), "LR", { level: 50, sibling: 10, tree: 40 })
    expect(pos.get("r")!.x).toBe(0)
    expect(pos.get("a")!.x).toBe(150)
    expect(pos.get("a1")!.x).toBe(300)
    expect(pos.get("a1")!.y).toBe(0)
    expect(pos.get("a2")!.y).toBe(30)
    expect(pos.get("a")!.y).toBe(15)
    expect(pos.get("b")!.y).toBe(60)
    // L'arbre següent, després del primer.
    expect(pos.get("s")!.y).toBe(130)
    const tb = layoutDraft(tree, new Set(["a"]), () => ({ w: 100, h: 20 }), "TB")
    expect(tb.has("a1")).toBe(false)
    expect(tb.get("a")!.y).toBe(tb.get("b")!.y)
  })
  it("els arbres, un sota l'altre i centrats a l'arrel", () => {
    const size = () => ({ w: 100, h: 20 })
    const pos = stackedLayout(tree, new Set(), size, { level: 50, sibling: 10, tree: 40 })
    expect(pos.get("r")).toEqual({ x: -50, y: 0 })
    // r → a → a1: tres nivells (0, 70, 140); l'arbre «s» comença 40 més avall del final (160).
    expect(pos.get("a1")!.y).toBe(140)
    expect(pos.get("s")).toEqual({ x: -50, y: 200 })
    expect(stackedLayout(tree, new Set(["r"]), size, { level: 50, sibling: 10, tree: 40 }).get("s")!.y).toBe(60)
  })
})

describe("cascada: icones", () => {
  it("cada node de l'app en té una de coneguda: la de la secció de l'inspector, la que fa pensar el nom o la del control", () => {
    const app = appCascade()
    for (const n of app.nodes) expect(DRAFT_ICONS).toContain(draftIcon(n))
    const byId = (id: string) => draftIcon(app.nodes.find((n) => n.id === id)!)
    expect(byId("module.carcass")).toBe("carcass")
    expect(byId("zone.front.drawers")).toBe("drawers")
    expect(byId("zone.front.flap.handleOptions")).toBe("handle")
  })
  it("un node que no és de l'app agafa la que fa pensar el nom i, si no, la del tipus", () => {
    expect(draftIcon({ id: "nou", kind: "section", label: "Interior" })).toBe("interior")
    expect(draftIcon({ id: "nou", kind: "option", label: "Cosa estranya" })).toBe("option")
  })
  it("pel nom, sense accents ni majúscules", () => {
    expect(guessIcon("Alçada dels calaixos")).toBe("height")
    expect(guessIcon("Opcions de la guia de calaix")).toBe("hardware")
    expect(guessIcon("Frigorífic")).toBe("fridge")
    expect(guessIcon("Tipus")).toBeUndefined()
    expect(guessIcon("Base")).toBe("base")
    expect(guessIcon("Sense base")).toBe("noBase")
    expect(guessIcon("Sense veta")).toBe("none")
    expect(guessIcon("Directe a terra")).toBe("legs")
    expect(guessIcon("Potes")).toBe("feet")
    expect(guessIcon("Cap a la paret")).not.toBe("none")
  })
})
