import { pairPlate, setConfirmed } from "../model/hardwareEdit"
import { defaultModule, isPendingImport, slotForEngine, type HardwareItem, type Module, type Vec3 } from "../model"
import { buildModule } from "./buildModule"
import { r, toWorld } from "./geometry"
import { HardwareError } from "./hardware"
import { holeEntry, mountHoles, worldDir } from "./mount/box"
import { unit3 } from "./mount/camera"
import { hostHinge, isLeftSide, itemTags, mountRegion, recipe } from "./mount/recipe"
import type { HardwareMount } from "./mount/types"

// Les peces (caixes, receptes, càmera, pla) són a `./mount/`: aquí, l'API de sempre.
export type { HardwareMount } from "./mount/types"
export { modelCamera, MOUNT_CAMERA_DIST, MOUNT_FOV, mountCamera } from "./mount/camera"
export { mountPlan, type MountPlan, type PlanDim, type PlanRect } from "./mount/plan"

/**
 * Un ferratge **muntat** (Preferències › Ferratges, «3D · Pla»): un mòdul petit fet pel **camí de fabricació de sempre**
 * (`buildModule`, amb l'item al seu lloc del joc de ferratges) del qual es queden les peces on el ferratge fa forats (la
 * porta i el lateral de les frontisses, el lateral i la caixa d'una guia…). El que es veu és el que rep el taller.
 *
 * Un importat **sense confirmar** no faria cap forat (`addCups`): es construeix amb una còpia confirmada i els forats que
 * són seus surten com a **proposats** (`proposedTags`), per pintar-los d'un altre color.
 *
 * Pur (sense React ni three): el 3D (`PanelMesh`) i el pla (`mountPlan`) en surten.
 */

