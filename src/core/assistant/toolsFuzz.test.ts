import { describe, expect, it } from "vitest"
import { buildComposition } from "../build/buildComposition"
import { rng } from "../file/fuzz"
import { DEFAULT_SETTINGS, type Composition, type Zone } from "../model"
import { assistantTools, runAssistantTool, toolResultPayload } from "./tools"

/**
 * L'assistent (o una persona) demana coses estranyes però vàlides: mides petitíssimes o enormes, 20 zones, el mòdul que
 * acaba d'esborrar… Cada eina diu que no amb un motiu (mai «Error intern») i el moble que en surt es construeix sense
 * llançar. Seqüències de 25 eines a l'atzar sobre el mateix moble. Més casos o una altra llavor: FUZZ_N=400 FUZZ_SEED=7.
 */
const N = Number(process.env.FUZZ_N ?? 20)
const ctx = { settings: DEFAULT_SETTINGS }
type Schema = { type?: string | string[]; properties?: Record<string, Schema>; required?: string[]; enum?: unknown[]; const?: unknown; anyOf?: Schema[]; oneOf?: Schema[]; items?: Schema; minimum?: number; maximum?: number; exclusiveMinimum?: number; minItems?: number; maxItems?: number }

const MATERIALS = [...DEFAULT_SETTINGS.materials.map((m) => m.name), "same"]
const zones = (z: Zone): string[] => [z.id, ...(z.split?.children.flatMap(zones) ?? [])]

function value(s: Schema, key: string, comp: Composition, rand: () => number): unknown {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
  if (key === "module" || key === "after") return comp.modules.length && rand() < 0.9 ? pick(comp.modules).id : "no-hi-és"
  if (key === "zone") return comp.modules.length && rand() < 0.9 ? pick(comp.modules.flatMap((m) => zones(m.root))) : "no-hi-és"
  if ((key === "body" || key === "fronts" || key === "back") && rand() < 0.8) return pick(MATERIALS)
  if (s.const !== undefined) return s.const
  if (s.enum) return pick(s.enum)
  const alts = s.anyOf ?? s.oneOf
  if (alts) return value(pick(alts), key, comp, rand)
  const type = Array.isArray(s.type) ? pick(s.type) : s.type
  switch (type) {
    case "number":
    case "integer": {
      const lo = s.minimum ?? s.exclusiveMinimum ?? 0, hi = Math.min(s.maximum ?? 5000, 5000)
      const v = pick([lo, hi, lo + 1, hi - 1, lo + rand() * (hi - lo)])
      return type === "integer" ? Math.round(v) : Math.round(v * 10) / 10
    }
    case "boolean":
      return rand() < 0.5
    case "string":
      return pick(["Armari", "", "x", "Melamina blanca 19", "auto"])
    case "array":
      return Array.from({ length: Math.min(s.maxItems ?? 4, (s.minItems ?? 0) + Math.floor(rand() * 4)) }, () => value(s.items ?? {}, "", comp, rand))
    case "object":
      return object(s, comp, rand)
    default:
      return null
  }
}

function object(s: Schema, comp: Composition, rand: () => number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, p] of Object.entries(s.properties ?? {})) if (s.required?.includes(k) || rand() < 0.5) out[k] = value(p, k, comp, rand)
  return out
}

describe("assistent IA: eines a l'atzar", () => {
  it(`${N} seqüències de 25 eines: cap error intern i el moble sempre es construeix`, () => {
    const tools = assistantTools()
    const rand = rng(Number(process.env.FUZZ_SEED ?? 20261023))
    const failures: string[] = []
    for (let i = 0; i < N && failures.length < 10; i++) {
      let comp: Composition = { kind: "moble", modules: [], references: [] }
      for (let k = 0; k < 25; k++) {
        // Al principi, sobretot afegir mòduls (sense mòduls, les altres eines no tenen on fer res).
        const tool = k < 2 || rand() < 0.15 ? tools.find((t) => t.name === "add_module")! : tools[Math.floor(rand() * tools.length)]!
        const input = object(tool.input_schema as Schema, comp, rand)
        const before = comp
        try {
          const r = runAssistantTool(comp, tool.name, input, ctx)
          if (!r.ok) {
            if (r.error.startsWith("Error intern")) failures.push(`#${i}.${k} ${tool.name} ${JSON.stringify(input)}: ${r.error}`)
            continue
          }
          comp = r.comp
          buildComposition(comp)
          toolResultPayload(tool.name, before, r, ctx)
        } catch (e) {
          failures.push(`#${i}.${k} ${tool.name} ${JSON.stringify(input)}: ${(e as Error).message} ${(e as Error).stack?.split("\n")[1]?.trim() ?? ""}`)
          break
        }
      }
    }
    expect(failures).toEqual([])
  }, 600_000)
})
