import { freeX, moduleFootprint, moduleFrontFace, modulePlacements, moduleRot, rowOf, sideWallOf, type Composition, type Module, type ModuleMount } from "./composition"
import { setModuleMount } from "./editOps"

/**
 * **A quina paret va** (per decisió de l'usuari, 2026-10-22: «quan li dic a un mòdul paret no sap a quina paret ha d'anar,
 * i els penjats tampoc»): en posar un mòdul arrambat o penjat, va a una paret sense saltar
 * enlloc: la del seu darrere (segons els fronts). A la del fons, entra a la fila on és (de costat); a la d'un costat, és el primer (esquerra) o l'últim (dreta) de
 * la fila, d'esquena a aquella paret (`wallSides`), a la mateixa distància del fons (`sideAlong`). Els veïns de la fila no
 * es mouen. Lliure al terra: surt de la fila i es queda on és (`setModuleMount`, X `here`).
 */
export function mountModule(comp: Composition, id: string, mount: ModuleMount, here: number, floorHeight = 1450): Composition {
  const i = comp.modules.findIndex((m) => m.id === id)
  if (i < 0) return comp
  const m = comp.modules[i]!
  const put = (mod: Module) => ({ ...comp, modules: comp.modules.map((x, k) => (k === i ? mod : x)) })
  if (mount === "floor") return put(setModuleMount(m, "floor", here, floorHeight))
  const places = modulePlacements(comp)
  const foot = (x: Module, p: (typeof places)[number]) => moduleFootprint(x, p, moduleFrontFace(x))
  const fp = foot(m, places[i]!)
  const { rot: _r, turned: _t, sideAlong: _s, ...clean } = setModuleMount(m, mount, here, floorHeight)
  const all = comp.modules.map((x, k) => foot(x, places[k]!))
  // Sense ell, el següent de la seva fila es queda on era (guanya la seva separació i el seu lloc).
  const rest = comp.modules.map((x) => ({ ...x }))
  if (!freeX(m) && !sideWallOf(m)) {
    const mates = comp.modules.map((x, k) => (k !== i && rowOf(x) === rowOf(m) && !freeX(x) && !sideWallOf(x) ? k : -1)).filter((k) => k >= 0)
    const after = mates.find((k) => k > i)
    const prev = mates.filter((k) => k < i).at(-1)
    if (after !== undefined) rest[after]!.gapBefore = Math.max(0, Math.round(all[after]!.x0 - (prev !== undefined ? all[prev]!.x1 : 0)))
  }
  rest.splice(i, 1)
  if (!rest.length) return put({ ...clean, gapBefore: 0 })
  const xmin = Math.min(...all.map((b) => b.x0)), xmax = Math.max(...all.map((b) => b.x1))
  // La paret del seu darrere, segons cap on miren els fronts (cel, 2026-10-22: «li dic el front i després a la paret»):
  // a la dreta, d'esquena a l'esquerra; a l'esquerra, a la dreta; endavant, al fons. Enrere (lliure, d'illa): la més a prop
  // (la del fons guanya si n'hi ha dues igual).
  const rot = moduleRot(m)
  const dist = { back: Math.max(0, fp.z0), left: fp.x0 - xmin, right: xmax - fp.x1 }
  const side = rot === 90 ? "left" : rot === 270 ? "right" : rot === 0 ? "back" : dist.back <= Math.min(dist.left, dist.right) ? "back" : dist.left <= dist.right ? "left" : "right"
  const row = rowOf(clean)
  const restPlaces = modulePlacements({ ...comp, modules: rest })
  const fpRest = (k: number) => foot(rest[k]!, restPlaces[k]!)
  const rowIdx = rest.map((x, k) => (rowOf(x) === row && !freeX(x) && !sideWallOf(x) ? k : -1)).filter((k) => k >= 0)
  const mods = rest.map((x) => ({ ...x }))
  const along = Math.round(Math.max(0, fp.z0))
  let mod: Module
  let at: number
  if (side === "left" || side === "right") {
    // A la paret del costat (`sideWallOf`): fora de la fila del fons, a la mateixa distància del fons.
    mod = { ...clean, rot: side === "left" ? 90 : 270, gapBefore: 0, sideAlong: along }
    at = i <= mods.length ? i : mods.length
  } else {
    // Al fons, de cara endavant, amb el mateix centre de costat: entra a la fila davant del primer que és més a la dreta.
    const w = clean.carcass.width
    const x0 = Math.max(0, Math.round((fp.x0 + fp.x1) / 2 - w / 2))
    const next = rowIdx.find((k) => fpRest(k).x0 >= x0)
    const before = rowIdx.filter((k) => next === undefined || k < next)
    const end = before.length ? Math.max(...before.map((k) => fpRest(k).x1)) : 0
    mod = { ...clean, gapBefore: Math.max(0, x0 - Math.round(end)) }
    if (next !== undefined) mods[next]!.gapBefore = Math.max(0, Math.round(fpRest(next).x0 - (Math.max(end, x0) + w)))
    at = next ?? (before.length ? before.at(-1)! + 1 : mods.length)
  }
  mods.splice(at, 0, mod)
  return { ...comp, modules: mods }
}
