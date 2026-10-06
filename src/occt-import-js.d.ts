// occt-import-js (OpenCascade en WASM) no porta tipus: només el que fa servir `occtWorker.ts`.
declare module "occt-import-js" {
  export interface OcctMesh {
    name?: string
    color?: [number, number, number]
    attributes: { position: { array: number[] }; normal?: { array: number[] } }
    index: { array: number[] }
  }
  export interface OcctResult {
    success: boolean
    meshes: OcctMesh[]
  }
  export interface Occt {
    ReadStepFile(content: Uint8Array, params: Record<string, unknown> | null): OcctResult
    ReadIgesFile(content: Uint8Array, params: Record<string, unknown> | null): OcctResult
  }
  const occtimportjs: (module?: { locateFile?: (path: string) => string }) => Promise<Occt>
  export default occtimportjs
}
