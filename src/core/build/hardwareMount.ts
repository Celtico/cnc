import { pairPlate, setConfirmed } from "../import/importItem"
import { DEFAULT_GRILLE, DEFAULT_MODULE_HARDWARE, defaultModule, isPendingImport, slotForEngine, type Front, type HardwareItem, type Hole, type Module, type Panel, type PanelFitting, type Vec3 } from "../model"
import { buildModule } from "./buildModule"
import { kitHeight } from "./drawerKit"
import { r, toWorld } from "./geometry"
import { HardwareError } from "./hardware"

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

export interface HardwareMount {
  /** Peces que es dibuixen (coordenades del mòdul, mm: X amplada, Y amunt, Z cap al davant). */
  panels: Panel[]
  /** Importat sense confirmar: els forats amb aquestes etiquetes encara no es fan (proposta). */
  pending: boolean
  proposedTags: string[]
  /** Etiquetes dels forats del ferratge (els altres, com la filera System 32, són del moble). */
  tags: string[]
  /** Forat principal (el centre de l'entrada, mm del mòdul) i la normal de la cara on entra (cap a fora de la peça). */
  focus: { panelId: string; hole: Hole; at: Vec3; normal: Vec3; /** D'on es mira al 3D, si no és la normal (un tirador: des de fora del front). */ view?: Vec3; /** `view` tal qual, sense apartar-se de costat (un joc de calaix: des de dins i del darrere). */ exact?: boolean } | null
  /** Frontissa (o placa): la porta i el lateral, i a quin costat (sempre l'esquerre). */
  hinge?: { doorId: string; sideId: string }
  /** Mides del mòdul d'exemple (mm). */
  size: { width: number; height: number; depth: number }
  /** Avisos del motor que toquen aquest ferratge (p. ex. una placa amb un forat fora del lateral). */
  warnings: string[]
  error?: string
  /**
   * On mira la càmera de «Com va muntat» si no és el forat principal (`mountCamera`): una pota, el mig de la pota des de
   * prou lluny per veure-la sencera, de terra a la base (`dist`, mm).
   */
  aim?: { at: Vec3; dist: number }
  /** Ferratge «només 3D» (motor `model`): cap peça ni forat, només el model (o la seva caixa) per veure'l. */
  model?: { asset?: string; bbox?: { min: Vec3; max: Vec3 } }
}

/** Etiquetes dels mecanitzats d'un item (els de la placa aparellada, «plate»). */
function itemTags(item: HardwareItem): string[] {
  const tags = new Set<string>()
  for (const t of item.targets) for (const op of t.ops) if (op.tag) tags.add(op.tag)
  if (item.engine === "cup" && item.targets.some((t) => t.key === "side")) tags.add("plate")
  if (item.engine === "plate") tags.add("plate")
  return [...tags]
}

/** Frontissa de base per veure una placa: la del mòdul si no és un importat pendent; si no, la d'inici de l'app. */
function hostHinge(base: Module): HardwareItem {
  const h = base.hardware.hinge
  return h.engine === "cup" && !isPendingImport(h) ? h : DEFAULT_MODULE_HARDWARE.hinge
}

interface Recipe {
  size: { width: number; height: number; depth: number }
  /** Base del mòdul (per defecte, cap: el muntatge només mira les peces del ferratge). */
  base?: Module["carcass"]["base"]
  front?: Front
  shelves?: { n: number; adjustable: boolean }
  /** Accessoris del compartiment (barra, llum): hi són amb l'item. */
  rail?: boolean
  led?: boolean
  /** Peces que sempre hi són (a més de les que porten forats del ferratge). */
  keep: (p: Panel) => boolean
  /** Elements sense nesting (`extras`) que es veuen muntats (la barra, els perfils, el marc i el vidre). */
  extras?: (p: Panel) => boolean
}

const isLeftSide = (p: Panel) => p.id === "side-left"

