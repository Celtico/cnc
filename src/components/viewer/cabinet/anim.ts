import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import type { Group, Vector3 } from "three"

/**
 * Pas de temps d'una animació (s): amb `frameloop="demand"`, el primer fotograma després d'una estona quieta porta tot
 * el temps que no s'ha pintat i saltaria al final de cop; aquest compta com 1/60 s. Després, el temps de debò (com a
 * molt 0,1 s). `running` es posa a false quan arriba.
 */
export function animStep(running: { current: boolean }, dt: number): number {
  const step = running.current ? Math.min(dt, 0.1) : 1 / 60
  running.current = true
  return step
}

/**
 * Explosionar o muntar un grup (una peça, o el que va amb ella): el desplaça `offset` (unitats de l'escena) amb la mateixa
 * animació per a tots; `useFrame` demana els fotogrames fins que arriba.
 */
export function useExplode(group: React.RefObject<Group | null>, exploded: boolean, offset: Vector3) {
  const amount = useRef(exploded ? 1 : 0)
  const running = useRef(false)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [exploded, invalidate])
  useFrame((st, dt) => {
    const g = group.current
    if (!g) return
    const target = exploded ? 1 : 0
    if (amount.current !== target) {
      amount.current += (target - amount.current) * Math.min(1, animStep(running, dt) * 7)
      if (Math.abs(target - amount.current) < 0.002) {
        amount.current = target
        running.current = false
      } else st.invalidate()
    }
    g.position.copy(offset).multiplyScalar(amount.current)
  })
}
