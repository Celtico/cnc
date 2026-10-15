import { DEFAULT_GRILLE, findZone, newId, type Front, type Zone } from "./composition"

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

/**
 * Divideix una fulla en `n` zones "auto". La primera hereta el contingut de la fulla, també l'electrodomèstic (la placa
 * sobre els calaixos d'un mòdul sense dividir passa al compartiment dels calaixos: no es perd en dividir).
 */
export function splitZone(root: Zone, id: string, dir: "v" | "h", n = 2): Zone {
  return updateZone(root, id, (z) => {
    if (z.split) return z
    const { shelves, front, rail, appliance } = z
    const children: Zone[] = Array.from({ length: n }, (_, i) => ({
      id: newId(),
      ...(i === 0 && shelves ? { shelves } : {}),
      ...(i === 0 && front ? { front } : {}),
      ...(i === 0 && rail ? { rail } : {}),
      ...(i === 0 && appliance ? { appliance } : {}),
    }))
    return { id: z.id, split: { dir, sizes: children.map(() => "auto" as const), children } }
  })
}

/** Treu la divisió d'un node: torna a ser una fulla amb el contingut del primer fill. */
export function unsplitZone(root: Zone, id: string): Zone {
  return updateZone(root, id, (z) => {
    if (!z.split) return z
    const first = z.split.children[0]!
    return { id: z.id, ...(first.shelves ? { shelves: first.shelves } : {}), ...(first.front ? { front: first.front } : {}), ...(first.rail ? { rail: first.rail } : {}), ...(first.appliance ? { appliance: first.appliance } : {}) }
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

/**
 * Elimina una zona de la seva divisió. Si només en queda una, la divisió desapareix. Si les que queden són totes de
 * mida fixa, ja no sumarien la llum (en falta la treta i el seu divisor): el veí (el de l'esquerra/sota, o el següent)
 * passa a «auto» i n'agafa l'espai.
 */
export function removeZone(root: Zone, id: string): Zone {
  const parent = parentOf(root, id)
  if (!parent || !parent.split) return root
  return updateZone(root, parent.id, (p) => {
    if (!p.split) return p
    const idx = p.split.children.findIndex((c) => c.id === id)
    if (idx < 0) return p
    const children = p.split.children.filter((_, i) => i !== idx)
    const sizes = p.split.sizes.filter((_, i) => i !== idx)
    while (sizes.length < children.length) sizes.push("auto")
    if (children.length > 1 && !sizes.includes("auto")) sizes[Math.max(0, idx - 1)] = "auto"
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

/**
 * Canvia la mida del fill `index` (no l'últim) d'una divisió des de la «Divisió» de l'editor (per decisió de l'usuari:
 * amb n zones es posen n−1 mides; l'última és el que sobra). Si l'última ja és «auto», com `setChildSize`. Si no
 * (dades d'abans: l'última fixa, potser amb una altra «auto»), primer es reescriuen les mides sense canviar la geometria
 * (`current`, les mides reals de cada fill, `splitChildSizes`): les «auto» que no són l'última passen als seus mm i
 * l'última a «auto» (agafa el que sobra, que és el que ja feia); després s'aplica el canvi. La construcció no canvia:
 * només es reescriu en editar.
 */
export function setSplitSize(root: Zone, parentId: string, index: number, size: number | "auto", current?: readonly number[]): Zone {
  return updateZone(root, parentId, (p) => {
    if (!p.split) return p
    const n = p.split.children.length
    if (index < 0 || index >= n - 1) return p
    const sizes = p.split.sizes.slice(0, n)
    while (sizes.length < n) sizes.push("auto")
    if (sizes[n - 1] !== "auto") {
      if (current && current.length === n) for (let i = 0; i < n - 1; i++) if (sizes[i] === "auto") sizes[i] = current[i]!
      sizes[n - 1] = "auto"
    }
    sizes[index] = size
    return { ...p, split: { ...p.split, sizes } }
  })
}

/**
 * L'alçada d'un front d'una pila de calaixos, com `setSplitSize` (per decisió de l'usuari, 2026-10-13: «semblant a com
 * es fica la mida a les divisions»): s'editen les n−1 primeres i l'última és el que sobra («auto»). Dades d'abans amb
 * l'última fixa: primer les «auto» passen als mm que feien (`current`, les reals de la construcció) i l'última a «auto».
 */
export function setDrawerHeight<F extends { n: number; heights: (number | "auto")[] }>(front: F, index: number, size: number | "auto", current?: readonly number[]): F {
  const n = front.n
  if (index < 0 || index >= n - 1) return front
  const heights = front.heights.slice(0, n)
  while (heights.length < n) heights.push("auto")
  if (heights[n - 1] !== "auto") {
    if (current && current.length === n) for (let i = 0; i < n - 1; i++) if (heights[i] === "auto") heights[i] = current[i]!
    heights[n - 1] = "auto"
  }
  heights[index] = size
  return { ...front, heights }
}

export function setShelves(root: Zone, id: string, shelves: Zone["shelves"] | null): Zone {
  return updateZone(root, id, (z) => {
    const { shelves: _old, ...rest } = z
    void _old
    return shelves ? { ...rest, shelves } : rest
  })
}

/** El front en blanc de cada tipus (el que posa «Contingut» quan el compartiment no n'ha tingut mai cap d'aquell tipus). */
export function defaultFront(kind: Front["kind"]): Front {
  switch (kind) {
    case "door":
      return { kind, mode: "single", hinge: "left" }
    case "drawers":
      return { kind, n: 3, heights: ["auto", "auto", "auto"] }
    case "flap":
      return { kind, dir: "down" }
    case "grille":
      return { kind, pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left" }
    case "panel":
      return { kind }
  }
}

/**
 * Posa (o treu, `null`) el front d'un compartiment. **Res amagat compta**: si el tipus canvia, el front d'abans es recorda a
 * `fronts[kind]` (tornar-hi el recupera sencer: calaixos, alçades, joc i opcions, ferratge, tirador); els prestatges, la
 * barra i la llum no es toquen (amb calaixos no es veuen ni compten, `visibleZone`, i tornen amb el contingut d'abans).
 */
export function setFront(root: Zone, id: string, front: Front | null): Zone {
  return updateZone(root, id, (z) => {
    const { front: old, fronts: _f, ...rest } = z
    const fronts = { ...z.fronts }
    if (old && old.kind !== front?.kind) fronts[old.kind] = old
    if (front) delete fronts[front.kind]
    const kept = Object.keys(fronts).length ? { fronts } : {}
    return front ? { ...rest, ...kept, front } : { ...rest, ...kept }
  })
}

/**
 * Canvia el **tipus** de contingut («Contingut» de l'inspector): el front recordat d'aquell tipus (`fronts[kind]`) o, si
 * no n'hi ha, el front en blanc (`defaultFront`), amb el tirador propi del front d'abans si el nou tipus també en pot
 * portar (porta, calaixos i abatible). `"none"` = obert. `blank`: el front en blanc (a l'Editor, amb els per defecte de
 * l'usuari, `frontWithDefaults`).
 */
export function switchFront(root: Zone, id: string, kind: Front["kind"] | "none", blank: (kind: Front["kind"]) => Front = defaultFront): Zone {
  if (kind === "none") return setFront(root, id, null)
  const z = findZone(root, id)
  if (!z) return root
  if (z.front?.kind === kind) return root
  const remembered = z.fronts?.[kind]
  const next: Front = remembered ? structuredClone(remembered) : blank(kind)
  const oldHandle = z.front && "handle" in z.front ? z.front.handle : undefined
  if (!remembered && oldHandle && (next.kind === "door" || next.kind === "drawers" || next.kind === "flap")) next.handle = structuredClone(oldHandle)
  return setFront(root, id, next)
}

/** Nombre de fulles de l'arbre. */
export function countLeaves(root: Zone): number {
  if (!root.split) return 1
  return root.split.children.reduce((s, c) => s + countLeaves(c), 0)
}
