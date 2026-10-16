import { Box, Button, Text } from "@chakra-ui/react"
import { LuAperture } from "react-icons/lu"
import { renderProgressText, renderStateText, showRender, useRenderHost, useRenderStatus } from "../components/viewer/render/renderStore"
import { NavItem } from "./NavItem"

/** El render d'ara si ja s'ha començat (calculant, aturat o acabat), i si es veu (obert i no minimitzat). */
function useBackgroundRender() {
  const status = useRenderStatus()
  const { open } = useRenderHost()
  if (!status?.begun) return null
  return { status, visible: open && !status.minimized, detail: `${renderStateText(status)} · ${renderProgressText(status)}` }
}

/**
 * Menú lateral (ordinador): «Render · nom» amb el progrés mentre hi ha un render començat, també amb el panell tancat o
 * minimitzat (per decisió de l'usuari: «l'app ho ha de mostrar en algun lloc»). En tocar-lo, es torna a veure el panell.
 */
export function RenderStatusNavItem({ collapsed }: { collapsed: boolean }) {
  const r = useBackgroundRender()
  if (!r) return null
  // Mentre calcula, la icona en vermell i fent pampallugues (per decisió de l'usuari, 2026-10-16).
  return <NavItem icon={LuAperture} label={`Render · ${r.status.name}`} detail={r.detail} collapsed={collapsed} active={r.visible} disabled={false} onClick={showRender} alert={r.status.running} />
}

/** Mòbil: una píndola sobre la barra de baix quan el panell del Render és tancat i n'hi ha un de començat. */
export function RenderStatusChip() {
  const r = useBackgroundRender()
  if (!r || r.visible) return null
  return (
    <Box display={{ base: "block", md: "none" }} position="fixed" insetEnd={3} bottom="calc(68px + env(safe-area-inset-bottom, 0px))" zIndex="sticky" maxW="calc(100vw - 24px)">
      <Button size="sm" variant="surface" colorPalette="wood" rounded="full" shadow="md" maxW="full" onClick={showRender} aria-label={`Render de ${r.status.name}: ${r.detail}. Obrir`}>
        {r.status.running ? (
          <Box as="span" display="inline-flex" color="red.solid" animation="blink 1s steps(2, jump-none) infinite" _motionReduce={{ animation: "none" }}>
            <LuAperture />
          </Box>
        ) : (
          <LuAperture />
        )}
        <Text as="span" truncate fontVariantNumeric="tabular-nums">
          {r.status.name} · {r.detail}
        </Text>
      </Button>
    </Box>
  )
}
