import {
  Alert,
  Box,
  Button,
  Card,
  EmptyState,
  HStack,
  Heading,
  IconButton,
  NativeSelect,
  SegmentGroup,
  Slider,
  Stack,
  Text,
  VStack,
  Switch,
} from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuCamera,
  LuImageDown,
  LuImagePlus,
  LuLocateFixed,
  LuMoveHorizontal,
  LuRectangleHorizontal,
  LuRotateCcw,
  LuTrash2,
  LuX,
  LuCrosshair,
  LuMove,
  LuPaintbrush,
  LuWrench,
} from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { FormRow } from "../../components/FormRow"
import { PanelSection } from "../../components/PanelSection"
import { usePresentationScene } from "../../components/viewer/presentationScene"
import { panelBox } from "../../core/build/buildComposition"
import { PhotoRender } from "./PhotoRender"
import { visibleReferences, type Composition, type Panel, type PanelRole } from "../../core/model"
import {
  DEFAULT_FOCAL_35,
  cameraFromHomography,
  focalPx,
  imageToPlane,
  imageToPlaneAt,
  project,
  projectPanels,
  type ProjectedFace,
  type ReferencePlane,
} from "../../core/photo/camera"
import { readExif } from "../../core/photo/exif"
import { applyHomography, planeToImage, rectanglePoints, type Pt } from "../../core/photo/homography"
import {
  WIDE_ANGLE_FOCAL_35,
  calibrationQuality,
  effectiveReference,
  floorDepth,
  floorLevel,
  measureValues,
  planeModel,
  type DepthMeasure,
  type Measure,
  type MeasureValue,
} from "../../core/photo/measure"
import { addPhoto, db, removeProjectPhoto, updateProjectPhoto, type Photo, type PhotoCalibration } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"
import { ResizeHandle } from "../../components/ResizeHandle"
import { NumRow } from "../editor/ParamsForm"
import { downloadBlob, slugify } from "../download"
import { useSettings } from "../settings/SettingsContext"
import { usePersistentNumber } from "../usePersistentNumber"
import { useCabinet, useProject } from "../useProject"
import { ESTIMATED_WARNING, estimatedApplied } from "./appliedState"
import { MeasureTable } from "./MeasureTable"
import { applyTargets, type ApplyTarget } from "./applyTargets"

const POINT_NAMES = ["baix-esquerra", "baix-dreta", "dalt-dreta", "dalt-esquerra"]

const ROLE_FILL: Record<PanelRole, string> = {
  side: "#c6924f",
  bottom: "#c6924f",
  top: "#d6b076",
  shelf: "#e6cfa6",
  door: "#b57a37",
  back: "#98602c",
  divider: "#c6924f",
  fixedShelf: "#c6924f",
  plinth: "#98602c",
  drawerFront: "#b57a37",
  drawerSide: "#e6cfa6",
  drawerBack: "#e6cfa6",
  drawerBottom: "#c9b79a",
  flap: "#b57a37",
  grille: "#b57a37",
  hatch: "#b57a37",
  panel: "#b57a37",
  worktop: "#d6b076",
  spacer: "#c6924f",
  facing: "#c6924f",
  part: "#b98a4f",
}

export type Tool = "none" | "origin" | "distance" | "rect" | "floor" | "depth"

export function PhotoScreen({
  projectId,
  panels: livePanels,
  embedded = false,
  controlsTarget = null,
  composition,
  onApplyMeasure,
  selectedModule = null,
}: {
  projectId: number
  /** Mòdul seleccionat a l'Editor (`Panel.module`): es ressalta i la resta s'apaga. */
  selectedModule?: number | null
  /** Peces a superposar. A l'Editor, les dels paràmetres que s'estan editant. */
  panels?: Panel[]
  /** Dins de la pestanya de l'Editor: sense títol gran; els controls van a `controlsTarget`. */
  embedded?: boolean
  /** On es pinten els controls (botons de foto i calibratge) quan és `embedded`: el panell de l'Editor. */
  controlsTarget?: HTMLElement | null
  /** Composició que s'edita, per poder aplicar-hi mesures. */
  composition?: Composition
  /** Aplica una mesura (mm) a un paràmetre del moble (`module:<id>:width`, `ref:<id>:d`...). */
  onApplyMeasure?: (target: string, valueMm: number) => void
}) {
  const project = useProject(projectId)
  const { settings } = useSettings()
  const firstRef = visibleReferences(settings)[0]
  const savedPanels = useCabinet(project?.params)
  const panels = livePanels ?? savedPanels
  const photoId = project?.photo?.photoId
  const photo = useLiveQuery(() => (photoId === undefined ? undefined : db.photos.get(photoId)), [photoId])
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!project) return null

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const buffer = await file.arrayBuffer()
      const exif = readExif(buffer)
      const resized = await shrinkImage(file, 2048)
      const id = await addPhoto({
        projectId,
        blob: resized.blob,
        width: resized.width,
        height: resized.height,
        exifFocal35: exif.focal35 ?? null,
        createdAt: Date.now(),
      })
      if (project.photo) await db.photos.delete(project.photo.photoId)
      await updateProjectPhoto(projectId, {
        photoId: id,
        points: [],
        ref: { w: firstRef?.w ?? 210, h: firstRef?.h ?? 297 },
        refAspect: firstRef ? firstRef.w / firstRef.h : null,
        plane: firstRef?.plane ?? "wall",
        refWallOffset: firstRef?.wallOffset ?? 0,
        focal35: exif.focal35 ?? DEFAULT_FOCAL_35,
        offset: [0, 0],
        measures: [],
      })
      toaster.create({
        title: "Foto carregada",
        description: exif.focal35 ? `Focal EXIF: ${exif.focal35} mm (equiv. 35 mm)` : "Sense EXIF: focal per defecte de 26 mm",
        type: "success",
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut llegir la imatge", description: String(e), type: "error" })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <VStack align="stretch" gap={embedded ? 3 : 5}>
      {/* Fora dels controls: així «Carregar foto» funciona també des del centre quan els controls no es veuen. */}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <Controls embedded={embedded} target={controlsTarget}>
        <HStack justify={embedded ? "flex-start" : "space-between"} wrap="wrap" gap={3} mb={embedded ? 3 : 0}>
          {!embedded && <Heading size="xl">Foto del racó</Heading>}
          <HStack>
            <Button size={embedded ? "sm" : "md"} variant={project.photo ? "outline" : "solid"} colorPalette="wood" loading={uploading} onClick={() => fileInput.current?.click()}>
              <LuImagePlus /> {project.photo ? "Canviar foto" : "Carregar foto"}
            </Button>
            {project.photo && (
              <Button size={embedded ? "sm" : "md"} variant="ghost" colorPalette="red" onClick={() => void removeProjectPhoto(projectId)}>
                <LuTrash2 /> Esborrar
              </Button>
            )}
          </HStack>
        </HStack>
      </Controls>

      {!project.photo ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuCamera />
            </EmptyState.Indicator>
            <VStack textAlign="center">
              <EmptyState.Title>Encara no hi ha foto</EmptyState.Title>
              <EmptyState.Description>
                Fes una foto del racó on anirà el moble amb algun rectangle de mida coneguda a la paret o al terra (un full A4,
                una rajola, una porta). Serveix per veure proporcions, no per fabricar.
              </EmptyState.Description>
            </VStack>
            <Button colorPalette="wood" loading={uploading} onClick={() => fileInput.current?.click()}>
              <LuImagePlus /> Carregar foto
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : photo ? (
        <PhotoCalibrator
          key={photo.id}
          projectId={projectId}
          projectName={project.name}
          photo={photo}
          initial={project.photo}
          panels={panels}
          totalDepth={totalDepthOf(panels)}
          embedded={embedded}
          controlsTarget={controlsTarget}
          composition={composition}
          onApplyMeasure={onApplyMeasure}
          selectedModule={selectedModule}
        />
      ) : null}
    </VStack>
  )
}

