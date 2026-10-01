import type { ModelObject } from "./composition"

/**
 * Models 3D de l'app (`public/models/*.glb`, CC0 de Poly Haven, textura 1K amb el retall de les fulles a l'alfa).
 * `size`: la mida real del model (mm, amplada · alçada · fondària), la que agafa en afegir-lo.
 */
export interface ModelAsset {
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
]

export const modelAsset = (src: string): ModelAsset | undefined => MODEL_ASSETS.find((a) => a.id === src)

/** Un model de l'app col·locat amb la cantonada a (x, y, z), a la seva mida real. */
export function newModelObject(id: string, asset: ModelAsset, at: { x: number; y: number; z: number }, name = asset.name): ModelObject {
  const [w, h, d] = asset.size
  return { id, name, src: asset.id, x: at.x, y: at.y, z: at.z, w, h, d, rot: 0 }
}
