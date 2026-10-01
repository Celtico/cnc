import { describe, expect, it } from "vitest"
import { cpuThreads } from "./cpuEngine"
import { aces, createDrawScheduler, makeSrgbLut, srgb, srgbLut } from "./tonemap"

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
