import { finishOfPref, patternTexture, woodGenOf, woodTexture } from "../../components/viewer/textures"
import type { Finish, MaterialPref } from "../../core/model"

/** Amplada real (mm) que representa la mostra de previsualització d'un material. */
export const PREVIEW_MM = 600

const urls = new Map<string, string>()
/** URL d'una textura procedural (es pinta un cop i es recorda). */
function textureUrl(key: string, make: () => { image: unknown }): string {
  const hit = urls.get(key)
  if (hit) return hit
  const img = make().image as HTMLCanvasElement
  const url = img.toDataURL("image/jpeg", 0.85)
  urls.set(key, url)
  return url
}

/**
 * Estil CSS de la mostra d'un material, a escala real: `wPx` píxels = `PREVIEW_MM` mm. Fusta i
 * rajoles amb la seva textura procedural, fotos amb la seva mida real, metalls amb reflex, vidre
 * translúcid sobre quadrícula.
 */
export function previewStyle(m: MaterialPref, wPx: number): Record<string, string> {
  const f = finishOfPref(m)
  const px = (mm: number) => `${(mm / PREVIEW_MM) * wPx}px`
  if (f.kind === "wood") {
    const gen = woodGenOf(f.species, f.gen)
    return { backgroundImage: `url(${textureUrl(`wood:${JSON.stringify(gen)}`, () => woodTexture(f.species, f.gen))})`, backgroundSize: `${px(gen.tileMm)} ${px(gen.tileMm)}` }
  }
  if (f.kind === "image") return { backgroundImage: `url(${f.src})`, backgroundSize: `${px(f.tileMm)} ${px(f.tileMm * (f.aspect ?? 1))}` }
  if (f.kind === "pattern") return { backgroundImage: `url(${textureUrl(`${f.pattern}:${f.color}:${f.grout ?? ""}:${JSON.stringify(f.opts ?? {})}`, () => patternTexture(f.pattern, f.color, f.grout, f.opts))})`, backgroundSize: `${px(f.tileMm)} ${px(f.tileMm)}` }
  if (f.opacity !== undefined && f.opacity < 1) {
    // Vidre: el color amb la seva opacitat sobre una quadrícula; glaçat = vel blanc que la difumina.
    const a = Math.round(Math.min(1, f.opacity) * 255).toString(16).padStart(2, "0")
    const frost = Math.min(0.6, Math.max(0, (f.roughness - 0.03) / 0.6) * 0.55)
    return { background: `linear-gradient(rgba(255,255,255,${frost}), rgba(255,255,255,${frost})), linear-gradient(135deg, ${f.color}${a}, ${f.color}${a}), repeating-conic-gradient(#999 0 25%, #eee 0 50%) 0 0 / 16px 16px` }
  }
  if (f.metalness && f.metalness > 0.5) {
    // Metall polit: reflexos marcats si és llis; més suaus com més rugós.
    const hi = Math.round((1 - f.roughness) * 110).toString(16).padStart(2, "0")
    return { background: `linear-gradient(120deg, ${f.color} 0%, #ffffff${hi} 18%, ${f.color} 32%, #00000033 62%, ${f.color} 80%, #ffffff${hi} 100%), ${f.color}` }
  }
  // Llis o lacat: una mica de llum per veure'n el volum (el lacat, més brillant).
  const gloss = `#ffffff${Math.round(Math.max(0.1, 1 - f.roughness) * 110).toString(16).padStart(2, "0")}`
  return { background: `radial-gradient(120% 90% at 25% 15%, ${gloss}, transparent 60%), ${f.color}` }
}

/** Acabats que es poden dissenyar amb l'editor de textures (tots menys la foto real). */
export function isEditable(f: Finish): f is Exclude<Finish, { kind: "image" }> {
  return f.kind !== "image"
}
