import { Alert, Button, HStack, Text } from "@chakra-ui/react"
import { LuArrowUpFromLine, LuX } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import type { Composition } from "../../core/model"
import type { Pt } from "../../core/photo/homography"
import type { PhotoCalibration } from "../../db/db"
import type { DepthResult, SetCal, Tool } from "./calibration"
import type { CalibrationScene } from "./useCalibrationScene"
import { IconAction } from "../../components/IconAction"

const POINT_NAMES = ["baix-esquerra", "baix-dreta", "dalt-dreta", "dalt-esquerra"]

/** Sota la foto: quin punt de la referència toca marcar o què fa l'eina activa. */
export function CalibrationHint({ cal, scene, showMarks, tool, pending }: { cal: PhotoCalibration; scene: CalibrationScene; showMarks: boolean; tool: Tool; pending: Pt[] }) {
  const { calibrated, effective, camera, origin3 } = scene

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

  return !calibrated ? (
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
  )
}

/** Resultat de l'eina de fondària, amb on es pot aplicar. */
export function DepthAlert({
  depthResult,
  onClose,
  plane,
  composition,
  setCal,
  onApplyMeasure,
}: {
  depthResult: DepthResult
  onClose: () => void
  plane: PhotoCalibration["plane"]
  composition?: Composition
  setCal: SetCal
  onApplyMeasure?: (target: string, valueMm: number) => void
}) {
  const applyDepth = (target: "wall" | string) => {
    if (target === "wall") {
      setCal((c) => ({ ...c, refWallOffset: Math.max(0, depthResult.depth) }))
      toaster.create({ title: `Referència a ${depthResult.depth} mm de la paret`, description: "L'escala de la paret s'ha recalculat.", type: "success" })
    } else if (onApplyMeasure) {
      onApplyMeasure(target, Math.max(1, depthResult.depth))
      toaster.create({ title: `Fondària aplicada: ${depthResult.depth} mm`, description: `Estimada (±${Math.round(depthResult.error * 100)} %).`, type: "success" })
    }
    onClose()
  }

  return (
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
            {plane === "wall" && (
              <Button size="xs" variant="outline" onClick={() => applyDepth("wall")}>
                Distància de la referència a la paret
              </Button>
            )}
            {(composition?.references ?? []).map((r) => (
              <Button key={r.id} size="xs" variant="outline" onClick={() => applyDepth(`ref:${r.id}:d`)}>
                Fondària de «{r.name}»
              </Button>
            ))}
            <IconAction label="Tancar" size="xs" variant="ghost" onClick={onClose}>
              <LuX />
            </IconAction>
          </HStack>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  )
}
