import type { HardwareView } from "../core/import/views"
import { db, type HardwareAsset } from "./db"

export type { HardwareAsset }

/** Prefix dels ids dels models de ferratges importats (els llegeix `loadModel`, com els `user-…`). */
export const HARDWARE_ASSET_PREFIX = "hwa-"
export const isHardwareAssetSrc = (src: string): boolean => src.startsWith(HARDWARE_ASSET_PREFIX)

export const newHardwareAssetId = () => `${HARDWARE_ASSET_PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

export async function putHardwareAsset(a: HardwareAsset): Promise<void> {
  await db.hardwareAssets.put(a)
}

export function getHardwareAsset(id: string): Promise<HardwareAsset | undefined> {
  return db.hardwareAssets.get(id)
}

/** Les vistes 2D desades (validades per forma: una fila d'una versió futura no trenca l'editor). */
export function assetViews(a: HardwareAsset | undefined): HardwareView[] {
  return (a?.views ?? []).filter((v): v is HardwareView => typeof v === "object" && v !== null && "name" in v && Array.isArray((v as HardwareView).lines))
}
