import { z } from "zod"
import { CompositionSchema, ModuleSchema, WorktopCutoutSchema, defaultModule, newId, type Composition, type Module } from "./composition"
import { repairValue, type RepairIssue } from "./repair"

/**
 * Reparació d'una composició desada (Dexie o `.moble`) que no passa `CompositionSchema`: **element a element**.
 * Un objecte de referència, una peça lliure, un model 3D o un taulell malmès es treu sol; d'un mòdul només es
 * canvien els camps dolents (valor per defecte del mòdul bàsic o treure'ls si són opcionals). La resta queda
 * igual. Abans, un sol valor dolent feia que el moble s'obrís com una caixa per defecte i la primera edició
 * desava a sobre de les dades de debò.
 */

export interface CompositionRepair {
  /** Composició vàlida, o `null` si no s'ha pogut reparar (no és un objecte o encara falla). */
  composition: Composition | null
  /** Què s'ha tret o restaurat (en català, per a un avís). Buit si ja era vàlida. */
  problems: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const LABELS: Record<string, string> = {
  kind: "Tipus de moble",
  modules: "Mòdul",
  references: "Objecte de referència",
  runs: "Taulell o sòcol",
  parts: "Peça lliure",
  models: "Model 3D",
  joinery: "Encaixos",
  scene: "Acabats de l'escena",
  camera: "Càmera",
  hardwarePlacements: "Ferratge col·locat",
}

/** Nom llegible d'un element per a l'avís: «Mòdul «Baix»», «Peça lliure «Tauler» (2)»… */
function describe(raw: Record<string, unknown>, path: string): string {
  const m = /^(\w+)(?:\[(\d+)\])?(.*)$/.exec(path)
  if (!m) return path || "Composició"
  const [, key, index, rest] = m
  const label = LABELS[key!] ?? key!
  const list = index !== undefined && Array.isArray(raw[key!]) ? (raw[key!] as unknown[])[Number(index)] : undefined
  const name = isRecord(list) && typeof list.name === "string" && list.name ? ` «${list.name}»` : index !== undefined ? ` ${Number(index) + 1}` : ""
  const field = rest ? ` (${rest.replace(/^\./, "")})` : ""
  return `${label}${name}${field}`
}

/** Mòdul reparat camp a camp, amb els valors del mòdul bàsic on calgui. `undefined` si no és un objecte. */
function repairModule(raw: unknown, onIssue: RepairIssue, path: string): Module | undefined {
  const ok = ModuleSchema.safeParse(raw)
  if (ok.success) return ok.data
  if (!isRecord(raw)) return undefined
  const id = typeof raw.id === "string" ? raw.id : newId("m")
  const name = typeof raw.name === "string" ? raw.name : "Mòdul"
  const base = defaultModule(id, name)
  const rootId = isRecord(raw.root) && typeof raw.root.id === "string" ? raw.root.id : `${id}-root`
  const fallback: Module = { ...base, root: { id: rootId } }
  return repairValue(ModuleSchema, raw, fallback, onIssue, path)
}

/** Taulell amb els forats bons (un forat dolent no treu tot el taulell). */
function repairRun(raw: unknown, onIssue: RepairIssue, path: string): unknown {
  if (!isRecord(raw) || raw.kind !== "worktop" || !Array.isArray(raw.cutouts)) return raw
  return { ...raw, cutouts: repairValue(z.array(WorktopCutoutSchema), raw.cutouts, [], onIssue, `${path}.cutouts`) }
}

/**
 * Repara una composició desada. Si ja és vàlida, la retorna tal qual (sense problemes). Pur: no normalitza ni
 * migra (això és `normalizeComposition`).
 */
export function repairComposition(raw: unknown): CompositionRepair {
  const whole = CompositionSchema.safeParse(raw)
  if (whole.success) return { composition: whole.data, problems: [] }
  if (!isRecord(raw)) return { composition: null, problems: ["La composició no és un objecte."] }
  // Sense llista de mòduls no és una composició (és el nucli): no es repara.
  if (!Array.isArray(raw.modules)) return { composition: null, problems: ["Els mòduls no són una llista."] }
  const problems: string[] = []
  const onIssue: RepairIssue = (path, what) => problems.push(`${describe(raw, path)}: ${what}.`)
  const modules = raw.modules.flatMap((m, i) => {
    const r = repairModule(m, onIssue, `modules[${i}]`)
    if (!r) onIssue(`modules[${i}]`, "invàlid: descartat")
    return r ? [r] : []
  })
  const runs = Array.isArray(raw.runs) ? raw.runs.map((r, i) => repairRun(r, onIssue, `runs[${i}]`)) : raw.runs
  const fallback: Composition = { modules, references: [] }
  const out = repairValue(CompositionSchema, { ...raw, modules, runs }, fallback, onIssue, "")
  const res = CompositionSchema.safeParse(out)
  if (!res.success) return { composition: null, problems: [...problems, res.error.issues[0]?.message ?? "invàlida"] }
  return { composition: res.data, problems: [...new Set(problems)] }
}
