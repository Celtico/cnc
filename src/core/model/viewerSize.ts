import { compositionHeight, compositionKind, compositionWidth, mountOf, partsOnlyKind, resolveParts, type Composition } from "./composition"
import { partBox } from "./freePart"

/**
 * Mida (mm) amb què el visor 3D centra el moble (`CabinetViewer size`): el grup va a −amplada/2 i −fons/2, així
 * que la càmera desada (`Composition.camera`) és relativa a aquest centre. També la fa servir la miniatura.
 */
export function viewerSize(comp: Composition): { width: number; height: number; depth: number } {
  // Flat-pack: només les peces lliures (els mòduls es guarden però no es fan).
  const onlyParts = partsOnlyKind(compositionKind(comp))
  let h = onlyParts ? 0 : compositionHeight(comp)
  let d = 0
  let w = onlyParts ? 0 : compositionWidth(comp)
  if (!onlyParts) for (const m of comp.modules) d = Math.max(d, (mountOf(m) === "floor" ? (m.wallGap ?? 0) : 0) + m.carcass.depth + m.carcass.thickness)
  for (const g of comp.references) {
    h = Math.max(h, g.y + g.h)
    d = Math.max(d, g.z + g.d)
    w = Math.max(w, g.x + g.w)
  }
  // Models 3D: també compten (un objecte que només és un model no ha de fer 0 × 0).
  for (const g of comp.models ?? []) {
    h = Math.max(h, g.y + g.h)
    d = Math.max(d, g.z + g.d)
    w = Math.max(w, g.x + g.w)
  }
  for (const p of resolveParts(comp)) {
    const b = partBox(p)
    w = Math.max(w, b.max[0])
    h = Math.max(h, b.max[1])
    d = Math.max(d, b.max[2])
  }
  return { width: Math.max(1, w), height: Math.max(1, h), depth: Math.max(1, d) }
}

/**
 * Document buit: res que es vegi (un moble nou sense cap mòdul, un objecte nou sense peces). Els mòduls d'un document
 * només de peces no compten (no es fan).
 */
export function isEmptyComposition(comp: Composition): boolean {
  const modules = partsOnlyKind(compositionKind(comp)) ? 0 : comp.modules.length
  return !modules && !comp.parts?.length && !comp.references.length && !comp.models?.length
}
