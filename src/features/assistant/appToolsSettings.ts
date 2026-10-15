import { MATERIAL_CATEGORIES, materialCategory, materialNameKey, MaterialPrefSchema, SettingsSchema, withCategory, type MaterialPref, type Settings } from "../../core/model"
import { renameMaterialInSettings, renameMaterialRefs, restoredFinish, switchFinish } from "../../core/model"
import type { ToolRun } from "../../core/assistant/toolset"
import { saveSettings } from "../../db/settingsStore"
import { renameMaterialEverywhere } from "../../db/materialRefs"
import { renamePresentationMaterial } from "../../components/viewer/presentationScene"
import { appSettings, fold, setAppSettings, type AppToolHandlers } from "./appToolContext"

/** Eines de l'app per a les preferències: llegir-les i canviar materials, valors per defecte, folgances i màquina. */

const NOT_READ = "Les preferències encara no s'han llegit."

/** Valida i desa les preferències noves (i, si s'ha reanomenat un material, els documents desats i l'obert el segueixen). */
async function saveChange(doc: unknown, next: Settings, result: Record<string, unknown>, renamed?: [string, string]): Promise<ToolRun<unknown>> {
  // Les mateixes regles que en desar des de Preferències (noms únics, mides…).
  const valid = SettingsSchema.safeParse(next)
  if (!valid.success) return { ok: false, error: `No es pot desar: ${valid.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}` }
  if (renamed) {
    // Com Preferències: els mobles, objectes i ambients desats el segueixen, en la mateixa transacció que les preferències.
    const [from, to] = renamed
    renamePresentationMaterial(from, to)
    let saved = false
    const c = await renameMaterialEverywhere([renamed], async () => (saved = await saveSettings(valid.data)))
    if (!saved) return { ok: false, error: "Les preferències són d'una versió més nova de l'app: només es poden llegir." }
    setAppSettings(valid.data)
    // El document obert també (si no, en desar-lo tornaria el nom d'abans).
    return { ok: true, doc: doc == null ? doc : renameMaterialRefs(doc, from, to), result: { ...result, updated: { mobles: c.projects, ambients: c.ambients } } }
  }
  if (!(await saveSettings(valid.data))) return { ok: false, error: "Les preferències són d'una versió més nova de l'app: només es poden llegir." }
  setAppSettings(valid.data)
  return { ok: true, doc, result }
}

