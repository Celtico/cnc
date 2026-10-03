import type { RenderCamera, RenderTexture } from "./sceneData"

/**
 * Vista per les finestres dels ambients (render): un panorama equirectangular de foto (la fila de dalt és el zenit),
 * de Poly Haven (CC0) o una foto de l'usuari. Alfa 0 = es veu el cel del motor. Només el veuen els raigs de la càmera
 * que surten per un vidre (`RenderScene.backdrop`): no fa llum, i el motor el multiplica per la llum del cel a
 * l'horitzó (de dia, clar; al vespre, fosc). El panorama es gira perquè la part bona (`hero`) quedi davant de la càmera.
 */
export type BackdropKind = "garden" | "sea" | "photo"

export const BACKDROPS: { id: BackdropKind | "sky"; label: string; help: string }[] = [
  { id: "garden", label: "Jardí", help: "Foto real d'un jardí (Symmetrical Garden, Poly Haven) per les finestres." },
  { id: "sea", label: "Mar", help: "Foto real d'una badia (Simon's Town, Poly Haven) per les finestres." },
  { id: "photo", label: "La meva foto", help: "Una foto teva (del mòbil, per exemple, feta recta): es posa davant de la càmera. Un panorama 360° (2:1) també va." },
  { id: "sky", label: "El cel (HDRI)", help: "El cel del render tal qual: amb un .hdr teu (Llum › Cel), per les finestres es veu el que hi ha a la foto, i també fa la llum." },
]

/** Panorama carregat: píxels sRGB (RGBA) i la columna (0–1) que ha de quedar davant de la càmera. */
export interface Panorama {
  w: number
  h: number
  data: Uint8ClampedArray
  hero: number
}

const FILES: Record<Exclude<BackdropKind, "photo">, { url: string; hero: number }> = {
  garden: { url: "backdrop/garden-2k.jpg", hero: 0.47 },
  sea: { url: "backdrop/sea-2k.jpg", hero: 0.5 },
}

/** Mida del panorama que es fa d'una foto normal. */
const PW = 2048
const PH = 1024
/** Camp horitzontal que se suposa a una foto normal (un mòbil, en horitzontal, fa uns 65–75°). */
const PHOTO_FOV = 70

/**
 * Una foto normal (perspectiva, feta recta: l'horitzó al mig) com a panorama: davant de la càmera tal qual; als costats,
 * repetida en mirall (no es nota la junta); per sobre de la foto, alfa 0 (el cel del motor, amb una vora suau); per sota,
 * l'última fila. Un panorama 2:1 es fa servir directament.
 */
export function photoPanorama(w: number, h: number, data: Uint8ClampedArray): Panorama {
  if (Math.abs(w / h - 2) < 0.08) return { w, h, data, hero: 0.5 }
  const out = new Uint8ClampedArray(PW * PH * 4)
  const half = (PHOTO_FOV / 2) * (Math.PI / 180)
  const f = w / 2 / Math.tan(half)
  const fade = h * 0.03
  for (let y = 0; y < PH; y++) {
    const el = (0.5 - (y + 0.5) / PH) * Math.PI
    if (el >= Math.PI / 2 - 0.01 || el <= -Math.PI / 2 + 0.01) continue
    for (let x = 0; x < PW; x++) {
      // Azimut respecte del centre (−π..π), plegat en mirall dins del camp de la foto.
      let az = ((x + 0.5) / PW - 0.5) * 2 * Math.PI
      const span = 2 * half
      let t = (az + half) / span
      t = t - 2 * Math.floor(t / 2)
      az = (t <= 1 ? t : 2 - t) * span - half
      const ix = w / 2 + f * Math.tan(az)
      const iy = h / 2 - (f * Math.tan(el)) / Math.cos(az)
      const o = (y * PW + x) * 4
      if (iy < -fade) continue
      const sx = Math.min(w - 1, Math.max(0, Math.round(ix - 0.5)))
      const sy = Math.min(h - 1, Math.max(0, Math.round(iy - 0.5)))
      const i = (sy * w + sx) * 4
      out[o] = data[i]!
      out[o + 1] = data[i + 1]!
      out[o + 2] = data[i + 2]!
      out[o + 3] = iy < 0 ? Math.round(255 * (1 + iy / fade)) : 255
    }
  }
  return { w: PW, h: PH, data: out, hero: 0.5 }
}

/**
 * La textura del render: el panorama girat perquè `hero` quedi on mira la càmera (amb el gir del cel, com el motor:
 * u = atan2(x, −z)/2π + ½ + gir).
 */
export function aimBackdrop(p: Panorama, camera: RenderCamera, envRotation = 0): RenderTexture {
  const m = camera.matrix
  const fx = -m[8]!, fz = -m[10]!
  const uf = Math.hypot(fx, fz) > 1e-6 ? Math.atan2(fx, -fz) / (2 * Math.PI) + 0.5 + envRotation / 360 : p.hero
  const shift = Math.round((((uf - p.hero) % 1) + 1) % 1 * p.w) % p.w
  const data = new Uint8ClampedArray(p.data.length)
  const row = p.w * 4
  for (let y = 0; y < p.h; y++) {
    const r = y * row
    // Columna x del panorama → x + shift.
    data.set(p.data.subarray(r, r + row - shift * 4), r + shift * 4)
    data.set(p.data.subarray(r + row - shift * 4, r + row), r)
  }
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i + 1]! / 255
  return { w: p.w, h: p.h, data, wrapS: 0, wrapT: 2, flipY: false, lum: sum / (p.w * p.h) }
}

async function decode(blob: Blob): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const bmp = await createImageBitmap(blob)
  // Fotos molt grans: prou amb 2048 d'ample (com els panorames de l'app).
  const k = Math.min(1, 2048 / bmp.width)
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext("2d")!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return { w, h, data: ctx.getImageData(0, 0, w, h).data }
}

const CACHE = "mobles-backdrop-v1"
const PHOTO_KEY = "/backdrop/user-photo"
const loaded = new Map<string, Promise<Panorama | null>>()

/** Carrega (un cop) la vista; la foto de l'usuari, de l'emmagatzematge del navegador (`null` si no n'hi ha). */
export function loadBackdrop(kind: BackdropKind): Promise<Panorama | null> {
  let p = loaded.get(kind)
  if (!p) {
    p = kind === "photo"
      ? caches.open(CACHE).then((c) => c.match(PHOTO_KEY)).then(async (r) => (r ? photoPanorama(...(Object.values(await decode(await r.blob())) as [number, number, Uint8ClampedArray])) : null))
      : fetch(`${import.meta.env.BASE_URL}${FILES[kind].url}`).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const d = await decode(await r.blob())
          return { ...d, hero: FILES[kind].hero }
        })
    p.catch(() => loaded.delete(kind))
    loaded.set(kind, p)
  }
  return p
}

/** Desa la foto de l'usuari per a les finestres (es queda per als renders següents). */
export async function saveBackdropPhoto(file: Blob): Promise<Panorama> {
  const d = await decode(file)
  const pano = photoPanorama(d.w, d.h, d.data)
  try {
    const c = await caches.open(CACHE)
    await c.put(PHOTO_KEY, new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } }))
  } catch {
    // Sense emmagatzematge (navegació privada): val per a aquesta sessió.
  }
  loaded.set("photo", Promise.resolve(pano))
  return pano
}
