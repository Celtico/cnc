import type { PickedFile } from "../../components/pickedFiles"
import { listZip, readZipEntry } from "../../core/file/zip"
import { groupHettich, hettichCandidate, hettichFileKind, isRefKind, VIEW_KINDS, type HettichArticle, type HettichFile } from "../../core/import/hettich"
import { articleItem, pairImportedBatch, proposalPlan, proposeArticle } from "../../core/import/importItem"
import { articleFileNames, importedMatches, mergeImported } from "../../core/import/merge"
import { modelProposal, type HardwareProposal } from "../../core/import/proposal"
import { stepFeatures } from "../../core/import/stepGeometry"
import { readDxf } from "../../core/import/dxf"
import { hasMachiningLayers, machiningFromDxf, partFromFileName } from "../../core/import/dxfMachining"
import { registerStoredView, viewFromDxf, type HardwareView, type ViewName } from "../../core/import/views"
import { newId, partKindOf, type GenOp, type HardwareItem } from "../../core/model"
import { assetDocs, assetViews, getHardwareAsset, newHardwareAssetId, putHardwareAsset, type HardwareAsset } from "../../db/hardwareAssets"

/**
 * Importar ferratges d'un fabricant (Hettich) a Preferències › Ferratges: fitxers solts, carpetes i ZIP tal com es
 * baixen (els ZIP no es descomprimeixen sencers: només els fitxers dels articles triats, `readZipEntry`). La lògica és a
 * `core/import`; aquí es llegeixen els fitxers, es fa el 3D (OpenCascade, `stepMesh.ts`, a demanda) i es desa el model, les
 * vistes i els plànols a Dexie (`hardwareAssets`). Un article que ja és a la biblioteca **s'amplia** (`mergeImported`).
 */

export interface ImportSource {
  articles: HettichArticle[]
  /** Llegeix un fitxer pel camí del llistat. */
  read: (path: string) => Promise<Uint8Array>
  /** Fitxers llegits (per dir-ho). */
  fileCount: number
}

/**
 * Índex dels fitxers triats (ZIP inclosos). Els que no tenen número d'article no compten, llevat dels plànols de
 * muntatge que en nomenen algun. `known`: els articles de la biblioteca (número → carpetes), perquè un ZIP només de
 * plànols els ampliï.
 */
export async function sourceFromPicked(picked: PickedFile[], known?: ReadonlyMap<string, readonly string[]>): Promise<ImportSource> {
  const loaders = new Map<string, () => Promise<Uint8Array>>()
  const files: HettichFile[] = []
  for (const p of picked) {
    if (/\.zip$/i.test(p.path)) {
      const bytes = new Uint8Array(await p.file.arrayBuffer())
      const base = p.path.replace(/\.zip$/i, "")
      for (const e of listZip(bytes)) {
        if (e.name.endsWith("/")) continue
        const path = `${base}/${e.name}`
        if (!hettichCandidate(path)) continue
        loaders.set(path, () => readZipEntry(bytes, e))
        files.push({ path, kind: hettichFileKind(path), size: e.size })
      }
      continue
    }
    if (!hettichCandidate(p.path)) continue
    loaders.set(p.path, async () => new Uint8Array(await p.file.arrayBuffer()))
    files.push({ path: p.path, kind: hettichFileKind(p.path), size: p.file.size })
  }
  return {
    articles: groupHettich(files, known),
    fileCount: files.length,
    read: (path) => {
      const l = loaders.get(path)
      if (!l) throw new Error(`No es troba ${path}`)
      return l()
    },
  }
}

const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b)
const baseName = (p: string) => p.split("/").pop()!

export interface ImportOutcome {
  /** Els nous (no eren a la biblioteca). */
  items: HardwareItem[]
  /** Els de la biblioteca ampliats (mateix id). */
  updated: HardwareItem[]
  /** Dels ampliats, quants tenen una proposta nova per revisar (confirmats o editats: no s'han tocat). */
  pendingUpdates: number
  /** Dels ampliats, quants han rebut forats proposats nous (abans només 3D o només 2D, o sense confirmar). */
  upgraded: number
  /** Una línia per article que no s'ha pogut importar (o amb avisos). */
  problems: string[]
  /** Frontisses aparellades amb la placa del lot (només si n'hi ha una). */
  paired: number
  /** Plaques del lot (amb més d'una, les frontisses queden sense aparellar). */
  plates: number
}

/**
 * Què farà de debò un article (la nota de la fila del diàleg, «Tirador · 128 mm», «Pota · 4 forats a cada pota»): llegeix
 * el STEP i en fa la proposta (`proposeArticle`), sense el 3D. Les frontisses i les plaques no es llegeixen (la nota
 * d'abans ja ho diu); els «només 3D», tampoc.
 */
