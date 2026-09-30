/// <reference lib="webworker" />
import { denoise } from "./denoise"

/** Filtre de soroll en un fil a part (no bloqueja el diàleg mentre el render continua). */
self.onmessage = (e: MessageEvent<{ id: number; w: number; h: number; color: Float32Array; albedo: Float32Array; normal: Float32Array; strength: number }>) => {
  const { id, w, h, color, albedo, normal, strength } = e.data
  const out = denoise(w, h, color, albedo, normal, strength)
  ;(self as unknown as Worker).postMessage({ id, data: out }, [out.buffer])
}
