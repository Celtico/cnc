import { describe, expect, it } from "vitest"
import { defaultModule } from "../model"
import { buildModule } from "../build/buildModule"
import { panelProcesses } from "./processes"
import { labelSheetHtml } from "./labels"

describe("post-processos i etiquetes", () => {
  it("inglet, cantell, forats de cantell i encolar, en ordre", () => {
    const mitre = buildModule(defaultModule("m", "M", { joint: "mitre" })).panels.find((p) => p.role === "top")!
    expect(panelProcesses(mitre).map((p) => p.kind)).toEqual(["mitre", "edge"])
    const hollow = buildModule(defaultModule("m", "M", { hollow: { thickness: 60 } })).panels
    const facing = hollow.find((p) => p.id === "side-left-facing")!
    expect(panelProcesses(facing).at(-1)).toEqual({ kind: "glue", label: "Encolar", detail: "Lateral esquerre (paret buida)" })
    const plain = buildModule(defaultModule("m", "M")).panels.find((p) => p.role === "bottom")!
    expect(panelProcesses(plain).map((p) => p.kind)).toContain("edgeDrill")
  })
  it("full d'etiquetes: una per peça i una de procés per a les que en tenen", () => {
    const panels = buildModule(defaultModule("m", "M", { joint: "mitre" })).panels
    const html = labelSheetHtml(panels, null, { project: "Prova", w: 99, h: 68 })
    const n = (html.match(/<section class="l"/g) ?? []).length
    const proc = (html.match(/<section class="l proc"/g) ?? []).length
    expect(n).toBe(panels.length)
    expect(proc).toBe(panels.filter((p) => panelProcesses(p).length).length)
    expect(html).toContain("@page { size: 99mm 68mm")
  })
})
