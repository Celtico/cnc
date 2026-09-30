import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { PMREMGenerator } from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import type { SceneGetter } from "./render/RenderDialog"

/* Peces del visor 3D compartides per tots els editors (mobles, objectes, ambients). */

/**
 * Entorn d'estudi procedural (`RoomEnvironment` de three, sense descàrregues: funciona
 * offline) filtrat amb PMREM: dona la llum difusa i els reflexos que fan que els materials
 * es vegin com a model-viewer.
 */
export function StudioEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    return () => {
      if (scene.environment === env) scene.environment = null
      env.dispose()
      pmrem.dispose()
      room.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

/** Dona accés a l'escena i la càmera (per al render per CPU, `RenderDialog`). */
export function SceneAccess({ onAccess }: { onAccess: (get: SceneGetter) => void }) {
  const get = useThree((st) => st.get)
  useEffect(() => {
    onAccess(() => {
      const st = get()
      return { scene: st.scene, camera: st.camera, width: st.size.width, height: st.size.height }
    })
  }, [onAccess, get])
  return null
}
