import { Box, Flex, HStack, IconButton, SegmentGroup, Splitter } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuListTree, LuPanelLeftClose, LuPanelLeftOpen, LuPanelRightClose, LuPanelRightOpen, LuSlidersHorizontal } from "react-icons/lu"
import { PanelSplit, SplitHandle } from "./PanelSplit"
import { Tooltip } from "./ui/tooltip"
import type { WorkspaceState } from "./useWorkspace"

/**
 * Espai de treball de tres columnes, el mateix a tots els editors de l'app (Editor de mobles i
 * objectes, Ambients), com Figma o Fusion 360: **Estructura** a l'esquerra, el **visor** al mig i
 * les **Propietats** a la dreta. Els panells laterals tenen la vora arrossegable (`PanelSplit`, el `Splitter` de Chakra:
 * 48–900 px; arrossegar-la fins a la vora o Retorn plega el panell) i es pleguen amb els botons de les cantonades del
 * visor; les amplades es recorden per editor (`useWorkspace`). Al mòbil: el visor a dalt i, a sota, les pestanyes
 * Estructura · Propietats.
 *
 * `center` rep els botons de plegar (`chrome`) perquè el visor els posi a dins (ha de ser
 * `position: relative`).
 *
 * `extra`: un segon panell a la columna de la dreta (l'Assistent de l'Editor): a l'ordinador, pestanyes Propietats ·
 * <extra> a dalt de la columna; al mòbil, una tercera pestanya. Es munta el primer cop que s'obre i després es queda
 * muntat (amagat) per no perdre'n l'estat.
 */
interface WorkspaceExtra {
  label: string
  icon: ReactNode
  content: ReactNode
}

