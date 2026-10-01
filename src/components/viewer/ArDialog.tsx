import { Box, Button, CloseButton, Dialog, HStack, Portal, Spinner, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState, type DetailedHTMLProps, type HTMLAttributes } from "react"
import { LuView } from "react-icons/lu"
import type { Panel } from "../../core/model"
import { exportGlb } from "./exportGlb"
import { exportUsdz, supportsQuickLook } from "./exportUsdz"
import { exportablePanel } from "./exportablePanel"
import { useSettings } from "../../features/settings/SettingsContext"

type ModelViewerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string
  "ios-src"?: string
  ar?: boolean
  "ar-modes"?: string
  "ar-scale"?: string
  "camera-controls"?: boolean
  "touch-action"?: string
  "shadow-intensity"?: string
  exposure?: string
  "environment-image"?: string
  "shadow-softness"?: string
  "tone-mapping"?: string
  "camera-orbit"?: string
  alt?: string
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps
    }
  }
}

interface Urls {
  glb: string
  usdz?: string
}

/**
 * «Veure a casa»: visor `<model-viewer>` amb el moble en 3D (GLB) i, a Safari de
 * l'iPhone/iPad, el botó que l'obre a mida real a l'habitació amb AR Quick Look (USDZ).
 * El component web es carrega només en obrir el diàleg.
 */
export function ArDialog({ open, onClose, panels, name }: { open: boolean; onClose: () => void; panels: Panel[]; name: string }) {
  const [urls, setUrls] = useState<Urls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ios = supportsQuickLook()
  // Els mateixos materials i textures que el visor (i els tiradors), no colors per tipus.
  const { settings } = useSettings()
  const real = useMemo(() => ({ materials: settings.materials, make: exportablePanel }), [settings.materials])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let made: Urls | null = null
    setUrls(null)
    setError(null)
    void (async () => {
      try {
        const [, glb, usdz] = await Promise.all([
          import("@google/model-viewer"),
          exportGlb(panels, name, real),
          ios ? exportUsdz(panels, name, real) : Promise.resolve(null),
        ])
        if (cancelled) return // tancat abans d'acabar: no es creen les URL (quedarien sense alliberar)
        made = { glb: URL.createObjectURL(glb), ...(usdz ? { usdz: URL.createObjectURL(usdz) } : {}) }
        setUrls(made)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    })()
    return () => {
      cancelled = true
      if (made) {
        URL.revokeObjectURL(made.glb)
        if (made.usdz) URL.revokeObjectURL(made.usdz)
      }
    }
  }, [open, panels, name, ios, real])

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Veure a casa</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Box position="relative" h={{ base: "60dvh", md: "480px" }} borderRadius="md" overflow="hidden" bg="bg.muted">
                  {error ? (
                    <Text p={4} color="fg.error">
                      No s'ha pogut preparar el model: {error}
                    </Text>
                  ) : urls ? (
                    <model-viewer
                      src={urls.glb}
                      {...(urls.usdz ? { "ios-src": urls.usdz } : {})}
                      ar={ios}
                      ar-modes="quick-look"
                      ar-scale="fixed"
                      camera-controls
                      touch-action="pan-y"
                      shadow-intensity="1"
                      shadow-softness="0.8"
                      exposure="1"
                      environment-image="neutral"
                      tone-mapping="neutral"
                      camera-orbit="-25deg 75deg auto"
                      alt={name}
                      style={{ width: "100%", height: "100%", display: "block" }}
                    >
                      {ios && (
                        <Button slot="ar-button" colorPalette="wood" size="sm" position="absolute" bottom={3} left="50%" transform="translateX(-50%)">
                          <LuView /> Veure a l'habitació
                        </Button>
                      )}
                    </model-viewer>
                  ) : (
                    <HStack h="full" justify="center" color="fg.muted">
                      <Spinner size="sm" /> <Text textStyle="sm">Preparant el model…</Text>
                    </HStack>
                  )}
                </Box>
                <Text textStyle="xs" color="fg.muted">
                  {ios
                    ? "Arrossega per girar-lo. «Veure a l'habitació» el posa a mida real a terra: mou l'iPhone fins que detecti el terra."
                    : "Arrossega per girar-lo. La realitat augmentada funciona amb Safari a l'iPhone o l'iPad: obre-hi aquesta app i prem el mateix botó."}
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