function recipe(item: HardwareItem): Recipe | null {
  const small = { width: 400, height: 450, depth: 320 }
  switch (item.engine) {
    case "cup":
    case "plate":
      return { size: small, front: { kind: "door", mode: "single", hinge: "left" }, keep: (p) => p.role === "door" || isLeftSide(p) }
    case "system32":
      return { size: small, shelves: { n: 1, adjustable: true }, keep: (p) => isLeftSide(p) || p.role === "shelf" }
    case "dowel":
      return { size: small, keep: isLeftSide }
    case "slide":
      return { size: { width: 450, height: 300, depth: 450 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => isLeftSide(p) || p.role === "drawerFront" }
    case "flapArm":
      return { size: small, front: { kind: "flap", dir: "down" }, keep: (p) => isLeftSide(p) || p.role === "flap" }
    case "magnet":
      return { size: small, front: { kind: "grille", pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left" }, keep: (p) => isLeftSide(p) || p.role === "grille" }
    case "barHandle":
      return { size: { width: 450, height: 300, depth: 450 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => p.role === "drawerFront" || isLeftSide(p) }
    case "leg":
      // Mòdul baix sobre potes: la base (amb els forats de les quatre potes) i el lateral esquerre.
      return { size: { width: 500, height: 300, depth: 450 }, base: { kind: "legs", height: Math.max(20, item.imported?.bbox?.max[2] ?? 100), hardware: item }, keep: (p) => p.role === "bottom" || isLeftSide(p) }
    case "model":
      return null
    case "drawerKit":
      // Calaix amb joc: el lateral esquerre (prebroques de la guia), el front, el fons i el darrere de fusta i els components.
      // Prou alt perquè hi càpiga el joc (la F fa 248).
      return { size: { width: 450, height: Math.max(300, (item.kit ? kitHeight(item.kit) : 0) + 140), depth: 500 }, front: { kind: "drawers", n: 1, heights: ["auto"] }, keep: (p) => isLeftSide(p) || p.role === "drawerFront" || p.role === "drawerBottom" || p.role === "drawerBack" }
    case "rail":
      // Compartiment de penjar: els dos laterals, la tapa i la barra.
      return { size: { width: 600, height: 1000, depth: 500 }, rail: true, keep: (p) => p.role === "side" || p.role === "top", extras: (p) => p.id.startsWith("rail-") }
    case "ledProfile":
      // Prestatge amb la llum a sota: lateral esquerre, tapa, prestatge i els perfils.
      return { size: { width: 600, height: 600, depth: 350 }, shelves: { n: 1, adjustable: false }, led: true, keep: (p) => isLeftSide(p) || p.role === "shelf" || p.role === "top", extras: (p) => p.id.startsWith("led-") }
    case "glassFrame":
      // Porta de vidre: el lateral esquerre i el marc amb el vidre.
      return { size: small, front: { kind: "door", mode: "single", hinge: "left", glass: true }, keep: isLeftSide, extras: (p) => /-(left|right|top|bottom|glass)$/.test(p.id) }
  }
}

/** Centre de l'entrada d'un forat (coordenades locals) i la normal de la cara on entra (locals). */
export function holeEntry(p: Panel, h: Pick<Hole, "x" | "y" | "face" | "edge">): { at: Vec3; normal: Vec3 } {
  const T = p.thickness
  if (h.face === "A") return { at: [h.x, h.y, T], normal: [0, 0, 1] }
  if (h.face === "B") return { at: [h.x, h.y, 0], normal: [0, 0, -1] }
  switch (h.edge) {
    case "left":
      return { at: [0, h.y, T / 2], normal: [-1, 0, 0] }
    case "right":
      return { at: [p.length, h.y, T / 2], normal: [1, 0, 0] }
    case "bottom":
      return { at: [h.x, 0, T / 2], normal: [0, -1, 0] }
    default:
      return { at: [h.x, p.width, T / 2], normal: [0, 1, 0] }
  }
}

/** Una direcció local de la peça al mòdul (sense l'origen). */
export function worldDir(p: Panel, d: Vec3): Vec3 {
  const { xAxis: a, yAxis: b, zAxis: c } = p.placement
  return [d[0] * a[0] + d[1] * b[0] + d[2] * c[0], d[0] * a[1] + d[1] * b[1] + d[2] * c[1], d[0] * a[2] + d[1] * b[2] + d[2] * c[2]]
}

/** Forats d'una peça amb els talls rodons (tiradors) com a forats passants de cara A. */
export function mountHoles(p: Panel): Hole[] {
  const cut = (p.cutouts ?? []).flatMap((c) => (c.kind === "circle" ? [{ x: c.x, y: c.y, diameter: c.diameter, depth: p.thickness, face: "A" as const, ...(c.tag ? { tag: c.tag } : {}) }] : []))
  return [...p.holes, ...cut]
}

export function hardwareMount(item: HardwareItem, base: Module = defaultModule("mount", "Muntatge")): HardwareMount {
  const rc = recipe(item)
  const pending = isPendingImport(item)
  const tags = itemTags(item)
  if (!rc) {
    // Només 3D: el model tal qual (cap peça, cap forat).
    const imp = item.imported
    const b = imp?.bbox
    const size = b ? { width: r(b.max[0] - b.min[0]), height: r(b.max[1] - b.min[1]), depth: r(b.max[2] - b.min[2]) } : { width: 0, height: 0, depth: 0 }
    return { panels: [], pending, proposedTags: [], tags, focus: null, size, warnings: [], model: { ...(imp?.asset ? { asset: imp.asset } : {}), ...(b ? { bbox: b } : {}) } }
  }
  const empty = { panels: [], pending, proposedTags: [], tags, focus: null, size: rc.size, warnings: [] }
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
    build = buildModule(module)
  } catch (err) {
    return { ...empty, error: err instanceof HardwareError ? err.message : String(err) }
  }
  const own = (h: { tag?: string }) => !!h.tag && tags.includes(h.tag)
  // El forat principal d'un joc de calaix: una prebroca de la guia al lateral (no les del front ni del darrere).
  const focusTag = (h: { tag?: string }) => (item.engine === "drawerKit" ? h.tag === "kit-slide" : own(h))
  const panels = build.panels.filter((p) => {
    if (rc.keep(p)) return true
    // Les peces amb forats del ferratge a la meitat esquerra (la dreta és el mirall).
    return mountHoles(p).some((h) => own(h) && toWorld(p, holeEntry(p, h).at)[0] <= rc.size.width / 2 + 0.5)
  })
  // Els components d'un joc de calaix (peces de només veure, `extras`): es veuen muntats amb la fusta. Els accessoris també.
  if (item.engine === "drawerKit") panels.push(...build.extras.filter((p) => p.role === "hardware"))
  if (rc.extras) panels.push(...build.extras.filter(rc.extras))
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
      const score = item.engine === "cup" || item.engine === "plate" ? (h.tag === "hinge" ? at[1] : Infinity) : Math.abs(at[1] - rc.size.height / 2) + (p.role === "side" ? 0 : 0.1)
      if (score < best) {
        best = score
        // Un tirador es mira des de fora del front (on va el tirador), no des de la cara A; una pota, de davant i just
        // per sota de la base (es veu dreta sobre el terra amb la placa a sota de la base), no des de sota.
        // Un joc de calaix, des de dins del moble i una mica del darrere (el front tapa la guia si es mira de davant).
        const view: Vec3 | undefined = item.engine === "barHandle" ? [0, 0, 1] : item.engine === "leg" ? [0, -0.5, Math.sqrt(0.75)] : item.engine === "drawerKit" ? unit3([1, 0.6, -0.35]) : undefined
        focus = { panelId: p.id, hole: h, at, normal: worldDir(p, e.normal), ...(view ? { view } : {}), ...(item.engine === "drawerKit" ? { exact: true } : {}) }
      }
    }
  }
  const door = panels.find((p) => p.role === "door")
  const side = panels.find(isLeftSide)
  // Una pota va de la cara de sota de la base (el forat principal) cap avall, l'alçada de la base.
  const legH = legBase?.kind === "legs" ? legBase.height : 0
  let aim = item.engine === "leg" && focus ? { at: [focus.at[0], focus.at[1] - legH / 2, focus.at[2]] as Vec3, dist: Math.max(480, legH * 2.3) } : undefined
  // Un accessori no fa cap forat: es mira el mig del que es veu (la barra, els perfils, el marc), de davant.
  if (!focus && !aim && rc.extras) {
    // El primer (la barra; el perfil de sota el sostre; el perfil de dalt del marc): el pla es talla a la seva alçada.
    const first = panels.find(rc.extras)
    if (first) aim = { at: toWorld(first, [first.length / 2, first.width / 2, first.thickness / 2]), dist: Math.max(480, rc.size.width * 1.4) }
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
  }
}

/**
 * La càmera de «Com va muntat» (el 3D de l'editor en obrir-lo i la miniatura de la targeta, la mateixa vista): mira
 * el forat principal des de la cara on entra (a les frontisses, des de dins del moble, on es veuen la cassoleta i la
 * placa; un tirador, des de fora del front), una mica de costat i de dalt; una pota, sencera i de davant (`aim`). Un
 * «només 3D» mira el centre del model des de prou lluny per veure'l sencer (fov 32°). `target` i `dist` en mm; `dir` unitari, del punt mirat cap a la càmera.
 */
export function mountCamera(m: HardwareMount, aspect = 1.6): { target: Vec3; dir: Vec3; dist: number } {
  if (m.model?.bbox && !m.panels.length) return modelCamera(m.model.bbox, aspect)
  const n = m.focus?.view ?? m.focus?.normal ?? ([0, 0, 1] as Vec3)
  const hinge = !!m.hinge
  // De costat i de dalt: a les frontisses, cap a dins del moble (+X, lluny del lateral), si no, cap a la dreta.
  const side: Vec3 = [hinge ? 0.75 : 0.6, hinge ? 0.85 : 0.6, Math.abs(n[2]) > 0.7 ? 0 : 0.5]
  const k = side[0] * n[0] + side[1] * n[1] + side[2] * n[2]
  const d: Vec3 = [n[0] + side[0] - k * n[0], n[1] + side[1] - k * n[1], n[2] + side[2] - k * n[2]]
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  const dir: Vec3 = m.focus?.exact && m.focus.view ? m.focus.view : [d[0] / len, d[1] / len, d[2] / len]
  const b = m.model?.bbox
  const span = b ? Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) : 0
  const target: Vec3 = m.aim?.at ?? (m.focus ? m.focus.at : b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2] : [0, 0, 0])
  const dist = m.aim?.dist ?? (span > 0 && !m.panels.length ? Math.max(150, span * 2) : hinge ? 420 : m.focus?.hole.tag === "kit-slide" ? 1050 : 480)
  return { target, dir, dist }
}

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * D'on es mira un «només 3D» (una caixa `b`, mm; Y amunt): la direcció i, per a aquesta direcció, la càmera **més a prop**
 * que encara veu tota la caixa (perspectiva, fov vertical `fov`, `aspect` = amplada / alçada, amb un marge).
 * - Compacte (el costat llarg < 5 × el del mig): de davant a la dreta i de dalt (3/4).
 * - **Llarg i prim** (un perfil de 1560 × 12,5 × 6,5): mirant **al llarg** des d'un extrem, de costat i de dalt pocs graus
 *   (menys com més prim): la secció de l'extrem de davant es veu gran i la resta s'allunya en perspectiva cap al fons,
 *   tota dins la imatge (de costat sortiria una ratlla). Si el costat llarg és el vertical (una pota alta), de 3/4.
 * Els vuit vèrtexs es fan cabre exactament: per a cada eix de la pantalla, la posició de costat que deixa acostar més la
 * càmera (una funció còncava a trossos: cerca ternària), i la distància és la més petita dels dos eixos. Pur.
 */
