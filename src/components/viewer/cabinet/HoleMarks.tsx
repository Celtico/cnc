import { useThree } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef } from "react"
import { CircleGeometry, MeshBasicMaterial, type InstancedMesh } from "three"
import type { Hole } from "../../../core/model"
import { HOLE_COLOR, holeMarkMatrices, PROPOSED_HOLE_COLOR } from "../hardwareShapes"

/** Disc de radi 1 i material comuns a totes les marques de forat (cada forat és una instància, escalada al seu radi). */
const HOLE_GEO = new CircleGeometry(1, 20)
const HOLE_MAT = new MeshBasicMaterial({ color: HOLE_COLOR })
HOLE_MAT.userData.shared = true
/** Forats proposats (ferratge importat sense confirmar): taronja, com la insígnia «Sense confirmar». */
export const PROPOSED_MAT = new MeshBasicMaterial({ color: PROPOSED_HOLE_COLOR })
PROPOSED_MAT.userData.shared = true

/**
 * Marques dels forats d'una peça (discos foscos a la cara A, a la B o al cantell): una sola malla instanciada per peça
 * amb la geometria i el material comuns (abans, una malla i un material per forat: centenars per moble).
 */
export function HoleMarks({ holes, thickness, material = HOLE_MAT }: { holes: Hole[]; thickness: number; material?: MeshBasicMaterial }) {
  const marks = useMemo(() => holeMarkMatrices(holes, thickness), [holes, thickness])
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((st) => st.invalidate)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    marks.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [marks, invalidate])
  if (!marks.length) return null
  // La mida de la malla és el nombre de forats: si canvia, se'n fa una de nova.
  return <instancedMesh key={marks.length} ref={ref} args={[HOLE_GEO, material, marks.length]} />
}
