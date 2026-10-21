import { Box, Button, Stack, Text } from "@chakra-ui/react"
import { LuCamera, LuCloudSun, LuGauge, LuHouse, LuImage, LuImageUp, LuLamp, LuLightbulb, LuRotateCcw, LuSun } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../FormRow"
import { FoldItem } from "../../Fold"
import { LOW_MEMORY } from "../deviceLimits"
import { BACKDROPS, saveBackdropPhoto, type BackdropKind, type Panorama } from "./backdrops"
import type { EngineKind } from "./engine"
import { Range, Sec, SwitchRow } from "./RenderControls"
import { FOCALS, FORMATS, LOW_MEMORY_MAX, MOODS, RESOLUTIONS, resolutionAllowed, type Background, type Format, type Look, type Mood, type Resolution } from "./renderConfig"
import { WIDE } from "./renderLayout"
import type { RenderOpts, RenderRoom } from "./sceneData"
import { SKIES, type SkyId } from "./skies"
import type { ToneCurve } from "./tonemap"
import type { RenderEngineState } from "./useRenderEngine"
import type { RenderSettings } from "./useRenderSettings"

const x = (v: number) => `${v.toFixed(1)}×`
const deg = (v: number) => `${Math.round(v)}°`

type Pano = { kind: BackdropKind; p: Panorama } | null

function QualitySection({ settings, engine }: { settings: RenderSettings; engine: RenderEngineState }) {
  const { opts, res, limit, setRes, setLimit, patchOpts: set } = settings
  const { effectiveKind, gpuWhy, gpuFailedNow, chooseEngine } = engine
  return (
    <Sec id="quality" title="Qualitat" icon={LuGauge} hint="Els canvis tornen a començar el render." badge={`${effectiveKind === "gpu" ? "GPU" : "CPU"} · ${RESOLUTIONS[res].label} · ${opts.bounces} rebots`}>
      <FormRow
        label="Motor"
        help={
          gpuWhy || gpuFailedNow
            ? `GPU no disponible: ${gpuWhy || gpuFailedNow} Es fa per CPU.`
            : "GPU (WebGPU): molt més ràpid, amb la gràfica. CPU: amb el processador, funciona a tot arreu. La imatge és la mateixa."
        }
      >
        <ChoiceChips<EngineKind>
          label="Motor"
          options={[
            { id: "gpu", label: "GPU", disabled: gpuWhy !== null || !!gpuFailedNow },
            { id: "cpu", label: "CPU" },
          ]}
          value={effectiveKind}
          onChange={chooseEngine}
        />
      </FormRow>
      <FormRow
        label="Resolució"
        help={`Amplada màxima: ${(Object.keys(RESOLUTIONS) as Resolution[])
          .filter(resolutionAllowed)
          .map((k) => `${RESOLUTIONS[k].label.toLowerCase()} ${RESOLUTIONS[k].max} px`)
          .join(" · ")}.${LOW_MEMORY ? ` En aquest dispositiu, com a molt ${LOW_MEMORY_MAX} px (amb més, se’n podria tancar la pàgina per falta de memòria).` : ""}`}
      >
        <ChoiceChips label="Resolució" options={(Object.keys(RESOLUTIONS) as Resolution[]).map((k) => ({ id: k, label: RESOLUTIONS[k].label, disabled: !resolutionAllowed(k) }))} value={res} onChange={setRes} />
      </FormRow>
      <Range label="Rebots de llum" value={opts.bounces} min={2} max={12} step={1} format={(v) => String(v)} onChange={(v) => set({ bounces: v })} />
      <FormRow label="Aturar-se a" help="Passades: 64 per provar, 1024 per a la imatge final.">
        <ChoiceChips
          label="Aturar-se a"
          options={[
            { id: "0", label: "Sense límit" },
            { id: "64", label: "64" },
            { id: "256", label: "256" },
            { id: "1024", label: "1024" },
          ]}
          value={String(limit)}
          onChange={(v) => setLimit(Number(v))}
        />
      </FormRow>
    </Sec>
  )
}

