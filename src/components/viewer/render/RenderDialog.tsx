import { Box, Button, CloseButton, Dialog, HStack, Portal, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { LuDownload, LuPause, LuPlay } from "react-icons/lu"
import type { Camera, Scene } from "three"
import { extractScene } from "./sceneData"

export type SceneGetter = () => { scene: Scene; camera: Camera; width: number; height: number } | null

/** Màxim de píxels d'amplada del render (qualitat vs. temps). */
const MAX_W = 1600

/** To (ACES aproximat) i gamma sRGB de la mitjana acumulada; `exp` = multiplicador d'exposició. */
function toneMap(v: number, exp: number): number {
  const a = v * exp
  const x = (a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14)
  const c = Math.min(1, Math.max(0, x))
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/**
 * «Render»: imatge fotorealista per CPU, com el render físic de Cinema 4D. Es calcula amb
 * diversos fils (workers) i es va afinant (cada passada és una mostra més per píxel); es pot
 * aturar i desar en PNG. No depèn de la GPU ni dels seus límits.
 */
export function RenderDialog({ open, onClose, getScene, name }: { open: boolean; onClose: () => void; getScene: SceneGetter; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [passes, setPasses] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  // Exposició en passos (EV): es pot ajustar sense tornar a calcular (només el to).
  const [ev, setEv] = useState(0)
  const exposure = useRef(0)
  const workers = useRef<Worker[]>([])
  const job = useRef<{ w: number; h: number; accum: Float32Array; count: number; scene: ReturnType<typeof extractScene> } | null>(null)

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
    const expo = 0.7 * Math.pow(2, exposure.current)
    for (let i = 0, n = j.w * j.h; i < n; i++) {
      img.data[i * 4] = toneMap(j.accum[i * 3]! * k, expo) * 255
      img.data[i * 4 + 1] = toneMap(j.accum[i * 3 + 1]! * k, expo) * 255
      img.data[i * 4 + 2] = toneMap(j.accum[i * 3 + 2]! * k, expo) * 255
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }

  const startWorkers = () => {
    const j = job.current
    if (!j) return
    const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1))
    let pending = false
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
      w.onmessage = (e: MessageEvent<{ type: string; data: Float32Array }>) => {
        const jj = job.current
        if (!jj || e.data.type !== "pass") return
        const d = e.data.data
        for (let q = 0; q < d.length; q++) jj.accum[q]! += d[q]!
        jj.count += 1
        setPasses(jj.count)
        if (!pending) {
          pending = true
          requestAnimationFrame(() => {
            pending = false
            draw()
          })
        }
      }
      w.onerror = (ev) => setError(ev.message || "Error al render")
      w.postMessage({ type: "scene", scene: j.scene, width: j.w, height: j.h, seed: (Math.random() * 2 ** 31) | 0 })
      workers.current.push(w)
    }
    setRunning(true)
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setPasses(0)
    const got = getScene()
    if (!got) {
      setError("El visor 3D no està a punt.")
      return
    }
    const aspect = got.width / got.height
    const w = Math.min(MAX_W, Math.round(got.width * 1.5))
    const h = Math.round(w / aspect)
    try {
      const scene = extractScene(got.scene, got.camera, aspect)
      job.current = { w, h, accum: new Float32Array(w * h * 3), count: 0, scene }
      if (canvas.current) {
        canvas.current.width = w
        canvas.current.height = h
      }
      setStarted(Date.now())
      startWorkers()
    } catch (e) {
      setError(String(e))
    }
    return () => {
      stopWorkers()
      job.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="cover" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Render</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body display="flex" flexDirection="column" gap={3} minH={0}>
              <Box flex={1} minH={0} display="flex" alignItems="center" justifyContent="center" bg="bg.muted" rounded="md" overflow="hidden">
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
                  {passes} {passes === 1 ? "passada" : "passades"} · {elapsed} s · {workers.current.length || "—"} fils. Es va afinant: com més passades, menys soroll.
                </Text>
                <HStack gap={2}>
                  <HStack gap={2} fontSize="sm" color="fg.muted">
                    <Text>Exposició</Text>
                    <input
                      type="range"
                      min={-2}
                      max={2}
                      step={0.1}
                      value={ev}
                      aria-label="Exposició"
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setEv(v)
                        exposure.current = v
                        draw()
                      }}
                      style={{ width: 120 }}
                    />
                    <Text minW="3ch" textAlign="right">
                      {ev > 0 ? "+" : ""}
                      {ev.toFixed(1)}
                    </Text>
                  </HStack>
                  <Button size="sm" variant="outline" onClick={() => (running ? stopWorkers() : startWorkers())} disabled={!!error}>
                    {running ? <LuPause /> : <LuPlay />} {running ? "Aturar" : "Continuar"}
                  </Button>
                  <Button size="sm" colorPalette="wood" onClick={save} disabled={!passes}>
                    <LuDownload /> Desar PNG
                  </Button>
                </HStack>
              </HStack>
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
