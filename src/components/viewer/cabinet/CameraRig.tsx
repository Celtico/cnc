import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei"
import { useEffect, useRef } from "react"
import { Vector3, type OrthographicCamera as OrthoCam, type PerspectiveCamera as PerspCam } from "three"
import type { OrbitControlsImpl } from "../orbitControls"
import type { CameraPose } from "../../../core/model"
import { useLatest } from "../../../lib/useLatest"
import type { ViewName } from "../viewNames"
import { S } from "./constants"
import { animStep } from "./anim"
import type { CabinetViewerProps } from "./types"


/** Distància màxima de la càmera de l'editor (m). */
// Zoom amb més marge (per decisió de l'usuari, 2026-10-14): de 2 cm fins a 60 m.
const MAX_DISTANCE = 60

/** Direcció de la càmera d'«Enquadrar» (3/4) i de cada vista. */
const FIT_DIR: [number, number, number] = [0.72, 0.45, 0.95]
const VIEW_DIR: Record<ViewName, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.0001],
}

/** Temps després de muntar el visor en què un canvi de mida encara torna a enquadrar (la disposició s'hi col·loca). */
const SETTLE_MS = 1500

/**
 * Càmera (sempre perspectiva): enquadra el moble sencer en muntar-se, en redimensionar el visor i quan canvia `fitKey`,
 * des del 3/4 («Enquadrar») o del costat de la vista triada (`viewDir`), amb transició suau. Editar el moble (mides,
 * mòduls, objectes) no la mou: es queda on l'has deixat.
 */
