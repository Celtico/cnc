import { machineWithRules } from "../../core/model"
import { buildComposition } from "../../core/build/buildComposition"
import { toCutList } from "../../core/cutlist/toCutList"
import { nest } from "../../core/nesting/nest"
import { nestPlan } from "../../core/nesting/machineNest"
import { cutListToCsv } from "../../core/export/csv"
import { toDxf } from "../../core/export/dxf"
import { toStepCad } from "../../core/export/step"
import { stepCadGroups } from "../../core/export/stepGroups"
import { encodeUtf16le, toTopsolidCsv } from "../../core/export/topsolidCsv"
import { xcsZip } from "../../core/export/maestroXcs"
import { cncNestOptions, toMaestroNestXcs } from "../../core/export/maestroNestXcs"
import { keepProject, updateProjectNesting } from "../../db/db"
import { downloadBlob, slugify } from "../../lib/download"
import { appSettings, openMoble, type AppToolHandlers } from "./appToolContext"

/** Eines de l'app per al taller del moble obert: peces, nesting, mida de tauler i fitxers per exportar. */

export const workshopHandlers: AppToolHandlers<"get_cutlist" | "get_nesting" | "set_sheet" | "export_files"> = {
  get_cutlist: async ({ doc }) => {
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
  },
  get_nesting: async ({ doc }) => {
    const m = await openMoble()
    if (typeof m === "string") return { ok: false, error: m }
    const panels = buildComposition(m.comp).panels
    const settings = appSettings()
    const machine = settings ? machineWithRules(settings) : undefined
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
  },
  set_sheet: async ({ doc, input }) => {
    const { w, h, material } = input
    const m = await openMoble()
    if (typeof m === "string") return { ok: false, error: m }
    const sheet = { w: Math.max(w, h), h: Math.min(w, h) }
    const next = material ? { ...m.nesting, sheetsByMaterial: { ...(m.nesting.sheetsByMaterial ?? {}), [material]: sheet } } : { ...m.nesting, sheet }
    await updateProjectNesting(m.id, next)
    return { ok: true, doc, result: { moble: m.name, sheet: `${sheet.w} × ${sheet.h}`, ...(material ? { material } : {}) } }
  },
  export_files: async ({ doc, input }) => {
    const { format } = input
    const m = await openMoble()
    if (typeof m === "string") return { ok: false, error: m }
    const b = buildComposition(m.comp)
    const panels = b.panels
    if (!panels.length) return { ok: false, error: "El moble no té cap peça per exportar." }
    const base = slugify(m.name)
    const settings = appSettings()
    const machine = settings ? machineWithRules(settings) : undefined
    const save = (blob: Blob, file: string) => {
      downloadBlob(blob, file)
      // Com a Exportar: el que s'ha enviat al taller s'ha de poder trobar (deixa de ser esborrany).
      void keepProject(m.id)
      return file
    }
    if (format === "xcs") {
      if (!machine) return { ok: false, error: "No hi ha cap màquina per defecte (Preferències › Màquines CNC): no es poden fer els programes de Maestro." }
      const plan = cncNestOptions(panels, machine, m.nesting)
      const opts = { project: m.name, kits: b.hardwareKits, lights: (b as { lightKits?: unknown }).lightKits, fittings: (b as { fittingOrders?: unknown }).fittingOrders } as Parameters<typeof toMaestroNestXcs>[3]
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
      const csv = toTopsolidCsv(panels, n, { project: m.name, ...(settings ? { label: settings.label } : {}) })
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
    const glb = await exportGlb(panels, m.name, { materials: appSettings()?.materials ?? [], make: exportablePanel }, b.models)
    return { ok: true, doc, result: { file: save(glb, `${base}.glb`) } }
  },
}
