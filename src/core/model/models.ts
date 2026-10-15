import type { ModelObject } from "./composition"

/**
 * Models 3D de l'app (`public/models/*.glb`, CC0 de Poly Haven, textura 1K amb el retall de les fulles a l'alfa).
 * Els arbres són reduïts per al mòbil (escorça delmada, part de les fulles, compressió meshopt: `gltfpack -c`).
 * `size`: la mida real del model (mm, amplada · alçada · fondària), la que agafa en afegir-lo.
 */
interface ModelAsset {
  id: string
  name: string
  url: string
  size: [number, number, number]
}

export const MODEL_ASSETS: ModelAsset[] = [
  { id: "fern-02-b", name: "Falguera gran", url: "models/fern_02_b.glb", size: [990, 428, 894] },
  { id: "fern-02-c", name: "Falguera mitjana", url: "models/fern_02_c.glb", size: [874, 349, 765] },
  { id: "fern-02-a", name: "Falguera petita", url: "models/fern_02_a.glb", size: [552, 287, 613] },
  { id: "fern-02-d", name: "Falguera baixa", url: "models/fern_02_d.glb", size: [573, 213, 593] },
  // Arbres (exteriors): de debò fan 19 m; aquí surten a una mida de jardí (es poden fer més grans o més petits),
  // proporcional a la caixa del GLB (xicranda ≈ 24272 × 19417 × 18448 mm → 6 m d'alt).
  { id: "jacaranda", name: "Xicranda", url: "models/jacaranda_tree.glb", size: [7500, 6000, 5700] },
  { id: "fir-01", name: "Avet", url: "models/fir_tree_01.glb", size: [1735, 5000, 1706] },
  // Herba alta (per decisió de l'usuari, el seu .blend de Poly Haven grass_medium_01): ~120 mates escampades en 2 × 2 m
  // (`scripts/polyhaven-grass.py`, LOD2, textura 1K, `gltfpack -c`). Per a vores i racons; la gespa de terra és la
  // textura «Gespa».
  { id: "grass-patch", name: "Herba (2 × 2 m)", url: "models/grass_patch.glb", size: [1976, 436, 1882] },
]

export const modelAsset = (src: string): ModelAsset | undefined => MODEL_ASSETS.find((a) => a.id === src)

/** Un model de l'app col·locat amb la cantonada a (x, y, z), a la seva mida real. */
export function newModelObject(id: string, asset: ModelAsset, at: { x: number; y: number; z: number }, name = asset.name): ModelObject {
  const [w, h, d] = asset.size
  return { id, name, src: asset.id, x: at.x, y: at.y, z: at.z, w, h, d, rot: 0 }
}

/**
 * Petjada del model girat (`rot` graus al voltant del centre de la seva caixa): la caixa alineada amb els eixos
 * (mm) que l'envolta, en planta. L'alçada (y, h) no canvia.
 */
export function modelFootprint(m: Pick<ModelObject, "x" | "z" | "w" | "d"> & { rot?: number }): { x: number; z: number; w: number; d: number } {
  const a = ((m.rot ?? 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a))
  const w = m.w * c + m.d * s
  const d = m.w * s + m.d * c
  const cx = m.x + m.w / 2, cz = m.z + m.d / 2
  return { x: cx - w / 2, z: cz - d / 2, w, d }
}
