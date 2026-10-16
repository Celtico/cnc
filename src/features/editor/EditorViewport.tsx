import { Box, IconButton, SegmentGroup } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuBox, LuCamera, LuLayoutPanelLeft, LuMaximize2, LuMinimize2 } from "react-icons/lu"
import { Tooltip } from "../../components/ui/tooltip"
import { RoleLegend } from "../../components/viewer/roleColors"
import type { Panel } from "../../core/model"
import type { ViewTab, ViewerOptions } from "./useViewerOptions"

/**
 * El visor del mig: pestanyes 3D · Alçat · Foto, la llegenda de colors, ampliar (mòbil), plegar els panells (`chrome`)
 * i els botons del visor (`toolbar`).
 */
export function EditorViewport({
  opts,
  shownPanels,
  photo,
  elevation,
  scene,
  toolbar,
  chrome,
}: {
  opts: Pick<ViewerOptions, "viewTab" | "setViewTab" | "formHidden" | "setFormHidden" | "viewerState">
  shownPanels: Panel[]
  photo: ReactNode
  elevation: ReactNode
  scene: ReactNode
  toolbar: ReactNode
  chrome: ReactNode
}) {
  const { viewTab, setViewTab, formHidden, setFormHidden, viewerState } = opts

  return (
    <Box
      order={{ base: 0, md: 2 }}
      flex={{ md: 1 }}
      minW={{ base: 0, md: "320px" }}
      position="relative"
      h={formHidden ? { base: "calc(100dvh - 52px - 56px - 16px - 76px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", md: "full" } : { base: "42vh", md: "full" }}
      // Amb els marges de la pàgina (no a tota l'amplada) i les quatre cantonades arrodonides, com el visor dels ambients.
      rounded="xl"
      overflow="hidden"
      borderWidth="1px"
      bg="bg.subtle"
    >
      {viewTab === "photo" ? (
        <Box position="absolute" inset={0} overflowY="auto" pt={14} px={3} pb={3}>
          {photo}
        </Box>
      ) : viewTab === "elevation" ? (
        <Box position="absolute" inset={0} overflow="hidden" pt={14} px={4} pb={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
          {elevation}
        </Box>
      ) : (
        scene
      )}
      {viewTab === "3d" && viewerState.materialMode === "role" && (
        <Box position="absolute" bottom={3} left={3} zIndex={2} display={{ base: "none", md: "block" }}>
          <RoleLegend panels={shownPanels} />
        </Box>
      )}
      {/* La recepta del SegmentGroup força position: relative; el posicionem amb un embolcall. */}
      <Box position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={2}>
        <SegmentGroup.Root size="sm" bg="bg.panel" value={viewTab} onValueChange={(e) => e.value && setViewTab(e.value as ViewTab)}>
          <SegmentGroup.Indicator />
          {(
            [
              ["3d", "3D", LuBox, "Composició en 3D"],
              ["elevation", "Alçat", LuLayoutPanelLeft, "Alçat frontal del mòdul (compartiments)"],
              ["photo", "Foto", LuCamera, "Composició sobre la foto"],
            ] as const
          ).map(([v, label, Icon, aria]) => (
            // Només la icona (per decisió de l'usuari, 2026-10-16); el nom, al tooltip.
            <Tooltip key={v} content={`${label}: ${aria}`}>
              <SegmentGroup.Item value={v} aria-label={`${label}: ${aria}`}>
                <SegmentGroup.ItemText>
                  <Icon />
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            </Tooltip>
          ))}
        </SegmentGroup.Root>
      </Box>
      {/* Mòbil: ampliar el visor (amaga les pestanyes de sota). */}
      <IconButton
        position="absolute"
        top={3}
        left={3}
        zIndex={2}
        display={{ base: "inline-flex", md: "none" }}
        aria-label={formHidden ? "Mostrar els panells" : "Ampliar el visor"}
        aria-expanded={!formHidden}
        size="sm"
        variant="surface"
        colorPalette="wood"
        onClick={() => setFormHidden((v) => !v)}
      >
        {formHidden ? <LuMinimize2 /> : <LuMaximize2 />}
      </IconButton>
      {/* Ordinador: plegar/desplegar l'arbre (esquerra) i les propietats (dreta). */}
      {chrome}
      {toolbar}
    </Box>
  )
}
