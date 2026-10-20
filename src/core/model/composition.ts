import { DEFAULT_CABINET, type CabinetParams } from "./cabinet"
import { sampleProfile, toNodes } from "./polygon"
import { aliasMaterialRefs } from "./photoUpgrade"
import { upgradeApplianceBodies } from "./applianceBody"
import { PART_AXES as PART_AXES_C, tidyPart, type FreePart } from "./freePart"
import { DEFAULT_LEGACY_HARDWARE, isLegacyHardware, kitFromLegacy, migrateModuleHardware, type ModuleHardware } from "./hardware"
import { hungBack } from "./hungBack"
import type { Base, Carcass, Front, Module, Zone } from "./moduleSchema"
import { visibleModule } from "./moduleVisible"
import type { Composition, CompositionKind, RefObject, Run } from "./compositionSchema"

/**
 * Model de composició: mòduls d'esquerra a dreta, cadascun amb una carcassa i un arbre de zones (divisions i
 * continguts). Totes les mides en mm. Els esquemes del mòdul a `moduleSchema.ts`, els de la composició a
 * `compositionSchema.ts` i el mòdul tal com es veu («res amagat compta») a `moduleVisible.ts`. Aquí, les utilitats,
 * la col·locació dels mòduls i les migracions en llegir.
 */
export * from "./moduleSchema"
export * from "./compositionSchema"
export * from "./moduleVisible"

// --- Utilitats ---------------------------------------------------------------------

let counter = 0
export function newId(prefix = "z"): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

/** Recorre l'arbre de zones (pre-ordre). */
export function walkZones(zone: Zone, fn: (z: Zone, parent: Zone | null) => void, parent: Zone | null = null): void {
  fn(zone, parent)
  zone.split?.children.forEach((c) => walkZones(c, fn, zone))
}

export function findZone(root: Zone, id: string): Zone | undefined {
  let found: Zone | undefined
  walkZones(root, (z) => {
    if (z.id === id) found = z
  })
  return found
}

/** Alçada de la base del mòdul sobre el terra (potes o penjat a la paret), sense comptar ancoratges. */
export function moduleElevation(c: { base: Base }): number {
  return c.base.kind === "legs" || c.base.kind === "wall" ? c.base.height : 0
}

/** Cantonada baix-esquerra-darrere de cada mòdul dins de la composició (mm). */
export interface ModulePlacement {
  x: number
  y: number
  /** Separació de la paret (mòduls «Al terra»); 0 o absent: arrambat. */
  z?: number
}

/** On va un mòdul: arrambat a la paret, penjat, o al terra lliure. */
export type ModuleMount = "wall" | "hung" | "floor"
/** Mòdul al terra lliure amb posició X pròpia (fora de la fila). */
export const freeX = (m: Module): boolean => m.x !== undefined && m.carcass.base.kind !== "wall" && m.wallGap !== undefined

/** Gir d'un mòdul al voltant del vertical, en graus (vist de dalt, antihorari: 90 = fronts a +X). */
export type ModuleRot = 0 | 90 | 180 | 270

/**
 * Cap on miren els fronts del mòdul (`Module.rot`, o `turned` = 180), en qualsevol muntatge (per decisió de l'usuari,
 * 2026-10-20: «si saps el front saps com va la resta»). Enrere (180°) només lliure al terra: arrambat o penjat, els fronts
 * mirarien a la paret, i es queda endavant.
 */
export const moduleRot = (m: Module): ModuleRot => {
  const rot = m.rot ?? (m.turned ? 180 : 0)
  return rot === 180 && mountOf(m) !== "floor" ? 0 : rot
}

/** Cara dels fronts d'un mòdul des del darrere de la caixa: recobrents, per davant (un gruix); encastats, a ras. */
export function moduleFrontFace(m: Module): number {
  return m.carcass.depth + (visibleModule(m).fronts.style === "inset" ? 0 : m.carcass.thickness)
}

