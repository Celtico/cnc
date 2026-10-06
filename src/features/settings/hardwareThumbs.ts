import { THUMB_VERSION } from "../../components/viewer/thumbVersion"
import type { HardwareItem, MaterialPref, Module } from "../../core/model"
import { requestStoredThumb, storedThumb } from "../projects/projectThumbs"
import { materialsPrint, templatePrint } from "../projects/thumbStore"

/**
 * Miniatures 3D de les targetes de Preferències › Ferratges, com les de Mobles, Objectes i Ambients: el mateix
 * renderitzador fora de pantalla i la mateixa cua (`requestStoredThumb`), desades a la Cache Storage. El dibuix (three.js
 * i el GLB del ferratge) és a `hardwareThumbJob.ts`, que es carrega en fer-ne la primera.
 */
const job = () => import("./hardwareThumbJob")

/** Si canvia la manera de fer les dels ferratges (a més de `THUMB_VERSION`, la de totes), es tornen a fer. */
const HARDWARE_THUMB_VERSION = 1

/**
 * Empremta de la miniatura: la versió, el contingut de l'item (forats, placa aparellada, confirmat o no, model), el mòdul
 * d'exemple (`base`: tauler, gruix, jocs i ferratges per defecte de les preferències) i els materials.
 */
export function hardwareThumbSig(item: HardwareItem, base: Module | undefined, materials: readonly MaterialPref[]): string {
  return `${THUMB_VERSION}.${HARDWARE_THUMB_VERSION}-${templatePrint([item, base ?? null])}-${materialsPrint(materials)}`
}

export function hardwareThumb(item: HardwareItem, sig: string): string | undefined {
  return storedThumb("ferratge", item.id, sig)
}

export function requestHardwareThumb(item: HardwareItem, base: Module | undefined, materials: MaterialPref[], sig: string, onDone: (url: string) => void): () => void {
  return requestStoredThumb("ferratge", item.id, sig, async () => (await job()).renderHardwareThumbJob(item, base, materials), onDone)
}
