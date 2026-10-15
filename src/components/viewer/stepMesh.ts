import { meshToFrame, type LocalFrame } from "../../core/import/proposal"

/**
 * STEP → GLB per veure un ferratge importat (importació adormida: les malles ja hi són): aquí es passen al
 * **marc del ferratge** (`LocalFrame`: u, v, n; el de la proposta de mecanitzats) en metres, amb un material de metall, i
 * s'exporta a `.glb` (`GLTFExporter`). Així el visor el posa a la cassoleta o a la placa sense saber res del fitxer.
 */

export interface StepMesh {
  position: Float32Array
  /** Normals de les cares (OpenCascade): arestes vives, com el CAD. */
  normal?: Float32Array
  index: Uint32Array
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
