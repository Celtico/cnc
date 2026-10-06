import type { Object3D } from "three"
import { hardwareMount } from "../../core/build/hardwareMount"
import type { HardwareItem, MaterialPref, Module } from "../../core/model"
import { renderHardwareThumb } from "../../components/viewer/hardwareThumb"
import { readHardwareModel } from "../../components/viewer/models3d"
import { disposeTree } from "../../components/viewer/textures"
import { drawWhenReady } from "../projects/thumbJobs"

/**
 * La part de les miniatures dels ferratges que porta three.js (`hardwareThumbs` la carrega amb `import()`): el muntatge
 * de «Com va muntat» (`hardwareMount`, el mateix mòdul d'exemple que l'editor) amb els GLB importats llegits només per a
 * aquesta miniatura i alliberats en acabar (no entren a la memòria compartida de models: n'hi pot haver centenars).
 * Sense el GLB (esborrat o malmès), la caixa que ocupa. `null` si no es pot dibuixar o una foto de textura falla.
 */
export async function renderHardwareThumbJob(item: HardwareItem, base: Module | undefined, materials: MaterialPref[]): Promise<string | null> {
  const mount = hardwareMount(item, base)
  if (mount.error || (!mount.panels.length && !mount.model)) return null
  const assets = new Set<string>()
  for (const p of mount.panels) for (const f of p.fittings ?? []) if (f.asset) assets.add(f.asset)
  if (mount.model?.asset) assets.add(mount.model.asset)
  const models = new Map<string, Object3D | null>(await Promise.all([...assets].map(async (a) => [a, await readHardwareModel(a)] as const)))
  try {
    return await drawWhenReady(() => renderHardwareThumb(mount, materials, models))
  } finally {
    for (const o of models.values()) if (o) disposeTree(o)
  }
}
