import { Box, HStack, IconButton, SimpleGrid, Stack } from "@chakra-ui/react"
import { useState, type ReactNode, type RefObject } from "react"
import type { IconType } from "react-icons"
import { LuAperture, LuBox, LuCircleDot, LuExpand, LuPanelLeft, LuPanelRight, LuPanelTop, LuShapes, LuShrink, LuSparkles, LuSquare, LuSquareDashed, LuView, LuWrench } from "react-icons/lu"
import { Tooltip } from "../../components/ui/tooltip"
import { segGroup, segItem } from "../../components/segmented"
import { VIEW_LABELS, type ViewName } from "../../components/viewer/viewNames"
import { ViewOptions, ViewTile } from "../../components/ViewOptions"
import { ArDialog } from "../../components/viewer/ArDialog"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { openRender, useRenderLauncher } from "../../components/viewer/render/renderStore"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { Panel } from "../../core/model"
import { ViewerControls } from "./ViewerControls"
import type { EditorCamera } from "./useEditorCamera"
import type { ViewMode, ViewerOptions } from "./useViewerOptions"

const VIEW_MODES: [ViewMode, string, string, typeof LuShapes][] = [
  ["pieces", "Per peça", "cada tipus de peça d'un color, ràpid i amb guies", LuShapes],
  ["presentation", "Presentació", "ombres, terra i paret, sense guies", LuSparkles],
]

/** Les vistes de la barra de baix: la 3D (el 3/4 d'«Enquadrar») i les de cada costat. */
const VIEW_BUTTONS: [ViewName | null, string, IconType, string][] = [
  [null, "3D", LuBox, "Vista 3D: enquadra el moble de 3/4"],
  ["front", VIEW_LABELS.front, LuSquare, "Vista de davant"],
  ["back", VIEW_LABELS.back, LuSquareDashed, "Vista de darrere"],
  ["left", VIEW_LABELS.left, LuPanelLeft, "Vista de l'esquerra"],
  ["right", VIEW_LABELS.right, LuPanelRight, "Vista de la dreta"],
  ["top", VIEW_LABELS.top, LuPanelTop, "Vista de dalt"],
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
}: {
  opts: ViewerOptions
  camera: Pick<EditorCamera, "framed" | "frameFrom" | "viewDir">
  name: string
  projectId: number
  viewerPanels: Panel[]
  models: CompositionBuild["models"] | undefined
  hasMoving: boolean
  hasSelectedZone: boolean
  sceneGetter: RefObject<SceneGetter | null>
}) {
  const { viewTab, setViewTab, viewMode, setViewMode, showHoles, setShowHoles, exploded, setExploded, viewer, hardware, setHardware, quality, roleColors, setRoleColors, viewerState, setViewer } = opts
  const { framed, frameFrom, viewDir } = camera
  // «Veure a casa»: visor 3D amb el botó d'AR Quick Look (Safari a l'iPhone/iPad).
  const [arOpen, setArOpen] = useState(false)
  // «Opcions de vista» obert: es tanca en obrir el Render (si no, el popover o el calaix quedaven a sobre).
  const [viewOptsOpen, setViewOptsOpen] = useState(false)

  // Accions ràpides del visor, a dalt de «Opcions de vista» (com el menú de visualització
  // de Fusion o Blender): el mode en un grup i la resta com a botons amb icona i nom.
  // Només icona (el text no hi cabia): el nom i l'explicació, al tooltip.
  const tile = (key: string, label: string, icon: ReactNode, on: boolean, onClick: () => void, tip?: string) => <ViewTile key={key} label={label} icon={icon} on={on} onClick={onClick} tip={tip} />
  const viewModes = (
    <SimpleGrid columns={2} gap={1.5}>
      {VIEW_MODES.map(([v, label, tip, Icon]) => tile(v, label, <Icon />, viewMode === v, () => setViewMode(v), `${label}: ${tip}`))}
    </SimpleGrid>
  )
  // El Render, al menú de l'app (a sobre de Preferències; per decisió de l'usuari, 2026-10-16), no a «Opcions de vista».
  // Des de l'Alçat o la Foto, primer el 3D (el render és de l'escena 3D).
  const startRender = () => {
    setViewOptsOpen(false)
    if (viewTab !== "3d") setViewTab("3d")
    if (quality === "fast" && roleColors) setRoleColors(false)
    if (!hardware) setHardware(true)
    openRender({ getScene: () => sceneGetter.current?.() ?? null, name, saveKey: `moble:${projectId}` })
  }
  useRenderLauncher(`moble:${projectId}`, startRender)
  const viewTiles = (
    <>
      {tile("holes", "Forats", <LuCircleDot />, showHoles || exploded || viewer.opacity < 1, () => setShowHoles((v) => !v), exploded ? "A la vista explosionada els forats sempre es veuen" : viewer.opacity < 1 ? "Amb les peces translúcides (Opacitat) els forats sempre es veuen" : showHoles ? "Amagar forats" : "Mostrar forats")}
      {tile("explode", "Explosió", exploded ? <LuShrink /> : <LuExpand />, exploded, () => setExploded((v) => !v), exploded ? "Vista muntada" : "Vista explosionada")}
      {tile("hardware", "Ferratges", <LuWrench />, hardware, () => setHardware((v) => !v), hardware ? "Amagar frontisses, tiradors i potes" : "Mostrar frontisses, tiradors i potes")}
      {/* Al mòbil no hi ha menú lateral: el Render hi continua. */}
      <Box display={{ base: "contents", md: "none" }}>{tile("render", "Render", <LuAperture />, false, startRender, "Render fotorealista")}</Box>
      {tile("ar", "A casa (AR)", <LuView />, false, () => setArOpen(true), "Veure a casa (realitat augmentada)")}
    </>
  )

  return (
    <>
    {/* Les vistes, sempre a la vista a baix del 3D (per decisió de l'usuari, 2026-10-16): botons d'icona sense text (el nom,
        al tooltip), amb la 3D (el 3/4 d'«Enquadrar»). La triada surt marcada mentre la càmera no es mou. */}
    {viewTab === "3d" && (
      <Box position="absolute" bottom={3} left="50%" transform="translateX(-50%)" zIndex={2}>
        <HStack {...segGroup} bg="bg.panel" role="group" aria-label="Vistes">
          {VIEW_BUTTONS.map(([v, label, Icon, tip]) => {
            const on = framed && viewDir === v
            return (
              <Tooltip key={v ?? "3d"} content={tip}>
                <IconButton {...segItem(on)} aria-label={label} aria-pressed={on} onClick={() => frameFrom(v)}>
                  <Icon />
                </IconButton>
              </Tooltip>
            )
          })}
        </HStack>
      </Box>
    )}
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
          <ViewerControls state={viewerState} onChange={setViewer} hasMoving={hasMoving} hasSelectedZone={hasSelectedZone} />
        </Box>
      </ViewOptions>
    </Stack>
    </>
  )
}
