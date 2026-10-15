import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, parseSettings } from ".."
import { OPTION_NODES } from "./optionCascade"
import {
  DRAFT_ICONS,
  draftIcon,
  addDraftNode,
  appCascade,
  clearDraftPositions,
  choiceId,
  diffDraft,
  draftToJson,
  edgeId,
  moveDraftNodes,
  parseDraftJson,
  parseStoredDraft,
  removeFromDraft,
  reparentDraft,
  restoreAppEdge,
  restoreAppNode,
  setDraftEdgeKind,
  updateDraftNode,
  type CascadeDraft,
} from "./cascadeDraft"
import { ancestorIds, descendantCount, draftTree, effectivePositions, layoutDraft, visibleIds } from "./cascadeLayout"

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

describe("esborrany: la llavor de l'app", () => {
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
  it("sense canvis, cap diferència; les arrels són les del registre", () => {
    expect(diffDraft(app).count).toBe(0)
    expect(draftTree(app).roots.length).toBeGreaterThanOrEqual(5)
    expect(draftTree(app).roots).toContain("module")
  })
})

describe("esborrany: editar i diferències", () => {
  const app = appCascade()
  it("afegir, canviar, treure i unir", () => {
    let d: CascadeDraft = addDraftNode(app, { id: "n1", kind: "option", label: "Opció nova" }, "module.carcass")
    d = updateDraftNode(d, "module.carcass.back", { label: "Fons de l'armari", note: "provar", when: "  " })
    d = removeFromDraft(d, ["module.position"])
    d = setDraftEdgeKind(reparentDraft(d, "n1", choiceId("module.carcass.back", "groove")), edgeId("contains", choiceId("module.carcass.back", "groove"), "n1"), "reveals")
    d = reparentDraft(d, "n1", "module.carcass")
    const diff = diffDraft(d)
    expect([...diff.added]).toEqual(["n1"])
    expect(diff.changed.get("module.carcass.back")?.after.label).toBe("Fons de l'armari")
    // Treure una secció en treu tot el que té a dins.
    expect(diff.removed.map((n) => n.id)).toContain("module.position.mount")
    expect(diff.removed.map((n) => n.id)).toContain(choiceId("module.position.mount", "hung"))
    // Unir d'una nansa a l'altra el posa a dins; la fletxa es pot canviar a «fa aparèixer».
    expect(diff.addedEdges.has(edgeId("reveals", choiceId("module.carcass.back", "groove"), "n1"))).toBe(true)
    expect(diff.addedEdges.has(edgeId("contains", "module.carcass", "n1"))).toBe(true)
    // El text buit es treu.
    expect(d.nodes.find((n) => n.id === "module.carcass.back")).not.toHaveProperty("when")
  })
  it("la nota no és una diferència", () => {
    expect(diffDraft(updateDraftNode(app, "module.carcass.back", { note: "mirar-ho" })).count).toBe(0)
  })
  it("unir o deixar a sobre canvia el pare; res de cercles", () => {
    let d = addDraftNode(app, { id: "free", kind: "section", label: "Lliure" })
    d = reparentDraft(d, "free", "module")
    expect(d.edges.at(-1)?.id).toBe(edgeId("contains", "module", "free"))
    expect(reparentDraft(d, "free", "free")).toBe(d)
    // Canviar de pare: la fletxa d'abans se'n va.
    const moved = reparentDraft(d, "free", "zone")
    expect(moved.edges.filter((e) => e.kind === "contains" && e.target === "free").map((e) => e.source)).toEqual(["zone"])
    // «module» a dins de «free» faria un cercle: res.
    expect(reparentDraft(d, "module", "free")).toBe(d)
    const c = { ...d, edges: [...d.edges, { id: edgeId("reveals", "free", "zone"), source: "free", target: "zone", kind: "reveals" as const }] }
    expect(setDraftEdgeKind(c, edgeId("reveals", "free", "zone"), "hides").edges.at(-1)?.kind).toBe("hides")
  })
  it("posicions: moure, tornar a anar sol i reordenar; no són una diferència", () => {
    let d = moveDraftNodes(app, { module: { x: 10.4, y: 20.6 } })
    expect(d.positions).toEqual({ module: { x: 10, y: 21 } })
    expect(diffDraft(d).count).toBe(0)
    expect(moveDraftNodes(d, { module: null })).not.toHaveProperty("positions")
    d = removeFromDraft(d, ["module"])
    expect(d).not.toHaveProperty("positions")
    expect(clearDraftPositions(moveDraftNodes(app, { zone: { x: 1, y: 1 } }))).toEqual(app)
  })
  it("recuperar un node o una fletxa de l'app", () => {
    const d = removeFromDraft(app, ["module.carcass.back"])
    const back = restoreAppNode(d, "module.carcass.back")
    expect(back.nodes.some((n) => n.id === "module.carcass.back")).toBe(true)
    expect(back.edges.some((e) => e.id === edgeId("contains", "module.carcass", "module.carcass.back"))).toBe(true)
    const e = app.edges[0]!
    expect(restoreAppEdge(removeFromDraft(app, [], [e.id]), e.id).edges.some((x) => x.id === e.id)).toBe(true)
  })
})

