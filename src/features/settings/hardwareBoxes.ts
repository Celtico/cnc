import { applyBoxRepair, needsBoxRepair } from "../../core/import/merge"
import { positionsBox } from "../../core/import/proposal"
import { currentSettings, saveSettings } from "../../db/settingsStore"

/**
 * Els ferratges importats abans de `IMPORT_BOX_VERSION` tenen la caixa dels punts del STEP, que als conjunts (Blum:
 * 20K1101T, 71T453T) no coincidia amb el model (girada, desplaçada, més gran). En obrir l'app, es refà **del GLB desat**
 * (que ja és al marc del ferratge: la caixa i el model són la mateixa malla) i es desa. Només llegeix three.js i els
 * models si n'hi ha cap per refer; els que no tenen model es queden com eren. Torna quants n'ha refet.
 */
export async function repairImportedBoxes(): Promise<number> {
  const todo = (await currentSettings()).hardwareLibrary.filter((it) => needsBoxRepair(it) && it.imported?.asset)
  if (!todo.length) return 0
  const [{ readHardwareModel }, { disposeTree }, { Box3 }] = await Promise.all([import("../../components/viewer/models3d"), import("../../components/viewer/textures"), import("three")])
  const boxes = new Map<string, ReturnType<typeof positionsBox>>()
  const byAsset = new Map<string, ReturnType<typeof positionsBox>>()
  for (const it of todo) {
    const asset = it.imported!.asset!
    if (!byAsset.has(asset)) {
      const root = await readHardwareModel(asset)
      let box: ReturnType<typeof positionsBox> = null
      if (root) {
        root.updateMatrixWorld(true)
        const b = new Box3().setFromObject(root, true)
        // Metres (GLB) → mm, arrodonida cap a fora com la de la importació (`meshesFrameBox`).
        if (!b.isEmpty()) box = positionsBox([[b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]], 1000)
        disposeTree(root)
      }
      byAsset.set(asset, box)
    }
    boxes.set(it.id, byAsset.get(asset)!)
  }
  // Les preferències d'ara (poden haver canviat mentre es llegien els models).
  const now = await currentSettings()
  const fixed = applyBoxRepair(now.hardwareLibrary, boxes)
  if (!fixed.changed) return 0
  await saveSettings({ ...now, hardwareLibrary: fixed.library })
  return [...boxes.values()].filter(Boolean).length
}