function CameraSection({ settings }: { settings: RenderSettings }) {
  const { opts, format, setFormat, patchOpts: set } = settings
  return (
    <Sec id="camera" title="Càmera" icon={LuCamera} hint="Els canvis tornen a començar el render." badge={`${format === "view" ? "Visor" : format}${opts.focal ? ` · ${opts.focal} mm` : ""}`}>
      <FormRow label="Format" help="3:2 foto · 4:5 revista (vertical) · 16:9 web.">
        <ChoiceChips label="Format" options={(Object.keys(FORMATS) as Format[]).map((k) => ({ id: k, label: k === "view" ? "Visor" : k }))} value={format} onChange={setFormat} />
      </FormRow>
      <FormRow label="Verticals rectes" help="Com les fotos d'interiors: la càmera s'anivella i les parets i els mobles no «cauen». Mirant molt de dalt no es fa.">
        <SwitchRow label="Verticals rectes" checked={opts.straight !== false} onChange={(straight) => set({ straight })} />
      </FormRow>
      <FormRow label="Objectiu" help="Equivalent de 35 mm: 24 angular (habitacions petites), 35 interiors, 50 detall i mobles sols. «Visor»: l'angle del visor 3D.">
        <ChoiceChips<string>
          label="Objectiu"
          options={FOCALS.map((f) => ({ id: String(f), label: f ? `${f} mm` : "Visor" }))}
          value={String(opts.focal ?? 0)}
          onChange={(v) => set({ focal: Number(v) })}
        />
      </FormRow>
      <Range label="Desenfocament del fons" value={opts.aperture ?? 0} min={0} max={20} step={1} format={(v) => (v ? `f/${(35 / (2 * v)).toFixed(1)}` : "tot enfocat")} onChange={(v) => set({ aperture: v })} />
      <Text fontSize="2xs" color="fg.subtle">
        Enfoca el que hi ha al centre de la imatge. Per a interiors: «Interior» a Opcions de vista (càmera a l'alçada dels ulls).
      </Text>
    </Sec>
  )
}

function SceneSection({ settings, viewKind, pano, setPano, setNotice }: { settings: RenderSettings; viewKind: NonNullable<RenderOpts["view"]>; pano: Pano; setPano: (p: Pano) => void; setNotice: (n: string | null) => void }) {
  const { opts, room, setRoom, patchOpts: set } = settings
  return (
    <Sec id="scene" title="Escena" icon={LuHouse} hint="Els canvis tornen a començar el render." badge={room === "room" ? "Habitació" : room === "floor" ? "Terra" : "Cap"}>
      <FormRow label="Escena" help="L'habitació (terra i paret) és la del mode Presentació; «Cap» deixa només el moble. Per a catàlegs: «Cap» amb fons blanc o transparent.">
        <ChoiceChips<RenderRoom>
          label="Escena"
          options={[
            { id: "room", label: "Habitació" },
            { id: "floor", label: "Només terra" },
            { id: "none", label: "Cap" },
          ]}
          value={room}
          onChange={setRoom}
        />
      </FormRow>
      <FormRow label="Per les finestres" help={`${BACKDROPS.find((b) => b.id === (opts.view ?? "garden"))?.help ?? ""} Només als ambients, a través dels vidres.`}>
        <Stack gap={2}>
          <ChoiceChips<string> label="Per les finestres" options={BACKDROPS.map((b) => ({ id: b.id, label: b.label }))} value={viewKind} onChange={(v) => set({ view: v as RenderOpts["view"] })} />
          {viewKind === "photo" && (
            <Button size="xs" variant="outline" alignSelf="flex-start" asChild>
              <label>
                <LuImageUp /> {pano?.kind === "photo" ? "Canviar la foto" : "Triar una foto"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.currentTarget.files?.[0]
                    e.currentTarget.value = ""
                    if (!f) return
                    try {
                      setPano({ kind: "photo", p: await saveBackdropPhoto(f) })
                      setNotice(null)
                    } catch (err) {
                      setNotice(`No s'ha pogut llegir la foto: ${err instanceof Error ? err.message : String(err)}`)
                    }
                  }}
                />
              </label>
            </Button>
          )}
        </Stack>
      </FormRow>
    </Sec>
  )
}

