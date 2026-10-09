import type Anthropic from "@anthropic-ai/sdk"
import type { ContentBlockParam, Message, MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages"
import { ASSISTANT_SYSTEM_PROMPT } from "../../core/assistant/prompt"
import { assistantTools, runAssistantTool, toolResultPayload, type ToolContext } from "../../core/assistant/tools"
import type { Composition } from "../../core/model"

/**
 * Un torn de l'assistent (docs/xat-ia.md): envia la conversa, escriu el text a mesura que arriba (streaming) i executa
 * les eines que demana el model (`tool_use` → `tool_result`) fins que acaba. Els canvis van a la composició amb
 * `apply` (l'Editor els posa a l'historial en viu, `commit: false`, i en fa **un sol pas** de desfer en acabar el torn).
 * Sense React; el client s'hi passa (els tests en fan servir un de fals, sense xarxa).
 */

/** El que el torn necessita del client de l'API (`client.messages.stream`). */
export type StreamClient = Pick<Anthropic, "messages">

export interface TurnCallbacks {
  /** Text nou de l'assistent (delta). `round` comença a 0 i puja a cada volta després d'unes eines. */
  onText: (delta: string, round: number) => void
  /** Una eina feta: nom, si ha anat bé i una línia per a la UI. */
  onTool: (t: { name: string; ok: boolean; note: string }) => void
}

export interface TurnOptions extends TurnCallbacks {
  client: StreamClient
  model: string
  /** Historial de l'API (es modifica: s'hi afegeixen les respostes i els resultats de les eines). */
  history: MessageParam[]
  /** La composició d'ara (la de l'Editor, amb els canvis d'aquest torn). */
  getComp: () => Composition
  /** Aplica un canvi (en viu: el pas de desfer es fa en acabar el torn). */
  apply: (next: Composition) => void
  ctx: ToolContext
  signal?: AbortSignal
  /** Voltes d'eines com a molt (un encàrrec gran en fa unes quantes). */
  maxRounds?: number
}

export interface TurnResult {
  /** Per què ha acabat. */
  stop: "end" | "max_tokens" | "rounds" | "refusal" | "aborted"
  /** Eines executades (bé o malament). */
  tools: number
}

export const MAX_TOKENS = 16000


export async function runTurn(o: TurnOptions): Promise<TurnResult> {
  const tools = assistantTools()
  let used = 0
  const maxRounds = o.maxRounds ?? 24
  for (let round = 0; round < maxRounds; round++) {
    if (o.signal?.aborted) return closeAborted(o.history, used)
    let final: Message
    try {
      const stream = o.client.messages.stream(
        {
          model: o.model,
          max_tokens: MAX_TOKENS,
          // Les eines i les instruccions són iguals a cada volta: a la memòria cau de l'API (més barat).
          system: [{ type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools,
          messages: o.history,
        },
        { signal: o.signal },
      )
      stream.on("text", (delta) => o.onText(delta, round))
      final = await stream.finalMessage()
    } catch (e) {
      if (o.signal?.aborted) return closeAborted(o.history, used)
      throw e
    }
    o.history.push({ role: "assistant", content: final.content as ContentBlockParam[] })
    if (final.stop_reason !== "tool_use") {
      return { stop: final.stop_reason === "max_tokens" ? "max_tokens" : final.stop_reason === "refusal" ? "refusal" : "end", tools: used }
    }
    // Totes les eines d'aquesta resposta, en ordre, i els resultats junts en un sol missatge (primer de tot).
    // La composició d'ara (amb els canvis de l'usuari mentre esperava) i, dins de la tanda, la de l'eina anterior: React
    // encara no ha tornat a pintar i `getComp` donaria la d'abans.
    let working = o.getComp()
    const results: ToolResultBlockParam[] = []
    for (const block of final.content) {
      if (block.type !== "tool_use") continue
      used++
      const before = working
      const outcome = runAssistantTool(before, block.name, block.input, o.ctx)
      if (outcome.ok) {
        working = outcome.comp
        if (outcome.comp !== before) o.apply(outcome.comp)
        const payload = toolResultPayload(block.name, before, outcome, o.ctx)
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(payload) })
        const fresh = payload.new_warnings?.length ? ` · ${payload.new_warnings.length} avís${payload.new_warnings.length === 1 ? "" : "os"} nou${payload.new_warnings.length === 1 ? "" : "s"}` : ""
        o.onTool({ name: block.name, ok: true, note: `${describeDone(block.name, outcome.result)}${fresh}` })
      } else {
        results.push({ type: "tool_result", tool_use_id: block.id, content: outcome.error, is_error: true })
        o.onTool({ name: block.name, ok: false, note: outcome.error })
      }
    }
    o.history.push({ role: "user", content: results })
  }
  return { stop: "rounds", tools: used }
}

/**
 * Aturat: l'historial ha d'acabar amb una resposta de l'assistent (si no, el missatge següent de l'usuari quedaria
 * enganxat a un `tool_result` o a una pregunta sense resposta).
 */
function closeAborted(history: MessageParam[], tools: number): TurnResult {
  const last = history.at(-1)
  if (last?.role === "user") history.push({ role: "assistant", content: [{ type: "text", text: "(Aturat per l'usuari.)" }] })
  return { stop: "aborted", tools }
}

/** Què ha fet una eina, en una frase curta (UI del xat). */
export function describeDone(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case "get_moble":
      return "Ha mirat el moble"
    case "add_module":
      return `Mòdul afegit: ${String(result.name ?? "")}`
    case "remove_module":
      return `Mòdul eliminat: ${String(result.removed ?? "")}`
    case "rename_module":
      return `Nom: ${String(result.name ?? "")}`
    case "set_module_size":
      return `Mides: ${String(result.width)} × ${String(result.height)} × ${String(result.depth)} mm`
    case "set_module_position":
      return "Posició del mòdul"
    case "set_carcass":
      return "Caixa del mòdul"
    case "split_zone":
      return `Dividit en ${Array.isArray(result.children) ? result.children.length : "?"} zones`
    case "unsplit_zone":
      return "Divisió treta"
    case "set_zone_size":
      return `Mida de zona: ${String(result.size)}${typeof result.size === "number" ? " mm" : ""}`
    case "set_front":
      return `Front: ${FRONT_NAMES[String(result.front)] ?? String(result.front)}`
    case "set_shelves": {
      const s = result.shelves as { n?: number } | undefined
      return `Prestatges: ${s?.n ?? "?"}`
    }
    case "set_material":
      return "Materials"
    default:
      return name
  }
}

const FRONT_NAMES: Record<string, string> = { none: "obert", door: "porta", drawers: "calaixos", flap: "abatible", grille: "reixeta", panel: "front fix" }
