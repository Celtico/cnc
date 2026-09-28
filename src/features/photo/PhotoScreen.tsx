import {
  Alert,
  Box,
  Button,
  Card,
  EmptyState,
  Field,
  HStack,
  Heading,
  IconButton,
  NativeSelect,
  SegmentGroup,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { LuCamera, LuImagePlus, LuLocateFixed, LuRotateCcw, LuTrash2, LuX } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { visibleReferences, type Panel, type PanelRole } from "../../core/model"
import {
  DEFAULT_FOCAL_35,
  cameraFromHomography,
  focalPx,
  imageToPlane,
  imageToPlaneAt,
  project,
  projectPanels,
  type ReferencePlane,
} from "../../core/photo/camera"
import { readExif } from "../../core/photo/exif"
import { applyHomography, planeToImage, rectanglePoints, type Pt } from "../../core/photo/homography"
import {
  addPhoto,
  db,
  removeProjectPhoto,
  updateProjectPhoto,
  type Photo,
  type PhotoCalibration,
} from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"
import { ResizeHandle } from "../../components/ResizeHandle"
import { NumberField } from "../editor/ParamsForm"
import { usePersistentNumber } from "../usePersistentNumber"
import { useSettings } from "../settings/SettingsContext"
import { useCabinet, useProject } from "../useProject"


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
}

export function PhotoScreen({
  projectId,
  panels: livePanels,
  embedded = false,
  controlsTarget = null,
}: {
  projectId: number
  /** Peces a superposar. A l'Editor, les dels paràmetres que s'estan editant. */
  panels?: Panel[]
  /** Dins de la pestanya de l'Editor: sense títol gran; els controls van a `controlsTarget`. */
  embedded?: boolean
  /** On es pinten els controls (botons de foto i calibratge) quan és `embedded`: el panell de l'Editor. */
  controlsTarget?: HTMLElement | null
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
      const dims = await imageDimensions(file)
      const id = await addPhoto({
        projectId,
        blob: file,
        width: dims.width,
        height: dims.height,
        exifFocal35: exif.focal35 ?? null,
        createdAt: Date.now(),
      })
      if (project.photo) await db.photos.delete(project.photo.photoId)
      await updateProjectPhoto(projectId, {
        photoId: id,
        points: [],
        ref: { w: firstRef?.w ?? 210, h: firstRef?.h ?? 297 },
        plane: firstRef?.plane ?? "wall",
        refWallOffset: firstRef?.wallOffset ?? 0,
        focal35: exif.focal35 ?? DEFAULT_FOCAL_35,
        offset: [0, 0],
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
      <Controls embedded={embedded} target={controlsTarget}>
      <HStack justify={embedded ? "flex-start" : "space-between"} wrap="wrap" gap={3} mb={embedded ? 3 : 0}>
        {!embedded && <Heading size="xl">Foto del racó</Heading>}
        <HStack>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
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
                Fes una foto del racó on anirà el moble amb algun rectangle de mida coneguda a la paret o al
                terra (un full A4, una rajola, una porta). Serveix per veure proporcions, no per fabricar.
              </EmptyState.Description>
            </VStack>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : photo ? (
        <PhotoCalibrator
          key={photo.id}
          projectId={projectId}
          photo={photo}
          initial={project.photo}
          panels={panels}
          totalDepth={totalDepthOf(panels)}
          embedded={embedded}
          controlsTarget={controlsTarget}
        />
      ) : null}
    </VStack>
  )
}

/** Un camp buit mentre s'escriu dona NaN: pel dibuix compta com a 0. */
const fin = (v: number | undefined): number => (Number.isFinite(v) ? (v as number) : 0)

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

function imageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Format d'imatge no suportat per aquest navegador (prova JPEG o PNG)."))
    }
    img.src = url
  })
}