export function modelCamera(b: { min: Vec3; max: Vec3 }, aspect = 1.6, fov = 32, angles?: { az: number; el: number }): { target: Vec3; dir: Vec3; dist: number } {
  const size: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
  const center: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
  const order = [0, 1, 2].sort((i, j) => size[j]! - size[i]!)
  const L = order[0]!
  const ratio = size[L]! / Math.max(1e-6, size[order[1]!]!)
  let dir: Vec3
  const along = ratio >= 5 && L !== 1
  if (along) {
    // Al llarg de l'eix llarg (horitzontal), des de l'extrem «min», una mica de costat (l'altre eix horitzontal) i de dalt.
    const deg = Math.PI / 180
    // De costat una mica més que la meitat del camp horitzontal: el llarg travessa la imatge d'un costat a l'altre (amb
    // menys, s'amuntega cap al punt de fuga; amb més, la secció es fa petita).
    const halfH = Math.atan(Math.tan((fov * Math.PI) / 360) * 0.86 * aspect) / deg
    const az = (angles?.az ?? Math.max(halfH + 1.5, Math.min(40, 240 / ratio))) * deg
    const el = (angles?.el ?? Math.max(10, Math.min(28, 160 / ratio))) * deg
    const along: Vec3 = L === 0 ? [-1, 0, 0] : [0, 0, -1]
    const side: Vec3 = L === 0 ? [0, 0, 1] : [1, 0, 0]
    dir = unit3([
      Math.cos(el) * (Math.cos(az) * along[0] + Math.sin(az) * side[0]),
      Math.sin(el),
      Math.cos(el) * (Math.cos(az) * along[2] + Math.sin(az) * side[2]),
    ])
  } else dir = unit3([0.62, 0.48, 0.78])
  // La base de la càmera: f (cap on mira), r (dreta), u (amunt).
  const f: Vec3 = [-dir[0], -dir[1], -dir[2]]
  const r = unit3(cross3(f, Math.abs(f[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]))
  const u = cross3(r, f)
  const corners: Vec3[] = []
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push([x, y, z])
  const t = Math.tan((fov * Math.PI) / 360) * 0.86
  const P = corners.map((p) => ({ r: dot3(p, r), u: dot3(p, u), f: dot3(p, f) }))
  // Per a una posició de costat c (en r o u), fins on pot avançar la càmera (en f) veient-los tots.
  const reach = (axis: "r" | "u", k: number) => (c: number) => Math.min(...P.map((p) => p.f - Math.abs(p[axis] - c) / k))
  const best = (axis: "r" | "u", k: number) => {
    const g = reach(axis, k)
    let lo = Math.min(...P.map((p) => p[axis]))
    let hi = Math.max(...P.map((p) => p[axis]))
    for (let i = 0; i < 80; i++) {
      const a = lo + (hi - lo) / 3
      const c = hi - (hi - lo) / 3
      if (g(a) < g(c)) lo = a
      else hi = c
    }
    const c = (lo + hi) / 2
    return { c, f: g(c) }
  }
  const bx = best("r", t * aspect)
  const by = best("u", t)
  // Centrat dins del que es pot amb la càmera a `cf` (el tros de posicions de costat on encara es veuen tots).
  const centred = (axis: "r" | "u", k: number, c0: number, cf: number) => {
    const g = reach(axis, k)
    const span = Math.max(...P.map((p) => p[axis])) - Math.min(...P.map((p) => p[axis])) + 1
    let a = c0
    let z = c0
    for (let step = span; step > 1e-3; step /= 2) {
      if (g(a - step) >= cf - 1e-6) a -= step
      if (g(z + step) >= cf - 1e-6) z += step
    }
    return (a + z) / 2
  }
  const pose = (cf: number): Vec3 => {
    const cr = centred("r", t * aspect, bx.c, cf)
    const cu = centred("u", t, by.c, cf)
    return [cr * r[0] + cu * u[0] + cf * f[0], cr * r[1] + cu * u[1] + cf * f[1], cr * r[2] + cu * u[2] + cf * f[2]]
  }
  let cf = Math.min(bx.f, by.f)
  if (along) {
    // Mirant al llarg, la càmera pot acostar-se fins que la secció de davant omple la imatge: s'atura abans, quan fa
    // ~45 % de l'alçada (la resta del llarg, en perspectiva, al costat).
    const near = corners.filter((p) => p[L] === b.min[L])
    const nearH = (c: number) => {
      const cam = pose(c)
      const ys = near.map((p) => {
        const d: Vec3 = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]]
        return dot3(d, u) / (dot3(d, f) * t)
      })
      return (Math.max(...ys) - Math.min(...ys)) / 2
    }
    if (nearH(cf) > 0.45) {
      let lo = cf - 4 * size[L]!
      let hi = cf
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2
        if (nearH(mid) > 0.45) hi = mid
        else lo = mid
      }
      cf = lo
    }
  }
  const cam = pose(cf)
  // Mira el punt del raig del mig més a prop del centre de la caixa (l'òrbita gira al voltant del model).
  const dist = Math.max(1, dot3([center[0] - cam[0], center[1] - cam[1], center[2] - cam[2]], f))
  const target: Vec3 = [cam[0] + f[0] * dist, cam[1] + f[1] * dist, cam[2] + f[2] * dist]
  return { target, dir, dist }
}

