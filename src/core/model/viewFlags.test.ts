import { describe, expect, it } from "vitest"
import { keepLocked, mergeHidden, withFlag } from "./viewFlags"

describe("ull i cadenat", () => {
  it("withFlag posa i treu la marca sense deixar camps falsos", () => {
    expect(withFlag<{ id: string; hidden?: boolean }>({ id: "a" }, "hidden", true)).toEqual({ id: "a", hidden: true })
    expect(withFlag({ id: "a", hidden: true }, "hidden", false)).toEqual({ id: "a" })
  })
  it("un element bloquejat no es mou; un de lliure, sí", () => {
    const prev = [{ id: "a", x: 0, y: 0, locked: true }, { id: "b", x: 0, y: 0 }]
    const next = [{ id: "a", x: 10, y: 5, locked: true }, { id: "b", x: 10, y: 5 }]
    expect(keepLocked(prev, next, ["x", "y"])).toEqual([{ id: "a", x: 0, y: 0, locked: true }, { id: "b", x: 10, y: 5 }])
  })
  it("els amagats tornen al seu lloc; els nous al final; els trets, fora", () => {
    const all = [{ id: "a" }, { id: "h", hidden: true }, { id: "b" }]
    const shown = all.filter((x) => !x.hidden)
    const next = [{ id: "b", x: 1 }, { id: "c" }]
    expect(mergeHidden(all, shown, next)).toEqual([{ id: "h", hidden: true }, { id: "b", x: 1 }, { id: "c" }])
  })
})
