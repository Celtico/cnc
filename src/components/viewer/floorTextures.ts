import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"
import { LOW_MEMORY } from "./deviceLimits"
import type { FloorId } from "./presentationScene"

/* Textures procedurals del terra de l'habitació de Presentació (i les mostres de Preferències). */

/** Mida del terra i amplada de la paret (m): prou gran perquè no se'n vegin les vores. */
export const ROOM = 40

const WOOD_TONES: Record<"oak" | "walnut", string[]> = {
  oak: ["#c9a67a", "#c19d71", "#cfae83", "#bb966a", "#c6a376", "#d2b389"],
  walnut: ["#6e4a30", "#5f3f28", "#7a5337", "#654430", "#734d33", "#58392a"],
}

/** Costat de la tessel·la de parquet (m). */
const PARQUET_TILE = 2.4

/**
 * Parquet generat amb un canvas (sense descarregar imatges): lames de 15 cm × 0,8–1,6 m,
 * tons lleugerament diferents, veta i junts. La tessel·la (2,4 × 2,4 m) és contínua: cada
 * filera suma exactament l'amplada i les lames que passen de la vora continuen per l'altre
 * costat, així no es veuen costures ni lames tallades en repetir-se.
 */
function makeParquet(tones: string[]): CanvasTexture {
  // A l'iPhone, 1024 (4 MB en lloc de 16, més els mipmaps): la mateixa tessel·la amb la meitat de detall.
  const px = LOW_MEMORY ? 1024 : 2048
  /** Gruixos de línia dibuixats per a 2048 px. */
  const lw = px / 2048
  const rows = 16
  const perM = px / PARQUET_TILE
  const c = document.createElement("canvas")
  c.width = px
  c.height = px
  const g = c.getContext("2d")!
  const plankW = px / rows // 15 cm
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  /** Dibuixa `fn` a x i als seus desplaçaments de ±px (continuïtat horitzontal). */
  const wrapped = (fn: (dx: number) => void) => {
    for (const dx of [-px, 0, px]) fn(dx)
  }

  for (let row = 0; row < rows; row++) {
    const y0 = row * plankW
    // Llargades que sumen exactament px (s'escalen), començant en un punt aleatori.
    const lens: number[] = []
    let sum = 0
    while (sum < px) {
      const l = perM * (0.8 + rnd() * 0.8)
      lens.push(l)
      sum += l
    }
    const k = px / sum
    let x = rnd() * px
    for (const raw of lens) {
      const len = raw * k
      const tone = tones[Math.floor(rnd() * tones.length)]!
      const shade = (rnd() - 0.5) * 0.08
      const lines = Array.from({ length: 16 }, (_, i) => ({
        y: y0 + rnd() * plankW,
        a: 0.04 + rnd() * 0.08,
        w: (0.6 + rnd() * 1.4) * lw,
        amp: (1 + rnd() * 2) * lw,
        ph: i + rnd() * 3,
      }))
      wrapped((dx) => {
        const x0 = x + dx
        if (x0 + len < 0 || x0 > px) return
        g.save()
        g.beginPath()
        g.rect(x0, y0, len, plankW)
        g.clip()
        g.fillStyle = tone
        g.fillRect(x0, y0, len, plankW)
        g.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`
        g.fillRect(x0, y0, len, plankW)
        // veta: línies fines i lleugerament ondulades al llarg de la lama
        for (const ln of lines) {
          g.strokeStyle = `rgba(90, 60, 30, ${ln.a})`
          g.lineWidth = ln.w
          g.beginPath()
          g.moveTo(x0, ln.y)
          for (let t = 0; t <= 1.001; t += 0.05) g.lineTo(x0 + len * t, ln.y + Math.sin(t * 6 + ln.ph) * ln.amp)
          g.stroke()
        }
        g.restore()
        // junt de testa
        g.fillStyle = "rgba(60, 40, 20, 0.45)"
        g.fillRect(x0 + len - lw, y0, 2 * lw, plankW)
      })
      x += len
    }
    // junt longitudinal
    g.fillStyle = "rgba(60, 40, 20, 0.5)"
    g.fillRect(0, y0, px, 2 * lw)
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

/** Microciment: gris amb taques suaus i gra fi. */
function makeConcrete(): CanvasTexture {
  const px = 512
  const c = document.createElement("canvas")
  c.width = px
  c.height = px
  const g = c.getContext("2d", { willReadFrequently: true })!
  g.fillStyle = "#a9a59f"
  g.fillRect(0, 0, px, px)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * px
    const y = rnd() * px
    const r = 30 + rnd() * 120
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const a = 0.04 + rnd() * 0.06
    grad.addColorStop(0, rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(60,55,50,${a})`)
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    // es dibuixa també desplaçat perquè la tessel·la no tingui costures
    for (const dx of [-px, 0, px]) for (const dy of [-px, 0, px]) {
      g.save()
      g.translate(dx, dy)
      g.fillRect(x - r, y - r, r * 2, r * 2)
      g.restore()
    }
  }
  const img = g.getImageData(0, 0, px, px)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 10
    img.data[i]! += n
    img.data[i + 1]! += n
    img.data[i + 2]! += n
  }
  g.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Textures base dels terres (es generen la primera vegada que es fan servir i es guarden: el parquet costa de fer). */
const floorCache = new Map<FloorId, CanvasTexture>()

function generate(id: FloorId): CanvasTexture | null {
  return id === "oak" || id === "walnut" ? makeParquet(WOOD_TONES[id]) : id === "concrete" ? makeConcrete() : null
}

/**
 * Terra procedural de l'habitació de Presentació (i de les miniatures): la textura és la base compartida de la
 * memòria; qui la fa servir en fa un clon (`tileClone`) amb la seva repetició i allibera només el clon.
 */
export function makeFloor(id: FloorId): { map: CanvasTexture | null; repeat: number; roughness: number } {
  let map = floorCache.get(id) ?? null
  if (!map && (map = generate(id))) floorCache.set(id, map)
  if (id === "oak" || id === "walnut") return { map, repeat: ROOM / PARQUET_TILE, roughness: 0.55 }
  if (id === "concrete") return { map, repeat: ROOM / 2, roughness: 0.8 }
  return { map: null, repeat: 1, roughness: 0.7 }
}

const swatchCache = new Map<FloorId, string | null>()

/** Imatge petita (data URL) de la textura del terra, per a les mostres de les preferències. */
export function floorSwatchUrl(id: FloorId): string | null {
  if (!swatchCache.has(id)) {
    // Sense guardar-la a la memòria si no hi era (les mostres no la fan servir al 3D).
    const cached = floorCache.get(id)
    const tex = cached ?? generate(id)
    const src = tex?.image as HTMLCanvasElement | undefined
    let url: string | null = null
    if (src) {
      const c = document.createElement("canvas")
      c.width = c.height = 96
      // un tros de ~40 cm perquè es vegin les lames
      c.getContext("2d")!.drawImage(src, 0, 0, src.width / 6, src.height / 6, 0, 0, 96, 96)
      url = c.toDataURL("image/jpeg", 0.85)
    }
    if (!cached) tex?.dispose()
    swatchCache.set(id, url)
  }
  return swatchCache.get(id)!
}

