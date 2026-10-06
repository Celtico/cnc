import { Billboard } from "@react-three/drei"
import { useRef, useState } from "react"
import type { IconType } from "react-icons"
import { LuCopy, LuPencil, LuTrash2 } from "react-icons/lu"
import type { Group } from "three"
import { useViewerCursor } from "./cursor"
import { frontRaycast, noRaycast } from "./gizmoRaycast"
import { useIconTexture } from "./iconTexture"
import { usePixelScale } from "./pixelScale"

/** Elements d'edició: la imatge del visor per al render no els porta (`SceneAccess`). */
const EDITOR_ONLY = { editorOnly: true }

/** Les accions de la barra flotant d'un ferratge col·locat (les mateixes de la llista de l'inspector i del teclat). */
export interface FittingToolbarActions {
  onDuplicate: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * **Barra flotant d'un ferratge col·locat triat** (com la d'un configurador de fabricant o la de Figma sobre la selecció):
 * Duplicar · Editar · Eliminar, amb les icones del catàleg. Malles 3D de mida constant a la pantalla (`usePixelScale`,
 * `Billboard`), no `Html` de drei, per sobre de tot (`depthTest` fora i `frontRaycast`: es poden clicar encara que el
 * ferratge sigui darrere d'una peça) i `userData.editorOnly` (el render no la porta). Va a la posició `at` (unitats de
 * l'escena, al marc de qui la posa), uns píxels per sobre a la pantalla.
 */
export function FittingToolbar({ id, at, actions }: { id: string; at: [number, number, number]; actions: FittingToolbarActions }) {
  const scaler = useRef<Group>(null)
  usePixelScale(scaler, 13)
  const buttons: { key: string; label: string; Icon: IconType; danger?: boolean; run: () => void }[] = [
    { key: "dup", label: "Duplicar", Icon: LuCopy, run: () => actions.onDuplicate(id) },
    { key: "edit", label: "Editar", Icon: LuPencil, run: () => actions.onEdit(id) },
    { key: "del", label: "Eliminar", Icon: LuTrash2, danger: true, run: () => actions.onRemove(id) },
  ]
  return (
    <group position={at} userData={EDITOR_ONLY}>
      <Billboard>
        <group ref={scaler}>
          {/* Fons de la barra (no es pot tocar: només els botons). */}
          <mesh position={[0, 2.4, -0.01]} renderOrder={30} raycast={noRaycast}>
            <planeGeometry args={[7.6, 2.6]} />
            <meshBasicMaterial color="#2b2620" transparent opacity={0.85} depthTest={false} depthWrite={false} />
          </mesh>
          {buttons.map((b, i) => (
            <ToolbarButton key={b.key} x={(i - 1) * 2.4} y={2.4} label={b.label} Icon={b.Icon} danger={b.danger} onClick={b.run} />
          ))}
        </group>
      </Billboard>
    </group>
  )
}

function ToolbarButton({ x, y, label, Icon, danger, onClick }: { x: number; y: number; label: string; Icon: IconType; danger?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  const tex = useIconTexture(Icon)
  return (
    <group position={[x, y, 0]}>
      <mesh
        renderOrder={31}
        raycast={frontRaycast}
        name={label}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          cursor.hover("pointer")
        }}
        onPointerOut={() => {
          setHover(false)
          cursor.hover(null)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color={hover ? (danger ? "#c0392b" : "#b57a37") : "#2b2620"} transparent depthTest={false} depthWrite={false} />
      </mesh>
      {tex && (
        <mesh position={[0, 0, 0.01]} renderOrder={32} raycast={noRaycast}>
          <planeGeometry args={[1.15, 1.15]} />
          <meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
