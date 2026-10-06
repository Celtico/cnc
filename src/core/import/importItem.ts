import { deepEqual, evalExpr, isDamagedImport, isPendingImport, type HardwareItem, type HardwareTarget, type MachiningOp } from "../model"
import type { HettichArticle } from "./hettich"
import { modelProposal, proposeHandle, proposeHinge, proposeLeg, proposePlate, type HardwareProposal } from "./proposal"
import type { StepFeatures } from "./stepGeometry"

/**
 * D'una proposta (`proposal.ts`) a un item de la biblioteca (`HardwareItem`), **sense confirmar**: una frontissa fa servir
 * el motor de cassoleta de sempre (`cup`: quantitat per alçada, a la filera System 32, `cupOffset` del cantell) amb els
 * forats del fitxer al voltant de la cassoleta; una placa, el motor `plate` (forats al lateral des de la seva referència).
 * Pur.
 */

const num = (x: number) => Math.round(x * 100) / 100
/** `cupOffset+5.5` / `cupOffset-3` / `cupOffset`: la v d'un forat de la porta des del centre de la cassoleta. */
export const cupRel = (dv: number): string => (Math.abs(dv) < 0.005 ? "cupOffset" : `cupOffset${dv > 0 ? "+" : "-"}${num(Math.abs(dv))}`)

/** La v d'un forat de la porta relativa al centre de la cassoleta (avaluant `cupOffset` = 0). */
export function relV(op: MachiningOp): number {
  if (op.kind === "edgeDrill") return 0
  try {
    return evalExpr(op.v, { cupOffset: 0 })
  } catch {
    return NaN
  }
}

export interface ImportedExtras {
  id: string
  asset?: string
  points?: [number, number, number][]
  files: string[]
}

/** Una caixa buida (sense STEP: només les vistes DXF) no es desa. */
const emptyBox = (b: HardwareProposal["bbox"]) => [...b.min, ...b.max].every((v) => v === 0)

function source(art: HettichArticle, p: HardwareProposal, targets: HardwareTarget[], x: ImportedExtras): NonNullable<HardwareItem["imported"]> {
  return {
    maker: "Hettich",
    article: art.article,
    folders: art.folders,
    files: x.files,
    ...(x.asset ? { asset: x.asset } : {}),
    ...(emptyBox(p.bbox) ? {} : { bbox: p.bbox }),
    ...(x.points?.length ? { points: x.points } : {}),
    proposed: structuredClone(targets),
    notes: p.notes,
    confirmed: false,
  }
}

