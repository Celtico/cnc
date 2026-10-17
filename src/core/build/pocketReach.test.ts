import { describe, expect, it } from "vitest"
import type { Machine, Panel } from "../model"
import { pocketReachIssues } from "./pocketReach"

const machine = { name: "SCM", tools: [{ code: "E219", name: "D14", kind: "router", diameter: 14, maxDepth: 35, mounted: true, auto: true }] } as unknown as Machine
const panel = (depth: number) => ({ id: "part:p", label: "Peça 1", pockets: [{ points: [[0, 0], [100, 0], [100, 50], [0, 50]], depth, face: "A", round: 20 }] }) as unknown as Panel

describe("buidats que cap fresa no fa (per decisió de l'usuari, 2026-10-17)", () => {
  it("més fons que la fresa més llarga: avís amb quant s'ha de pujar", () => {
    const w = pocketReachIssues([panel(48)], machine)
    expect(w).toHaveLength(1)
    expect(w[0]!.code).toBe("pocket-reach")
    expect(w[0]!.message).toContain("48 mm")
    expect(w[0]!.options![0]!.text).toContain("13 mm")
  })
  it("si hi arriba, o sense màquina, res", () => {
    expect(pocketReachIssues([panel(30)], machine)).toEqual([])
    expect(pocketReachIssues([panel(48)], undefined)).toEqual([])
  })
})
