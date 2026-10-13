import { z } from "zod"
import { EMPTY_AMBIENT, findZone, HARDWARE_CATEGORIES, HARDWARE_SLOTS, setFront, slotAccepts, updateZone, type Front, type HardwareItem, type HardwareSlot, GapsPrefSchema, MATERIAL_CATEGORIES, materialCategory, materialNameKey, MaterialPrefSchema, SettingsSchema, withCategory, machineWithRules, type MaterialPref, type Ambient, type Composition, type Settings } from "../../core/model"
import { buildComposition } from "../../core/build/buildComposition"
import { toCutList } from "../../core/cutlist/toCutList"
import { nest, STANDARD_SHEETS } from "../../core/nesting/nest"
import { nestPlan } from "../../core/nesting/machineNest"
import { cutListToCsv } from "../../core/export/csv"
import { toDxf } from "../../core/export/dxf"
import { toStepCad } from "../../core/export/step"
import { stepCadGroups } from "../../core/export/stepGroups"
import { encodeUtf16le, toTopsolidCsv } from "../../core/export/topsolidCsv"
import { xcsZip } from "../../core/export/maestroXcs"
import { cncNestOptions, toMaestroNestXcs } from "../../core/export/maestroNestXcs"
import { keepProject } from "../../db/db"
import { downloadBlob, slugify } from "../download"
import { saveSettings } from "../../db/settingsStore"
import { setHardwareParam } from "../../core/import/importItem"
import { FinishSchema, hardwareParams, HardwareItemSchema, renameMaterialInSettings, renameMaterialRefs, restoredFinish, switchFinish } from "../../core/model"
import { renameMaterialEverywhere } from "../../db/materialRefs"
import { renamePresentationMaterial } from "../../components/viewer/presentationScene"
import { uniqueName } from "../../core/file/mobleFile"
import { parseToolInput, toolDefs, toolFailure, type AssistantToolSet, type ToolInputs, type ToolRun } from "../../core/assistant/toolset"
import { createAmbient, createProject, db, safeNestOptions, updateProjectNesting, deleteAmbient, deleteProject, duplicateAmbient, duplicateProject, renameAmbient, renameProject, setAmbientsFolder, setProjectsFolder } from "../../db/db"
import { isObject } from "../objects/isObject"
import { blankMoble, blankObject } from "../projects/blank"
import { currentDoc, currentNav, waitForDoc } from "./assistantHub"

/**
 * Eines de l'**app** de l'assistent personal (`assistantHub.ts`): on som, buscar, obrir i crear mobles, objectes i
 * ambients, i anar a una pàgina. No toquen el document obert (en tornen el mateix): el canvi és de pàgina. Les del document
 * obert (moble, objecte, ambient) s'hi afegeixen (`withAppTools`).
 */

const KIND = z.enum(["moble", "objecte", "ambient"]).describe("moble = moble per fabricar; objecte = decoratiu per als ambients; ambient = habitació")

