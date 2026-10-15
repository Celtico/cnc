import { z } from "zod"
import { OPTION_CASCADE } from "./optionCascade"
import { CONTROL_ICON, DRAFT_ICON_SET, guessIcon, type DraftIcon } from "./draftIcons"
import type { OptionNode } from "./optionTypes"

/**
 * L'**esborrany de la cascada d'opcions** (Preferències › Opcions en cascada; per decisió de l'usuari, 2026-10-15: «amb
 * reactflow o similar que pugui agregar i treure nodes, no per aplicar a la realitat fins que no ho tinguem clar»). Un
 * dibuix editable: nodes (secció, opció, tria) i fletxes (a dins de, fa aparèixer, fa desaparèixer). Surt del registre
 * (`appCascade`: el que fa el codi ara), l'usuari l'edita i es compara amb el registre (`diffDraft`) per implementar
 * després les diferències al codi. **No s'aplica mai a l'Editor.** Només dades i funcions pures.
 */

export type DraftNodeKind = "section" | "option" | "choice"
export type DraftEdgeKind = "contains" | "reveals" | "hides"

export const DRAFT_KIND_LABEL: Record<DraftNodeKind, string> = { section: "Secció", option: "Opció", choice: "Tria" }
export const DRAFT_EDGE_LABEL: Record<DraftEdgeKind, string> = { contains: "A dins de", reveals: "Fa aparèixer", hides: "Fa desaparèixer" }

const KIND_ICON: Record<DraftNodeKind, DraftIcon> = { section: "subsection", option: "option", choice: "choice" }

const DraftNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["section", "option", "choice"]),
  label: z.string(),
  /** La icona que ha triat l'usuari (`DRAFT_ICONS`; cap o una de desconeguda: `draftIcon`). No compta com a diferència. */
  icon: z.string().optional(),
  /** «Surt quan»: la condició en paraules. */
  when: z.string().optional(),
  /** Nota lliure de l'usuari (no compta com a diferència). */
  note: z.string().optional(),
  /** Possible incoherència (la de l'auditoria del registre o una de l'usuari; no compta com a diferència). */
  issue: z.string().optional(),
})
const DraftEdgeSchema = z.object({
  id: z.string().min(1),
  /** `contains`: el pare (la secció, l'opció de la tria); `reveals`/`hides`: la tria o l'opció que ho decideix. */
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["contains", "reveals", "hides"]),
})
const PointSchema = z.object({ x: z.number(), y: z.number() })
const CascadeDraftSchema = z.object({
  nodes: z.array(DraftNodeSchema),
  edges: z.array(DraftEdgeSchema),
  /**
   * On l'ha deixat l'usuari (arrossegant). Un node sense posició va sol: sota el seu pare, com a la disposició automàtica
   * (`effectivePositions`); «Reordenar automàticament» les treu totes. No compta com a diferència.
   */
  positions: z.record(z.string(), PointSchema).optional(),
})
export type DraftPoint = z.infer<typeof PointSchema>

export type DraftNode = z.infer<typeof DraftNodeSchema>
export type DraftEdge = z.infer<typeof DraftEdgeSchema>
export type CascadeDraft = z.infer<typeof CascadeDraftSchema>

export const edgeId = (kind: DraftEdgeKind, source: string, target: string): string => `${kind}:${source}>${target}`
export const choiceId = (optionId: string, value: string): string => `${optionId}=${value}`

/** El node del registre d'un id de l'esborrany (la tria, el de la seva opció) i el `value` de la tria. */
export function registryRef(id: string): { optionId: string; value?: string } {
  const i = id.indexOf("=")
  return i < 0 ? { optionId: id } : { optionId: id.slice(0, i), value: id.slice(i + 1) }
}

