import { useEffect, useState } from "react"
import { parseHdr } from "./hdr"
import type { RenderEnv } from "./sceneData"

/**
 * Cels HDRI de l'app (Poly Haven, CC0; reduïts a 1K, que és el que fa servir el render) i el cel
 * de dia procedural. El de defecte del render es tria a Preferències › Visor 3D, un per als
 * mobles i un per als ambients (preferència del dispositiu, com la qualitat del visor).
 */
export type SkyId = "day" | "clouds" | "interior"

export const SKIES: { id: SkyId; label: string; help: string; url?: string }[] = [
  { id: "day", label: "Dia", help: "Cel de dia calculat: blau, horitzó clar i sol." },
  { id: "clouds", label: "Núvols", help: "Cel real amb núvols (Kloofendal, Poly Haven): llum de dia natural per als ambients i exteriors.", url: "hdr/sky-clouds-1k.hdr" },
  { id: "interior", label: "Interior", help: "Interior real (Relax Inn, Poly Haven): reflexos i llum suau per als mobles.", url: "hdr/interior-1k.hdr" },
]

export type SkyContext = "moble" | "ambient"
const DEFAULT: Record<SkyContext, SkyId> = { moble: "interior", ambient: "clouds" }
const key = (c: SkyContext) => `mobles:render-sky-${c}`
const EVENT = "mobles:render-sky-change"

export function readSky(c: SkyContext): SkyId {
  try {
    const v = localStorage.getItem(key(c))
    if (SKIES.some((s) => s.id === v)) return v as SkyId
  } catch {
    /* sense emmagatzematge */
  }
  return DEFAULT[c]
}

export function useSkyPref(c: SkyContext): [SkyId, (v: SkyId) => void] {
  const [v, setV] = useState<SkyId>(() => readSky(c))
  useEffect(() => {
    const on = () => setV(readSky(c))
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [c])
  const set = (s: SkyId) => {
    try {
      localStorage.setItem(key(c), s)
    } catch {
      /* només aquesta sessió */
    }
    setV(s)
    window.dispatchEvent(new Event(EVENT))
  }
  return [v, set]
}

const cache = new Map<SkyId, Promise<RenderEnv>>()

/** Carrega (un cop) el cel HDRI de l'app; `null` per al cel de dia. */
export function loadSky(id: SkyId): Promise<RenderEnv | null> {
  const s = SKIES.find((k) => k.id === id)
  if (!s?.url) return Promise.resolve(null)
  let p = cache.get(id)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${s.url}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      .then((b) => parseHdr(b))
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}
