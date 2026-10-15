import { beforeEach, describe, expect, it } from "vitest"
import { closeRender, openRender, publishRenderStatus, renderHostState, renderProgressText, renderStateText, resetRenderStore, resolvePendingRender } from "./renderStore"

const req = (saveKey: string) => ({ getScene: () => null, name: saveKey, saveKey })
const status = (saveKey: string, s: { begun?: boolean; running?: boolean; unsaved?: boolean }) => ({ saveKey, name: saveKey, begun: false, running: false, passes: 10, limit: 0, elapsed: 5, unsaved: false, minimized: false, ...s })

describe("renderStore", () => {
  beforeEach(resetRenderStore)

  it("el mateix document només el mostra", () => {
    openRender(req("a"))
    publishRenderStatus("a", status("a", { begun: true, running: true }))
    closeRender()
    const shown = renderHostState().shown
    openRender(req("a"))
    expect(renderHostState()).toMatchObject({ open: true, pending: null, shown: shown + 1 })
    expect(renderHostState().req?.saveKey).toBe("a")
  })

  it("un altre document sense res en marxa ni per desar: el nou, sense preguntar", () => {
    openRender(req("a"))
    publishRenderStatus("a", status("a", { begun: true, running: false, unsaved: false }))
    openRender(req("b"))
    expect(renderHostState().pending).toBeNull()
    expect(renderHostState().req?.saveKey).toBe("b")
  })

  it("un altre document mentre calcula o amb la imatge sense desar: es pregunta", () => {
    for (const s of [{ running: true }, { unsaved: true }]) {
      openRender(req("a"))
      publishRenderStatus("a", status("a", { begun: true, ...s }))
      openRender(req("b"))
      expect(renderHostState().req?.saveKey).toBe("a")
      expect(renderHostState().pending?.saveKey).toBe("b")
      resolvePendingRender("cancel")
      expect(renderHostState().pending).toBeNull()
      expect(renderHostState().req?.saveKey).toBe("a")
    }
  })

  it("continuar el que corre o aturar-lo i començar el nou", () => {
    openRender(req("a"))
    publishRenderStatus("a", status("a", { begun: true, running: true }))
    closeRender()
    openRender(req("b"))
    resolvePendingRender("keep")
    expect(renderHostState()).toMatchObject({ open: true, pending: null })
    expect(renderHostState().req?.saveKey).toBe("a")
    openRender(req("b"))
    resolvePendingRender("replace")
    expect(renderHostState().req?.saveKey).toBe("b")
    expect(renderHostState().pending).toBeNull()
  })

  it("en treure's, un panell no esborra l'estat d'un altre", () => {
    openRender(req("a"))
    publishRenderStatus("a", status("a", { begun: true, running: true }))
    publishRenderStatus("b", null)
    openRender(req("c"))
    expect(renderHostState().req?.saveKey).toBe("a")
    expect(renderHostState().pending?.saveKey).toBe("c")
  })

  it("textos del progrés", () => {
    expect(renderProgressText({ passes: 1, limit: 0, elapsed: 3 })).toBe("1 passada · 3 s")
    expect(renderProgressText({ passes: 12, limit: 256, elapsed: 34 })).toBe("12 / 256 passades · 34 s")
    expect(renderStateText({ begun: true, running: true, passes: 3, limit: 64 })).toBe("Calculant")
    expect(renderStateText({ begun: true, running: false, passes: 64, limit: 64 })).toBe("Acabat")
    expect(renderStateText({ begun: true, running: false, passes: 10, limit: 0 })).toBe("Aturat")
  })
})
