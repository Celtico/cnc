import { FloatingPanel, HStack, IconButton, Portal, Text, useBreakpointValue, useFloatingPanel } from "@chakra-ui/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react"
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from "react-icons/lu"
import { MODAL_OPEN } from "../lib/keyTarget"
import { Tooltip } from "./ui/tooltip"
import { defaultWindowRect, fitWindowRect, keepGrabbable, MIN_SIZE, readWindowMaximized, readWindowRect, writeWindowMaximized, writeWindowRect, type WindowKind, type WindowRect } from "./windowRect"

type Stage = "default" | "minimized" | "maximized"

/** El primer camp on s'escriu (el cercador d'una tria, el nom): hi va el focus en obrir-se, si no es diu res més. */
const FIRST_FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=color]):not([disabled]), textarea'

/**
 * **Finestra flotant**, la mateixa per a tot el que s'obre per triar o editar (per decisió de l'usuari, 2026-10-15: «tot el
 * que s'obre, una finestra com la del Render»): Render, tries de material i de ferratge, editors de Preferències, textura,
 * perfil, Vista CAM, importar, desar com a fitxer… Les confirmacions curtes («Esborrar?») són diàlegs de Chakra.
 *
 * Un `FloatingPanel` de Chakra, **no modal**: l'app de darrere es continua fent servir. A l'ordinador es mou per la barra
 * de títol, s'estira per les vores, es minimitza (només la barra), es maximitza (o doble clic a la barra) i es restaura;
 * la mida i el lloc es recorden per `id` (al navegador). El primer cop, segons `kind` (`windowRect.ts`): una tria, estreta
 * i alta a la dreta; un editor, gran i al mig de la zona de treball. Al mòbil, sempre a tota la pantalla, dins de la zona
 * segura. Per sobre de les barres de l'app; entre finestres, **la que es toca (o té el focus) passa al davant** (la pila
 * de Chakra). Esc tanca la del davant (la que té el focus). Els menús, els avisos i les confirmacions que s'obren des
 * d'una finestra hi queden per sobre; una finestra que s'obre des d'un diàleg modal (el substitut d'«Eliminar material»)
 * va per sobre del diàleg (`WINDOWS_PERSIST`).
 */
