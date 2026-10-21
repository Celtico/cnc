import { Splitter } from "@chakra-ui/react"
import { useRef, useState } from "react"
import type { BackdropKind, Panorama } from "./backdrops"
import { PanelSplit, SplitHandle } from "../../PanelSplit"
import { usePersistentNumber } from "../../../lib/usePersistentNumber"
import { DEFAULT_LOOK, type Job, type Look, type RenderSource, type SceneGetter } from "./renderConfig"
import { RenderFrame } from "./RenderFrame"
import { RenderOptionsPanel } from "./RenderOptionsPanel"
import { renderProgressText, usePublishRenderStatus } from "./renderStore"
import { NARROW } from "./renderLayout"
import { RenderViewport } from "./RenderViewport"
import { useBackdropLoader } from "./useBackdropLoader"
import { useAutoRestart, useElapsedClock, useRenderEngine } from "./useRenderEngine"
import { useRenderLifecycle } from "./useRenderLifecycle"
import { useRenderOutput } from "./useRenderOutput"
import { useRenderSettings, useSaveRenderPrefs } from "./useRenderSettings"

export type { SceneGetter } from "./renderConfig"

/** L'amplada per defecte de la columna d'opcions (px). */
const OPTIONS_WIDTH = 300

/**
 * «Render»: imatge fotorealista amb path tracing, com el render físic de Cinema 4D. Dos motors
 * amb el mateix resultat: **GPU** (WebGPU, `gpuTracer`) i **CPU** (un worker per nucli,
 * `pathWorker`). Es va afinant (cada passada és una mostra més per píxel); es pot aturar i desar
 * en PNG. **Comença aturat**: no es calcula res fins que no es prem «Començar».
 * Opcions: motor, qualitat i llum tornen a començar el càlcul; les d'imatge (exposició,
 * contrast, saturació, fons) només retoquen el to, a l'instant.
 * És un panell flotant (`RenderFrame`): es pot continuar treballant mentre calcula; publica com va (`usePublishRenderStatus`)
 * per a l'indicador del menú i per preguntar abans de fer-ne un d'un altre document.
 */
export function RenderDialog({ open, onClose, shown, getScene, name, saveKey }: { open: boolean; onClose: () => void; /** Puja cada cop que es demana veure'l (`renderStore.ts`). */ shown: number; getScene: SceneGetter; name: string; /** Desa la configuració per a aquest document (`renderPrefs.ts`). */ saveKey?: string }) {
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
  const [minimized, setMinimized] = useState(false)
  const [optionsWidth, setOptionsWidth] = usePersistentNumber("mobles:render-options-width", OPTIONS_WIDTH)
  // Desat en PNG: la feina i les passades del moment (si en calcula més o torna a començar, ja no ho és).
  const [saved, setSaved] = useState<{ job: Job | null; passes: number } | null>(null)
  const markSaved = () => setSaved({ job: j, passes })
  const unsaved = passes > 0 && !(saved && saved.job === j && saved.passes >= passes)
  const status = !begun
    ? "Aturat: prem «Començar» per calcular la imatge."
    : preparing
      ? "Preparant la GPU…"
      : `${renderProgressText({ passes, limit, elapsed })}${elapsed && passes ? ` (${(passes / elapsed).toFixed(passes / elapsed < 10 ? 1 : 0)}/s)` : ""} · ${j ? `${j.w} × ${j.h} px` : "—"} · ${engineLabel}`

  const progress = begun && !preparing ? renderProgressText({ passes, limit, elapsed }) : ""
  usePublishRenderStatus({ saveKey: saveKey ?? "", name, begun, running: engine.running, passes, limit, elapsed, unsaved, minimized })

  return (
    <RenderFrame open={open} onClose={onClose} shown={shown} name={name} progress={progress} onMinimizedChange={setMinimized}>
      {/* Estret (el mòbil o el panell petit): la imatge a dalt i les opcions a sota, tot amb desplaçament; ample, de costat,
          amb la vora arrossegable (`PanelSplit`). L'amplada desada és la de les opcions, sense els 16 px fins a la imatge. */}
      <PanelSplit stackWhen={NARROW} minH={0} h="full" panels={[{ id: "image", min: 320 }, { id: "options", width: optionsWidth + 16, setWidth: (w) => setOptionsWidth(w - 16), min: 276, max: 576 }]}>
        <Splitter.Panel id="image" display="flex" flexDirection="column" minH={0}>
          <RenderViewport canvas={output.canvas} engine={engine} background={look.background} preview={preview} notice={notice} status={status} name={name} onSaved={markSaved} />
        </Splitter.Panel>
        <SplitHandle id="image:options" label="Amplada de les opcions del Render" onReset={() => setOptionsWidth(OPTIONS_WIDTH)} />
        <Splitter.Panel id="options" display="flex" flexDirection="column" minH={0}>
          {/* 3 px a l'esquerra: el desplaçament de la columna no talla la vora ni l'anell de focus dels controls. */}
          <RenderOptionsPanel settings={settings} engine={engine} viewKind={viewKind} pano={pano} setPano={setPano} setNotice={setNotice} setLook={setLook} denoiser={output.denoiser} scheduleDenoise={output.scheduleDenoise} onReset={reset} />
        </Splitter.Panel>
      </PanelSplit>
    </RenderFrame>
  )
}
