/// <reference lib="webworker" />
/**
 * Malla d'un STEP (o d'un IGES, `format: "iges"`: els `IGES_*.zip` de Hettich) amb OpenCascade (`occt-import-js`, WASM de ~7,6 MB): en un worker perquè no aturi la UI, i només quan
 * s'importa un ferratge (el carrega `stepMesh.ts` a demanda; el WASM no es precacheja, `vite.config.ts`). Torna les
 * malles en mm, a les coordenades del fitxer.
 */
import occtimportjs, { type Occt } from "occt-import-js"
import wasmUrl from "occt-import-js/dist/occt-import-js.wasm?url"

let occt: Promise<Occt> | null = null

self.onmessage = async (e: MessageEvent<{ id: number; bytes: Uint8Array; format?: "step" | "iges" }>) => {
  const { id, bytes, format = "step" } = e.data
  try {
    occt ??= occtimportjs({ locateFile: () => wasmUrl })
    const o = await occt
    const params = { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 } as const
    const r = format === "iges" ? o.ReadIgesFile(bytes, params) : o.ReadStepFile(bytes, params)
    if (!r.success) throw new Error(`OpenCascade no ha pogut llegir el ${format === "iges" ? "IGES" : "STEP"}.`)
    const meshes = r.meshes.map((m) => ({
      position: new Float32Array(m.attributes.position.array),
      ...(m.attributes.normal ? { normal: new Float32Array(m.attributes.normal.array) } : {}),
      index: new Uint32Array(m.index.array),
    }))
    self.postMessage({ id, meshes }, meshes.flatMap((m) => [m.position.buffer, m.index.buffer, ...(m.normal ? [m.normal.buffer] : [])]))
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
