import { useContext, useEffect, useRef, useState } from "react"
import { useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { Plane, Raycaster, Vector2, Vector3 } from "three"
import type { Panel, Vec3 } from "../../../core/model"
import { FaceDragContext, useArrowHandles, useFacePick, type ArrowHandles, type FaceHit } from "../facePick"
import { useOrbitControls } from "../orbitControls"
import { snapToleranceMm } from "../snapTolerance"
import { S } from "./constants"
import { pieceMeshes, toMm, toScene } from "./sceneSpace"

/**
 * Cara dinàmica com al Taulell: s'arrossega la cara mateixa. En prémer una cara i moure el ratolí, la tria (com un clic)
 * i fa anar la fletxa que hi surt (`ArrowHandles`), amb el seu imant i la mida al costat. Un clic sense moure's és un clic.
 */
export function FaceDrag({ panels, width, depth }: { panels: Panel[]; width: number; depth: number }) {
  const on = useContext(FaceDragContext)
  const pickNow = useFacePick()
  // Triar la cara canvia la funció (i les fletxes): es llegeixen d'una ref perquè l'arrossegament no es talli a mig fer.
  const pickRef = useRef(pickNow)
  pickRef.current = pickNow
  const has = !!pickNow
  const handles = useRef<ArrowHandles | null>(null)
  handles.current = useArrowHandles()
  const byId = useRef(new Map<string, Panel>())
  byId.current = new Map(panels.map((p) => [p.id, p]))
  const controls = useOrbitControls()
  const getThree = useThree((s) => s.get)
  const [label, setLabel] = useState<{ text: string; at: Vector3 } | null>(null)

  useEffect(() => {
    if (!on || !has) return
    const { gl } = getThree()
    const el = gl.domElement
    const mm = (w: Vector3): Vec3 => toMm(w, width, depth)
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    let drag: { x: number; y: number; hit: FaceHit; p0: Vector3; n: Vector3; plane?: Plane; id?: string; started: boolean } | null = null

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const { camera, scene, size } = getThree()
      // Damunt d'una fletxa: l'arrossega la fletxa mateixa.
      const r = el.getBoundingClientRect()
      const nearArrow = (handles.current?.arrows ?? []).some((a) => {
        const s = toScene(a.at, width, depth).project(camera)
        return Math.hypot(((s.x + 1) / 2) * size.width - (e.clientX - r.left), ((1 - s.y) / 2) * size.height - (e.clientY - r.top)) < 30
      })
      if (nearArrow) return
      const rc = new Raycaster()
      rc.setFromCamera(ndc(e), camera)
      const h = rc.intersectObjects(pieceMeshes(scene), false)[0]
      const panel = h && byId.current.get(h.object.userData.panel as string)
      if (!h || !panel || !h.face) return
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld)
      drag = { x: e.clientX, y: e.clientY, hit: { panel, point: mm(h.point), normal: [n.x, n.y, n.z] }, p0: h.point.clone(), n, started: false }
      if (controls) controls.enabled = false
    }
    const move = (e: PointerEvent) => {
      const d = drag
      if (!d) return
      if (!d.started) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return
        d.started = true
        pickRef.current?.(d.hit)
      }
      const { camera, size } = getThree()
      // La fletxa de la cara triada: la paral·lela a la cara més a prop del punt.
      const near = (handles.current?.arrows ?? [])
        .filter((a) => Math.abs(a.dir[0] * d.n.x + a.dir[1] * d.n.y + a.dir[2] * d.n.z) > 0.99)
        .sort((a, b) => dist(a.at, d.hit.point) - dist(b.at, d.hit.point))[0]
      if (!near || !handles.current) return
      if (d.id !== near.id || !d.plane) {
        const dir = new Vector3(...near.dir)
        const toCam = camera.getWorldDirection(new Vector3()).negate()
        const pn = dir.clone().cross(toCam).cross(dir)
        if (pn.lengthSq() < 1e-6) return
        d.plane = new Plane().setFromNormalAndCoplanarPoint(pn.normalize(), d.p0)
        d.id = near.id
      }
      const rc = new Raycaster()
      rc.setFromCamera(ndc(e), camera)
      const p = rc.ray.intersectPlane(d.plane, new Vector3())
      if (!p) return
      const along = p.clone().sub(d.p0).dot(new Vector3(...near.dir)) / S
      const text = handles.current.onDrag(near.id, Math.round(along * 10) / 10, snapToleranceMm(camera, size.height, p, S), e.altKey)
      setLabel(text ? { text, at: p } : null)
    }
    const up = () => {
      const d = drag
      drag = null
      if (controls) controls.enabled = true
      setLabel(null)
      if (d?.started) handles.current?.onDrop(d.id ?? null)
    }
    el.addEventListener("pointerdown", down, { capture: true })
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true })
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (controls) controls.enabled = true
    }
  }, [on, has, getThree, controls, width, depth])

  if (!label) return null
  // L'etiqueta va a l'escena sencera (fora del grup del moble), on és el ratolí.
  return (
    <Html position={[label.at.x + (width / 2) * S, label.at.y, label.at.z + (depth / 2) * S]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
      <div style={{ background: "rgba(24,24,27,.85)", color: "#fff", font: "12px system-ui", padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap", transform: "translateY(-24px)" }}>{label.text}</div>
    </Html>
  )
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