const INPUTS = {
  get_app: z.object({}).describe("On és l'usuari: l'apartat, la pàgina, el document obert (tipus, id i nom) i què hi té seleccionat. Crida-la al començament si no ho saps."),
  list_documents: z
    .object({ kind: KIND, query: z.string().optional().describe("Text per buscar al nom (sense accents ni majúscules)") })
    .describe("Llista els mobles, objectes o ambients desats (id, nom, grup i data), els més recents primer, com a molt 40."),
  open_document: z.object({ kind: KIND, id: z.number().int() }).describe("Obre un moble, objecte o ambient (com tocar-ne la targeta). Les seves eines ja es poden fer servir a la volta següent."),
  create_document: z
    .object({ kind: KIND, name: z.string().optional().describe("Nom (si ja n'hi ha un d'igual, s'hi afegeix un número)") })
    .describe("Crea un moble, objecte o ambient en blanc (com «+ Nou moble») i l'obre."),
  rename_document: z.object({ kind: KIND, id: z.number().int(), name: z.string().min(1) }).describe("Canvia el nom d'un moble, objecte o ambient."),
  duplicate_document: z.object({ kind: KIND, id: z.number().int() }).describe("Duplica un moble, objecte o ambient (la còpia surt a l'Historial; d'un ambient es dupliquen també els seus mobles). No l'obre."),
  move_to_group: z
    .object({ kind: KIND, ids: z.array(z.number().int()).min(1), group: z.string().nullable().describe("Nom del grup (Projectes); null = treure del grup (a l'Historial)") })
    .describe("Mou documents a un grup de Projectes (p. ex. un per client) o els treu del grup."),
  delete_document: z
    .object({ kind: KIND, id: z.number().int(), confirmed: z.boolean().describe("true només si l'usuari ha dit que sí, en aquest xat, a esborrar aquest document concret") })
    .describe("Esborra un moble, objecte o ambient per sempre. ABANS pregunta a l'usuari i espera que digui que sí; crida-la amb confirmed: true només després. Un moble o objecte que és en algun ambient no s'esborra."),
  get_cutlist: z.object({}).describe("Llista de peces del moble obert (com la pàgina Peces): peces iguals agrupades amb quantitat, mides L × A × gruix, material, veta, cantells (1 dalt · 2 dreta · 3 baix · 4 esquerra), post-processos; i els elements sense nesting."),
  get_nesting: z.object({}).describe("Nesting del moble obert (com la pàgina Nesting): taulers per material i gruix, aprofitament, peces que no hi caben, mida de tauler, separació i marge (de la màquina per defecte si n'hi ha)."),
  set_sheet: z
    .object({
      w: z.number().positive().describe("Llarg del tauler (mm)"),
      h: z.number().positive().describe("Ample del tauler (mm)"),
      material: z.string().optional().describe("Només per a aquest material (si no, el de tots)"),
    })
    .describe(`Canvia la mida de tauler del nesting del moble obert (estàndard: ${STANDARD_SHEETS.map((s) => `${s.w} × ${s.h}`).join(", ")}).`),
  export_files: z
    .object({ format: z.enum(["xcs", "step", "csv_topsolid", "dxf", "cutlist_csv", "glb"]).describe("xcs = programes de Maestro per tauler (zip); step i csv_topsolid = per a TopSolid i el taller; dxf = CNC; cutlist_csv = llista de tall; glb = model 3D") })
    .describe("Genera i baixa un fitxer del moble obert (com la pàgina Exportar) i en diu els avisos. El navegador el desa a Baixades."),
  get_settings: z.object({}).describe("Preferències: materials (nom, categoria, gruixos, cantell, massís), tauler i fons per defecte, folgances per defecte i màquines CNC (la per defecte). La clau de l'API no hi surt mai."),
  set_pref_material: z
    .object({
      name: z.string().min(1).describe("Nom del material (exacte, com a get_settings). Si no existeix i create és true, se'n crea un"),
      create: z.boolean().optional().describe("Crear-lo si no existeix (color llis)"),
      rename: z.string().min(1).optional().describe("Nom nou (els mobles, objectes i ambients que el fan servir el segueixen)"),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Color (#rrggbb): el de l'acabat (llis, lacat, pedra, metall, vidre, teixit, rajola); a la fusta i a la foto no"),
      roughness: z.number().min(0).max(1).optional().describe("Rugositat de l'acabat llis, lacat o metall (0 mirall, 1 mat)"),
      finish: FinishSchema.optional().describe("Acabat sencer nou (color, lacquer, wood, stone, metal, glass, fabric, tiles; la foto no: es posa a Preferències). L'anterior es guarda i s'hi pot tornar."),
      finish_kind: z.enum(["color", "lacquer", "wood", "stone", "metal", "glass", "fabric", "tiles", "image"]).optional().describe("Tornar a un acabat que el material ja havia tingut (es recupera tal com era)"),
      coat: z.number().min(0).max(1).optional().describe("Reflex (vernís) al render"),
      sheen: z.number().min(0).max(1).optional().describe("Vellut al render"),
      translucent: z.number().min(0).max(1).optional().describe("Llum que passa (teles, pantalles)"),
      glow: z.number().min(0).max(200).optional().describe("Llum que fa (0 = cap)"),
      category: z.enum(["board", "back", "sim"]).optional().describe("board = tauler de CNC; back = fons; sim = simulació (no es talla)"),
      thicknesses: z.array(z.number().min(3).max(60)).min(1).optional(),
      edge: z.string().optional().describe("Nom del cantell (p. ex. «PVC blanc 1 mm»)"),
      solid: z.boolean().optional().describe("Massís: les seves peces no es cantegen"),
      grain: z.boolean().optional().describe("Té veta"),
    })
    .describe("Canvia, reanomena o crea un material de Preferències › Materials: categoria, gruixos, cantell, veta, massís, color, acabat i com es veu al render. No l'esborra."),
  set_pref_defaults: z
    .object({ material: z.string().optional(), thickness: z.number().optional(), back_material: z.string().optional(), back_thickness: z.number().optional() })
    .describe("Tauler i fons per defecte dels mòduls nous (materials de Preferències)."),
  set_pref_gaps: GapsPrefSchema.partial().describe("Folgances per defecte (mm): outerGap front–cos, betweenGap entre fronts, shelfClearance, shelfSetback, backClearance, backSetback, grooveDepth, innerClearance (peces de dins)."),
  set_default_machine: z.object({ name: z.string() }).describe("Tria la màquina CNC per defecte (la dels programes .xcs i la separació del nesting)."),
  list_hardware: z
    .object({
      query: z.string().optional().describe("Text per buscar al nom, fabricant, sèrie o número d'article"),
      slot: z.enum(["hinge", "system32", "dowel", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]).optional().describe("Només els que poden anar en aquest lloc (slide inclou els jocs de calaix)"),
    })
    .describe("Ferratges de la biblioteca (Preferències › Ferratges): id, nom, categoria, fabricant, sèrie i els llocs on són per defecte. Com a molt 60."),
  set_hardware_default: z
    .object({ slot: z.enum(["hinge", "system32", "dowel", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]), hardware: z.string().describe("Id o nom del ferratge (list_hardware)") })
    .describe("Ferratge per defecte d'un lloc als mòduls nous (Preferències › Ferratges, «Per defecte als mòduls nous»)."),
  set_front_hardware: z
    .object({
      module: z.string().describe("Id o nom del mòdul del moble obert"),
      zone: z.string().optional().describe("Id del compartiment (sense: l'Interior, l'arrel)"),
      part: z.enum(["hinge", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]).describe("hinge = frontissa de la porta; slide = guia o joc dels calaixos; flap = braç de l'abatible; magnet = imant de la reixeta; handle = tirador; rail = barra de penjar; led = tira LED; glassFrame = marc de la porta de vidre"),
      hardware: z.string().describe("Id o nom del ferratge (list_hardware); «module» = el del mòdul (Com el mòdul); al tirador, «none» = sense tirador (push)"),
    })
    .describe("Tria el ferratge d'un compartiment del moble obert, com el selector del Front o dels Accessoris de l'inspector (es guarda una còpia de l'item)."),
  get_hardware: z.object({ hardware: z.string().describe("Id o nom (list_hardware)") }).describe("Un ferratge de la biblioteca amb tots els seus números (els paràmetres que es poden editar, amb els límits), la quantitat per alçada i la distància entre forats."),
  edit_hardware: z
    .object({
      hardware: z.string().describe("Id o nom (list_hardware)"),
      duplicate: z.boolean().optional().describe("Fer-ne una còpia i editar la còpia (obligat amb els de l'app)"),
      name: z.string().min(1).optional(),
      maker: z.string().optional(),
      ref: z.string().optional().describe("Número d'article"),
      params: z.record(z.string(), z.number()).optional().describe("Paràmetres a canviar (claus de get_hardware)"),
    })
    .describe("Edita (o duplica i edita) un ferratge de la biblioteca: nom, fabricant, número i paràmetres (Preferències › Ferratges). Els mobles fets es queden la seva còpia."),
  go_to: z
    .object({ place: z.enum(["mobles", "ambients", "objectes", "preferencies", "editor", "peces", "nesting", "exportar"]) })
    .describe("Va a un apartat (mobles, ambients, objectes, preferencies) o a una pàgina del moble obert (editor, peces, nesting, exportar)."),
} satisfies ToolInputs

/** Les preferències d'ara (les posa el xat, `GlobalAssistant`): màquina i regles per al nesting, materials… */
let SETTINGS: Settings | null = null
export function setAppSettings(s: Settings): void {
  SETTINGS = s
}

/** El moble obert (per a Peces, Nesting i Exportar): la composició d'ara i la fila desada. */
async function openMoble(): Promise<{ id: number; name: string; comp: Composition; nesting: ReturnType<typeof safeNestOptions> } | string> {
  const d = currentDoc()
  if (!d || d.kind !== "moble") return "Cal un moble obert (open_document)."
  const row = await db.projects.get(d.id)
  if (!row) return "El moble obert ja no hi és."
  return { id: d.id, name: row.name, comp: d.target.getDoc() as Composition, nesting: safeNestOptions(row.nesting) }
}

/** Un ferratge de la biblioteca per id o nom (sense majúscules ni accents). */
function findHardware(ref: string): HardwareItem | undefined {
  const lib = SETTINGS?.hardwareLibrary ?? []
  return lib.find((h) => h.id === ref) ?? lib.find((h) => fold(h.name) === fold(ref))
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca")

/** On som (per a `get_app` i per al context de cada missatge). */
export function appContext(): Record<string, unknown> {
  const nav = currentNav()
  const doc = currentDoc()
  return {
    ...(nav ? nav.where() : {}),
    document: doc ? { kind: doc.kind, id: doc.id, name: doc.name } : null,
    selection: doc?.selection() ?? null,
  }
}

/** El context en una línia per posar davant del missatge de l'usuari. */
export function contextLine(): string {
  const c = appContext()
  const doc = c.document as { kind: string; id: number; name: string } | null
  const parts = [`apartat ${c.section ?? "?"}, pàgina ${c.page ?? "?"}`, doc ? `${doc.kind} obert «${doc.name}» (id ${doc.id})` : "cap document obert", c.selection ? `seleccionat: ${c.selection}` : "res seleccionat"]
  return `[Context de l'app: ${parts.join("; ")}]`
}

async function run(doc: unknown, name: string, raw: unknown): Promise<ToolRun<unknown>> {
  const p = parseToolInput(INPUTS, name, raw)
  if (!p.ok) return p
  const nav = currentNav()
  try {
    switch (name) {
      case "get_app":
        return { ok: true, doc, result: appContext() }
      case "list_documents": {
        const { kind, query } = p.data as z.infer<typeof INPUTS.list_documents>
        const q = query ? fold(query) : ""
        if (kind === "ambient") {
          const rows = (await db.ambients.toArray()).filter((a) => !q || fold(a.name).includes(q)).sort((a, b) => b.updatedAt - a.updatedAt)
          return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((a) => ({ id: a.id, name: a.name, folder: a.folder ?? null, updated: new Date(a.updatedAt).toISOString().slice(0, 10) })) } }
        }
        const rows = (await db.projects.toArray()).filter((r) => !r.draft && isObject(r) === (kind === "objecte") && (!q || fold(r.name).includes(q))).sort((a, b) => b.updatedAt - a.updatedAt)
        return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((r) => ({ id: r.id, name: r.name, folder: r.folder ?? null, updated: new Date(r.updatedAt).toISOString().slice(0, 10) })) } }
      }
      case "open_document": {
        const { kind, id } = p.data as z.infer<typeof INPUTS.open_document>
        if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
        if (kind === "ambient") {
          const a = await db.ambients.get(id)
          if (!a) return { ok: false, error: `No hi ha cap ambient amb l'id ${id}. Fes servir list_documents.` }
          nav.openAmbient(id)
          const d = await waitForDoc(`ambient:${id}`)
          return { ok: true, doc, result: { opened: { kind, id, name: a.name }, ready: !!d } }
        }
        const r = await db.projects.get(id)
        if (!r || isObject(r) !== (kind === "objecte")) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}. Fes servir list_documents.` }
        nav.openMoble(id)
        const d = await waitForDoc(`${kind}:${id}`)
        return { ok: true, doc, result: { opened: { kind, id, name: r.name }, ready: !!d } }
      }
      case "create_document": {
        const { kind, name: wanted } = p.data as z.infer<typeof INPUTS.create_document>
        if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
        if (kind === "ambient") {
          const names = (await db.ambients.toArray()).map((a) => a.name)
          const name = uniqueName(wanted?.trim() || "Ambient nou", names)
          const data: Ambient = { ...EMPTY_AMBIENT }
          const id = await createAmbient(name, data)
          nav.openAmbient(id)
          const d = await waitForDoc(`ambient:${id}`)
          return { ok: true, doc, result: { created: { kind, id, name }, ready: !!d } }
        }
        const names = (await db.projects.toArray()).map((r) => r.name)
        const name = uniqueName(wanted?.trim() || (kind === "objecte" ? "Objecte nou" : "Moble nou"), names)
        // No és esborrany: l'ha creat l'assistent a petició de l'usuari (es queda a l'Historial).
        const id = await createProject(name, undefined, { composition: kind === "objecte" ? blankObject() : blankMoble("moble") })
        nav.openMoble(id)
        const d = await waitForDoc(`${kind}:${id}`)
        return { ok: true, doc, result: { created: { kind, id, name }, ready: !!d } }
      }
      case "rename_document": {
        const { kind, id, name: nm } = p.data as z.infer<typeof INPUTS.rename_document>
        const row = kind === "ambient" ? await db.ambients.get(id) : await db.projects.get(id)
        if (!row) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
        if (kind === "ambient") await renameAmbient(id, nm.trim())
        else await renameProject(id, nm.trim())
        return { ok: true, doc, result: { kind, id, from: row.name, name: nm.trim() } }
      }
      case "duplicate_document": {
        const { kind, id } = p.data as z.infer<typeof INPUTS.duplicate_document>
        const copy = kind === "ambient" ? await duplicateAmbient(id) : await duplicateProject(id)
        if (copy === undefined) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
        const row = kind === "ambient" ? await db.ambients.get(copy) : await db.projects.get(copy)
        return { ok: true, doc, result: { kind, copy: { id: copy, name: row?.name } } }
      }
      case "move_to_group": {
        const { kind, ids, group } = p.data as z.infer<typeof INPUTS.move_to_group>
        const folder = group?.trim() || undefined
        if (kind === "ambient") await setAmbientsFolder(ids, folder)
        else await setProjectsFolder(ids, folder)
        return { ok: true, doc, result: { kind, ids, group: folder ?? null } }
      }
      case "delete_document": {
        const { kind, id, confirmed } = p.data as z.infer<typeof INPUTS.delete_document>
        if (!confirmed) return { ok: false, error: "Abans d'esborrar, pregunta-ho a l'usuari i espera que digui que sí." }
        const row = kind === "ambient" ? await db.ambients.get(id) : await db.projects.get(id)
        if (!row) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
        if (kind !== "ambient") {
          // Com «Esborrar» de les galeries: els que són en algun ambient es conserven.
          const used = (await db.ambients.toArray()).filter((a) => ((a.data as { items?: { kind?: string; projectId?: number }[] })?.items ?? []).some((i) => i.kind === "moble" && i.projectId === id))
          if (used.length) return { ok: false, error: `«${row.name}» és a ${used.length === 1 ? "l'ambient" : "els ambients"} ${used.map((a) => `«${a.name}»`).join(", ")}: no s'esborra (treu-lo primer de l'ambient).` }
        }
        // El document obert: primer se surt a la llista.
        const open = currentDoc()
        if (open && open.id === id && (open.kind === "ambient") === (kind === "ambient")) nav?.goTo(kind === "ambient" ? "ambients" : kind === "objecte" ? "objectes" : "mobles")
        if (kind === "ambient") await deleteAmbient(id)
        else await deleteProject(id)
        return { ok: true, doc, result: { kind, deleted: { id, name: row.name } } }
      }
      case "get_cutlist": {
        const m = await openMoble()
        if (typeof m === "string") return { ok: false, error: m }
        const b = buildComposition(m.comp)
        const cl = toCutList(b.panels)
        return {
          ok: true,
          doc,
          result: {
            moble: m.name,
            pieces: cl.totalPanels,
            area_m2: Math.round(cl.totalArea * 100) / 100,
            edge_m: Math.round(cl.totalEdgeLength * 10) / 10,
            rows: cl.items.slice(0, 80).map((i) => ({ label: i.label, qty: i.qty, size: `${i.length} × ${i.width} × ${i.thickness}`, material: i.material, grain: i.grain, edges: i.edgeNumbers.join("+") || "-", processes: i.processes || undefined })),
            extras: b.extras.filter((p) => p.role !== "hardware").map((p) => `${p.label} ${p.length} × ${p.width} × ${p.thickness} (${p.material})`),
            warnings: b.warnings.map((w) => w.message).slice(0, 20),
          },
        }
      }
      case "get_nesting": {
        const m = await openMoble()
        if (typeof m === "string") return { ok: false, error: m }
        const panels = buildComposition(m.comp).panels
        const machine = SETTINGS ? machineWithRules(SETTINGS) : undefined
        const plan = nestPlan(panels, m.nesting, machine)
        const n = nest(panels, plan.options)
        return {
          ok: true,
          doc,
          result: {
            moble: m.name,
            sheet: `${m.nesting.sheet.w} × ${m.nesting.sheet.h}`,
            sheets_by_material: m.nesting.sheetsByMaterial ?? {},
            spacing: plan.options.kerf,
            margin: plan.options.margin,
            machine: machine?.name ?? null,
            boards: n.boards.map((bd) => ({ n: bd.tab, material: bd.material, thickness: bd.thickness, size: `${bd.w} × ${bd.h}`, pieces: bd.placements.length, efficiency: `${Math.round(bd.efficiency * 100)} %` })),
            total_efficiency: `${Math.round(n.totalEfficiency * 100)} %`,
            unplaced: n.unplaced.length,
          },
        }
      }
      case "set_sheet": {
        const { w, h, material } = p.data as z.infer<typeof INPUTS.set_sheet>
        const m = await openMoble()
        if (typeof m === "string") return { ok: false, error: m }
        const sheet = { w: Math.max(w, h), h: Math.min(w, h) }
        const next = material ? { ...m.nesting, sheetsByMaterial: { ...(m.nesting.sheetsByMaterial ?? {}), [material]: sheet } } : { ...m.nesting, sheet }
        await updateProjectNesting(m.id, next)
        return { ok: true, doc, result: { moble: m.name, sheet: `${sheet.w} × ${sheet.h}`, ...(material ? { material } : {}) } }
      }
      case "export_files": {
        const { format } = p.data as z.infer<typeof INPUTS.export_files>
        const m = await openMoble()
        if (typeof m === "string") return { ok: false, error: m }
        const b = buildComposition(m.comp)
        const panels = b.panels
        if (!panels.length) return { ok: false, error: "El moble no té cap peça per exportar." }
        const base = slugify(m.name)
        const machine = SETTINGS ? machineWithRules(SETTINGS) : undefined
        const save = (blob: Blob, file: string) => {
          downloadBlob(blob, file)
          // Com a Exportar: el que s'ha enviat al taller s'ha de poder trobar (deixa de ser esborrany).
          void keepProject(m.id)
          return file
        }
        if (format === "xcs") {
          if (!machine) return { ok: false, error: "No hi ha cap màquina per defecte (Preferències › Màquines CNC): no es poden fer els programes de Maestro." }
          const plan = cncNestOptions(panels, machine, m.nesting)
          const opts = { project: m.name, kits: b.hardwareKits, lights: (b as { lightKits?: unknown }).lightKits } as Parameters<typeof toMaestroNestXcs>[3]
          const x = toMaestroNestXcs(panels, nest(panels, plan.options), machine, opts)
          const file = save(new Blob([xcsZip(x) as BlobPart], { type: "application/zip" }), `${base}-maestro.zip`)
          return { ok: true, doc, result: { file, programs: x.programs, machine: machine.name, warnings: x.warnings.slice(0, 20) } }
        }
        if (format === "step") {
          const step = toStepCad(stepCadGroups(m.comp, b, { extras: false }), { name: m.name })
          const file = save(new Blob([step.text], { type: "application/step" }), `${base}.step`)
          return { ok: true, doc, result: { file, solids: step.solids, warnings: step.warnings.slice(0, 20) } }
        }
        if (format === "csv_topsolid") {
          const n = nest(panels, nestPlan(panels, m.nesting, machine).options)
          const csv = toTopsolidCsv(panels, n, { project: m.name, ...(SETTINGS ? { label: SETTINGS.label } : {}) })
          const file = save(new Blob([encodeUtf16le(csv.text) as BlobPart], { type: "text/csv" }), `${base}_res.csv`)
          return { ok: true, doc, result: { file, rows: csv.rows.length, boards: n.boards.length, unplaced: csv.unplaced.length } }
        }
        if (format === "dxf") {
          const file = save(new Blob([toDxf(panels, { labels: true, threeD: true })], { type: "application/dxf;charset=utf-8" }), `${base}.dxf`)
          return { ok: true, doc, result: { file, pieces: panels.length } }
        }
        if (format === "cutlist_csv") {
          const file = save(new Blob([cutListToCsv(toCutList(panels))], { type: "text/csv;charset=utf-8" }), `${base}-peces.csv`)
          return { ok: true, doc, result: { file } }
        }
        // GLB: three a demanda (no va al bloc del xat).
        const [{ exportGlb }, { exportablePanel }] = await Promise.all([import("../../components/viewer/exportGlb"), import("../../components/viewer/exportablePanel")])
        const glb = await exportGlb(panels, m.name, { materials: SETTINGS?.materials ?? [], make: exportablePanel }, b.models)
        return { ok: true, doc, result: { file: save(glb, `${base}.glb`) } }
      }
      case "get_settings": {
        if (!SETTINGS) return { ok: false, error: "Les preferències encara no s'han llegit." }
        const st = SETTINGS
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
      }
      case "set_pref_material":
      case "set_pref_defaults":
      case "set_pref_gaps":
      case "set_default_machine": {
        if (!SETTINGS) return { ok: false, error: "Les preferències encara no s'han llegit." }
        const st = SETTINGS
        let next = st
        let result: Record<string, unknown> = {}
        let renamed: [string, string] | undefined
        if (name === "set_pref_material") {
          const i = p.data as z.infer<typeof INPUTS.set_pref_material>
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
          next = { ...st, materials: at >= 0 ? st.materials.map((x, j) => (j === at ? ok.data : x)) : [ok.data, ...st.materials] }
          if (renamed) next = renameMaterialInSettings(next, renamed[0], renamed[1])
          result = { material: ok.data.name, created: at < 0, category: materialCategory(ok.data), finish: ok.data.finish.kind, thicknesses: ok.data.thicknesses, solid: !!ok.data.solid, ...(renamed ? { renamed_from: renamed[0] } : {}) }
        } else if (name === "set_pref_defaults") {
          const i = p.data as z.infer<typeof INPUTS.set_pref_defaults>
          const has = (n?: string) => !n || st.materials.some((m) => m.name === n)
          if (!has(i.material) || !has(i.back_material)) return { ok: false, error: "Aquest material no és a Preferències (get_settings)." }
          next = { ...st, defaults: { material: i.material ?? st.defaults.material, thickness: i.thickness ?? st.defaults.thickness, backMaterial: i.back_material ?? st.defaults.backMaterial, backThickness: i.back_thickness ?? st.defaults.backThickness } }
          result = { defaults: next.defaults }
        } else if (name === "set_pref_gaps") {
          next = { ...st, gaps: { ...st.gaps, ...(p.data as Partial<Settings["gaps"]>) } }
          result = { gaps: next.gaps }
        } else {
          const { name: mn } = p.data as z.infer<typeof INPUTS.set_default_machine>
          const hit = st.machines.find((m) => fold(m.name) === fold(mn))
          if (!hit) return { ok: false, error: `No hi ha cap màquina «${mn}» (get_settings).` }
          next = { ...st, machines: st.machines.map((m) => ({ ...m, isDefault: m === hit })) }
          result = { machine: hit.name }
        }
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
          SETTINGS = valid.data
          // El document obert també (si no, en desar-lo tornaria el nom d'abans).
          return { ok: true, doc: doc == null ? doc : renameMaterialRefs(doc, from, to), result: { ...result, updated: { mobles: c.projects, ambients: c.ambients } } }
        }
        if (!(await saveSettings(valid.data))) return { ok: false, error: "Les preferències són d'una versió més nova de l'app: només es poden llegir." }
        SETTINGS = valid.data
        return { ok: true, doc, result }
      }
      case "list_hardware": {
        if (!SETTINGS) return { ok: false, error: "Les preferències encara no s'han llegit." }
        const { query, slot } = p.data as z.infer<typeof INPUTS.list_hardware>
        const q = query ? fold(query) : ""
        const defaults = SETTINGS.hardwareDefaults as Record<string, string | undefined>
        const items = SETTINGS.hardwareLibrary.filter((h) => (!slot || slotAccepts(slot, h)) && (!q || fold([h.name, h.maker ?? "", h.ref ?? ""].join(" ")).includes(q)))
        return {
          ok: true,
          doc,
          result: {
            count: items.length,
            items: items.slice(0, 60).map((h) => ({ id: h.id, name: h.name, category: HARDWARE_CATEGORIES.find((c) => c.id === h.category)?.label ?? h.category, maker: h.maker || undefined, default_for: Object.keys(defaults).filter((k) => defaults[k] === h.id) })),
          },
        }
      }
      case "set_hardware_default": {
        if (!SETTINGS) return { ok: false, error: "Les preferències encara no s'han llegit." }
        const { slot, hardware } = p.data as z.infer<typeof INPUTS.set_hardware_default>
        const item = findHardware(hardware)
        if (!item) return { ok: false, error: `No hi ha cap ferratge «${hardware}» (list_hardware).` }
        if (!slotAccepts(slot, item)) return { ok: false, error: `«${item.name}» no pot anar a «${HARDWARE_SLOTS.find((x) => x.slot === slot)!.label}».` }
        const next = { ...SETTINGS, hardwareDefaults: { ...SETTINGS.hardwareDefaults, [slot]: item.id } }
        const valid = SettingsSchema.safeParse(next)
        if (!valid.success || !(await saveSettings(valid.data))) return { ok: false, error: "No s'han pogut desar les preferències." }
        SETTINGS = valid.data
        return { ok: true, doc, result: { slot, hardware: item.name } }
      }
      case "set_front_hardware": {
        const i = p.data as z.infer<typeof INPUTS.set_front_hardware>
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
      }
      case "get_hardware": {
        const h = findHardware((p.data as { hardware: string }).hardware)
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
      }
      case "edit_hardware": {
        if (!SETTINGS) return { ok: false, error: "Les preferències encara no s'han llegit." }
        const i = p.data as z.infer<typeof INPUTS.edit_hardware>
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
        const lib = i.duplicate ? [...SETTINGS.hardwareLibrary, ok.data] : SETTINGS.hardwareLibrary.map((x) => (x.id === h.id ? ok.data : x))
        const valid = SettingsSchema.safeParse({ ...SETTINGS, hardwareLibrary: lib })
        if (!valid.success || !(await saveSettings(valid.data))) return { ok: false, error: "No s'han pogut desar les preferències." }
        SETTINGS = valid.data
        return { ok: true, doc, result: { hardware: ok.data.name, id: ok.data.id, duplicated: !!i.duplicate } }
      }
      case "go_to": {
        const { place } = p.data as z.infer<typeof INPUTS.go_to>
        if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
        if (!nav.goTo(place)) return { ok: false, error: `No es pot anar a «${place}» ara (les pàgines editor, peces, nesting i exportar necessiten un moble obert; un objecte només té l'editor).` }
        return { ok: true, doc, result: { at: place } }
      }
    }
    return { ok: false, error: `Eina desconeguda «${name}».` }
  } catch (e) {
    return toolFailure(name, e)
  }
}