/** Gira el punt (x, z) `rot` graus al voltant de (cx, cz) (vist de dalt, antihorari: +Z → +X amb 90). */
export function rotXZ(x: number, z: number, rot: ModuleRot, cx = 0, cz = 0): [number, number] {
  const dx = x - cx, dz = z - cz
  if (rot === 90) return [cx + dz, cz - dx]
  if (rot === 180) return [cx - dx, cz - dz]
  if (rot === 270) return [cx - dz, cz + dx]
  return [x, z]
}

/** El gir contrari (desfà `rotXZ`). */
export const unrot = (rot: ModuleRot): ModuleRot => ((360 - rot) % 360) as ModuleRot

/** Cap on miren els fronts d'un mòdul a la planta: +z (endavant), −z, +x o −x. */
export type Facing = "+z" | "-z" | "+x" | "-x"
const facingOf = (rot: ModuleRot): Facing => (rot === 90 ? "+x" : rot === 180 ? "-z" : rot === 270 ? "-x" : "+z")

/**
 * La petjada d'un mòdul a la planta (coordenades de la composició): la caixa `w` × `d` (d = fins a la cara dels fronts)
 * a `place`, girada al voltant del seu centre (`moduleRot`), i cap on miren els fronts.
 */
export function moduleFootprint(m: Module, place: { x: number; z?: number }, d: number, rot: ModuleRot = moduleRot(m)): { x0: number; x1: number; z0: number; z1: number; facing: Facing } {
  const w = m.carcass.width
  const x = place.x, z = place.z ?? 0
  const quarter = rot === 90 || rot === 270
  const [hw, hd] = quarter ? [d / 2, w / 2] : [w / 2, d / 2]
  const cx = x + w / 2, cz = z + d / 2
  return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, facing: facingOf(rot) }
}

export const mountOf = (m: Module): ModuleMount => (m.carcass.base.kind === "wall" ? "hung" : m.wallGap !== undefined ? "floor" : "wall")

/** Fila d'un mòdul: a terra (baixos) o penjat a la paret (alts). */
type ModuleRow = "floor" | "wall"
export const rowOf = (m: Module): ModuleRow => (m.carcass.base.kind === "wall" ? "wall" : "floor")

/**
 * Posició de cada mòdul. Hi ha dues files, cadascuna d'esquerra a dreta en l'ordre de la
 * composició (el mateix de l'arbre): la de terra i la dels penjats a la paret. Cada mòdul
 * va al costat de l'anterior de la seva fila, amb la seva separació; y = potes o alçada
 * del penjat.
 */
export function modulePlacements(comp: Composition): ModulePlacement[] {
  const cursor: Record<ModuleRow, number> = { floor: 0, wall: 0 }
  return comp.modules.map((m) => {
    const row = rowOf(m)
    // Al terra amb X pròpia (illa): fora de la fila, no mou el cursor.
    if (freeX(m)) return { x: m.x!, y: moduleElevation(m.carcass), ...(m.wallGap ? { z: m.wallGap } : {}) }
    const x = cursor[row] + m.gapBefore
    const wallZ = row === "floor" && m.wallGap ? m.wallGap : 0
    // Fronts a un costat (90° o 270°): a la fila ocupa la fondària (fins a la cara dels fronts) i un lateral toca la paret.
    // L'origen és el del mòdul sense girar, que gira al voltant del centre de la petjada (`moduleFootprint`).
    const rot = moduleRot(m)
    if (rot === 90 || rot === 270) {
      const w = m.carcass.width, d = moduleFrontFace(m)
      cursor[row] = x + d
      const z = wallZ + (w - d) / 2
      return { x: x + (d - w) / 2, y: moduleElevation(m.carcass), ...(z ? { z } : {}) }
    }
    cursor[row] = x + m.carcass.width
    return { x, y: moduleElevation(m.carcass), ...(wallZ ? { z: wallZ } : {}) }
  })
}

