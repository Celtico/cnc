import { deepEqual, isDamagedImport, type HardwareItem, type HardwareTarget } from "../model"
import { isRefKind, VIEW_KINDS, type HettichArticle, type HettichFile } from "./hettich"
import { importFileKind, makerOf } from "./makers"
import { holeParams } from "./importItem"

/**
 * **Tornar a importar un article que ja és a la biblioteca l'amplia** (no en fa un de repetit): la clau és (fabricant,
 * article). Un STEP hi afegeix el 3D, la caixa i la proposta de forats si no en tenia (un article que només tenia les
 * vistes DXF passa de «només 2D» a frontissa, tirador…); un DWG/DXF, les vistes 2D i els punts de connexió; els plànols
 * de muntatge s'hi adjunten. **Mai es toca un mecanitzat confirmat**: si els fitxers nous donen una altra proposta, es
 * desa a part (`imported.update`) i l'editor ho diu («hi ha una proposta nova: revisar»); aplicar-la el deixa sense
 * confirmar. Pur (el 3D i les vistes, a Dexie, els fa `features/settings/hardwareImport.ts`).
 */

/** Els items de la biblioteca que són aquest article (també les còpies que n'hagi fet l'usuari). */
export function importedMatches(library: readonly HardwareItem[], maker: string, article: string): HardwareItem[] {
  return library.filter((x) => x.imported && x.imported.maker === maker && x.imported.article === article)
}

/** Què hi ha als fitxers d'un item (pels noms desats a `imported.files`). */
function kindsOf(item: HardwareItem): Set<string> {
  return new Set((item.imported?.files ?? []).map((n) => importFileKind(n)))
}

export interface MergePreview {
  /** Els items que s'ampliaran. */
  items: HardwareItem[]
  /** Què s'hi afegeix («3D i forats», «vistes 2D», «plànols de muntatge»), buit si res de nou. */
  adds: string[]
}

/** Quan es torna a importar un article: els items que ja hi són i què s'hi afegirà (la fila del diàleg). `null` = nou. */
export function mergePreview(library: readonly HardwareItem[], a: Pick<HettichArticle, "article" | "kind" | "files" | "maker">): MergePreview | null {
  const items = importedMatches(library, makerOf(a), a.article)
  if (!items.length) return null
  if (items.some(isDamagedImport)) return { items, adds: ["es torna a llegir (estava malmès)"] }
  const have = new Set<string>()
  const names = new Set<string>()
  for (const it of items) {
    for (const k of kindsOf(it)) have.add(k)
    for (const n of it.imported?.files ?? []) names.add(n)
  }
  const adds: string[] = []
  const kinds = new Set(a.files.map((f) => f.kind))
  const holes = a.kind === "hinge" || a.kind === "plate" || a.kind === "handle" || a.kind === "leg"
  const D3 = ["step", "iges", "3ds", "dae"] as const
  if (kinds.has("step") && !have.has("step")) adds.push(holes ? "3D i forats proposats" : "3D")
  else if (D3.some((k) => kinds.has(k)) && !D3.some((k) => have.has(k))) adds.push("3D")
  if (VIEW_KINDS.some((k) => kinds.has(k) && !have.has(k))) adds.push("vistes 2D")
  const base = (p: string) => p.split("/").pop()!.trim()
  if (a.files.some((f) => isRefKind(f.kind) && !names.has(base(f.path)))) adds.push("plànols de muntatge")
  // Un DXF del taller per peça (`<art>_porta.dxf`) amb capes de mecanitzat: mecanitzats exactes (si en porta).
  if (a.files.some((f) => f.kind === "other" && /\.dxf$/i.test(f.path) && !names.has(base(f.path)))) adds.push("mecanitzats del DXF del taller")
  // Un programa Xilog (Blum): mecanitzats exactes.
  if (a.files.some((f) => f.kind === "pgm" && !names.has(base(f.path)))) adds.push("mecanitzats exactes (Xilog)")
  return { items, adds }
}

/** «ja existeix · s'hi afegeix: 3D i forats proposats i vistes 2D» (o «res de nou»). */
export function mergeText(m: MergePreview): string {
  if (!m.adds.length) return "Ja existeix · res de nou"
  const list = m.adds.length > 1 ? `${m.adds.slice(0, -1).join(", ")} i ${m.adds.at(-1)}` : m.adds[0]!
  return `Ja existeix · s'hi afegeix: ${list}`
}

