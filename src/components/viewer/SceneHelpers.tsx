import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { PMREMGenerator, type Object3D } from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import type { SceneGetter } from "./render/RenderDialog"
import { onPhotoTextureLoaded } from "./textures"

/* Peces del visor 3D compartides per tots els editors (mobles, objectes, ambients). */

/**
 * Entorn d'estudi procedural (`RoomEnvironment` de three, sense descàrregues: funciona
 * offline) filtrat amb PMREM: dona la llum difusa i els reflexos que fan que els materials
 * es vegin com a model-viewer.
 */
export function StudioEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    // Amb `frameloop="demand"` no hi hauria cap fotograma nou fins a tocar res.
    invalidate()
    return () => {
      if (scene.environment === env) scene.environment = null
      env.dispose()
      pmrem.dispose()
      room.dispose()
    }
  }, [gl, scene, intensity, invalidate])
  return null
}

/**
 * Visors amb `frameloop="demand"`: quan acaba de carregar-se una foto de textura (es baixa a part), es torna a pintar;
 * si no, la peça es quedaria negra fins a moure la càmera.
 */
export function TextureRefresh() {
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => onPhotoTextureLoaded(() => invalidate()), [invalidate])
  return null
}

/** Dona accés a l'escena i la càmera (per al render per CPU, `RenderDialog`). */
export function SceneAccess({ onAccess }: { onAccess: (get: SceneGetter) => void }) {
  const get = useThree((st) => st.get)
  useEffect(() => {
    onAccess(() => {
      const st = get()
      return {
        scene: st.scene,
        camera: st.camera,
        width: st.size.width,
        height: st.size.height,
        // Imatge del visor (es pinta ara mateix: el buffer de WebGL no es conserva), sense els elements d'edició
        // (botons +, nanses, gizmo: `userData.editorOnly`), que tampoc surten al render.
        snapshot: () => {
          const hidden: Object3D[] = []
          st.scene.traverse((o) => {
            if (o.userData.editorOnly && o.visible) hidden.push(o)
          })
          for (const o of hidden) o.visible = false
          st.gl.render(st.scene, st.camera)
          const url = st.gl.domElement.toDataURL("image/png")
          for (const o of hidden) o.visible = true
          st.gl.render(st.scene, st.camera)
          return url
        },
      }
    })
  }, [onAccess, get])
  return null
}
