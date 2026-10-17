import { Box, Button, HStack, Image, Stack, Text } from "@chakra-ui/react"
import type { RefObject } from "react"
import { LuDownload, LuPause, LuPlay, LuRotateCcw } from "react-icons/lu"
import { downloadBlob } from "../../../lib/download"
import { Tooltip } from "../../ui/tooltip"
import type { Background } from "./renderConfig"
import { WIDE } from "./renderLayout"
import type { RenderEngineState } from "./useRenderEngine"

/** La imatge del Render (o, abans de «Començar», la del visor de fons), els avisos, l'estat i els botons. */
export function RenderViewport({ canvas, engine, background, preview, notice, status, name, onSaved }: { canvas: RefObject<HTMLCanvasElement | null>; engine: RenderEngineState; background: Background; preview: string | null; notice: string | null; status: string; name: string; /** S'ha desat el PNG (per no preguntar en fer-ne un altre, `renderStore.ts`). */ onSaved: () => void }) {
  const { begun, running, preparing, passes, error, begin, toggle, startOver } = engine

  const save = () => {
    // Desar el PNG mentre calcula l'atura (per decisió de l'usuari, 2026-10-16): la imatge desada és la final.
    if (running) toggle()
    canvas.current?.toBlob((b) => {
      if (b) downloadBlob(b, `${name || "moble"}-render.png`)
    }, "image/png")
    onSaved()
  }

  return (
    <Stack flex="none" minH={0} minW={0} gap={3} css={{ [WIDE]: { flex: 1 } }}>
      <Box
        // Estret: més de mitja pantalla, sense passar de l'amplada (al mòbil, una foto vertical hi cap); ample, tot el que queda.
        h="min(55vh, 100cqw)"
        css={{ [WIDE]: { flex: 1, height: "auto" } }}
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
              {/* Al mòbil, només la icona (per decisió de l'usuari, 2026-10-17: els tres botons no hi cabien). */}
              <Tooltip content={running ? "Aturar" : "Continuar"}>
                <Button size="sm" variant="outline" onClick={toggle} disabled={preparing} aria-label={running ? "Aturar" : "Continuar"} px={{ base: 2, md: 3 }}>
                  {running ? <LuPause /> : <LuPlay />}
                  <Box as="span" display={{ base: "none", md: "inline" }}>{running ? "Aturar" : "Continuar"}</Box>
                </Button>
              </Tooltip>
              {!running && (
                <Tooltip content="Tornar a començar amb el moble tal com és ara">
                  <Button size="sm" variant="ghost" onClick={startOver} disabled={preparing} aria-label="De nou" px={{ base: 2, md: 3 }}>
                    <LuRotateCcw />
                    <Box as="span" display={{ base: "none", md: "inline" }}>De nou</Box>
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
