import { shrinkImage } from "../../lib/imageShrink"
import { Box, Button, EmptyState, HStack, Heading, Stack, VStack } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { LuCamera, LuImagePlus, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { usePresentationScene } from "../../components/viewer/presentationScene"
import { PhotoRender } from "./PhotoRender"
import { visibleReferences, type Composition, type Panel } from "../../core/model"
import { DEFAULT_FOCAL_35 } from "../../core/photo/camera"
import { readExif } from "../../core/photo/exif"
import { addPhoto, db, removeProjectPhoto, updateProjectPhoto, type Photo, type PhotoCalibration } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"
import { ResizeHandle } from "../../components/ResizeHandle"
import { downloadBlob, slugify } from "../../lib/download"
import { useSettings } from "../settings/SettingsContext"
import { usePersistentNumber } from "../../lib/usePersistentNumber"
import { useCabinet, useProject } from "../useProject"
import { useDebouncedSave } from "../../lib/useDebouncedSave"
import { useLatest } from "../../lib/useLatest"
import { withOriginScale } from "./calibration"
import { CabinetFaces, CalibrationMarks, Lens } from "./PhotoMarks"
import { CalibrationHint, DepthAlert } from "./PhotoStatus"
import { PhotoInspector } from "./PhotoInspector"
import { renderComposite } from "./renderComposite"
import { useCalibrationScene } from "./useCalibrationScene"
import { usePhotoPointer } from "./usePhotoPointer"
import { usePhotoUrl } from "./usePhotoUrl"

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
        exifFocal35: exif.focal35 || null,
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
        focal35: exif.focal35 || DEFAULT_FOCAL_35,
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
  const [cal, setCal] = useState<PhotoCalibration>(() => withOriginScale(initial))
  const [customRef, setCustomRef] = useState(false)
  const [panelWidth, setPanelWidth] = usePersistentNumber("mobles:photo-panel-width", 340)
  const { settings } = useSettings()
  const url = usePhotoUrl(photo.blob)

  useDebouncedSave(cal, (c) => void updateProjectPhoto(projectId, c), 300)

  const { width: W, height: H } = photo
  const scene = useCalibrationScene(cal, W, H, panels, totalDepth)
  const { calibrated, camera, floor, faces, sceneOpts, cabinetSize } = scene
  const { svgRef, tool, setTool, pending, setPending, lens, depthResult, setDepthResult, onPointerDown, onPointerMove, onPointerUp } = usePhotoPointer(W, H, cal, setCal, scene)
  // Render realista: canvas WebGL per a la imatge.
  const renderMode = cal.render ?? "lines"
  const renderShadows = cal.shadows ?? true
  const [marksInRender, setMarksInRender] = useState(false)
  const [presentation] = usePresentationScene()
  const glCanvas = useRef<HTMLCanvasElement | null>(null)

  const layer = cal.layer ?? "both"
  const opacity = cal.opacity ?? 0.7

  // En marcar la línia del terra, es proposa l'origen al seu extrem esquerre (si no n'hi ha).
  const originScaleRef = useLatest(scene.originScaleNow)
  useEffect(() => {
    if (!floor || cal.originMm || cal.origin) return
    setCal((c) => ({ ...c, originMm: [Math.round(floor.xLeft), Math.round(floor.y), 0], ...originScaleRef.current, offset: [0, 0], offsetZ: 0 }))
  }, [floor, cal.originMm, cal.origin, originScaleRef])

  const markerR = Math.max(W, H) / 90
  const stroke = Math.max(W, H) / 600
  const font = markerR * 1.1

  const downloadPng = async () => {
    try {
      const blob = await renderComposite(photo.blob, W, H, layer, opacity, renderMode === "realistic" ? [] : faces, stroke, renderMode === "realistic" ? glCanvas.current : null)
      downloadBlob(blob, `${slugify(projectName)}-foto.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }

  const showMarks = renderMode === "lines" || !calibrated || tool !== "none" || pending.length > 0 || marksInRender

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
            {layer !== "photo" && renderMode === "lines" && <CabinetFaces faces={faces} panels={panels} selectedModule={selectedModule} opacity={opacity} stroke={stroke} />}
            {/* En mode realista les marques s'amaguen (és una imatge per ensenyar); tornen
                a sortir si es tria una eina, si falta calibrar o si es demanen. */}
            {showMarks && <CalibrationMarks cal={cal} scene={scene} pending={pending} depthResult={depthResult} markerR={markerR} stroke={stroke} font={font} />}
            {/* Lupa: el dit tapa el punt al mòbil */}
            {lens && url && <Lens url={url} at={lens} W={W} H={H} r={markerR * 3.2} stroke={stroke} />}
          </svg>
        </Box>
        <CalibrationHint cal={cal} scene={scene} showMarks={showMarks} tool={tool} pending={pending} />
        {depthResult && <DepthAlert depthResult={depthResult} onClose={() => setDepthResult(null)} plane={cal.plane} composition={composition} setCal={setCal} onApplyMeasure={onApplyMeasure} />}
      </VStack>

      {!embedded && <ResizeHandle from="lg" width={panelWidth} onWidth={setPanelWidth} min={280} max={560} defaultWidth={340} panelSide="right" label="Amplada del panell de la foto" />}

      <Controls embedded={embedded} target={controlsTarget}>
        <PhotoInspector
          cal={cal}
          setCal={setCal}
          scene={scene}
          photo={photo}
          embedded={embedded}
          panelWidth={panelWidth}
          customRef={customRef}
          setCustomRef={setCustomRef}
          tool={tool}
          setTool={setTool}
          setPending={setPending}
          composition={composition}
          onApplyMeasure={onApplyMeasure}
          renderMode={renderMode}
          renderShadows={renderShadows}
          opacity={opacity}
          layer={layer}
          marksInRender={marksInRender}
          setMarksInRender={setMarksInRender}
          onDownload={() => void downloadPng()}
        />
      </Controls>
    </Stack>
  )
}
