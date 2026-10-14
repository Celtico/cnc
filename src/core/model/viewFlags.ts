import { z } from "zod"

/**
 * L'ull i el cadenat de l'arbre (per decisió de l'usuari, 2026-10-14; com Figma): `hidden` = no es dibuixa a l'editor (al 3D
 * ni al plànol), però es fabrica i surt a les peces, al nesting i als fitxers; `locked` = no es mou (ni el gizmo, ni la
 * nansa, ni les fletxes, ni arrossegar al plànol). Mòduls, peces lliures, objectes de referència, models 3D i elements i
 * parets dels ambients. Els d'un grup es canvien tots alhora des del grup.
 */
export const VIEW_FLAGS = {
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
}

export interface ViewFlags {
  hidden?: boolean
  locked?: boolean
}

/** Posa o treu una marca (`hidden` o `locked`): fora el camp quan és fals, perquè els documents d'abans no canviïn. */
export function withFlag<T extends ViewFlags>(x: T, flag: keyof ViewFlags, on: boolean): T {
  const { [flag]: _old, ...rest } = x
  void _old
  return (on ? { ...rest, [flag]: true } : rest) as T
}

/**
 * El cadenat: als elements que ja estaven bloquejats (`prev`), els camps de posició (`keys`) es queden com eren, vingui el
 * canvi d'on vingui (arrossegar al plànol, el gizmo, les fletxes, girar).
 */
export function keepLocked<T extends { id: string } & ViewFlags>(prev: readonly T[], next: T[], keys: readonly (keyof T)[]): T[] {
  const locked = new Map(prev.filter((x) => x.locked).map((x) => [x.id, x]))
  if (!locked.size) return next
  return next.map((x) => {
    const old = locked.get(x.id)
    if (!old) return x
    if (keys.every((k) => x[k] === old[k])) return x
    const out = { ...x }
    for (const k of keys) {
      if (old[k] === undefined) delete out[k]
      else out[k] = old[k]
    }
    return out
  })
}

/**
 * L'ull: un editor que només veu els que no estan amagats (`shown`) torna la llista nova; s'hi tornen a posar els amagats al
 * seu lloc (l'ordre de `all`), els nous al final i els que s'han tret, fora.
 */
export function mergeHidden<T extends { id: string } & ViewFlags>(all: readonly T[], shown: readonly T[], next: readonly T[]): T[] {
  const byId = new Map(next.map((x) => [x.id, x]))
  const seen = new Set(shown.map((x) => x.id))
  const out: T[] = []
  for (const x of all) {
    if (x.hidden && !seen.has(x.id)) out.push(x)
    else if (byId.has(x.id)) out.push(byId.get(x.id)!)
  }
  const known = new Set(all.map((x) => x.id))
  for (const x of next) if (!known.has(x.id)) out.push(x)
  return out
}
