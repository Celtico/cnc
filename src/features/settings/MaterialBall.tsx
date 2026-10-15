import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect, useState } from "react"
import { CanvasTexture, CircleGeometry, MeshStandardMaterial, NearestFilter, type MeshPhysicalMaterial, NeutralToneMapping, RepeatWrapping, SphereGeometry, SRGBColorSpace, type WebGLRenderer } from "three"
import type { MaterialPref } from "../../core/model"
import { BALL_MM, ballKey, ballMaterial } from "../../components/viewer/ballMaterial"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { StudioEnvironment, TextureRefresh } from "../../components/viewer/SceneHelpers"
import { disposeMaterial } from "../../components/viewer/textures"

/** Radi de la bola (m). */
const R = BALL_MM / 2000
/** Costat d'una casella del terra (m): 50 mm, per llegir la mida de la bola. */
const CHECK = 0.05
/** Radi del terra (m): s'esvaeix cap a la vora i s'hi veu el fons de l'estudi. */
const FLOOR_R = 1.4

/**
 * Bola de material (com les vistes prèvies de Blender, Substance o Cinema 4D): una esfera de 300 mm amb el material
 * fet pel mateix camí que les peces del visor (`ballMaterial`), sobre un terra d'estudi de caselles que s'esvaeix, amb
 * l'entorn d'estudi de Presentació (`StudioEnvironment`). Pinta només quan cal (`frameloop="demand"`); s'orbita
 * arrossegant (sense zoom ni desplaçar). Canviar el material només refà el material (el renderitzador es queda).
 */
export function MaterialBall({ m, dark }: { m: MaterialPref; dark: boolean }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, LOW_MEMORY ? 1.5 : 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ fov: 24, near: 0.05, far: 20, position: [0, R + 0.34, 1.02] }}
      // Mida sense transformacions (`offsetSize`): el diàleg s'obre escalat i, si no, el llenç quedava petit.
      resize={{ offsetSize: true }}
      style={{ touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        // Per comprovar que no queden recursos a la GPU (`renderer.info.memory`) des de les proves amb Playwright.
        if (import.meta.env.DEV) (window as unknown as { __materialBall?: WebGLRenderer }).__materialBall = gl
      }}
    >
      <StudioEnvironment intensity={0.6} />
      <TextureRefresh />
      <hemisphereLight args={["#ffffff", "#8a7a60", 0.15]} />
      {/* Llum principal com la de Presentació (a dalt a la dreta) i més forta, perquè la bola tingui volum i el lacat
          hi faci el reflex; un farciment suau a l'esquerra i un retall darrere que dibuixa la vora. */}
      <directionalLight position={[2.2, 3.6, 2.6]} intensity={2.1} />
      <directionalLight position={[-3, 1.2, 1.5]} intensity={0.3} />
      <directionalLight position={[-1.2, 2.4, -3]} intensity={1.1} />
      <Ball m={m} />
      <Floor dark={dark} />
      <OrbitControls makeDefault enableZoom={false} enablePan={false} enableDamping dampingFactor={0.12} rotateSpeed={0.7} target={[0, R, 0]} minPolarAngle={Math.PI * 0.18} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  )
}

/** L'esfera: la geometria es fa un cop; el material, cada cop que canvia l'aspecte (i l'anterior s'allibera). */
function Ball({ m }: { m: MaterialPref }) {
  const invalidate = useThree((st) => st.invalidate)
  const [geo, setGeo] = useState<SphereGeometry | null>(null)
  const [mat, setMat] = useState<MeshPhysicalMaterial | null>(null)
  useEffect(() => {
    const g = new SphereGeometry(R, 96, 64)
    setGeo(g)
    return () => g.dispose()
  }, [])
  const key = ballKey(m)
  useEffect(() => {
    const next = ballMaterial(m)
    setMat(next)
    return () => disposeMaterial(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia l'aspecte (`ballKey`), no el nom ni els gruixos
  }, [key])
  useEffect(() => invalidate(), [geo, mat, invalidate])
  if (!geo || !mat) return null
  // La costura de la volta (on es tanca la u, a −X) cap enrere.
  return <mesh geometry={geo} material={mat} position={[0, R, 0]} rotation={[0, -Math.PI / 2, 0]} dispose={null} />
}

/** Terra d'estudi: caselles discretes de 50 mm que s'esvaeixen cap a la vora i l'ombra de contacte de la bola. */
function Floor({ dark }: { dark: boolean }) {
  const invalidate = useThree((st) => st.invalidate)
  const [res, setRes] = useState<{ floor: MeshStandardMaterial; shadow: MeshStandardMaterial; disc: CircleGeometry; blob: CircleGeometry } | null>(null)
  useEffect(() => {
    const checker = canvasTexture(2, (c) => {
      c.fillStyle = dark ? "#3a3a3d" : "#e8e5e0"
      c.fillRect(0, 0, 2, 2)
      c.fillStyle = dark ? "#333336" : "#d6d1ca"
      c.fillRect(0, 0, 1, 1)
      c.fillRect(1, 1, 1, 1)
    })
    checker.magFilter = NearestFilter
    checker.wrapS = checker.wrapT = RepeatWrapping
    checker.repeat.set(FLOOR_R / CHECK, FLOOR_R / CHECK)
    checker.colorSpace = SRGBColorSpace
    checker.anisotropy = 8
    // Esvaïment (alfa): ple al mig, transparent a la vora.
    const fade = canvasTexture(128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, "#fff")
      g.addColorStop(0.28, "#fff")
      g.addColorStop(0.75, "#000")
      c.fillStyle = g
      c.fillRect(0, 0, 128, 128)
    })
    const soft = canvasTexture(128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, "#fff")
      g.addColorStop(0.35, "#888")
      g.addColorStop(1, "#000")
      c.fillStyle = g
      c.fillRect(0, 0, 128, 128)
    })
    const floor = new MeshStandardMaterial({ map: checker, alphaMap: fade, transparent: true, depthWrite: false, roughness: 0.85 })
    const shadow = new MeshStandardMaterial({ color: "#000000", alphaMap: soft, transparent: true, opacity: dark ? 0.6 : 0.45, depthWrite: false, roughness: 1 })
    const disc = new CircleGeometry(FLOOR_R, 64).rotateX(-Math.PI / 2)
    const blob = new CircleGeometry(R * 1.35, 48).rotateX(-Math.PI / 2)
    setRes({ floor, shadow, disc, blob })
    invalidate()
    return () => {
      disposeMaterial(floor)
      disposeMaterial(shadow)
      disc.dispose()
      blob.dispose()
    }
  }, [dark, invalidate])
  if (!res) return null
  return (
    <>
      <mesh geometry={res.disc} material={res.floor} renderOrder={-2} dispose={null} />
      <mesh geometry={res.blob} material={res.shadow} position={[0, 0.0005, 0]} renderOrder={-1} dispose={null} />
    </>
  )
}

function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D) => void): CanvasTexture {
  const cv = document.createElement("canvas")
  cv.width = cv.height = size
  const c = cv.getContext("2d")
  if (c) draw(c)
  return new CanvasTexture(cv)
}
