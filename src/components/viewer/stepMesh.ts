import { meshToFrame, type LocalFrame } from "../../core/import/proposal"

/**
 * STEP → GLB per veure un ferratge importat: OpenCascade fa la malla (`occtWorker.ts`, a demanda) i aquí es passa al
 * **marc del ferratge** (`LocalFrame`: u, v, n; el de la proposta de mecanitzats) en metres, amb un material de metall, i
 * s'exporta a `.glb` (`GLTFExporter`). Així el visor el posa a la cassoleta o a la placa sense saber res del fitxer.
 */

export interface StepMesh {
  position: Float32Array
  /** Normals de les cares (OpenCascade): arestes vives, com el CAD. */
  normal?: Float32Array
  index: Uint32Array
}

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { ok: (m: StepMesh[]) => void; ko: (e: Error) => void }>()

/** Malles del STEP (o de l'IGES, `format`) en mm, a les coordenades del fitxer. */
export function stepMeshes(bytes: Uint8Array, format: "step" | "iges" = "step"): Promise<StepMesh[]> {
  if (!worker) {
    worker = new Worker(new URL("./occtWorker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<{ id: number; meshes?: StepMesh[]; error?: string }>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if (e.data.meshes) w.ok(e.data.meshes)
      else w.ko(new Error(e.data.error ?? "Error d'OpenCascade"))
    }
    worker.onerror = (e) => {
      for (const w of waiting.values()) w.ko(new Error(e.message || "No s'ha pogut carregar OpenCascade."))
      waiting.clear()
      worker?.terminate()
      worker = null
    }
  }
  const id = ++seq
  const copy = bytes.slice()
  return new Promise((ok, ko) => {
    waiting.set(id, { ok, ko })
    worker!.postMessage({ id, bytes: copy, format }, [copy.buffer])
  })
}

/** Allibera el worker (i el WASM) quan s'acaba d'importar. */
export function releaseStepWorker(): void {
  worker?.terminate()
  worker = null
  for (const w of waiting.values()) w.ko(new Error("cancel·lat"))
  waiting.clear()
}

/**
 * GLB (binari) de les malles passades al marc del ferratge, en metres (`meshToFrame`, la mateixa transformació que la caixa,
 * `meshesFrameBox`). Torna també els triangles.
 */
export async function meshesToGlb(meshes: StepMesh[], frame: LocalFrame): Promise<{ glb: Blob; triangles: number }> {
  const [{ BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Scene }, { GLTFExporter }] = await Promise.all([import("three"), import("three/examples/jsm/exporters/GLTFExporter.js")])
  const scene = new Scene()
  const mat = new MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.85, roughness: 0.3 })
  let triangles = 0
  for (const m of meshes) {
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(meshToFrame(m.position, frame, 0.001), 3))
    g.setIndex(new BufferAttribute(m.index, 1))
    if (m.normal && m.normal.length === m.position.length) g.setAttribute("normal", new BufferAttribute(meshToFrame(m.normal, frame, 1, true), 3))
    else g.computeVertexNormals()
    triangles += (g.index?.count ?? 0) / 3
    scene.add(new Mesh(g, mat))
  }
  const out = await new GLTFExporter().parseAsync(scene, { binary: true })
  if (!(out instanceof ArrayBuffer)) throw new Error("GLTFExporter no ha tornat un .glb")
  return { glb: new Blob([out], { type: "model/gltf-binary" }), triangles }
}