export const APP_SYSTEM = `Ets l'assistent personal de Mobles CNC, una app per dissenyar mobles paramètrics i fabricar-los a la CNC del taller (també objectes decoratius i ambients). Respon sempre en català, curt i clar.
Pots fer el que faria l'usuari amb la UI: saber on és i què té seleccionat (get_app; cada missatge també porta una línia «[Context de l'app: …]»), buscar, obrir i crear mobles, objectes i ambients (list_documents, open_document, create_document) anar a una pàgina (go_to), gestionar documents (rename_document, duplicate_document, move_to_group, delete_document), llegir les peces i el nesting del moble obert i canviar-ne el tauler (get_cutlist, get_nesting, set_sheet), baixar els fitxers del taller (export_files) i els ferratges (list_hardware, get_hardware, edit_hardware, set_hardware_default, set_front_hardware: frontissa, guia o joc de calaix, braç, imant, tirador, barra, LED i marc d'un compartiment del moble obert), llegir i canviar les preferències (get_settings, set_pref_material, set_pref_defaults, set_pref_gaps, set_default_machine). També tens les eines de cada tipus de document (moble, objecte, ambient), però només serveixen amb un document d'aquell tipus obert: si cal, obre'l primer amb open_document.
Per esborrar un document, pregunta-ho sempre abans i espera un sí explícit (delete_document amb confirmed: true només llavors).
Quan l'usuari parli de «això», «el seleccionat» o similar, fes servir la selecció del context. No inventis ids: busca'ls amb les eines. Abans d'esborrar o canviar molt, explica què faràs. Els canvis d'un torn es desfan amb un sol «Desfer» de l'editor.`

