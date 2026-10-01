import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
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
  // Si desapareix amb el ratolí a sobre (es deselecciona), el cursor no es queda en «grab».
  useEffect(() => () => void (document.body.style.cursor = ""), [])
  // r3f no fa arribar el `pointercancel` a l'objecte (un gest del sistema a l'iPhone, girar la pantalla…): se
  // n'escolta un a la finestra perquè l'arrossegament s'acabi igualment (els `onEnd` ja ignoren un final repetit).
  const start = (a: Axis, e: ThreeEvent<PointerEvent>) => {
    onStart(a, e)
    const id = e.pointerId
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("pointerup", cancel)
      onEnd({ target: null, pointerId: id } as unknown as ThreeEvent<PointerEvent>)
    }
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("pointerup", cancel)
  }
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
            onPointerDown={(e) => start(a, e)}
            // El clic de la fletxa no arriba a les peces de davant (si no, triaria una altra cosa i es perdria la selecció).
            onClick={(e) => e.stopPropagation()}
            // Sense cap botó premut (s'ha perdut el final): s'acaba en lloc de moure.
            onPointerMove={(e) => (e.buttons === 0 ? onEnd(e) : onMove(e))}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
          >
            {/* Tija i punta (amb el ratolí a sobre, el doble de gruixudes); un cilindre invisible més gruixut per agafar-la fàcilment. */}
            <mesh position={[0, 2, 0]} renderOrder={30} raycast={noRaycast}>
              <cylinderGeometry args={[on ? 0.2 : 0.1, on ? 0.2 : 0.1, 3, 10]} />
              {mat}
            </mesh>
            <mesh position={[0, on ? 4.15 : 3.9, 0]} renderOrder={30} raycast={noRaycast}>
              <coneGeometry args={[on ? 0.8 : 0.4, on ? 1.6 : 1.1, 16]} />
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