// --- El pla (vista de dalt, secció a l'alçada del forat principal) ----------------------------------------------------

/** Pla: x = X del mòdul (a la dreta), z = Z del mòdul (cap al davant = cap avall a la pantalla). */
export interface PlanRect {
  id: string
  label: string
  role: Panel["role"]
  thickness: number
  x0: number
  z0: number
  x1: number
  z1: number
  /** Gruix al llarg de x (una peça vertical de costat) o de z (un front). */
  along: "x" | "z" | "y"
}
export interface PlanHole {
  /** Rectangle (forat horitzontal, de costat) o cercle (forat vertical, vist des de dalt). */
  poly?: [number, number][]
  circle?: { cx: number; cz: number; r: number }
  /** El pla de tall el travessa (si no, és a sobre o a sota: es dibuixa amagat). */
  cut: boolean
  proposed: boolean
  own: boolean
  panelId: string
  tag?: string
}
export interface PlanDim {
  a: [number, number]
  b: [number, number]
  /** On va la línia de cota: desplaçament perpendicular des de a–b (mm, signe = costat). */
  offset: number
  label: string
  title: string
}
export interface PlanBox {
  x0: number
  z0: number
  x1: number
  z1: number
  dashed: boolean
  label?: string
}
export interface MountPlan {
  sectionY: number
  rects: PlanRect[]
  holes: PlanHole[]
  /** Ferratge (el volum del model importat o un de simplificat), projectat. */
  fittings: PlanBox[]
  dims: PlanDim[]
  view: { x: number; z: number; w: number; h: number }
}