/** Un camp buit mentre s'escriu dona NaN: pel dibuix compta com a 0. */
const fin = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)
/** Valor conegut o null (camp en blanc). */
const known = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null)

/** Dins de l'Editor, els controls es pinten al panell de l'esquerra (portal). */
function Controls({ embedded, target, children }: { embedded: boolean; target: HTMLElement | null; children: ReactNode }) {
  if (!embedded) return <>{children}</>
  return target ? createPortal(children, target) : null
}

function totalDepthOf(panels: Panel[]): number {
  let max = 0
  for (const p of panels) {
    const { origin, xAxis, yAxis, zAxis } = p.placement
    for (const cx of [0, p.length])
      for (const cy of [0, p.width])
        for (const cz of [0, p.thickness]) max = Math.max(max, origin[2] + cx * xAxis[2] + cy * yAxis[2] + cz * zAxis[2])
  }
  return max
}

/** Redueix la imatge a un màxim de `maxSide` px pel costat llarg (JPEG), per no omplir la base de dades. */
async function shrinkImage(file: Blob, maxSide: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale >= 1) {
    const out = { blob: file, width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return out
  }
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut reduir la imatge"))), "image/jpeg", 0.9))
  return { blob, width, height }
}

let measureCounter = 0
const newMeasureId = (): string => `m${Date.now().toString(36)}${(measureCounter++).toString(36)}`

type Vec3m = [number, number, number]
type Drag =
  | { kind: "point"; index: number }
  | { kind: "measure"; id: string; index: number }
  | { kind: "floor"; index: number }
  | { kind: "origin"; z: number }
  | { kind: "axis"; axis: 0 | 1 | 2; start: Pt; o0: Vec3m; dir: Pt; pxPerMm: number }
  | { kind: "cabinet"; start: Pt; offset0: Pt }

