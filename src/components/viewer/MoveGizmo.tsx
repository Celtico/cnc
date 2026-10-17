import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import type { Group } from "three"
import { frontRaycast, noRaycast } from "./gizmoRaycast"
import { usePixelScale, type Axis } from "./pixelScale"
import { useViewerCursor } from "./cursor"

const AXIS_COLOR: Record<Axis, string> = { x: "#e5484d", y: "#30a46c", z: "#0090ff" }
/** La bola del mig (moure lliure): blanca, com el centre dels gizmos de Blender o Fusion. */
const FREE_COLOR = "#f4f4f5"

/** Cap on mou una nansa del gizmo: una fletxa (un eix) o la bola del mig (`free`, lliure). */
export type GizmoHandle = Axis | "free"
const EDITOR_ONLY = { editorOnly: true }

/**
 * Gizmo de moviment (editor i ambients): una fletxa per direcció (vermella de costat, verda amunt, blava endavant) i, al
 * mig, una **bola per moure lliure** (per decisió de l'usuari, 2026-10-17: qui l'usa decideix sobre quin pla: el terra,
 * la paret o el de la pantalla), de mida constant a la pantalla i sempre per sobre de tot. Només es mou amb el gizmo (el
 * cos de l'objecte no s'arrossega): així sempre se sap cap on es mourà. Les nanses passen per davant de tot també per
 * tocar-les (`frontRaycast`), encara que l'objecte sigui dins d'un altre.
 */
export function MoveGizmo({
  axes,
  free = true,
  active,
  onStart,
  onMove,
  onEnd,
}: {
  axes: Axis[]
  /** La bola del mig (moure lliure). */
  free?: boolean
  active: GizmoHandle | null
  onStart: (a: GizmoHandle, e: ThreeEvent<PointerEvent>) => void
  onMove: (e: ThreeEvent<PointerEvent>) => void
  onEnd: (e: ThreeEvent<PointerEvent>) => void
}) {
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 16)
  const [hover, setHover] = useState<GizmoHandle | null>(null)
  // `grab` a sobre d'una fletxa i `grabbing` mentre s'arrossega (com la nansa dels mòduls); si desapareix amb el
  // ratolí a sobre (es deselecciona), `useViewerCursor` treu el seu i no es queda en «grab».
  const cursor = useViewerCursor()
  useEffect(() => cursor.drag(active ? "grabbing" : null), [cursor, active])
  // r3f no fa arribar el `pointercancel` a l'objecte (un gest del sistema a l'iPhone, girar la pantalla…): se
  // n'escolta un a la finestra perquè l'arrossegament s'acabi igualment (els `onEnd` ja ignoren un final repetit).
  const start = (a: GizmoHandle, e: ThreeEvent<PointerEvent>) => {
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
  // Els mateixos esdeveniments per a les fletxes i la bola.
  const handlers = (a: GizmoHandle) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(a)
      cursor.hover(a === "free" ? "move" : "grab")
    },
    onPointerOut: () => {
      setHover(null)
      cursor.hover(null)
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => start(a, e),
    // El clic de la nansa no arriba a les peces de davant (si no, triaria una altra cosa i es perdria la selecció).
    onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
    // Sense cap botó premut (s'ha perdut el final): s'acaba en lloc de moure.
    onPointerMove: (e: ThreeEvent<PointerEvent>) => (e.buttons === 0 ? onEnd(e) : onMove(e)),
    onPointerUp: onEnd,
    onPointerCancel: onEnd,
  })
  const freeOn = hover === "free" || active === "free"
  return (
    // Element d'edició: la imatge del visor per al render no el porta (`SceneAccess`).
    <group ref={scaler} userData={EDITOR_ONLY}>
      {axes.map((a) => {
        const on = hover === a || active === a
        const mat = <meshBasicMaterial color={AXIS_COLOR[a]} transparent opacity={active && active !== a ? 0.25 : on ? 1 : 0.85} depthTest={false} depthWrite={false} />
        return (
          <group key={a} rotation={rot[a]} {...handlers(a)}>
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
      {free && (
        <group {...handlers("free")}>
          <mesh renderOrder={31} raycast={noRaycast}>
            <sphereGeometry args={[freeOn ? 0.95 : 0.7, 20, 14]} />
            <meshBasicMaterial color={FREE_COLOR} transparent opacity={active && active !== "free" ? 0.25 : freeOn ? 1 : 0.9} depthTest={false} depthWrite={false} />
          </mesh>
          {/* Una mica més gran per agafar-la fàcilment amb el dit. */}
          <mesh visible={false} raycast={frontRaycast}>
            <sphereGeometry args={[1.1, 12, 8]} />
          </mesh>
        </group>
      )}
    </group>
  )
}
