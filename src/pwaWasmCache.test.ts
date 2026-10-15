import { describe, expect, it } from "vitest"
import { WASM_RUNTIME_CACHING } from "./pwaWasmCache"

describe("memòria cau dels WASM", () => {
  const files = ["/assets/draco_decoder-Z1_iN-Ht.wasm", "/assets/draco_decoder-C32yEggz.wasm", "/assets/basis_transcoder-VXdx5NbI.wasm"]
  const of = (p: string) => WASM_RUNTIME_CACHING.filter((c) => c.urlPattern({ url: new URL(`https://x${p}`) }))

  it("els WASM de /assets van a la seva memòria i hi caben tots", () => {
    const wasm = WASM_RUNTIME_CACHING.find((c) => c.options.cacheName === "mobles-wasm")!
    for (const f of files) expect(of(f)).toEqual([wasm])
    expect(wasm.options.expiration.maxEntries).toBeGreaterThanOrEqual(files.length)
    expect(of("/assets/draco_decoder-x.js")).toEqual([])
    expect(of("/textures/a.wasm")).toEqual([])
  })

  it("cada `urlPattern` es pot copiar sol al service worker (no fa servir res de fora)", () => {
    for (const c of WASM_RUNTIME_CACHING) {
      const copy = new Function(`return (${c.urlPattern.toString()})`)() as typeof c.urlPattern
      for (const f of files) expect(copy({ url: new URL(`https://x${f}`) })).toBe(c.urlPattern({ url: new URL(`https://x${f}`) }))
    }
  })
})