/** Posicions amb els ancoratges antics (`anchor`), només per migrar mobles guardats. */
function legacyPlacements(comp: Composition): ModulePlacement[] {
  const n = comp.modules.length
  const anchored = (m: Module) => !!m.anchor && m.anchor.module !== m.id && comp.modules.some((t) => t.id === m.anchor!.module)
  const out: (ModulePlacement | undefined)[] = new Array(n)
  let x = 0
  comp.modules.forEach((m, i) => {
    if (anchored(m)) return
    x += m.gapBefore
    out[i] = { x, y: moduleElevation(m.carcass) }
    x += m.carcass.width
  })
  for (let pass = 0; pass < n; pass++) {
    comp.modules.forEach((m, i) => {
      if (out[i] || !m.anchor) return
      const ti = comp.modules.findIndex((t) => t.id === m.anchor!.module)
      const t = out[ti]
      if (!t) return
      const target = comp.modules[ti]!
      const at = m.anchor.at ?? "top"
      const wall = m.carcass.base.kind === "wall" ? m.carcass.base.height : null
      if (at === "top") out[i] = { x: t.x + m.anchor.dx, y: wall ?? t.y + target.carcass.height + moduleElevation(m.carcass) }
      else out[i] = { x: at === "right" ? t.x + target.carcass.width + m.anchor.dx : t.x - m.carcass.width - m.anchor.dx, y: wall ?? t.y }
    })
  }
  return out.map((p, i) => p ?? { x: 0, y: moduleElevation(comp.modules[i]!.carcass) })
}

/**
 * Converteix els mòduls ancorats (versions anteriors) a les dues files: els que eren a
 * sobre d'un altre passen a penjats a l'alçada on eren; l'ordre de cada fila es refà
 * d'esquerra a dreta i les separacions es recalculen perquè tot quedi on era.
 */
export function normalizeComposition(raw: Composition): Composition {
  // Noms de material antics («… (foto)», v6 de les preferències): els vigents. El cos dels electrodomèstics d'abans, el
  // de la seva família (v3 dels items del catàleg).
  const input = upgradeApplianceBodies(aliasMaterialRefs(raw))
  // Peces lliures amb decimals llargs (objectes fets abans d'arrodonir): al mm.
  const tidy = input.parts?.map(tidyPart)
  const tidied = tidy && tidy.some((p, i) => p !== input.parts![i]) ? { ...input, parts: tidy } : input
  // Flat-pack com a opció de les peces i taulell i sòcol a qualsevol moble (millores v1).
  const runs = migrateRuns(migrateFlatPack(tidied))
  // Ferratges d'abans (v19): els números del mòdul passen a una còpia dels items (els mateixos números).
  const comp = runs.modules.some((m) => isLegacyHardware(m.hardware))
    ? { ...runs, modules: runs.modules.map((m) => (isLegacyHardware(m.hardware) ? { ...m, hardware: migrateModuleHardware(m.hardware) as ModuleHardware } : m)) }
    : runs
  if (!comp.modules.some((m) => m.anchor)) return comp
  const ps = legacyPlacements(comp)
  const items = comp.modules.map((m, i) => {
    const { anchor: _a, ...rest } = m
    void _a
    const y = ps[i]!.y
    const mod: Module = m.anchor && m.carcass.base.kind !== "wall" && y > 0 ? { ...rest, carcass: { ...rest.carcass, base: { kind: "wall", height: y } } } : rest
    return { mod, x: ps[i]!.x }
  })
  const modules: Module[] = []
  for (const row of ["floor", "wall"] as const) {
    let right = 0
    for (const it of items.filter((t) => rowOf(t.mod) === row).sort((a, b) => a.x - b.x)) {
      modules.push({ ...it.mod, gapBefore: Math.max(0, Math.round(it.x - right)) })
      right = Math.max(right, it.x + it.mod.carcass.width)
    }
  }
  return { ...comp, modules }
}

