import { moduleFrontFace, newId, type Composition, type Module, type Zone } from "./composition"

/**
 * **Moble de cantonada en L** (per petició de l'usuari, 2026-10-20: «i si el moble fa cantonada?», l'armari en L de les
 * fotos amb dues portes a 90°). Es fa amb dos mòduls de sempre (cap peça nova): el mòdul triat (el braç de la fila) sense
 * el lateral del costat de la cantonada, i al seu costat un mòdul **girat** (fronts a 90°, `rot`) que és l'altre braç,
 * amb un lateral a la paret. L'interior del girat es divideix: el compartiment del costat de la paret queda obert (és el
 * racó, s'hi entra per la porta del braç de la fila) i l'altre porta una porta amb les frontisses a l'extrem. El divisor
 * es col·loca perquè la porta del girat comenci a la cara de les portes del braç de la fila (les dues es toquen al racó).
 *
 * `side`: a quin extrem del mòdul triat va la cantonada. Torna la composició i l'id del mòdul nou.
 */
export function addCorner(comp: Composition, moduleId: string, side: "left" | "right", armWidth?: number): { comp: Composition; id: string } | null {
  const i = comp.modules.findIndex((m) => m.id === moduleId)
  const a = comp.modules[i]
  if (!a) return null
  const t = a.carcass.thickness
  const face = moduleFrontFace(a)
  // El llum del racó: el divisor acaba on comença la porta (la meitat del divisor la tapa la porta recobrent).
  const corner = Math.max(50, Math.round(face - 1.5 * t))
  const width = Math.round(armWidth ?? face + 600)
  const door = Math.max(100, width - 3 * t - corner)
  const open: Zone = { id: newId() }
  const doorZone: Zone = { id: newId(), front: { kind: "door", mode: "single", hinge: side === "right" ? "right" : "left" } }
  // Girat 270 (fronts a l'esquerra) a la dreta de la fila: el seu lateral esquerre és a la paret; girat 90, el dret.
  const root: Zone =
    side === "right"
      ? { id: newId(), split: { dir: "v", sizes: [corner, "auto"], children: [open, doorZone] } }
      : { id: newId(), split: { dir: "v", sizes: [door, "auto"], children: [doorZone, open] } }
  const { x: _x, wallGap: _w, turned: _t, rot: _r, group: _g, ...rest } = structuredClone(a)
  const arm: Module = {
    ...rest,
    id: newId("m"),
    name: `${a.name} · cantonada`,
    gapBefore: 0,
    rot: side === "right" ? 270 : 90,
    carcass: (({ corner: _c, ...c }) => ({ ...c, width, sides: { left: true, right: true } }))(rest.carcass),
    root,
  }
  const modules = [...comp.modules]
  modules[i] = { ...a, carcass: { ...a.carcass, sides: { ...a.carcass.sides, [side]: false }, corner: side } }
  if (side === "right") modules.splice(i + 1, 0, arm)
  else {
    // A l'esquerra el girat va primer i el mòdul triat continua la fila on era.
    modules.splice(i, 0, { ...arm, gapBefore: a.gapBefore })
    modules[i + 1] = { ...modules[i + 1]!, gapBefore: 0 }
  }
  return { comp: { ...comp, modules }, id: arm.id }
}
