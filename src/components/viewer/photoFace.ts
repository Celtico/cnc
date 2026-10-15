import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace, type Texture } from "three"
import { containRect } from "../../core/photo/whiteBackground"
import { onPhotoTextureLoaded, photoTexture, type FinishSpec } from "./textures"

/**
 * **La cara vista d'un electrodomèstic** (`Panel.photo`; per petició de l'usuari, 2026-10-15: la foto del catàleg sortia
 * estirada i amb el marc blanc): una textura de la mida de la cara amb el color del cos de l'aparell (el seu material) i
 * a sobre la foto **sencera i centrada** (`contain`, sense deformar-la), amb el fons transparent de la foto (les de l'app
 * ja el porten tret i les que puja l'usuari també: `core/photo/whiteBackground.ts`). La foto es carrega amb
 * `photoTexture` (la mateixa memòria, i les miniatures l'esperen amb `photoTexturesIdle`): fins que arriba (o si falla),
 * la cara és del color del cos. Cada material en fa la seva (es llibera amb el material): és una per aparell.
 */

/** Costat llarg de la textura de la cara (px). */
const FACE_PX = 1024

/** Cares que esperen la seva foto (es pinten quan arriba; si falla, es queden del color del cos). */
const pending = new Set<{ base: Texture; draw: () => void }>()
let listening = false

/** El color de base d'un acabat (el que es veu al voltant de la foto). */
function finishColor(f: FinishSpec): string {
  if (f.kind === "color" || f.kind === "pattern") return f.color
  if (f.kind === "image") return f.color ?? "#808080"
  return "#a8865a"
}

export function photoFaceTexture(src: string, faceW: number, faceH: number, body: FinishSpec): Texture {
  const k = FACE_PX / Math.max(1, faceW, faceH)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(faceW * k))
  canvas.height = Math.max(1, Math.round(faceH * k))
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const g = canvas.getContext("2d")
  if (!g) return tex
  g.fillStyle = finishColor(body)
  g.fillRect(0, 0, canvas.width, canvas.height)
  const base = photoTexture(src)
  const draw = () => {
    const img = base.image as (CanvasImageSource & { width: number; height: number }) | undefined
    if (!img?.width || !img.height) return
    const r = containRect(img.width / img.height, canvas.width, canvas.height)
    g.drawImage(img, r.x, r.y, r.w, r.h)
    tex.needsUpdate = true
  }
  if ((base.image as { width?: number } | undefined)?.width) draw()
  else {
    pending.add({ base, draw })
    if (!listening) {
      listening = true
      onPhotoTextureLoaded(() => {
        for (const p of pending) {
          if ((p.base.image as { width?: number } | undefined)?.width) p.draw()
          else if (!p.base.userData.failed) continue
          pending.delete(p)
        }
      })
    }
  }
  return tex
}