function LightSection({ settings, setLook }: { settings: RenderSettings; setLook: (patch: Partial<Look>) => void }) {
  const { opts, mood, env, sky, setMood, chooseSky, loadHdrFile, patchOpts: set } = settings
  return (
    <Sec id="light" title="Llums" icon={LuLightbulb} hint="Els canvis tornen a començar el render." badge={mood !== "day" ? MOODS[mood].label : env ? "HDRI" : undefined}>
      {/* L'ambient, a dalt: els canvia tots (sol, cel i llums). */}
      <FormRow label="Ambient" help={MOODS[mood].help}>
        <ChoiceChips<Mood>
          label="Ambient"
          options={(Object.keys(MOODS) as Mood[]).map((k) => ({ id: k, label: MOODS[k].label }))}
          value={mood}
          onChange={(k) => {
            setMood(k)
            set(MOODS[k].opts)
            setLook(MOODS[k].look)
          }}
        />
      </FormRow>
      {/* Subseccions independents (el mateix acordió, més petit): Sol · Cel · Llum. */}
      <Box>
        <FoldItem id="render-light-sun" size="sm" title="Sol" icon={LuSun} badge={`${deg(opts.sunElevation)} · ${x(opts.sunIntensity)}`}>
          <Range label="Sol · direcció" value={opts.sunAzimuth} min={-180} max={180} step={5} format={deg} onChange={(v) => set({ sunAzimuth: v })} />
          <Range label="Sol · alçada" value={opts.sunElevation} min={5} max={85} step={1} format={deg} onChange={(v) => set({ sunElevation: v })} />
          <Range label="Sol · intensitat" value={opts.sunIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ sunIntensity: v })} />
          <Range label="Ombres (dures → suaus)" value={opts.softness} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ softness: v })} />
        </FoldItem>
        <FoldItem id="render-light-sky" size="sm" title="Cel" icon={LuCloudSun} badge={sky === "file" ? "El teu .hdr" : SKIES.find((k) => k.id === sky)?.label}>
          <FormRow label="Cel" help={sky === "file" ? `El teu cel HDRI: ${env?.name ?? ""}` : `${SKIES.find((k) => k.id === sky)?.help ?? ""} El de defecte, a Preferències › Visor 3D.`}>
            <Stack gap={2}>
              <ChoiceChips<SkyId | "file">
                label="Cel"
                options={[...SKIES.map((k) => ({ id: k.id as SkyId | "file", label: k.label })), ...(env?.sky === "file" ? [{ id: "file" as const, label: "El teu .hdr" }] : [])]}
                value={sky}
                onChange={(v) => v !== "file" && chooseSky(v)}
              />
              <Button size="xs" variant="outline" alignSelf="flex-start" asChild>
                <label>
                  <LuImageUp /> Carregar un .hdr teu
                  <input
                    type="file"
                    accept=".hdr"
                    hidden
                    onChange={async (e) => {
                      const f = e.currentTarget.files?.[0]
                      e.currentTarget.value = ""
                      if (!f) return
                      await loadHdrFile(f)
                    }}
                  />
                </label>
              </Button>
            </Stack>
          </FormRow>
          <Range label="Cel (llum ambient)" value={opts.skyIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ skyIntensity: v })} />
          {env && <Range label="Gir del cel" value={opts.envRotation ?? 0} min={0} max={360} step={5} format={deg} onChange={(v) => set({ envRotation: v })} />}
        </FoldItem>
        <FoldItem id="render-light-lamps" size="sm" title="Llum" icon={LuLamp} badge={opts.lamps !== false ? "Enceses" : "Apagades"} badgePalette={opts.lamps !== false ? "wood" : "gray"}>
          <FormRow label="Llums enceses" help="Les pantalles de lli i les bombetes dels llums fan llum (materials «Pantalla de lli» i «Bombeta»).">
            <SwitchRow label="Llums enceses" checked={opts.lamps !== false} onChange={(lamps) => set({ lamps })} />
          </FormRow>
          {opts.lamps !== false && <Range label="Llums · intensitat" value={opts.lampIntensity ?? 1} min={0.1} max={5} step={0.1} format={x} onChange={(v) => set({ lampIntensity: v })} />}
          {opts.lamps !== false && <Range label="Llums · com es veuen" help="Com es veuen les pantalles i bombetes a la foto (la llum que fan a l'habitació no canvia). Més baix, es veu la tela de la pantalla; a 1×, una taca blanca com en una foto sense retocar." value={opts.lampView ?? 0.35} min={0.05} max={1} step={0.05} format={x} onChange={(v) => set({ lampView: v })} />}
        </FoldItem>
      </Box>
    </Sec>
  )
}

