// three no porta tipus per al simplificador de meshoptimizer: només el que fa servir `optimizeGlb.ts`.
declare module "three/examples/jsm/libs/meshopt_simplifier.module.js" {
  export const MeshoptSimplifier: {
    ready: Promise<void>
    supported: boolean
    simplify(
      indices: Uint32Array,
      positions: Float32Array,
      stride: number,
      targetIndexCount: number,
      targetError: number,
      flags?: ("LockBorder" | "Sparse" | "ErrorAbsolute" | "Prune")[],
    ): [Uint32Array, number]
  }
}
