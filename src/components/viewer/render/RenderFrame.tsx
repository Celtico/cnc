import { FloatingPanel, HStack, IconButton, Portal, Text, useBreakpointValue, useFloatingPanel } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from "react-icons/lu"
import { Tooltip } from "../../ui/tooltip"

type Stage = "default" | "minimized" | "maximized"

/** On s'obre el panell el primer cop: al mòbil, a tota la pantalla; a l'ordinador, gran i al mig. */
function initialRect(mobile: boolean) {
  const W = window.innerWidth
  const H = window.innerHeight
  if (mobile) return { size: { width: W, height: H }, position: { x: 0, y: 0 } }
  const width = Math.min(1200, W - 96)
  const height = Math.min(820, H - 96)
  return { size: { width, height }, position: { x: Math.round((W - width) / 2), y: Math.round((H - height) / 2) } }
}

/**
 * La finestra del Render: un `FloatingPanel` de Chakra (no modal: es pot continuar treballant mentre calcula). A
 * l'ordinador es mou per la barra de títol, s'estira per les vores i es minimitza (només la barra, amb el progrés),
 * es maximitza (o doble clic a la barra) i es restaura. Al mòbil, sempre a tota la pantalla, dins de la zona segura;
 * es tanca (el render continua) i es torna a obrir des del menú (`RenderStatusNav`).
 * `shown` puja cada cop que es demana veure'l: si era minimitzat, es restaura.
 */
export function RenderFrame({ open, onClose, shown, name, progress, onMinimizedChange, children }: { open: boolean; onClose: () => void; shown: number; name: string; /** Progrés curt per a la barra de títol (buit si encara no ha començat). */ progress: string; onMinimizedChange: (minimized: boolean) => void; children: ReactNode }) {
  const mobile = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false
  const [rect] = useState(() => initialRect(mobile))
  const stageRef = useRef<Stage>("default")
  const panel = useFloatingPanel({
    open,
    onOpenChange: (e) => !e.open && onClose(),
    defaultSize: rect.size,
    defaultPosition: rect.position,
    minSize: { width: 360, height: 280 },
    // Que no surti de la finestra en moure'l.
    allowOverflow: false,
    closeOnEscape: true,
    draggable: !mobile,
    resizable: !mobile,
    translations: { minimize: "Minimitzar", maximize: "Maximitzar", restore: "Restaurar" },
    onStageChange: (e) => {
      stageRef.current = e.stage
      onMinimizedChange(e.stage === "minimized")
    },
  })

  useEffect(() => {
    if (!open) return
    if (mobile) panel.maximize()
    else if (stageRef.current === "minimized") panel.restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- en obrir-lo, en demanar-lo (`shown`) i en passar a mòbil; `panel` és nou a cada render
  }, [open, shown, mobile])

  return (
    <FloatingPanel.RootProvider value={panel} lazyMount unmountOnExit>
      <Portal>
        {/* Per sobre de les barres de l'app i per sota dels diàlegs, menús i avisos (el de la recepta, `popover`, els tapava). */}
        <FloatingPanel.Positioner style={{ zIndex: "var(--chakra-z-indices-banner)" }}>
          <FloatingPanel.Content
            borderWidth="1px"
            // Al mòbil (maximitzat), dins de la zona segura: per sota de la barra d'estat i lluny de la cantonada.
            css={{ "&[data-maximized]": { rounded: "none", borderWidth: 0, pt: "env(safe-area-inset-top, 0px)", pb: "env(safe-area-inset-bottom, 0px)", ps: "env(safe-area-inset-left, 0px)", pe: "env(safe-area-inset-right, 0px)" } }}
          >
            <FloatingPanel.Header py={1.5} pe={1.5}>
              <FloatingPanel.DragTrigger style={mobile ? { cursor: "default" } : undefined}>
                <FloatingPanel.Title flex="0 1 auto">Render · {name}</FloatingPanel.Title>
                {progress && (
                  <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" truncate flex="1 1 0" minW={0}>
                    {progress}
                  </Text>
                )}
              </FloatingPanel.DragTrigger>
              <FloatingPanel.Control>
                <HStack gap={0.5}>
                  {!mobile && (
                    <>
                      <Tooltip content="Minimitzar: el render continua">
                        <FloatingPanel.StageTrigger stage="minimized" asChild>
                          <IconButton aria-label="Minimitzar" size="xs" variant="ghost">
                            <LuMinus />
                          </IconButton>
                        </FloatingPanel.StageTrigger>
                      </Tooltip>
                      <Tooltip content="Maximitzar">
                        <FloatingPanel.StageTrigger stage="maximized" asChild>
                          <IconButton aria-label="Maximitzar" size="xs" variant="ghost">
                            <LuMaximize2 />
                          </IconButton>
                        </FloatingPanel.StageTrigger>
                      </Tooltip>
                      <Tooltip content="Restaurar">
                        <FloatingPanel.StageTrigger stage="default" asChild>
                          <IconButton aria-label="Restaurar" size="xs" variant="ghost">
                            <LuMinimize2 />
                          </IconButton>
                        </FloatingPanel.StageTrigger>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip content="Tancar: si calcula, continua (es torna a obrir des del menú)">
                    <FloatingPanel.CloseTrigger asChild>
                      <IconButton aria-label="Tancar" size="xs" variant="ghost">
                        <LuX />
                      </IconButton>
                    </FloatingPanel.CloseTrigger>
                  </Tooltip>
                </HStack>
              </FloatingPanel.Control>
            </FloatingPanel.Header>
            {/* El cos és un contenidor: la imatge i les opcions van de costat o una sota l'altra segons l'amplada del panell. */}
            <FloatingPanel.Body p={3} css={{ containerType: "inline-size", containerName: "render" }}>
              {children}
            </FloatingPanel.Body>
            {!mobile && <FloatingPanel.ResizeTriggers />}
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </Portal>
    </FloatingPanel.RootProvider>
  )
}
