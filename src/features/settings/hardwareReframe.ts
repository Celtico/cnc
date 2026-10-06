import { applyProposal, retargetImported } from "../../core/import/importItem"
import { composeFrames, frameFromMesh, type MeshLike } from "../../core/import/meshFrame"
import { meshesFrameBox, type HardwareProposal, type LocalFrame } from "../../core/import/proposal"
import type { HardwareEngine, HardwareItem } from "../../core/model"
import { getHardwareAsset, putHardwareAsset } from "../../db/hardwareAssets"
import { forgetModel } from "../../components/viewer/models3d"

/**
 * **Canviar «què és» un ferratge importat** amb el model 3D al seu lloc: l'item passa al motor triat
 * (`retargetImported`) i, si el tipus té un marc de muntatge (frontissa, placa, tirador, pota), s'**estima de la malla
 * del GLB desat** (`meshFrame.ts`: la cassoleta, la cara de muntatge i els forats) i el GLB es **refà en aquest marc**
 * (la mateixa transformació que es fa en importar, `meshesToGlb`), amb la caixa i els forats proposats; així el 3D
 * entra tal com es veuria col·locat. Si no se'n treu cap patró, l'item canvia igualment (amb els números per defecte)
 * i el model es queda com era, amb la nota. El GLB nou va al mateix asset (vistes i plànols es queden) i la memòria
 * cau del model s'oblida.
 */
export async function reframeImported(item: HardwareItem, engine: HardwareEngine, library: readonly HardwareItem[], base: { hinge: HardwareItem; handle: HardwareItem }): Promise<{ item: HardwareItem; note: string | null }> {
  const next = retargetImported(item, engine, library)
  if (next === item) return { item, note: null }
  const kind = proposalKind(engine)
  const asset = item.imported?.asset
  if (!kind || !asset) return { item: next, note: null }
  const row = await getHardwareAsset(asset)
  if (!row?.glb) return { item: next, note: null }
  let meshes: GlbMesh[]
  try {
    meshes = await glbMeshes(row.glb)
  } catch (e) {
    return { item: next, note: `No s'ha pogut llegir el model 3D per orientar-lo: ${e instanceof Error ? e.message : String(e)}` }
  }
  const est = frameFromMesh(kind, meshes, 1, { throughDiameter: base.handle.params.diameter ?? 5 })
  if (!est) return { item: next, note: "No s'ha trobat el patró (cassoleta, cara de muntatge o forats) al model 3D: el model es queda com era i pot sortir girat. Entra les mides a mà." }
  // El GLB refet al marc nou (relatiu al model desat) i la caixa de la mateixa malla.
  const { meshesToGlb } = await import("../../components/viewer/stepMesh")
  const { glb } = await meshesToGlb(meshes, est.frame)
  const box = meshesFrameBox(meshes, est.frame)
  const p: HardwareProposal = { ...est, frameFrom: "mesh", ...(box ? { bbox: box, boxFromMesh: true } : {}) }
  await putHardwareAsset({ ...row, glb })
  forgetModel(asset)
  // El marc respecte del fitxer, si se sap el d'abans (el GLB desat ja hi era).
  const old = item.imported?.mountFrame
  const frame: LocalFrame | undefined = old ? composeFrames(old, est.frame) : undefined
  return { item: applyProposal(next, p, base, frame), note: null }
}

/** El tipus de proposta d'un motor amb marc de muntatge, o `null` (guies, braços, imants, espigues, filera: cap marc). */
function proposalKind(engine: HardwareEngine): Exclude<HardwareProposal["kind"], "model"> | null {
  switch (engine) {
    case "cup":
      return "hinge"
    case "plate":
      return "plate"
    case "barHandle":
      return "handle"
    case "leg":
      return "leg"
    default:
      return null
  }
}

interface GlbMesh extends MeshLike {
  position: Float32Array
  normal?: Float32Array
  index: Uint32Array
}

/** Les malles d'un GLB desat (mm, amb la posició de cada node aplicada), com les que dona OpenCascade. */
async function glbMeshes(blob: Blob): Promise<GlbMesh[]> {
  const [{ Matrix3, Mesh, Vector3 }, { GLTFLoader }] = await Promise.all([import("three"), import("three/examples/jsm/loaders/GLTFLoader.js")])
  const gltf = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), "")
  gltf.scene.updateMatrixWorld(true)
  const out: GlbMesh[] = []
  const v = new Vector3()
  gltf.scene.traverse((o) => {
    const m = o as InstanceType<typeof Mesh>
    if (!m.isMesh) return
    const pos = m.geometry.getAttribute("position")
    if (!pos) return
    const nrm = m.geometry.getAttribute("normal")
    const position = new Float32Array(pos.count * 3)
    const normal = nrm ? new Float32Array(pos.count * 3) : undefined
    const nm = new Matrix3().getNormalMatrix(m.matrixWorld)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).multiplyScalar(1000)
      position.set([v.x, v.y, v.z], i * 3)
      if (normal && nrm) {
        v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize()
        normal.set([v.x, v.y, v.z], i * 3)
      }
    }
    const idx = m.geometry.getIndex()
    const index = idx ? Uint32Array.from(idx.array) : Uint32Array.from({ length: pos.count }, (_, i) => i)
    out.push({ position, ...(normal ? { normal } : {}), index })
  })
  if (!out.length) throw new Error("el GLB no té cap malla")
  return out
}
