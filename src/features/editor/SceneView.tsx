import { CabinetViewer } from "../../components/viewer/CabinetViewer"
import type { SceneGetter } from "../../components/viewer/render/RenderDialog"
import { anchorRef, groupItems, makeRoomForRef, moveAllBy, moveModuleBy, moveMultiBy, refBlocksRow, type Composition, type Module, type Settings } from "../../core/model"
import { toaster } from "../../components/ui/toaster"
import { hoverTarget, useHoverLink } from "../../components/hoverLink"
import type { Selection } from "../composition/StructureTree"
import type { CompositionEdits } from "./editorCommands"
import type { EditorCamera } from "./useEditorCamera"
import type { SetComp } from "./useEditorDoc"
import type { SceneData } from "./useSceneData"
import type { ViewerOptions } from "./useViewerOptions"
import type { viewerPicks } from "./viewerPicks"

/** El visor 3D de l'editor: el moble amb la selecció, els gizmos per moure i la càmera. */
export function SceneView({
  comp,
  setComp,
  materials,
  scene,
  opts,
  camera,
  selection,
  module,
  selectionLocked,
  select,
  pick,
  picks,
  edits,
  onSceneAccess,
  onProps,
}: {
  /** Botó dret: les propietats del que s'ha triat, al costat del ratolí (px). */
  onProps: (at: { x: number; y: number }) => void

  comp: Composition
  setComp: SetComp
  materials: Settings["materials"]
  scene: SceneData
  opts: Pick<ViewerOptions, "exploded" | "showHoles" | "viewer" | "viewerState" | "quality" | "hardware">
  camera: EditorCamera
  selection: Selection
  module: Module | undefined
  selectionLocked: boolean
  select: (s: Selection) => void
  pick: (s: Selection) => void
  picks: ReturnType<typeof viewerPicks>
  edits: Pick<CompositionEdits, "moveGroup" | "movePart" | "moveModel" | "moveRef">
  onSceneAccess: (g: SceneGetter) => void
}) {
  const { shownPanels, frameSize, viewerModules, ghosts, openOnly, cutPartIds, collidingRefs, cuttingRefs, highlightZone, zoneBox, solidParts } = scene
  const { exploded, showHoles, viewer, viewerState, quality, hardware } = opts
  const { viewDir, fitKey, setFramed, cameraRef, saveCamera, cameraGoto, cameraFly, alert } = camera
  const { selectFrom3D, selectPartFrom3D, selectModelFrom3D, hoverKeyAt, selectHovered } = picks
  const { moveGroup, movePart, moveModel, moveRef } = edits
  // Un objecte de referència deixat sobre els mòduls d'una fila: s'avisa i es pot fer-li lloc entre ells (`makeRoomForRef`).
  const dropRef = (id: string, pos: { x: number; y: number; z: number }) => {
    moveRef(id, pos)
    const moved = { ...comp, references: comp.references.map((r) => (r.id === id ? anchorRef({ ...r, ...pos }) : r)) }
    if (!refBlocksRow(moved, id)) return
    const name = comp.references.find((r) => r.id === id)?.name ?? "L'objecte"
    toaster.create({
      title: `«${name}» trepitja els mòduls`,
      description: "«Fer-li lloc» el posa entre els mòduls i desplaça els de la dreta perquè hi càpiga.",
      type: "info",
      action: { label: "Fer-li lloc", onClick: () => setComp((c) => makeRoomForRef(c, id)) },
    })
  }
  // Compartiment sota el ratolí a l'arbre (`moduleId/zoneId`, `zoneHoverKey`).
  const link = useHoverLink()
  const hovered = hoverTarget(link.hover)
  const [hoverModuleId, hoverZoneId] = hovered?.kind === "zone" ? hovered.id.split("/") : []
  return (
    <CabinetViewer
      sceneFinish={comp.scene}
      panels={shownPanels}
      size={frameSize}
      exploded={exploded}
      // A la vista explosionada i amb les peces translúcides els forats i les ranures sempre es veuen.
      showHoles={showHoles || exploded || viewer.opacity < 1}
      seeThrough={viewer.opacity < 1 ? viewer.opacity : undefined}
      modules={viewerModules.filter((v) => !comp.modules.find((m) => m.id === v.id)?.hidden)}
      selectedModuleId={(selection.kind === "module" || selection.kind === "zone") && module ? module.id : null}
      onSelectModule={selectFrom3D}
      hoverAt={hoverKeyAt}
      ghosts={ghosts}
      viewDir={viewDir}
      opening={viewer.opening}
      openOnly={openOnly}
      materialMode={viewerState.materialMode}
      materials={materials}
      quality={quality}
      onDeselect={() => select({ kind: "moble" })}
      onContextClick={(x, y) => {
        selectHovered(link.hover)
        onProps({ x, y })
      }}
      selectedRefId={selection.kind === "ref" ? selection.id : selection.kind === "part" && cutPartIds.has(selection.id) ? `part:${selection.id}` : null}
      collidingRefIds={collidingRefs}
      cuttingRefIds={cuttingRefs}
      highlightZone={highlightZone}
      hoverZone={hoverModuleId && hoverZoneId && !(selection.kind === "zone" && selection.moduleId === hoverModuleId && selection.zoneId === hoverZoneId) ? zoneBox(hoverModuleId, hoverZoneId) : null}
      onSelectRef={(id) => {
        if (id.startsWith("part:")) return pick({ kind: "part", id: id.slice(5) })
        // D'un grup (com les peces): el primer clic tria el grup; el segon, l'objecte.
        const g = comp.references.find((r) => r.id === id)?.group
        const inside = g && ((selection.kind === "group" && selection.id === g) || (selection.kind === "ref" && comp.references.find((r) => r.id === selection.id)?.group === g))
        pick(g && !inside ? { kind: "group", id: g } : { kind: "ref", id })
      }}
      fitKey={fitKey}
      onFramedChange={setFramed}
      initialCamera={cameraRef.current}
      onCameraChange={saveCamera}
      cameraGoto={cameraGoto}
      cameraFly={cameraFly}
      alertPanels={alert?.panels}
      onMoveRef={selectionLocked ? undefined : (id, pos) => (id.startsWith("part:") ? movePart(id.slice(5), pos) : dropRef(id, pos))}
      hardware={hardware}
      onSceneAccess={onSceneAccess}
      parts={solidParts}
      selectedPartId={selection.kind === "part" ? selection.id : null}
      onSelectPart={selectPartFrom3D}
      selectedSet={selection.kind === "multi" ? selection.items : selection.kind === "group" ? groupItems(comp, selection.id) : undefined}
      onMoveSet={selectionLocked ? undefined : selection.kind === "multi" ? (dx, dy, dz) => setComp((c) => moveMultiBy(c, selection.items, dx, dy, dz)) : selection.kind === "group" ? (dx, dy, dz) => moveGroup(selection.id, dx, dy, dz) : undefined}
      onMovePart={selectionLocked ? undefined : movePart}
      models={comp.models?.filter((g) => !g.hidden)}
      selectedModelId={selection.kind === "model" ? selection.id : null}
      onSelectModel={selectModelFrom3D}
      selectedHardwareId={selection.kind === "hardware" ? selection.id : null}
      onSelectHardware={(id) => select({ kind: "hardware", id })}
      onMoveModel={selectionLocked ? undefined : moveModel}
      onMoveModule={selectionLocked ? undefined : (id, dx, dy, all, dz) => setComp((c) => (all ? moveAllBy(c, dx) : moveModuleBy(c, id, dx, dy, dz)))}
    />
  )
}
