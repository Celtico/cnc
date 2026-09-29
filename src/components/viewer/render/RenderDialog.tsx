import { Box, Button, CloseButton, Dialog, HStack, NativeSelect, Portal, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { LuDownload, LuPause, LuPlay, LuRotateCcw } from "react-icons/lu"
import type { Camera, Scene } from "three"
import { DEFAULT_RENDER_OPTS, extractScene, type RenderOpts, type RenderRoom } from "./sceneData"

export type SceneGetter = () => { scene: Scene; camera: Camera; width: number; height: number } | null

/** Resolució: multiplicador de la mida del visor i amplada màxima (px). */
const RESOLUTIONS = {
  draft: { label: "Esborrany", k: 1, max: 1000 },
  normal: { label: "Normal", k: 1.5, max: 1600 },
  high: { label: "Alta", k: 2, max: 2400 },
  max: { label: "Màxima", k: 3, max: 3600 },
} as const
type Resolution = keyof typeof RESOLUTIONS

type Background = "scene" | "white" | "transparent"
interface Look {
  exposure: number
  contrast: number
  saturation: number
  background: Background
}
const DEFAULT_LOOK: Look = { exposure: 0, contrast: 1, saturation: 1, background: "scene" }

/** To ACES aproximat (lineal → [0, 1] lineal); `exp` = multiplicador d'exposició. */
function aces(v: number, exp: number): number {
  const a = v * exp
  return Math.min(1, Math.max(0, (a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14)))
}
const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** Control lliscant compacte: rètol, valor i range natiu. */
function Range({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <Stack gap={0.5}>
      <HStack justify="space-between" fontSize="xs">
        <Text color="fg.muted">{label}</Text>
        <Text fontVariantNumeric="tabular-nums">{format(value)}</Text>
      </HStack>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--chakra-colors-wood-solid)" }}
      />
    </Stack>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <HStack justify="space-between">
        <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" color="fg.muted">
          {title}
        </Text>
        {hint && (
          <Text fontSize="2xs" color="fg.subtle">
            {hint}
          </Text>
        )}
      </HStack>
      {children}
    </Stack>
  )
}

/**
 * «Render»: imatge fotorealista per CPU, com el render físic de Cinema 4D. Es calcula amb
 * diversos fils (workers) i es va afinant (cada passada és una mostra més per píxel); es pot
 * aturar i desar en PNG. No depèn de la GPU ni dels seus límits.
 * Opcions: qualitat i llum tornen a començar el càlcul; les d'imatge (exposició, contrast,
 * saturació, fons) només retoquen el to, a l'instant.
 */