function ImageSection({ look, setLook, denoiser, scheduleDenoise }: { look: Look; setLook: (patch: Partial<Look>) => void; denoiser: "oidn" | "atrous"; scheduleDenoise: (force?: boolean) => void }) {
  return (
    <Sec id="image" title="Imatge" icon={LuImage} hint="S'aplica a l'instant, sense tornar a començar." badge={look.denoise ? "Sense soroll" : undefined}>
      <FormRow label="Exposició automàtica">
        <SwitchRow label="Exposició automàtica" checked={look.auto} onChange={(auto) => setLook({ auto })} />
      </FormRow>
      <FormRow label="Reduir el soroll" help={denoiser === "oidn" ? "Amb Open Image Denoise (IA, a la GPU): a les 4, 16, 64, 256… passades i en aturar." : "Filtre guiat per l'albedo i les normals."}>
        <SwitchRow
          label="Reduir el soroll"
          checked={look.denoise}
          onChange={(denoise) => {
            setLook({ denoise })
            if (denoise) scheduleDenoise(true)
          }}
        >
          {/* Quin filtre fa servir (discret) */}
          <Text fontSize="xs" color="fg.subtle">{denoiser === "oidn" ? "Intel OIDN" : "bàsic"}</Text>
        </SwitchRow>
      </FormRow>
      <FormRow label="Corba de color" help="AgX: natural, com les fotos (les llums es tornen blanques suaument). ACES: més contrast i color.">
        <ChoiceChips<ToneCurve>
          label="Corba de color"
          options={[
            { id: "agx", label: "AgX" },
            { id: "aces", label: "ACES" },
          ]}
          value={look.curve}
          onChange={(v) => setLook({ curve: v })}
        />
      </FormRow>
      <Range label="Vinyeta" value={look.vignette} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => setLook({ vignette: v })} />
      <Range label="Resplendor" value={look.bloom} min={0} max={1} step={0.05} format={(v) => (v ? `${Math.round(v * 100)} %` : "cap")} onChange={(v) => setLook({ bloom: v })} />
      {look.bloom > 0 && <Range label="Resplendor · a partir de" value={look.bloomThreshold} min={0.5} max={4} step={0.1} format={x} onChange={(v) => setLook({ bloomThreshold: v })} />}
      <Range label="Temperatura (fred → càlid)" value={look.warmth} min={-1} max={1} step={0.05} format={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))} onChange={(v) => setLook({ warmth: v })} />
      <Range label="Exposició" value={look.exposure} min={-2} max={2} step={0.1} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`} onChange={(v) => setLook({ exposure: v })} />
      <Range label="Contrast" value={look.contrast} min={0.6} max={1.6} step={0.05} format={x} onChange={(v) => setLook({ contrast: v })} />
      <Range label="Saturació" value={look.saturation} min={0} max={2} step={0.05} format={x} onChange={(v) => setLook({ saturation: v })} />
      <FormRow label="Fons" help="Transparent: PNG amb alfa.">
        <ChoiceChips<Background>
          label="Fons"
          options={[
            { id: "scene", label: "Estudi" },
            { id: "white", label: "Blanc" },
            { id: "transparent", label: "Transparent" },
          ]}
          value={look.background}
          onChange={(v) => setLook({ background: v })}
        />
      </FormRow>
    </Sec>
  )
}

/** La columna d'opcions del Render: Qualitat · Càmera · Escena · Llums · Imatge, i «Restablir». */
export function RenderOptionsPanel({ settings, engine, viewKind, pano, setPano, setNotice, setLook, denoiser, scheduleDenoise, onReset }: { settings: RenderSettings; engine: RenderEngineState; viewKind: NonNullable<RenderOpts["view"]>; pano: Pano; setPano: (p: Pano) => void; setNotice: (n: string | null) => void; setLook: (patch: Partial<Look>) => void; denoiser: "oidn" | "atrous"; scheduleDenoise: (force?: boolean) => void; onReset: () => void }) {
  return (
    <Stack w="full" flexShrink={0} gap={1} ps="3px" pe={1} pt={4} pb={4} css={{ [WIDE]: { flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 0, paddingBottom: 0, paddingInlineStart: "19px" } }}>
      <QualitySection settings={settings} engine={engine} />
      <CameraSection settings={settings} />
      <SceneSection settings={settings} viewKind={viewKind} pano={pano} setPano={setPano} setNotice={setNotice} />
      <LightSection settings={settings} setLook={setLook} />
      <ImageSection look={settings.look} setLook={setLook} denoiser={denoiser} scheduleDenoise={scheduleDenoise} />

      <Button size="xs" variant="ghost" alignSelf="start" onClick={onReset}>
        <LuRotateCcw /> Restablir
      </Button>
    </Stack>
  )
}