/** Amplada total: fins a la dreta del mòdul que arriba més lluny. */
export function compositionWidth(comp: Composition): number {
  const ps = modulePlacements(comp)
  return comp.modules.reduce((w, m, i) => Math.max(w, moduleFootprint(m, ps[i]!, moduleFrontFace(m)).x1), 0)
}

/** Alçada total: fins a dalt del mòdul més alt (tenint en compte potes, penjats i apilats). */
export function compositionHeight(comp: Composition): number {
  const ps = modulePlacements(comp)
  return comp.modules.reduce((h, m, i) => Math.max(h, ps[i]!.y + m.carcass.height), 0)
}

// --- Migració del mòdul de caixa (CabinetParams) ----------------------------------

/** Converteix els paràmetres del mòdul de caixa (Fase 1) en un mòdul de composició equivalent. */
export function cabinetToModule(p: CabinetParams, id = "m1", name = "Mòdul"): Module {
  const front: Front | undefined =
    p.doors === 0 ? undefined : { kind: "door", mode: p.doors === 2 ? "double" : "single", hinge: "left" }
  return {
    id,
    name,
    gapBefore: 0,
    carcass: {
      width: p.width,
      height: p.height,
      depth: p.depth,
      material: p.material,
      thickness: p.panelThickness,
      backMaterial: p.backMaterial,
      backThickness: p.backThickness,
      base: { kind: "none" },
      back: p.backType,
      top: { kind: "full" },
      sides: { left: true, right: true },
      backSetback: p.backSetback,
      grooveDepth: p.grooveDepth,
      backClearance: p.backClearance,
      shelfSetback: p.shelfSetback,
      shelfClearance: p.shelfClearance,
    },
    root: {
      id: `${id}-root`,
      shelves: { n: p.shelves, adjustable: true },
      ...(front ? { front } : {}),
    },
    fronts: { outerGap: p.doorGap, betweenGap: p.doorGapBetween },
    hardware: kitFromLegacy({ ...DEFAULT_LEGACY_HARDWARE, hinge: p.hinge, system32: p.system32, dowel: p.dowel }),
    extras: { cableHoles: [] },
  }
}

export function cabinetToComposition(p: CabinetParams, name = "Mòdul"): Composition {
  return { modules: [cabinetToModule(p, "m1", name)], references: [] }
}

/** Mòdul nou amb valors per defecte (caixa buida amb prestatges regulables). */
/** Tipus d'una composició: el triat o, als antics, cuina si té taulell/sòcol corregut. */
export function compositionKind(c: Composition): CompositionKind {
  return c.kind ?? (c.runs?.length ? "cuina" : "moble")
}

/**
 * Només peces lliures (sense mòduls): el Flat-pack (amb encaixos, es fabrica) i l'**Objecte**
 * (sofà, làmpada, planta… per als ambients: peces amb forma, booleanes i textures, que només es
 * veuen i no es fabriquen).
 */
export const partsOnlyKind = (k: CompositionKind) => k === "lliure" || k === "objecte"

/**
 * La peça fa encaixos (Flat-pack, «Encaixos» de la peça): el camp `joinery` i, si encara no s'ha migrat, el del tipus
 * Flat-pack d'abans (`lliure`: totes menys les `joints: false`). Mai als objectes, que no es fabriquen.
 */
export function partJoinery(comp: Composition, p: FreePart): boolean {
  const kind = compositionKind(comp)
  if (kind === "objecte") return false
  return p.joinery ?? (kind === "lliure" && p.joints !== false)
}

/**
 * Migració en llegir (millores v1): el Flat-pack deixa de ser un tipus de moble i passa a ser una opció de cada peça
 * lliure (`joinery`, expressa). Al tipus `lliure`, cada peça porta el valor que tenia (`partJoinery`: el resultat
 * és el mateix); a la resta no se'n posa cap (no fan encaixos, com abans). El camp vell `joints` es treu. Idempotent:
 * si no hi ha res a fer, torna la mateixa composició.
 */
