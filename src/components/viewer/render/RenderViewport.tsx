import { Box, Button, HStack, Image, Stack, Text } from "@chakra-ui/react"
import type { RefObject } from "react"
import { LuDownload, LuPause, LuPlay, LuRotateCcw } from "react-icons/lu"
import { Tooltip } from "../../ui/tooltip"
import type { Background } from "./renderConfig"
import type { RenderEngineState } from "./useRenderEngine"

/** La imatge del Render (o, abans de «Començar», la del visor de fons), els avisos, l'estat i els botons. */
export function RenderViewport({ canvas, engine, background, preview, notice, status, name }: { canvas: RefObject<HTMLCanvasElement | null>; engine: RenderEngineState; background: Background; preview: string | null; notice: string | null; status: string; name: string }) {
  const { begun, running, preparing, passes, error, begin, toggle, startOver } = engine

  const save = () => {
    canvas.current?.toBlob((b) => {
      if (!b) return
      const a = document.createElement("a")
      a.href = URL.createObjectURL(b)
      a.download = `${name || "moble"}-render.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }, "image/png")
  }

  return (
    <Stack flex={{ base: "none", md: 1 }} minH={0} minW={0} gap={3}>
      <Box
        flex={{ md: 1 }}
        h={{ base: "55vh", md: "auto" }}
        minH="200px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        rounded="md"
        overflow="hidden"
        // Quadrícula de transparència quan el fons és transparent.
        bg={background === "transparent" && begun ? undefined : "bg.muted"}
        style={background === "transparent" && begun ? { background: "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 16px 16px" } : undefined}
      >
        <canvas ref={canvas} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: begun ? undefined : "none" }} />
        {!begun && (
          <>
            {preview && <Image src={preview} alt="" position="absolute" inset={0} w="full" h="full" objectFit="contain" opacity={0.45} />}
            <Stack position="relative" align="center" gap={3} p={4} textAlign="center">
              <Button size="lg" colorPalette="wood" onClick={begin}>
                <LuPlay /> Començar
              </Button>
              <Text fontSize="sm" color="fg.muted" maxW="22em">
                Tria les opcions i prem «Començar»: fins llavors no es calcula res.
              </Text>
            </Stack>
          </>
        )}
      </Box>
      {error && (
        <Text fontSize="xs" color="fg.error">
          {error} Prem «Continuar» per tornar-ho a provar.
        </Text>
      )}
      {notice && (
        <Text fontSize="xs" color="fg.warning">
          {notice}
        </Text>
      )}
      <HStack justify="space-between" wrap="wrap" gap={2}>
        {/* Petit i pot saltar de línia (al mòbil no ha de sortir de la pantalla). */}
        <Text fontSize="xs" color="fg.muted" data-render-status minW={0} flex="1 1 180px" overflowWrap="anywhere" fontVariantNumeric="tabular-nums">
          {status}
        </Text>
        <HStack gap={2}>
          {begun ? (
            <>
              <Button size="sm" variant="outline" onClick={toggle} disabled={preparing}>
                {running ? <LuPause /> : <LuPlay />} {running ? "Aturar" : "Continuar"}
              </Button>
              {!running && (
                <Tooltip content="Tornar a començar amb el moble tal com és ara">
                  <Button size="sm" variant="ghost" onClick={startOver} disabled={preparing}>
                    <LuRotateCcw /> De nou
                  </Button>
                </Tooltip>
              )}
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={begin}>
              <LuPlay /> Començar
            </Button>
          )}
          <Button size="sm" colorPalette="wood" onClick={save} disabled={!passes}>
            <LuDownload /> Desar PNG
          </Button>
        </HStack>
      </HStack>
    </Stack>
  )
}
