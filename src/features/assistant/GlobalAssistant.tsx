import { Box, Drawer, Portal, useBreakpointValue } from "@chakra-ui/react"
import { lazy, Suspense, useMemo, useRef } from "react"
import type { Settings } from "../../core/model"
import { allToolSet, contextLine, setAppSettings } from "./appTools"
import { currentDoc, useHubDoc, type HubDoc } from "./assistantHub"
import type { ChatTarget } from "./chatTarget"
import { useLatest } from "../../lib/useLatest"

const ChatPanel = lazy(() => import("./ChatPanel"))

const APP_SUGGESTIONS = [
  "Què tinc obert i què tinc seleccionat?",
  "Obre l'últim moble que vaig fer servir.",
  "Crea un moble nou que es digui «Calaixera del rebedor».",
  "Quins ambients tinc?",
]

/**
 * **Assistent personal** de tota l'app (per decisió de l'usuari, 2026-10-13): el botó «Assistent» del menú principal
 * obre aquest calaix amb el xat de sempre (`ChatPanel`). Les eines són les de l'app (`appTools.ts`: on ets, buscar,
 * obrir, crear, anar a una pàgina) més les del document obert (`assistantHub.ts`), que es tornen a llegir a cada volta.
 * Cada missatge porta davant on és l'usuari i què té seleccionat. La conversa dura mentre l'app és oberta (sense
 * historial desat); el calaix es munta el primer cop que s'obre. Tancar-lo (només la ✕) acaba la conversa.
 */
export default function GlobalAssistant({ open, onClose, settings, closeRequest }: { open: boolean; onClose: () => void; settings: Settings; closeRequest?: number }) {
  const doc = useHubDoc()
  // Les eines de l'app llegeixen les preferències d'ara (màquina, materials…).
  setAppSettings(settings)
  const settingsRef = useLatest(settings)
  // Els documents que l'assistent ha canviat en aquest torn: en acabar, un pas de desfer a cadascun.
  const touched = useRef(new Set<HubDoc>())
  const target = useMemo<ChatTarget<unknown>>(() => {
    // Sempre el mateix joc (totes les eines): un document obert a mitja conversa no canvia res de la petició.
    return {
      toolset: () => allToolSet(settingsRef.current),
      getDoc: () => currentDoc()?.target.getDoc() ?? null,
      apply: (next) => {
        const d = currentDoc()
        if (!d) return
        touched.current.add(d)
        d.target.apply(next)
      },
      commit: () => {
        touched.current.forEach((d) => d.target.commit())
        touched.current.clear()
      },
      context: contextLine,
      intro: doc ? `Ara és obert «${doc.name}»: ${doc.target.intro} També pots demanar-li que obri, busqui o creï altres mobles, objectes i ambients.` : "Demana-li el que faries tu a l'app: buscar, obrir o crear mobles, objectes i ambients, anar a una pàgina… Quan hi hagi un document obert, també el podrà canviar.",
      suggestions: doc ? doc.target.suggestions : APP_SUGGESTIONS,
    }
  }, [doc, settingsRef])
  // A l'ordinador, una columna a la dreta de l'app (per decisió de l'usuari: «encara que estigui obert, s'ha de poder
  // navegar»): l'app s'estreny i tot continua a la vista i es pot fer servir. Al mòbil, el calaix a pantalla completa.
  const docked = useBreakpointValue({ base: false, md: true }) ?? true
  const panel = (
    <Suspense fallback={null}>
      <ChatPanel settings={settings} target={target} onClose={onClose} closeRequest={closeRequest} />
    </Suspense>
  )
  // L'amplada (la vora esquerra, sense cap barra a la vista) és del `PanelSplit` de l'app (`App.tsx`): aquí s'omple la columna.
  if (docked)
    return (
      <Box as="aside" aria-label="Assistent" display={open ? "flex" : "none"} flexDirection="column" h="100dvh" borderLeftWidth="1px" bg="bg.panel" px={4} py={3}>
        {/* Molt estreta (fins a 48 px, com les Propietats): es retalla, no desborda. */}
        <Box flex={1} minH={0} minW={0} overflowX="clip" display="flex" flexDirection="column">
          {panel}
        </Box>
      </Box>
    )
  return (
    // Per decisió de l'usuari: no es tanca sol (ni clicant fora ni amb Esc) i no bloqueja l'app (es pot seguir treballant
    // amb el calaix obert); només la ✕ o el botó del menú. Tancat, la conversa es conserva (el contingut es queda muntat).
    <Drawer.Root open={open} modal={false} closeOnInteractOutside={false} closeOnEscape={false} trapFocus={false} preventScroll={false} placement="bottom" size="full" lazyMount>
      <Portal>
        <Drawer.Positioner pointerEvents="none">
          <Drawer.Content pointerEvents="auto" pt="env(safe-area-inset-top)" pb="env(safe-area-inset-bottom)">
            <Drawer.Body py={3} display="flex" flexDirection="column" minH={0}>
              {panel}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