export function CameraRig({ size, viewDir, fitKey, onFramedChange, initialCamera, onCameraChange, cameraGoto }: { size: CabinetViewerProps["size"]; viewDir: ViewName | null; fitKey: number; onFramedChange?: (framed: boolean) => void; initialCamera?: CameraPose; onCameraChange?: (camera: CameraPose) => void; cameraGoto?: { pose: CameraPose; n: number } | null }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size: viewport, invalidate } = useThree()
  const w = size.width * S
  const h = size.height * S
  const d = size.depth * S
  const targetY = h * 0.5
  const aspect = viewport.width / Math.max(viewport.height, 1)
  const goal = useRef<{ pos: Vector3 } | null>(null)
  const goalRunning = useRef(false)
  const lastPos = useRef<Vector3 | null>(null)
  // Enquadrat = la càmera és on l'ha deixat l'últim enquadrament i el moble té la mateixa mida.
  const fittedSize = useRef("")
  const mountedAt = useRef(performance.now())
  // Càmera desada que s'ha restaurat (fins que s'enquadri o es triï una vista) i els disparadors ja vistos
  // (vista | fitKey): un de nou és de l'usuari; els altres reenquadraments són de redimensionar el visor.
  const restored = useRef<CameraPose | null>(null)
  const fitTriggered = useRef(new Set<string>())
  const reportAfterGoal = useRef(false)
  const reportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reportRef = useLatest(onCameraChange)
  // Es llegeix 1 s després de deixar-la anar (l'esmorteïment encara la mou una mica).
  // Lectura pendent: en desmuntar el visor o amagar la pàgina es fa de seguida (si no, es perdria).
  const pendingReport = useRef<(() => void) | null>(null)
  const scheduleReport = () => {
    clearTimeout(reportTimer.current)
    // El punt mirat és un Vector3 que els controls actualitzen: es guarda ara (en desmuntar, la ref ja és buida).
    const t = controls.current?.target
    const run = () => {
      clearTimeout(reportTimer.current)
      pendingReport.current = null
      const tt = t ?? controls.current?.target
      if (!tt || !("fov" in camera)) return
      const r = (v: number) => Math.round(v * 10000) / 10000
      const pose: CameraPose = { position: [r(camera.position.x), r(camera.position.y), r(camera.position.z)], target: [r(tt.x), r(tt.y), r(tt.z)], fov: camera.fov as number }
      if ([...pose.position, ...pose.target].every(Number.isFinite)) reportRef.current?.(pose)
    }
    pendingReport.current = run
    reportTimer.current = setTimeout(run, 1000)
  }
  useEffect(() => {
    const flush = () => pendingReport.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])
  const framedRef = useRef(true)
  const setFramed = (v: boolean) => {
    if (framedRef.current === v) return
    framedRef.current = v
    onFramedChange?.(v)
  }
  useEffect(() => {
    if (fittedSize.current && fittedSize.current !== `${size.width}x${size.height}x${size.depth}`) setFramed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia la mida del moble
  }, [size.width, size.height, size.depth])

  // Vista ortogràfica: la càmera al costat triat, a una distància fixa, i el zoom que hi fa cabre el moble (amplada i
  // alçada vistes d'aquell costat). Sense animació ni desar-la (és una vista, no una càmera).
  const orthoSeen = useRef("")
  useEffect(() => {
    if (!viewDir || !("isOrthographicCamera" in camera)) return
    // Com a la perspectiva: redimensionar no canvia la vista triada (només els primers instants).
    const key = `${viewDir}|${fitKey}`
    if (orthoSeen.current === key && performance.now() - mountedAt.current > SETTLE_MS) return
    orthoSeen.current = key
    const dir = VIEW_DIR[viewDir]
    const len = Math.hypot(dir[0], dir[1], dir[2])
    const D = 20
    goal.current = null
    camera.position.set((dir[0] / len) * D, targetY + (dir[1] / len) * D, (dir[2] / len) * D)
    const top = viewDir === "top"
    const side = viewDir === "left" || viewDir === "right"
    const ew = side ? d : w
    const eh = top ? d : h
    const cam = camera as OrthoCam | PerspCam
    cam.zoom = Math.max(1, Math.min(viewport.width / (ew * 1.2), viewport.height / (eh * 1.2)))
    cam.updateProjectionMatrix()
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
    setFramed(false)
    fittedSize.current = `${size.width}x${size.height}x${size.depth}`
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- la vista ortogràfica es posa quan canvia el costat, no amb cada canvi de mida
  }, [camera, viewDir, viewport.width, viewport.height, fitKey])

  useEffect(() => {
    if (viewDir && "isOrthographicCamera" in camera) return
    // Amagar o mostrar els panells (o girar el mòbil) redimensiona el visor: la càmera es queda on és (per decisió de
    // l'usuari, 2026-10-14: «quan amago o mostro les propietats em canvia la vista»). Només els primers instants després
    // de muntar-se (la disposició encara es col·loca) i un «Enquadrar» o una vista nous hi tornen a enquadrar.
    if (fitTriggered.current.has(`${viewDir ?? "fit"}|${fitKey}`) && performance.now() - mountedAt.current > SETTLE_MS) return
    const radius = 0.5 * Math.sqrt(w * w + h * h + d * d)
    const dir = viewDir ? VIEW_DIR[viewDir] : FIT_DIR
    const len = Math.hypot(dir[0], dir[1], dir[2])
    const fov = "fov" in camera ? (camera.fov as number) : 38
    const vHalf = (fov * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * aspect)
    // Com a molt la distància màxima dels controls: més enllà, els controls la retenien i l'animació no arribava
    // mai (amb `frameloop="demand"`, el visor no pararia de pintar).
    const dist = Math.min(MAX_DISTANCE * 0.999, (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08)
    const pos = new Vector3((dir[0] / len) * dist, targetY + (dir[1] / len) * dist, (dir[2] / len) * dist)
    // Càmera desada: en obrir-lo es torna on es va deixar. Mentre no s'enquadri ni es triï una vista, redimensionar el
    // visor (la disposició es mou en obrir-se) no la treu d'allà.
    const restore = restored.current ?? (initialCamera && !fitTriggered.current.size ? initialCamera : null)
    const trigger = `${viewDir ?? "fit"}|${fitKey}`
    const userFit = fitTriggered.current.size > 0 && !fitTriggered.current.has(trigger)
    fitTriggered.current.add(trigger)
    if (restore && !userFit) {
      restored.current = restore
      goal.current = null
      camera.position.set(...restore.position)
      controls.current?.target.set(...restore.target)
      controls.current?.update()
      invalidate()
      fittedSize.current = `${size.width}x${size.height}x${size.depth}`
      setFramed(camera.position.distanceTo(pos) < 0.005 && Math.abs(restore.target[0]) + Math.abs(restore.target[2]) + Math.abs(restore.target[1] - targetY) < 0.005)
      return
    }
    restored.current = null
    // «Enquadrar» o una vista triada: la càmera nova es desa com qualsevol òrbita.
    reportAfterGoal.current = userFit
    goal.current = { pos }
    fittedSize.current = `${size.width}x${size.height}x${size.depth}`
    // El botó «Enquadrar» surt marcat només amb el 3/4 (una vista és una altra càmera).
    setFramed(!viewDir)
    controls.current?.target.set(0, targetY, 0)
    controls.current?.update()
    // L'animació cap a l'enquadrament (`useFrame`) demana els fotogrames fins que arriba.
    invalidate()
    // Les mides es llegeixen però no disparen el reenquadrament.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- s'enquadra en obrir i amb «Enquadrar», no amb cada canvi de mida
  }, [camera, viewDir, viewport.width, viewport.height, fitKey])

  // Desfer/refer d'una càmera: hi va de seguida (sense animació) i es queda com la restaurada (redimensionar no la treu).
  useEffect(() => {
    if (!cameraGoto || viewDir) return
    const p = cameraGoto.pose
    goal.current = null
    clearTimeout(reportTimer.current)
    pendingReport.current = null
    restored.current = p
    camera.position.set(...p.position)
    controls.current?.target.set(...p.target)
    controls.current?.update()
    setFramed(false)
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- es va a la vista demanada només quan arriba una petició nova (`cameraGoto`)
  }, [cameraGoto?.n])

  useFrame((st, dt) => {
    const g = goal.current
    if (!g) {
      goalRunning.current = false
      return
    }
    const k = Math.min(1, animStep(goalRunning, dt) * 6)
    camera.position.lerp(g.pos, k)
    controls.current?.update()
    // Arribat, o encallat (els controls no la deixen anar més enllà, p. ex. el límit d'angle): s'acaba.
    const stuck = lastPos.current !== null && camera.position.distanceToSquared(lastPos.current) < 1e-14
    lastPos.current = (lastPos.current ?? new Vector3()).copy(camera.position)
    if (stuck || camera.position.distanceTo(g.pos) < 0.002) {
      goal.current = null
      goalRunning.current = false
      lastPos.current = null
      // «Enquadrar» (o una vista): la càmera nova també es desa.
      if (reportAfterGoal.current) {
        reportAfterGoal.current = false
        scheduleReport()
      }
    } else st.invalidate()
  })

  return (
    <>
      {viewDir ? <OrthographicCamera makeDefault near={0.01} far={100} position={[0, 1, 20]} zoom={300} /> : <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[1.4, 1.1, 1.9]} />}
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={0.02} maxDistance={viewDir ? 80 : MAX_DISTANCE} minZoom={20} maxZoom={20000} maxPolarAngle={viewDir ? Math.PI : Math.PI * 0.55} onStart={() => {
          goal.current = null
          restored.current = null
          setFramed(false)
          clearTimeout(reportTimer.current)
        }} onEnd={() => scheduleReport()} />
    </>
  )
}
