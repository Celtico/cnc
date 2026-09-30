import { newId, type Front, type Zone } from "./composition"

/** Operacions immutables sobre l'arbre de zones. Cap no modifica l'arbre d'entrada. */

export function updateZone(root: Zone, id: string, fn: (z: Zone) => Zone): Zone {
  if (root.id === id) return fn(root)
  if (!root.split) return root
  let changed = false
  const children = root.split.children.map((c) => {
    const n = updateZone(c, id, fn)
    if (n !== c) changed = true
    return n
  })
  return changed ? { ...root, split: { ...root.split, children } } : root
}

export function parentOf(root: Zone, id: string): Zone | undefined {
  if (!root.split) return undefined
  for (const c of root.split.children) {
    if (c.id === id) return root
    const p = parentOf(c, id)
    if (p) return p
  }
  return undefined
}

/** Divideix una fulla en `n` zones "auto". La primera hereta el contingut de la fulla. */
export function splitZone(root: Zone, id: string, dir: "v" | "h", n = 2): Zone {
  return updateZone(root, id, (z) => {
    if (z.split) return z
    const { shelves, front, rail } = z
    const children: Zone[] = Array.from({ length: n }, (_, i) => ({
      id: newId(),
      ...(i === 0 && shelves ? { shelves } : {}),
      ...(i === 0 && front ? { front } : {}),
      ...(i === 0 && rail ? { rail } : {}),
    }))
    return { id: z.id, split: { dir, sizes: children.map(() => "auto" as const), children } }
  })
}

/** Treu la divisió d'un node: torna a ser una fulla amb el contingut del primer fill. */
export function unsplitZone(root: Zone, id: string): Zone {
  return updateZone(root, id, (z) => {
    if (!z.split) return z
    const first = z.split.children[0]!
    return { id: z.id, ...(first.shelves ? { shelves: first.shelves } : {}), ...(first.front ? { front: first.front } : {}), ...(first.rail ? { rail: first.rail } : {}) }
  })
}

/** Còpia d'una zona (i els seus fills) amb ids nous. */
export function cloneZone(z: Zone): Zone {
  const { id: _old, split, ...rest } = z
  void _old
  return split
    ? { ...rest, id: newId(), split: { ...split, sizes: [...split.sizes], children: split.children.map(cloneZone) } }
    : { ...structuredClone(rest), id: newId() }
}

/**
 * Duplica una zona al costat (`v`, a la dreta) o a sobre (`h`). Si la zona ja és dins
 * d'una divisió en aquella direcció, la còpia s'hi insereix just després, amb mida auto;
 * si no, la zona es divideix en dues i totes dues porten el mateix contingut.
 * Retorna l'arbre nou i l'id de la còpia.
 */
export function duplicateZone(root: Zone, id: string, dir: "v" | "h"): { root: Zone; copyId: string | null } {
  const parent = parentOf(root, id)
  if (parent?.split && parent.split.dir === dir) {
    const idx = parent.split.children.findIndex((c) => c.id === id)
    const copy = cloneZone(parent.split.children[idx]!)
    const next = updateZone(root, parent.id, (p) => {
      if (!p.split) return p
      const children = [...p.split.children]
      const sizes = [...p.split.sizes]
      children.splice(idx + 1, 0, copy)
      sizes.splice(idx + 1, 0, "auto")
      return { ...p, split: { ...p.split, children, sizes } }
    })
    return { root: next, copyId: copy.id }
  }
  let copyId: string | null = null
  const next = updateZone(root, id, (z) => {
    const a = cloneZone(z)
    const b = cloneZone(z)
    copyId = b.id
    return { id: z.id, split: { dir, sizes: ["auto", "auto"], children: [a, b] } }
  })
  return { root: next, copyId }
}

/** Afegeix una zona "auto" al final d'una divisió. */
export function addChild(root: Zone, id: string): Zone {
  return updateZone(root, id, (z) => {
    if (!z.split) return z
    return { ...z, split: { ...z.split, sizes: [...z.split.sizes, "auto"], children: [...z.split.children, { id: newId() }] } }
  })
}

/** Elimina una zona de la seva divisió. Si només en queda una, la divisió desapareix. */
export function removeZone(root: Zone, id: string): Zone {
  const parent = parentOf(root, id)
  if (!parent || !parent.split) return root
  return updateZone(root, parent.id, (p) => {
    if (!p.split) return p
    const idx = p.split.children.findIndex((c) => c.id === id)
    if (idx < 0) return p
    const children = p.split.children.filter((_, i) => i !== idx)
    const sizes = p.split.sizes.filter((_, i) => i !== idx)
    if (children.length === 1) {
      const only = children[0]!
      return { ...only, id: p.id }
    }
    return { ...p, split: { ...p.split, children, sizes } }
  })
}

export function setChildSize(root: Zone, parentId: string, index: number, size: number | "auto"): Zone {
  return updateZone(root, parentId, (p) => {
    if (!p.split) return p
    const sizes = [...p.split.sizes]
    while (sizes.length < p.split.children.length) sizes.push("auto")
    sizes[index] = size
    return { ...p, split: { ...p.split, sizes } }
  })
}

export function setShelves(root: Zone, id: string, shelves: Zone["shelves"] | null): Zone {
  return updateZone(root, id, (z) => {
    const { shelves: _old, ...rest } = z
    void _old
    return shelves ? { ...rest, shelves } : rest
  })
}

export function setFront(root: Zone, id: string, front: Front | null): Zone {
  return updateZone(root, id, (z) => {
    const { front: _old, ...rest } = z
    void _old
    // Els calaixos ocupen tot el compartiment: sense prestatges.
    if (front?.kind === "drawers") {
      const { shelves: _s, ...noShelves } = rest
      void _s
      return { ...noShelves, front }
    }
    return front ? { ...rest, front } : rest
  })
}

/** Nombre de fulles de l'arbre. */
export function countLeaves(root: Zone): number {
  if (!root.split) return 1
  return root.split.children.reduce((s, c) => s + countLeaves(c), 0)
}
