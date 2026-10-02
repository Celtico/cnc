import { describe, expect, it } from "vitest"
import { cpuThreads } from "./cpuEngine"
import { aces, createDrawScheduler, makeSrgbLut, srgb, srgbLut, agx, agxCurve, bloomBuffer, makeAgxLut, makePowLut, sampleBloom, vignette } from "./tonemap"

describe("srgbLut", () => {
  const lut = makeSrgbLut()
  it("dona el mateix que la corba exacta (menys de mig nivell de 8 bits)", () => {
    for (let i = 0; i <= 10000; i++) {
      const c = i / 10000
      expect(Math.abs(srgbLut(lut, c) - srgb(c)) * 255).toBeLessThan(0.5)
    }
  })
  it("retalla fora de [0, 1] i amb NaN dona 0", () => {
    expect(srgbLut(lut, -1)).toBe(0)
    expect(srgbLut(lut, 2)).toBeCloseTo(1, 6)
    expect(srgbLut(lut, NaN)).toBe(0)
  })
  it("ACES queda a [0, 1] i és creixent", () => {
    let prev = -1
    for (let v = 0; v < 50; v += 0.25) {
      const a = aces(v, 1)
      expect(a).toBeGreaterThanOrEqual(prev)
      expect(a).toBeLessThanOrEqual(1)
      prev = a
    }
  })
})

describe("createDrawScheduler", () => {
  function fake() {
    let t = 0
    const rafs: (() => void)[] = []
    const timers: { at: number; cb: () => void }[] = []
    return {
      env: {
        raf: (cb: () => void) => rafs.push(cb),
        timeout: (cb: () => void, ms: number) => timers.push({ at: t + ms, cb }),
        now: () => t,
      },
      advance(ms: number) {
        t += ms
        const due = timers.filter((x) => x.at <= t)
        timers.splice(0, timers.length, ...timers.filter((x) => x.at > t))
        for (const x of due) x.cb()
      },
      frame() {
        for (const cb of rafs.splice(0)) cb()
      },
      tick(ms: number) {
        t += ms
      },
    }
  }
  it("agrupa les peticions d'un fotograma en un sol dibuix", () => {
    const f = fake()
    let n = 0
    const s = createDrawScheduler(() => n++, f.env)
    s.request()
    s.request()
    s.request()
    f.frame()
    expect(n).toBe(1)
  })
  it("si dibuixar costa, espera el doble del cost abans del següent", () => {
    const f = fake()
    let n = 0
    const s = createDrawScheduler(() => {
      n++
      f.tick(100)
    }, f.env)
    s.request()
    f.frame()
    expect(n).toBe(1)
    s.request()
    f.frame()
    expect(n).toBe(1) // encara no: espera 200 ms
    f.advance(150)
    f.frame()
    expect(n).toBe(1)
    f.advance(60)
    f.frame()
    expect(n).toBe(2)
  })
  it("després de cancel·lar no dibuixa", () => {
    const f = fake()
    let n = 0
    const s = createDrawScheduler(() => n++, f.env)
    s.request()
    s.cancel()
    f.frame()
    expect(n).toBe(0)
  })
})

describe("cpuThreads", () => {
  it("un per nucli menys un, com a molt 8 (2 amb poca memòria)", () => {
    expect(cpuThreads(100, 100, 12, false)).toBe(8)
    expect(cpuThreads(100, 100, 4, false)).toBe(3)
    expect(cpuThreads(100, 100, 12, true)).toBe(2)
    expect(cpuThreads(100, 100, 1, false)).toBe(1)
  })
  it("les imatges grans van amb menys fils (pressupost de memòria)", () => {
    const budget = 1536 * 2 ** 20
    // 3600 × 2400 × 40 B ≈ 330 MiB per worker → 4.
    expect(cpuThreads(3600, 2400, 16, false, budget)).toBe(4)
    expect(cpuThreads(1000, 667, 16, false, budget)).toBe(8)
    expect(cpuThreads(20000, 20000, 16, false, budget)).toBe(1)
  })
})

describe("AgX, vinyeta i resplendor", () => {
  const curve = makeAgxLut(), pow = makePowLut()
  const tone = (v: number) => {
    const o = [0, 0, 0]
    agx(curve, pow, v, v, v, o)
    return o
  }
  it("AgX: negre a negre, creixent, blanc suau i grisos neutres", () => {
    expect(tone(0)[0]).toBeLessThan(0.001)
    let prev = -1
    for (const v of [0.001, 0.01, 0.05, 0.18, 0.5, 1, 2, 4, 8, 16]) {
      const o = tone(v)
      expect(o[0]).toBeGreaterThan(prev)
      expect(Math.abs(o[0]! - o[1]!)).toBeLessThan(0.01)
      expect(Math.abs(o[0]! - o[2]!)).toBeLessThan(0.01)
      prev = o[0]!
    }
    // El gris mitjà queda a mig to (lineal de pantalla 0,1–0,3) i 16 gairebé blanc.
    expect(tone(0.18)[0]).toBeGreaterThan(0.1)
    expect(tone(0.18)[0]).toBeLessThan(0.3)
    expect(tone(16)[0]).toBeGreaterThan(0.9)
    expect(tone(1e6)[0]).toBeLessThanOrEqual(1)
  })
  it("la taula d'AgX és com la corba exacta", () => {
    for (const x of [0.003, 0.05, 0.3, 1.7, 9]) {
      const u = Math.sqrt(x / Math.pow(2, 4.026069))
      const n = curve.length - 1, i = Math.floor(u * n), f = u * n - i
      expect(curve[i]! + (curve[i + 1]! - curve[i]!) * f).toBeCloseTo(agxCurve(x), 2)
    }
  })
  it("vinyeta: 1 al centre, més fosc a les vores", () => {
    expect(vignette(0, 0.5)).toBe(1)
    expect(vignette(1, 0)).toBe(1)
    expect(vignette(1, 0.25)).toBeLessThan(0.7)
    expect(vignette(1, 0.25)).toBeGreaterThan(0.5)
  })
  it("resplendor: només el que passa del llindar, i s'escampa", () => {
    const w = 64, h = 32
    const img = new Float32Array(w * h * 3).fill(0.5)
    const c = (32 + 16 * w) * 3
    img[c] = img[c + 1] = img[c + 2] = 100
    const B = bloomBuffer(w, h, (i, k) => img[i * 3 + k]!, 1.5)
    const o = [0, 0, 0]
    sampleBloom(B, 32, 16, o)
    expect(o[0]).toBeGreaterThan(0.5)
    sampleBloom(B, 40, 16, o)
    expect(o[0]).toBeGreaterThan(0)
    sampleBloom(B, 2, 2, o)
    expect(o[0]).toBeLessThan(1e-3)
  })
})