export const settingsHandlers: AppToolHandlers<"get_settings" | "set_pref_material" | "set_pref_defaults" | "set_pref_gaps" | "set_default_machine"> = {
  get_settings: ({ doc }) => {
    const st = appSettings()
    if (!st) return { ok: false, error: NOT_READ }
    return {
      ok: true,
      doc,
      result: {
        materials: st.materials.map((m) => ({ name: m.name, category: materialCategory(m), thicknesses: m.thicknesses, edge: m.edge || undefined, solid: m.solid || undefined, grain: m.hasGrain })),
        categories: MATERIAL_CATEGORIES.map((c) => `${c.id} = ${c.label}`),
        defaults: st.defaults,
        gaps: st.gaps,
        machines: st.machines.map((m) => ({ name: m.name, default: m === (st.machines.find((x) => x.isDefault) ?? st.machines[0]) })),
      },
    }
  },
  set_pref_material: ({ doc, input }) => {
    const st = appSettings()
    if (!st) return { ok: false, error: NOT_READ }
    let renamed: [string, string] | undefined
    const i = input
    const k = materialNameKey(i.name)
    const at = st.materials.findIndex((m) => materialNameKey(m.name) === k)
    if (at < 0 && !i.create) return { ok: false, error: `No hi ha cap material «${i.name}». Fes servir get_settings o create: true.` }
    let m: MaterialPref =
      at >= 0 ? st.materials[at]! : { id: `mat-${Date.now().toString(36)}`, name: i.name.trim(), thicknesses: [19], hasGrain: false, finish: { kind: "color", color: i.color ?? "#d9d4cc" }, edge: "" }
    if (i.category) m = withCategory(m, i.category)
    if (i.thicknesses) m = { ...m, thicknesses: [...new Set(i.thicknesses)].sort((a, b) => a - b) }
    if (i.edge !== undefined) m = { ...m, edge: i.edge }
    if (i.solid !== undefined) m = i.solid ? { ...m, solid: true } : (({ solid: _s, ...rest }) => rest)(m)
    if (i.grain !== undefined) m = { ...m, hasGrain: i.grain }
    if (i.finish) {
      if (i.finish.kind === "image") return { ok: false, error: "Les fotos de textura es posen a Preferències › Materials (Posar una foto de textura)." }
      m = { ...m, ...switchFinish(m, i.finish) }
    } else if (i.finish_kind && i.finish_kind !== m.finish.kind) {
      const back = restoredFinish(m, i.finish_kind)
      if (!back) return { ok: false, error: `«${m.name}» no havia tingut mai l'acabat ${i.finish_kind}: dona'l sencer amb finish.` }
      m = { ...m, ...switchFinish(m, back) }
    }
    if (i.color) {
      if (m.finish.kind === "wood" || m.finish.kind === "image") return { ok: false, error: `L'acabat de «${m.name}» és ${m.finish.kind === "wood" ? "fusta" : "una foto"}: no té un color per canviar (canvia l'acabat amb finish).` }
      m = { ...m, finish: { ...m.finish, color: i.color } }
    }
    if (i.roughness !== undefined) {
      const f = m.finish
      if (f.kind !== "color" && f.kind !== "lacquer" && f.kind !== "metal") return { ok: false, error: "La rugositat només és dels acabats llis, lacat i metall." }
      m = { ...m, finish: { ...f, roughness: i.roughness } }
    }
    for (const k of ["coat", "sheen", "translucent", "glow"] as const) if (i[k] !== undefined) m = { ...m, [k]: i[k] }
    if (i.rename && i.rename.trim() !== m.name) {
      const to = i.rename.trim()
      if (st.materials.some((x, j) => j !== at && materialNameKey(x.name) === materialNameKey(to))) return { ok: false, error: `Ja hi ha un material «${to}».` }
      if (at >= 0) renamed = [m.name, to]
      m = { ...m, name: to }
    }
    const ok = MaterialPrefSchema.safeParse(m)
    if (!ok.success) return { ok: false, error: `Material no vàlid: ${ok.error.issues.map((x) => x.message).join("; ")}` }
    // Els nous, al davant (com «Afegir» de Preferències).
    let next: Settings = { ...st, materials: at >= 0 ? st.materials.map((x, j) => (j === at ? ok.data : x)) : [ok.data, ...st.materials] }
    if (renamed) next = renameMaterialInSettings(next, renamed[0], renamed[1])
    const result = { material: ok.data.name, created: at < 0, category: materialCategory(ok.data), finish: ok.data.finish.kind, thicknesses: ok.data.thicknesses, solid: !!ok.data.solid, ...(renamed ? { renamed_from: renamed[0] } : {}) }
    return saveChange(doc, next, result, renamed)
  },
  set_pref_defaults: ({ doc, input }) => {
    const st = appSettings()
    if (!st) return { ok: false, error: NOT_READ }
    const i = input
    const has = (n?: string) => !n || st.materials.some((m) => m.name === n)
    if (!has(i.material) || !has(i.back_material)) return { ok: false, error: "Aquest material no és a Preferències (get_settings)." }
    const next = { ...st, defaults: { material: i.material ?? st.defaults.material, thickness: i.thickness ?? st.defaults.thickness, backMaterial: i.back_material ?? st.defaults.backMaterial, backThickness: i.back_thickness ?? st.defaults.backThickness } }
    return saveChange(doc, next, { defaults: next.defaults })
  },
  set_pref_gaps: ({ doc, input }) => {
    const st = appSettings()
    if (!st) return { ok: false, error: NOT_READ }
    const next = { ...st, gaps: { ...st.gaps, ...(input as Partial<Settings["gaps"]>) } }
    return saveChange(doc, next, { gaps: next.gaps })
  },
  set_default_machine: ({ doc, input }) => {
    const st = appSettings()
    if (!st) return { ok: false, error: NOT_READ }
    const { name: mn } = input
    const hit = st.machines.find((m) => fold(m.name) === fold(mn))
    if (!hit) return { ok: false, error: `No hi ha cap màquina «${mn}» (get_settings).` }
    const next = { ...st, machines: st.machines.map((m) => ({ ...m, isDefault: m === hit })) }
    return saveChange(doc, next, { machine: hit.name })
  },
}