/** Els mecanitzats que són de la proposta (sense els de la placa aparellada, que són de la placa). */
const ownTargets = (item: HardwareItem): HardwareTarget[] => item.targets.filter((t) => !(item.engine === "cup" && item.plate && t.key === "side"))

/** Els números dels forats de la proposta d'un item (els desats o, si és d'abans, els d'ara). */
const proposalParams = (item: HardwareItem) => item.imported?.proposedParams ?? holeParams(item)

/** L'item té els forats i els números de la seva proposta (no s'han editat). */
export function isUnedited(item: HardwareItem): boolean {
  return !!item.imported && deepEqual(ownTargets(item), item.imported.proposed) && deepEqual(holeParams(item), proposalParams(item))
}

/** Els mecanitzats, els números i la caixa d'una proposta nova aplicats a un item (sense confirmar). */
function withProposal(item: HardwareItem, targets: HardwareTarget[], params: Record<string, number>, notes: string[], bbox: NonNullable<HardwareItem["imported"]>["bbox"]): HardwareItem {
  const { pitch, ...rest } = params
  const side = item.targets.filter((t) => item.engine === "cup" && item.plate && t.key === "side")
  const { update: _u, ...imported } = item.imported!
  return {
    ...item,
    params: { ...item.params, ...rest },
    ...(item.engine === "barHandle" && pitch !== undefined ? { pitch: { steps: [], else: pitch } } : {}),
    targets: [...structuredClone(targets), ...side],
    imported: { ...imported, proposed: structuredClone(targets), proposedParams: params, notes, ...(bbox ? { bbox } : {}), confirmed: false },
  }
}

/** Aplica la proposta nova pendent (`imported.update`): els forats nous, **sense confirmar**. */
export function applyImportUpdate(item: HardwareItem): HardwareItem {
  const u = item.imported?.update
  if (!u) return item
  // Només uns mecanitzats nous del generador: els forats d'ara (encara que s'hagin editat) es queden.
  const holes = !deepEqual(u.targets, item.imported!.proposed) || !deepEqual(u.params, proposalParams(item))
  const { update: _u, ...imported } = item.imported!
  const next = holes ? withProposal(item, u.targets, u.params, u.notes, u.bbox ?? item.imported!.bbox) : { ...item, imported: { ...imported, confirmed: false } }
  return u.machining ? { ...next, machining: structuredClone(u.machining) } : next
}

/** Descarta la proposta nova pendent (l'item es queda com era). */
export function dismissImportUpdate(item: HardwareItem): HardwareItem {
  if (!item.imported?.update) return item
  const { update: _u, ...imported } = item.imported
  return { ...item, imported }
}

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])]

export interface MergeResult {
  item: HardwareItem
  /** La proposta nova s'ha desat a part (`imported.update`): l'item és confirmat o se n'han editat els forats. */
  pendingUpdate: boolean
  /** Ha passat de «només 3D»/«només 2D» a un ferratge amb forats proposats, o se n'han canviat els forats (sense confirmar). */
  upgraded: boolean
}

/**
 * Amplia un item de la biblioteca amb un de nou del mateix article (`fresh`, fet amb `articleItem` dels fitxers nous):
 * - fitxers, punts de connexió i caixa (si no en tenia) s'hi afegeixen; l'id, el nom i el model (asset) es queden;
 * - `withStep` (els fitxers nous porten STEP) i la proposta és una altra:
 *   - un «només 3D» (o «només 2D», sense STEP) agafa la nova sencera (motor, categoria, forats, números), sense confirmar;
 *   - sense confirmar i sense editar, els forats nous (sense confirmar);
 *   - confirmat o editat, **no es toca**: la proposta nova va a `imported.update` per revisar-la;
 *   - si la nova no troba el patró (només 3D) i l'item en té, no es toca;
 * - un item malmès es torna a fer amb el nou (mateix id i nom, sense confirmar).
 */
export function mergeImported(existing: HardwareItem, fresh: HardwareItem, withStep: boolean): MergeResult {
  return mergeMachining(mergeProposal(existing, fresh, withStep), existing, fresh)
}

/**
 * Els mecanitzats del generador (`machining`, p. ex. de les capes d'un DXF del taller) com una font més: un item sense
 * confirmar i sense mecanitzats els rep; si n'ha de canviar uns que ja hi són, o l'item està confirmat, **no es toquen**:
 * van a la proposta pendent (`imported.update.machining`). Sense mecanitzats nous, es queden els que hi havia.
 */
