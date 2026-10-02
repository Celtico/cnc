import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { Color, Mesh, MeshBasicMaterial, MeshDepthMaterial, OrthographicCamera, PlaneGeometry, ShaderMaterial, WebGLRenderTarget, type Group } from "three"
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js"
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js"

/**
 * Ombra de contacte (la mateixa imatge que `ContactShadows` de drei: profunditat vista des de sota, desenfocada dues
 * vegades), però:
 *  - allibera els seus recursos (dos render targets, geometria i materials) en canviar de mida o de resolució i en
 *    desmuntar-se: la de drei els deixava a la GPU cada cop que canviava l'escala;
 *  - només es torna a pintar quan l'escena que fa ombra s'ha mogut (signatura de les malles que fan ombra: la seva
 *    posició i geometria), no a cada fotograma: orbitar la càmera no la refà. Amb `frameloop="demand"`, a més, només
 *    hi ha fotogrames quan alguna cosa canvia.
 */
export function ContactShadow({
  position,
  scale,
  opacity = 1,
  blur = 1,
  far = 10,
  resolution = 512,
}: {
  position: [number, number, number]
  /** Costat del pla de l'ombra (m). */
  scale: number
  opacity?: number
  blur?: number
  far?: number
  resolution?: number
}) {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  const group = useRef<Group>(null)
  const res = useMemo(() => {
    const target = new WebGLRenderTarget(resolution, resolution)
    const targetBlur = new WebGLRenderTarget(resolution, resolution)
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false
    const plane = new PlaneGeometry(scale, scale).rotateX(Math.PI / 2)
    const blurPlane = new Mesh(plane)
    const depth = new MeshDepthMaterial()
    depth.depthTest = depth.depthWrite = false
    depth.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ucolor: { value: new Color("#000000") } }
      shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform vec3 ucolor;\nvoid main() {\n")
      // El color de l'ombra multiplicat per la caiguda: el centre queda més fosc.
      shader.fragmentShader = shader.fragmentShader.replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );", "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );")
    }
    const hBlur = new ShaderMaterial(HorizontalBlurShader)
    const vBlur = new ShaderMaterial(VerticalBlurShader)
    hBlur.depthTest = vBlur.depthTest = false
    const shown = new MeshBasicMaterial({ transparent: true, map: target.texture, depthWrite: false })
    const camera = new OrthographicCamera(-scale / 2, scale / 2, scale / 2, -scale / 2, 0, far)
    return { target, targetBlur, plane, blurPlane, depth, hBlur, vBlur, shown, camera }
    // `far` es posa a la càmera a part (no cal refer els render targets).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, scale])
  useEffect(
    () => () => {
      res.target.dispose()
      res.targetBlur.dispose()
      res.plane.dispose()
      res.depth.dispose()
      res.hBlur.dispose()
      res.vBlur.dispose()
      res.shown.dispose()
    },
    [res],
  )
  res.shown.opacity = opacity
  // Signatura de l'última escena pintada a l'ombra (NaN: encara no s'ha pintat).
  const painted = useRef(Number.NaN)
  useEffect(() => {
    res.camera.far = far
    res.camera.updateProjectionMatrix()
    painted.current = Number.NaN
  }, [res, far, blur])

  const blurPass = (amount: number) => {
    const { blurPlane, hBlur, vBlur, target, targetBlur, camera } = res
    blurPlane.visible = true
    blurPlane.material = hBlur
    hBlur.uniforms.tDiffuse!.value = target.texture
    hBlur.uniforms.h!.value = amount / 256
    gl.setRenderTarget(targetBlur)
    gl.render(blurPlane, camera)
    blurPlane.material = vBlur
    vBlur.uniforms.tDiffuse!.value = targetBlur.texture
    vBlur.uniforms.v!.value = amount / 256
    gl.setRenderTarget(target)
    gl.render(blurPlane, camera)
    blurPlane.visible = false
  }

  useFrame(() => {
    const g = group.current
    if (!g) return
    // Matrius al dia abans de mirar-les (el render del fotograma encara no les ha posat).
    scene.updateMatrixWorld()
    let sig = 0
    let i = 0
    scene.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh || !m.castShadow || !m.visible) return
      const e = m.matrixWorld.elements
      i++
      sig += i * (e[12]! * 7.13 + e[13]! * 3.71 + e[14]! * 5.29 + e[0]! * 1.37 + e[2]! * 2.11 + e[5]! * 0.97 + e[8]! * 1.73 + e[10]! * 0.61) + m.geometry.id * 0.013
    })
    sig += i * 1e-3
    if (sig === painted.current) return
    painted.current = sig
    const { target, depth, camera } = res
    camera.position.set(position[0], position[1], position[2])
    camera.rotation.set(Math.PI / 2, 0, 0)
    camera.updateMatrixWorld()
    const bg = scene.background
    const override = scene.overrideMaterial
    g.visible = false
    scene.background = null
    scene.overrideMaterial = depth
    gl.setRenderTarget(target)
    gl.render(scene, camera)
    blurPass(blur)
    blurPass(blur * 0.4)
    gl.setRenderTarget(null)
    g.visible = true
    scene.overrideMaterial = override
    scene.background = bg
  })

  // Com drei: el pla mira avall (`rotateX` de la geometria) i es dibuixa girat i en mirall perquè l'ombra quedi bé.
  return (
    <group ref={group} position={position} rotation-x={Math.PI / 2}>
      <mesh geometry={res.plane} material={res.shown} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  )
}