export function hardwareMount(item: HardwareItem, base: Module = defaultModule("mount", "Muntatge")): HardwareMount {
  const rc = recipe(item)
  const pending = isPendingImport(item)
  const tags = itemTags(item)
  if (!rc) {
    // Només 3D: el model tal qual (cap peça, cap forat).
    const imp = item.imported
    const b = imp?.bbox
    const size = b ? { width: r(b.max[0] - b.min[0]), height: r(b.max[1] - b.min[1]), depth: r(b.max[2] - b.min[2]) } : { width: 0, height: 0, depth: 0 }
    // La caixa del model (un STEP pla té una mida 0: com a mínim 1 mm perquè la càmera tingui alguna cosa a enquadrar).
    const region = b ? { min: b.min.map((v, k) => (b.max[k]! - v < 1 ? v - 0.5 : v)) as Vec3, max: b.max.map((v, k) => (v - b.min[k]! < 1 ? v + 0.5 : v)) as Vec3 } : { min: [-50, -50, -50] as Vec3, max: [50, 50, 50] as Vec3 }
    return { panels: [], pending, proposedTags: [], tags, focus: null, size, warnings: [], model: { ...(imp?.asset ? { asset: imp.asset } : {}), ...(b ? { bbox: b } : {}) }, region, solid: [] }
  }
  const empty = { panels: [], pending, proposedTags: [], tags, focus: null, size: rc.size, warnings: [], region: { min: [0, 0, 0] as Vec3, max: [rc.size.width, rc.size.height, rc.size.depth] as Vec3 }, solid: [] }
  // El que es construeix: l'item confirmat (si no, no faria cap forat), al seu lloc del joc del mòdul.
  const made = pending ? setConfirmed(item, true) : item
  const hardware = { ...base.hardware }
  // Un joc de calaix es tria al front dels calaixos (no té lloc al joc del mòdul).
  const front = rc.front?.kind === "drawers" && made.engine === "drawerKit" ? { ...rc.front, hardware: made } : rc.front
  if (made.engine === "plate") hardware.hinge = setConfirmed(pairPlate(hostHinge(base), made), true)
  else if (made.engine !== "leg" && made.engine !== "drawerKit" && made.engine !== "model") hardware[slotForEngine(made.engine).slot] = made
  const legBase = rc.base?.kind === "legs" ? { ...rc.base, hardware: made } : rc.base
  const module: Module = {
    ...base,
    carcass: { ...base.carcass, ...rc.size, sides: { left: true, right: true }, base: legBase ?? { kind: "none" }, top: { kind: "full" }, hollow: undefined, tableTop: undefined, joint: "butt" },
    root: { id: "mount-root", ...(rc.shelves ? { shelves: rc.shelves } : {}), ...(front ? { front } : {}), ...(rc.rail ? { rail: {} } : {}), ...(rc.led ? { led: {} } : {}) },
    fronts: { ...base.fronts, style: "overlay", handles: "bar" },
    hardware,
    extras: { cableHoles: [] },
  }
  let build: ReturnType<typeof buildModule>
  try {
    // Amb el recorregut dels cables (un joc de llum es veu com al moble: el cable per dins del tauler, no cap amunt).
    build = buildModule(module)
  } catch (err) {
    return { ...empty, error: err instanceof HardwareError ? err.message : String(err) }
  }
  const own = (h: { tag?: string }) => !!h.tag && tags.includes(h.tag)
  // El forat principal d'un joc de calaix: una prebroca de la guia al lateral (no les del front ni del darrere).
  const focusTag = (h: { tag?: string }) => (item.engine === "drawerKit" ? h.tag === "kit-slide" : own(h))
  const panels = build.panels.filter((p) => {
    if (rc.drop?.(p)) return false
    if (rc.keep(p)) return true
    // Les peces amb forats del ferratge a la meitat esquerra (la dreta és el mirall).
    return mountHoles(p).some((h) => own(h) && toWorld(p, holeEntry(p, h).at)[0] <= rc.size.width / 2 + 0.5)
  })
  // Les peces apartades (la reixeta de l'imant): el mateix contingut, un altre origen.
  if (rc.shift)
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i]!
      const sh = rc.shift(p)
      if (sh) panels[i] = { ...p, placement: { ...p.placement, origin: [p.placement.origin[0] + sh[0], p.placement.origin[1] + sh[1], p.placement.origin[2] + sh[2]] } }
    }
  // Les espigues de la caixa només es veuen quan el ferratge és l'espiga: a la resta (sense base ni tapa al muntatge)
  // sortien soltes i distreien del que es mira. És un dibuix: el moble es fabrica igual.
  if (item.engine !== "dowel")
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i]!
      if (p.holes.some((h) => h.tag === "dowel")) panels[i] = { ...p, holes: p.holes.filter((h) => h.tag !== "dowel") }
    }
  // Els components d'un joc de calaix (peces de només veure, `extras`): es veuen muntats amb la fusta. Els accessoris també.
  const solid: string[] = []
  for (const p of [...(item.engine === "drawerKit" ? build.extras.filter((p) => p.role === "hardware") : []), ...(rc.extras ? build.extras.filter(rc.extras) : [])]) {
    // Opacs tal com són (el vidre del marc d'una vitrina ja és transparent pel seu material).
    panels.push(p)
    solid.push(p.id)
  }
  // El forat principal: la primera cassoleta (la de baix) o, si no, el forat del ferratge més a prop del mig de la seva peça.
  let focus: HardwareMount["focus"] = null
  let best = Infinity
  for (const p of panels) {
    for (const h of mountHoles(p)) {
      // Una placa es mira des de la cassoleta de la seva frontissa (la placa va a la seva alçada).
      if (!focusTag(h) && !(item.engine === "plate" && h.tag === "hinge")) continue
      const e = holeEntry(p, h)
      const at = toWorld(p, e.at)
      if (at[0] > rc.size.width / 2 + 0.5) continue
      // Una pota es mira de davant: la del davant (el forat més endavant), no la del darrere (la càmera quedaria dins la base).
      // Un joc de llum es mira per la làmpada (no pel forat del cable).
      const score = (item.light && h.tag !== "light" ? 1e6 : 0) + (item.engine === "cup" || item.engine === "plate" ? (h.tag === "hinge" ? at[1] : Infinity) : item.engine === "leg" ? -at[2] : Math.abs(at[1] - rc.size.height / 2) + (p.role === "side" ? 0 : 0.1))
      if (score < best) {
        best = score
        // Un tirador es mira des de fora del front (on va el tirador), no des de la cara A; una pota, de davant i just
        // per sota de la base (es veu dreta sobre el terra amb la placa a sota de la base), no des de sota.
        // Un joc de calaix, des de dins del moble i una mica del darrere (el front tapa la guia si es mira de davant).
        // Un imant, des de dins (la reixeta tapa l'imant del cantell del lateral i la seva placa és a la cara de dins).
        // Una guia, des de dins i del darrere (cap al davant, la càmera sortiria pel front del calaix).
        const view: Vec3 | undefined = item.engine === "barHandle" ? [0, 0, 1] : item.engine === "leg" ? [0, -0.5, Math.sqrt(0.75)] : item.engine === "drawerKit" ? unit3([1, 0.6, -0.35]) : item.engine === "slide" ? unit3([1, 0.55, -0.45]) : item.engine === "magnet" ? [0, 0, -1] : undefined
        const exact = item.engine === "drawerKit" || item.engine === "slide"
        focus = { panelId: p.id, hole: h, at, normal: worldDir(p, e.normal), ...(view ? { view } : {}), ...(exact ? { exact: true } : {}) }
      }
    }
  }
  const door = panels.find((p) => p.role === "door")
  const side = panels.find(isLeftSide)
  // Un accessori no fa cap forat: el pla es talla al mig del primer que es veu (la barra; el perfil de sota el sostre;
  // el perfil de dalt del marc).
  let aim: HardwareMount["aim"]
  // Un tirador sense forats (el de marc de vitrina): es mira pel mig del front.
  if (!focus && item.engine === "barHandle") {
    const fr = panels.find((p) => p.role === "drawerFront")
    if (fr) aim = { at: toWorld(fr, [fr.length / 2, fr.width / 2, fr.thickness]), view: [0, 0, 1] }
  }
  if (!focus && !aim && rc.extras) {
    const first = panels.find(rc.extras)
    // La barra i el perfil LED van sota la tapa: de davant i una mica de sota (des de dalt, la tapa els tapa).
    const view: Vec3 | undefined = item.engine === "rail" || item.engine === "ledProfile" ? unit3([0.45, -0.35, 1]) : undefined
    if (first) aim = { at: toWorld(first, [first.length / 2, first.width / 2, first.thickness / 2]), ...(view ? { view } : {}) }
  }
  // Els avisos del ferratge (el mòdul d'exemple de les potes ja té l'alçada de la pota: no avisa de l'alçada).
  const relevant = new Set(["hinge", "hardware", "handle"])
  return {
    panels,
    pending,
    proposedTags: pending ? tags : [],
    tags,
    focus,
    ...(aim ? { aim } : {}),
    ...((item.engine === "cup" || item.engine === "plate") && door && side ? { hinge: { doorId: door.id, sideId: side.id } } : {}),
    size: rc.size,
    warnings: build.warnings.filter((w) => relevant.has(w.code)).map((w) => w.message),
    region: mountRegion(item.engine, panels, tags, focus?.at ?? aim?.at ?? null, rc),
    solid,
  }
}
