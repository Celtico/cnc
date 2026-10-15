import type { PanelRole } from "../../core/model"
import type { ProjectedFace } from "../../core/photo/camera"

export const ROLE_FILL: Record<PanelRole, string> = {
  side: "#c6924f",
  bottom: "#c6924f",
  top: "#d6b076",
  shelf: "#e6cfa6",
  door: "#b57a37",
  back: "#98602c",
  divider: "#c6924f",
  fixedShelf: "#c6924f",
  plinth: "#98602c",
  drawerFront: "#b57a37",
  drawerSide: "#e6cfa6",
  drawerBack: "#e6cfa6",
  drawerBottom: "#c9b79a",
  flap: "#b57a37",
  grille: "#b57a37",
  hatch: "#b57a37",
  panel: "#b57a37",
  worktop: "#d6b076",
  spacer: "#c6924f",
  facing: "#c6924f",
  part: "#b98a4f",
  hardware: "#9aa0a6",
}

/** Foto + moble superposat en un PNG a mida de la foto. */
export async function renderComposite(blob: Blob, W: number, H: number, layer: "photo" | "cabinet" | "both", opacity: number, faces: ProjectedFace[], stroke: number, render: HTMLCanvasElement | null = null): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  if (layer !== "cabinet") {
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0, W, H)
    bitmap.close()
  } else {
    ctx.fillStyle = "#f4f1ea"
    ctx.fillRect(0, 0, W, H)
  }
  if (layer !== "photo" && render) {
    ctx.globalAlpha = opacity
    ctx.drawImage(render, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (layer !== "photo") {
    ctx.lineJoin = "round"
    ctx.lineWidth = stroke
    for (const f of faces) {
      if (!f.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) continue
      ctx.beginPath()
      f.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.globalAlpha = opacity * (0.55 + 0.45 * f.facing)
      ctx.fillStyle = ROLE_FILL[f.role]
      ctx.fill()
      ctx.globalAlpha = Math.min(1, opacity + 0.2)
      ctx.strokeStyle = "#2f1a10"
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut generar el PNG"))), "image/png"))
}
