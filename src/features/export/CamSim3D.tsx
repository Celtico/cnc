import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { Vector3 } from "three"
import type { Group, LineSegments, Mesh } from "three"
import { LOW_MEMORY } from "../../components/viewer/deviceLimits"
import { createHeightfield, DEFAULT_LIMITS, LOW_LIMITS } from "./camHeightfield"
import { advanceSim, toolAt, type SimCursor } from "./camSim"
import { boardGeometry, flushHeightTexture, heightTexture, pathGeometries, reliefMaterial } from "./camSimScene"
import type { CamSimClock } from "./useCamSim"

const S = 0.001

/**
 * Simulació 3D de la Vista CAM (a demanda, `React.lazy`: three no és al bloc d'Exportar). El tauler amb el seu gruix,
 * l'origen de la màquina (eixos X vermell, Y verd, Z blau), l'eina (Ø de l'eina) que segueix el programa i el que treu, a
 * mesura que avança (`advanceSim` sobre el mapa d'alçades, només el que s'ha tallat des de l'últim fotograma). Pinta
 * contínuament només mentre juga.
 */
export default function CamSim3D({ clock, paths, rapids }: { clock: CamSimClock; paths: boolean; rapids: boolean }) {
  const { prog } = clock
  const span = Math.max(prog.L, prog.W) * S
  return (
    <Canvas
      frameloop={clock.playing ? "always" : "demand"}
      dpr={[1, LOW_MEMORY ? 1.5 : 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: span / 500, far: span * 20, position: [0, span * 1.05, span * 0.8] }}
      resize={{ offsetSize: true }}
      style={{ touchAction: "none" }}
    >
      <hemisphereLight args={["#ffffff", "#8a7a60", 0.9]} />
      <directionalLight position={[1, 3, 2]} intensity={1.4} />
      <SimScene clock={clock} paths={paths} rapids={rapids} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0, 0]} minDistance={span * 0.008} maxDistance={span * 6} />
    </Canvas>
  )
}

function SimScene({ clock, paths, rapids }: { clock: CamSimClock; paths: boolean; rapids: boolean }) {
  const { prog } = clock
  const { L, W, T } = prog
  const invalidate = useThree((s) => s.invalidate)
  const sim = useMemo(() => {
    const hf = createHeightfield(L, W, T, LOW_MEMORY ? LOW_LIMITS : DEFAULT_LIMITS)
    const tex = heightTexture(hf)
    return { hf, tex, mat: reliefMaterial(hf, tex), geo: boardGeometry(hf), cur: { t: 0, fin: 0 } as SimCursor }
  }, [L, W, T])
  const lines = useMemo(() => pathGeometries(prog), [prog])
  useEffect(
    () => () => {
      sim.tex.dispose()
      sim.mat.dispose()
      sim.geo.dispose()
    },
    [sim],
  )
  useEffect(
    () => () => {
      lines.cuts.dispose()
      lines.current.dispose()
      lines.rapids.dispose()
    },
    [lines],
  )
  // Un altre programa amb el mateix tauler: el mapa es refà de zero.
  useEffect(() => {
    sim.cur.t = Infinity
  }, [prog, sim])

  const tool = useRef<Group>(null)
  const cutter = useRef<Group>(null)
  const dashed = useRef<LineSegments>(null)
  useEffect(() => {
    dashed.current?.computeLineDistances()
  }, [lines, rapids])
  // Pausat: un fotograma quan canvia el temps (lliscador, botons) o el que es veu.
  useEffect(() => invalidate(), [clock.shown, paths, rapids, invalidate])

  const board = useRef<Mesh>(null)
  useFrame(({ camera }, dt) => {
    // La càmera en mm del tauler (el material hi tira els raigs).
    if (board.current) (sim.mat.uniforms.camLocal!.value as Vector3).copy(board.current.worldToLocal(camera.position.clone()))
    clock.tick(Math.min(dt, 0.1))
    const t = clock.time.current
    // Com a molt ~10 ms per fotograma: si queda feina, un altre fotograma (la pantalla no es penja).
    advanceSim(sim.hf, prog, sim.cur, t, 10)
    if (sim.cur.t < t - 1e-9) invalidate()
    flushHeightTexture(sim.hf, sim.tex)
    const { p, r } = toolAt(prog, t)
    tool.current?.position.set(p[0], p[1], p[2])
    cutter.current?.scale.set(Math.max(r, 0.5), 1, Math.max(r, 0.5))
    const range = lines.ranges.get(clock.op)
    lines.current.setDrawRange(range?.[0] ?? 0, range?.[1] ?? 0)
  })

  const toolLen = Math.max(30, T + 12)
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} scale={S}>
      <group position={[-L / 2, -W / 2, 0]}>
        {/* El tauler (cara de dalt amb el que s'ha tret i els cantells); el martiri, a sota, es veu pels talls passants. */}
        <mesh ref={board} geometry={sim.geo} material={sim.mat} />
        <mesh position={[L / 2, W / 2, -0.5]}>
          <planeGeometry args={[L + 80, W + 80]} />
          <meshStandardMaterial color="#6f7a6a" roughness={0.95} />
        </mesh>
        {/* Origen de la màquina. */}
        <axesHelper args={[Math.max(60, Math.max(L, W) * 0.06)]} position={[0, 0, T + 0.5]} />
        <mesh position={[0, 0, T]}>
          <sphereGeometry args={[Math.max(4, Math.max(L, W) * 0.004), 16, 12]} />
          <meshBasicMaterial color="#e53e3e" />
        </mesh>
        {paths && (
          <lineSegments geometry={lines.cuts}>
            <lineBasicMaterial color="#2b6cb0" transparent opacity={0.5} />
          </lineSegments>
        )}
        <lineSegments geometry={lines.current} renderOrder={2}>
          <lineBasicMaterial color="#d53f8c" depthTest={false} transparent opacity={0.9} />
        </lineSegments>
        {rapids && (
          <lineSegments ref={dashed} geometry={lines.rapids}>
            <lineDashedMaterial color="#e53e3e" dashSize={12} gapSize={10} transparent opacity={0.6} />
          </lineSegments>
        )}
        {/* L'eina: la punta a la posició del programa; fresa del Ø de l'eina, pinça i capçal (translúcid). */}
        <group ref={tool} position={prog.home}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <group ref={cutter}>
              <mesh position={[0, toolLen / 2, 0]}>
                <cylinderGeometry args={[1, 1, toolLen, 24]} />
                <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
            <mesh position={[0, toolLen + 15, 0]}>
              <cylinderGeometry args={[16, 12, 30, 24]} />
              <meshStandardMaterial color="#8a919c" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, toolLen + 30 + 70, 0]}>
              <cylinderGeometry args={[45, 45, 140, 32]} />
              <meshStandardMaterial color="#3d4450" transparent opacity={0.45} roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
