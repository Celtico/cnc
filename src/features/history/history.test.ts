import { describe, expect, it } from "vitest"
import { canRedo, canUndo, commitHistory, initHistory, pushHistory, redoHistory, undoHistory, type History } from "./history"

const t0 = 10_000

describe("historial (desfer/refer)", () => {
  it("desfà i refà pas a pas; un canvi nou buida el refer", () => {
    let h = initHistory("a")
    expect(canUndo(h)).toBe(false)
    h = pushHistory(h, "b", t0)
    h = pushHistory(h, "c", t0 + 1000)
    expect(h.past).toEqual(["a", "b"])
    h = undoHistory(h)
    expect(h.present).toBe("b")
    expect(canRedo(h)).toBe(true)
    h = redoHistory(h)
    expect(h.present).toBe("c")
    h = undoHistory(undoHistory(h))
    expect(h.present).toBe("a")
    expect(undoHistory(h)).toBe(h)
    h = pushHistory(h, "x", t0 + 5000)
    expect(h.future).toEqual([])
    expect(h.past).toEqual(["a"])
    expect(redoHistory(h)).toBe(h)
  })

  it("un valor idèntic no fa cap pas", () => {
    const h = pushHistory(initHistory("a"), "b", t0)
    expect(pushHistory(h, "b", t0 + 1000)).toBe(h)
  })

  it("respecta el límit de passos", () => {
    let h: History<number> = initHistory(0)
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i, t0 + i * 1000, { limit: 3 })
    expect(h.past).toEqual([7, 8, 9])
    h = undoHistory(undoHistory(undoHistory(h)))
    expect(h.present).toBe(7)
    expect(canUndo(h)).toBe(false)
  })

  it("ajunta els canvis seguits per temps (editor de mobles: escriure «1180» és un pas)", () => {
    const opts = { coalesceMs: 500 }
    let h = initHistory("")
    h = pushHistory(h, "1", t0, opts)
    h = pushHistory(h, "11", t0 + 100, opts)
    h = pushHistory(h, "118", t0 + 200, opts)
    h = pushHistory(h, "1180", t0 + 300, opts)
    // El primer canvi fa pas; els que segueixen de pressa s'hi ajunten.
    expect(h.past).toEqual([""])
    expect(h.present).toBe("1180")
    h = pushHistory(h, "1180 mm", t0 + 2000, opts)
    expect(h.past).toEqual(["", "1180"])
    // Després de desfer, el canvi següent no s'ajunta (si no, es perdria el pas desfet).
    h = undoHistory(h)
    h = pushHistory(h, "x", t0 + 2100, opts)
    expect(h.past).toEqual(["", "1180"])
  })

  it("sense temps, només s'ajunten els canvis del mateix grup seguits", () => {
    let h = initHistory(0)
    h = pushHistory(h, 1, t0)
    h = pushHistory(h, 2, t0 + 100)
    expect(h.past).toEqual([0, 1])
    h = pushHistory(h, 3, t0 + 200, {}, { group: "x" })
    h = pushHistory(h, 4, t0 + 300, {}, { group: "x" })
    h = pushHistory(h, 5, t0 + 400, {}, { group: "y" })
    h = pushHistory(h, 6, t0 + 2000, {}, { group: "y" })
    expect(h.past).toEqual([0, 1, 2, 4, 5])
  })

  it("canvis en viu: un sol pas en deixar anar (arrossegar al plànol, el gizmo o un node)", () => {
    let h = initHistory("a")
    h = pushHistory(h, "a1", t0, {}, { commit: false })
    h = pushHistory(h, "a2", t0 + 10, {}, { commit: false })
    expect(h.present).toBe("a2")
    expect(canUndo(h)).toBe(false)
    h = commitHistory(h, t0 + 20)
    expect(h.past).toEqual(["a"])
    expect(commitHistory(h, t0 + 30)).toBe(h)
    // Un canvi amb pas després d'un en viu: el pas és des de l'últim desat.
    h = pushHistory(h, "b1", t0 + 40, {}, { commit: false })
    h = pushHistory(h, "b", t0 + 50)
    expect(h.past).toEqual(["a", "a2"])
    // Desfer amb canvis en viu sense pas: es descarten i es torna a l'anterior.
    h = pushHistory(h, "c-live", t0 + 60, {}, { commit: false })
    h = undoHistory(h)
    expect(h.present).toBe("a2")
    expect(h.future).toEqual(["b"])
  })
})