export function migrateFlatPack(comp: Composition): Composition {
  const parts = comp.parts
  if (!parts?.length) return comp
  const lliure = compositionKind(comp) === "lliure"
  if (!parts.some((p) => p.joints !== undefined || (lliure && p.joinery === undefined))) return comp
  return {
    ...comp,
    parts: parts.map((p) => {
      const { joints: _j, ...rest } = p
      void _j
      return lliure && p.joinery === undefined ? { ...rest, joinery: partJoinery(comp, p) } : rest
    }),
  }
}

/**
 * Migració en llegir (millores v1): el taulell i el sòcol correguts es poden posar a qualsevol moble (abans, només a
 * la Cuina; en canviar de tipus es guardaven sense fer-se). Els d'un moble que **no** és cuina queden apagats
 * (`off: true`): es veuen a «Taulell i sòcol» i es poden tornar a encendre, però no es fan (la fabricació no canvia).
 * Només els que encara no porten `off` (els nous en porten `off: false`). Idempotent.
 */
export function migrateRuns(comp: Composition): Composition {
  const runs = comp.runs
  if (!runs?.length || compositionKind(comp) === "cuina" || !runs.some((r) => r.off === undefined)) return comp
  return { ...comp, runs: runs.map((r) => (r.off === undefined ? { ...r, off: true } : r)) }
}

/** Taulells i sòcols que es fan: els que no estan apagats, a qualsevol moble amb mòduls fets. */
export function activeRuns(comp: Composition): Run[] {
  if (partsOnlyKind(compositionKind(comp))) return []
  return (migrateRuns(comp).runs ?? []).filter((r) => !r.off)
}

/**
 * Taula o consola de panells: tauler a dalt i dos laterals que fan de potes, sense base
 * ni fons, amb les cantonades a inglet (com un bloc massís).
 */
export function tableModule(id: string, name: string, overrides: Partial<Carcass> = {}): Module {
  const m = defaultModule(id, name, { width: 1400, height: 760, depth: 400, base: { kind: "none" }, noBottom: true, back: "none", joint: "mitre", ...overrides })
  return { ...m, root: { id: newId() } }
}

/**
 * Mòdul nou del + de «Mòduls» (per decisió de l'usuari, 2026-10-15: «quan crees un mòdul nou, que sigui com aquest Mòdul
 * 2»): un **buc estàndard** de cuina (600 × 720 × 580: la caixa de 72, sobre les potes del moble; «fica la mida d'un buc estàndard»; de 580 de fons, per al taulell de 600–620 i el nínxol dels rentaplats (Teka ≥ 580)) amb els dos laterals, la tapa i el fons en ranura, l'interior obert sense
 * prestatges; el suport, el del moble (`withSupport`). Es completa a la Caixa (opcions en cascada). Els materials, els
 * gruixos i les folgances, de Preferències (`applySettingsToModule`).
 */
export function emptyModule(id: string, name: string): Module {
  const m = defaultModule(id, name, { width: 600, height: 720, depth: 580, base: { kind: "none" }, back: "groove", top: { kind: "full" }, sides: { left: true, right: true } })
  return { ...m, type: "base", root: { id: `${id}-root`, shelves: { n: 0, adjustable: true } } }
}

export function defaultModule(id: string, name: string, overrides: Partial<Carcass> = {}): Module {
  const m = cabinetToModule({ ...DEFAULT_CABINET, doors: 0, shelves: 1 }, id, name)
  // Un penjat, amb el fons estàndard (retirat per al penjador i la regleta: `hungBack`).
  return { ...m, carcass: hungBack({ ...m.carcass, ...overrides }) }
}

