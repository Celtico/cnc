import { MeshStandardMaterial, type Texture } from "three"
import type { MaterialPref } from "../../core/model"
import { patternTexture, photoTexture, resolveFinish, woodGenOf, woodTexture } from "./textures"

function tiled(base: Texture, uMm: number, vMm: number, tileMm: number, aspect = 1): Texture {
  const t = base.clone()
  t.needsUpdate = true
  t.repeat.set(uMm / tileMm, vMm / (tileMm * aspect))
  return t
}

/**
 * Material d'una superfície gran (terra i parets dels ambients) de `uMm` × `vMm`, amb la
 * textura a la mida real: fusta, foto, teixit, rajola o color.
 */
export function surfaceMaterial(materials: MaterialPref[], name: string, uMm: number, vMm: number): MeshStandardMaterial {
  const f = resolveFinish(materials, name)
  if (f.kind === "wood") return new MeshStandardMaterial({ map: tiled(woodTexture(f.species, f.gen), uMm, vMm, woodGenOf(f.species, f.gen).tileMm), roughness: 0.6 })
  if (f.kind === "image") return new MeshStandardMaterial({ map: tiled(photoTexture(f.src, f.seamless), uMm, vMm, f.tileMm, f.aspect), roughness: 0.7 })
  if (f.kind === "pattern") return new MeshStandardMaterial({ map: tiled(patternTexture(f.pattern, f.color, f.grout, f.opts), uMm, vMm, f.tileMm), roughness: f.roughness })
  return new MeshStandardMaterial({ color: f.color, roughness: Math.max(0.5, f.roughness), metalness: f.metalness ?? 0 })
}
