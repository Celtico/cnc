import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js"
import type { ModelObject, Panel } from "../../core/model"
import { buildScene } from "./exportGlb"
import { preloadModels } from "./models3d"

/**
 * USDZ del moble en METRES, per a AR Quick Look (Safari iOS/iPadOS).
 * Quick Look posa l'origen sobre el pla detectat: la base del moble és a y = 0.
 */
export async function exportUsdz(panels: Panel[], name: string, real?: Parameters<typeof buildScene>[2], models: ModelObject[] = []): Promise<Blob> {
  await preloadModels(models)
  const scene = buildScene(panels, name, real, models)
  scene.updateMatrixWorld(true)
  const exporter = new USDZExporter()
  const bytes = await exporter.parseAsync(scene, { quickLookCompatible: true })
  return new Blob([bytes as BlobPart], { type: "model/vnd.usdz+zip" })
}

/**
 * Obre el model a AR Quick Look. Només fa res útil a Safari d'iOS: a la resta de
 * navegadors l'enllaç descarrega el fitxer. `allowsContentScaling=0` manté la mida real.
 */
export function openQuickLook(usdz: Blob, filename: string): void {
  const url = URL.createObjectURL(usdz)
  const a = document.createElement("a")
  a.rel = "ar"
  a.href = `${url}#allowsContentScaling=0`
  a.download = filename
  // Quick Look exigeix un <img> com a fill de l'enllaç.
  const img = document.createElement("img")
  img.alt = filename
  img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
  a.appendChild(img)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Safari a iPhone/iPad (inclosos els iPad que es presenten com a Mac). */
export function supportsQuickLook(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  const relAr = typeof document !== "undefined" && document.createElement("a").relList?.supports?.("ar")
  return isIOS && (isSafari || relAr === true)
}