/** La llavor i la icona de cada node de l'app (a part: al node només hi va la que tria l'usuari). */
function seed(): { draft: CascadeDraft; icons: Map<string, DraftIcon>; labels: Map<string, string> } {
  const nodes: DraftNode[] = []
  const icons = new Map<string, DraftIcon>()
  const edges = new Map<string, DraftEdge>()
  const edge = (kind: DraftEdgeKind, source: string, target: string) => {
    const id = edgeId(kind, source, target)
    if (source !== target && !edges.has(id)) edges.set(id, { id, source, target, kind })
  }
  const visit = (n: OptionNode, parent?: string, sectionIcon?: DraftIcon) => {
    // «subsection» (l'engranatge) és la genèrica de les subseccions: abans, la que fa pensar el nom («Opcions del tirador»).
    const own = n.icon === "subsection" ? undefined : n.icon
    const icon: DraftIcon = own ?? guessIcon(n.label) ?? n.icon ?? (n.kind === "field" ? (n.control ? CONTROL_ICON[n.control] : "option") : (sectionIcon ?? KIND_ICON.section))
    nodes.push({ id: n.id, kind: n.kind === "field" ? "option" : "section", label: n.label, ...(n.showIf ? { when: n.showIf } : {}), ...(n.issue ? { issue: n.issue } : {}) })
    icons.set(n.id, icon)
    if (parent) edge("contains", parent, n.id)
    for (const c of n.choices ?? []) {
      const id = choiceId(n.id, c.value)
      nodes.push({ id, kind: "choice", label: c.label })
      icons.set(id, guessIcon(c.label) ?? "choice")
      edge("contains", n.id, id)
      for (const r of c.reveals ?? []) edge("reveals", id, r)
      for (const h of c.hides ?? []) edge("hides", id, h)
    }
    for (const c of n.children ?? []) visit(c, n.id, n.kind === "field" ? sectionIcon : icon)
  }
  for (const n of OPTION_CASCADE) visit(n)
  return { draft: { nodes, edges: [...edges.values()] }, icons, labels: new Map(nodes.map((n) => [n.id, n.label])) }
}

let app: ReturnType<typeof seed> | undefined
/** La cascada que fa el codi ara (del registre): la llavor de l'esborrany i la base de les diferències. */
export function appCascade(): CascadeDraft {
  app ??= seed()
  return app.draft
}

/**
 * La icona d'un node: la que ha triat l'usuari; si no, la de l'app (la secció de l'inspector, la que fa pensar el nom o
 * la del control) mentre es digui igual; si no (un node nou o reanomenat: «Interior» porta la de l'interior), la que fa
 * pensar el nom i, si no, la del tipus.
 */
export function draftIcon(n: DraftNode): DraftIcon {
  if (n.icon && DRAFT_ICON_SET.has(n.icon)) return n.icon as DraftIcon
  app ??= seed()
  const fromApp = app.icons.get(n.id)
  if (fromApp && app.labels.get(n.id) === n.label) return fromApp
  return guessIcon(n.label) ?? fromApp ?? KIND_ICON[n.kind]
}

// --- Canvis ------------------------------------------------------------------------------------------------------------

/** El pare de cada node a l'arbre (la primera fletxa «a dins de» que hi arriba). */
function containsParent(draft: CascadeDraft): Map<string, string> {
  const out = new Map<string, string>()
  for (const e of draft.edges) if (e.kind === "contains" && !out.has(e.target)) out.set(e.target, e.source)
  return out
}

/** El node i tot el que té a dins (per les fletxes «a dins de»). */
function subtreeIds(draft: CascadeDraft, ids: Iterable<string>): Set<string> {
  const kids = new Map<string, string[]>()
  for (const e of draft.edges) if (e.kind === "contains") kids.set(e.source, [...(kids.get(e.source) ?? []), e.target])
  const out = new Set<string>()
  const stack = [...ids]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    stack.push(...(kids.get(id) ?? []))
  }
  return out
}

/** Un node nou (a dins de `parent`, si n'hi ha). */
export function addDraftNode(draft: CascadeDraft, node: DraftNode, parent?: string): CascadeDraft {
  const edges = parent && draft.nodes.some((n) => n.id === parent) ? [...draft.edges, { id: edgeId("contains", parent, node.id), source: parent, target: node.id, kind: "contains" as const }] : draft.edges
  return { ...draft, nodes: [...draft.nodes, node], edges }
}

/** Treu nodes (amb tot el que tenen a dins) i fletxes; les fletxes que toquen un node tret també se'n van. */
export function removeFromDraft(draft: CascadeDraft, nodeIds: Iterable<string>, edgeIds: Iterable<string> = []): CascadeDraft {
  const gone = subtreeIds(draft, nodeIds)
  const goneEdges = new Set(edgeIds)
  if (!gone.size && !goneEdges.size) return draft
  return withPositions(
    {
      nodes: draft.nodes.filter((n) => !gone.has(n.id)),
      edges: draft.edges.filter((e) => !goneEdges.has(e.id) && !gone.has(e.source) && !gone.has(e.target)),
    },
    draft.positions && Object.fromEntries(Object.entries(draft.positions).filter(([id]) => !gone.has(id))),
  )
}

/** L'esborrany amb aquestes posicions (sense cap, sense el camp). */
function withPositions(d: CascadeDraft, positions: Record<string, DraftPoint> | undefined): CascadeDraft {
  const { positions: _old, ...rest } = d
  return positions && Object.keys(positions).length ? { ...rest, positions } : rest
}

