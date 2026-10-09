import type Anthropic from "@anthropic-ai/sdk"
import type { ContentBlockParam, Message, MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages"
import type { AssistantToolSet } from "../../core/assistant/toolset"

/**
 * Un torn de l'assistent (docs/xat-ia.md): envia la conversa, escriu el text a mesura que arriba (streaming) i executa
 * les eines que demana el model (`tool_use` → `tool_result`) fins que acaba. Serveix per a qualsevol document (moble,
 * objecte, ambient): les eines i les instruccions són les del seu joc (`AssistantToolSet`). Els canvis van al document
 * amb `apply` (l'editor els posa a l'historial en viu, `commit: false`, i en fa **un sol pas** de desfer en acabar el
 * torn). Sense React; el client s'hi passa (els tests en fan servir un de fals, sense xarxa).
 */

/** El que el torn necessita del client de l'API (`client.messages.stream`). */
export type StreamClient = Pick<Anthropic, "messages">

export interface TurnCallbacks {
  /** Text nou de l'assistent (delta). `round` comença a 0 i puja a cada volta després d'unes eines. */
  onText: (delta: string, round: number) => void
  /** Una eina feta: nom, si ha anat bé i una línia per a la UI. */
  onTool: (t: { name: string; ok: boolean; note: string }) => void
}

export interface TurnOptions<D> extends TurnCallbacks {
  client: StreamClient
  model: string
  /** Historial de l'API (es modifica: s'hi afegeixen les respostes i els resultats de les eines). */
  history: MessageParam[]
  /** Les eines i les instruccions del tipus de document. */
  toolset: AssistantToolSet<D>
  /** El document d'ara (el de l'editor, amb els canvis d'aquest torn). */
  getDoc: () => D
  /** Aplica un canvi (en viu: el pas de desfer es fa en acabar el torn). */
  apply: (next: D) => void
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

export async function runTurn<D>(o: TurnOptions<D>): Promise<TurnResult> {
  const tools = o.toolset.tools
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
          system: [{ type: "text", text: o.toolset.system, cache_control: { type: "ephemeral" } }],
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
    // El document d'ara (amb els canvis de l'usuari mentre esperava) i, dins de la tanda, el de l'eina anterior: React
    // encara no ha tornat a pintar i `getDoc` donaria el d'abans.
    let working = o.getDoc()
    const results: ToolResultBlockParam[] = []
    for (const block of final.content) {
      if (block.type !== "tool_use") continue
      used++
      const before = working
      let outcome: Awaited<ReturnType<AssistantToolSet<D>["run"]>>
      try {
        outcome = await o.toolset.run(before, block.name, block.input)
      } catch (e) {
        outcome = { ok: false, error: `Error intern a ${block.name}: ${e instanceof Error ? e.message : String(e)}` }
      }
      if (outcome.ok) {
        working = outcome.doc
        if (outcome.doc !== before) o.apply(outcome.doc)
        const payload = await o.toolset.payload(block.name, before, outcome)
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(payload) })
        o.onTool({ name: block.name, ok: true, note: o.toolset.describe(block.name, outcome.result, payload) })
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
