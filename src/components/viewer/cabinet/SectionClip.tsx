import { useThree } from "@react-three/fiber"
import { createContext, useEffect } from "react"
import { BackSide, MeshBasicMaterial, Plane, Vector3 } from "three"
import { S } from "./constants"

/** «Pinta la cara tallada» (Taulell): amb la secció, l'interior de cada peça es veu d'un color pla pel tall. */
export const SectionCapContext = createContext<{ axis: 0 | 1 | 2; pos: number } | null>(null)
/** Els mecanitzats (forats, ranures, Cabineo) buidats de debò a la peça, no pintats per sobre (editor i Ferratges, cel 2026-11-08). */
export const CarveContext = createContext(false)
/** El color de la cara tallada: les cares de darrere de les peces, que només es veuen pel tall. */
export const SECTION_CAP_MAT = new MeshBasicMaterial({ color: "#d9773b", side: BackSide })
/** La cara tallada no es pot clicar: el clic va a la peça. */
export const noRaycast = () => null

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
