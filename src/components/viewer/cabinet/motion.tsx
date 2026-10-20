import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { Vector3, type Group } from "three"
import type { transformAt } from "../opening"
import { animStep, useExplode } from "./anim"
import { EXPLODE_MM, S } from "./constants"

/** Aplica el moviment d'obertura (gir sobre el pivot o desplaçament) a una peça (també al muntatge dels ferratges). */
export function MovingPanel({ transform, children }: { transform: ReturnType<typeof transformAt> | null; children: React.ReactNode }) {
  const outer = useRef<Group>(null)
  const target = useRef(transform)
  const running = useRef(false)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    target.current = transform
    invalidate()
  }, [transform, invalidate])
  useFrame((st, dt) => {
    const g = outer.current
    if (!g) return
    const tr = target.current
    const rx = tr?.rotation[0] ?? 0
    const ry = tr?.rotation[1] ?? 0
    const rz = tr?.rotation[2] ?? 0
    const tx = (tr?.translation[0] ?? 0) * S
    const ty = (tr?.translation[1] ?? 0) * S
    const tz = (tr?.translation[2] ?? 0) * S
    const px = (tr?.pivot[0] ?? 0) * S + tx
    const py = (tr?.pivot[1] ?? 0) * S + ty
    const pz = (tr?.pivot[2] ?? 0) * S + tz
    const left = Math.max(Math.abs(rx - g.rotation.x), Math.abs(ry - g.rotation.y), Math.abs(rz - g.rotation.z), Math.abs(px - g.position.x), Math.abs(py - g.position.y), Math.abs(pz - g.position.z))
    // Quasi a lloc: s'hi posa i s'atura (sense demanar més fotogrames).
    if (left < 1e-5) {
      running.current = false
      if (left === 0) return
      g.rotation.x = rx
      g.rotation.y = ry
      g.rotation.z = rz
      g.position.set(px, py, pz)
      return
    }
    const k = Math.min(1, animStep(running, dt) * 8)
    g.rotation.x += (rx - g.rotation.x) * k
    g.rotation.y += (ry - g.rotation.y) * k
    g.rotation.z += (rz - g.rotation.z) * k
    g.position.x += (px - g.position.x) * k
    g.position.y += (py - g.position.y) * k
    g.position.z += (pz - g.position.z) * k
    st.invalidate()
  })
  const pivot = transform?.pivot ?? [0, 0, 0]
  return (
    <group ref={outer} position={[pivot[0] * S, pivot[1] * S, pivot[2] * S]}>
      <group position={[-pivot[0] * S, -pivot[1] * S, -pivot[2] * S]}>{children}</group>
    </group>
  )
}

/** El que no és una peça però hi va enganxat (les potes de l'app sota la base) es mou amb ella a la vista explosionada. */
export function ExplodeWith({ exploded, dir, children }: { exploded: boolean; dir: [number, number, number]; children: React.ReactNode }) {
  const group = useRef<Group>(null)
  const offset = useMemo(() => new Vector3(...dir).multiplyScalar(EXPLODE_MM * S), [dir])
  useExplode(group, exploded, offset)
  return <group ref={group}>{children}</group>
}
