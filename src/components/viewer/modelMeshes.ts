import type { StepMesh } from "./stepMesh"

/**
 * El 3D d'un ferratge importat quan **no hi ha STEP** (`features/settings/hardwareImport.ts`): IGES amb OpenCascade
 * (`stepMeshes(…, "iges")`), **3DS** amb el `TDSLoader` de three (els `3DS_*.zip` de Hettich, en mm) i **Collada** (`.dae`
 * de Blum) amb el `ColladaLoader` (la unitat del fitxer, `<unit meter>`, a mm; sense girar el Z amunt: les coordenades
 * del fitxer, com el STEP). Torna les malles en mm, a les coordenades del fitxer, com `stepMeshes`. Les textures que
 * nomenen no es baixen (cap petició a la xarxa: una imatge buida). Només al navegador, a demanda.
 */

const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="

/** Malles d'un `.3ds` (unitats del fitxer = mm, com els de Hettich) o d'un `.dae` (unitat del fitxer → mm). */
export async function meshFileMeshes(kind: "3ds" | "dae", bytes: Uint8Array): Promise<StepMesh[]> {
  const three = await import("three")
  const manager = new three.LoadingManager()
  manager.setURLModifier(() => BLANK)
  let root: import("three").Object3D
  let scale = 1
  if (kind === "3ds") {
    const { TDSLoader } = await import("three/examples/jsm/loaders/TDSLoader.js")
    const buf = bytes.slice().buffer
    root = new TDSLoader(manager).parse(buf, "")
  } else {
    const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js")
    const r = new ColladaLoader(manager).parse(new TextDecoder().decode(bytes), "")
    if (!r) throw new Error("El fitxer Collada (.dae) no es pot llegir.")
    root = r.scene
    // Coordenades del fitxer (sense el gir de Z amunt) i la unitat del fitxer en mm.
    scale = 1000 * root.scale.x
    root.rotation.set(0, 0, 0)
    root.scale.set(1, 1, 1)
  }
  root.updateMatrixWorld(true)
  const out: StepMesh[] = []
  const v = new three.Vector3()
  root.traverse((o) => {
    const m = o as import("three").Mesh
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry
    const pos = g.getAttribute("position")
    if (!pos) return
    const position = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).multiplyScalar(scale)
      position[i * 3] = v.x
      position[i * 3 + 1] = v.y
      position[i * 3 + 2] = v.z
    }
    const index = g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i)
    out.push({ position, index })
  })
  if (!out.length) throw new Error(`El ${kind === "3ds" ? "3DS" : "Collada (.dae)"} no porta cap malla.`)
  return out
}

/** La caixa (mm) d'unes malles, per a un «només 3D» sense STEP. */
export function meshesBox(meshes: readonly StepMesh[]): { min: [number, number, number]; max: [number, number, number] } | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const m of meshes)
    for (let i = 0; i < m.position.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const x = m.position[i + k]!
        if (x < min[k]!) min[k] = x
        if (x > max[k]!) max[k] = x
      }
  return Number.isFinite(min[0]) ? { min, max } : null
}
