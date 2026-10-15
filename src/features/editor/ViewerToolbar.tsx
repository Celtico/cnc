import { Box, SimpleGrid, Stack } from "@chakra-ui/react"
import { useState, type ReactNode, type RefObject } from "react"
import { LuAperture, LuCircleDot, LuExpand, LuShapes, LuShrink, LuSparkles, LuTrees, LuVideo, LuView, LuWrench } from "react-icons/lu"
import { ViewOptions, ViewTile } from "../../components/ViewOptions"
import { ArDialog } from "../../components/viewer/ArDialog"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { openRender } from "../../components/viewer/render/renderStore"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { Panel } from "../../core/model"
import { ViewerControls } from "./ViewerControls"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewMode, ViewerOptions } from "./useViewerOptions"

const VIEW_MODES: [ViewMode, string, string, typeof LuShapes][] = [
  ["pieces", "Per peça", "cada tipus de peça d'un color, ràpid i amb guies", LuShapes],
  ["texture", "Textura", "materials i veta, ràpid i amb guies", LuTrees],
  ["presentation", "Presentació", "ombres, terra i paret, sense guies", LuSparkles],
]

/**
 * Botons del visor: en fila a dalt; si el visor és estret, en columna a la dreta
 * (com les barres d'eines dels programes de CAD) perquè no tapin les pestanyes.
 */
export function ViewerToolbar({
  opts,
  camera,
  name,
  projectId,
  viewerPanels,
  models,
  hasMoving,
  hasSelectedZone,
  sceneGetter,
  onImage,
}: {
  opts: ViewerOptions
  camera: Pick<EditorCamera, "framed" | "frameFrom">
  name: string
  projectId: number
  viewerPanels: Panel[]
  models: CompositionBuild["models"] | undefined
  hasMoving: boolean
  hasSelectedZone: boolean
  sceneGetter: RefObject<SceneGetter | null>
  onImage: () => void
}) {
  const { viewTab, viewMode, setViewMode, showHoles, setShowHoles, exploded, setExploded, viewer, hardware, setHardware, quality, roleColors, setRoleColors, viewerState, setViewer } = opts
  const { framed, frameFrom } = camera
  // «Veure a casa»: visor 3D amb el botó d'AR Quick Look (Safari a l'iPhone/iPad).
  const [arOpen, setArOpen] = useState(false)
  // «Opcions de vista» obert: es tanca en obrir el Render (si no, el popover o el calaix quedaven a sobre).
  const [viewOptsOpen, setViewOptsOpen] = useState(false)

  // Accions ràpides del visor, a dalt de «Opcions de vista» (com el menú de visualització
  // de Fusion o Blender): el mode en un grup i la resta com a botons amb icona i nom.
  // Només icona (el text no hi cabia): el nom i l'explicació, al tooltip.
  const tile = (key: string, label: string, icon: ReactNode, on: boolean, onClick: () => void, tip?: string) => <ViewTile key={key} label={label} icon={icon} on={on} onClick={onClick} tip={tip} />
  const viewModes = (
    <SimpleGrid columns={3} gap={1.5}>
      {VIEW_MODES.map(([v, label, tip, Icon]) => tile(v, label, <Icon />, viewMode === v, () => setViewMode(v), `${label}: ${tip}`))}
    </SimpleGrid>
  )
  const viewTiles = (
    <>
      {tile("fit", "Enquadrar", <LuVideo />, framed, () => frameFrom(null), framed ? "Càmera enquadrada (no es mou sola en editar)" : "Enquadrar el moble")}
      {tile("holes", "Forats", <LuCircleDot />, showHoles || exploded || viewer.opacity < 1, () => setShowHoles((v) => !v), exploded ? "A la vista explosionada els forats sempre es veuen" : viewer.opacity < 1 ? "Amb les peces translúcides (Opacitat) els forats sempre es veuen" : showHoles ? "Amagar forats" : "Mostrar forats")}
      {tile("explode", "Explosió", exploded ? <LuShrink /> : <LuExpand />, exploded, () => setExploded((v) => !v), exploded ? "Vista muntada" : "Vista explosionada")}
      {tile("hardware", "Ferratges", <LuWrench />, hardware, () => setHardware((v) => !v), hardware ? "Amagar frontisses, tiradors i potes" : "Mostrar frontisses, tiradors i potes")}
      {tile("render", "Render", <LuAperture />, false, () => {
        setViewOptsOpen(false)
        if (quality === "fast" && roleColors) setRoleColors(false)
        if (!hardware) setHardware(true)
        openRender({ getScene: () => sceneGetter.current?.() ?? null, name, saveKey: `moble:${projectId}` })
      }, "Render fotorealista (GPU o CPU, com Cinema 4D): es va afinant i es desa en PNG")}
      {tile("ar", "A casa (AR)", <LuView />, false, () => setArOpen(true), "Veure a casa (realitat augmentada)")}
    </>
  )

  return (
    <Stack
      position="absolute"
      top={3}
      right={{ base: 3, md: 14 }}
      gap={2}
      zIndex={2}
      direction="row"
      display={viewTab === "3d" ? "flex" : "none"}
    >
      <ArDialog open={arOpen} onClose={() => setArOpen(false)} panels={viewerPanels} name={name} models={models} />
      {/* Al mòbil, un calaix de baix amb el seu propi desplaçament; a l'ordinador, un popover. */}
      <ViewOptions lead={viewModes} tiles={viewTiles} open={viewOptsOpen} onOpenChange={setViewOptsOpen}>
        <Box pt={3} borderTopWidth="1px">
          <ViewerControls state={viewerState} onChange={setViewer} onView={(v) => frameFrom(v)} hasMoving={hasMoving} hasSelectedZone={hasSelectedZone} onImage={onImage} />
        </Box>
      </ViewOptions>
    </Stack>
  )
}