export async function analyseArticle(src: ImportSource, a: HettichArticle, throughDiameter?: number): Promise<string> {
  const step = a.files.find((f) => f.kind === "step")
  if (!step || (a.kind !== "handle" && a.kind !== "leg")) return a.plan ?? ""
  try {
    return proposalPlan(proposeArticle(a, stepFeatures(latin1(await src.read(step.path))), { ...(throughDiameter ? { throughDiameter } : {}) }))
  } catch (e) {
    return `Només 3D: ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Les vistes d'abans i les noves: per nom, la registrada guanya; les d'abans sense registrar es registren si ara hi ha forats. */
function mergeViews(old: HardwareView[], fresh: HardwareView[], holes: { u: number; v: number; d: number }[]): HardwareView[] {
  const out = new Map<string, HardwareView>()
  for (const v of old) out.set(v.name, registerStoredView(v, holes))
  for (const v of fresh) {
    const had = out.get(v.name)
    if (!had || (!had.registered && v.registered)) out.set(v.name, v)
  }
  return [...out.values()]
}

/**
 * Importa els articles triats: proposta de mecanitzats (STEP, `proposeArticle`: frontissa, placa, tirador, pota o només
 * 3D), model 3D (STEP → GLB), vistes 2D (DXF) i plànols de muntatge. Sense STEP, amb les vistes, entra «només 2D» (motor
 * `model`, sense caixa). Les frontisses parteixen de la frontissa per defecte i els tiradors del tirador per defecte
 * (`base`); si al mateix lot hi ha **una sola** placa, les frontisses s'hi aparellen (`pairImportedBatch`). Tot surt
 * **sense confirmar**. Un article que ja és a la biblioteca (`library`, per fabricant i article) **s'amplia**
 * (`mergeImported`): el model 3D si no en tenia, les vistes, els plànols, i la proposta nova sense tocar mai un mecanitzat
 * confirmat. El 3D (OpenCascade) només es fa si l'item encara no el té.
 */
export async function importArticles(
  src: ImportSource,
  articles: HettichArticle[],
  base: { hinge: HardwareItem; handle: HardwareItem },
  library: readonly HardwareItem[] = [],
  progress?: (done: number, total: number) => void,
): Promise<ImportOutcome> {
  const items: HardwareItem[] = []
  const updated: HardwareItem[] = []
  const problems: string[] = []
  let pendingUpdates = 0
  let upgraded = 0
  let mesher: typeof import("../../components/viewer/stepMesh") | null = null
  try {
    let done = 0
    for (const a of articles) {
      progress?.(done++, articles.length)
      try {
        const existing = importedMatches(library, "Hettich", a.article)
        if (a.kind === "none" && !existing.length) throw new Error(a.reason ?? "No es pot importar.")
        if (a.refsOnly && !existing.length) throw new Error("Només hi ha plànols de muntatge d'un article que no és a la biblioteca.")
        // Els assets d'abans (el model i les vistes) dels items que ja hi són.
        const oldAssets = new Map<string, HardwareAsset>()
        for (const e of existing) {
          const id = e.imported?.asset
          if (id && !oldAssets.has(id)) {
            const row = await getHardwareAsset(id)
            if (row) oldAssets.set(id, row)
          }
        }
        const notes: string[] = []
        const step = a.files.find((f) => f.kind === "step")
        let p: HardwareProposal
        let glb: Blob | undefined
        if (step) {
          const bytes = await src.read(step.path)
          p = proposeArticle(a, stepFeatures(latin1(bytes)), { throughDiameter: base.handle.params.diameter ?? 5 })
          // El 3D només si algun dels que hi ha no el té (o és nou).
          const need3d = !existing.length || existing.some((e) => !e.imported?.asset || !oldAssets.get(e.imported.asset)?.glb)
          if (need3d) {
            try {
              mesher ??= await import("../../components/viewer/stepMesh")
              glb = (await mesher.meshesToGlb(await mesher.stepMeshes(bytes), p.frame)).glb
            } catch (e) {
              notes.push(`Sense model 3D: ${e instanceof Error ? e.message : String(e)}`)
            }
          }
        } else p = modelProposal(null, [a.plan ?? "Només 2D: falta el STEP."])
        const views: HardwareView[] = []
        let points: [number, number, number][] | undefined
        for (const kind of VIEW_KINDS as ViewName[]) {
          const f = a.files.find((x) => x.kind === kind)
          if (!f) continue
          try {
            const view = viewFromDxf(kind, readDxf(latin1(await src.read(f.path))), p.holes)
            views.push(view)
            if (kind === "front" && view.points.length) points = view.points
          } catch (e) {
            notes.push(`Vista ${kind}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
        const docs: { name: string; blob: Blob }[] = []
        for (const f of a.files.filter((x) => isRefKind(x.kind))) {
          try {
            const bytes = await src.read(f.path)
            docs.push({ name: baseName(f.path), blob: new Blob([bytes.slice().buffer], { type: /\.pdf$/i.test(f.path) ? "application/pdf" : "application/dxf" }) })
          } catch (e) {
            notes.push(`${baseName(f.path)}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
        // DXF per peça amb les capes de mecanitzat del taller (`<ref>_porta.dxf`…): mecanitzats exactes, que manen sobre
        // els que s'endevinen del STEP (`dxfMachining.ts`).
        const machining: GenOp[] = []
        for (const f of a.files.filter((x) => x.kind === "other" && /\.dxf$/i.test(x.path))) {
          try {
            const drawing = readDxf(latin1(await src.read(f.path)))
            if (!hasMachiningLayers(drawing)) continue
            const part = partFromFileName(f.path)
            if (!part) {
              notes.push(`${baseName(f.path)}: no diu de quina peça és (_porta, _lateral, _tapa…): llegeix-lo a l'editor (Mecanitzats › Llegir un DXF).`)
              continue
            }
            const got = machiningFromDxf(drawing, part, `dxf${machining.length}`)
            machining.push(...got.ops)
            notes.push(`${baseName(f.path)}: ${got.ops.length} mecanitzats exactes (${partKindOf(part).label.toLowerCase()}).`, ...got.notes)
          } catch (e) {
            notes.push(`${baseName(f.path)}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
        // Amb els mecanitzats exactes d'un DXF del taller, els forats del STEP no es fan servir (es col·loca a mà).
        const fromDxf = machining.length > 0 && p.kind !== "model"
        const proposal: HardwareProposal = fromDxf
          ? { ...modelProposal(null, []), frame: p.frame, bbox: p.bbox, notes: [...p.notes, "Els forats del STEP no es fan servir: manen els mecanitzats exactes del DXF (es col·loca a mà al moble).", ...notes] }
          : { ...p, notes: [...p.notes, ...notes] }
        const withMachining = (it: HardwareItem): HardwareItem => (machining.length ? { ...it, machining } : it)
        const files = articleFileNames(a.files)
        if (!existing.length) {
          const asset = newHardwareAssetId()
          await putHardwareAsset({ id: asset, name: a.label, ...(glb ? { glb } : {}), views, ...(docs.length ? { docs } : {}), createdAt: Date.now() })
          items.push(withMachining(articleItem(proposal, a, base, { id: newId("hw"), asset, files, ...(points ? { points } : {}) })))
          continue
        }
        // Ja hi és: s'amplia cada item de l'article (un asset compartit, un sol cop).
        const written = new Map<string, string>()
        for (const e of existing) {
          const oldId = e.imported?.asset
          let asset = oldId && written.get(oldId)
          if (!asset) {
            const old = oldId ? oldAssets.get(oldId) : undefined
            asset = old?.id ?? newHardwareAssetId()
            const keepDocs = assetDocs(old)
            const names = new Set(keepDocs.map((d) => d.name))
            await putHardwareAsset({
              id: asset,
              name: old?.name ?? a.label,
              ...(old?.glb ? { glb: old.glb } : glb ? { glb } : {}),
              views: mergeViews(assetViews(old), views, p.holes),
              ...(keepDocs.length || docs.length ? { docs: [...keepDocs, ...docs.filter((d) => !names.has(d.name))] } : {}),
              createdAt: old?.createdAt ?? Date.now(),
            })
            if (oldId) written.set(oldId, asset)
          }
          const fresh = withMachining(articleItem(proposal, a, base, { id: e.id, asset, files, ...(points ? { points } : {}) }))
          const withAsset: HardwareItem = e.imported && !e.imported.asset ? { ...e, imported: { ...e.imported, asset } } : e
          const r = mergeImported(withAsset, fresh, !!step)
          if (r.pendingUpdate) pendingUpdates++
          if (r.upgraded) upgraded++
          updated.push(r.item)
        }
      } catch (e) {
        problems.push(`${a.article}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    progress?.(articles.length, articles.length)
  } finally {
    mesher?.releaseStepWorker()
  }
  // Frontisses i plaques del mateix lot (les noves): només amb una sola placa.
  return { ...pairImportedBatch(items), updated, pendingUpdates, upgraded, problems }
}