/** Origen (mm) de cada mòdul a la composició, per id. */
export function moduleOrigins3(comp: Composition): Map<string, [number, number, number]> {
  const ps = modulePlacements(comp)
  return new Map(comp.modules.map((m, i) => [m.id, [ps[i]!.x, ps[i]!.y, ps[i]!.z ?? 0] as [number, number, number]]))
}

/**
 * Peces lliures amb coordenades de la composició: les enganxades a un mòdul se sumen a la
 * seva posició. Al Flat-pack (sense mòduls fets) o si el mòdul ja no hi és, van soles.
 */
export function resolveParts(comp: Composition): FreePart[] {
  const parts = comp.parts ?? []
  if (!parts.some((p) => p.module) || partsOnlyKind(compositionKind(comp))) return parts
  const origins = moduleOrigins3(comp)
  return parts.map((p) => {
    const o = p.module ? origins.get(p.module) : undefined
    return o ? { ...p, x: p.x + o[0], y: p.y + o[1], z: p.z + o[2] } : p
  })
}

/** Desplaçament que cal sumar a una peça per passar-la a coordenades de la composició. */
export function partOffset(comp: Composition, p: FreePart): [number, number, number] {
  if (!p.module || partsOnlyKind(compositionKind(comp))) return [0, 0, 0]
  return moduleOrigins3(comp).get(p.module) ?? [0, 0, 0]
}

/**
 * Peces lliures en mode «Talla», com a objectes que tallen (perfil = la seva forma o el
 * rectangle; direcció = el gruix). Id `part:<id>`.
 */
export function partCutters(comp: Composition): RefObject[] {
  return resolveParts(comp)
    .filter((p) => p.effect === "cut")
    .map((p) => {
      const ax = PART_AXES_C[p.orient]
      const size = [0, 0, 0]
      size[ax.n] = p.thickness
      size[ax.u] = p.w
      size[ax.v] = p.h
      // Secció (u, v) de l'objecte: estirada, la v del perfil va cap al fons (z creixent) i la
      // de la peça cap al davant: es gira.
      const flip = p.orient === "flat"
      const nodes = toNodes(p.shape ?? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
      const ys = nodes.map((n) => n.y)
      const y0 = Math.min(...ys), y1 = Math.max(...ys)
      const profile = flip
        ? nodes.map((n) => ({ ...n, y: y0 + y1 - n.y, ...(n.in ? { in: [n.in[0], -n.in[1]] as [number, number] } : {}), ...(n.out ? { out: [n.out[0], -n.out[1]] as [number, number] } : {}) }))
        : nodes
      return {
        id: `part:${p.id}`,
        name: p.name,
        x: p.x,
        y: p.y,
        z: p.z,
        w: size[0]!,
        h: size[1]!,
        d: size[2]!,
        effect: "cut" as const,
        shape: "profile" as const,
        axis: (["x", "y", "z"] as const)[ax.n],
        profile: scaleProfile(profile, p.shape ? size[ax.u]! : size[ax.u]!, size[ax.v]!),
        ...(p.round ? { round: p.round } : {}),
      }
    })
}

/** Escala un perfil perquè ocupi exactament w × h (cantonada mínima a 0, 0). */
function scaleProfile(nodes: ReturnType<typeof toNodes>, w: number, h: number): ReturnType<typeof toNodes> {
  // Extensió real de la corba (com `shapeOutline`), no només dels nodes.
  const pts = sampleProfile(nodes, 64)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const sx = w / Math.max(1e-6, Math.max(...xs) - x0)
  const sy = h / Math.max(1e-6, Math.max(...ys) - y0)
  return nodes.map((n) => ({
    ...n,
    x: (n.x - x0) * sx,
    y: (n.y - y0) * sy,
    ...(n.in ? { in: [n.in[0] * sx, n.in[1] * sy] as [number, number] } : {}),
    ...(n.out ? { out: [n.out[0] * sx, n.out[1] * sy] as [number, number] } : {}),
  }))
}
