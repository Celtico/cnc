import { Badge, Box, HStack, IconButton, SegmentGroup, Stack } from "@chakra-ui/react"
import { useState } from "react"
import {
  LuAperture,
  LuAppWindow,
  LuBrickWall,
  LuDoorOpen,
  LuEye,
  LuGrid3X3,
  LuHouse,
  LuImage,
  LuLayers,
  LuLock,
  LuLockOpen,
  LuMagnet,
  LuMap,
  LuMousePointer2,
  LuPanelTop,
  LuPenTool,
  LuRotate3D,
  LuRuler,
  LuSun,
  LuTag,
  LuUndoDot,
  LuVideo,
  LuWarehouse,
} from "react-icons/lu"
import { Tooltip } from "../../../components/ui/tooltip"
import { ViewOptions, ViewTile } from "../../../components/ViewOptions"
import type { Tool } from "../planGeom"
import type { ViewFlagsState } from "./useViewFlags"

const TOOLS: { id: Tool; label: string; key: string; icon: typeof LuPenTool }[] = [
  { id: "select", label: "Seleccionar i moure", key: "V", icon: LuMousePointer2 },
  { id: "wall", label: "Paret (ploma)", key: "P", icon: LuPenTool },
  { id: "room", label: "Habitació (rectangle)", key: "H", icon: LuBrickWall },
  { id: "window", label: "Finestra (clic a una paret)", key: "F", icon: LuAppWindow },
  { id: "door", label: "Porta (clic a una paret)", key: "D", icon: LuDoorOpen },
]

