import { deepEqual } from "./photoUpgrade"
import { evalExpr } from "./expr"
import { isDamagedImport, isPendingImport, type HardwareItem, type MachiningOp } from "./hardware"
import { machiningProblems } from "./hardwareOps"

/**
 * Operacions pures sobre un item de la biblioteca de ferratges (Preferències › Ferratges): aparellar plaques, canviar
 * paràmetres, confirmar els importats. Les fa servir l'editor de ferratges, el muntatge i l'assistent; no depenen de la
 * importació del fabricant (`core/import`, adormida).
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
const IMPORTED_HOLE_PARAMS: readonly string[] = ["cupDiameter", "cupDepth", "plateSetback", "plateOffset"]

/** Els paràmetres que canvien els forats revisats, per motor: la cassoleta i la placa, el Ø del tirador, on van les potes. */
const IMPORTED_HOLE_PARAMS_BY_ENGINE: Partial<Record<HardwareItem["engine"], readonly string[]>> = {
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
  // Generador de mecanitzats: una operació dolenta no es confirma (mai faria cap forat).
  const gen = machiningProblems(item.machining ?? [])
  if (gen.length) return `Mecanitzats: ${gen[0]!.message}`
  if (item.engine === "model" && item.machining?.some((o) => o.part === "any")) return "Hi ha mecanitzats sense assignar: tria a quina peça van (Generador de mecanitzats › Peça «Sense assignar» › Assignar a)."
  if (item.engine === "model" && !item.machining?.length) return "És només 3D: no fa cap forat (no cal confirmar-lo). Si hi afegeixes mecanitzats (generador), s'haurà de confirmar."
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
