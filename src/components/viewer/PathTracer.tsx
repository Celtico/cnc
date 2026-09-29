import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RGBAFormat, type Scene } from "three"
import { WebGLPathTracer } from "three-gpu-pathtracer"

/**
 * Ray tracing (path tracing progressiu, `three-gpu-pathtracer`): llum rebotada, ombres
 * suaus i reflexos de debò. Va acumulant mostres mentre la càmera està quieta; en moure-la
 * torna a començar. Tot es calcula a la GPU del dispositiu (funciona offline).
 *
 * `version` canvia quan canvia l'escena (peces, materials, obertura…): es reconstrueix.
 */
export function PathTracer({ version, onSamples }: { version: unknown; onSamples?: (n: number) => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null

  const pt = useMemo(() => {
    const p = new WebGLPathTracer(gl)
    p.tiles.set(2, 2)
    p.bounces = 6
    p.minSamples = 1
    p.renderDelay = 0
    p.fadeDuration = 250
    p.filterGlossyFactor = 0.5
    return p
  }, [gl])
  useEffect(() => () => pt.dispose(), [pt])

  // Llum d'estudi: cel suau (més clar a dalt) que il·lumina de tot arreu.
  useEffect(() => {
    const env = studioEnvironment()
    const prev = scene.environment
    scene.environment = env
    return () => {
      scene.environment = prev
      env.dispose()
    }
  }, [scene])

  // Reconstrucció quan canvia l'escena (amb una mica d'espera: animacions d'obrir i explosió).
  useEffect(() => {
    const id = window.setTimeout(() => pt.setScene(scene as Scene, camera), 350)
    return () => window.clearTimeout(id)
  }, [pt, scene, camera, version])

  // Càmera: en orbitar o fer zoom, es torna a començar.
  useEffect(() => {
    if (!controls) return
    const on = () => pt.updateCamera()
    controls.addEventListener("change", on)
    return () => controls.removeEventListener("change", on)
  }, [controls, pt])

  useEffect(() => {
    if (!onSamples) return
    const id = window.setInterval(() => onSamples(Math.floor(pt.samples)), 500)
    return () => window.clearInterval(id)
  }, [pt, onSamples])

  // Prioritat 1: el path tracer pinta el canvas (r3f deixa de fer el render normal).
  useFrame(() => {
    if (pt.scene) pt.renderSample()
    else gl.render(scene, camera)
  }, 1)
  return null
}

/** Entorn equirectangular procedural: cel càlid a dalt, terra fosc a baix (sense descàrregues). */
function studioEnvironment(): DataTexture {
  const w = 64
  const h = 32
  const data = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1) // 0 = baix, 1 = dalt
    const up = Math.max(0, (t - 0.5) * 2)
    const down = Math.max(0, (0.5 - t) * 2)
    const r = 0.85 + 0.6 * up - 0.55 * down
    const g = 0.82 + 0.58 * up - 0.55 * down
    const b = 0.78 + 0.62 * up - 0.52 * down
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 1
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType)
  tex.mapping = EquirectangularReflectionMapping
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}
