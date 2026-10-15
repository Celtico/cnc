import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import type { Object3D } from "three"

/**
 * Captura la vista actual en PNG, tal com es veu: mateix fons, llum, to i antialiàsing
 * (es renderitza al mateix canvas a resolució alta), sense la graella.
 */
export function Capture({ onCapture, gridRef }: { onCapture: (fn: () => Promise<Blob>) => void; gridRef: React.RefObject<Object3D | null> }) {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    onCapture(async () => {
      const ratio = Math.max(2, gl.getPixelRatio())
      const prevRatio = gl.getPixelRatio()
      const grid = gridRef.current
      const gridVisible = grid?.visible ?? true
      if (grid) grid.visible = false
      gl.setPixelRatio(ratio)
      gl.setSize(size.width, size.height, false)
      gl.render(scene, camera)
      // Còpia síncrona abans que el bucle de r3f torni a pintar a la resolució normal.
      const canvas = document.createElement("canvas")
      canvas.width = gl.domElement.width
      canvas.height = gl.domElement.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(gl.domElement, 0, 0)
      gl.setPixelRatio(prevRatio)
      gl.setSize(size.width, size.height, false)
      if (grid) grid.visible = gridVisible
      gl.render(scene, camera)
      return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut generar el PNG"))), "image/png"))
    })
  }, [onCapture, gl, scene, camera, size, gridRef])
  return null
}
