import { describe, expect, it } from "vitest"
import { WASM_RUNTIME_CACHING } from "./pwaWasmCache"

describe("memòria cau dels WASM", () => {
  const files = ["/assets/occt-import-js-BhHfLpto.wasm", "/assets/draco_decoder-Z1_iN-Ht.wasm", "/assets/draco_decoder-C32yEggz.wasm", "/assets/basis_transcoder-VXdx5NbI.wasm"]
  const of = (p: string) => WASM_RUNTIME_CACHING.filter((c) => c.urlPattern({ url: new URL(`https://x${p}`) }))

  it("OpenCascade té la seva (Draco i Basis no el poden treure)", () => {
    const occt = WASM_RUNTIME_CACHING.find((c) => c.options.cacheName === "mobles-occt")!
    const other = WASM_RUNTIME_CACHING.find((c) => c.options.cacheName === "mobles-wasm")!
    expect(of(files[0]!)).toEqual([occt])
    for (const f of files.slice(1)) expect(of(f)).toEqual([other])
    // Hi caben tots els altres sense treure'n cap.
    expect(other.options.expiration.maxEntries).toBeGreaterThanOrEqual(files.length - 1)
    expect(of("/assets/occt-import-js-x.js")).toEqual([])
    expect(of("/textures/a.wasm")).toEqual([])
  })

  it("cada `urlPattern` es pot copiar sol al service worker (no fa servir res de fora)", () => {
    for (const c of WASM_RUNTIME_CACHING) {
      const copy = new Function(`return (${c.urlPattern.toString()})`)() as typeof c.urlPattern
      for (const f of files) expect(copy({ url: new URL(`https://x${f}`) })).toBe(c.urlPattern({ url: new URL(`https://x${f}`) }))
    }
  })
})
