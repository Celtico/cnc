import type { CascadeDraft } from "./cascadeDraft"

/**
 * L'arbre de l'esborrany de la cascada (`cascadeDraft.ts`) i on va cada node al dibuix: un arbre ordenat per les fletxes
 * «a dins de» (la primera que arriba a cada node; les que farien un cercle no compten), les branques plegades i una
 * disposició automàtica d'esquerra a dreta o de dalt a baix. Pur (el dibuix és de React Flow, a la UI).
 */

export interface DraftTree {
  roots: string[]
  children: Map<string, string[]>
  parent: Map<string, string>
}

/** L'arbre (en l'ordre dels nodes de l'esborrany). Un node sense pare, o en un cercle, és una arrel. */
export function draftTree(draft: CascadeDraft): DraftTree {
  const ids = new Set(draft.nodes.map((n) => n.id))
  // Una fletxa «a dins de» per node, en l'ordre de l'esborrany; la que faria un cercle (pujant des del pare es torna al
  // fill) no compta.
  const parent = new Map<string, string>()
  for (const e of draft.edges) {
    if (e.kind !== "contains" || !ids.has(e.source) || !ids.has(e.target) || parent.has(e.target)) continue
    let cur: string | undefined = e.source
    while (cur !== undefined && cur !== e.target) cur = parent.get(cur)
    if (cur === undefined) parent.set(e.target, e.source)
  }
  const children = new Map<string, string[]>()
  const roots: string[] = []
  for (const n of draft.nodes) {
    const p = parent.get(n.id)
    if (p === undefined) roots.push(n.id)
    else children.set(p, [...(children.get(p) ?? []), n.id])
  }
  return { roots, children, parent }
}

/** Els nodes que es veuen: els que no tenen cap node plegat per sobre. */
export function visibleIds(tree: DraftTree, collapsed: ReadonlySet<string>): string[] {
  const out: string[] = []
  const walk = (id: string) => {
    out.push(id)
    if (!collapsed.has(id)) for (const c of tree.children.get(id) ?? []) walk(c)
  }
  for (const r of tree.roots) walk(r)
  return out
}

/** Quants nodes té a dins (tots els nivells). */
export function descendantCount(tree: DraftTree, id: string): number {
  let n = 0
  for (const c of tree.children.get(id) ?? []) n += 1 + descendantCount(tree, c)
  return n
}

/** Els nodes que tenen fills (per plegar-ho tot). */
export function branchIds(tree: DraftTree): string[] {
  return [...tree.children.keys()]
}

/** Els de sobre d'un node (per desplegar el camí fins a un que es cerca). */
export function ancestorIds(tree: DraftTree, id: string): string[] {
  const out: string[] = []
  for (let p = tree.parent.get(id); p !== undefined; p = tree.parent.get(p)) out.push(p)
  return out
}

export type LayoutDir = "LR" | "TB"

/**
 * On va cada node que es veu (la cantonada de dalt a l'esquerra): els fills en fila i el pare al mig dels seus fills;
 * cada nivell a la mateixa distància de l'arrel. `LR`: els nivells van cap a la dreta; `TB`: cap avall.
 */
export function layoutDraft(
  tree: DraftTree,
  collapsed: ReadonlySet<string>,
  size: (id: string) => { w: number; h: number },
  dir: LayoutDir,
  gap = { level: 56, sibling: 12, tree: 40 },
): Map<string, { x: number; y: number }> {
  const lr = dir === "LR"
  // Mida al llarg dels nivells (profunditat) i de través (amplada de la fila de germans).
  const depthSize = (id: string) => (lr ? size(id).w : size(id).h)
  const crossSize = (id: string) => (lr ? size(id).h : size(id).w)
  const kids = (id: string) => (collapsed.has(id) ? [] : (tree.children.get(id) ?? []))
  // Cada nivell comença on acaba el més gran de l'anterior.
  const levelSize: number[] = []
  const measure = (id: string, d: number) => {
    levelSize[d] = Math.max(levelSize[d] ?? 0, depthSize(id))
    for (const c of kids(id)) measure(c, d + 1)
  }
  for (const r of tree.roots) measure(r, 0)
  const levelAt: number[] = [0]
  for (let i = 1; i < levelSize.length; i++) levelAt[i] = levelAt[i - 1]! + levelSize[i - 1]! + gap.level
  const cross = new Map<string, number>()
  const out = new Map<string, { x: number; y: number }>()
  // Col·loca el node i els seus fills a partir de `start` (de través); torna on comença el següent.
  const place = (id: string, d: number, start: number): number => {
    const own = crossSize(id)
    const cs = kids(id)
    let at = start
    let end = start + own + gap.sibling
    if (cs.length) {
      let cursor = start
      for (const c of cs) cursor = place(c, d + 1, cursor)
      const first = cs[0]!, last = cs[cs.length - 1]!
      const mid = (cross.get(first)! + crossSize(first) / 2 + cross.get(last)! + crossSize(last) / 2) / 2
      at = Math.max(start, mid - own / 2)
      end = Math.max(cursor, at + own + gap.sibling)
    }
    cross.set(id, at)
    out.set(id, lr ? { x: levelAt[d]!, y: at } : { x: at, y: levelAt[d]! })
    return end
  }
  let cursor = 0
  for (const r of tree.roots) cursor = place(r, 0, cursor) + gap.tree
  return out
}
