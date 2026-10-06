import { deepEqual, evalExpr, isDamagedImport, isPendingImport, type HardwareItem, type HardwareTarget, type MachiningOp } from "../model"
import type { HettichArticle } from "./hettich"
import type { HardwareProposal } from "./proposal"

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

function source(art: HettichArticle, p: HardwareProposal, targets: HardwareTarget[], x: ImportedExtras): NonNullable<HardwareItem["imported"]> {
  return {
    maker: "Hettich",
    article: art.article,
    folders: art.folders,
    files: x.files,
    ...(x.asset ? { asset: x.asset } : {}),
    bbox: p.bbox,
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

/** Canvia un paràmetre; si és d'un importat i canvia els forats (`IMPORTED_HOLE_PARAMS`), el deixa sense confirmar. */
export function setHardwareParam(item: HardwareItem, key: string, value: number): HardwareItem {
  if (item.params[key] === value) return item
  const next = { ...item, params: { ...item.params, [key]: value } }
  return item.imported?.confirmed && IMPORTED_HOLE_PARAMS.includes(key) ? setConfirmed(next, false) : next
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
  if (item.engine === "plate" && !item.targets.find((t) => t.key === "side")?.ops.length) return "La placa no té cap forat: entra'ls a mà (Mecanitzats)."
  if (item.engine === "cup" && item.plate) {
    const plate = library.find((x) => x.id === item.plate!.id && x.engine === "plate")
    if (plate && (isPendingImport(plate) || isDamagedImport(plate))) return `La placa «${plate.name}» encara no està confirmada: confirma-la primer.`
  }
  for (const t of item.targets)
    for (const op of t.ops) {
      if (op.kind === "edgeDrill") continue
      const vars = { ...item.params }
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
