import { MeshStandardMaterial, type Texture } from "three"
import type { MaterialPref } from "../../core/model"
import { applyFinishFx, patternTexture, tileClone, photoTexture, resolveFinish, woodGenOf, woodTexture } from "./textures"

/** Còpia amb la repetició a mida real; comparteix la imatge (i la textura de GPU) de la base (`tileClone`). */
function tiled(base: Texture, uMm: number, vMm: number, tileMm: number, aspect = 1): Texture {
  const t = tileClone(base)
  t.repeat.set(uMm / tileMm, vMm / (tileMm * aspect))
  return t
}

/**
 * Material d'una superfície gran (terra i parets dels ambients) de `uMm` × `vMm`, amb la
 * textura a la mida real: fusta, foto, teixit, rajola o color.
 */
export function surfaceMaterial(materials: MaterialPref[], name: string, uMm: number, vMm: number): MeshStandardMaterial {
  const f = resolveFinish(materials, name)
  return applyFinishFx(baseSurface(f, uMm, vMm), f)
}

function baseSurface(f: ReturnType<typeof resolveFinish>, uMm: number, vMm: number): MeshStandardMaterial {
  if (f.kind === "wood") {
    const m = new MeshStandardMaterial({ map: tiled(woodTexture(f.species, f.gen), uMm, vMm, woodGenOf(f.species, f.gen).tileMm), roughness: 0.6 })
    // Parquet: relleu de la veta al render (`sceneData`).
    m.userData.grain = true
    return m
  }
  if (f.kind === "image") {
    const tex = (src: string, linear: boolean) => tiled(photoTexture(src, f.seamless, linear), uMm, vMm, f.tileMm, f.aspect)
    return new MeshStandardMaterial({
      map: tex(f.src, false),
      ...(f.normalMap ? { normalMap: tex(f.normalMap, true) } : {}),
      ...(f.roughMap ? { roughnessMap: tex(f.roughMap, true) } : {}),
      roughness: Math.min(1, f.roughness ?? (f.roughMap ? 1 : 0.7)),
    })
  }
  if (f.kind === "pattern") return new MeshStandardMaterial({ map: tiled(patternTexture(f.pattern, f.color, f.grout, f.opts), uMm, vMm, f.tileMm), roughness: f.roughness, metalness: f.metalness ?? 0 })
  return new MeshStandardMaterial({ color: f.color, roughness: Math.max(0.5, f.roughness), metalness: f.metalness ?? 0 })
}
