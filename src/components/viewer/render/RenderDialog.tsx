import { Box, Button, CloseButton, Dialog, HStack, Image, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import { LuCamera, LuDownload, LuGauge, LuHouse, LuImage, LuImageUp, LuPause, LuPlay, LuRotateCcw, LuSun, LuX } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../FormRow"
import { PanelSection } from "../../PanelSection"
import type { Camera, Scene } from "three"
import { CpuEngine } from "./cpuEngine"
import type { EngineKind, RenderEngine, RenderJob } from "./engine"
import { GpuEngine, gpuSupport } from "./gpuTracer"
import { parseHdr } from "./hdr"
import { DEFAULT_RENDER_OPTS, extractScene, type RenderEnv, type RenderOpts, type RenderRoom } from "./sceneData"

export type SceneGetter = () => { scene: Scene; camera: Camera; width: number; height: number; snapshot?: () => string } | null

/** Motor triat (es recorda entre sessions). */
const ENGINE_KEY = "mobles:render-engine"
function savedEngine(): EngineKind | null {
  try {
    const v = localStorage.getItem(ENGINE_KEY)
    return v === "cpu" || v === "gpu" ? v : null
  } catch {
    return null
  }
}
function saveEngine(k: EngineKind) {
  try {
    localStorage.setItem(ENGINE_KEY, k)
  } catch {
    // Sense emmagatzematge (navegació privada): no es recorda.
  }
}

/** Resolució: multiplicador de la mida del visor i amplada màxima (px). */
const RESOLUTIONS = {
  draft: { label: "Esborrany", k: 1, max: 1000 },
  normal: { label: "Normal", k: 1.5, max: 1600 },
  high: { label: "Alta", k: 2, max: 2400 },
  max: { label: "Màxima", k: 3, max: 3600 },
} as const
type Resolution = keyof typeof RESOLUTIONS

/** Format de la imatge (com les càmeres): el del visor o una proporció fixa (amplada ÷ alçada). */
const FORMATS = { view: { label: "El del visor", r: 0 }, "3:2": { label: "3:2 (foto)", r: 3 / 2 }, "4:5": { label: "4:5 (revista, vertical)", r: 4 / 5 }, "16:9": { label: "16:9 (web)", r: 16 / 9 }, "1:1": { label: "1:1", r: 1 } } as const
type Format = keyof typeof FORMATS

type Background = "scene" | "white" | "transparent"
interface Look {
  exposure: number
  contrast: number
  saturation: number
  background: Background
  /** Exposició automàtica (com una càmera): la llum mitjana de la imatge queda a un gris mitjà. */
  auto: boolean
  /** Temperatura: − fred, + càlid. */
  warmth: number
  /** Filtre de soroll (guiat per l'albedo i les normals). */
  denoise: boolean
}
const DEFAULT_LOOK: Look = { exposure: 0, contrast: 1, saturation: 1, background: "scene", auto: false, warmth: 0, denoise: true }

/** To ACES aproximat (lineal → [0, 1] lineal); `exp` = multiplicador d'exposició. */
function aces(v: number, exp: number): number {
  const a = v * exp
  return Math.min(1, Math.max(0, (a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14)))
}
const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** Control lliscant compacte en fila: rètol a l'esquerra; el range natiu i el valor a la dreta. */
function Range({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <FormRow label={label}>
      <HStack gap={2} minH="32px">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: "var(--chakra-colors-wood-solid)" }}
        />
        <Text fontSize="xs" fontVariantNumeric="tabular-nums" flexShrink={0} minW="4.5em" textAlign="right">
          {format(value)}
        </Text>
      </HStack>
    </FormRow>
  )
}

/** Secció plegable de les opcions (la mateixa `PanelSection` dels inspectors): comencen tancades i es recorden durant la sessió. */
function Sec({ id, title, icon, hint, badge, children }: { id: string; title: string; icon: IconType; hint: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <PanelSection id={`render-${id}`} title={title} icon={icon} badge={badge}>
      <Stack gap={3}>
        {children}
        <Text fontSize="2xs" color="fg.subtle">
          {hint}
        </Text>
      </Stack>
    </PanelSection>
  )
}

