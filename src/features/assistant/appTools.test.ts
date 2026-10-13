import { describe, expect, it } from "vitest"
import type { AssistantToolSet } from "../../core/assistant/toolset"
import { DEFAULT_SETTINGS } from "../../core/model"
import { appToolSet, contextLine, dbSafe, getAt, setAppSettings, setAt, withAppTools } from "./appTools"
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

describe("assistent personal: totes les eines de l'app", () => {
  it("hi són les de documents, peces, nesting, exportar i preferències", () => {
    const names = appToolSet.tools.map((t) => t.name)
    for (const n of ["rename_document", "duplicate_document", "move_to_group", "delete_document", "get_cutlist", "get_nesting", "set_sheet", "export_files", "get_settings", "set_pref_material", "set_pref_defaults", "set_pref_gaps", "set_default_machine", "list_hardware", "set_hardware_default", "set_front_hardware", "get_hardware", "edit_hardware", "db_tables", "db_read", "db_write"]) expect(names).toContain(n)
  })
  it("esborrar demana confirmació; sense document obert, peces i nesting ho diuen", async () => {
    const del = await appToolSet.run(null, "delete_document", { kind: "moble", id: 1, confirmed: false })
    expect(del.ok).toBe(false)
    const cut = await appToolSet.run(null, "get_cutlist", {})
    expect(cut.ok === false && cut.error).toMatch(/moble obert/)
  })
})

describe("assistent personal: ferratges i materials", () => {
  it("llegeix els números d'un ferratge i no deixa editar els de l'app sense duplicar-los ni fora dels límits", async () => {
    setAppSettings(DEFAULT_SETTINGS)
    const hinge = DEFAULT_SETTINGS.hardwareLibrary.find((h) => h.engine === "cup" && h.builtin)!
    const got = await appToolSet.run(null, "get_hardware", { hardware: hinge.id })
    expect(got.ok).toBe(true)
    const params = (got.ok ? got.result.params : []) as { key: string; min: number; max: number }[]
    expect(params.length).toBeGreaterThan(0)
    const edit = await appToolSet.run(null, "edit_hardware", { hardware: hinge.id, params: { [params[0]!.key]: params[0]!.min } })
    expect(edit.ok === false && edit.error).toMatch(/duplicate/)
    const out = await appToolSet.run(null, "edit_hardware", { hardware: hinge.id, duplicate: true, params: { [params[0]!.key]: params[0]!.max + 1000 } })
    expect(out.ok).toBe(false)
    const bad = await appToolSet.run(null, "edit_hardware", { hardware: hinge.id, duplicate: true, params: { inventat: 3 } })
    expect(bad.ok === false && bad.error).toMatch(/no és un paràmetre/)
  })
  it("el color no es canvia a la fusta ni la rugositat a la pedra; una foto no es posa des del xat", async () => {
    setAppSettings(DEFAULT_SETTINGS)
    const wood = DEFAULT_SETTINGS.materials.find((m) => m.finish.kind === "wood")!
    const r = await appToolSet.run(null, "set_pref_material", { name: wood.name, color: "#112233" })
    expect(r.ok === false && r.error).toMatch(/fusta/)
    const stone = DEFAULT_SETTINGS.materials.find((m) => m.finish.kind === "stone")!
    const s2 = await appToolSet.run(null, "set_pref_material", { name: stone.name, roughness: 0.2 })
    expect(s2.ok === false && s2.error).toMatch(/rugositat/)
    const dup = await appToolSet.run(null, "set_pref_material", { name: wood.name, rename: DEFAULT_SETTINGS.materials.find((m) => m !== wood)!.name })
    expect(dup.ok === false && dup.error).toMatch(/Ja hi ha/)
  })
})

describe("assistent personal: base de dades", () => {
  it("no ensenya imatges, fitxers ni la clau de l'API", () => {
    const out = dbSafe({ assistant: { apiKey: "sk-secret", model: "x" }, photo: `data:image/jpeg;base64,${"A".repeat(5000)}`, blob: new Blob(["abc"]) }) as Record<string, any>
    expect(out.assistant).toEqual({ model: "x" })
    expect(out.photo).toMatch(/^\[binari/)
    expect(out.blob).toMatch(/^\[binari/)
  })
  it("camins amb punts i «#id» per llegir i canviar sense tocar l'original", () => {
    const row = { composition: { modules: [{ id: "m1", name: "A" }, { id: "m2", name: "B" }] } }
    const got = getAt(row, ["composition", "modules", "#m2", "name"])
    expect(got.ok && got.value).toBe("B")
    const next = setAt(row, ["composition", "modules", "#m2", "name"], "C") as typeof row
    expect(next.composition.modules[1]!.name).toBe("C")
    expect(row.composition.modules[1]!.name).toBe("B")
    const gone = setAt(row, ["composition", "modules", "0"], null) as typeof row
    expect(gone.composition.modules.map((m) => m.id)).toEqual(["m2"])
    expect(getAt(row, ["composition", "nope"]).ok).toBe(false)
  })
})