describe("esborrany: fitxer i desat", () => {
  it("exportar i tornar a importar; el fitxer porta les diferències", () => {
    const d = addDraftNode(appCascade(), { id: "n1", kind: "choice", label: "Nova" }, "module.carcass.back")
    const json = draftToJson(d, new Date("2026-10-15T00:00:00Z"))
    const file = JSON.parse(json)
    expect(file.diff.nodesAfegits.map((n: { id: string }) => n.id)).toEqual(["n1"])
    expect(parseDraftJson(json)).toEqual(d)
    expect(() => parseDraftJson("{")).toThrow("No és un fitxer JSON.")
    expect(() => parseDraftJson("{\"nodes\":1}")).toThrow()
  })
  it("les fletxes a un node que no hi és i els repetits es treuen en llegir", () => {
    const raw = { draft: { nodes: [{ id: "a", kind: "section", label: "A" }, { id: "a", kind: "section", label: "A2" }], edges: [{ id: "x", source: "a", target: "b", kind: "contains" }] }, collapsed: ["a"] }
    expect(parseStoredDraft(raw)).toEqual({ draft: { nodes: [{ id: "a", kind: "section", label: "A" }], edges: [] }, collapsed: ["a"] })
    expect(parseStoredDraft({ foo: 1 })).toBeNull()
  })
})

describe("esborrany: plegar i disposició", () => {
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
  it("un node que l'usuari ha mogut es queda on és i els seus fills sense posició el segueixen", () => {
    const size = () => ({ w: 100, h: 20 })
    const auto = layoutDraft(tree, new Set(), size, "TB")
    const pos = effectivePositions({ ...d, positions: { a: { x: 1000, y: 500 } } }, tree, new Set(), size)
    expect(pos.get("a")).toEqual({ x: 1000, y: 500 })
    expect(pos.get("a1")).toEqual({ x: 1000 + auto.get("a1")!.x - auto.get("a")!.x, y: 500 + auto.get("a1")!.y - auto.get("a")!.y })
    expect(pos.get("b")).toEqual(auto.get("b"))
  })
})

describe("esborrany: icones", () => {
  it("cada node de la llavor en porta una de coneguda; les seccions, la de l'inspector", () => {
    const app = appCascade()
    for (const n of app.nodes) expect(DRAFT_ICONS).toContain(n.icon)
    expect(app.nodes.find((n) => n.id === "module.carcass")?.icon).toBe("carcass")
    expect(app.nodes.find((n) => n.kind === "choice")?.icon).toBe("choice")
  })
  it("un node desat sense icona (o amb una de desconeguda) agafa la de l'app i, si no, la del tipus; no és diferència", () => {
    expect(draftIcon({ id: "module.carcass", kind: "section", label: "Caixa" })).toBe("carcass")
    expect(draftIcon({ id: "nou", kind: "option", label: "Nova", icon: "???" })).toBe("option")
    const app = appCascade()
    const edited = { ...app, nodes: app.nodes.map((n) => (n.id === "module.carcass" ? { ...n, icon: "cnc" } : n)) }
    expect(draftIcon(edited.nodes.find((n) => n.id === "module.carcass")!)).toBe("cnc")
    expect(diffDraft(edited).count).toBe(0)
  })
})
