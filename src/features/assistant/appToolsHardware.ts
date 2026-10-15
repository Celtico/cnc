import { findZone, HARDWARE_CATEGORIES, HARDWARE_SLOTS, setFront, slotAccepts, updateZone, type Composition, type Front, type HardwareItem, type HardwareSlot, SettingsSchema, hardwareParams, HardwareItemSchema } from "../../core/model"
import { setHardwareParam } from "../../core/model/hardwareEdit"
import { saveSettings } from "../../db/settingsStore"
import { currentDoc } from "./assistantHub"
import { appSettings, findHardware, fold, setAppSettings, type AppToolHandlers } from "./appToolContext"

/** Eines de l'app per als ferratges: la biblioteca, els per defecte i els d'un compartiment del moble obert. */

export const hardwareHandlers: AppToolHandlers<"list_hardware" | "set_hardware_default" | "set_front_hardware" | "get_hardware" | "edit_hardware"> = {
  list_hardware: ({ doc, input }) => {
    const settings = appSettings()
    if (!settings) return { ok: false, error: "Les preferències encara no s'han llegit." }
    const { query, slot } = input
    const q = query ? fold(query) : ""
    const defaults = settings.hardwareDefaults as Record<string, string | undefined>
    const items = settings.hardwareLibrary.filter((h) => (!slot || slotAccepts(slot, h)) && (!q || fold([h.name, h.maker ?? "", h.ref ?? ""].join(" ")).includes(q)))
    return {
      ok: true,
      doc,
      result: {
        count: items.length,
        items: items.slice(0, 60).map((h) => ({ id: h.id, name: h.name, category: HARDWARE_CATEGORIES.find((c) => c.id === h.category)?.label ?? h.category, maker: h.maker || undefined, default_for: Object.keys(defaults).filter((k) => defaults[k] === h.id) })),
      },
    }
  },
  set_hardware_default: async ({ doc, input }) => {
    const settings = appSettings()
    if (!settings) return { ok: false, error: "Les preferències encara no s'han llegit." }
    const { slot, hardware } = input
    const item = findHardware(hardware)
    if (!item) return { ok: false, error: `No hi ha cap ferratge «${hardware}» (list_hardware).` }
    if (!slotAccepts(slot, item)) return { ok: false, error: `«${item.name}» no pot anar a «${HARDWARE_SLOTS.find((x) => x.slot === slot)!.label}».` }
    const next = { ...settings, hardwareDefaults: { ...settings.hardwareDefaults, [slot]: item.id } }
    const valid = SettingsSchema.safeParse(next)
    if (!valid.success || !(await saveSettings(valid.data))) return { ok: false, error: "No s'han pogut desar les preferències." }
    setAppSettings(valid.data)
    return { ok: true, doc, result: { slot, hardware: item.name } }
  },
  set_front_hardware: ({ doc, input }) => {
    const i = input
    const d = currentDoc()
    if (!d || d.kind !== "moble") return { ok: false, error: "Cal un moble obert (open_document)." }
    const comp = doc as Composition
    const m = comp.modules.find((x) => x.id === i.module) ?? comp.modules.find((x) => fold(x.name) === fold(i.module))
    if (!m) return { ok: false, error: `No hi ha cap mòdul «${i.module}» (get_moble).` }
    const z0 = i.zone ? findZone(m.root, i.zone) : m.root
    if (!z0) return { ok: false, error: `El mòdul «${m.name}» no té cap compartiment «${i.zone}».` }
    const inherit = i.hardware === "module"
    const pushNone = i.part === "handle" && i.hardware === "none"
    const item = inherit || pushNone ? undefined : findHardware(i.hardware)
    if (!inherit && !pushNone && !item) return { ok: false, error: `No hi ha cap ferratge «${i.hardware}» (list_hardware).` }
    if (item && !slotAccepts(i.part as HardwareSlot, item)) return { ok: false, error: `«${item.name}» no pot fer de «${HARDWARE_SLOTS.find((x) => x.slot === i.part)!.label}».` }
    const copy = item ? structuredClone(item) : undefined
    let root = m.root
    if (i.part === "rail" || i.part === "led") {
      if (!z0[i.part]) return { ok: false, error: `${i.part === "rail" ? "La barra de penjar" : "La tira LED"} no és posada en aquest compartiment (activa-la primer).` }
      root = updateZone(root, z0.id, (z) => ({ ...z, [i.part]: copy ? { hardware: copy } : {} }))
    } else {
      const f = z0.front
      const need: Record<string, Front["kind"][]> = { hinge: ["door", "grille"], slide: ["drawers"], flap: ["flap"], magnet: ["grille"], handle: ["door", "drawers", "flap"], glassFrame: ["door"] }
      if (!f || !need[i.part]!.includes(f.kind)) return { ok: false, error: `Aquest compartiment no té cap front on vagi «${HARDWARE_SLOTS.find((x) => x.slot === i.part)!.label}» (té ${f?.kind ?? "res"}).` }
      const next = { ...f } as Front & { hardware?: HardwareItem; handle?: unknown; frame?: HardwareItem }
      if (i.part === "handle") {
        if (pushNone) next.handle = "none"
        else if (copy) next.handle = copy
        else delete next.handle
      } else if (i.part === "glassFrame") {
        if (copy) next.frame = copy
        else delete next.frame
      } else if (copy) next.hardware = copy
      else delete next.hardware
      root = setFront(root, z0.id, next as Front)
    }
    return { ok: true, doc: { ...comp, modules: comp.modules.map((x) => (x.id === m.id ? { ...m, root } : x)) }, result: { module: m.name, zone: z0.id, part: i.part, hardware: item?.name ?? (pushNone ? "cap (push)" : "com el mòdul") } }
  },
  get_hardware: ({ doc, input }) => {
    const h = findHardware(input.hardware)
    if (!h) return { ok: false, error: "No hi ha aquest ferratge (list_hardware)." }
    return {
      ok: true,
      doc,
      result: {
        id: h.id,
        name: h.name,
        engine: h.engine,
        maker: h.maker,
        ref: h.ref,
        builtin: !!h.builtin,
        params: hardwareParams(h).map((q) => ({ key: q.key, label: q.label, value: h.params[q.key], min: q.min, max: q.max, ...(q.help ? { help: q.help } : {}) })),
        count: h.count,
        pitch: h.pitch,
        kit: h.kit ? { series: h.kit.series, lengths: h.kit.variants.map((v) => v.nl) } : undefined,
      },
    }
  },
  edit_hardware: async ({ doc, input }) => {
    const settings = appSettings()
    if (!settings) return { ok: false, error: "Les preferències encara no s'han llegit." }
    const i = input
    const h = findHardware(i.hardware)
    if (!h) return { ok: false, error: "No hi ha aquest ferratge (list_hardware)." }
    if (h.builtin && !i.duplicate && (i.params || i.name)) return { ok: false, error: `«${h.name}» és dels de l'app: fes-ne una còpia (duplicate: true) i edita la còpia.` }
    let item: HardwareItem = i.duplicate ? { ...structuredClone(h), id: `hw-${Date.now().toString(36)}`, name: i.name?.trim() || `${h.name} (còpia)` } : { ...h }
    if (i.duplicate) delete item.builtin
    if (i.name && !i.duplicate) item.name = i.name.trim()
    if (i.maker !== undefined) item.maker = i.maker
    if (i.ref !== undefined) item.ref = i.ref
    const specs = hardwareParams(item)
    for (const [k, v] of Object.entries(i.params ?? {})) {
      const spec = specs.find((q) => q.key === k)
      if (!spec) return { ok: false, error: `«${k}» no és un paràmetre de «${h.name}». Paràmetres: ${specs.map((q) => q.key).join(", ")}.` }
      if (v < spec.min || v > spec.max) return { ok: false, error: `${spec.label}: entre ${spec.min} i ${spec.max}.` }
      item = setHardwareParam(item, k, v)
    }
    const ok = HardwareItemSchema.safeParse(item)
    if (!ok.success) return { ok: false, error: `Ferratge no vàlid: ${ok.error.issues.slice(0, 3).map((x) => x.message).join("; ")}` }
    const lib = i.duplicate ? [...settings.hardwareLibrary, ok.data] : settings.hardwareLibrary.map((x) => (x.id === h.id ? ok.data : x))
    const valid = SettingsSchema.safeParse({ ...settings, hardwareLibrary: lib })
    if (!valid.success || !(await saveSettings(valid.data))) return { ok: false, error: "No s'han pogut desar les preferències." }
    setAppSettings(valid.data)
    return { ok: true, doc, result: { hardware: ok.data.name, id: ok.data.id, duplicated: !!i.duplicate } }
  },
}
