import { useEffect, useMemo, useState } from "react"
import type { ThreeEvent } from "@react-three/fiber"
import type { MaterialPref, ModelObject } from "../../../core/model"
import { BoxFrame } from "../BoxFrame"
import { useViewerCursor } from "../cursor"
import { disposeModelInstance, modelInstance, onModelsLoaded } from "../models3d"
import { S } from "./constants"

/**
 * Model 3D (`.glb`) d'un objecte: la còpia de `modelInstance` (m, coordenades de la composició, com les peces). Es torna
 * a fer quan acaba de carregar-se o canvia el model, la mida, la posició o el gir. Comparteix geometria i materials amb
 * la memòria de `models3d` (`userData.sharedModel`): no s'alliberen mai aquí (`dispose={null}`). `shift`: desplaçament
 * en viu mentre s'arrossega (m).
 */
export function ModelMesh({ m, selected, shift, onSelect, materials }: { m: ModelObject; selected: boolean; shift?: [number, number, number]; onSelect?: (id: string) => void; materials?: MaterialPref[] }) {
  const [loaded, setLoaded] = useState(0)
  useEffect(() => onModelsLoaded(() => setLoaded((v) => v + 1)), [])
  const { id, name, src, x, y, z, w, h, d, rot, material } = m
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `loaded`: es refà quan acaba de carregar un model
  const obj = useMemo(() => modelInstance({ id, name, src, x, y, z, w, h, d, rot, ...(material ? { material } : {}) }, materials), [id, name, src, x, y, z, w, h, d, rot, material, materials, loaded])
  // El material propi (de Preferències) és de la instància: s'allibera quan se'n fa una altra.
  useEffect(() => () => void (obj && disposeModelInstance(obj)), [obj])
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  if (!obj) return null
  return (
    <group position={shift ?? [0, 0, 0]}>
      <primitive
        object={obj}
        dispose={null}
        onClick={onSelect ? (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return
          e.stopPropagation()
          onSelect(id)
        } : undefined}
        onPointerOver={onSelect ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          cursor.hover("pointer")
          if (e.pointerType === "mouse") setHover(true)
        } : undefined}
        onPointerOut={onSelect ? () => {
          setHover(false)
          cursor.hover(null)
        } : undefined}
      />
      {/* Seleccionat: contorn gruixut; ratolí a sobre: prim (com els objectes). */}
      {(selected || hover) && (
        <group position={[(x + w / 2) * S, (y + h / 2) * S, (z + d / 2) * S]}>
          <BoxFrame w={(w + 4) * S} h={(h + 4) * S} d={(d + 4) * S} strong={selected} />
        </group>
      )}
    </group>
  )
}