function PhotoCalibrator({
  projectId,
  projectName,
  photo,
  initial,
  panels,
  totalDepth,
  embedded = false,
  controlsTarget = null,
  composition,
  onApplyMeasure,
  selectedModule = null,
}: {
  projectId: number
  projectName: string
  photo: Photo
  initial: PhotoCalibration
  panels: Panel[]
  totalDepth: number
  embedded?: boolean
  controlsTarget?: HTMLElement | null
  composition?: Composition
  onApplyMeasure?: (target: string, valueMm: number) => void
  selectedModule?: number | null
}) {
  const [cal, setCal] = useState<PhotoCalibration>(initial)
  const [customRef, setCustomRef] = useState(false)
  const [panelWidth, setPanelWidth] = usePersistentNumber("mobles:photo-panel-width", 340)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [tool, setTool] = useState<Tool>("none")
  /** Punts de la mesura que s'està marcant. */
  const [pending, setPending] = useState<Pt[]>([])
  /** Punt sota el dit mentre s'arrossega (lupa). */
  const [lens, setLens] = useState<Pt | null>(null)
  const [depthResult, setDepthResult] = useState<(DepthMeasure & { at: Pt }) | null>(null)
  const { settings } = useSettings()

  // URL de la foto: es revoca l'anterior quan canvia el blob. No es revoca en desmuntar
  // perquè StrictMode desmunta i remunta sense tornar a renderitzar (deixaria la imatge
  // trencada); el cost és una sola URL viva fins que es recarrega la pàgina.
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob])
  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== url) URL.revokeObjectURL(prevUrl.current)
    prevUrl.current = url
  }, [url])

  useEffect(() => {
    if (cal === initial) return
    const t = setTimeout(() => void updateProjectPhoto(projectId, cal), 300)
    return () => clearTimeout(t)
  }, [cal, projectId, initial])

  const { width: W, height: H } = photo
  const calibrated = cal.points.length === 4
  const measures = cal.measures ?? []
  const refW = known(cal.ref.w)
  const refH = known(cal.ref.h)

  // Model del pla (amplada de referència = 1): serveix per a les mesures relatives.
  const model = useMemo(() => (calibrated ? planeModel({ points: cal.points, refW, refH, aspect: cal.refAspect ?? null }) : null), [calibrated, cal.points, refW, refH, cal.refAspect])
  const values = useMemo(() => (model ? measureValues(model, measures, refW) : []), [model, measures, refW])
  // Mides efectives de la referència en mm (cinta > mides conegudes). Si no n'hi ha, no hi ha càmera ni moble.
  const effective = useMemo(() => (model ? effectiveReference(model, measures, refW) : null), [model, measures, refW])
  const homography = useMemo(() => (calibrated && effective ? planeToImage(cal.points, effective.w, effective.h) : null), [calibrated, cal.points, effective])
  const fPx = focalPx(cal.focal35, W, H)
  const camera = useMemo(() => (homography ? cameraFromHomography(homography, fPx, W / 2, H / 2) : null), [homography, fPx, W, H])
  const quality = useMemo(() => (homography ? calibrationQuality(homography, fPx, W / 2, H / 2) : null), [homography, fPx, W, H])
  const wallOffset = cal.plane === "wall" ? fin(cal.refWallOffset) : 0
  // Punt de la imatge → pla on es recolza el moble (la paret real, no la referència).
  const toSupport = (p: Pt): Pt | null => (camera ? imageToPlaneAt(camera, p, -wallOffset) : homography ? imageToPlane(homography, p) : null)
  // Línia del terra → alçada del terra sobre la paret.
  const floor = useMemo(() => (camera && cal.floorLine ? floorLevel(camera, cal.floorLine, wallOffset) : null), [camera, cal.floorLine, wallOffset])
  // Origen 3D (mm). Sense origen: cantonada baix-esquerra de la referència, a la paret.
  const origin3 = useMemo<Vec3m | null>(() => {
    if (cal.originMm) return cal.originMm
    if (!cal.origin) return null
    const q = toSupport(cal.origin)
    return q ? [q[0], q[1], 0] : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal.originMm, cal.origin, camera, homography, wallOffset])
  const originPlane: Pt = origin3 ? [origin3[0], origin3[1]] : [0, 0]
  const originZ = origin3 ? origin3[2] : 0
  const sceneOffset = useMemo<Pt>(() => [fin(originPlane[0]) + fin(cal.offset[0]), fin(originPlane[1]) + fin(cal.offset[1])], [originPlane[0], originPlane[1], cal.offset])
  const sceneOpts = useMemo(
    () => ({ plane: cal.plane, offset: sceneOffset, totalDepth, wallOffset, offsetZ: fin(originZ) + fin(cal.offsetZ) }),
    [cal.plane, sceneOffset, totalDepth, wallOffset, cal.offsetZ, originZ],
  )
  const faces = useMemo(() => (camera ? projectPanels(panels, camera, sceneOpts) : []), [camera, panels, sceneOpts])
  // Render realista: mida del moble (per a la llum i les ombres) i canvas WebGL per a la imatge.
  const renderMode = cal.render ?? "lines"
  const renderShadows = cal.shadows ?? true
  const [marksInRender, setMarksInRender] = useState(false)
  // Mòdul seleccionat a l'Editor: translúcid i amb vora taronja (per veure'n l'interior);
  // la resta, normal. El mateix criteri que al 3D.
  const moduleOf = useMemo(() => new Map(panels.map((p) => [p.id, p.module])), [panels])
  const highlightPanel = (id: string) => selectedModule !== null && moduleOf.get(id) === selectedModule
  const dimmedPanel = highlightPanel
  const [presentation] = usePresentationScene()
  const glCanvas = useRef<HTMLCanvasElement | null>(null)
  const cabinetSize = useMemo(() => {
    let w = 0, h = 0, d = 0
    for (const p of panels) {
      const b = panelBox(p)
      w = Math.max(w, b.max[0]); h = Math.max(h, b.max[1]); d = Math.max(d, b.max[2])
    }
    return { width: w, height: h, depth: d }
  }, [panels])
  // Eixos 3D = marcador de l'origen (0,0,0): X al llarg de la paret, Y amunt, Z cap a la càmera.
  const AXIS_MM = 300
  const axes = useMemo(() => {
    if (!camera || !calibrated || cal.plane !== "wall") return null
    const o: Vec3m = [originPlane[0], originPlane[1], -wallOffset + originZ]
    const at = (dx: number, dy: number, dz: number) => project(camera, [o[0] + dx, o[1] + dy, o[2] + dz])
    const o2 = at(0, 0, 0)
    const x = at(AXIS_MM, 0, 0)
    const y = at(0, AXIS_MM, 0)
    const z = at(0, 0, AXIS_MM)
    if (!o2 || !x || !y || !z) return null
    return { o: o2, ends: [x, y, z] as const }
  }, [camera, calibrated, cal.plane, originPlane[0], originPlane[1], originZ, wallOffset])
  const refOutline = useMemo(() => (model ? rectanglePoints(1, 1 / model.aspect).map((p) => applyHomography(model.h, p)) : null), [model])

  const layer = cal.layer ?? "both"
  const opacity = cal.opacity ?? 0.7
  const estimated = estimatedApplied(cal)
  const targets = useMemo(() => applyTargets(composition), [composition])
  const appliedByMeasure = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of cal.applied ?? []) m.set(a.measureId, [...(m.get(a.measureId) ?? []), a.label])
    return m
  }, [cal.applied])

  const toImage = (e: ReactPointerEvent): Pt | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return [Math.max(0, Math.min(W, pt.x)), Math.max(0, Math.min(H, pt.y))]
  }

  const updateMeasure = (id: string, patch: Partial<Measure>) => setCal((c) => ({ ...c, measures: (c.measures ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  const removeMeasure = (id: string) => setCal((c) => ({ ...c, measures: (c.measures ?? []).filter((m) => m.id !== id), applied: (c.applied ?? []).filter((a) => a.measureId !== id) }))

  const finishPending = (pts: Pt[]) => {
    const kind = tool === "rect" ? "rect" : "distance"
    const n = measures.length + 1
    const name = kind === "rect" ? `Rectangle ${n}` : `Mesura ${n}`
    setCal((c) => ({ ...c, measures: [...(c.measures ?? []), { id: newMeasureId(), name, kind, points: pts }] }))
    setPending([])
    setTool("none")
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (!p) return
    const target = e.target as SVGElement
    const idx = target.dataset.point
    const axisAttr = target.dataset.axis
    const measureId = target.dataset.measure
    const floorIdx = target.dataset.floor
    if (tool === "origin" && calibrated) {
      const q = toSupport(p)
      if (q) setCal((c) => ({ ...c, originMm: [Math.round(q[0]), Math.round(q[1]), 0], origin: undefined, offset: [0, 0], offsetZ: 0 }))
      setTool("none")
      drag.current = { kind: "origin", z: 0 }
    } else if ((tool === "distance" || tool === "rect") && calibrated) {
      const next = [...pending, p]
      const need = tool === "rect" ? 4 : 2
      if (next.length >= need) finishPending(next)
      else setPending(next)
      drag.current = null
      setLens(p)
    } else if (tool === "floor" && calibrated) {
      const next = [...pending, p]
      if (next.length === 2) {
        setCal((c) => ({ ...c, floorLine: [next[0]!, next[1]!] }))
        setPending([])
        setTool("none")
      } else setPending(next)
      setLens(p)
    } else if (tool === "depth" && calibrated) {
      if (camera && floor) {
        const d = floorDepth(camera, p, floor.y, wallOffset)
        if (d) setDepthResult({ ...d, at: p })
        else toaster.create({ title: "Aquest punt no és a terra", type: "warning" })
      }
      setTool("none")
    } else if (target.dataset.originCenter !== undefined) {
      drag.current = { kind: "origin", z: originZ }
    } else if (axisAttr !== undefined && axes) {
      const axis = Number(axisAttr) as 0 | 1 | 2
      const end = axes.ends[axis]
      const dx = end[0] - axes.o[0]
      const dy = end[1] - axes.o[1]
      const len = Math.hypot(dx, dy) || 1
      drag.current = { kind: "axis", axis, start: p, o0: [originPlane[0], originPlane[1], originZ], dir: [dx / len, dy / len], pxPerMm: len / AXIS_MM }
    } else if (measureId !== undefined) {
      drag.current = { kind: "measure", id: measureId, index: Number(target.dataset.index) }
      setLens(p)
    } else if (floorIdx !== undefined) {
      drag.current = { kind: "floor", index: Number(floorIdx) }
      setLens(p)
    } else if (idx !== undefined) {
      drag.current = { kind: "point", index: Number(idx) }
      setLens(p)
    } else if (!calibrated) {
      setCal((c) => ({ ...c, points: [...c.points, p] }))
      drag.current = { kind: "point", index: cal.points.length }
      setLens(p)
    } else {
      drag.current = { kind: "cabinet", start: p, offset0: cal.offset }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const p = toImage(e)
    if (!p) return
    if (d.kind === "origin") {
      const q = camera ? imageToPlaneAt(camera, p, -wallOffset + d.z) : null
      if (q) setCal((c) => ({ ...c, originMm: [Math.round(q[0]), Math.round(q[1]), d.z], origin: undefined }))
    } else if (d.kind === "axis") {
      const along = ((p[0] - d.start[0]) * d.dir[0] + (p[1] - d.start[1]) * d.dir[1]) / Math.max(d.pxPerMm, 1e-6)
      const next: Vec3m = [...d.o0]
      next[d.axis] = Math.round(d.o0[d.axis] + along)
      if (d.axis === 2) next[2] = Math.max(0, next[2]) // no dins de la paret
      setCal((c) => ({ ...c, originMm: next, origin: undefined }))
    } else if (d.kind === "point") {
      setLens(p)
      setCal((c) => {
        const points = [...c.points]
        if (d.index < points.length) points[d.index] = p
        return { ...c, points }
      })
    } else if (d.kind === "measure") {
      setLens(p)
      setCal((c) => ({ ...c, measures: (c.measures ?? []).map((m) => (m.id === d.id ? { ...m, points: m.points.map((q, i) => (i === d.index ? p : q)) } : m)) }))
    } else if (d.kind === "floor") {
      setLens(p)
      setCal((c) => (c.floorLine ? { ...c, floorLine: d.index === 0 ? [p, c.floorLine[1]] : [c.floorLine[0], p] } : c))
    } else if (homography) {
      const a = toSupport(d.start)
      const b = toSupport(p)
      if (a && b) setCal((c) => ({ ...c, offset: [Math.round(d.offset0[0] + b[0] - a[0]), Math.round(d.offset0[1] + b[1] - a[1])] }))
    }
  }

  const onPointerUp = () => {
    drag.current = null
    setLens(null)
  }

  // En marcar la línia del terra, es proposa l'origen al seu extrem esquerre (si no n'hi ha).
  useEffect(() => {
    if (!floor || cal.originMm || cal.origin) return
    setCal((c) => ({ ...c, originMm: [Math.round(floor.xLeft), Math.round(floor.y), 0], offset: [0, 0], offsetZ: 0 }))
  }, [floor, cal.originMm, cal.origin])

  const presets = visibleReferences(settings)
  const presetKey = presets.findIndex((r) => r.w === cal.ref.w && r.h === cal.ref.h && (r.wallOffset ?? 0) === (cal.refWallOffset ?? 0))
  // "A mida" és una tria de l'usuari, no només "cap preset coincideix": si no ho
  // recordem, el desplegable torna al preset i no deixa triar-la.
  const refMode = customRef || presetKey < 0 ? "custom" : String(presetKey)
  const markerR = Math.max(W, H) / 90
  const stroke = Math.max(W, H) / 600
  const font = markerR * 1.1

  const applyMeasure = (m: Measure, t: ApplyTarget, value: number, which: "main" | "second") => {
    if (!onApplyMeasure) return
    onApplyMeasure(t.id, Math.round(value))
    const label = which === "second" ? `${t.label} (alçada)` : t.label
    setCal((c) => ({ ...c, applied: [...(c.applied ?? []).filter((a) => a.target !== t.id), { measureId: m.id, target: t.id, label }] }))
    const real = values.find((v) => v.id === m.id)?.state === "real"
    toaster.create({ title: `${t.label}: ${Math.round(value)} mm`, description: real ? "Mida real (cinta)." : "Mida estimada a partir de la foto: no tallis amb aquesta mida.", type: "success" })
  }

  const applyDepth = (target: "wall" | string) => {
    if (!depthResult) return
    if (target === "wall") {
      setCal((c) => ({ ...c, refWallOffset: Math.max(0, depthResult.depth) }))
      toaster.create({ title: `Referència a ${depthResult.depth} mm de la paret`, description: "L'escala de la paret s'ha recalculat.", type: "success" })
    } else if (onApplyMeasure) {
      onApplyMeasure(target, Math.max(1, depthResult.depth))
      toaster.create({ title: `Fondària aplicada: ${depthResult.depth} mm`, description: `Estimada (±${Math.round(depthResult.error * 100)} %).`, type: "success" })
    }
    setDepthResult(null)
  }

  const downloadPng = async () => {
    try {
      const blob = await renderComposite(photo.blob, W, H, layer, opacity, renderMode === "realistic" ? [] : faces, stroke, renderMode === "realistic" ? glCanvas.current : null)
      downloadBlob(blob, `${slugify(projectName)}-foto.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }

  const toolButton = (t: Tool, label: string, icon: ReactNode, disabled = false) => (
    <Button
      size="xs"
      variant={tool === t ? "solid" : "outline"}
      colorPalette="wood"
      disabled={disabled || !calibrated}
      aria-pressed={tool === t}
      onClick={() => {
        setPending([])
        setTool(tool === t ? "none" : t)
      }}
    >
      {icon} {label}
    </Button>
  )

  const showMarks = renderMode === "lines" || !calibrated || tool !== "none" || pending.length > 0 || marksInRender

  const hint = !calibrated
    ? null
    : !showMarks
      ? "Arrossega el moble per moure'l. Activa «Mostrar les marques» per afinar els punts i l'origen."
    : tool === "origin"
      ? "Toca on vols l'origen (0,0): p. ex. el racó on la paret toca el terra."
      : tool === "distance"
        ? `Distància: toca el punt ${pending.length + 1} de 2.`
        : tool === "rect"
          ? `Rectangle: toca la cantonada ${pending.length + 1} de 4.`
          : tool === "floor"
            ? `Línia del terra: toca el punt ${pending.length + 1} de 2 on la paret toca el terra.`
            : tool === "depth"
              ? "Fondària: toca un punt a terra (el davant del radiador, el peu de la tele)."
              : `Arrossega el moble per moure'l pel ${cal.plane === "wall" ? "pla de la paret" : "terra"}. Arrossega els punts per afinar-los${origin3 ? ". Eixos: el centre taronja mou l'origen per la paret; cada fletxa, només en aquella direcció (Z = cap endavant)" : ""}.`

  return (
    <Stack direction={embedded ? "column" : { base: "column", lg: "row" }} gap={embedded ? 3 : 5} align={embedded ? "stretch" : "flex-start"}>
      <VStack align="stretch" gap={2} flex={1} w="full" minW={0}>
        <Box position="relative" w="full" mx="auto" maxW={embedded ? `calc((100dvh - 9rem) * ${W / H})` : `calc(70vh * ${W / H})`} style={{ aspectRatio: `${W} / ${H}` }} rounded="lg" overflow="hidden" bg="bg.muted">
          {url && layer !== "cabinet" && <img src={url} alt="Foto del racó" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
          {camera && layer !== "photo" && renderMode === "realistic" && (
            <PhotoRender
              panels={panels}
              camera={camera}
              scene={sceneOpts}
              width={W}
              height={H}
              size={cabinetSize}
              materials={settings.materials}
              light={presentation.light}
              shadows={renderShadows}
              opacity={opacity}
              selectedModule={selectedModule}
              onCanvas={(c) => (glCanvas.current = c)}
            />
          )}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: tool !== "none" || !calibrated ? "crosshair" : "move" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {layer !== "photo" &&
              renderMode === "lines" &&
              faces
                .filter((f) => f.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
                .map((f, i) => (
                  <polygon
                    key={i}
                    points={f.pts.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill={ROLE_FILL[f.role]}
                    fillOpacity={opacity * (0.55 + 0.45 * f.facing) * (dimmedPanel(f.panelId) ? 0.35 : 1)}
                    stroke={highlightPanel(f.panelId) ? "#f97316" : "#2f1a10"}
                    strokeOpacity={Math.min(1, opacity + 0.2) * (dimmedPanel(f.panelId) ? 0.4 : 1)}
                    strokeWidth={highlightPanel(f.panelId) ? stroke * 1.8 : stroke}
                    strokeLinejoin="round"
                  />
                ))}
            {/* En mode realista les marques s'amaguen (és una imatge per ensenyar); tornen
                a sortir si es tria una eina, si falta calibrar o si es demanen. */}
            {showMarks && (
              <>
              {refOutline && <polygon points={refOutline.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#22c55e" strokeWidth={stroke * 1.5} strokeDasharray={`${stroke * 8} ${stroke * 6}`} />}
              {/* Línia del terra */}
              {cal.floorLine && (
                <g>
                  <line x1={cal.floorLine[0][0]} y1={cal.floorLine[0][1]} x2={cal.floorLine[1][0]} y2={cal.floorLine[1][1]} stroke="#16a34a" strokeWidth={stroke * 2.5} strokeLinecap="round" />
                  {cal.floorLine.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={markerR * 0.7} fill="#16a34a" stroke="white" strokeWidth={stroke * 1.5} data-floor={i} style={{ cursor: "grab" }} />
                  ))}
                </g>
              )}
              {/* Mesures */}
              {measures.map((m) => (
                <MeasureShape key={m.id} measure={m} value={values.find((v) => v.id === m.id)} stroke={stroke} r={markerR * 0.6} font={font} />
              ))}
              {/* Mesura en curs */}
              {pending.length > 0 && (
                <g>
                  {pending.length > 1 && <polyline points={pending.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth={stroke * 2} />}
                  {pending.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={markerR * 0.6} fill="#f59e0b" stroke="white" strokeWidth={stroke * 1.5} />
                  ))}
                </g>
              )}
              {depthResult && (
                <g>
                  <circle cx={depthResult.at[0]} cy={depthResult.at[1]} r={markerR * 0.7} fill="#0ea5e9" stroke="white" strokeWidth={stroke * 1.5} />
                  <text x={depthResult.at[0]} y={depthResult.at[1] - markerR} textAnchor="middle" fontSize={font} fill="#0ea5e9" stroke="white" strokeWidth={stroke} paintOrder="stroke" fontWeight="bold" fontFamily="system-ui, sans-serif">
                    {depthResult.depth} mm ±{Math.round(depthResult.error * 100)} %
                  </text>
                </g>
              )}
              {cal.points.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={markerR} fill="#22c55e" fillOpacity={0.85} stroke="white" strokeWidth={stroke * 1.5} data-point={i} style={{ cursor: "grab" }} />
                  <text x={x} y={y + markerR * 0.4} textAnchor="middle" fontSize={markerR * 1.2} fill="white" fontWeight="bold" pointerEvents="none" fontFamily="system-ui, sans-serif">
                    {i + 1}
                  </text>
                </g>
              ))}
              {axes && (
                <g fontFamily="system-ui, sans-serif" fontWeight="bold">
                  {(
                    [
                      ["X", "#ef4444"],
                      ["Y", "#22c55e"],
                      ["Z", "#3b82f6"],
                    ] as const
                  ).map(([name, color], i) => {
                    const end = axes.ends[i]!
                    const dx = end[0] - axes.o[0]
                    const dy = end[1] - axes.o[1]
                    const len = Math.hypot(dx, dy) || 1
                    const ux = dx / len
                    const uy = dy / len
                    const ah = markerR * 1.2
                    const head = `${end[0]},${end[1]} ${end[0] - ux * ah - uy * ah * 0.55},${end[1] - uy * ah + ux * ah * 0.55} ${end[0] - ux * ah + uy * ah * 0.55},${end[1] - uy * ah - ux * ah * 0.55}`
                    return (
                      <g key={name}>
                        <line x1={axes.o[0]} y1={axes.o[1]} x2={end[0]} y2={end[1]} stroke="white" strokeWidth={stroke * 5} strokeLinecap="round" pointerEvents="none" />
                        <line x1={axes.o[0]} y1={axes.o[1]} x2={end[0]} y2={end[1]} stroke={color} strokeWidth={stroke * 3} strokeLinecap="round" pointerEvents="none" />
                        <line x1={axes.o[0] + ux * markerR} y1={axes.o[1] + uy * markerR} x2={end[0]} y2={end[1]} stroke="transparent" strokeWidth={markerR * 1.6} data-axis={i} style={{ cursor: "grab" }} />
                        <polygon points={head} fill={color} stroke="white" strokeWidth={stroke} data-axis={i} style={{ cursor: "grab" }} />
                        <text x={end[0] + ux * markerR * 1.5} y={end[1] + uy * markerR * 1.5 + markerR * 0.45} textAnchor="middle" fontSize={markerR * 1.4} fill={color} stroke="white" strokeWidth={stroke} paintOrder="stroke" pointerEvents="none">
                          {name}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx={axes.o[0]} cy={axes.o[1]} r={markerR * 0.8} fill="#f97316" stroke="white" strokeWidth={stroke * 1.5} data-origin-center="" style={{ cursor: "grab" }} />
                </g>
              )}
              </>
            )}
            {/* Lupa: el dit tapa el punt al mòbil */}
            {lens && url && <Lens url={url} at={lens} W={W} H={H} r={markerR * 3.2} stroke={stroke} />}
          </svg>
        </Box>
        {!calibrated ? (
          <Alert.Root status="info" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                Marca el punt {cal.points.length + 1} de 4: cantonada <b>{POINT_NAMES[cal.points.length]}</b> del rectangle de referència
              </Alert.Title>
              <Alert.Description>Pots arrossegar els punts per afinar-los.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            {hint}
            {calibrated && !effective && " Sense mides conegudes ni cinta: només mesures relatives (el moble no es pot superposar)."}
            {effective && !camera && " No s'ha pogut calcular la càmera: revisa l'ordre dels punts."}
          </Text>
        )}
        {depthResult && (
          <Alert.Root status="info" size="sm">
            <Alert.Indicator>
              <LuArrowUpFromLine />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                Fondària: {depthResult.depth} mm des de la paret, a x = {depthResult.x} (±{Math.round(depthResult.error * 100)} %)
              </Alert.Title>
              <Alert.Description>
                {depthResult.tooFlat && "El terra es veu massa pla: fes la foto una mica de biaix o una segona de costat. "}
                <HStack wrap="wrap" gap={1} mt={1}>
                  {cal.plane === "wall" && (
                    <Button size="xs" variant="outline" onClick={() => applyDepth("wall")}>
                      Distància de la referència a la paret
                    </Button>
                  )}
                  {(composition?.references ?? []).map((r) => (
                    <Button key={r.id} size="xs" variant="outline" onClick={() => applyDepth(`ref:${r.id}:d`)}>
                      Fondària de «{r.name}»
                    </Button>
                  ))}
                  <IconButton aria-label="Tancar" size="xs" variant="ghost" onClick={() => setDepthResult(null)}>
                    <LuX />
                  </IconButton>
                </HStack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </VStack>

      {!embedded && <ResizeHandle from="lg" width={panelWidth} onWidth={setPanelWidth} min={280} max={560} defaultWidth={340} panelSide="right" label="Amplada del panell de la foto" />}

      <Controls embedded={embedded} target={controlsTarget}>
        <Card.Root variant="outline" w={embedded ? "full" : { base: "full", lg: `${panelWidth}px` }} flexShrink={0} {...(embedded ? { bg: "transparent", borderWidth: 0, shadow: "none" } : {})}>
          <Card.Body gap={4} p={embedded ? 0 : undefined}>
            {estimated.length > 0 && (
              <Alert.Root status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{ESTIMATED_WARNING}</Alert.Title>
                  <Alert.Description>
                    El moble es basa en mides estimades: {estimated.map((a) => a.label).join(", ")}. Mesura-les amb cinta i escriu-les a la columna «Cinta».
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
            {cal.focal35 < WIDE_ANGLE_FOCAL_35 && (
              <Alert.Root status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>Foto de gran angular ({cal.focal35} mm): les vores surten deformades. Millor fer-la a 1× (no a 0,5×).</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
            {quality && !quality.ok && (
              <Alert.Root status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{quality.message}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            {/* Seccions plegables, com la resta de l'inspector. */}
            <Stack gap={0}>
              <PanelSection id="photo-ref" title="Referència" icon={LuCrosshair}>
              <FormRow label="Rectangle de referència" maxW="280px">
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    aria-label="Rectangle de referència"
                    value={refMode}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setCustomRef(true)
                        return
                      }
                      const r = presets[Number(e.target.value)]
                      if (r) {
                        setCustomRef(false)
                        setCal((c) => ({ ...c, ref: { w: r.w, h: r.h }, refAspect: r.w / r.h, refWallOffset: r.wallOffset ?? 0, plane: r.plane }))
                      }
                    }}
                  >
                    {presets.map((r, i) => (
                      <option key={r.id} value={String(i)}>
                        {r.name} ({r.w} × {r.h})
                      </option>
                    ))}
                    <option value="custom">A mida</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </FormRow>
              <Text fontSize="sm" fontWeight="medium" mb={-1}>
                Mida coneguda
              </Text>
              <NumRow label="Amplada" value={cal.ref.w ?? NaN} min={10} max={5000} step={1} onChange={(w) => setCal((c) => ({ ...c, ref: { ...c.ref, w: known(w) } }))} />
              {/* L'explicació de la mida coneguda va com a ajuda de la segona fila (val per a totes dues). */}
              <NumRow
                label="Alçada"
                value={cal.ref.h ?? NaN}
                min={10}
                max={5000}
                step={1}
                onChange={(h) => setCal((c) => ({ ...c, ref: { ...c.ref, h: known(h) } }))}
                help={
                  refW && refH
                    ? effective && (effective.w !== refW || effective.h !== refH)
                      ? `Recalibrada amb cinta: ${effective.w} × ${effective.h} mm.`
                      : "Donen l'escala de la foto. Es poden deixar en blanc per treballar només amb proporcions."
                    : effective
                      ? `Sense mides: l'escala surt de la cinta (${effective.w} × ${effective.h} mm).`
                      : "En blanc: només mesures relatives fins que hi hagi una mida amb cinta."
                }
              />
              {cal.plane === "wall" && (
                <NumRow label="Distància a la paret" value={cal.refWallOffset ?? 0} min={0} max={2000} step={10} help="De la referència a la paret. Una tele sobre un moble: uns 200." onChange={(v) => setCal((c) => ({ ...c, refWallOffset: Number.isFinite(v) ? v : 0 }))} />
              )}

              <FormRow label="El rectangle és a…">
                <SegmentGroup.Root size="sm" aria-label="El rectangle és a…" value={cal.plane} onValueChange={(e) => (e.value === "wall" || e.value === "floor") && setCal((c) => ({ ...c, plane: e.value as ReferencePlane }))}>
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Item value="wall">
                    <SegmentGroup.ItemText>La paret</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="floor">
                    <SegmentGroup.ItemText>El terra</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
              </FormRow>
              <NumRow
                label="Focal (35 mm)"
                value={cal.focal35}
                min={10}
                max={200}
                step={1}
                suffix="mm"
                help={photo.exifFocal35 ? `Llegida de l'EXIF: ${photo.exifFocal35} mm` : "La foto no porta EXIF; 26 mm és la càmera principal d'un mòbil"}
                onChange={(focal35) => setCal((c) => ({ ...c, focal35 }))}
              />

              <Button variant="outline" size="sm" onClick={() => setCal((c) => ({ ...c, points: [] }))}>
                <LuRotateCcw /> Tornar a marcar els punts
              </Button>
              </PanelSection>
              <PanelSection id="photo-tools" title="Eines" icon={LuWrench}>
              <HStack wrap="wrap" gap={1.5}>
                {toolButton("origin", "Origen", <LuLocateFixed />)}
                {toolButton("distance", "Distància", <LuMoveHorizontal />)}
                {toolButton("rect", "Rectangle", <LuRectangleHorizontal />)}
                {toolButton("floor", cal.floorLine ? "Terra" : "Línia del terra", <LuArrowDownToLine />, cal.plane !== "wall")}
                {toolButton("depth", "Fondària", <LuArrowUpFromLine />, !floor)}
                {origin3 && (
                  <IconButton size="xs" variant="ghost" aria-label="Treure l'origen" title="Treure l'origen" onClick={() => setCal((c) => ({ ...c, origin: undefined, originMm: undefined, offset: [0, 0], offsetZ: 0 }))}>
                    <LuX />
                  </IconButton>
                )}
              </HStack>
              <Text fontSize="xs" color="fg.muted">
                {origin3 ? `Origen a ${Math.round(originZ)} mm de la paret${floor ? "; terra a la línia verda" : ""}.` : "Sense origen, es compta des de la cantonada baix-esquerra de la referència."}
                {!floor && cal.plane === "wall" && " Marca la línia del terra per mesurar fondàries i recolzar-hi el moble."}
              </Text>
              </PanelSection>
              <PanelSection id="photo-measures" title="Mesures" icon={LuMoveHorizontal} badge={measures.length || undefined}>
              <MeasureTable measures={measures} values={values} targets={targets} applied={appliedByMeasure} onChange={updateMeasure} onRemove={removeMeasure} onApply={applyMeasure} />
              </PanelSection>
              <PanelSection id="photo-position" title="Posició del moble" icon={LuMove}>
              <NumRow label="X (de costat)" value={cal.offset[0]} min={-10000} max={10000} step={10} onChange={(x) => setCal((c) => ({ ...c, offset: [x, c.offset[1]] }))} />
              <NumRow label={cal.plane === "wall" ? "Y (alçada)" : "Y (distància)"} value={cal.offset[1]} min={-10000} max={10000} step={10} onChange={(y) => setCal((c) => ({ ...c, offset: [c.offset[0], y] }))} />
              {cal.plane === "wall" && <NumRow label="Z (paret)" value={cal.offsetZ ?? 0} min={0} max={3000} step={10} onChange={(z) => setCal((c) => ({ ...c, offsetZ: Number.isFinite(z) ? z : 0 }))} />}
              </PanelSection>
              <PanelSection id="photo-look" title="Aspecte" icon={LuPaintbrush} badge={renderMode === "realistic" ? "Realista" : "Línies"}>
              <FormRow
                label="Aspecte del moble"
                help={
                  renderMode === "lines"
                    ? "Ràpid i transparent: per encaixar el moble amb la foto."
                    : "Materials, llum i ombres. La llum és la de Preferències › Visor 3D."
                }
              >
                <SegmentGroup.Root size="sm" aria-label="Aspecte del moble" value={renderMode} onValueChange={(e) => (e.value === "lines" || e.value === "realistic") && setCal((c) => ({ ...c, render: e.value as "lines" | "realistic" }))}>
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Item value="lines">
                    <SegmentGroup.ItemText>Línies</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="realistic">
                    <SegmentGroup.ItemText>Realista</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
              </FormRow>
              {renderMode === "realistic" && (
                <FormRow label="Ombres">
                  <Switch.Root size="sm" pt="6px" checked={renderShadows} onCheckedChange={(e) => setCal((c) => ({ ...c, shadows: e.checked }))}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">Ombres a terra i a la paret</Switch.Label>
                  </Switch.Root>
                </FormRow>
              )}
              {renderMode === "realistic" && (
                <FormRow label="Marques">
                  <Switch.Root size="sm" pt="6px" checked={marksInRender} onCheckedChange={(e) => setMarksInRender(e.checked)}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">Mostrar les marques</Switch.Label>
                  </Switch.Root>
                </FormRow>
              )}

              {/* Fila: el lliscador i el valor a la dreta de l'etiqueta. */}
              <FormRow label="Opacitat del moble">
                <Slider.Root size="sm" aria-label={["Opacitat del moble"]} value={[Math.round(opacity * 100)]} min={10} max={100} step={5} onValueChange={(e) => setCal((c) => ({ ...c, opacity: (e.value[0] ?? 70) / 100 }))}>
                  <HStack gap={3} minH="32px">
                    <Slider.Control flex={1}>
                      <Slider.Track>
                        <Slider.Range />
                      </Slider.Track>
                      <Slider.Thumbs />
                    </Slider.Control>
                    <Slider.ValueText fontSize="sm" color="fg.muted" minW="3em" textAlign="right" />
                  </HStack>
                </Slider.Root>
              </FormRow>
              <HStack justify="space-between" wrap="wrap" gap={2}>
                <SegmentGroup.Root size="xs" value={layer} onValueChange={(e) => (e.value === "photo" || e.value === "cabinet" || e.value === "both") && setCal((c) => ({ ...c, layer: e.value as PhotoCalibration["layer"] }))}>
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Item value="photo">
                    <SegmentGroup.ItemText>Foto</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="cabinet">
                    <SegmentGroup.ItemText>Moble</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="both">
                    <SegmentGroup.ItemText>Tots dos</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
                <Button size="xs" variant="outline" disabled={!camera} onClick={() => void downloadPng()}>
                  <LuImageDown /> Imatge PNG
                </Button>
              </HStack>
              </PanelSection>
            </Stack>
          </Card.Body>
        </Card.Root>
      </Controls>
    </Stack>
  )
}

/** Dibuix d'una mesura: línia o rectangle amb els punts arrossegables i el valor. */
function MeasureShape({ measure: m, value, stroke, r, font }: { measure: Measure; value: MeasureValue | undefined; stroke: number; r: number; font: number }) {
  const color = value?.state === "real" ? "#16a34a" : "#f59e0b"
  const label = value
    ? value.total !== null
      ? `${Math.round(value.total)}${value.total2 != null ? ` × ${Math.round(value.total2)}` : ""}`
      : `${value.relative.toFixed(2)}${value.relative2 !== undefined ? ` × ${value.relative2.toFixed(2)}` : ""}`
    : ""
  const cx = m.points.reduce((s, p) => s + p[0], 0) / m.points.length
  const cy = m.points.reduce((s, p) => s + p[1], 0) / m.points.length
  return (
    <g>
      {m.kind === "distance" ? (
        <line x1={m.points[0]![0]} y1={m.points[0]![1]} x2={m.points[1]![0]} y2={m.points[1]![1]} stroke={color} strokeWidth={stroke * 2} />
      ) : (
        <polygon points={m.points.map(([x, y]) => `${x},${y}`).join(" ")} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={stroke * 2} />
      )}
      {m.points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} stroke="white" strokeWidth={stroke * 1.5} data-measure={m.id} data-index={i} style={{ cursor: "grab" }} />
      ))}
      <text x={cx} y={cy - r} textAnchor="middle" fontSize={font} fill={color} stroke="white" strokeWidth={stroke} paintOrder="stroke" fontWeight="bold" fontFamily="system-ui, sans-serif" pointerEvents="none">
        {m.name}: {label}
      </text>
    </g>
  )
}

/** Lupa: la foto ampliada ×2,5 al voltant del punt, desplaçada cap amunt perquè el dit no la tapi. */
function Lens({ url, at, W, H, r, stroke }: { url: string; at: Pt; W: number; H: number; r: number; stroke: number }) {
  const zoom = 2.5
  const cx = at[0]
  const cy = Math.max(r, at[1] - r * 1.7)
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id="lens-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <g clipPath="url(#lens-clip)">
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="#000" />
        <image href={url} width={W} height={H} transform={`translate(${cx} ${cy}) scale(${zoom}) translate(${-at[0]} ${-at[1]})`} />
        <line x1={cx - r} x2={cx + r} y1={cy} y2={cy} stroke="#f97316" strokeWidth={stroke} />
        <line x1={cx} x2={cx} y1={cy - r} y2={cy + r} stroke="#f97316" strokeWidth={stroke} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth={stroke * 2} />
    </g>
  )
}

/** Foto + moble superposat en un PNG a mida de la foto. */
async function renderComposite(blob: Blob, W: number, H: number, layer: "photo" | "cabinet" | "both", opacity: number, faces: ProjectedFace[], stroke: number, render: HTMLCanvasElement | null = null): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  if (layer !== "cabinet") {
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0, W, H)
    bitmap.close()
  } else {
    ctx.fillStyle = "#f4f1ea"
    ctx.fillRect(0, 0, W, H)
  }
  if (layer !== "photo" && render) {
    ctx.globalAlpha = opacity
    ctx.drawImage(render, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (layer !== "photo") {
    ctx.lineJoin = "round"
    ctx.lineWidth = stroke
    for (const f of faces) {
      if (!f.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) continue
      ctx.beginPath()
      f.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.globalAlpha = opacity * (0.55 + 0.45 * f.facing)
      ctx.fillStyle = ROLE_FILL[f.role]
      ctx.fill()
      ctx.globalAlpha = Math.min(1, opacity + 0.2)
      ctx.strokeStyle = "#2f1a10"
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No s'ha pogut generar el PNG"))), "image/png"))
}
