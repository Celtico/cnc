import { applianceBodyMaterial } from "./appliance"
import { APPLIANCE_ITEM_VERSION } from "./appliances/applianceCatalog"
import type { Composition } from "./compositionSchema"
import type { HardwareItem } from "./hardwareSchema"
import type { Zone } from "./moduleSchema"

/** El cos dels electrodomèstics del catàleg abans de la v3 de l'item (tots igual). */
const LEGACY_BODY = "Acer inox"

/** Còpia d'un electrodomèstic del catàleg d'abans de la v3 (el cos «Acer inox» de tots): passa al de la seva família. */
function upgradeItem(hw: HardwareItem): HardwareItem {
  if (hw.engine !== "appliance" || !hw.builtin || !hw.appliance || hw.version >= APPLIANCE_ITEM_VERSION || hw.material !== LEGACY_BODY) return hw
  return { ...hw, material: applianceBodyMaterial(hw.appliance), version: APPLIANCE_ITEM_VERSION }
}

function upgradeZone(z: Zone): Zone {
  let out = z
  const hw = z.appliance?.hardware
  const next = hw && upgradeItem(hw)
  if (next && next !== hw) out = { ...out, appliance: { ...z.appliance!, hardware: next } }
  if (z.split) {
    const children = z.split.children.map(upgradeZone)
    if (children.some((c, i) => c !== z.split!.children[i])) out = { ...out, split: { ...z.split, children } }
  }
  return out
}

/**
 * **El cos dels electrodomèstics dels mobles desats** (v3 dels items del catàleg, 2026-10-15; `applianceBodyMaterial`): les
 * còpies del catàleg d'abans porten «Acer inox» (el de tots) i passen al de la seva família, com la biblioteca; així
 * continuen sent l'item de la biblioteca (no «Còpia pròpia»). Només es veu (rol `hardware`): la fabricació no canvia.
 * Una còpia ja de la v3 (també una amb «Acer inox» triat a mà) no es toca. Torna el mateix objecte si no hi ha res a fer.
 */
export function upgradeApplianceBodies(comp: Composition): Composition {
  const modules = comp.modules.map((m) => {
    const root = upgradeZone(m.root)
    return root === m.root ? m : { ...m, root }
  })
  return modules.some((m, i) => m !== comp.modules[i]) ? { ...comp, modules } : comp
}
