import { useFrame, type ThreeElements } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { EdgesGeometry, LineBasicMaterial, LineSegments, type Group, type Material, type Mesh } from "three"

/** Una malla que es dibuixa de debò (no les nanses invisibles, les instàncies ni les línies gruixudes de drei). */
function drawable(o: Mesh): boolean {
  if (!o.isMesh || (o as { isInstancedMesh?: boolean }).isInstancedMesh || o.type === "Line2" || o.type === "LineSegments2") return false
  const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[]
  // Les peces del Filferro sol ja són transparents del tot (i dibuixen els seus cantells): no.
  return mats.some((m) => m.visible && m.opacity > 0.01)
}

/**
 * El grup del moble amb el Filferro sol (Modelatge, com el Taulell, cel 2026-11-08: «es veuen les coses»): les malles que
 * es veuen (potes, frontisses, tiradors, ferratges) s'amaguen i en surten els cantells en línies. Les nanses d'edició
 * (`userData.editorOnly`) no. Es mira cada mig segon si n'ha aparegut alguna de nova (els models es carreguen a part).
 */
export function LinesOnly({ on, color, children, ...props }: ThreeElements["group"] & { on: boolean; color: string }) {
  const ref = useRef<Group>(null)
  const made = useRef(new Map<Mesh, LineSegments>())
  const mat = useMemo(() => new LineBasicMaterial({ color }), [color])
  const last = useRef(0)
  const clear = () => {
    for (const [m, ls] of made.current) {
      m.visible = true
      ls.removeFromParent()
      ls.geometry.dispose()
    }
    made.current.clear()
  }
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    if (!on) {
      if (made.current.size) clear()
      return
    }
    if (clock.elapsedTime - last.current < 0.5) return
    last.current = clock.elapsedTime
    // Les que ja no hi són; les altres segueixen la seva malla (una porta que s'obre).
    for (const [m, ls] of made.current)
      if (!m.parent) {
        ls.removeFromParent()
        ls.geometry.dispose()
        made.current.delete(m)
      } else {
        if (m.matrixAutoUpdate) m.updateMatrix()
        ls.matrix.copy(m.matrix)
      }
    const todo: Mesh[] = []
    const walk = (o: Group | Mesh) => {
      if (o.userData.editorOnly || o.userData.lineCopy) return
      if ((o as Mesh).isMesh && o.visible && !made.current.has(o as Mesh) && drawable(o as Mesh)) todo.push(o as Mesh)
      for (const c of o.children) walk(c as Group)
    }
    walk(g)
    for (const m of todo) {
      const ls = new LineSegments(new EdgesGeometry(m.geometry, 25), mat)
      ls.userData.lineCopy = true
      ls.raycast = () => {}
      ls.matrixAutoUpdate = false
      // Una malla amb la matriu posada a mà (`matrixAutoUpdate` fals) no es refà des de la posició.
      if (m.matrixAutoUpdate) m.updateMatrix()
      ls.matrix.copy(m.matrix)
      m.parent!.add(ls)
      m.visible = false
      made.current.set(m, ls)
    }
  })
  useEffect(() => () => clear(), [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}
