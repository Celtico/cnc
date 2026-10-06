import { createElement, useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import type { IconType } from "react-icons"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"

/**
 * Icona del catàleg (`react-icons/lu`) com a textura, per als botons 3D de l'editor (malles de mida constant, no `Html`
 * de drei): la barra flotant d'un ferratge col·locat (Duplicar · Editar · Eliminar). L'SVG surt del mateix component de
 * la UI (així és la mateixa icona), es pinta blanc en un canvas de 128 px i es recorda per icona (compartida: no
 * s'allibera amb cap material).
 */
const cache = new Map<IconType, Texture>()
const pending = new Map<IconType, Promise<Texture>>()

function iconSvg(Icon: IconType): string {
  const div = document.createElement("div")
  const root = createRoot(div)
  flushSync(() => root.render(createElement(Icon, { size: 128, color: "#ffffff" })))
  const svg = div.innerHTML.replace(/currentColor/g, "#ffffff")
  root.unmount()
  return svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
}

function loadIcon(Icon: IconType): Promise<Texture> {
  const had = pending.get(Icon)
  if (had) return had
  const p = new Promise<Texture>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = c.height = 128
      c.getContext("2d")!.drawImage(img, 0, 0, 128, 128)
      const t = new CanvasTexture(c)
      t.colorSpace = SRGBColorSpace
      t.userData.shared = true
      cache.set(Icon, t)
      resolve(t)
    }
    img.onerror = () => reject(new Error("icona"))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(Icon))}`
  })
  pending.set(Icon, p)
  return p
}

/** La textura de la icona (o `null` mentre es fa). */
export function useIconTexture(Icon: IconType): Texture | null {
  const [tex, setTex] = useState<Texture | null>(() => cache.get(Icon) ?? null)
  useEffect(() => {
    if (tex) return
    let alive = true
    void loadIcon(Icon).then((t) => alive && setTex(t), () => {})
    return () => {
      alive = false
    }
  }, [Icon, tex])
  return tex
}
