import { describe, expect, it } from "vitest"
import { undoKeyAction, type KeyEventLike } from "./undoKeys"

const key = (k: string, mods: Partial<KeyEventLike> = {}, target: unknown = { tagName: "BODY", closest: () => null }): KeyEventLike => ({
  key: k,
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...mods,
})
const noModal = { querySelector: () => null }
const modalOpen = { querySelector: (sel: string) => (sel.includes('aria-modal="true"') ? {} : null) }

describe("undoKeyAction", () => {
  it("desfà i refà amb les dreceres de sempre", () => {
    expect(undoKeyAction(key("z"), noModal)).toBe("undo")
    expect(undoKeyAction(key("Z", { shiftKey: true }), noModal)).toBe("redo")
    expect(undoKeyAction(key("y", { metaKey: false, ctrlKey: true }), noModal)).toBe("redo")
    expect(undoKeyAction(key("z", { metaKey: false }), noModal)).toBeNull()
    expect(undoKeyAction(key("z", { altKey: true }), noModal)).toBeNull()
  })

  it("deixa el desfer del navegador als camps de text, però no als numèrics", () => {
    expect(undoKeyAction(key("z", {}, { tagName: "INPUT", inputMode: "text" }), noModal)).toBeNull()
    expect(undoKeyAction(key("z", {}, { tagName: "TEXTAREA" }), noModal)).toBeNull()
    expect(undoKeyAction(key("z", {}, { tagName: "INPUT", inputMode: "decimal" }), noModal)).toBe("undo")
  })

  it("no desfà el moble del darrere amb l'editor de perfils (diàleg modal) obert", () => {
    // El focus pot quedar al body (clic al dibuix SVG): mana el diàleg obert.
    expect(undoKeyAction(key("z"), modalOpen)).toBeNull()
    // Tecla dins d'un diàleg (un camp numèric del radi, un botó).
    const inDialog = { tagName: "INPUT", inputMode: "decimal", closest: (s: string) => (s.includes("dialog") ? {} : null) }
    expect(undoKeyAction(key("z", {}, inDialog), noModal)).toBeNull()
  })
})