/** Frontissa importada: parteix de la frontissa per defecte (quantitat per alçada, extrems, separació, `cupOffset`). */
export function hingeItem(p: HardwareProposal, art: HettichArticle, base: HardwareItem, x: ImportedExtras): HardwareItem {
  const [cup, ...rest] = p.holes
  const ops: MachiningOp[] = [
    { kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" },
    ...rest.map((h): MachiningOp => ({ kind: "drill", face: "A", u: h.u, v: cupRel(h.v), d: h.d, depth: h.depth, tag: h.role === "dowel" ? "hinge-dowel" : "hinge-screw" })),
  ]
  const targets: HardwareTarget[] = [{ key: "door", label: "Porta", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "hinge",
    engine: "cup",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: "Hettich",
    ref: art.article,
    params: { ...base.params, cupDiameter: cup?.d ?? base.params.cupDiameter ?? 35, cupDepth: cup?.depth ?? base.params.cupDepth ?? 13 },
    ...(base.count ? { count: structuredClone(base.count) } : {}),
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/** Placa de muntatge importada (37 mm del davant, a l'alçada de la cassoleta). */
export function plateItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const ops: MachiningOp[] = p.holes.map((h) => ({ kind: "drill", face: "A", u: h.u, v: h.v, d: h.d, depth: h.depth, tag: "plate" }))
  const targets: HardwareTarget[] = [{ key: "side", label: "Lateral", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "plate",
    engine: "plate",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: "Hettich",
    ref: art.article,
    params: { setback: 37, offset: 0 },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * Tirador importat: el motor del tirador de sempre (`barHandle`: centrat als calaixos, a `inset` del cantell que obre a
 * les portes i abatibles, avís si no hi cap) amb la **distància del fitxer** (`pitch` sense graons: la mateixa a tots els
 * fronts) i el Ø del forat passant (`diameter`). Un pom (un sol forat): un forat al centre, `pitch` 0. El marge i el
 * cantell, del tirador de l'app (`base`).
 */
export function handleItem(p: HardwareProposal, art: HettichArticle, base: HardwareItem, x: ImportedExtras): HardwareItem {
  const two = p.holes.length === 2
  const dist = two ? Math.abs(p.holes[1]!.u - p.holes[0]!.u) : 0
  const ops: MachiningOp[] = two
    ? [
        { kind: "through", u: "-pitch/2", v: 0, d: "diameter", tag: "handle" },
        { kind: "through", u: "pitch/2", v: 0, d: "diameter", tag: "handle" },
      ]
    : [{ kind: "through", u: 0, v: 0, d: "diameter", tag: "handle" }]
  const targets: HardwareTarget[] = [{ key: "front", label: "Front", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "handle",
    engine: "barHandle",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: "Hettich",
    ref: art.article,
    params: { margin: base.params.margin ?? 3, inset: base.params.inset ?? 40, diameter: p.holes[0]?.d ?? base.params.diameter ?? 5 },
    pitch: { steps: [], else: num(dist) },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/** Pota importada: els forats de la placa a la cara de sota de la base, a 50 mm dels cantells del mòdul. */
export function legItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const ops: MachiningOp[] = p.holes.map((h) => ({ kind: "drill", face: "A", u: h.u, v: h.v, d: h.d, depth: h.depth, tag: "leg" }))
  const targets: HardwareTarget[] = [{ key: "base", label: "Base (cara de sota)", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "leg",
    engine: "leg",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: "Hettich",
    ref: art.article,
    params: { inset: 50 },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * «Només 3D» (motor `model`): el model i el volum del fitxer, **cap forat** (no hi ha cap regla de mecanitzat per a
 * aquesta família, o no s'ha trobat el patró): es veu a l'editor i se'n pot baixar el GLB. No es confirma mai (no hi ha
 * res a revisar: no fa cap forat ni es pot triar a cap lloc del moble).
 */
export function modelItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const targets: HardwareTarget[] = [{ key: "model", label: "Només 3D", ops: [] }]
  return {
    id: x.id,
    name: art.label,
    category: art.category,
    engine: "model",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: "Hettich",
    ref: art.article,
    params: {},
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * Aparella una placa a una frontissa: en copia els forats (target `side`), on va (`plateSetback`, `plateOffset`) i el
 * model. Sense placa (`null`), la frontissa no fa forats al lateral (la filera System 32 la sosté, com les d'inici).
 */
export function pairPlate(hinge: HardwareItem, plate: HardwareItem | null): HardwareItem {
  const { plate: _old, ...base } = hinge
  // Canvia els forats: un importat torna a quedar sense confirmar.
  const rest = base.imported ? { ...base, imported: { ...base.imported, confirmed: false } } : base
  const doorTargets = hinge.targets.filter((t) => t.key !== "side")
  const { plateSetback: _s, plateOffset: _o, ...params } = hinge.params
  if (!plate) return { ...rest, params, targets: doorTargets }
  const side = plate.targets.find((t) => t.key === "side")
  return {
    ...rest,
    params: { ...params, plateSetback: plate.params.setback ?? 37, plateOffset: plate.params.offset ?? 0 },
    targets: [...doorTargets, { key: "side", label: "Lateral (placa)", ops: structuredClone(side?.ops ?? []) }],
    plate: { id: plate.id, name: plate.name, ...(plate.imported?.asset ? { asset: plate.imported.asset } : {}), ...(plate.imported?.bbox ? { bbox: plate.imported.bbox } : {}) },
  }
}

/**
 * La placa aparellada es guarda **per referència** (`plate.id`) i la frontissa en porta una **instantània** (el target
 * `side`, com les còpies dels mòduls): cada cop que canvia la biblioteca, les frontisses agafen els forats i el model de la
 * placa d'ara. Si canvien, la frontissa torna a quedar sense confirmar (els forats que es van revisar ja no són aquests).
 * Una placa que ja no hi és deixa la instantània com estava (els mobles fets la porten igual). Torna la mateixa llista si
 * no canvia res.
 */
export function syncPairedPlates(library: readonly HardwareItem[]): HardwareItem[] {
  let changed = false
  const out = library.map((h) => {
    if (h.engine !== "cup" || !h.plate) return h
    const plate = library.find((x) => x.id === h.plate!.id && x.engine === "plate")
    if (!plate) return h
    const want = plate.targets.find((t) => t.key === "side")?.ops ?? []
    const have = h.targets.find((t) => t.key === "side")?.ops ?? []
    const meta = { id: plate.id, name: plate.name, ...(plate.imported?.asset ? { asset: plate.imported.asset } : {}), ...(plate.imported?.bbox ? { bbox: plate.imported.bbox } : {}) }
    const holesChanged = !deepEqual(want, have)
    if (!holesChanged && deepEqual(meta, h.plate)) return h
    changed = true
    const targets = holesChanged ? [...h.targets.filter((t) => t.key !== "side"), { key: "side", label: "Lateral (placa)", ops: structuredClone(want) }] : h.targets
    const imported = holesChanged && h.imported ? { ...h.imported, confirmed: false } : h.imported
    return { ...h, targets, plate: meta, ...(imported ? { imported } : {}) }
  })
  return changed ? out : (library as HardwareItem[])
}

/** Paràmetres d'una frontissa importada que canvien els forats revisats (Ø i fondària de la cassoleta, on va la placa). */
export const IMPORTED_HOLE_PARAMS: readonly string[] = ["cupDiameter", "cupDepth", "plateSetback", "plateOffset"]

/** Els paràmetres que canvien els forats revisats, per motor: la cassoleta i la placa, el Ø del tirador, on van les potes. */
export const IMPORTED_HOLE_PARAMS_BY_ENGINE: Partial<Record<HardwareItem["engine"], readonly string[]>> = {
  cup: IMPORTED_HOLE_PARAMS,
  barHandle: ["diameter"],
  leg: ["inset"],
}

/** Canvia un paràmetre; si és d'un importat i canvia els forats (`IMPORTED_HOLE_PARAMS_BY_ENGINE`), el deixa sense confirmar. */
export function setHardwareParam(item: HardwareItem, key: string, value: number): HardwareItem {
  if (item.params[key] === value) return item
  const next = { ...item, params: { ...item.params, [key]: value } }
  return item.imported?.confirmed && (IMPORTED_HOLE_PARAMS_BY_ENGINE[item.engine] ?? []).includes(key) ? setConfirmed(next, false) : next
}

/** Canvia la distància entre forats d'un tirador importat (`pitch` sense graons); el deixa sense confirmar. */
export function setHandleDistance(item: HardwareItem, dist: number): HardwareItem {
  if (!(dist >= 0) || item.pitch?.else === dist) return item
  const next = { ...item, pitch: { steps: [], else: dist } }
  return item.imported ? setConfirmed(next, false) : next
}

/**
 * Frontisses i plaques importades al mateix lot: si hi ha **una sola** placa, totes les frontisses s'hi aparellen; amb
 * més d'una no se'n tria cap (quina va amb quina ho decideix l'usuari a l'editor) i `plates` ho diu.
 */
export function pairImportedBatch(items: readonly HardwareItem[]): { items: HardwareItem[]; paired: number; plates: number } {
  const plates = items.filter((x) => x.engine === "plate")
  const plate = plates.length === 1 ? plates[0]! : null
  let paired = 0
  const out = items.map((x) => {
    if (x.engine !== "cup" || !plate) return x
    paired++
    return pairPlate(x, plate)
  })
  return { items: out, paired, plates: plates.length }
}

/** Confirma (o desfà la confirmació d') un importat. */
export function setConfirmed(item: HardwareItem, confirmed: boolean): HardwareItem {
  if (!item.imported) return item
  return { ...item, imported: { ...item.imported, confirmed } }
}

/** Torna els mecanitzats als proposats en importar (sense confirmar). La placa aparellada es manté. */
export function restoreProposal(item: HardwareItem): HardwareItem {
  if (!item.imported) return item
  const side = item.targets.filter((t) => t.key === "side" && item.plate)
  return { ...item, targets: [...structuredClone(item.imported.proposed), ...side], imported: { ...item.imported, confirmed: false } }
}

/**
 * Per què encara no es pot confirmar (o `null`): malmès, una frontissa sense cassoleta, una placa sense forats, Ø o
 * fondàries absurdes, o una frontissa amb una placa (de la biblioteca `library`) que encara no està confirmada.
 */
export function confirmProblem(item: HardwareItem, library: readonly HardwareItem[] = []): string | null {
  if (!item.imported) return null
  if (isDamagedImport(item)) return "Està malmès (no s'ha pogut llegir sencer): torna'l a importar."
  if (item.engine === "model") return "És només 3D: no fa cap forat (no cal confirmar-lo)."
  if (item.engine === "plate" && !item.targets.find((t) => t.key === "side")?.ops.length) return "La placa no té cap forat: entra'ls a mà (Mecanitzats)."
  if (item.engine === "leg" && !item.targets.find((t) => t.key === "base")?.ops.length) return "La pota no té cap forat: entra'ls a mà (Mecanitzats)."
  if (item.engine === "barHandle") {
    const n = item.targets.find((t) => t.key === "front")?.ops.length ?? 0
    if (!n) return "El tirador no té cap forat."
    const dist = item.pitch?.else ?? NaN
    if (n === 2 && !(dist >= 16 && dist <= 2000)) return `Distància entre forats de ${dist} mm: entra-la a «Distància entre forats».`
  }
  if (item.engine === "cup" && item.plate) {
    const plate = library.find((x) => x.id === item.plate!.id && x.engine === "plate")
    if (plate && (isPendingImport(plate) || isDamagedImport(plate))) return `La placa «${plate.name}» encara no està confirmada: confirma-la primer.`
  }
  for (const t of item.targets)
    for (const op of t.ops) {
      if (op.kind === "edgeDrill") continue
      const vars = { ...item.params, pitch: item.pitch?.else ?? 0 }
      try {
        const d = evalExpr(op.d, vars)
        if (!(d >= 1 && d <= 60)) return `${t.label}: un forat de Ø${d}.`
        if (op.kind === "drill") {
          const depth = evalExpr(op.depth, vars)
          if (!(depth > 0 && depth <= 40)) return `${t.label}: un forat de ${depth} mm de fondària.`
        }
      } catch (e) {
        return `${t.label}: ${e instanceof Error ? e.message : String(e)}`
      }
    }
  if (item.engine === "cup" && !item.targets.find((t) => t.key === "door")?.ops.length) return "La frontissa no té cap forat a la porta."
  return null
}

export { isPendingImport }

/**
 * La proposta d'un article segons què és (`HettichArticle.kind`): frontissa, placa, tirador o pota; si no s'hi troba el
 * patró (o la família no té regla), **només 3D** (`kind: "model"`) amb el perquè a les notes. Pur.
 */
export function proposeArticle(a: Pick<HettichArticle, "kind" | "plan">, f: StepFeatures, opts: { throughDiameter?: number } = {}): HardwareProposal {
  const p =
    a.kind === "hinge" ? proposeHinge(f)
    : a.kind === "plate" ? proposePlate(f)
    : a.kind === "handle" ? proposeHandle(f, opts)
    : a.kind === "leg" ? proposeLeg(f)
    : null
  if (!p) return modelProposal(f, [a.plan ?? "Només 3D: sense forats."])
  if ("error" in p) return modelProposal(f, [`${p.error} S'importa només el model 3D (sense forats).`])
  return p
}

/**
 * Els números que fan els forats de la proposta i no són als mecanitzats (que en diuen el nom): Ø i fondària de la
 * cassoleta, Ø i distància (`pitch`) del tirador. On va la placa o la pota (`plateSetback`, `inset`) no surten del fitxer.
 */
export function holeParams(item: HardwareItem): Record<string, number> {
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => item.params[k] !== undefined).map((k) => [k, item.params[k]!]))
  if (item.engine === "cup") return pick(["cupDiameter", "cupDepth"])
  if (item.engine === "barHandle") return { ...pick(["diameter"]), pitch: item.pitch?.else ?? 0 }
  return {}
}

/** L'item de la biblioteca d'una proposta (`proposeArticle`), sense confirmar. */
export function articleItem(p: HardwareProposal, a: HettichArticle, base: { hinge: HardwareItem; handle: HardwareItem }, x: ImportedExtras): HardwareItem {
  const item =
    p.kind === "hinge" ? hingeItem(p, a, base.hinge, x)
    : p.kind === "plate" ? plateItem(p, a, x)
    : p.kind === "handle" ? handleItem(p, a, base.handle, x)
    : p.kind === "leg" ? legItem(p, a, x)
    : modelItem(p, a, x)
  const params = holeParams(item)
  return Object.keys(params).length && item.imported ? { ...item, imported: { ...item.imported, proposedParams: params } } : item
}

/** La nota de la fila del diàleg d'importar un cop llegit el STEP: què farà de debò («Tirador · 128 mm»). */
export function proposalPlan(p: HardwareProposal): string {
  const n = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",")
  const holes = (k: number) => `${k} forat${k === 1 ? "" : "s"}`
  switch (p.kind) {
    case "hinge":
      return `Frontissa · cassoleta Ø${n(p.holes[0]?.d ?? 0)}${p.holes.length > 1 ? ` i ${holes(p.holes.length - 1)}` : ""}`
    case "plate":
      return p.holes.length ? `Placa · ${holes(p.holes.length)}` : "Placa ambigua: sense forats (entra'ls a mà)"
    case "handle":
      return p.holes.length === 2 ? `Tirador · ${n(Math.abs(p.holes[1]!.u - p.holes[0]!.u))} mm` : "Pom · 1 forat"
    case "leg":
      return `Pota · ${holes(p.holes.length)} a cada pota`
    case "model":
      if (p.notes[0] && /^Només 3D/.test(p.notes[0])) return p.notes[0]
      return `Només 3D: sense forats${p.notes[0] ? ` (${p.notes[0].replace(/ S'importa només.*$/, "").replace(/\.$/, "")})` : ""}`
  }
}
