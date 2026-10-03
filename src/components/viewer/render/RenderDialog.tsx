import { Box, Button, CloseButton, Dialog, HStack, Image, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import { LuCamera, LuDownload, LuGauge, LuHouse, LuImage, LuImageUp, LuPause, LuPlay, LuRotateCcw, LuSun } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../FormRow"
import { PanelSection } from "../../PanelSection"
import type { Camera, Scene } from "three"
import { LOW_MEMORY } from "../deviceLimits"
import { CpuEngine } from "./cpuEngine"
import type { EngineKind, RenderEngine, RenderJob, RenderProgress } from "./engine"
import { GpuLimitError } from "./gpuScene"
import { GpuEngine, gpuSupport } from "./gpuTracer"
import { parseHdr } from "./hdr"
import { oidnDenoise, oidnFailed, oidnReady } from "./oidn"
import type { UNet } from "oidn-web"
import { SKIES, loadSky, readSky, type SkyId } from "./skies"
import { DEFAULT_RENDER_OPTS, extractScene, photoCamera, type RenderEnv, type RenderOpts, type RenderRoom } from "./sceneData"
import { aces, agx, bloomBuffer, createDrawScheduler, makeAgxLut, makePowLut, makeSrgbLut, sampleBloom, srgbLut, vignette, type ToneCurve } from "./tonemap"

export type SceneGetter = () => { scene: Scene; camera: Camera; width: number; height: number; snapshot?: () => string } | null

/** Motor triat (es recorda entre sessions). */
/** Objectius (mm, equivalent de 35 mm); 0 = l'angle del visor. */
const FOCALS = [0, 24, 35, 50] as const
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
/** A l'iPhone i l'iPad (poca memòria per pàgina): com a molt 1600 px de costat llarg. */
const LOW_MEMORY_MAX = 1600
const resolutionAllowed = (r: Resolution) => !LOW_MEMORY || RESOLUTIONS[r].max <= LOW_MEMORY_MAX

/** Una feina de render al diàleg: les sumes són les del motor (s'hi assignen en arribar). */
interface Job {
  w: number
  h: number
  accum: Float32Array<ArrayBufferLike>
  aux: Float32Array<ArrayBufferLike>
  count: number
  auxCount: number
}

/** Format de la imatge (com les càmeres): el del visor o una proporció fixa (amplada ÷ alçada). */
const FORMATS = { view: { label: "El del visor", r: 0 }, "3:2": { label: "3:2 (foto)", r: 3 / 2 }, "4:5": { label: "4:5 (revista, vertical)", r: 4 / 5 }, "16:9": { label: "16:9 (web)", r: 16 / 9 }, "1:1": { label: "1:1", r: 1 } } as const
type Format = keyof typeof FORMATS

/**
 * Ambients de llum (com les fotos de catàleg): canvien la llum (tornen a començar el render) i l'exposició (a l'instant).
 * Al capvespre i al vespre l'exposició automàtica deixa la imatge més fosca (`key`) i amb més contrast: manen els llums i
 * les tires LED, no tot igual d'il·luminat.
 */
const MOODS = {
  day: { label: "Dia", help: "Llum natural: sol i cel.", opts: { sunElevation: 45, sunIntensity: 1, skyIntensity: 1, lamps: true, lampIntensity: 1 }, look: { key: 0.18, contrast: 1 } },
  dusk: { label: "Capvespre", help: "Sol baix i càlid, poc cel i els llums encesos.", opts: { sunElevation: 8, sunIntensity: 1.3, skyIntensity: 0.35, lamps: true, lampIntensity: 1.5 }, look: { auto: true, key: 0.1, contrast: 1.15, warmth: 0.45 } },
  night: { label: "Vespre", help: "Només els llums i les tires LED: ambient fosc, com les fotos de catàleg.", opts: { sunIntensity: 0, skyIntensity: 0.05, lamps: true, lampIntensity: 2.5 }, look: { auto: true, key: 0.06, contrast: 1.2, warmth: 0.3 } },
} satisfies Record<string, { label: string; help: string; opts: Partial<RenderOpts>; look: Partial<Look> }>
type Mood = keyof typeof MOODS

type Background = "scene" | "white" | "transparent"
interface Look {
  exposure: number
  contrast: number
  saturation: number
  background: Background
  /** Exposició automàtica (com una càmera): la llum mitjana de la imatge queda a un gris mitjà. */
  auto: boolean
  /** El gris on l'exposició automàtica deixa la llum mitjana: 0,18 de dia; menys, ambient fosc (capvespre, vespre). */
  key: number
  /** Temperatura: − fred, + càlid. */
  warmth: number
  /** Filtre de soroll (guiat per l'albedo i les normals). */
  denoise: boolean
  /** Corba de color (AgX natural o ACES), vinyeta (0–1) i resplendor dels punts molt brillants. */
  curve: ToneCurve
  vignette: number
  bloom: number
  bloomThreshold: number
}
const DEFAULT_LOOK: Look = { exposure: 0, contrast: 1, saturation: 1, background: "scene", auto: false, key: 0.18, warmth: 0, denoise: true, curve: "agx", vignette: 0.2, bloom: 0, bloomThreshold: 3 }

const SRGB_LUT = makeSrgbLut()
const srgb = (c: number) => srgbLut(SRGB_LUT, c)
const AGX_LUT = makeAgxLut()
const POW_LUT = makePowLut()

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
  const [mood, setMood] = useState<Mood>("day")
  const [res, setRes] = useState<Resolution>("normal")
  const [limit, setLimit] = useState(0)
  const [room, setRoom] = useState<RenderRoom>("room")
  const [format, setFormat] = useState<Format>("view")
  /** Cel HDRI: un dels de l'app (`sky`) o un `.hdr` propi («file»); `null` = cel de dia. */
  const [env, setEnv] = useState<{ name: string; env: RenderEnv; sky: SkyId | "file" } | null>(null)
  const [sky, setSky] = useState<SkyId | "file">("day")
  const skyReq = useRef(0)
  const [engineKind, setEngineKind] = useState<EngineKind>(() => savedEngine() ?? "gpu")
  /** Motiu pel qual no hi ha GPU (`undefined` mentre es mira). */
  const [gpuWhy, setGpuWhy] = useState<string | null | undefined>(undefined)
  /** La GPU ha fallat en aquest diàleg (motiu; si era per la mida, només a aquesta resolució). */
  const [gpuFailed, setGpuFailed] = useState<{ why: string; res: Resolution | null } | null>(null)
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
  const job = useRef<Job | null>(null)
  /** Què s'ha començat a calcular l'últim cop (per no tornar a començar el mateix). */
  const lastRun = useRef<{ o: RenderOpts; r: Resolution; kind: EngineKind; env: unknown; room?: RenderRoom; format?: Format } | null>(null)
  // Filtre de soroll: un fil a part; el resultat val per a les passades amb què s'ha calculat.
  // `busy`: l'identificador de la petició en curs (0 = cap).
  // `oidn`: la xarxa d'Open Image Denoise si hi és (WebGPU + pesos); si no, l'À-Trous del worker.
  const dn = useRef<{ worker: Worker | null; busy: number; id: number; data: Float32Array | null; count: number; oidn: UNet | null; oidnNext: number }>({ worker: null, busy: 0, id: 0, data: null, count: 0, oidn: null, oidnNext: 4 })
  const [denoiser, setDenoiser] = useState<"oidn" | "atrous">("atrous")
  const img = useRef<ImageData | null>(null)
  const gpuFailedNow = gpuFailed && (!gpuFailed.res || gpuFailed.res === res) ? gpuFailed.why : null
  /** Tria un dels cels de l'app (es carrega a part; si ja s'ha començat, el render torna a començar amb el cel nou). */
  const chooseSky = (id: SkyId) => {
    const req = ++skyReq.current
    setSky(id)
    if (id === "day") return setEnv(null)
    void loadSky(id).then(
      (e) => req === skyReq.current && e && setEnv({ name: SKIES.find((k) => k.id === id)!.label, env: e, sky: id }),
      (err) => req === skyReq.current && setNotice(`No s'ha pogut carregar el cel: ${err instanceof Error ? err.message : String(err)}`),
    )
  }
  const effectiveKind: EngineKind = engineKind === "gpu" && gpuWhy === null && !gpuFailedNow ? "gpu" : "cpu"

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
    if (!img.current || img.current.width !== j.w || img.current.height !== j.h) img.current = ctx.createImageData(j.w, j.h)
    const out = img.current.data
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
      autoK = Math.min(40, Math.max(0.25, (L.key ?? 0.18) / 0.7 / gm))
    }
    const expo = 0.7 * Math.pow(2, L.exposure) * autoK
    const wr = 1 + 0.12 * L.warmth, wb = 1 - 0.12 * L.warmth
    // Corba de color: AgX (per defecte, natural) o ACES. Entrada lineal ja exposada.
    const tc = [0, 0, 0]
    const toneRgb = L.curve === "aces"
      ? (r: number, g: number, b: number) => {
          tc[0] = aces(r, 1); tc[1] = aces(g, 1); tc[2] = aces(b, 1)
        }
      : (r: number, g: number, b: number) => agx(AGX_LUT, POW_LUT, r, g, b, tc)
    const sb = source.current?.scene.background ?? [0, 0, 0]
    toneRgb(sb[0] * expo, sb[1] * expo, sb[2] * expo)
    const bgR = srgb(tc[0]!), bgG = srgb(tc[1]!), bgB = srgb(tc[2]!)
    // Resplendor (a 1/16 dels píxels) i vinyeta: només amb el fons de l'escena (els catàlegs, nets).
    const W = j.w, H = j.h
    const bloom = L.bloom > 0 ? bloomBuffer(W, H, (i, c) => col(i, c) * expo * (c === 0 ? wr : c === 2 ? wb : 1), L.bloomThreshold) : null
    const bl = [0, 0, 0]
    const vig = L.background === "scene" ? L.vignette : 0
    const cx = (W - 1) / 2, cy = (H - 1) / 2, rd2 = 1 / (cx * cx + cy * cy || 1)
    for (let i = 0, n = W * H; i < n; i++) {
      let lr = col(i, 0) * wr * expo, lg = col(i, 1) * expo, lb = col(i, 2) * wb * expo
      if (bloom) {
        sampleBloom(bloom, i % W, (i / W) | 0, bl)
        lr += bl[0]! * L.bloom; lg += bl[1]! * L.bloom; lb += bl[2]! * L.bloom
      }
      if (vig > 0) {
        const dx = (i % W) - cx, dy = ((i / W) | 0) - cy
        const v = vignette((dx * dx + dy * dy) * rd2, vig)
        lr *= v; lg *= v; lb *= v
      }
      toneRgb(lr, lg, lb)
      let r = tc[0]!, g = tc[1]!, b = tc[2]!
      if (!Number.isFinite(r + g + b)) r = g = b = 0
      const a = j.accum[i * 4 + 3]! * k
      if (L.saturation !== 1) {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        r = y + (r - y) * L.saturation
        g = y + (g - y) * L.saturation
        b = y + (b - y) * L.saturation
      }
      r = srgb(r)
      g = srgb(g)
      b = srgb(b)
      if (L.contrast !== 1) {
        r = (r - 0.5) * L.contrast + 0.5
        g = (g - 0.5) * L.contrast + 0.5
        b = (b - 0.5) * L.contrast + 0.5
      }
      let alpha = 1
      if (L.background !== "scene" && a < 1) {
        // Els píxels de fons (alfa < 1, amb les vores suavitzades) es barregen amb el blanc o
        // queden transparents. El color guardat al fons és el de l'escena: se'n treu.
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
      // L'array és «clamped»: arrodoneix i retalla a 0–255.
      out[i * 4] = r * 255
      out[i * 4 + 1] = g * 255
      out[i * 4 + 2] = b * 255
      out[i * 4 + 3] = alpha * 255
    }
    ctx.putImageData(img.current, 0, 0)
  }
  const drawRef = useRef(draw)
  drawRef.current = draw
  // Com a molt un dibuix per fotograma, i més espaiats si costen (imatges grans).
  const drawer = useRef<ReturnType<typeof createDrawScheduler> | null>(null)
  const requestDraw = () => {
    drawer.current ??= createDrawScheduler(() => drawRef.current())
    drawer.current.request()
  }

  const setLook = (patch: Partial<Look>) => {
    const next = { ...lookRef.current, ...patch }
    lookRef.current = next
    setLookState(next)
    requestDraw()
  }

  /**
   * Filtra el soroll de les passades acumulades: À-Trous cada cop menys sovint (4, 8, 16…
   * passades) o, amb OIDN, a les 4, 16, 64, 256… passades i en aturar-se (`force`).
   */
  const scheduleDenoise = (force = false) => {
    const j = job.current
    const D = dn.current
    if (!j || !lookRef.current.denoise || D.busy || j.count < 2 || !j.auxCount) return
    const oidn = D.oidn
    if (oidn ? !force && j.count < D.oidnNext : !force && j.count < D.count * 1.5 + 2) return
    if (oidn && D.count === j.count && D.data) return
    if (!oidn) D.worker ??= new Worker(new URL("./denoiseWorker.ts", import.meta.url), { type: "module" })
    const n = j.w * j.h
    const color = new Float32Array(n * 3), albedo = new Float32Array(n * 3), normal = new Float32Array(n * 3)
    const k = 1 / j.count, ka = 1 / j.auxCount
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        color[i * 3 + c] = j.accum[i * 4 + c]! * k
        albedo[i * 3 + c] = j.aux[i * 6 + c]! * ka
      }
      const nx = j.aux[i * 6 + 3]!, ny = j.aux[i * 6 + 4]!, nz = j.aux[i * 6 + 5]!
      const l = Math.hypot(nx, ny, nz)
      if (l > 1e-6) {
        normal[i * 3] = nx / l; normal[i * 3 + 1] = ny / l; normal[i * 3 + 2] = nz / l
      }
    }
    const id = ++D.id
    D.busy = id
    const count = j.count
    if (oidn) {
      D.oidnNext = Math.max(4, count * 4)
      oidnDenoise(oidn, j.w, j.h, color, albedo, normal).then(
        (data) => {
          if (D.busy === id) D.busy = 0
          if (id !== D.id || job.current !== j) return scheduleDenoise()
          D.data = data
          D.count = count
          requestDraw()
        },
        (err: unknown) => {
          // La xarxa ha fallat: l'À-Trous de sempre.
          if (D.busy === id) D.busy = 0
          oidnFailed(err)
          D.oidn = null
          setDenoiser("atrous")
          scheduleDenoise(true)
        },
      )
      return
    }
    const worker = D.worker!
    worker.onmessage = (e: MessageEvent<{ id: number; data: Float32Array }>) => {
      // Només la resposta de la petició en curs l'allibera (les d'abans d'un reinici, també).
      if (e.data.id === D.busy) D.busy = 0
      if (e.data.id !== D.id || job.current !== j) {
        // D'un render d'abans: es demana la del d'ara (si n'hi ha prou passades).
        scheduleDenoise()
        return
      }
      D.data = e.data.data
      D.count = count
      requestDraw()
    }
    worker.postMessage({ id, w: j.w, h: j.h, color, albedo, normal, strength: Math.min(1, 1.6 / Math.sqrt(count)) }, [color.buffer, albedo.buffer, normal.buffer])
  }

  /** Torna a començar el càlcul (en començar o en canviar el motor, la qualitat o la llum). */
  const restart = (o: RenderOpts, r: Resolution, kind: EngineKind) => {
    const src = source.current
    if (!src) return
    disposeEngine()
    const my = token.current
    const R = RESOLUTIONS[r]
    // El costat llarg segons la resolució; l'altre, segons el format.
    const L = Math.min(LOW_MEMORY ? LOW_MEMORY_MAX : R.max, R.max, Math.round(src.long * R.k))
    const w = src.aspect >= 1 ? L : Math.round(L * src.aspect)
    const h = src.aspect >= 1 ? Math.round(L / src.aspect) : L
    // Les sumes són les del motor: s'hi assignen amb el primer progrés (no es reserva res aquí).
    const j: Job = { w, h, accum: new Float32Array(0), aux: new Float32Array(0), count: 0, auxCount: 0 }
    job.current = j
    lastRun.current = { o, r, kind, env: envRef.current?.env ?? null, room: src.room, format: src.format }
    // Les respostes del filtre d'abans s'ignoren (la petició en curs, si n'hi ha, segueix ocupant-lo).
    dn.current.id++
    dn.current.data = null
    dn.current.count = 0
    dn.current.oidnNext = 4
    setPasses(0)
    setStartedAt(Date.now())
    setElapsed(0)
    setError(null)
    // La càmera de fotògraf (verticals rectes, focal) es fa aquí: l'escena extreta és la del visor.
    const data: RenderJob = { scene: { ...src.scene, camera: photoCamera(src.scene.camera, o) }, env: envRef.current?.env ?? null, opts: o, w, h }
    // La GPU ha fallat: es fa per CPU i no s'hi torna (fins que es torni a obrir el diàleg, o
    // en canviar de resolució si el problema era la mida).
    const gpuFallback = (message: string, sizeLimit: boolean) => {
      setGpuFailed({ why: message, res: sizeLimit ? r : null })
      setNotice(`${message} Es fa per CPU.`)
      restart(o, r, "cpu")
    }
    const events = {
      onProgress: (p: RenderProgress) => {
        if (token.current !== my || job.current !== j) return
        j.accum = p.color
        j.aux = p.aux
        j.count = p.count
        j.auxCount = p.auxCount
        setPasses(p.count)
        scheduleDenoise()
        requestDraw()
      },
      onError: (message: string) => {
        if (token.current !== my) return
        // La GPU ha fallat (memòria, s'ha perdut…): es fa per CPU.
        if (engine.current?.kind === "gpu") {
          gpuFallback(message, false)
        } else {
          disposeEngine()
          setError(message)
        }
      },
      limit: () => limitRef.current,
      onStop: () => {
        if (token.current !== my) return
        setRunning(false)
        scheduleDenoise(true)
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
          gpuFallback(err instanceof Error ? err.message : String(err), err instanceof GpuLimitError)
        },
      )
    } else run(new CpuEngine(data, events))
  }

  /** Passa l'escena del visor a dades per als motors. */
  const extract = (r: RenderRoom, f: Format = format): boolean => {
    const got = getScene()
    if (!got) {
      setNotice("El visor 3D encara no està a punt: torna-ho a provar d'aquí a un moment.")
      return false
    }
    try {
      const aspect = FORMATS[f].r || got.width / got.height
      const scene = extractScene(got.scene, got.camera, aspect, r)
      source.current = { scene, aspect, long: Math.max(got.width, got.height), room: r, format: f }
      return true
    } catch (e) {
      setNotice(`No s'ha pogut preparar l'escena: ${String(e)}`)
      return false
    }
  }

  /** «Començar»: ara sí, es prepara l'escena i es calcula. */
  const begin = () => {
    setNotice(null)
    setError(null)
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
    setGpuFailed(null)
    lastRun.current = null
    try {
      setPreview(getScene()?.snapshot?.() ?? null)
    } catch {
      setPreview(null)
    }
    let alive = true
    void gpuSupport().then((why) => alive && setGpuWhy(why))
    // Open Image Denoise si hi ha WebGPU i els pesos; si no, en silenci, l'À-Trous.
    void oidnReady().then((u) => {
      if (!alive) return
      dn.current.oidn = u
      setDenoiser(u ? "oidn" : "atrous")
    })
    // Als ambients (llum de dia), exposició automàtica i una mica càlid, com les fotos d'interiors.
    const daylight = !!getScene()?.scene.userData.daylight
    chooseSky(readSky(daylight ? "ambient" : "moble"))
    // L'ambient pot portar com s'obre el Render (escenes del catàleg: `Ambient.render`): ambient de llum i objectiu.
    const preset = getScene()?.scene.userData.renderPreset as { mood?: Mood; focal?: number } | undefined
    const mood = preset?.mood && preset.mood in MOODS ? MOODS[preset.mood] : null
    if (daylight || mood) {
      const next = { ...lookRef.current, ...(daylight ? { auto: true, warmth: 0.25 } : {}), ...(mood?.look ?? {}) }
      lookRef.current = next
      setLookState(next)
    }
    if (preset?.mood && mood) setMood(preset.mood)
    if (mood || preset?.focal) setOpts((o) => ({ ...o, ...(mood?.opts ?? {}), ...(preset?.focal ? { focal: preset.focal } : {}) }))
    return () => {
      alive = false
      disposeEngine()
      dn.current.worker?.terminate()
      dn.current.worker = null
      dn.current.busy = 0
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
      // El mateix que ja s'ha començat (p. ex. en passar sol a CPU perquè la GPU ha fallat): res.
      const L = lastRun.current
      if (L && engine.current && L.o === opts && L.r === res && L.kind === effectiveKind && L.env === (env?.env ?? null) && L.room === room && L.format === format) return
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
    // Sense motor (després d'un error): es torna a començar.
    if (!e) {
      begin()
      return
    }
    if (running) {
      e.pause()
      setRunning(false)
      // En aturar-se, el filtre de soroll amb totes les passades (els motors en poden enviar una més).
      window.setTimeout(() => scheduleDenoise(true), 300)
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
                  <Text fontSize="sm" color="fg.muted" data-render-status>
                    {status}
                  </Text>
                  <HStack gap={2}>
                    {begun ? (
                      <Button size="sm" variant="outline" onClick={toggle} disabled={preparing}>
                        {running ? <LuPause /> : <LuPlay />} {running ? "Aturar" : "Continuar"}
                      </Button>
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

              <Stack w={{ base: "full", md: "300px" }} flexShrink={0} gap={1} overflowY={{ base: "visible", md: "auto" }} pr={1} pb={{ base: 4, md: 0 }}>
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
                      onChange={(k) => {
                        setEngineKind(k)
                        saveEngine(k)
                      }}
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

                <Sec id="camera" title="Càmera" icon={LuCamera} hint="Els canvis tornen a començar el render." badge={`${format === "view" ? "Visor" : format}${opts.focal ? ` · ${opts.focal} mm` : ""}`}>
                  <FormRow label="Format" help="3:2 foto · 4:5 revista (vertical) · 16:9 web.">
                    <ChoiceChips label="Format" options={(Object.keys(FORMATS) as Format[]).map((k) => ({ id: k, label: k === "view" ? "Visor" : k }))} value={format} onChange={setFormat} />
                  </FormRow>
                  <FormRow label="Verticals rectes" help="Com les fotos d'interiors: la càmera s'anivella i les parets i els mobles no «cauen». Mirant molt de dalt no es fa.">
                    <HStack minH="32px">
                      <input type="checkbox" aria-label="Verticals rectes" checked={opts.straight !== false} onChange={(e) => set({ straight: e.currentTarget.checked })} style={{ accentColor: "var(--chakra-colors-wood-solid)" }} />
                    </HStack>
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

                <Sec id="light" title="Llum" icon={LuSun} hint="Els canvis tornen a començar el render." badge={mood !== "day" ? MOODS[mood].label : env ? "HDRI" : undefined}>
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
                  <Range label="Sol · direcció" value={opts.sunAzimuth} min={-180} max={180} step={5} format={deg} onChange={(v) => set({ sunAzimuth: v })} />
                  <Range label="Sol · alçada" value={opts.sunElevation} min={5} max={85} step={1} format={deg} onChange={(v) => set({ sunElevation: v })} />
                  <Range label="Sol · intensitat" value={opts.sunIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ sunIntensity: v })} />
                  <Range label="Ombres (dures → suaus)" value={opts.softness} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ softness: v })} />
                  <Range label="Cel (llum ambient)" value={opts.skyIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ skyIntensity: v })} />
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
                              try {
                                const parsed = parseHdr(await f.arrayBuffer())
                                skyReq.current++
                                setEnv({ name: f.name, env: parsed, sky: "file" })
                                setSky("file")
                                setNotice(null)
                              } catch (err) {
                                setNotice(`No s'ha pogut llegir el cel HDRI: ${err instanceof Error ? err.message : String(err)}`)
                              }
                            }}
                          />
                        </label>
                      </Button>
                    </Stack>
                  </FormRow>
                  {env && <Range label="Gir del cel" value={opts.envRotation ?? 0} min={0} max={360} step={5} format={deg} onChange={(v) => set({ envRotation: v })} />}
                  <FormRow label="Llums enceses" help="Les pantalles de lli i les bombetes dels llums fan llum (materials «Pantalla de lli» i «Bombeta»).">
                    <HStack minH="32px">
                      <input type="checkbox" aria-label="Llums enceses" checked={opts.lamps !== false} onChange={(e) => set({ lamps: e.currentTarget.checked })} style={{ accentColor: "var(--chakra-colors-wood-solid)" }} />
                    </HStack>
                  </FormRow>
                  {opts.lamps !== false && <Range label="Llums · intensitat" value={opts.lampIntensity ?? 1} min={0.1} max={5} step={0.1} format={x} onChange={(v) => set({ lampIntensity: v })} />}
                </Sec>

                <Sec id="image" title="Imatge" icon={LuImage} hint="S'aplica a l'instant, sense tornar a començar." badge={look.denoise ? "Sense soroll" : undefined}>
                  <FormRow label="Exposició automàtica">
                    <HStack minH="32px">
                      <input type="checkbox" aria-label="Exposició automàtica" checked={look.auto} onChange={(e) => setLook({ auto: e.currentTarget.checked })} style={{ accentColor: "var(--chakra-colors-wood-solid)" }} />
                    </HStack>
                  </FormRow>
                  <FormRow label="Reduir el soroll" help={denoiser === "oidn" ? "Amb Open Image Denoise (IA, a la GPU): a les 4, 16, 64, 256… passades i en aturar." : "Filtre guiat per l'albedo i les normals."}>
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
                      {/* Quin filtre fa servir (discret) */}
                      <Text fontSize="xs" color="fg.subtle">{denoiser === "oidn" ? "Intel OIDN" : "bàsic"}</Text>
                    </HStack>
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

                <Button
                  size="xs"
                  variant="ghost"
                  alignSelf="start"
                  onClick={() => {
                    setOpts(DEFAULT_RENDER_OPTS)
                    setMood("day")
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
