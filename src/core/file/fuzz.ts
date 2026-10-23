/**
 * Dades malmeses a l'atzar per a les proves de solidesa (`*Fuzz.test.ts`): un camp esborrat, d'un altre tipus, buit,
 * negatiu, enorme… Llavor fixa: el mateix cada cop.
 */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WEIRD: unknown[] = [null, undefined, 0, -1, -500, 1e9, Number.NaN, "", "x", true, [], {}, [1, 2], { a: 1 }, 0.0001, 99999]

type Path = (string | number)[]

/** Tots els camins (objectes i llistes) del JSON. */
function paths(v: unknown, at: Path = [], out: Path[] = []): Path[] {
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = [...at, Array.isArray(v) ? Number(k) : k]
      out.push(p)
      paths(x, p, out)
    }
  }
  return out
}

/** Una còpia amb 1–3 canvis dolents als camins que comencen per `under`. */
export function mutate<T>(root: T, rand: () => number, under: Path = []): T {
  const copy = structuredClone(root)
  const all = paths(copy).filter((p) => under.every((k, i) => p[i] === k))
  const n = 1 + Math.floor(rand() * 3)
  for (let i = 0; i < n && all.length; i++) {
    const p = all[Math.floor(rand() * all.length)]!
    let parent: unknown = copy
    for (const k of p.slice(0, -1)) parent = (parent as Record<string | number, unknown> | undefined)?.[k]
    if (!parent || typeof parent !== "object") continue
    const key = p.at(-1)!
    const obj = parent as Record<string | number, unknown>
    const r = rand()
    if (r < 0.3) {
      if (Array.isArray(obj)) obj.splice(Number(key), 1)
      else delete obj[key]
    } else if (r < 0.5 && typeof obj[key] === "number") obj[key] = (obj[key] as number) * (rand() < 0.5 ? -1 : 50)
    else obj[key] = structuredClone(WEIRD[Math.floor(rand() * WEIRD.length)])
  }
  return copy
}