/** Pestanyes del visor (com a l'editor): Plànol · 3D, a dalt al mig. */
export function ViewerTabs({ tab, onTab }: { tab: "plan" | "3d"; onTab: (t: "plan" | "3d") => void }) {
  return (
    <Box position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={2}>
      <SegmentGroup.Root size="sm" bg="bg.panel" value={tab} onValueChange={(e) => e.value && onTab(e.value as "plan" | "3d")}>
        <SegmentGroup.Indicator />
        {(
          [
            ["plan", "Plànol", LuMap, "Plànol (vista de dalt)"],
            ["3d", "3D", LuRotate3D, "Ambient en 3D"],
          ] as const
        ).map(([v, label, Icon, aria]) => (
          <SegmentGroup.Item key={v} value={v} aria-label={aria}>
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <Icon /> <Box as="span" display={{ base: "none", sm: "inline" }}>{label}</Box>
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </Box>
  )
}

/** Eines de dibuix del plànol (com les barres d'eines dels CAD): en columna a l'esquerra. */
export function DrawTools({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
  return (
    <Stack position="absolute" top={{ base: 3, md: 14 }} left={3} zIndex={2} gap={0.5} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} shadow="sm">
      {TOOLS.map((t) => (
        <Tooltip key={t.id} content={`${t.label} (${t.key})`} positioning={{ placement: "right" }}>
          <IconButton aria-label={t.label} size="sm" variant={tool === t.id ? "solid" : "ghost"} colorPalette={tool === t.id ? "wood" : undefined} onClick={() => onTool(t.id)}>
            <t.icon />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  )
}

/** Càmera del 3D, a baix a l'esquerra: bloquejar-la i tornar a la d'abans. */
export function CameraButtons({ locked, onToggleLock, canGoBack, onBack }: { locked: boolean; onToggleLock: () => void; canGoBack: boolean; onBack: () => void }) {
  return (
    <HStack position="absolute" bottom={3} left={3} zIndex={2} gap={0.5} bg="bg.panel" rounded="md" borderWidth="1px" p={0.5} shadow="sm">
      <Tooltip content={locked ? "Càmera bloquejada: el ratolí no la mou (clic per desbloquejar)" : "Bloquejar la càmera (el ratolí no la mourà: per no perdre l'enquadrament del render)"}>
        <IconButton aria-label={locked ? "Desbloquejar la càmera" : "Bloquejar la càmera"} aria-pressed={locked} size="sm" variant={locked ? "solid" : "ghost"} colorPalette={locked ? "wood" : undefined} onClick={onToggleLock}>
          {locked ? <LuLock /> : <LuLockOpen />}
        </IconButton>
      </Tooltip>
      <Tooltip content="Tornar a la càmera d'abans">
        <IconButton aria-label="Càmera d'abans" size="sm" variant="ghost" disabled={!canGoBack} onClick={onBack}>
          <LuUndoDot />
        </IconButton>
      </Tooltip>
    </HStack>
  )
}

/** Opcions de vista (com a l'editor), a dalt a la dreta. */
export function AmbientViewOptions({
  tab,
  flags,
  planFramed,
  pose,
  hasPlan,
  hasRoof,
  onFit,
  onEye,
  onTab,
  onRender,
}: {
  tab: "plan" | "3d"
  flags: ViewFlagsState
  planFramed: boolean
  pose: "home" | "eye" | null
  hasPlan: boolean
  hasRoof: boolean
  onFit: () => void
  onEye: () => void
  onTab: (t: "plan" | "3d") => void
  onRender: () => void
}) {
  const { showGrid, setShowGrid, showDims, setShowDims, showLabels, setShowLabels, showDetail, setShowDetail, snapOn, setSnapOn, showPlan, setShowPlan, dollhouse, setDollhouse, shadows, setShadows, ceiling, setCeiling, roofOn, setRoofOn } = flags
  // «Opcions de vista» obert: es tanca en obrir el Render (si no, el popover o el calaix quedaven a sobre).
  const [viewOptsOpen, setViewOptsOpen] = useState(false)
  return (
    <Box position="absolute" top={3} right={{ base: 3, md: 14 }} zIndex={2}>
      <ViewOptions
        open={viewOptsOpen}
        onOpenChange={setViewOptsOpen}
        tiles={
          tab === "plan" ? (
            <>
              <ViewTile label="Enquadrar" icon={<LuVideo />} on={planFramed} onClick={onFit} tip="Enquadrar el plànol" />
              <ViewTile label="Graella" icon={<LuGrid3X3 />} on={showGrid} onClick={() => setShowGrid((v) => !v)} />
              <ViewTile label="Mides" icon={<LuRuler />} on={showDims} onClick={() => setShowDims((v) => !v)} tip="Mides de les parets" />
              <ViewTile label="Noms" icon={<LuTag />} on={showLabels} onClick={() => setShowLabels((v) => !v)} tip="Noms i mides dels elements" />
              <ViewTile label="Peces" icon={<LuLayers />} on={showDetail} onClick={() => setShowDetail((v) => !v)} tip="Les peces dels mobles vistes des de dalt" />
              <ViewTile label="Imant" icon={<LuMagnet />} on={snapOn} onClick={() => setSnapOn((v) => !v)} tip="Imant a les parets i als extrems (Alt: sense, puntualment)" />
              {hasPlan && <ViewTile label="Plànol de fons" icon={<LuImage />} on={showPlan} onClick={() => setShowPlan((v) => !v)} />}
              {/* El Render és al menú de l'app; al mòbil (sense menú lateral), aquí. */}
              <Box display={{ base: "contents", md: "none" }}><ViewTile label="Render" icon={<LuAperture />} on={false} onClick={() => (setViewOptsOpen(false), onTab("3d"), onRender())} tip="Render fotorealista (des del 3D)" /></Box>
            </>
          ) : (
            <>
              <ViewTile label="Enquadrar" icon={<LuVideo />} on={pose === "home"} onClick={onFit} />
              <ViewTile label="Interior" icon={<LuEye />} on={pose === "eye"} onClick={onEye} tip="Entrar a l'habitació: càmera anivellada a 1,35 m, mirant la paret del fons, com les fotos d'interiors" />
              <ViewTile label="Casa de nines" icon={<LuHouse />} on={dollhouse} onClick={() => setDollhouse((v) => !v)} tip="Parets de davant transparents" />
              <ViewTile label="Ombres" icon={<LuSun />} on={shadows} onClick={() => setShadows((v) => !v)} />
              <ViewTile label="Sostre" icon={<LuPanelTop />} on={ceiling} onClick={() => setCeiling((v) => !v)} tip="Sostre a les habitacions tancades: es veu des de dins («Interior») i al render la llum entra per les finestres" />
              {hasRoof && <ViewTile label="Teulada" icon={<LuWarehouse />} on={roofOn} onClick={() => setRoofOn((v) => !v)} tip="La teulada de l'ambient (Propietats › Teulada). Amb la casa de nines, des de fora es fa transparent" />}
              <Box display={{ base: "contents", md: "none" }}><ViewTile label="Render" icon={<LuAperture />} on={false} onClick={() => (setViewOptsOpen(false), onRender())} tip="Render fotorealista" /></Box>
            </>
          )
        }
      />
    </Box>
  )
}

/** Què fa l'eina de dibuix triada, a baix al mig del plànol. */
export function ToolHint({ tool }: { tool: Tool }) {
  return (
    <Badge position="absolute" bottom={3} left="50%" transform="translateX(-50%)" colorPalette="wood" size="md" pointerEvents="none" maxW="90%" whiteSpace="normal" textAlign="center">
      {tool === "wall" ? "Paret: clica punt a punt · clica el primer per tancar · Retorn o Esc per acabar" : tool === "room" ? "Habitació: arrossega un rectangle" : tool === "window" ? "Finestra: clica sobre una paret (després la pots arrossegar i canviar-ne les mides)" : tool === "door" ? "Porta: clica sobre una paret (després la pots arrossegar i canviar-ne les mides)" : "Calibrar: clica dos punts d'una mida coneguda"}
    </Badge>
  )
}