/** Les eines de l'app soles (cap document obert). */
export const appToolSet: AssistantToolSet<unknown> = {
  system: APP_SYSTEM,
  tools: toolDefs(INPUTS),
  run,
  payload: (_n, _b, outcome) => outcome.result,
  describe: (n, result) => {
    if (n === "open_document") return `Obert: ${(result.opened as { name: string }).name}`
    if (n === "create_document") return `Creat: ${(result.created as { name: string }).name}`
    if (n === "go_to") return `Anat a ${String(result.at)}`
    if (n === "get_cutlist") return `${String(result.pieces)} peces`
    if (n === "get_nesting") return `${(result.boards as unknown[]).length} taulers · ${String(result.total_efficiency)}`
    if (n === "set_sheet") return `Tauler ${String(result.sheet)}${result.material ? ` per a ${String(result.material)}` : ""}`
    if (n === "get_settings") return "Preferències"
    if (n === "set_pref_material") return `Material «${String(result.material)}»${result.created ? " creat" : " canviat"}`
    if (n === "set_pref_defaults") return "Per defecte canviats"
    if (n === "set_pref_gaps") return "Folgances canviades"
    if (n === "set_default_machine") return `Màquina per defecte: ${String(result.machine)}`
    if (n === "list_hardware") return `${String(result.count)} ferratges`
    if (n === "set_hardware_default") return `Per defecte: ${String(result.hardware)}`
    if (n === "set_front_hardware") return `${String(result.hardware)} a «${String(result.module)}»`
    if (n === "get_hardware") return `Ferratge: ${String(result.name)}`
    if (n === "edit_hardware") return `${result.duplicated ? "Duplicat" : "Editat"}: ${String(result.hardware)}`
    if (n === "export_files") return `Baixat: ${String(result.file)}`
    if (n === "rename_document") return `Nom canviat: ${String(result.name)}`
    if (n === "duplicate_document") return `Duplicat: ${(result.copy as { name?: string }).name ?? ""}`
    if (n === "move_to_group") return result.group ? `Al grup «${String(result.group)}»` : "Tret del grup"
    if (n === "delete_document") return `Esborrat: ${(result.deleted as { name: string }).name}`
    if (n === "list_documents") return `${String(result.count)} ${String(result.kind)}${Number(result.count) === 1 ? "" : "s"}`
    return "On ets"
  },
}