export function RenderDialog({ open, onClose, getScene, name }: { open: boolean; onClose: () => void; getScene: SceneGetter; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [passes, setPasses] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [opts, setOpts] = useState<RenderOpts>(DEFAULT_RENDER_OPTS)
  const [res, setRes] = useState<Resolution>("normal")
  const [limit, setLimit] = useState(0)
  const [room, setRoom] = useState<RenderRoom>("room")
  const [look, setLookState] = useState<Look>(DEFAULT_LOOK)
  const lookRef = useRef(look)
  const limitRef = useRef(limit)
  limitRef.current = limit
  const workers = useRef<Worker[]>([])
  const source = useRef<{ scene: ReturnType<typeof extractScene>; aspect: number; viewW: number; room?: RenderRoom } | null>(null)
  const job = useRef<{ w: number; h: number; accum: Float32Array; count: number } | null>(null)

  const stopWorkers = () => {
    for (const w of workers.current) w.terminate()
    workers.current = []
    setRunning(false)
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
    const expo = 0.7 * Math.pow(2, L.exposure)
    const tone = (v: number) => aces(v, expo)
    for (let i = 0, n = j.w * j.h; i < n; i++) {
      let r = tone(j.accum[i * 4]! * k)
      let g = tone(j.accum[i * 4 + 1]! * k)
      let b = tone(j.accum[i * 4 + 2]! * k)
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

  const startWorkers = (o: RenderOpts) => {
    const j = job.current
    const src = source.current
    if (!j || !src) return
    const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1))
    let pending = false
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
      w.onmessage = (e: MessageEvent<{ type: string; data: Float32Array }>) => {
        const jj = job.current
        if (!jj || e.data.type !== "pass" || jj.accum.length !== e.data.data.length) return
        const d = e.data.data
        for (let q = 0; q < d.length; q++) jj.accum[q]! += d[q]!
        jj.count += 1
        setPasses(jj.count)
        if (limitRef.current && jj.count >= limitRef.current) stopWorkers()
        if (!pending) {
          pending = true
          requestAnimationFrame(() => {
            pending = false
            draw()
          })
        }
      }
      w.onerror = (ev) => setError(ev.message || "Error al render")
      w.postMessage({ type: "scene", scene: src.scene, width: j.w, height: j.h, seed: (Math.random() * 2 ** 31) | 0, opts: o })
      workers.current.push(w)
    }
    setRunning(true)
  }

  /** Torna a començar el càlcul (canvi de qualitat o de llum). */
  const restart = (o: RenderOpts, r: Resolution) => {
    const src = source.current
    if (!src) return
    stopWorkers()
    const R = RESOLUTIONS[r]
    const w = Math.min(R.max, Math.round(src.viewW * R.k))
    const h = Math.round(w / src.aspect)
    job.current = { w, h, accum: new Float32Array(w * h * 4), count: 0 }
    setPasses(0)
    setStarted(Date.now())
    setElapsed(0)
    startWorkers(o)
  }

  /** Passa l'escena del visor a dades per als workers. */
  const extract = (r: RenderRoom): boolean => {
    const got = getScene()
    if (!got) {
      setError("El visor 3D no està a punt.")
      return false
    }
    try {
      const aspect = got.width / got.height
      source.current = { scene: extractScene(got.scene, got.camera, aspect, r), aspect, viewW: got.width, room: r }
      return true
    } catch (e) {
      setError(String(e))
      return false
    }
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setPasses(0)
    if (extract(room)) restart(opts, res)
    return () => {
      stopWorkers()
      job.current = null
      source.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Qualitat i llum: es torna a començar, esperant una mica mentre s'arrossega.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!open || !source.current) return
    const id = window.setTimeout(() => {
      if (source.current?.room !== room && !extract(room)) return
      restart(opts, res)
    }, 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, res, room])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [running, started])

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

  const set = (patch: Partial<RenderOpts>) => setOpts((o) => ({ ...o, ...patch }))
  const x = (v: number) => `${v.toFixed(1)}×`
  const deg = (v: number) => `${Math.round(v)}°`
  const j = job.current

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="cover" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Render</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body display="flex" flexDirection={{ base: "column", md: "row" }} gap={4} minH={0}>
              <Stack flex={1} minH={0} minW={0} gap={3}>
                <Box
                  flex={1}
                  minH="200px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  rounded="md"
                  overflow="hidden"
                  // Quadrícula de transparència quan el fons és transparent.
                  bg={look.background === "transparent" ? undefined : "bg.muted"}
                  style={look.background === "transparent" ? { background: "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 16px 16px" } : undefined}
                >
                  {error ? (
                    <Text p={4} color="fg.error">
                      {error}
                    </Text>
                  ) : (
                    <canvas ref={canvas} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  )}
                </Box>
                <HStack justify="space-between" wrap="wrap" gap={2}>
                  <Text fontSize="sm" color="fg.muted">
                    {passes}
                    {limit ? ` / ${limit}` : ""} {passes === 1 ? "passada" : "passades"} · {elapsed} s · {j ? `${j.w} × ${j.h} px` : "—"} · {workers.current.length || "—"} fils
                  </Text>
                  <HStack gap={2}>
                    <Button size="sm" variant="outline" onClick={() => (running ? stopWorkers() : startWorkers(opts))} disabled={!!error}>
                      {running ? <LuPause /> : <LuPlay />} {running ? "Aturar" : "Continuar"}
                    </Button>
                    <Button size="sm" colorPalette="wood" onClick={save} disabled={!passes}>
                      <LuDownload /> Desar PNG
                    </Button>
                  </HStack>
                </HStack>
              </Stack>

              <Stack w={{ base: "full", md: "260px" }} flexShrink={0} gap={5} overflowY="auto" pr={1}>
                <Group title="Qualitat" hint="torna a començar">
                  <Stack gap={0.5}>
                    <Text fontSize="xs" color="fg.muted">
                      Resolució
                    </Text>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field value={res} onChange={(e) => setRes(e.currentTarget.value as Resolution)}>
                        {(Object.keys(RESOLUTIONS) as Resolution[]).map((k) => (
                          <option key={k} value={k}>
                            {RESOLUTIONS[k].label} (fins a {RESOLUTIONS[k].max} px)
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Stack>
                  <Range label="Rebots de llum" value={opts.bounces} min={2} max={12} step={1} format={(v) => String(v)} onChange={(v) => set({ bounces: v })} />
                  <Stack gap={0.5}>
                    <Text fontSize="xs" color="fg.muted">
                      Aturar-se a
                    </Text>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field value={String(limit)} onChange={(e) => setLimit(Number(e.currentTarget.value))}>
                        <option value="0">Sense límit</option>
                        <option value="64">64 passades (prova)</option>
                        <option value="256">256 passades</option>
                        <option value="1024">1024 passades (final)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Stack>
                </Group>

                <Group title="Escena" hint="torna a començar">
                  <SegmentGroup.Root size="xs" value={room} onValueChange={(e) => setRoom(e.value as RenderRoom)} w="full">
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Items
                      flex={1}
                      items={[
                        { value: "room", label: "Habitació" },
                        { value: "floor", label: "Només terra" },
                        { value: "none", label: "Cap" },
                      ]}
                    />
                  </SegmentGroup.Root>
                  <Text fontSize="2xs" color="fg.subtle">
                    L'habitació és la del mode Presentació. Amb «Cap» i fons blanc o transparent, per a catàlegs.
                  </Text>
                </Group>

                <Group title="Llum" hint="torna a començar">
                  <Range label="Sol · direcció" value={opts.sunAzimuth} min={-180} max={180} step={5} format={deg} onChange={(v) => set({ sunAzimuth: v })} />
                  <Range label="Sol · alçada" value={opts.sunElevation} min={5} max={85} step={1} format={deg} onChange={(v) => set({ sunElevation: v })} />
                  <Range label="Sol · intensitat" value={opts.sunIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ sunIntensity: v })} />
                  <Range label="Ombres (dures → suaus)" value={opts.softness} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ softness: v })} />
                  <Range label="Cel (llum ambient)" value={opts.skyIntensity} min={0} max={3} step={0.1} format={x} onChange={(v) => set({ skyIntensity: v })} />
                </Group>

                <Group title="Imatge" hint="a l'instant">
                  <Range label="Exposició" value={look.exposure} min={-2} max={2} step={0.1} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`} onChange={(v) => setLook({ exposure: v })} />
                  <Range label="Contrast" value={look.contrast} min={0.6} max={1.6} step={0.05} format={x} onChange={(v) => setLook({ contrast: v })} />
                  <Range label="Saturació" value={look.saturation} min={0} max={2} step={0.05} format={x} onChange={(v) => setLook({ saturation: v })} />
                  <Stack gap={0.5}>
                    <Text fontSize="xs" color="fg.muted">
                      Fons
                    </Text>
                    <SegmentGroup.Root size="xs" value={look.background} onValueChange={(e) => setLook({ background: e.value as Background })} w="full">
                      <SegmentGroup.Indicator />
                      <SegmentGroup.Items
                        flex={1}
                        items={[
                          { value: "scene", label: "Estudi" },
                          { value: "white", label: "Blanc" },
                          { value: "transparent", label: "Transparent" },
                        ]}
                      />
                    </SegmentGroup.Root>
                  </Stack>
                </Group>

                <Button
                  size="xs"
                  variant="ghost"
                  alignSelf="start"
                  onClick={() => {
                    setOpts(DEFAULT_RENDER_OPTS)
                    setRes("normal")
                    setLimit(0)
                    setRoom("room")
                    setLook(DEFAULT_LOOK)
                  }}
                >
                  <LuRotateCcw /> Restablir
                </Button>
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
