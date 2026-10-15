import { CloseButton, Dialog, Portal } from "@chakra-ui/react"
import { useRef, useState } from "react"
import type { BackdropKind, Panorama } from "./backdrops"
import { DEFAULT_LOOK, type Job, type Look, type RenderSource, type SceneGetter } from "./renderConfig"
import { RenderOptionsPanel } from "./RenderOptionsPanel"
import { RenderViewport } from "./RenderViewport"
import { useBackdropLoader } from "./useBackdropLoader"
import { useAutoRestart, useElapsedClock, useRenderEngine } from "./useRenderEngine"
import { useRenderLifecycle } from "./useRenderLifecycle"
import { useRenderOutput } from "./useRenderOutput"
import { useRenderSettings, useSaveRenderPrefs } from "./useRenderSettings"

export type { SceneGetter } from "./renderConfig"

/**
 * «Render»: imatge fotorealista amb path tracing, com el render físic de Cinema 4D. Dos motors
 * amb el mateix resultat: **GPU** (WebGPU, `gpuTracer`) i **CPU** (un worker per nucli,
 * `pathWorker`). Es va afinant (cada passada és una mostra més per píxel); es pot aturar i desar
 * en PNG. **Comença aturat**: no es calcula res fins que no es prem «Començar».
 * Opcions: motor, qualitat i llum tornen a començar el càlcul; les d'imatge (exposició,
 * contrast, saturació, fons) només retoquen el to, a l'instant.
 */
export function RenderDialog({ open, onClose, getScene, name, saveKey }: { open: boolean; onClose: () => void; getScene: SceneGetter; name: string; /** Desa la configuració per a aquest document (`renderPrefs.ts`). */ saveKey?: string }) {
  const [notice, setNotice] = useState<string | null>(null)
  const settings = useRenderSettings(setNotice)
  const { opts, limit, look } = settings
  /** Vista per les finestres carregada (`opts.view`; es carrega a part, com el cel). */
  const [pano, setPano] = useState<{ kind: BackdropKind; p: Panorama } | null>(null)
  const job = useRef<Job | null>(null)
  const source = useRef<RenderSource | null>(null)
  const output = useRenderOutput(job, source, settings.lookRef)
  const engine = useRenderEngine({ getScene, settings, pano, job, source, output, setNotice })

  const setLook = (patch: Partial<Look>) => {
    settings.applyLook({ ...settings.lookRef.current, ...patch })
    output.requestDraw()
  }

  // L'ordre dels efectes compta: el d'obrir (`useRenderLifecycle`) posa `skipSave` abans que el de desar el miri.
  const preview = useRenderLifecycle({ open, getScene, saveKey, engine, output, settings, job, source, setNotice })
  useSaveRenderPrefs(open, saveKey, settings)
  useAutoRestart(open, engine, settings, pano, source)
  const viewKind = opts.view ?? "garden"
  useBackdropLoader(open, viewKind, pano, setPano, setNotice)
  useElapsedClock(engine)

  const reset = () => {
    settings.reset()
    const day = !!getScene()?.scene.userData.daylight
    setLook({ ...DEFAULT_LOOK, auto: day, warmth: day ? 0.25 : 0 })
  }

  const { begun, preparing, passes, elapsed, engineLabel } = engine
  const j = job.current
  const status = !begun
    ? "Aturat: prem «Començar» per calcular la imatge."
    : preparing
      ? "Preparant la GPU…"
      : `${passes}${limit ? ` / ${limit}` : ""} ${passes === 1 ? "passada" : "passades"} · ${elapsed} s${elapsed && passes ? ` (${(passes / elapsed).toFixed(passes / elapsed < 10 ? 1 : 0)}/s)` : ""} · ${j ? `${j.w} × ${j.h} px` : "—"} · ${engineLabel}`

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="full" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {/* A tota la finestra (alçada i amplada), també a l'ordinador; sempre dins de la zona segura (iPad i iPhone de costat). */}
          <Dialog.Content w="100vw" maxW="100vw" h="100dvh" maxH="100dvh" rounded="none" display="flex" flexDirection="column" overflow="hidden" pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)" ps="env(safe-area-inset-left, 0px)" pe="env(safe-area-inset-right, 0px)">
            <Dialog.Header>
              <Dialog.Title>Render</Dialog.Title>
            </Dialog.Header>
            {/* Al mòbil: la imatge a dalt (més de mitja pantalla) i les opcions a sota, tot amb desplaçament. */}
            <Dialog.Body flex={1} display="flex" flexDirection={{ base: "column", md: "row" }} gap={4} minH={0} overflowY={{ base: "auto", md: "hidden" }} px={{ base: 3, md: 6 }}>
              <RenderViewport canvas={output.canvas} engine={engine} background={look.background} preview={preview} notice={notice} status={status} name={name} />

              {/* 3 px a l'esquerra: el desplaçament de la columna no talla la vora ni l'anell de focus dels controls. */}
              <RenderOptionsPanel settings={settings} engine={engine} viewKind={viewKind} pano={pano} setPano={setPano} setNotice={setNotice} setLook={setLook} denoiser={output.denoiser} scheduleDenoise={output.scheduleDenoise} onReset={reset} />
            </Dialog.Body>
            {/* Dins de la zona segura (per sota de la barra d'estat i lluny de la cantonada), a totes les mides. */}
            <Dialog.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)" insetEnd="calc(env(safe-area-inset-right, 0px) + 8px)">
              <CloseButton size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
