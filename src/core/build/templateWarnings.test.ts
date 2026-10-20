import { describe, expect, it } from "vitest"
import { buildComposition } from "./buildComposition"
import { catalogCorpus } from "./testCorpus"

/**
 * Les plantilles de l'app (catàleg, col·leccions, revista) surten **netes** (per decisió de l'usuari, 2026-10-15: «fem-ho
 * tot el més estàndard possible»): cap avís que vingui dels valors per defecte de l'app (penjadors, fons dels penjats,
 * electrodomèstics…). Només queden les notes de les construccions que la plantilla ensenya a propòsit i el moble real de
 * casa (`tv-living-room`, amb les mides del menjador: portes de més de 600).
 */
const DEMO = new Set(["mitre", "push", "hollow", "table", "inset", "material-heat", "glass-drawers"])
const REAL: Record<string, string[]> = { "tv-living-room": ["door-too-wide"] }

describe("avisos de les plantilles", () => {
  it("cap plantilla avisa pels valors per defecte", () => {
    const bad: string[] = []
    for (const t of catalogCorpus()) {
      for (const w of buildComposition(t.make()).warnings) {
        const code = w.code ?? ""
        if (!DEMO.has(code) && !(REAL[t.id] ?? []).includes(code)) bad.push(`${t.id}: [${code}] ${w.message}`)
      }
    }
    expect(bad).toEqual([])
  })
})
