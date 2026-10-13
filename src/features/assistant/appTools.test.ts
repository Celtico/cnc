import { describe, expect, it } from "vitest"
import type { AssistantToolSet } from "../../core/assistant/toolset"
import { appToolSet, contextLine, withAppTools } from "./appTools"
import { registerDoc, registerNav } from "./assistantHub"

const docSet: AssistantToolSet<unknown> = {
  system: "DOC",
  tools: [{ name: "doc_tool", description: "d", input_schema: { type: "object" } }],
  run: (doc) => ({ ok: true, doc: { changed: doc }, result: { done: true } }),
  payload: () => "payload",
  describe: () => "fet",
}

describe("assistent personal: eines de l'app", () => {
  it("sense document, només les de l'app; amb document, les dues i les instruccions juntes", () => {
    expect(withAppTools(undefined)).toBe(appToolSet)
    const both = withAppTools(docSet)
    expect(both.tools.map((t) => t.name)).toEqual([...appToolSet.tools.map((t) => t.name), "doc_tool"])
    expect(both.system).toContain(appToolSet.system)
    expect(both.system).toContain("DOC")
  })

  it("cada eina va al seu joc", async () => {
    const both = withAppTools(docSet)
    expect(await both.run(1, "doc_tool", {})).toEqual({ ok: true, doc: { changed: 1 }, result: { done: true } })
    const r = await both.run(1, "get_app", {})
    expect(r.ok && r.doc).toBe(1)
  })

  it("el context diu on és l'usuari, el document obert i la selecció", () => {
    const offNav = registerNav({ where: () => ({ section: "mobles", page: "editor" }), openMoble: () => {}, openAmbient: () => {}, goTo: () => true })
    const target = { toolset: async () => docSet, getDoc: () => null, apply: () => {}, commit: () => {}, intro: "", suggestions: [] }
    const offDoc = registerDoc({ key: "moble:7", kind: "moble", id: 7, name: "Calaixera", target, selection: () => "mòdul «Baix» (module: m1)" })
    const line = contextLine()
    expect(line).toContain("apartat mobles, pàgina editor")
    expect(line).toContain("moble obert «Calaixera» (id 7)")
    expect(line).toContain("seleccionat: mòdul «Baix» (module: m1)")
    offDoc()
    expect(contextLine()).toContain("cap document obert")
    offNav()
  })
})
