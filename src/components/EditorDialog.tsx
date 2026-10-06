import { CloseButton, Dialog, HStack, Portal, Text } from "@chakra-ui/react"
import { useRef, type ReactNode, type RefObject } from "react"

/**
 * Editor d'un element de Preferències a pantalla completa (materials, ferratges; com la finestra del Render: 100vw ×
 * 100dvh, zona segura als quatre costats i el ✕ a `calc(env(safe-area-inset-top) + 8px)`). Esc i ✕ tornen a la
 * graella; amb `dirty` (un nom a mig escriure), Esc només el desfà. El focus va al ✕ (al mòbil no surt el teclat) o, amb
 * `focusSelector`, a aquell camp (un element nou: el nom). El cos és una fila a l'ordinador gran (`lg`) i una columna a
 * sota: a l'esquerra la mostra (bola, dibuix) i a la dreta el formulari.
 */
export function EditorDialog({
  open,
  title,
  subtitle,
  onClose,
  dirty,
  focusSelector,
  children,
}: {
  open: boolean
  title?: string
  subtitle?: string
  onClose: () => void
  dirty?: RefObject<boolean>
  focusSelector?: string | null
  children: ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size="full"
      placement="center"
      onEscapeKeyDown={(e) => dirty?.current && e.preventDefault()}
      initialFocusEl={() => (focusSelector ? contentRef.current?.querySelector<HTMLElement>(focusSelector) : null) ?? closeRef.current}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={contentRef} w="100vw" maxW="100vw" h="100dvh" maxH="100dvh" rounded="none" display="flex" flexDirection="column" overflow="hidden" pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)" ps="env(safe-area-inset-left, 0px)" pe="env(safe-area-inset-right, 0px)">
            {/* A l'altura del ✕ (a 8 px de dalt): el títol queda centrat amb ell. */}
            <Dialog.Header py={0} pe={14} minH="calc(var(--chakra-sizes-9) + 16px)" display="flex" alignItems="center" borderBottomWidth="1px">
              <HStack gap={2} minW={0}>
                <Dialog.Title truncate fontSize="md">
                  {title}
                </Dialog.Title>
                {subtitle && (
                  <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                    {subtitle}
                  </Text>
                )}
              </HStack>
            </Dialog.Header>
            <Dialog.Body p={0} flex={1} minH={0} display="flex" flexDirection={{ base: "column", lg: "row" }} overflowY={{ base: "auto", lg: "hidden" }}>
              {children}
            </Dialog.Body>
            <Dialog.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)" insetEnd="calc(env(safe-area-inset-right, 0px) + 8px)">
              <CloseButton ref={closeRef} size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