/** Desa on l'usuari ha deixat uns nodes (`null`: que tornin a anar sols). */
export function moveDraftNodes(draft: CascadeDraft, moves: Record<string, DraftPoint | null>): CascadeDraft {
  const next = { ...draft.positions }
  for (const [id, p] of Object.entries(moves)) {
    if (p) next[id] = { x: Math.round(p.x), y: Math.round(p.y) }
    else delete next[id]
  }
  return withPositions(draft, next)
}

/** «Reordenar automàticament»: tots els nodes tornen a anar sols (arbre de dalt a baix). */
export function clearDraftPositions(draft: CascadeDraft): CascadeDraft {
  return withPositions(draft, undefined)
}

/** `node` és a dins de `of` (o és ell mateix): una fletxa «a dins de» de `node` cap a `of` faria un cercle. */
function inside(draft: CascadeDraft, node: string, of: string): boolean {
  return subtreeIds(draft, [of]).has(node)
}

/**
 * Posa `child` a dins de `parent` (arrossegar de la nansa de sota d'un node a la de dalt d'un altre, o deixar-lo a sobre):
 * la fletxa «a dins de» que tenia es canvia per la nova. Res si és el mateix node o si `parent` és a dins de `child`
 * (faria un cercle).
 */
export function reparentDraft(draft: CascadeDraft, child: string, parent: string): CascadeDraft {
  if (child === parent || inside(draft, parent, child)) return draft
  const id = edgeId("contains", parent, child)
  const old = containsParent(draft).get(child)
  if (old === parent) return draft
  const edges = draft.edges.filter((e) => !(e.kind === "contains" && e.target === child) && e.id !== id)
  return { ...draft, edges: [...edges, { id, source: parent, target: child, kind: "contains" }] }
}

/** Canvia el tipus d'una fletxa (si n'hi ha una d'igual, només en queda una; una «a dins de» que faria un cercle, no). */
export function setDraftEdgeKind(draft: CascadeDraft, id: string, kind: DraftEdgeKind): CascadeDraft {
  const e = draft.edges.find((x) => x.id === id)
  if (!e || e.kind === kind) return draft
  if (kind === "contains" && inside(draft, e.source, e.target)) return draft
  const nid = edgeId(kind, e.source, e.target)
  const rest = draft.edges.filter((x) => x.id !== id && x.id !== nid)
  return { ...draft, edges: [...rest, { ...e, id: nid, kind }] }
}

/** Canvia el nom, el tipus, la condició, la nota o la incoherència d'un node (un text buit es treu). */
export function updateDraftNode(draft: CascadeDraft, id: string, patch: Partial<Omit<DraftNode, "id">>): CascadeDraft {
  return {
    ...draft,
    nodes: draft.nodes.map((n) => {
      if (n.id !== id) return n
      const next: DraftNode = { ...n, ...patch }
      for (const k of ["when", "note", "issue"] as const) if (!next[k]?.trim()) delete next[k]
      return next
    }),
  }
}

/** Torna a posar un node de l'app que s'havia tret, amb les fletxes de l'app que el toquen (si l'altre extrem hi és). */
export function restoreAppNode(draft: CascadeDraft, id: string): CascadeDraft {
  const base = appCascade()
  const node = base.nodes.find((n) => n.id === id)
  if (!node || draft.nodes.some((n) => n.id === id)) return draft
  const have = new Set([...draft.nodes.map((n) => n.id), id])
  const known = new Set(draft.edges.map((e) => e.id))
  const edges = base.edges.filter((e) => (e.source === id || e.target === id) && have.has(e.source) && have.has(e.target) && !known.has(e.id))
  return { ...draft, nodes: [...draft.nodes, node], edges: [...draft.edges, ...edges] }
}

/** Torna a posar una fletxa de l'app que s'havia tret (si els dos nodes hi són). */
export function restoreAppEdge(draft: CascadeDraft, id: string): CascadeDraft {
  const e = appCascade().edges.find((x) => x.id === id)
  const have = new Set(draft.nodes.map((n) => n.id))
  if (!e || !have.has(e.source) || !have.has(e.target) || draft.edges.some((x) => x.id === id)) return draft
  return { ...draft, edges: [...draft.edges, e] }
}

// --- Diferències amb l'app ---------------------------------------------------------------------------------------------

/** El que compta com a canvi d'un node: el nom, el tipus i quan surt (la nota i la incoherència són anotacions). */
export type DraftNodeCore = Pick<DraftNode, "label" | "kind" | "when">
/** Un node canviat: com és a l'app i com és a l'esborrany. */
export interface DraftNodeChange {
  before: DraftNodeCore
  after: DraftNodeCore
}
const core = (n: DraftNode): DraftNodeCore => ({ label: n.label.trim(), kind: n.kind, when: n.when?.trim() || undefined })

