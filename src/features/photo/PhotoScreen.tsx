import {
  Alert,
  Box,
  Button,
  Card,
  EmptyState,
  Field,
  HStack,
  Heading,
  NativeSelect,
  SegmentGroup,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { LuCamera, LuImagePlus, LuRotateCcw, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import type { Panel, PanelRole } from "../../core/model"
import {
  DEFAULT_FOCAL_35,
  cameraFromHomography,
  focalPx,
  imageToPlane,
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
import { NumberField } from "../editor/ParamsForm"
import { useCabinet, useProject } from "../useProject"

const REF_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Full A4 vertical (210 × 297)", w: 210, h: 297 },
  { label: "Full A4 horitzontal (297 × 210)", w: 297, h: 210 },
  { label: "Rajola 300 × 300", w: 300, h: 300 },
  { label: "Rajola 600 × 600", w: 600, h: 600 },
  { label: "Rajola 600 × 300", w: 600, h: 300 },
  { label: "Porta 800 × 2030", w: 800, h: 2030 },
  { label: "Porta 700 × 2030", w: 700, h: 2030 },
]

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

export function PhotoScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const panels = useCabinet(project?.params)
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
        ref: { w: REF_PRESETS[0]!.w, h: REF_PRESETS[0]!.h },
        plane: "wall",
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
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Foto del racó</Heading>
        <HStack>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button variant={project.photo ? "outline" : "solid"} colorPalette="wood" loading={uploading} onClick={() => fileInput.current?.click()}>
            <LuImagePlus /> {project.photo ? "Canviar foto" : "Carregar foto"}
          </Button>
          {project.photo && (
            <Button variant="ghost" colorPalette="red" onClick={() => void removeProjectPhoto(projectId)}>
              <LuTrash2 /> Esborrar
            </Button>
          )}
        </HStack>
      </HStack>

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
        />
      ) : null}
    </VStack>
  )
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
}: {
  projectId: number
  photo: Photo
  initial: PhotoCalibration
  panels: Panel[]
  totalDepth: number
}) {
  const [cal, setCal] = useState<PhotoCalibration>(initial)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ kind: "point"; index: number } | { kind: "cabinet"; start: Pt; offset0: Pt } | null>(null)

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
    () => (calibrated ? planeToImage(cal.points, cal.ref.w, cal.ref.h) : null),
    [calibrated, cal.points, cal.ref.w, cal.ref.h],
  )
  const camera = useMemo(
    () => (homography ? cameraFromHomography(homography, focalPx(cal.focal35, W, H), W / 2, H / 2) : null),
    [homography, cal.focal35, W, H],
  )
  const faces = useMemo(
    () => (camera ? projectPanels(panels, camera, { plane: cal.plane, offset: cal.offset, totalDepth }) : []),
    [camera, panels, cal.plane, cal.offset, totalDepth],
  )
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
    if (idx !== undefined) {
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
    if (d.kind === "point") {
      setCal((c) => {
        const points = [...c.points]
        if (d.index < points.length) points[d.index] = p
        return { ...c, points }
      })
    } else if (homography) {
      const a = imageToPlane(homography, d.start)
      const b = imageToPlane(homography, p)
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

  const presetKey = REF_PRESETS.findIndex((r) => r.w === cal.ref.w && r.h === cal.ref.h)
  const markerR = Math.max(W, H) / 90
  const stroke = Math.max(W, H) / 600

  return (
    <Stack direction={{ base: "column", lg: "row" }} gap={5} align="flex-start">
      <VStack align="stretch" gap={2} flex={1} w="full" minW={0}>
        <Box
          position="relative"
          w="full"
          mx="auto"
          maxW={`calc(70vh * ${W / H})`}
          style={{ aspectRatio: `${W} / ${H}` }}
          rounded="lg"
          overflow="hidden"
          bg="bg.muted"
        >
          {url && <img src={url} alt="Foto del racó" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: calibrated ? "move" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {faces.map((f, i) => (
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
            Arrossega el moble per moure'l pel {cal.plane === "wall" ? "pla de la paret" : "terra"}. Arrossega els punts verds per recalibrar.
            {!camera && " No s'ha pogut calcular la càmera: revisa l'ordre dels punts."}
          </Text>
        )}
      </VStack>

      <Card.Root variant="outline" w={{ base: "full", lg: "340px" }} flexShrink={0}>
        <Card.Body gap={4}>
          <Field.Root>
            <Field.Label>Rectangle de referència</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={presetKey >= 0 ? String(presetKey) : "custom"}
                onChange={(e) => {
                  const r = REF_PRESETS[Number(e.target.value)]
                  if (r) setCal((c) => ({ ...c, ref: { w: r.w, h: r.h } }))
                }}
              >
                {REF_PRESETS.map((r, i) => (
                  <option key={r.label} value={String(i)}>
                    {r.label}
                  </option>
                ))}
                <option value="custom">A mida</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Ample real" value={cal.ref.w} min={10} max={5000} step={1} onChange={(w) => setCal((c) => ({ ...c, ref: { ...c.ref, w } }))} />
            <NumberField label="Alt real" value={cal.ref.h} min={10} max={5000} step={1} onChange={(h) => setCal((c) => ({ ...c, ref: { ...c.ref, h } }))} />
          </SimpleGrid>

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

          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Moble: desplaçament X" value={cal.offset[0]} min={-10000} max={10000} step={10} onChange={(x) => setCal((c) => ({ ...c, offset: [x, c.offset[1]] }))} />
            <NumberField label={cal.plane === "wall" ? "Moble: alçada Y" : "Moble: distància Y"} value={cal.offset[1]} min={-10000} max={10000} step={10} onChange={(y) => setCal((c) => ({ ...c, offset: [c.offset[0], y] }))} />
          </SimpleGrid>

          <NumberField
            label="Focal (equiv. 35 mm)"
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
    </Stack>
  )
}