function mergeMachining(r: MergeResult, existing: HardwareItem, fresh: HardwareItem): MergeResult {
  if (isDamagedImport(existing) || !r.item.imported) return r
  const had = existing.machining
  const nm = fresh.machining
  // Es queden els d'abans (la proposta nova sencera d'un «només 3D» no els porta).
  const keepOld = (it: HardwareItem): HardwareItem => {
    const { machining: _m, ...rest } = it
    return had?.length ? { ...rest, machining: had } : rest
  }
  if (!nm?.length || deepEqual(nm, had)) return { ...r, item: keepOld(r.item) }
  const ex = existing.imported!
  if (!ex.confirmed && !had?.length) return { item: { ...r.item, machining: structuredClone(nm), imported: { ...r.item.imported, confirmed: false } }, pendingUpdate: r.pendingUpdate, upgraded: true }
  const cur = r.item.imported
  const update = cur.update ?? { targets: structuredClone(ex.proposed), params: proposalParams(existing), notes: fresh.imported?.notes ?? [] }
  return { item: { ...keepOld(r.item), imported: { ...cur, update: { ...update, machining: structuredClone(nm) } } }, pendingUpdate: true, upgraded: r.upgraded }
}

function mergeProposal(existing: HardwareItem, fresh: HardwareItem, withStep: boolean): MergeResult {
  const ex = existing.imported
  const nw = fresh.imported
  if (!ex || !nw) return { item: existing, pendingUpdate: false, upgraded: false }
  if (isDamagedImport(existing)) return { item: { ...fresh, id: existing.id, name: existing.name, imported: { ...nw, ...(ex.asset ? { asset: ex.asset } : {}) } }, pendingUpdate: false, upgraded: true }
  const files = union(ex.files, nw.files)
  const meta = { ...ex, files, ...(!ex.points?.length && nw.points?.length ? { points: nw.points } : {}) }
  const keep = (imported: NonNullable<HardwareItem["imported"]>): MergeResult => ({ item: { ...existing, imported }, pendingUpdate: false, upgraded: false })
  if (!withStep) return keep(meta)
  // Sense forats encara (només 3D o només 2D): la proposta nova sencera (un «només 3D» confirmat porta mecanitzats del
  // generador: no es toca).
  if (existing.engine === "model" && ex.confirmed) return keep(meta)
  if (existing.engine === "model") {
    if (fresh.engine === "model" && ex.bbox) return keep(meta)
    const { plate: _p, ...rest } = fresh
    return {
      item: { ...rest, id: existing.id, name: existing.name, ...(existing.maker ? { maker: existing.maker } : {}), ...(existing.ref ? { ref: existing.ref } : {}), imported: { ...nw, files, ...(ex.asset ? { asset: ex.asset } : {}), ...(meta.points ? { points: meta.points } : {}), confirmed: false } },
      pendingUpdate: false,
      upgraded: fresh.engine !== "model",
    }
  }
  const bbox = ex.bbox ?? nw.bbox
  const base = { ...meta, ...(bbox ? { bbox } : {}) }
  // La nova no troba el patró, o és d'un altre tipus: es queda la que hi ha.
  if (fresh.engine !== existing.engine) return keep(base)
  const newTargets = nw.proposed
  const newParams = nw.proposedParams ?? holeParams(fresh)
  if (deepEqual(newTargets, ex.proposed) && deepEqual(newParams, proposalParams(existing))) {
    // La mateixa proposta: res a revisar (una proposta pendent d'abans ja no cal si és aquesta).
    const { update: _u, ...clean } = base
    return keep(ex.update && deepEqual(ex.update.targets, newTargets) ? clean : base)
  }
  const notes = nw.notes ?? []
  if (!ex.confirmed && isUnedited(existing)) {
    return { item: withProposal({ ...existing, imported: base }, newTargets, newParams, notes, nw.bbox ?? bbox), pendingUpdate: false, upgraded: true }
  }
  return { ...keep({ ...base, update: { targets: structuredClone(newTargets), params: newParams, notes, ...(nw.bbox ? { bbox: nw.bbox } : {}) } }), pendingUpdate: true }
}

/** Els fitxers d'un article que s'afegeixen a l'item (els noms, com `imported.files`). */
export const articleFileNames = (files: readonly HettichFile[]) => files.map((f) => f.path.split("/").pop()!.trim())
