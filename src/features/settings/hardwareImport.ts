import type { PickedFile } from "../../components/pickedFiles"
import { listZip, readZipEntry } from "../../core/file/zip"
import { groupHettich, hettichArticle, hettichFileKind, type HettichArticle, type HettichFile } from "../../core/import/hettich"
import { articleItem, pairImportedBatch, proposalPlan, proposeArticle } from "../../core/import/importItem"
import type { HardwareProposal } from "../../core/import/proposal"
import { stepFeatures } from "../../core/import/stepGeometry"
import { readDxf } from "../../core/import/dxf"
import { viewFromDxf, type HardwareView, type ViewName } from "../../core/import/views"
import { newId, type HardwareItem } from "../../core/model"
import { newHardwareAssetId, putHardwareAsset } from "../../db/hardwareAssets"

/**
 * Importar ferratges d'un fabricant (Hettich) a Preferències › Ferratges: fitxers solts, carpetes i ZIP tal com es
 * baixen (els ZIP no es descomprimeixen sencers: només els fitxers dels articles triats, `readZipEntry`). La lògica és a
 * `core/import`; aquí es llegeixen els fitxers, es fa el 3D (OpenCascade, `stepMesh.ts`, a demanda) i es desa el model i
 * les vistes a Dexie (`hardwareAssets`).
 */

export interface ImportSource {
  articles: HettichArticle[]
  /** Llegeix un fitxer pel camí del llistat. */
  read: (path: string) => Promise<Uint8Array>
  /** Fitxers llegits (per dir-ho). */
  fileCount: number
}

/** Índex dels fitxers triats (ZIP inclosos). Els que no tenen número d'article no compten. */
export async function sourceFromPicked(picked: PickedFile[]): Promise<ImportSource> {
  const loaders = new Map<string, () => Promise<Uint8Array>>()
  const files: HettichFile[] = []
  for (const p of picked) {
    if (/\.zip$/i.test(p.path)) {
      const bytes = new Uint8Array(await p.file.arrayBuffer())
      const base = p.path.replace(/\.zip$/i, "")
      for (const e of listZip(bytes)) {
        if (!hettichArticle(e.name)) continue
        const path = `${base}/${e.name}`
        loaders.set(path, () => readZipEntry(bytes, e))
        files.push({ path, kind: hettichFileKind(e.name), size: e.size })
      }
      continue
    }
    if (!hettichArticle(p.path)) continue
    loaders.set(p.path, async () => new Uint8Array(await p.file.arrayBuffer()))
    files.push({ path: p.path, kind: hettichFileKind(p.path), size: p.file.size })
  }
  return {
    articles: groupHettich(files),
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
  items: HardwareItem[]
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

/**
 * Importa els articles triats: proposta de mecanitzats (STEP, `proposeArticle`: frontissa, placa, tirador, pota o només
 * 3D), model 3D (STEP → GLB) i vistes 2D (DXF). Les frontisses parteixen de la frontissa per defecte i els tiradors del
 * tirador per defecte (`base`: el marge, el cantell i el Ø del forat passant); si al mateix lot hi ha **una sola** placa,
 * les frontisses s'hi aparellen (`pairImportedBatch`; amb més d'una, a l'editor). Tot surt **sense confirmar**.
 */
export async function importArticles(src: ImportSource, articles: HettichArticle[], base: { hinge: HardwareItem; handle: HardwareItem }, progress?: (done: number, total: number) => void): Promise<ImportOutcome> {
  const items: HardwareItem[] = []
  const problems: string[] = []
  const { stepMeshes, meshesToGlb, releaseStepWorker } = await import("../../components/viewer/stepMesh")
  try {
    let done = 0
    for (const a of articles) {
      progress?.(done++, articles.length)
      try {
        const step = a.files.find((f) => f.kind === "step")
        if (!step || a.kind === "none") throw new Error(a.reason ?? "No es pot importar.")
        const bytes = await src.read(step.path)
        const features = stepFeatures(latin1(bytes))
        const p = proposeArticle(a, features, { throughDiameter: base.handle.params.diameter ?? 5 })
        const notes: string[] = []
        let glb: Blob | undefined
        try {
          glb = (await meshesToGlb(await stepMeshes(bytes), p.frame)).glb
        } catch (e) {
          notes.push(`Sense model 3D: ${e instanceof Error ? e.message : String(e)}`)
        }
        const views: HardwareView[] = []
        let points: [number, number, number][] | undefined
        for (const kind of ["front", "side", "top"] as ViewName[]) {
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
        const asset = newHardwareAssetId()
        await putHardwareAsset({ id: asset, name: a.label, ...(glb ? { glb } : {}), views, createdAt: Date.now() })
        const proposal: HardwareProposal = { ...p, notes: [...p.notes, ...notes] }
        const extras = { id: newId("hw"), asset, files: a.files.map((f) => baseName(f.path)), ...(points ? { points } : {}) }
        items.push(articleItem(proposal, a, base, extras))
      } catch (e) {
        problems.push(`${a.article}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    progress?.(articles.length, articles.length)
  } finally {
    releaseStepWorker()
  }
  // Frontisses i plaques del mateix lot: només amb una sola placa.
  return { ...pairImportedBatch(items), problems }
}
