import type { UNet } from "oidn-web"

/**
 * Filtre de soroll amb Intel Open Image Denoise (xarxa neuronal, `oidn-web` per WebGPU), el dels
 * programes de render: color HDR + albedo + normal de la primera superfície. Només si hi ha WebGPU
 * i els pesos (`public/oidn/rt_hdr_alb_nrm.tza`, no van amb l'app ni es precachegen: es desen a la
 * memòria cau del navegador el primer cop). Si no n'hi ha o falla, `null`: es fa servir el filtre
 * À-Trous de sempre (`denoise.ts`). Fa servir el seu propi dispositiu de WebGPU (no comparteix el
 * del path tracer: si un es perd, l'altre continua).
 */
const OIDN_WEIGHTS = "oidn/rt_hdr_alb_nrm.tza"
const CACHE = "mobles-oidn"

let ready: Promise<UNet | null> | null = null
let broken = false

/** Mida mínima dels pesos de debò (els de `rt_hdr_alb_nrm` fan uns quants MB). */
const MIN_WEIGHTS = 10 * 1024

/** Uns pesos de debò: prou grossos i no un punter de Git LFS («version https://git-lfs…»). */
export function isWeightsFile(buf: ArrayBuffer): boolean {
  if (buf.byteLength <= MIN_WEIGHTS) return false
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, 64))
  return !head.startsWith("version https://git-lfs")
}

async function loadWeights(url: string): Promise<ArrayBuffer | null> {
  let cache: Cache | null = null
  try {
    cache = await caches.open(CACHE)
  } catch {
    cache = null
  }
  const hit = (await cache?.match(url)) ?? null
  if (hit) {
    const buf = await hit.arrayBuffer()
    if (isWeightsFile(buf)) return buf
    await cache?.delete(url)
  }
  const res = await fetch(url)
  // Sense el fitxer, el servidor de desenvolupament torna la pàgina (HTML): no hi és.
  if (!res.ok || /html/i.test(res.headers.get("content-type") ?? "")) return null
  const buf = await res.arrayBuffer()
  if (!isWeightsFile(buf)) return null
  try {
    await cache?.put(url, new Response(buf))
  } catch {
    // Sense espai a la memòria cau: es baixarà cada cop.
  }
  return buf
}

/** La xarxa a punt, o `null` si no es pot (sense WebGPU, sense pesos o error). */
export function oidnReady(): Promise<UNet | null> {
  if (broken) return Promise.resolve(null)
  ready ??= (async () => {
    try {
      if (!("gpu" in navigator) || !navigator.gpu) return null
      const buf = await loadWeights(`${import.meta.env.BASE_URL}${OIDN_WEIGHTS}`)
      if (!buf) return null
      const { initUNetFromBuffer } = await import("oidn-web")
      return await initUNetFromBuffer(buf, undefined, { aux: true, hdr: true })
    } catch (e) {
      console.info("[oidn] no disponible, es fa servir l'À-Trous:", e)
      return null
    }
  })()
  return ready
}

/** Després d'un error de la xarxa: no s'hi torna fins a recarregar la pàgina. */
export function oidnFailed(e: unknown) {
  console.warn("[oidn] error, es fa servir l'À-Trous:", e)
  broken = true
  ready = null
}

/**
 * Filtra `color` (RGB lineal, 3 per píxel) amb l'albedo (RGB 0–1) i la normal (unitària) i torna el
 * resultat RGB. Llança si la GPU falla (qui crida torna a l'À-Trous).
 */
export function oidnDenoise(unet: UNet, w: number, h: number, color: Float32Array, albedo: Float32Array, normal: Float32Array): Promise<Float32Array> {
  const n = w * h
  const c4 = new Float32Array(n * 4)
  const a8 = new Uint8ClampedArray(n * 4)
  const n8 = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = color[i * 3 + k]!
      c4[i * 4 + k] = Number.isFinite(v) ? Math.max(0, v) : 0
      a8[i * 4 + k] = albedo[i * 3 + k]! * 255
      n8[i * 4 + k] = (normal[i * 3 + k]! * 0.5 + 0.5) * 255
    }
    c4[i * 4 + 3] = 1
    a8[i * 4 + 3] = n8[i * 4 + 3] = 255
  }
  return new Promise((resolve, reject) => {
    try {
      unet.tileExecute({
        color: { data: c4, width: w, height: h },
        albedo: new ImageData(a8, w, h),
        normal: new ImageData(n8, w, h),
        done: (out) => {
          const d = out.data
          const rgb = new Float32Array(n * 3)
          for (let i = 0; i < n; i++) {
            rgb[i * 3] = d[i * 4]!
            rgb[i * 3 + 1] = d[i * 4 + 1]!
            rgb[i * 3 + 2] = d[i * 4 + 2]!
          }
          resolve(rgb)
        },
      })
    } catch (e) {
      reject(e)
    }
  })
}
