"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  // Al mòbil, per sobre de la barra de baix (el menú general, 76 px + la zona segura): abans la tapaven.
  offsets: { top: "1rem", left: "1rem", right: "1rem", bottom: "var(--toast-offset-bottom, 1rem)" },
})

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }} css={{ "--toast-offset-bottom": { base: "calc(76px + env(safe-area-inset-bottom, 0px) + 8px)", md: "1rem" } }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {/* Sempre amb ✕: un avís no ha de tapar res que vulguis clicar mentre esperes que marxi. */}
            <Toast.CloseTrigger aria-label="Tancar l'avís" />
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