const APP_NAMES = new Set(Object.keys(INPUTS))

/**
 * **Totes les eines, sempre les mateixes** (les de l'app i les de cada tipus de document): les instruccions i la llista
 * d'eines no poden canviar a mitja conversa (l'API lliga els blocs de pensament a les instruccions i a les eines, i
 * canviar-les trencava el torn en obrir un document). Cada eina de document va al joc del seu tipus i només serveix amb
 * un document d'aquell tipus obert.
 */
export async function allToolSet(settings: Settings): Promise<AssistantToolSet<unknown>> {
  const [{ mobleToolSet }, { objectToolSet }, { ambientAssistantToolSet }] = await Promise.all([import("../../core/assistant/tools"), import("../../core/assistant/objectTools"), import("./ambientLibrary")])
  const sets: { kind: "moble" | "objecte" | "ambient"; set: AssistantToolSet<unknown> }[] = [
    { kind: "moble", set: mobleToolSet({ settings }) as AssistantToolSet<unknown> },
    { kind: "objecte", set: objectToolSet({ settings }) as AssistantToolSet<unknown> },
    { kind: "ambient", set: ambientAssistantToolSet(settings) as unknown as AssistantToolSet<unknown> },
  ]
  // Les peces lliures (add_part, update_part…) també als mobles: allà es fabriquen (al nesting si el material és de CNC).
  const mobleParts = objectToolSet({ settings, fabricated: true }) as AssistantToolSet<unknown>
  const owner = new Map<string, (typeof sets)[number]>()
  for (const s of sets) for (const t of s.set.tools) if (!APP_NAMES.has(t.name) && !owner.has(t.name)) owner.set(t.name, s)
  const label = { moble: "un moble", objecte: "un objecte", ambient: "un ambient" }
  /** El joc que fa una eina amb el document obert (o per què no es pot). */
  const setFor = (name: string): AssistantToolSet<unknown> | string => {
    const o = owner.get(name)
    if (!o) return `Eina desconeguda «${name}».`
    const d = currentDoc()
    if (d && d.kind === o.kind) return o.set
    if (d?.kind === "moble" && o.kind === "objecte") return mobleParts
    const can = o.kind === "objecte" ? "un objecte o un moble" : label[o.kind]
    return `«${name}» és per a ${can} obert${d ? ` (ara és obert ${label[d.kind]})` : " (ara no n'hi ha cap)"}: obre'n un amb open_document.`
  }
  return {
    system: [APP_SYSTEM, ...sets.map((s) => `--- Eines per a ${label[s.kind]} obert ---\n${s.set.system}`), "--- Peces lliures en un moble ---\nLes eines de les peces lliures de l'objecte (get_object, add_part, update_part, remove_part, duplicate_part, set_group, move_group, duplicate_group) també serveixen amb un moble obert: allà són peces de debò que es fabriquen (van al nesting i als fitxers del taller si el material és de CNC; ferro, pedra o vidre, no). Amb shape polygon pots fer qualsevol contorn (punts en mm al pla de la peça, amb bulge per als arcs)."].join("\n\n"),
    tools: [...appToolSet.tools, ...sets.flatMap((s) => s.set.tools.filter((t) => owner.get(t.name) === s))],
    run: (doc, name, input) => {
      if (APP_NAMES.has(name)) return appToolSet.run(doc, name, input)
      const set = setFor(name)
      return typeof set === "string" ? { ok: false, error: set } : set.run(doc, name, input)
    },
    payload: (name, before, outcome) => {
      if (APP_NAMES.has(name)) return appToolSet.payload(name, before, outcome)
      const set = setFor(name)
      return typeof set === "string" ? outcome.result : set.payload(name, before, outcome)
    },
    describe: (name, result, payload) => {
      if (APP_NAMES.has(name)) return appToolSet.describe(name, result, payload)
      const set = setFor(name)
      return typeof set === "string" ? name : set.describe(name, result, payload)
    },
  }
}

/** Les eines de l'app més les del document obert (si n'hi ha): un sol joc per al torn. */
export function withAppTools(docSet: AssistantToolSet<unknown> | undefined): AssistantToolSet<unknown> {
  if (!docSet) return appToolSet
  return {
    system: `${APP_SYSTEM}\n\n--- Document obert ---\n${docSet.system}`,
    tools: [...appToolSet.tools, ...docSet.tools.filter((t) => !APP_NAMES.has(t.name))],
    run: (doc, name, input) => (APP_NAMES.has(name) ? appToolSet.run(doc, name, input) : docSet.run(doc, name, input)),
    payload: (name, before, outcome) => (APP_NAMES.has(name) ? appToolSet.payload(name, before, outcome) : docSet.payload(name, before, outcome)),
    describe: (name, result, payload) => (APP_NAMES.has(name) ? appToolSet.describe(name, result, payload) : docSet.describe(name, result, payload)),
  }
}