const fmt = (v: number) => String(r(v)).replace(".", ",")

function boxOf(p: Panel): { min: Vec3; max: Vec3 } {
  const cs: Vec3[] = []
  for (const x of [0, p.length]) for (const y of [0, p.width]) for (const z of [0, p.thickness]) cs.push(toWorld(p, [x, y, z]))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/** Caixa d'un ferratge al marc (u, v, n) de la peça, al mòdul. */
function fittingBox(p: Panel, f: Pick<PanelFitting, "x" | "y" | "face" | "v">, bb: { min: Vec3; max: Vec3 }): { min: Vec3; max: Vec3 } {
  const nz = f.face === "A" ? 1 : -1
  const V: Vec3 = [f.v[0], f.v[1], 0]
  const N: Vec3 = [0, 0, nz]
  const U: Vec3 = [V[1] * N[2] - V[2] * N[1], V[2] * N[0] - V[0] * N[2], V[0] * N[1] - V[1] * N[0]]
  const o: Vec3 = [f.x, f.y, f.face === "A" ? p.thickness : 0]
  const cs: Vec3[] = []
  for (const u of [bb.min[0], bb.max[0]])
    for (const v of [bb.min[1], bb.max[1]])
      for (const n of [bb.min[2], bb.max[2]]) cs.push(toWorld(p, [o[0] + u * U[0] + v * V[0] + n * N[0], o[1] + u * U[1] + v * V[1] + n * N[1], o[2] + u * U[2] + v * V[2] + n * N[2]]))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/** Volum simplificat d'una frontissa de l'app (com `PanelHardware`: cassoleta i braç cap a dins). */
const BUILTIN_HINGE = (d: number) => ({ min: [-10, -Math.max(20, d) / 2, 0] as Vec3, max: [10, Math.max(20, d) / 2, 13] as Vec3 })

/**
 * El pla del muntatge: vista de dalt amb un tall a l'alçada del forat principal. Les peces que el tall travessa en
 * secció (rectangles amb el gruix), els forats a ±40 mm (els que el tall travessa, plens; els altres, amagats), el
 * ferratge projectat i les cotes (a les frontisses: cassoleta al cantell, C, recobriment, joc, fondària i la filera de
 * la placa al lateral). Tot surt de les peces del motor.
 */
export function mountPlan(m: HardwareMount): MountPlan | null {
  // Un accessori sense cap forat (barra, perfil LED, marc): el tall a l'alçada del que es veu (`aim`).
  const at = m.focus?.at ?? m.aim?.at
  if (!at) return null
  const Y0 = at[1]
  const band = 40
  const rects: PlanRect[] = []
  const holes: PlanHole[] = []
  const fittings: PlanBox[] = []
  const own = (h: { tag?: string }) => !!h.tag && m.tags.includes(h.tag)
  const proposed = (h: { tag?: string }) => !!h.tag && m.proposedTags.includes(h.tag)
  for (const p of m.panels) {
    const b = boxOf(p)
    if (Y0 < b.min[1] - 0.01 || Y0 > b.max[1] + 0.01) continue
    const sx = b.max[0] - b.min[0]
    const sy = b.max[1] - b.min[1]
    const sz = b.max[2] - b.min[2]
    const along = Math.abs(sx - p.thickness) < 0.01 ? "x" : Math.abs(sz - p.thickness) < 0.01 ? "z" : Math.abs(sy - p.thickness) < 0.01 ? "y" : "x"
    rects.push({ id: p.id, label: p.label, role: p.role, thickness: p.thickness, x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2], along })
  }
  const inPlan = new Set(rects.map((x) => x.id))
  for (const p of m.panels) {
    if (!inPlan.has(p.id)) continue
    for (const h of mountHoles(p)) {
      const e = holeEntry(p, h)
      const E = toWorld(p, e.at)
      const n = worldDir(p, e.normal)
      const B: Vec3 = [E[0] - n[0] * h.depth, E[1] - n[1] * h.depth, E[2] - n[2] * h.depth]
      const rad = h.diameter / 2
      const vertical = Math.abs(n[1]) > 0.7
      const base = { panelId: p.id, proposed: proposed(h), own: own(h), ...(h.tag ? { tag: h.tag } : {}) }
      if (vertical) {
        const lo = Math.min(E[1], B[1])
        const hi = Math.max(E[1], B[1])
        if (Y0 < lo - band || Y0 > hi + band) continue
        holes.push({ ...base, circle: { cx: E[0], cz: E[2], r: rad }, cut: Y0 >= lo && Y0 <= hi })
      } else {
        if (Math.abs(E[1] - Y0) > band + rad) continue
        // Perpendicular a l'eix al pla x–z.
        const len = Math.hypot(n[0], n[2]) || 1
        const px = (-n[2] / len) * rad
        const pz = (n[0] / len) * rad
        holes.push({ ...base, poly: [[E[0] + px, E[2] + pz], [B[0] + px, B[2] + pz], [B[0] - px, B[2] - pz], [E[0] - px, E[2] - pz]], cut: Math.abs(E[1] - Y0) <= rad + 0.01 })
      }
    }
    // El ferratge: el model importat (la seva caixa) o, a les frontisses de l'app, un volum simplificat a cada cassoleta.
    const fits: { f: Pick<PanelFitting, "x" | "y" | "face" | "v">; bb: { min: Vec3; max: Vec3 }; label?: string }[] = (p.fittings ?? []).flatMap((f) => (f.bbox ? [{ f, bb: f.bbox }] : []))
    if (p.role === "door" && !p.fittings?.length)
      for (const h of p.holes.filter((x) => x.tag === "hinge")) fits.push({ f: { x: h.x, y: h.y, face: h.face === "B" ? "B" : "A", v: [0, 1] }, bb: BUILTIN_HINGE(h.diameter) })
    for (const { f, bb } of fits) {
      const fb = fittingBox(p, f, bb)
      if (Y0 < fb.min[1] - 0.01 || Y0 > fb.max[1] + 0.01) continue
      fittings.push({ x0: fb.min[0], z0: fb.min[2], x1: fb.max[0], z1: fb.max[2], dashed: !p.fittings?.length })
    }
  }
  const dims: PlanDim[] = []
  const door = m.hinge && rects.find((x) => x.id === m.hinge!.doorId)
  const side = m.hinge && rects.find((x) => x.id === m.hinge!.sideId)
  const cup = holes.find((h) => h.tag === "hinge" && h.cut && h.poly)
  if (door && side && cup?.poly) {
    // Porta a l'esquerra (la frontissa a l'esquerra): el cantell de la porta és door.x0.
    const xs = cup.poly.map((q) => q[0])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const rad = (Math.max(...xs) - Math.min(...xs)) / 2
    const zs = cup.poly.map((q) => q[1])
    const xe = door.x0
    const below = door.z1
    const row = (k: number) => below - door.z1 + 14 + 12 * k
    const k0 = xe - side.x0 > 0.05 ? 1 : 0
    if (xe - side.x0 > 0.05) dims.push({ a: [side.x0, below], b: [xe, below], offset: row(0), label: fmt(xe - side.x0), title: "Joc: del cantell de fora del lateral al cantell de la porta" })
    dims.push(
      side.x1 > xe
        ? { a: [xe, below], b: [side.x1, below], offset: row(k0), label: fmt(side.x1 - xe), title: "Recobriment: quant tapa la porta el cantell del lateral" }
        : { a: [side.x1, below], b: [xe, below], offset: row(k0), label: fmt(xe - side.x1), title: "Joc entre el lateral i la porta (encastada)" },
    )
    dims.push({ a: [xe, below], b: [cx, below], offset: row(k0 + 1), label: fmt(cx - xe), title: "Del cantell de la porta al centre de la cassoleta" })
    dims.push({ a: [xe, below], b: [cx - rad, below], offset: row(k0 + 2), label: `C ${fmt(cx - rad - xe)}`, title: "C: del cantell de la porta a la vora de la cassoleta (distància de perforació del fabricant)" })
    const depth = Math.max(...zs) - Math.min(...zs)
    dims.push({ a: [cx + rad, door.z0], b: [cx + rad, door.z0 + depth], offset: -10, label: fmt(depth), title: "Fondària de la cassoleta" })
    if (door.z0 - side.z1 > 0.05) dims.push({ a: [side.x1, side.z1], b: [side.x1, door.z0], offset: 10, label: fmt(door.z0 - side.z1), title: "Joc entre el lateral i la porta" })
    // La filera de la placa (o la del System 32) des del davant del lateral.
    const zMid = (q: [number, number][]) => q.reduce((t, c) => t + c[1], 0) / q.length
    const rowHole = holes
      .filter((h) => h.panelId === side.id && h.poly)
      .sort((a, b) => Number(b.tag === "plate") - Number(a.tag === "plate") || Number(b.cut) - Number(a.cut) || zMid(b.poly!) - zMid(a.poly!))[0]
    if (rowHole?.poly) {
      const z = zMid(rowHole.poly)
      dims.push({ a: [side.x0, side.z1], b: [side.x0, z], offset: -14, label: fmt(side.z1 - z), title: rowHole.tag === "plate" ? "Placa: del davant del lateral a la filera dels forats" : "Filera System 32: del davant del lateral" })
    }
  } else if (!m.focus) {
    // Accessori sense forats: la mida de la peça que es veu (la barra, el perfil, el marc) i on és respecte del lateral.
    const own = rects.filter((x) => x.role === "part")
    const first = own[0]
    const side = rects.find((x) => x.role === "side")
    if (first) dims.push({ a: [first.x0, first.z0], b: [first.x1, first.z0], offset: -16, label: fmt(first.x1 - first.x0), title: `${first.label}: llarg` })
    if (first && side && side.z1 > first.z1 + 0.5) dims.push({ a: [first.x0, first.z1], b: [first.x0, side.z1], offset: -14, label: fmt(side.z1 - first.z1), title: "Del davant del lateral a l'accessori" })
  } else {
    // Qualsevol altre: el forat principal fins als cantells de la seva peça.
    const f = m.focus
    const rect = rects.find((x) => x.id === f.panelId)
    if (rect) {
      const E: [number, number] = [f.at[0], f.at[2]]
      const n = f.normal
      const alongX = Math.abs(n[0]) > 0.7
      const alongZ = Math.abs(n[2]) > 0.7
      if (!alongZ) {
        const zEdge = Math.abs(E[1] - rect.z0) < Math.abs(E[1] - rect.z1) ? rect.z0 : rect.z1
        if (Math.abs(zEdge - E[1]) > 0.5) dims.push({ a: [E[0], zEdge], b: [E[0], E[1]], offset: alongX ? -16 : 16, label: fmt(Math.abs(zEdge - E[1])), title: "Del centre del forat al cantell de la peça" })
      }
      if (!alongX) {
        const xEdge = Math.abs(E[0] - rect.x0) < Math.abs(E[0] - rect.x1) ? rect.x0 : rect.x1
        if (Math.abs(xEdge - E[0]) > 0.5) dims.push({ a: [xEdge, E[1]], b: [E[0], E[1]], offset: 16, label: fmt(Math.abs(xEdge - E[0])), title: "Del centre del forat al cantell de la peça" })
      }
      // Dos forats del ferratge al tall, a la mateixa peça (un tirador): la distància entre centres.
      const mates = holes.filter((h) => h.own && h.cut && h.panelId === f.panelId && h.poly)
      if (mates.length === 2) {
        const c = mates.map((h) => [h.poly!.reduce((t, q) => t + q[0], 0) / 4, h.poly!.reduce((t, q) => t + q[1], 0) / 4] as [number, number])
        const [a, b] = c[0]![0] <= c[1]![0] ? [c[0]!, c[1]!] : [c[1]!, c[0]!]
        dims.push({ a, b, offset: -16, label: fmt(Math.hypot(b[0] - a[0], b[1] - a[1])), title: "Entre els centres dels forats" })
      }
      const d = f.hole.depth
      if (alongX || alongZ) {
        const b: [number, number] = [E[0] - n[0] * d, E[1] - n[2] * d]
        dims.push({ a: E, b, offset: alongX ? 12 : -12, label: fmt(d), title: "Fondària del forat" })
      }
    }
  }
  // Vista: els forats del ferratge a prop del principal, amb els cantells propers i les cotes.
  const pts: [number, number][] = []
  const fx = at[0]
  const fz = at[2]
  for (const h of holes) {
    if (!h.own) continue
    const ps = h.poly ?? (h.circle ? [[h.circle.cx - h.circle.r, h.circle.cz - h.circle.r], [h.circle.cx + h.circle.r, h.circle.cz + h.circle.r]] as [number, number][] : [])
    if (ps.some((q) => Math.hypot(q[0] - fx, q[1] - fz) <= 120)) pts.push(...ps)
  }
  for (const b of fittings) if (Math.hypot((b.x0 + b.x1) / 2 - fx, (b.z0 + b.z1) / 2 - fz) <= 120) pts.push([b.x0, b.z0], [b.x1, b.z1])
  pts.push([fx, fz])
  let x0 = Math.min(...pts.map((q) => q[0])) - 25
  let x1 = Math.max(...pts.map((q) => q[0])) + 25
  let z0 = Math.min(...pts.map((q) => q[1])) - 25
  let z1 = Math.max(...pts.map((q) => q[1])) + 25
  // Els cantells de les peces a menys de 70 mm hi entren (es veu a quina distància hi és el forat).
  for (const rc of rects) {
    for (const x of [rc.x0, rc.x1]) if ((x < x0 && x0 - x < 70) || (x > x1 && x - x1 < 70)) [x0, x1] = [Math.min(x0, x - 12), Math.max(x1, x + 12)]
    for (const z of [rc.z0, rc.z1]) if ((z < z0 && z0 - z < 70) || (z > z1 && z - z1 < 70)) [z0, z1] = [Math.min(z0, z - 12), Math.max(z1, z + 12)]
  }
  for (const d of dims) {
    const vx = d.b[0] - d.a[0]
    const vz = d.b[1] - d.a[1]
    const len = Math.hypot(vx, vz) || 1
    const ox = (-vz / len) * d.offset
    const oz = (vx / len) * d.offset
    for (const q of [d.a, d.b]) {
      x0 = Math.min(x0, q[0] + ox - 8)
      x1 = Math.max(x1, q[0] + ox + 8)
      z0 = Math.min(z0, q[1] + oz - 8)
      z1 = Math.max(z1, q[1] + oz + 8)
    }
  }
  // Com a mínim 140 × 100 mm i sense ser més alt que ample del compte.
  const w = Math.max(140, x1 - x0)
  const h = Math.max(100, z1 - z0, w / 2.2)
  const cxv = (x0 + x1) / 2
  const czv = (z0 + z1) / 2
  return { sectionY: Y0, rects, holes, fittings, dims, view: { x: r(cxv - w / 2), z: r(czv - h / 2), w: r(w), h: r(h) } }
}