function PhotoCalibrator({
  projectId,
  photo,
  initial,
  panels,
  totalDepth,
  embedded = false,
  controlsTarget = null,
}: {
  projectId: number
  photo: Photo
  initial: PhotoCalibration
  panels: Panel[]
  totalDepth: number
  embedded?: boolean
  controlsTarget?: HTMLElement | null
}) {
  const [cal, setCal] = useState<PhotoCalibration>(initial)
  const [customRef, setCustomRef] = useState(false)
  const [panelWidth, setPanelWidth] = usePersistentNumber("mobles:photo-panel-width", 340)
  const svgRef = useRef<SVGSVGElement>(null)
  type Vec3m = [number, number, number]
  const drag = useRef<
    | { kind: "point"; index: number }
    | { kind: "origin"; z: number }
    | { kind: "axis"; axis: 0 | 1 | 2; start: Pt; o0: Vec3m; dir: Pt; pxPerMm: number }
    | { kind: "cabinet"; start: Pt; offset0: Pt }
    | null
  >(null)
  const [placingOrigin, setPlacingOrigin] = useState(false)

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
  const homography = useMemo(
    () => (calibrated && fin(cal.ref.w) > 0 && fin(cal.ref.h) > 0 ? planeToImage(cal.points, cal.ref.w, cal.ref.h) : null),
    [calibrated, cal.points, cal.ref.w, cal.ref.h],
  )
  const camera = useMemo(
    () => (homography ? cameraFromHomography(homography, focalPx(cal.focal35, W, H), W / 2, H / 2) : null),
    [homography, cal.focal35, W, H],
  )
  // L'origen triat, passat al pla de la referència (mm). Sense origen: (0,0) = cantonada
  // baix-esquerra de la referència.
  const wallOffset = cal.plane === "wall" ? fin(cal.refWallOffset) : 0
  // Punt de la imatge → pla on es recolza el moble (la paret real, no la referència).
  const toSupport = (p: Pt): Pt | null =>
    camera ? imageToPlaneAt(camera, p, -wallOffset) : homography ? imageToPlane(homography, p) : null
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
  const sceneOffset = useMemo<Pt>(
    () => [fin(originPlane[0]) + fin(cal.offset[0]), fin(originPlane[1]) + fin(cal.offset[1])],
    [originPlane[0], originPlane[1], cal.offset],
  )
  const faces = useMemo(
    () => (camera ? projectPanels(panels, camera, { plane: cal.plane, offset: sceneOffset, totalDepth, wallOffset, offsetZ: fin(originZ) + fin(cal.offsetZ) }) : []),
    [camera, panels, cal.plane, sceneOffset, totalDepth, wallOffset, cal.offsetZ, originZ],
  )
  // Eixos 3D = marcador de l'origen (0,0,0): X al llarg de la paret, Y amunt, Z cap a
  // la càmera. 300 mm cadascun. El centre i cada fletxa s'arrosseguen.
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
  const refOutline = useMemo(
    () => (homography ? rectanglePoints(cal.ref.w, cal.ref.h).map((p) => applyHomography(homography, p)) : null),
    [homography, cal.ref.w, cal.ref.h],
  )

  const toImage = (e: ReactPointerEvent): Pt | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return [Math.max(0, Math.min(W, pt.x)), Math.max(0, Math.min(H, pt.y))]
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (!p) return
    const target = e.target as SVGElement
    const idx = target.dataset.point
    const axisAttr = target.dataset.axis
    if (placingOrigin && calibrated) {
      const q = toSupport(p)
      if (q) setCal((c) => ({ ...c, originMm: [Math.round(q[0]), Math.round(q[1]), 0], origin: undefined, offset: [0, 0], offsetZ: 0 }))
      setPlacingOrigin(false)
      drag.current = { kind: "origin", z: 0 }
    } else if (target.dataset.originCenter !== undefined) {
      drag.current = { kind: "origin", z: originZ }
    } else if (axisAttr !== undefined && axes) {
      const axis = Number(axisAttr) as 0 | 1 | 2
      const end = axes.ends[axis]
      const dx = end[0] - axes.o[0]
      const dy = end[1] - axes.o[1]
      const len = Math.hypot(dx, dy) || 1
      drag.current = {
        kind: "axis",
        axis,
        start: p,
        o0: [originPlane[0], originPlane[1], originZ],
        dir: [dx / len, dy / len],
        pxPerMm: len / AXIS_MM,
      }
    } else if (idx !== undefined) {
      drag.current = { kind: "point", index: Number(idx) }
    } else if (!calibrated) {
      setCal((c) => ({ ...c, points: [...c.points, p] }))
      drag.current = { kind: "point", index: cal.points.length }
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
      setCal((c) => {
        const points = [...c.points]
        if (d.index < points.length) points[d.index] = p
        return { ...c, points }
      })
    } else if (homography) {
      const a = toSupport(d.start)
      const b = toSupport(p)
      if (a && b) {
        setCal((c) => ({
          ...c,
          offset: [Math.round(d.offset0[0] + b[0] - a[0]), Math.round(d.offset0[1] + b[1] - a[1])],
        }))
      }
    }
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const { settings } = useSettings()
  const presets = visibleReferences(settings)
  const presetKey = presets.findIndex((r) => r.w === cal.ref.w && r.h === cal.ref.h && (r.wallOffset ?? 0) === (cal.refWallOffset ?? 0))
  // "A mida" és una tria de l'usuari, no només "cap preset coincideix": si no ho
  // recordem, el desplegable torna al preset i no deixa triar-la.
  const refMode = customRef || presetKey < 0 ? "custom" : String(presetKey)
  const markerR = Math.max(W, H) / 90
  const stroke = Math.max(W, H) / 600

  return (
    <Stack direction={embedded ? "column" : { base: "column", lg: "row" }} gap={embedded ? 3 : 5} align={embedded ? "stretch" : "flex-start"}>
      <VStack align="stretch" gap={2} flex={1} w="full" minW={0}>
        <Box
          position="relative"
          w="full"
          mx="auto"
          maxW={embedded ? `calc((100dvh - 9rem) * ${W / H})` : `calc(70vh * ${W / H})`}
          style={{ aspectRatio: `${W} / ${H}` }}
          rounded="lg"
          overflow="hidden"
          bg="bg.muted"
        >
          {url && <img src={url} alt="Foto del racó" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: placingOrigin || !calibrated ? "crosshair" : "move" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {faces.filter((f) => f.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).map((f, i) => (
              <polygon
                key={i}
                points={f.pts.map(([x, y]) => `${x},${y}`).join(" ")}
                fill={ROLE_FILL[f.role]}
                fillOpacity={0.35 + 0.35 * f.facing}
                stroke="#2f1a10"
                strokeWidth={stroke}
                strokeLinejoin="round"
              />
            ))}
            {refOutline && (
              <polygon
                points={refOutline.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="none"
                stroke="#22c55e"
                strokeWidth={stroke * 1.5}
                strokeDasharray={`${stroke * 8} ${stroke * 6}`}
              />
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
                      {/* zona ampla i invisible per agafar l'eix */}
                      <line
                        x1={axes.o[0] + ux * markerR}
                        y1={axes.o[1] + uy * markerR}
                        x2={end[0]}
                        y2={end[1]}
                        stroke="transparent"
                        strokeWidth={markerR * 1.6}
                        data-axis={i}
                        style={{ cursor: "grab" }}
                      />
                      <polygon points={head} fill={color} stroke="white" strokeWidth={stroke} data-axis={i} style={{ cursor: "grab" }} />
                      <text
                        x={end[0] + ux * markerR * 1.5}
                        y={end[1] + uy * markerR * 1.5 + markerR * 0.45}
                        textAnchor="middle"
                        fontSize={markerR * 1.4}
                        fill={color}
                        stroke="white"
                        strokeWidth={stroke}
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {name}
                      </text>
                    </g>
                  )
                })}
                <circle
                  cx={axes.o[0]}
                  cy={axes.o[1]}
                  r={markerR * 0.8}
                  fill="#f97316"
                  stroke="white"
                  strokeWidth={stroke * 1.5}
                  data-origin-center=""
                  style={{ cursor: "grab" }}
                />
              </g>
            )}
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
            {placingOrigin
              ? "Toca on vols l'origen (0,0): p. ex. el racó on la paret toca el terra."
              : `Arrossega el moble per moure'l pel ${cal.plane === "wall" ? "pla de la paret" : "terra"}. Arrossega els punts verds per recalibrar${origin3 ? ". Eixos: el centre taronja mou l'origen per la paret; cada fletxa, només en aquella direcció (Z = cap endavant)" : ""}.`}
            {!camera && " No s'ha pogut calcular la càmera: revisa l'ordre dels punts."}
          </Text>
        )}
      </VStack>

      {!embedded && <ResizeHandle
        from="lg"
        width={panelWidth}
        onWidth={setPanelWidth}
        min={280}
        max={560}
        defaultWidth={340}
        panelSide="right"
        label="Amplada del panell de la foto"
      />}

      <Controls embedded={embedded} target={controlsTarget}>
      <Card.Root
        variant="outline"
        w={embedded ? "full" : { base: "full", lg: `${panelWidth}px` }}
        flexShrink={0}
        // Dins de l'acordió de l'Editor: sense fons ni vora, com la resta de seccions.
        {...(embedded ? { bg: "transparent", borderWidth: 0, shadow: "none" } : {})}
      >
        <Card.Body gap={4} p={embedded ? 0 : undefined}>
          <Field.Root>
            <Field.Label>Rectangle de referència</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={refMode}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setCustomRef(true)
                    return
                  }
                  const r = presets[Number(e.target.value)]
                  if (r) {
                    setCustomRef(false)
                    setCal((c) => ({ ...c, ref: { w: r.w, h: r.h }, refWallOffset: r.wallOffset ?? 0, plane: r.plane }))
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
          </Field.Root>
          <Text fontSize="sm" fontWeight="medium" mb={-2}>
            Mida coneguda
          </Text>
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Amplada" value={cal.ref.w} min={10} max={5000} step={1} onChange={(w) => setCal((c) => ({ ...c, ref: { ...c.ref, w } }))} />
            <NumberField label="Alçada" value={cal.ref.h} min={10} max={5000} step={1} onChange={(h) => setCal((c) => ({ ...c, ref: { ...c.ref, h } }))} />
          </SimpleGrid>
          {cal.plane === "wall" && (
            <NumberField
              label="Distància a la paret"
              value={cal.refWallOffset ?? 0}
              min={0}
              max={2000}
              step={10}
              help="De la referència a la paret. Una tele sobre un moble: uns 200."
              onChange={(v) => setCal((c) => ({ ...c, refWallOffset: Number.isFinite(v) ? v : 0 }))}
            />
          )}

          <Field.Root>
            <Field.Label>El rectangle és a…</Field.Label>
            <SegmentGroup.Root
              size="sm"
              value={cal.plane}
              onValueChange={(e) => {
                if (e.value === "wall" || e.value === "floor") setCal((c) => ({ ...c, plane: e.value as ReferencePlane }))
              }}
            >
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
            <Field.HelperText>
              {cal.plane === "wall" ? "El moble es recolza a la paret, amb el darrere al pla." : "El moble es recolza al terra, amb el front a la posició marcada."}
            </Field.HelperText>
          </Field.Root>

          <Field.Root>
            <Field.Label>Origen (0,0)</Field.Label>
            <HStack gap={2}>
              <Button
                size="sm"
                variant={placingOrigin ? "solid" : "outline"}
                colorPalette="wood"
                disabled={!calibrated}
                onClick={() => setPlacingOrigin((v) => !v)}
              >
                <LuLocateFixed /> {origin3 ? "Tornar a marcar l'origen" : "Marcar l'origen"}
              </Button>
              {origin3 && (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Treure l'origen"
                  onClick={() => setCal((c) => ({ ...c, origin: undefined, originMm: undefined, offset: [0, 0], offsetZ: 0 }))}
                >
                  <LuX />
                </IconButton>
              )}
            </HStack>
            <Field.HelperText>
              {origin3
                ? `Origen a ${Math.round(originZ)} mm de la paret. El moble es compta des dels eixos.`
                : "Sense origen, es compten des de la cantonada baix-esquerra de la referència. Marca el racó de la paret a terra."}
            </Field.HelperText>
          </Field.Root>

          <Text fontSize="sm" fontWeight="medium" mb={-2}>
            Posició del moble
          </Text>
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="X" value={cal.offset[0]} min={-10000} max={10000} step={10} onChange={(x) => setCal((c) => ({ ...c, offset: [x, c.offset[1]] }))} />
            <NumberField label={cal.plane === "wall" ? "Y (alçada)" : "Y (distància)"} value={cal.offset[1]} min={-10000} max={10000} step={10} onChange={(y) => setCal((c) => ({ ...c, offset: [c.offset[0], y] }))} />
            {cal.plane === "wall" && (
              <NumberField
                label="Z (paret)"
                value={cal.offsetZ ?? 0}
                min={0}
                max={3000}
                step={10}
                onChange={(z) => setCal((c) => ({ ...c, offsetZ: Number.isFinite(z) ? z : 0 }))}
              />
            )}
          </SimpleGrid>

          <NumberField
            label="Focal (35 mm)"
            value={cal.focal35}
            min={10}
            max={200}
            step={1}
            help={photo.exifFocal35 ? `Llegida de l'EXIF: ${photo.exifFocal35} mm` : "La foto no porta EXIF; 26 mm és la càmera principal d'un mòbil"}
            onChange={(focal35) => setCal((c) => ({ ...c, focal35 }))}
          />

          <Button variant="outline" size="sm" onClick={() => setCal((c) => ({ ...c, points: [] }))}>
            <LuRotateCcw /> Tornar a marcar els punts
          </Button>
        </Card.Body>
      </Card.Root>
      </Controls>
    </Stack>
  )
}
