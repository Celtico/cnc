import { buildComposition } from "../../core/build/buildComposition"
import { viewerSize, type CameraPose, type Composition, type MaterialPref } from "../../core/model"
import { renderThumb } from "../../components/viewer/thumbRenderer"
import { photoTextureFailures, photoTexturesIdle, photoTexturesPending } from "../../components/viewer/textures"
import { preloadModels } from "../../components/viewer/models3d"

export { releaseThumbRenderer } from "../../components/viewer/thumbRenderer"

/**
 * La part de les miniatures que porta three.js (`projectThumbs` la carrega amb `import()` en fer-ne la primera): les
 * galeries es pinten sense esperar el 3D.
 */

/**
 * Pinta la miniatura quan les fotos de textura ja hi són: el primer intent les comença a baixar (sense pintar,
 * `snapshot`) i es torna a fer quan s'acaben. `null` si no surt o si alguna foto ha fallat mentrestant (sortiria
 * negra i es desaria així).
 */
export async function drawWhenReady(draw: () => string | null): Promise<string | null> {
  const failures = photoTextureFailures()
  for (let i = 0; i < 4; i++) {
    const url = draw()
    if (photoTextureFailures() !== failures) return null
    if (url !== null || !photoTexturesPending()) return url
    await photoTexturesIdle()
    if (photoTextureFailures() !== failures) return null
  }
  return null
}

/**
 * La càmera desada al visor (relativa al moble centrat, `viewerSize`) passada a l'escena de la miniatura, que
 * té les peces on són a la composició (mm → m, sense centrar).
 */
export function thumbPose(comp: Composition): CameraPose | undefined {
  const c = comp.camera
  if (!c) return undefined
  const s = viewerSize(comp)
  const dx = s.width / 2000, dz = s.depth / 2000
  const shift = (v: CameraPose["position"]): CameraPose["position"] => [v[0] + dx, v[1], v[2] + dz]
  return { ...c, position: shift(c.position), target: shift(c.target) }
}

/** Miniatura d'un moble de l'usuari (amb la seva càmera i escena). `null` si un model 3D no carrega o una foto falla. */
export async function renderProjectThumb(comp: Composition, materials: MaterialPref[]): Promise<string | null> {
  const build = buildComposition(comp)
  // Si un model 3D no s'ha pogut carregar, no es fa (ni es desa): sortiria sense la planta per sempre.
  if (!(await preloadModels(build.models))) return null
  const pose = thumbPose(comp)
  // Quan hi són les textures de foto (si no, sortirien negres).
  return drawWhenReady(() => renderThumb([...build.panels, ...build.extras], materials, comp.scene, comp.references, build.models, pose))
}

/** Miniatura d'una plantilla (sense escena ni càmera). */
export async function renderTemplateThumb(comp: Composition, materials: MaterialPref[]): Promise<string | null> {
  const build = buildComposition(comp)
  if (!(await preloadModels(build.models))) return null
  return drawWhenReady(() => renderThumb([...build.panels, ...build.extras], materials, undefined, [], build.models))
}