/**
 * «Render»: imatge fotorealista amb path tracing, com el render físic de Cinema 4D. Dos motors
 * amb el mateix resultat: **GPU** (WebGPU, `gpuTracer`) i **CPU** (un worker per nucli,
 * `pathWorker`). Es va afinant (cada passada és una mostra més per píxel); es pot aturar i desar
 * en PNG. **Comença aturat**: no es calcula res fins que no es prem «Començar».
 * Opcions: motor, qualitat i llum tornen a començar el càlcul; les d'imatge (exposició,
 * contrast, saturació, fons) només retoquen el to, a l'instant.
 */
export function RenderDialog({ open, onClose, getScene, name }: { open: boolean; onClose: () => void; getScene: SceneGetter; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [passes, setPasses] = useState(0)
  const [running, setRunning] = useState(false)
  /** S'ha començat el render (fins llavors no es calcula res). */
  const [begun, setBegun] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [opts, setOpts] = useState<RenderOpts>(DEFAULT_RENDER_OPTS)
  const [res, setRes] = useState<Resolution>("normal")
  const [limit, setLimit] = useState(0)
  const [room, setRoom] = useState<RenderRoom>("room")
  const [format, setFormat] = useState<Format>("view")
  const [env, setEnv] = useState<{ name: string; env: RenderEnv } | null>(null)
  const [engineKind, setEngineKind] = useState<EngineKind>(() => savedEngine() ?? "gpu")
  /** Motiu pel qual no hi ha GPU (`undefined` mentre es mira). */
  const [gpuWhy, setGpuWhy] = useState<string | null | undefined>(undefined)
  const [engineLabel, setEngineLabel] = useState("")
  const envRef = useRef(env)
  envRef.current = env
  const [look, setLookState] = useState<Look>(DEFAULT_LOOK)
  const lookRef = useRef(look)
  const limitRef = useRef(limit)
  limitRef.current = limit
  const engine = useRef<RenderEngine | null>(null)
  /** Cada render nou: els avisos dels motors d'abans s'ignoren. */
  const token = useRef(0)
  const source = useRef<{ scene: ReturnType<typeof extractScene>; aspect: number; long: number; room?: RenderRoom; format?: Format } | null>(null)
  const job = useRef<{ w: number; h: number; accum: Float32Array<ArrayBufferLike>; aux: Float32Array<ArrayBufferLike>; count: number } | null>(null)
  // Filtre de soroll: un fil a part; el resultat val per a les passades amb què s'ha calculat.
  const dn = useRef<{ worker: Worker | null; busy: boolean; id: number; data: Float32Array | null; count: number }>({ worker: null, busy: false, id: 0, data: null, count: 0 })
  const effectiveKind: EngineKind = engineKind === "gpu" && gpuWhy === null ? "gpu" : "cpu"

  const disposeEngine = () => {
    token.current++
    engine.current?.dispose()
    engine.current = null
    setRunning(false)
    setPreparing(false)
  }

  const draw = () => {
    const j = job.current
    const c = canvas.current
    if (!j || !c || !j.count) return
    if (c.width !== j.w || c.height !== j.h) {
      c.width = j.w
      c.height = j.h
    }
    const ctx = c.getContext("2d")!
    const img = ctx.createImageData(j.w, j.h)
    const k = 1 / j.count
    const L = lookRef.current
    const D = L.denoise && dn.current.data && dn.current.data.length === j.w * j.h * 3 ? dn.current.data : null
    const col = (i: number, c: number) => (D ? D[i * 3 + c]! : j.accum[i * 4 + c]! * k)
    // Exposició automàtica: mitjana geomètrica de la llum de les superfícies (com el fotòmetre
    // d'una càmera), que queda al gris mitjà (18 %).
    let autoK = 1
    if (L.auto) {
      let sum = 0, cnt = 0
      for (let i = 0, n = j.w * j.h; i < n; i += 7) {
        if (j.accum[i * 4 + 3]! * k < 0.5) continue
        const y = 0.2126 * col(i, 0) + 0.7152 * col(i, 1) + 0.0722 * col(i, 2)
        if (!(y >= 0) || !Number.isFinite(y)) continue
        sum += Math.log(1e-4 + y)
        cnt++
      }
      const gm = cnt ? Math.exp(sum / cnt) : 0.3
      autoK = Math.min(40, Math.max(0.25, 0.18 / 0.7 / gm))
    }
    const expo = 0.7 * Math.pow(2, L.exposure) * autoK
    const tone = (v: number) => aces(v, expo)
    const wr = 1 + 0.12 * L.warmth, wb = 1 - 0.12 * L.warmth
    for (let i = 0, n = j.w * j.h; i < n; i++) {
      let r = tone(col(i, 0) * wr)
      let g = tone(col(i, 1))
      let b = tone(col(i, 2) * wb)
      if (!Number.isFinite(r + g + b)) r = g = b = 0
      const a = j.accum[i * 4 + 3]! * k
      if (L.saturation !== 1) {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        r = y + (r - y) * L.saturation
        g = y + (g - y) * L.saturation
        b = y + (b - y) * L.saturation
      }
      r = srgb(Math.min(1, Math.max(0, r)))
      g = srgb(Math.min(1, Math.max(0, g)))
      b = srgb(Math.min(1, Math.max(0, b)))
      if (L.contrast !== 1) {
        r = (r - 0.5) * L.contrast + 0.5
        g = (g - 0.5) * L.contrast + 0.5
        b = (b - 0.5) * L.contrast + 0.5
      }
      let alpha = 1
      if (L.background !== "scene" && a < 1) {
        // Els píxels de fons (alfa < 1, amb les vores suavitzades) es barregen amb el blanc o
        // queden transparents. El color guardat al fons és el de l'escena: se'n treu.
        const bgR = srgb(tone(source.current!.scene.background[0])), bgG = srgb(tone(source.current!.scene.background[1])), bgB = srgb(tone(source.current!.scene.background[2]))
        const fr = a > 0.001 ? (r - bgR * (1 - a)) / a : 0
        const fg = a > 0.001 ? (g - bgG * (1 - a)) / a : 0
        const fb = a > 0.001 ? (b - bgB * (1 - a)) / a : 0
        if (L.background === "white") {
          r = fr * a + (1 - a)
          g = fg * a + (1 - a)
          b = fb * a + (1 - a)
        } else {
          r = fr
          g = fg
          b = fb
          alpha = a
        }
      }
      img.data[i * 4] = Math.min(1, Math.max(0, r)) * 255
      img.data[i * 4 + 1] = Math.min(1, Math.max(0, g)) * 255
      img.data[i * 4 + 2] = Math.min(1, Math.max(0, b)) * 255
      img.data[i * 4 + 3] = alpha * 255
    }
    ctx.putImageData(img, 0, 0)
  }

  const setLook = (patch: Partial<Look>) => {
    const next = { ...lookRef.current, ...patch }
    lookRef.current = next
    setLookState(next)
    draw()
  }

  /** Filtra el soroll de les passades acumulades (cada cop menys sovint: 4, 8, 16… passades). */
  const scheduleDenoise = (force = false) => {
    const j = job.current
    const D = dn.current
    if (!j || !lookRef.current.denoise || D.busy || j.count < 2) return
    if (!force && j.count < D.count * 1.5 + 2) return
    D.worker ??= new Worker(new URL("./denoiseWorker.ts", import.meta.url), { type: "module" })
    const n = j.w * j.h
    const color = new Float32Array(n * 3), albedo = new Float32Array(n * 3), normal = new Float32Array(n * 3)
    const k = 1 / j.count
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        color[i * 3 + c] = j.accum[i * 4 + c]! * k
        albedo[i * 3 + c] = j.aux[i * 6 + c]! * k
      }
      const nx = j.aux[i * 6 + 3]!, ny = j.aux[i * 6 + 4]!, nz = j.aux[i * 6 + 5]!
      const l = Math.hypot(nx, ny, nz)
      if (l > 1e-6) {
        normal[i * 3] = nx / l; normal[i * 3 + 1] = ny / l; normal[i * 3 + 2] = nz / l
      }
    }
    D.busy = true
    const id = ++D.id
    const count = j.count
    D.worker.onmessage = (e: MessageEvent<{ id: number; data: Float32Array }>) => {
      D.busy = false
      if (e.data.id !== D.id || job.current !== j) return
      D.data = e.data.data
      D.count = count
      draw()
    }
    D.worker.postMessage({ id, w: j.w, h: j.h, color, albedo, normal, strength: Math.min(1, 1.6 / Math.sqrt(count)) }, [color.buffer, albedo.buffer, normal.buffer])
  }

  /** Torna a començar el càlcul (en començar o en canviar el motor, la qualitat o la llum). */
  const restart = (o: RenderOpts, r: Resolution, kind: EngineKind) => {
    const src = source.current
    if (!src) return
    disposeEngine()
    const my = token.current
    const R = RESOLUTIONS[r]
    // El costat llarg segons la resolució; l'altre, segons el format.
    const L = Math.min(R.max, Math.round(src.long * R.k))
    const w = src.aspect >= 1 ? L : Math.round(L * src.aspect)
    const h = src.aspect >= 1 ? Math.round(L / src.aspect) : L
    const j: { w: number; h: number; accum: Float32Array<ArrayBufferLike>; aux: Float32Array<ArrayBufferLike>; count: number } = { w, h, accum: new Float32Array(w * h * 4), aux: new Float32Array(w * h * 6), count: 0 }
    job.current = j
    dn.current.id++
    dn.current.data = null
    dn.current.count = 0
    dn.current.busy = false
    setPasses(0)
    setStartedAt(Date.now())
    setElapsed(0)
    setError(null)
    const data: RenderJob = { scene: src.scene, env: envRef.current?.env ?? null, opts: o, w, h }
    let pending = false
    const events = {
      onProgress: (p: { color: Float32Array; aux: Float32Array; count: number }) => {
        if (token.current !== my || job.current !== j) return
        j.accum = p.color
        j.aux = p.aux
        j.count = p.count
        setPasses(p.count)
        scheduleDenoise()
        if (!pending) {
          pending = true
          requestAnimationFrame(() => {
            pending = false
            draw()
          })
        }
      },
      onError: (message: string) => {
        if (token.current !== my) return
        // La GPU ha fallat (memòria, s'ha perdut…): es fa per CPU.
        if (engine.current?.kind === "gpu") {
          setNotice(`${message} Es fa per CPU.`)
          restart(o, r, "cpu")
        } else {
          disposeEngine()
          setError(message)
        }
      },
      limit: () => limitRef.current,
      onStop: () => {
        if (token.current === my) setRunning(false)
      },
    }
    const run = (e: RenderEngine) => {
      engine.current = e
      setEngineLabel(e.label)
      setPreparing(false)
      setRunning(true)
      e.resume()
    }
    if (kind === "gpu") {
      setPreparing(true)
      setEngineLabel("GPU")
      GpuEngine.create(data, events).then(
        (e) => (token.current === my ? run(e) : e.dispose()),
        (err: unknown) => {
          if (token.current !== my) return
          setNotice(`${err instanceof Error ? err.message : String(err)} Es fa per CPU.`)
          restart(o, r, "cpu")
        },
      )
    } else run(new CpuEngine(data, events))
  }

  /** Passa l'escena del visor a dades per als motors. */
  const extract = (r: RenderRoom, f: Format = format): boolean => {
    const got = getScene()
    if (!got) {
      setError("El visor 3D no està a punt.")
      return false
    }
    try {
      const aspect = FORMATS[f].r || got.width / got.height
      const scene = extractScene(got.scene, got.camera, aspect, r)
      source.current = { scene, aspect, long: Math.max(got.width, got.height), room: r, format: f }
      return true
    } catch (e) {
      setError(String(e))
      return false
    }
  }

  /** «Començar»: ara sí, es prepara l'escena i es calcula. */
  const begin = () => {
    setNotice(null)
    if (!source.current && !extract(room)) return
    setBegun(true)
    restart(opts, res, effectiveKind)
  }

  useEffect(() => {
    if (!open) return
    // En obrir no es calcula res: només la imatge del visor de fons i si hi ha GPU.
    setError(null)
    setNotice(null)
    setPasses(0)
    setBegun(false)
    try {
      setPreview(getScene()?.snapshot?.() ?? null)
    } catch {
      setPreview(null)
    }
    let alive = true
    void gpuSupport().then((why) => alive && setGpuWhy(why))
    // Als ambients (llum de dia), exposició automàtica i una mica càlid, com les fotos d'interiors.
    if (getScene()?.scene.userData.daylight) {
      const next = { ...lookRef.current, auto: true, warmth: 0.25 }
      lookRef.current = next
      setLookState(next)
    }
    return () => {
      alive = false
      disposeEngine()
      dn.current.worker?.terminate()
      dn.current.worker = null
      job.current = null
      source.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Motor, qualitat i llum: un cop començat, es torna a començar (esperant una mica mentre s'arrossega).
  useEffect(() => {
    if (!open || !begun || !source.current) return
    const id = window.setTimeout(() => {
      if ((source.current?.room !== room || source.current?.format !== format) && !extract(room, format)) return
      restart(opts, res, effectiveKind)
    }, 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, res, room, format, env, effectiveKind])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [running, startedAt])

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

  const toggle = () => {
    const e = engine.current
    if (!e) return
    if (running) {
      e.pause()
      setRunning(false)
    } else {
      setStartedAt(Date.now() - elapsed * 1000)
      setRunning(true)
      e.resume()
    }
  }

  const set = (patch: Partial<RenderOpts>) => setOpts((o) => ({ ...o, ...patch }))
  const x = (v: number) => `${v.toFixed(1)}×`
  const deg = (v: number) => `${Math.round(v)}°`
  const j = job.current
  const status = !begun
    ? "Aturat: prem «Començar» per calcular la imatge."
    : preparing
      ? "Preparant la GPU…"
      : `${passes}${limit ? ` / ${limit}` : ""} ${passes === 1 ? "passada" : "passades"} · ${elapsed} s${elapsed && passes ? ` (${(passes / elapsed).toFixed(passes / elapsed < 10 ? 1 : 0)}/s)` : ""} · ${j ? `${j.w} × ${j.h} px` : "—"} · ${engineLabel}`

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size={{ base: "full", md: "cover" }} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content h={{ base: "100dvh", md: undefined }} maxH="100dvh" display="flex" flexDirection="column" overflow="hidden" pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }} pb={{ base: "env(safe-area-inset-bottom, 0px)", md: 0 }}>
            <Dialog.Header>
              <Dialog.Title>Render</Dialog.Title>
            </Dialog.Header>
            {/* Al mòbil: la imatge a dalt (més de mitja pantalla) i les opcions a sota, tot amb desplaçament. */}
            <Dialog.Body flex={1} display="flex" flexDirection={{ base: "column", md: "row" }} gap={4} minH={0} overflowY={{ base: "auto", md: "hidden" }} px={{ base: 3, md: 6 }}>
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
                  bg={look.background === "transparent" && begun ? undefined : "bg.muted"}
                  style={look.background === "transparent" && begun ? { background: "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 16px 16px" } : undefined}
                >
                  {error ? (
                    <Text p={4} color="fg.error">
                      {error}
                    </Text>
                  ) : (
                    <canvas ref={canvas} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: begun ? undefined : "none" }} />
                  )}
                  {!begun && !error && (
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
                {notice && (
                  <Text fontSize="xs" color="fg.warning">
                    {notice}
                  </Text>
                )}
                <HStack justify="space-between" wrap="wrap" gap={2}>
                  <Text fontSize="sm" color="fg.muted" data-render-status>
                    {status}
                  </Text>
                  <HStack gap={2}>
                    {begun ? (
                      <Button size="sm" variant="outline" onClick={toggle} disabled={!!error || preparing}>
                        {running ? <LuPause /> : <LuPlay />} {running ? "Aturar" : "Continuar"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={begin} disabled={!!error}>
                        <LuPlay /> Començar
                      </Button>
                    )}
                    <Button size="sm" colorPalette="wood" onClick={save} disabled={!passes}>
                      <LuDownload /> Desar PNG
                    </Button>
                  </HStack>
                </HStack>
              </Stack>

              <Stack w={{ base: "full", md: "300px" }} flexShrink={0} gap={1} overflowY={{ base: "visible", md: "auto" }} pr={1} pb={{ base: 4, md: 0 }}>
                <Sec id="quality" title="Qualitat" icon={LuGauge} hint="Els canvis tornen a començar el render." badge={`${effectiveKind === "gpu" ? "GPU" : "CPU"} · ${RESOLUTIONS[res].label} · ${opts.bounces} rebots`}>
                  <FormRow
                    label="Motor"
                    help={
                      gpuWhy
                        ? `GPU no disponible: ${gpuWhy} Es fa per CPU.`
                        : "GPU (WebGPU): molt més ràpid, amb la gràfica. CPU: amb el processador, funciona a tot arreu. La imatge és la mateixa."
                    }
                  >
                    <ChoiceChips<EngineKind>
                      label="Motor"
                      options={[
                        { id: "gpu", label: "GPU", disabled: gpuWhy !== null },
                        { id: "cpu", label: "CPU" },
                      ]}
                      value={effectiveKind}
                      onChange={(k) => {
                        setEngineKind(k)
                        saveEngine(k)
                      }}
                    />
                  </FormRow>
                  <FormRow label="Resolució" help={`Amplada màxima: ${(Object.keys(RESOLUTIONS) as Resolution[]).map((k) => `${RESOLUTIONS[k].label.toLowerCase()} ${RESOLUTIONS[k].max} px`).join(" · ")}.`}>
                    <ChoiceChips label="Resolució" options={(Object.keys(RESOLUTIONS) as Resolution[]).map((k) => ({ id: k, label: RESOLUTIONS[k].label }))} value={res} onChange={setRes} />
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

                <Sec id="camera" title="Càmera" icon={LuCamera} hint="Els canvis tornen a començar el render." badge={format === "view" ? "Visor" : format}>
                  <FormRow label="Format" help="3:2 foto · 4:5 revista (vertical) · 16:9 web.">
                    <ChoiceChips label="Format" options={(Object.keys(FORMATS) as Format[]).map((k) => ({ id: k, label: k === "view" ? "Visor" : k }))} value={format} onChange={setFormat} />
                  </FormRow>
                  <Range label="Desenfocament del fons" value={opts.aperture ?? 0} min={0} max={20} step={1} format={(v) => (v ? `f/${(35 / (2 * v)).toFixed(1)}` : "tot enfocat")} onChange={(v) => set({ aperture: v })} />
                  <Text fontSize="2xs" color="fg.subtle">
                    Enfoca el que hi ha al centre de la imatge. Per a interiors: «Interior» a Opcions de vista (càmera a l'alçada dels ulls).
                  </Text>
                </Sec>

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
                </Sec>

                <Sec id="light" title="Llum" icon={LuSun} hint="Els canvis tornen a començar el render." badge={env ? "HDRI" : undefined}>
                  <Range label="Sol · direcció" value={opts.sunAzimuth} min={-180} max={180} step={5} format={deg} onChange={(v) => set({ sunAzimuth: v })} />
                  <Range label="Sol · alçada" value={opts.sunElevation} min={5} max={85} step={1} format={deg} onChange={(v) => set({ sunElevation: v })} />
                  <Range label="Sol · intensitat" value={opts.sunIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ sunIntensity: v })} />
                  <Range label="Ombres (dures → suaus)" value={opts.softness} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ softness: v })} />
                  <Range label="Cel (llum ambient)" value={opts.skyIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ skyIntensity: v })} />
                  <FormRow label={`Cel HDRI ${env ? `· ${env.name}` : "(opcional)"}`} help="Un cel de 360° (p. ex. de polyhaven.com, 1k o 2k): llum i reflexos de debò i el que es veu per les finestres. Sense, un cel de dia.">
                    <HStack gap={2} minH="32px" wrap="wrap">
                      <Button size="xs" variant="outline" asChild>
                        <label>
                          <LuImageUp /> {env ? "Canviar" : "Carregar .hdr"}
                          <input
                            type="file"
                            accept=".hdr"
                            hidden
                            onChange={async (e) => {
                              const f = e.currentTarget.files?.[0]
                              e.currentTarget.value = ""
                              if (!f) return
                              try {
                                setEnv({ name: f.name, env: parseHdr(await f.arrayBuffer()) })
                              } catch (err) {
                                setError(String(err))
                              }
                            }}
                          />
                        </label>
                      </Button>
                      {env && (
                        <Button size="xs" variant="ghost" onClick={() => setEnv(null)}>
                          <LuX /> Treure
                        </Button>
                      )}
                    </HStack>
                  </FormRow>
                  {env && <Range label="Gir del cel" value={opts.envRotation ?? 0} min={0} max={360} step={5} format={deg} onChange={(v) => set({ envRotation: v })} />}
                </Sec>

                <Sec id="image" title="Imatge" icon={LuImage} hint="S'aplica a l'instant, sense tornar a començar." badge={look.denoise ? "Sense soroll" : undefined}>
                  <FormRow label="Exposició automàtica">
                    <HStack minH="32px">
                      <input type="checkbox" aria-label="Exposició automàtica" checked={look.auto} onChange={(e) => setLook({ auto: e.currentTarget.checked })} style={{ accentColor: "var(--chakra-colors-wood-solid)" }} />
                    </HStack>
                  </FormRow>
                  <FormRow label="Reduir el soroll">
                    <HStack minH="32px">
                      <input
                        type="checkbox"
                        aria-label="Reduir el soroll"
                        checked={look.denoise}
                        onChange={(e) => {
                          setLook({ denoise: e.currentTarget.checked })
                          if (e.currentTarget.checked) scheduleDenoise(true)
                        }}
                        style={{ accentColor: "var(--chakra-colors-wood-solid)" }}
                      />
                    </HStack>
                  </FormRow>
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

                <Button
                  size="xs"
                  variant="ghost"
                  alignSelf="start"
                  onClick={() => {
                    setOpts(DEFAULT_RENDER_OPTS)
                    setRes("normal")
                    setLimit(0)
                    setRoom("room")
                    setFormat("view")
                    const day = !!getScene()?.scene.userData.daylight
                    setLook({ ...DEFAULT_LOOK, auto: day, warmth: day ? 0.25 : 0 })
                  }}
                >
                  <LuRotateCcw /> Restablir
                </Button>
              </Stack>
            </Dialog.Body>
            {/* Al mòbil, per sota de la barra d'estat (zona segura). */}
            <Dialog.CloseTrigger asChild top={{ base: "calc(env(safe-area-inset-top, 0px) + 8px)", md: 2 }}>
              <CloseButton size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