export interface DraftDiff {
  added: Set<string>
  changed: Map<string, DraftNodeChange>
  removed: DraftNode[]
  addedEdges: Set<string>
  removedEdges: DraftEdge[]
  /** Quantes diferències hi ha en total. */
  count: number
}

/** Què és diferent de la cascada de l'app: nodes i fletxes nous, trets i nodes canviats. */
export function diffDraft(draft: CascadeDraft, base: CascadeDraft = appCascade()): DraftDiff {
  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]))
  const ids = new Set(draft.nodes.map((n) => n.id))
  const added = new Set<string>()
  const changed = new Map<string, DraftNodeChange>()
  for (const n of draft.nodes) {
    const b = baseNodes.get(n.id)
    if (!b) added.add(n.id)
    else {
      const before = core(b), after = core(n)
      if (before.label !== after.label || before.kind !== after.kind || before.when !== after.when) changed.set(n.id, { before, after })
    }
  }
  const removed = base.nodes.filter((n) => !ids.has(n.id))
  const baseEdges = new Set(base.edges.map((e) => e.id))
  const edgeIds = new Set(draft.edges.map((e) => e.id))
  const addedEdges = new Set(draft.edges.filter((e) => !baseEdges.has(e.id)).map((e) => e.id))
  const removedEdges = base.edges.filter((e) => !edgeIds.has(e.id))
  return { added, changed, removed, addedEdges, removedEdges, count: added.size + changed.size + removed.length + addedEdges.size + removedEdges.length }
}

// --- Fitxer (Exportar / Importar JSON) i lectura del desat -------------------------------------------------------------

const FORMAT = "mobles-cnc/opcions-en-cascada"

/** L'esborrany i les diferències amb l'app, per implementar-les després al codi. */
export function draftToJson(draft: CascadeDraft, now = new Date()): string {
  const d = diffDraft(draft)
  const byId = new Map(draft.nodes.map((n) => [n.id, n]))
  const edgesById = new Map(draft.edges.map((e) => [e.id, e]))
  const diff = {
    nodesAfegits: draft.nodes.filter((n) => d.added.has(n.id)),
    nodesTrets: d.removed,
    nodesCanviats: [...d.changed].map(([id, c]) => ({ id, abans: c.before, ara: c.after, ...(byId.get(id)?.note ? { nota: byId.get(id)!.note } : {}) })),
    fletxesAfegides: [...d.addedEdges].map((id) => edgesById.get(id)!),
    fletxesTretes: d.removedEdges,
    notes: draft.nodes.filter((n) => n.note).map((n) => ({ id: n.id, label: n.label, nota: n.note })),
  }
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: now.toISOString(), draft, diff }, null, 2)
}

/** Neteja un esborrany llegit: ids repetits fora i les fletxes que apunten a un node que no hi és, també. */
function clean(d: CascadeDraft): CascadeDraft {
  const seen = new Set<string>()
  const nodes = d.nodes.filter((n) => !seen.has(n.id) && !!seen.add(n.id))
  const edgeSeen = new Set<string>()
  const edges = d.edges
    .map((e) => ({ ...e, id: edgeId(e.kind, e.source, e.target) }))
    .filter((e) => seen.has(e.source) && seen.has(e.target) && e.source !== e.target && !edgeSeen.has(e.id) && !!edgeSeen.add(e.id))
  const positions = d.positions && Object.fromEntries(Object.entries(d.positions).filter(([id]) => seen.has(id)))
  return withPositions({ nodes, edges }, positions)
}

/** Llegeix un fitxer exportat (o només l'esborrany). Llança un error en català si no ho és. */
export function parseDraftJson(text: string): CascadeDraft {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("No és un fitxer JSON.")
  }
  const obj = raw && typeof raw === "object" && "draft" in raw ? (raw as { draft: unknown }).draft : raw
  const res = CascadeDraftSchema.safeParse(obj)
  if (!res.success) throw new Error("No és un esborrany d'opcions en cascada.")
  return clean(res.data)
}

/** El desat a IndexedDB: l'esborrany i les branques plegades. Un de dolent: `null` (es torna a començar de l'app). */
export function parseStoredDraft(raw: unknown): { draft: CascadeDraft; collapsed: string[] } | null {
  const res = z.object({ draft: CascadeDraftSchema, collapsed: z.array(z.string()).default([]) }).safeParse(raw)
  return res.success ? { draft: clean(res.data.draft), collapsed: res.data.collapsed } : null
}
