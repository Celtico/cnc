import { describe, expect, it } from "vitest"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import { DEFAULT_SETTINGS, type Composition } from "../../core/model"
import { mobleToolSet } from "../../core/assistant/tools"
import { runTurn, type StreamClient } from "./chatTurn"
import { assistantError, maskKey } from "./errors"

/** Client fals (sense xarxa): cada crida a `stream` torna la resposta següent de la llista. */
function fakeClient(responses: { content: unknown[]; stop_reason: string }[], seen: unknown[] = []): StreamClient {
  let i = 0
  return {
    messages: {
      stream(params: unknown, opts?: { signal?: AbortSignal }) {
        seen.push(structuredClone(params))
        const r = responses[i++]!
        const listeners: ((t: string) => void)[] = []
        return {
          on(ev: string, fn: (t: string) => void) {
            if (ev === "text") listeners.push(fn)
            return this
          },
          async finalMessage() {
            if (opts?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "APIUserAbortError" })
            for (const b of r.content as { type: string; text?: string }[]) if (b.type === "text") listeners.forEach((fn) => fn(b.text!))
            return { id: `msg${i}`, type: "message", role: "assistant", model: "claude-sonnet-5-5", content: r.content, stop_reason: r.stop_reason, usage: {} }
          },
        }
      },
    } as unknown as StreamClient["messages"],
  }
}

describe("assistent IA: un torn amb eines (client fals, sense xarxa)", () => {
  it("executa les eines, torna els resultats en ordre i acaba amb el text", async () => {
    let comp: Composition = { kind: "moble", modules: [], references: [] }
    const applied: Composition[] = []
    const history: MessageParam[] = [{ role: "user", content: "Fes-me un mòdul de 600 × 720 × 560" }]
    const seen: unknown[] = []
    const client = fakeClient(
      [
        {
          stop_reason: "tool_use",
          content: [
            { type: "thinking", thinking: "", signature: "sig" },
            { type: "text", text: "Ara l'afegeixo." },
            { type: "tool_use", id: "t1", name: "add_module", input: { width: 600, height: 720, depth: 560 } },
            { type: "tool_use", id: "t2", name: "set_front", input: { module: "Mòdul 1", kind: "teleport" } },
          ],
        },
        { stop_reason: "end_turn", content: [{ type: "text", text: "Fet: un mòdul de 600 × 720 × 560." }] },
      ],
      seen,
    )
    const texts: string[] = []
    const tools: { name: string; ok: boolean }[] = []
    const res = await runTurn({
      client,
      model: "claude-sonnet-5-5",
      history,
      getDoc: () => comp,
      apply: (c: Composition) => {
        comp = c
        applied.push(c)
      },
      toolset: mobleToolSet({ settings: DEFAULT_SETTINGS }),
      onText: (t) => texts.push(t),
      onTool: (t) => tools.push(t),
    })
    expect(res).toEqual({ stop: "end", tools: 2 })
    expect(comp.modules).toHaveLength(1)
    expect(applied).toHaveLength(1)
    expect(tools).toEqual([expect.objectContaining({ name: "add_module", ok: true }), expect.objectContaining({ name: "set_front", ok: false })])
    expect(texts.join("")).toContain("Fet:")
    // L'historial: la resposta sencera (amb el pensament) i els resultats junts, primer de tot, amb is_error al que falla.
    expect(history.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"])
    expect((history[1]!.content as { type: string }[])[0]!.type).toBe("thinking")
    const results = history[2]!.content as { type: string; tool_use_id: string; is_error?: boolean; content: string }[]
    expect(results.map((r) => [r.type, r.tool_use_id, !!r.is_error])).toEqual([["tool_result", "t1", false], ["tool_result", "t2", true]])
    expect(JSON.parse(results[0]!.content).moble.modules[0].width).toBe(600)
    // Cada petició porta les eines i les instruccions (a la memòria cau).
    const first = seen[0] as { tools: unknown[]; system: { cache_control?: unknown }[]; max_tokens: number }
    expect(first.tools.length).toBeGreaterThan(10)
    expect(first.system[0]!.cache_control).toEqual({ type: "ephemeral" })
  })

  it("dins d'una tanda, cada eina parteix de la composició de l'anterior (React encara no ha tornat a pintar)", async () => {
    const start: Composition = { kind: "moble", modules: [], references: [] }
    let last = start
    await runTurn({
      client: fakeClient([
        {
          stop_reason: "tool_use",
          content: [
            { type: "tool_use", id: "a", name: "add_module", input: { name: "A", width: 600, height: 720, depth: 560 } },
            { type: "tool_use", id: "b", name: "set_module_size", input: { module: "A", width: 900 } },
          ],
        },
        { stop_reason: "end_turn", content: [{ type: "text", text: "Fet." }] },
      ]),
      model: "claude-sonnet-5-5",
      history: [{ role: "user", content: "Un mòdul A de 900" }],
      // Sempre la d'abans (com el ref de l'Editor abans de pintar).
      getDoc: () => start,
      apply: (c: Composition) => (last = c),
      toolset: mobleToolSet({ settings: DEFAULT_SETTINGS }),
      onText: () => {},
      onTool: () => {},
    })
    expect(last.modules.map((m) => [m.name, m.carcass.width])).toEqual([["A", 900]])
  })

  it("aturat: l'historial acaba amb una resposta de l'assistent", async () => {
    const ctl = new AbortController()
    ctl.abort()
    const history: MessageParam[] = [{ role: "user", content: "Hola" }]
    const res = await runTurn({
      client: fakeClient([{ stop_reason: "end_turn", content: [] }]),
      model: "claude-sonnet-5-5",
      history,
      getDoc: (): Composition => ({ modules: [], references: [] }),
      apply: () => {},
      toolset: mobleToolSet({ settings: DEFAULT_SETTINGS }),
      onText: () => {},
      onTool: () => {},
      signal: ctl.signal,
    })
    expect(res.stop).toBe("aborted")
    expect(history.at(-1)!.role).toBe("assistant")
  })
})

describe("assistent IA: errors i clau", () => {
  it("cada error del SDK té un missatge en català", () => {
    expect(assistantError({ status: 401 }).kind).toBe("auth")
    expect(assistantError({ status: 429 }).kind).toBe("rate")
    expect(assistantError({ status: 529 }).kind).toBe("overloaded")
    expect(assistantError({ status: 404 }).kind).toBe("not-found")
    expect(assistantError(Object.assign(new Error("x"), { name: "APIUserAbortError" })).kind).toBe("aborted")
    class APIConnectionError extends Error {}
    expect(assistantError(new APIConnectionError("Connection error.")).kind).toBe("offline")
    expect(assistantError({ status: 400, error: { error: { type: "invalid_request_error", message: "bad" } } }).description).toBe("bad")
    expect(assistantError(new Error("boom"), false).kind).toBe("offline")
  })

  it("de la clau només se'n veuen els 4 últims caràcters", () => {
    expect(maskKey("sk-ant-api03-very-secret-WXYZ")).toBe("•••• WXYZ")
    expect(maskKey(undefined)).toBe("")
  })
})
