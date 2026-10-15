import { z } from "zod"

/**
 * Peces comunes de les eines de l'assistent IA (docs/xat-ia.md), siguin del moble, de l'objecte o de l'ambient: la
 * definició per a l'API (JSON Schema de l'esquema zod), la validació de l'entrada i el **joc d'eines** d'un tipus de
 * document (`AssistantToolSet`), que és el que fan servir el bucle del torn (`chatTurn.ts`) i el xat (`ChatPanel.tsx`).
 */

/** Definició d'una eina per a l'API (`tools`). */
export interface ToolDef {
  name: string
  description: string
  input_schema: { type: "object"; [k: string]: unknown }
}

/** Resultat d'una eina: el document nou (o el mateix) i què ha fet; o l'error en català perquè el model es corregeixi. */
export type ToolRun<D> = { ok: true; doc: D; result: Record<string, unknown> } | { ok: false; error: string }

/**
 * Les eines d'un tipus de document. `run` mai llança (un error torna `{ ok: false }`); pot ser asíncrona (l'ambient crea
 * mobles a la base de dades). `payload` és el que llegeix el model després de l'eina (el resum del document d'ara).
 */
export interface AssistantToolSet<D> {
  /** Instruccions de sistema d'aquest tipus de document. */
  system: string
  tools: ToolDef[]
  run: (doc: D, name: string, input: unknown) => ToolRun<D> | Promise<ToolRun<D>>
  payload: (name: string, before: D, outcome: Extract<ToolRun<D>, { ok: true }>) => unknown
  /** Què ha fet una eina, en una frase curta per al xat. */
  describe: (name: string, result: Record<string, unknown>, payload: unknown) => string
}

export type ToolInputs = Record<string, z.ZodType>

/** Definicions per a l'API: nom, descripció i `input_schema` (JSON Schema d'entrada de l'esquema zod). */
export function toolDefs(inputs: ToolInputs): ToolDef[] {
  return Object.keys(inputs).map((name) => {
    const schema = inputs[name]!
    const { $schema: _s, description: _d, ...json } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>
    void _s
    void _d
    return { name, description: schema.description ?? name, input_schema: { ...json, type: "object" as const } }
  })
}

/** Entrada validada d'una eina o el missatge d'error (eina desconeguda o camps dolents). */
export function parseToolInput(inputs: ToolInputs, name: string, raw: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (!(name in inputs)) return { ok: false, error: `Eina desconeguda «${name}». Eines: ${Object.keys(inputs).join(", ")}.` }
  const parsed = inputs[name]!.safeParse(raw ?? {})
  if (!parsed.success) return { ok: false, error: `Entrada no vàlida per a ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ")}.` }
  return { ok: true, data: parsed.data }
}

/** Error d'una regla dins d'una eina (es converteix en `{ ok: false }`). */
class ToolError extends Error {}
export function fail(msg: string): never {
  throw new ToolError(msg)
}

/** L'error d'una eina com a `ToolRun` (els de regla, tal qual; els altres, «Error intern»). */
export function toolFailure(name: string, e: unknown): { ok: false; error: string } {
  if (e instanceof ToolError) return { ok: false, error: e.message }
  return { ok: false, error: `Error intern a ${name}: ${e instanceof Error ? e.message : String(e)}` }
}

/** Un número de mm arrodonit (els resums no porten decimals llargs). */
export const r1 = (v: number) => Math.round(v * 10) / 10
