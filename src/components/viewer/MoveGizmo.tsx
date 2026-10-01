import type { ThreeEvent } from "@react-three/fiber"
import { useRef, useState } from "react"
import type { Group } from "three"
import { frontRaycast, noRaycast } from "./gizmoRaycast"
import { usePixelScale, type Axis } from "./pixelScale"

const AXIS_COLOR: Record<Axis, string> = { x: "#e5484d", y: "#30a46c", z: "#0090ff" }

/**
 * Gizmo de moviment (editor i ambients): una fletxa per direcció (vermella de costat, verda amunt, blava endavant), de
 * mida constant a la pantalla i sempre per sobre de tot. Només es mou amb les fletxes (el cos de l'objecte no
 * s'arrossega): així sempre se sap cap on es mourà. Les fletxes passen per davant de tot també per tocar-les
 * (`frontRaycast`), encara que l'objecte sigui dins d'un altre.
 */
export function MoveGizmo({
  axes,
  active,
  onStart,
  onMove,
  onEnd,
}: {
  axes: Axis[]
  active: Axis | null
  onStart: (a: Axis, e: ThreeEvent<PointerEvent>) => void
  onMove: (e: ThreeEvent<PointerEvent>) => void
  onEnd: (e: ThreeEvent<PointerEvent>) => void
}) {
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 16)
  const [hover, setHover] = useState<Axis | null>(null)
  const rot: Record<Axis, [number, number, number]> = { x: [0, 0, -Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] }
  return (
    <group ref={scaler}>
      {axes.map((a) => {
        const on = hover === a || active === a
        const mat = <meshBasicMaterial color={AXIS_COLOR[a]} transparent opacity={active && active !== a ? 0.25 : on ? 1 : 0.85} depthTest={false} depthWrite={false} />
        return (
          <group
            key={a}
            rotation={rot[a]}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(a)
              document.body.style.cursor = "grab"
            }}
            onPointerOut={() => {
              setHover(null)
              if (!active) document.body.style.cursor = ""
            }}
            onPointerDown={(e) => onStart(a, e)}
            // El clic de la fletxa no arriba a les peces de davant (si no, triaria una altra cosa i es perdria la selecció).
            onClick={(e) => e.stopPropagation()}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
          >
            {/* Tija i punta; un cilindre invisible més gruixut per agafar-la fàcilment. */}
            <mesh position={[0, 2, 0]} renderOrder={30} raycast={noRaycast}>
              <cylinderGeometry args={[on ? 0.14 : 0.1, on ? 0.14 : 0.1, 3, 10]} />
              {mat}
            </mesh>
            <mesh position={[0, 3.9, 0]} renderOrder={30} raycast={noRaycast}>
              <coneGeometry args={[on ? 0.5 : 0.4, 1.1, 16]} />
              {mat}
            </mesh>
            <mesh position={[0, 2.5, 0]} visible={false} raycast={frontRaycast}>
              <cylinderGeometry args={[0.6, 0.6, 4.2, 8]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
