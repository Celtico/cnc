import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { Matrix4, Object3D } from "three"
import { PanelMesh } from "../../components/viewer/CabinetViewer"
import { TextureRefresh } from "../../components/viewer/SceneHelpers"
import { LIGHT_SPEC, type LightId } from "../../components/viewer/presentationScene"
import { cabinetToPlane, type Camera, type SceneOptions } from "../../core/photo/camera"
import type { MaterialPref, Panel } from "../../core/model"

const S = 0.001

/**
 * Matriu que porta un punt del moble (en metres, com al visor 3D) a l'espai de càmera de
 * three.js (x dreta, y amunt, mirant cap a −z), a partir de la càmera calibrada de la foto
 * (visió per computador: x dreta, y avall, z endavant, en mm).
 */
function cabinetToThreeCamera(cam: Camera, o: SceneOptions): Matrix4 {
  const at = (x: number, y: number, z: number) => cabinetToPlane([x, y, z], o)
  // cabinetToPlane és afí: origen + 3 eixos.
  const a0 = at(0, 0, 0)
  const ax = at(1, 0, 0).map((v, i) => v - a0[i]!)
  const ay = at(0, 1, 0).map((v, i) => v - a0[i]!)
  const az = at(0, 0, 1).map((v, i) => v - a0[i]!)
  const A = new Matrix4().set(ax[0]!, ay[0]!, az[0]!, 0, ax[1]!, ay[1]!, az[1]!, 0, ax[2]!, ay[2]!, az[2]!, 0, 0, 0, 0, 1)
  const r = cam.r
  const R = new Matrix4().set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1)
  const F = new Matrix4().makeScale(1, -1, -1)
  const lin = F.clone().multiply(R).multiply(A)
  // Translació: F · (R · a0 + t), en metres.
  const c0 = [
    r[0] * a0[0] + r[1] * a0[1] + r[2] * a0[2] + cam.t[0],
    r[3] * a0[0] + r[4] * a0[1] + r[5] * a0[2] + cam.t[1],
    r[6] * a0[0] + r[7] * a0[1] + r[8] * a0[2] + cam.t[2],
  ]
  lin.setPosition(c0[0]! * S, -c0[1]! * S, -c0[2]! * S)
  return lin
}

interface PhotoRenderProps {
  panels: Panel[]
  camera: Camera
  scene: SceneOptions
  /** Mida de la foto (px): el canvas té la mateixa proporció. */
  width: number
  height: number
  size: { width: number; height: number; depth: number }
  materials: MaterialPref[]
  light: LightId
  shadows: boolean
  opacity: number
  /** Mòdul seleccionat: es dibuixa translúcid (per veure'n l'interior); la resta, normal. */
  selectedModule?: number | null
  /** Rep el canvas WebGL, per compondre la imatge descarregada. */
  onCanvas?: (c: HTMLCanvasElement | null) => void
}

/**
 * Moble renderitzat de manera realista (materials, llum i ombres) i encaixat a la foto amb
 * la càmera calibrada. Va sota l'SVG de controls (no rep clics) i té fons transparent.
 * Les ombres cauen sobre plans invisibles (terra i paret) que només pinten l'ombra.
 */
export function PhotoRender({ panels, camera, scene, width, height, size, materials, light, shadows, opacity, selectedModule = null, onCanvas }: PhotoRenderProps) {
  const matrix = useMemo(() => cabinetToThreeCamera(camera, scene), [camera, scene])
  const fov = (2 * Math.atan(height / 2 / camera.f) * 180) / Math.PI
  const spec = LIGHT_SPEC[light]
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const target = useMemo(() => new Object3D(), [])
  // La llum apunta al centre del moble (`target` com a prop: amb una ref, l'efecte corria abans que
  // el Canvas creés la llum i apuntava a l'origen).
  // La funció pot ser nova a cada render del pare: es guarda en una ref i el canvas només es «treu» en desmuntar-se
  // (abans, cada render del pare el posava a null i ja no tornava: la imatge descarregada sortia sense el moble).
  const onCanvasRef = useRef(onCanvas)
  useEffect(() => {
    onCanvasRef.current = onCanvas
  })
  useEffect(() => () => onCanvasRef.current?.(null), [])

  return (
    // Només pinta quan canvia alguna cosa (càmera, moble, llum, textures que arriben).
    <Canvas
      frameloop="demand"
      // PCF amb el radi de sempre (el «soft» de three ja ho és; PCFSoftShadowMap s'ha retirat i avisava).
      shadows={shadows ? "percentage" : false}
      dpr={[1, 2]}
      gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}
      onCreated={({ gl }) => onCanvasRef.current?.(gl.domElement)}
    >
      <TextureRefresh />
      <PerspectiveCamera makeDefault position={[0, 0, 0]} fov={fov} aspect={width / height} near={0.05} far={200} />
      <Environment key={light} resolution={128} frames={1}>
        <Lightformer form="rect" color={spec.sky} intensity={2 * spec.env} position={[0, 5, 2]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" color={spec.sky} intensity={1 * spec.env} position={[-5, 2, 3]} rotation-y={Math.PI / 3} scale={[4, 3, 1]} />
        <Lightformer form="rect" color={spec.sky} intensity={0.6 * spec.env} position={[5, 1.5, 3]} rotation-y={-Math.PI / 3} scale={[4, 3, 1]} />
      </Environment>
      <group matrix={matrix} matrixAutoUpdate={false}>
        {/* La posició com a prop: r3f la posa i demana el fotograma (`frameloop="demand"`). */}
        <primitive object={target} position={[w / 2, h / 2, d / 2]} />
        <hemisphereLight position={[0, 1, 0]} intensity={spec.ambient + 0.15} groundColor="#8a7a60" />
        <directionalLight
          target={target}
          position={[w / 2 + 1.2, h + 1.8, d + 2]}
          color={spec.key}
          intensity={spec.keyIntensity}
          castShadow={shadows}
          shadow-mapSize={2048}
          shadow-bias={-0.0004}
          shadow-normalBias={0.015}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />
        {panels.map((p) => (
          <PanelMesh key={p.id} panel={p} exploded={false} showHoles={false} materialMode="material" materials={materials} edges={false} dimmed={selectedModule !== null && p.module === selectedModule} />
        ))}
        {shadows && (
          <>
            {/* Terra i paret invisibles que només reben l'ombra. */}
            <mesh rotation-x={-Math.PI / 2} position={[w / 2, 0.0005, d / 2]} receiveShadow>
              <planeGeometry args={[w + 2, d + 2]} />
              <shadowMaterial transparent opacity={0.32} />
            </mesh>
            <mesh position={[w / 2, h / 2 + 0.5, -(scene.offsetZ ?? 0) * S - 0.0005]} receiveShadow>
              <planeGeometry args={[w + 2, h + 1]} />
              <shadowMaterial transparent opacity={0.22} />
            </mesh>
          </>
        )}
      </group>
    </Canvas>
  )
}
