import { Button, HStack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuArrowDownToLine, LuArrowUpFromLine, LuLocateFixed, LuMoveHorizontal, LuPencilLine, LuRectangleHorizontal, LuX } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { segGroup, segItem } from "../../components/segmented"
import type { Pt } from "../../core/photo/homography"
import type { PhotoCalibration } from "../../db/db"
import type { SetCal, Tool } from "./calibration"
import type { CalibrationScene } from "./useCalibrationScene"
import { IconAction } from "../../components/IconAction"

/** Secció «Eines»: origen, mesures, línia del terra i fondària. */
export function ToolsSection({
  cal,
  setCal,
  scene,
  tool,
  setTool,
  setPending,
}: {
  cal: PhotoCalibration
  setCal: SetCal
  scene: CalibrationScene
  tool: Tool
  setTool: (t: Tool) => void
  setPending: (pts: Pt[]) => void
}) {
  const { calibrated, floor, origin3, originZ } = scene

  const toolButton = (t: Tool, label: string, icon: ReactNode, disabled = false) => (
    <Button
      {...segItem(tool === t)}
      px={2}
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

  return (
    <FoldItem id="photo-tools" title="Eines" icon={LuPencilLine}>
      <HStack {...segGroup}>
        {toolButton("origin", "Origen", <LuLocateFixed />)}
        {toolButton("distance", "Distància", <LuMoveHorizontal />)}
        {toolButton("rect", "Rectangle", <LuRectangleHorizontal />)}
        {toolButton("floor", cal.floorLine ? "Terra" : "Línia del terra", <LuArrowDownToLine />, cal.plane !== "wall")}
        {toolButton("depth", "Fondària", <LuArrowUpFromLine />, !floor)}
        {origin3 && (
          <IconAction size="xs" variant="ghost" label="Treure l'origen" onClick={() => setCal((c) => ({ ...c, origin: undefined, originMm: undefined, originScale: undefined, offset: [0, 0], offsetZ: 0 }))}>
            <LuX />
          </IconAction>
        )}
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {origin3 ? `Origen a ${Math.round(originZ)} mm de la paret${floor ? "; terra a la línia verda" : ""}.` : "Sense origen, es compta des de la cantonada baix-esquerra de la referència."}
        {!floor && cal.plane === "wall" && " Marca la línia del terra per mesurar fondàries i recolzar-hi el moble."}
      </Text>
    </FoldItem>
  )
}
