import { evalExpr, isPendingImport, type HardwareItem, type HardwareTarget, type MachiningOp } from "../model"
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
    targets: [...doorTargets, { key: "side", label: `Lateral (${plate.name})`, ops: structuredClone(side?.ops ?? []) }],
    plate: { id: plate.id, name: plate.name, ...(plate.imported?.asset ? { asset: plate.imported.asset } : {}), ...(plate.imported?.bbox ? { bbox: plate.imported.bbox } : {}) },
  }
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

/** Per què encara no es pot confirmar (o `null`): una frontissa sense cassoleta, Ø o fondàries absurdes. */
export function confirmProblem(item: HardwareItem): string | null {
  if (!item.imported) return null
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
