import { Alert, Card, Stack } from "@chakra-ui/react"
import { LuMove } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { NumRow } from "../../components/NumRow"
import type { Composition } from "../../core/model"
import type { Pt } from "../../core/photo/homography"
import { WIDE_ANGLE_FOCAL_35 } from "../../core/photo/measure"
import type { Photo, PhotoCalibration } from "../../db/db"
import { ESTIMATED_WARNING, estimatedApplied } from "./appliedState"
import type { SetCal, Tool } from "./calibration"
import { LookSection } from "./LookSection"
import { MeasuresSection } from "./MeasuresSection"
import { ReferenceSection } from "./ReferenceSection"
import { ToolsSection } from "./ToolsSection"
import type { CalibrationScene } from "./useCalibrationScene"

/** Panell de controls de la foto: avisos i seccions plegables (referència, eines, mesures, posició i aspecte). */
export function PhotoInspector({
  cal,
  setCal,
  scene,
  photo,
  embedded,
  customRef,
  setCustomRef,
  tool,
  setTool,
  setPending,
  composition,
  onApplyMeasure,
  renderMode,
  renderShadows,
  opacity,
  layer,
  marksInRender,
  setMarksInRender,
  onDownload,
}: {
  cal: PhotoCalibration
  setCal: SetCal
  scene: CalibrationScene
  photo: Photo
  embedded: boolean
  customRef: boolean
  setCustomRef: (v: boolean) => void
  tool: Tool
  setTool: (t: Tool) => void
  setPending: (pts: Pt[]) => void
  composition?: Composition
  onApplyMeasure?: (target: string, valueMm: number) => void
  renderMode: NonNullable<PhotoCalibration["render"]>
  renderShadows: boolean
  opacity: number
  layer: NonNullable<PhotoCalibration["layer"]>
  marksInRender: boolean
  setMarksInRender: (v: boolean) => void
  onDownload: () => void
}) {
  const { quality, camera } = scene
  const estimated = estimatedApplied(cal)

  return (
    <Card.Root variant="outline" w="full" flexShrink={0} {...(embedded ? { bg: "transparent", borderWidth: 0, shadow: "none" } : {})}>
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
          <ReferenceSection cal={cal} setCal={setCal} scene={scene} exifFocal35={photo.exifFocal35} customRef={customRef} setCustomRef={setCustomRef} />
          <ToolsSection cal={cal} setCal={setCal} scene={scene} tool={tool} setTool={setTool} setPending={setPending} />
          <MeasuresSection applied={cal.applied} setCal={setCal} scene={scene} composition={composition} onApplyMeasure={onApplyMeasure} />
          <FoldItem id="photo-position" title="Posició del moble" icon={LuMove}>
            <NumRow label="X (de costat)" value={cal.offset[0]} min={-10000} max={10000} step={10} onChange={(x) => setCal((c) => ({ ...c, offset: [x, c.offset[1]] }))} />
            <NumRow label={cal.plane === "wall" ? "Y (alçada)" : "Y (distància)"} value={cal.offset[1]} min={-10000} max={10000} step={10} onChange={(y) => setCal((c) => ({ ...c, offset: [c.offset[0], y] }))} />
            {cal.plane === "wall" && <NumRow label="Z (paret)" value={cal.offsetZ ?? 0} min={0} max={3000} step={10} onChange={(z) => setCal((c) => ({ ...c, offsetZ: Number.isFinite(z) ? z : 0 }))} />}
          </FoldItem>
          <LookSection
            setCal={setCal}
            renderMode={renderMode}
            renderShadows={renderShadows}
            opacity={opacity}
            layer={layer}
            marksInRender={marksInRender}
            setMarksInRender={setMarksInRender}
            canDownload={!!camera}
            onDownload={onDownload}
          />
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