export function Workspace({ ws, left, right, center, extra, gap = 1.5 }: { ws: WorkspaceState; left: ReactNode; right: ReactNode; center: (chrome: ReactNode) => ReactNode; extra?: WorkspaceExtra; gap?: number }) {
  const extraOn = { base: ws.mobilePane === "extra", md: ws.rightPane === "extra" }
  // Muntat el primer cop que s'obre (a l'ordinador o al mòbil) i després sempre.
  const [extraMounted, setExtraMounted] = useState(false)
  if (extra && !extraMounted && (extraOn.base || extraOn.md)) setExtraMounted(true)
  const chrome = (
    <>
      <Tooltip content={ws.treeHidden ? "Mostrar l'estructura" : "Amagar l'estructura"}>
        <IconButton position="absolute" top={3} left={3} zIndex={2} display={{ base: "none", md: "inline-flex" }} aria-label={ws.treeHidden ? "Mostrar l'estructura" : "Amagar l'estructura"} aria-expanded={!ws.treeHidden} size="sm" variant="surface" colorPalette="wood" onClick={() => ws.setTreeHidden((v) => !v)}>
          {ws.treeHidden ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
        </IconButton>
      </Tooltip>
      <Tooltip content={ws.propsHidden ? "Mostrar les propietats" : "Amagar les propietats"}>
        <IconButton position="absolute" top={3} right={3} zIndex={2} display={{ base: "none", md: "inline-flex" }} aria-label={ws.propsHidden ? "Mostrar les propietats" : "Amagar les propietats"} aria-expanded={!ws.propsHidden} size="sm" variant="surface" colorPalette="wood" onClick={() => ws.setPropsHidden((v) => !v)}>
          {ws.propsHidden ? <LuPanelRightOpen /> : <LuPanelRightClose />}
        </IconButton>
      </Tooltip>
    </>
  )
  // L'espai entre columnes (`gap`) és farciment dels panells: el Splitter reparteix tota l'amplada entre els panells.
  const g = gap * 4
  return (
    <PanelSplit
      minH={0}
      h={{ md: "full" }}
      flex={{ md: 1 }}
      panels={[
        // L'amplada desada és la de sempre (sense l'espai entre columnes, que ara és farciment del panell).
        { id: "tree", width: ws.treeWidth + g, setWidth: (w) => ws.setTreeWidth(w - g), min: 48 + g, max: 900 + g, hidden: ws.treeHidden, onHide: () => ws.setTreeHidden(true) },
        { id: "center" },
        { id: "props", width: ws.formWidth + g, setWidth: (w) => ws.setFormWidth(w - g), min: 48 + g, max: 900 + g, hidden: ws.propsHidden, onHide: () => ws.setPropsHidden(true) },
      ]}
    >
      {/* Esquerra: estructura */}
      <Splitter.Panel id="tree" order={{ base: 3, md: 0 }} display={{ base: ws.mobilePane === "tree" ? "block" : "none", md: ws.treeHidden ? "none" : "block" }}>
        <Box
          h={{ md: "full" }}
          overflowY={{ md: "auto" }}
          overflowX={{ md: "auto" }}
          // Barra fina i amb lloc reservat: cada panell es desplaça pel seu compte sense «saltar».
          css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
          pt={{ base: 3, md: 0 }}
          pe={{ md: `${4 + g}px` }}
        >
          {/* Sense límit per arrossegar (com IntelliJ): si és més estret, desplaçament horitzontal. */}
          <Box minW="240px">{left}</Box>
        </Box>
      </Splitter.Panel>
      <SplitHandle id="tree:center" hidden={ws.treeHidden} label="Amplada de l'estructura" onReset={() => ws.setTreeWidth(ws.defaults.tree)} />

      <Splitter.Panel id="center" display={{ md: "flex" }} flexDirection="column">
        {/* El farciment, a dins: el del panell no el compta el Splitter i les amplades sortirien desquadrades. */}
        <Flex direction="column" flex={{ md: 1 }} minH={0} ps={{ md: ws.treeHidden ? 0 : `${g}px` }} pe={{ md: ws.propsHidden ? 0 : `${g}px` }}>
          {center(chrome)}
        </Flex>
      </Splitter.Panel>

      {/* Mòbil: pestanyes sota el visor */}
      <Box order={2} display={{ base: "block", md: "none" }} pt={3}>
        <SegmentGroup.Root size="sm" w="full" value={ws.mobilePane} onValueChange={(e) => (e.value === "tree" || e.value === "props" || (extra && e.value === "extra")) && ws.setMobilePane(e.value)}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Item value="tree" flex={1} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuListTree /> Estructura
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          <SegmentGroup.Item value="props" flex={1} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuSlidersHorizontal /> Propietats
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          {extra && (
            <SegmentGroup.Item value="extra" flex={1} justifyContent="center">
              <SegmentGroup.ItemText>
                <HStack gap={1.5}>
                  {extra.icon} {extra.label}
                </HStack>
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          )}
        </SegmentGroup.Root>
      </Box>

      <SplitHandle id="center:props" hidden={ws.propsHidden} label="Amplada de les propietats" onReset={() => ws.setFormWidth(ws.defaults.form)} />

      {/* Dreta: propietats del que hi ha seleccionat */}
      <Splitter.Panel
        id="props"
        order={{ base: 4, md: 0 }}
        display={{ base: ws.mobilePane === "props" || (extra && ws.mobilePane === "extra") ? "block" : "none", md: ws.propsHidden ? "none" : "block" }}
      >
        <Box
          h={{ md: "full" }}
          overflowY={{ md: "auto" }}
          overflowX={{ md: "auto" }}
          css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
          pt={{ base: 3, md: 0 }}
          ps={{ md: `${12 + g}px` }}
        >
          {extra ? (
            <Flex direction="column" minW="300px" h={{ md: "full" }}>
              {/* Ordinador: Propietats · <extra> a dalt de la columna (al mòbil, la tercera pestanya de sota el visor). */}
              <Box display={{ base: "none", md: "block" }} position="sticky" top={0} zIndex={2} bg="bg" pb={2} flexShrink={0}>
                <SegmentGroup.Root size="sm" w="full" value={ws.rightPane} onValueChange={(e) => (e.value === "props" || e.value === "extra") && ws.setRightPane(e.value)}>
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Item value="props" flex={1} justifyContent="center">
                    <SegmentGroup.ItemText>
                      <HStack gap={1.5}>
                        <LuSlidersHorizontal /> Propietats
                      </HStack>
                    </SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="extra" flex={1} justifyContent="center">
                    <SegmentGroup.ItemText>
                      <HStack gap={1.5}>
                        {extra.icon} {extra.label}
                      </HStack>
                    </SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
              </Box>
              <Box display={{ base: extraOn.base ? "none" : "block", md: extraOn.md ? "none" : "block" }}>{right}</Box>
              {extraMounted && (
                <Flex direction="column" flex={{ md: 1 }} minH={0} h={{ base: "70dvh", md: "auto" }} display={{ base: extraOn.base ? "flex" : "none", md: extraOn.md ? "flex" : "none" }}>
                  {extra.content}
                </Flex>
              )}
            </Flex>
          ) : (
            <Box minW="300px">{right}</Box>
          )}
        </Box>
      </Splitter.Panel>
    </PanelSplit>
  )
}