export function FloatingWindow({
  id,
  kind = "editor",
  open,
  onClose,
  title,
  subtitle,
  width,
  height,
  closeOnEscape = true,
  dirty,
  initialFocus,
  shown,
  onStageChange,
  minimizeHint = "Minimitzar",
  closeHint = "Tancar",
  footer,
  split,
  bodyProps,
  contentRef,
  testId,
  at,
  children,
}: {
  /** S'obre al costat d'aquest punt (px de la finestra del navegador), amb la mida recordada: les propietats del botó dret. */
  at?: { x: number; y: number }
  /** La mida i el lloc es recorden per id: totes les tries de material comparteixen el seu. */
  id: string
  kind?: WindowKind
  open: boolean
  onClose: () => void
  title: ReactNode
  /** A la barra de títol, al costat del títol (la categoria, el progrés del Render). */
  subtitle?: ReactNode
  /** La mida que vol el primer cop (sense, la del `kind`). */
  width?: number
  height?: number
  closeOnEscape?: boolean
  /** Un camp a mig escriure (el nom): Esc el desfà i no tanca la finestra. */
  dirty?: RefObject<boolean>
  /** On va el focus en obrir-se: un selector de dins, `false` = la finestra (al mòbil no surt el teclat). Sense: el primer camp. */
  initialFocus?: string | false
  /** Puja cada cop que es demana veure-la: si era minimitzada, es restaura (el Render). */
  shown?: number
  onStageChange?: (stage: Stage) => void
  minimizeHint?: string
  closeHint?: string
  /** Botons de sota (Cancel·lar · Aplicar), sempre a la vista. */
  footer?: ReactNode
  /** Editors de Preferències: el cos sense marge, la mostra i el formulari de costat (a l'ordinador gran) o un sota l'altre. */
  split?: boolean
  bodyProps?: FloatingPanel.BodyProps
  contentRef?: Ref<HTMLDivElement>
  testId?: string
  children: ReactNode
}) {
  const mobile = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false
  const [first] = useState(() => defaultWindowRect(kind, { width: window.innerWidth, height: window.innerHeight }, { width, height }))
  const rect = useRef<WindowRect>(first)
  const stageRef = useRef<Stage>("default")
  const inner = useRef<HTMLDivElement | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  // Oberta des d'un diàleg modal: per sobre seu (si no, quedaria sota el fons del diàleg).
  const [overModal, setOverModal] = useState(false)
  const save = () => stageRef.current === "default" && writeWindowRect(id, rect.current)
  // En tancar-la, la màquina torna l'estat a «default»: el que es recorda (maximitzada o no) és el d'abans de tancar.
  const closing = useRef(false)
  const close = () => {
    if (!mobile && stageRef.current !== "minimized") writeWindowMaximized(id, stageRef.current === "maximized")
    closing.current = true
    onClose()
  }
  const panel = useFloatingPanel({
    open,
    onOpenChange: (e) => !e.open && close(),
    defaultSize: { width: first.width, height: first.height },
    defaultPosition: { x: first.x, y: first.y },
    minSize: MIN_SIZE,
    // Pot sortir en part de la finestra del navegador (una de gran no es podia moure); en deixar-la anar, la barra de
    // títol sempre queda a l'abast (`keepGrabbable`).
    allowOverflow: true,
    // Esc el fa `onKeyDownCapture` (amb `dirty` i des d'un diàleg modal).
    closeOnEscape: false,
    draggable: !mobile,
    resizable: !mobile,
    initialFocusEl: () => {
      const root = inner.current
      if (!root || initialFocus === false) return root
      return root.querySelector<HTMLElement>(initialFocus ?? FIRST_FIELD) ?? root
    },
    // En tancar-la, el focus torna on era (el botó que l'ha oberta).
    finalFocusEl: () => (returnTo.current?.isConnected ? returnTo.current : null),
    translations: { minimize: "Minimitzar", maximize: "Maximitzar", restore: "Restaurar" },
    onPositionChange: (e) => (rect.current = { ...rect.current, ...e.position }),
    onSizeChange: (e) => (rect.current = { ...rect.current, ...e.size }),
    onPositionChangeEnd: () => {
      const p = keepGrabbable(rect.current, { width: window.innerWidth, height: window.innerHeight })
      if (p.x !== rect.current.x || p.y !== rect.current.y) {
        rect.current = { ...rect.current, ...p }
        panel.setPosition(p)
      }
      save()
    },
    onSizeChangeEnd: save,
    onStageChange: (e) => {
      stageRef.current = e.stage
      // Maximitzada es recorda (es torna a obrir així); minimitzar no (en tornar-la a obrir, es vol veure).
      if (!mobile && !closing.current && e.stage !== "minimized") writeWindowMaximized(id, e.stage === "maximized")
      onStageChange?.(e.stage)
    },
  })

  // En obrir-se (abans que la màquina l'obri, `useEffect`): la mida i el lloc recordats (o els del `kind`), dins de la
  // finestra d'ara, i si va per sobre d'un diàleg.
  const wasOpen = useRef(false)
  const justOpened = useRef(false)
  useLayoutEffect(() => {
    const opening = open && !wasOpen.current
    // Tancada des de fora (Aplicar, la selecció ha canviat…): es recorda com era abans que la màquina la torni a «default».
    if (!open && wasOpen.current && !closing.current) {
      if (!mobile && stageRef.current !== "minimized") writeWindowMaximized(id, stageRef.current === "maximized")
      closing.current = true
    }
    wasOpen.current = open
    if (!opening) return
    justOpened.current = true
    closing.current = false
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOverModal(!!document.querySelector(MODAL_OPEN))
    const view = { width: window.innerWidth, height: window.innerHeight }
    const r = fitWindowRect(nextTo(readWindowRect(id) ?? defaultWindowRect(kind, view, { width, height }), at), view)
    rect.current = r
    panel.setSize({ width: r.width, height: r.height })
    panel.setPosition({ x: r.x, y: r.y })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només en obrir-se; `panel` és nou a cada render
  }, [open])

  // Ja oberta (després que la màquina l'obri): al mòbil, a tota la pantalla; si es torna a demanar (`shown`) minimitzada, es restaura.
  useEffect(() => {
    if (!open) return
    // L'estat de la màquina pot venir de la vegada anterior (maximitzada o minimitzada) mentre la mida ja és la recordada:
    // es torna a «default» amb la mida recordada i, si es va deixar a tota la pantalla, es maximitza de nou (si no, es
    // pensava que era maximitzada sense ser-ho i no es podia moure).
    if (!justOpened.current) {
      if (mobile) panel.maximize()
      else if (stageRef.current === "minimized") panel.restore()
      return
    }
    justOpened.current = false
    const r = rect.current
    if (stageRef.current !== "default") panel.restore()
    panel.setSize({ width: r.width, height: r.height })
    panel.setPosition({ x: r.x, y: r.y })
    // Maximitzar, quan la màquina ja és oberta del tot (abans no en fa cas).
    if (mobile || readWindowMaximized(id)) {
      const raf = requestAnimationFrame(() => panel.maximize())
      return () => cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- en obrir-la, en demanar-la (`shown`) i en passar a mòbil; `panel` és nou a cada render
  }, [open, shown, mobile])

  // Ja oberta, un altre punt (un altre clic amb el botó dret): s'hi torna a posar.
  const atKey = at ? `${at.x},${at.y}` : ""
  useEffect(() => {
    if (!open || !at || justOpened.current || mobile) return
    const r = fitWindowRect(nextTo(rect.current, at), { width: window.innerWidth, height: window.innerHeight })
    rect.current = r
    panel.setPosition({ x: r.x, y: r.y })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només quan canvia el punt; `panel` és nou a cada render
  }, [atKey])

  const setContent = (el: HTMLDivElement | null) => {
    inner.current = el
    if (typeof contentRef === "function") contentRef(el)
    else if (contentRef) contentRef.current = el
  }

  return (
    <FloatingPanel.RootProvider value={panel} lazyMount unmountOnExit>
      <Portal>
        {/* Per sobre de les barres de l'app (i de les altres finestres, segons la pila: `--z-index`); els menús, els avisos i
            els diàlegs, per sobre seu. Compte: la variable és `--chakra-z-index-*` (amb `indices` no existeix i queda «auto»). */}
        <FloatingPanel.Positioner
          data-floating-window=""
          data-over-modal={overModal ? "" : undefined}
          style={overModal ? { zIndex: "calc(var(--chakra-z-index-popover) + 200 + var(--z-index, 1))", pointerEvents: "auto" } : { zIndex: "calc(var(--chakra-z-index-banner) + var(--z-index, 1))" }}
        >
          <FloatingPanel.Content
            ref={setContent}
            data-testid={testId}
            borderWidth="1px"
            // Al mòbil (maximitzada), dins de la zona segura: per sota de la barra d'estat i lluny de la cantonada.
            css={{ "&[data-maximized]": { rounded: "none", borderWidth: 0, pt: "env(safe-area-inset-top, 0px)", pb: "env(safe-area-inset-bottom, 0px)", ps: "env(safe-area-inset-left, 0px)", pe: "env(safe-area-inset-right, 0px)" } }}
            // Tocar-la la porta al davant (el focus ho fa; Safari no dona el focus als botons en clicar-los).
            onPointerDown={(e) => {
              if (!e.currentTarget.contains(document.activeElement)) e.currentTarget.focus({ preventScroll: true })
            }}
            onKeyDownCapture={(e) => {
              if (e.key !== "Escape" || !closeOnEscape || dirty?.current || !e.currentTarget.hasAttribute("data-topmost")) return
              close()
            }}
          >
            <FloatingPanel.Header py={1.5} pe={1.5}>
              <FloatingPanel.DragTrigger style={mobile ? { cursor: "default" } : undefined}>
                <FloatingPanel.Title flex="0 1 auto">{title}</FloatingPanel.Title>
                {subtitle && (
                  <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" truncate flex="1 1 0" minW={0}>
                    {subtitle}
                  </Text>
                )}
              </FloatingPanel.DragTrigger>
              <FloatingPanel.Control>
                <HStack gap={0.5}>
                  {!mobile && (
                    <>
                      <Tooltip content={minimizeHint}>
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
                  <Tooltip content={closeHint}>
                    <FloatingPanel.CloseTrigger asChild>
                      <IconButton aria-label="Tancar" size="xs" variant="ghost">
                        <LuX />
                      </IconButton>
                    </FloatingPanel.CloseTrigger>
                  </Tooltip>
                </HStack>
              </FloatingPanel.Control>
            </FloatingPanel.Header>
            {split ? (
              <FloatingPanel.Body p={0} display="flex" flexDirection={{ base: "column", lg: "row" }} overflowY={{ base: "auto", lg: "hidden" }} {...bodyProps}>
                {children}
              </FloatingPanel.Body>
            ) : (
              <FloatingPanel.Body p={4} {...bodyProps}>
                {children}
              </FloatingPanel.Body>
            )}
            {footer && (
              <HStack justify="flex-end" gap={3} px={4} py={3} borderTopWidth="1px" flexShrink={0} flexWrap="wrap">
                {footer}
              </HStack>
            )}
            {!mobile && <FloatingPanel.ResizeTriggers />}
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </Portal>
    </FloatingPanel.RootProvider>
  )
}

/** La finestra al costat del punt (a la dreta i una mica amunt, que la barra de títol quedi a prop del ratolí). */
function nextTo(r: WindowRect, at?: { x: number; y: number }): WindowRect {
  return at ? { ...r, x: at.x + 12, y: at.y - 24 } : r
}
