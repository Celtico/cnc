import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { Plane, Vector3 } from "three"
import { S } from "./constants"

/**
 * El pla de secció (el del Taulell): retalla tot el que hi ha a l'escena per un pla d'escaire. `section.pos` en mm de la
 * composició; `offset`, el que el visor resta per centrar el moble. Sense secció, res retallat.
 */
export function SectionClip({ section, offset }: { section: { axis: 0 | 1 | 2; pos: number; flip: boolean } | null; offset: [number, number, number] }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const key = section ? `${section.axis}:${section.pos}:${section.flip}:${offset.join(",")}` : ""
  useEffect(() => {
    if (!section) {
      gl.clippingPlanes = []
      invalidate()
      return
    }
    const n = new Vector3()
    n.setComponent(section.axis, section.flip ? 1 : -1)
    const at = (section.pos - offset[section.axis]) * S
    gl.clippingPlanes = [new Plane(n, section.flip ? -at : at)]
    invalidate()
    return () => {
      gl.clippingPlanes = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la clau resumeix la secció i el centrat
  }, [key, gl])
  return null
}
