import { exportGlb } from "../../components/viewer/exportGlb"
import { exportablePanel } from "../../components/viewer/exportablePanel"
import { exportUsdz, openQuickLook } from "../../components/viewer/exportUsdz"
import { toaster } from "../../components/ui/toaster"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { toCutList } from "../../core/cutlist/toCutList"
import { cutListToCsv } from "../../core/export/csv"
import { linearCsvRows } from "../../core/build/linearOrders"
import { toDxf } from "../../core/export/dxf"
import { labelsPdf, pieceLabels } from "../../core/export/labelsPdf"
import { xcsZip } from "../../core/export/maestroXcs"
import { toStepCad } from "../../core/export/step"
import { stepCadGroups } from "../../core/export/stepGroups"
import { encodeUtf16le, toTopsolidCsv } from "../../core/export/topsolidCsv"
import { toUnifiedData } from "../../core/export/unified"
import type { Composition, Machine, Panel, Settings } from "../../core/model"
import type { Nesting } from "../../core/nesting/nest"
import { keepProject } from "../../db/db"
import { downloadBlob as saveBlob, downloadText as saveText } from "../../lib/download"
import type { MaestroPrograms } from "./useMaestroPrograms"

interface ExportContext {
  project: { id: number; name: string }
  base: string
  comp: Composition | undefined
  build: CompositionBuild | undefined
  panels: Panel[]
  nesting: Nesting | undefined
  settings: Settings
  labels: boolean
  dxf3d: boolean
  stepExtras: boolean
  stepColor: (p: { material: string }) => [number, number, number]
  layerCount: number
  xcs: MaestroPrograms | null
  machine: Machine | undefined
  warnEstimated: () => void
  setBusy: (v: boolean) => void
  setBusyAr: (v: boolean) => void
}

/** Les accions de descàrrega de la pantalla d'Exportar (es tornen a fer a cada render, com abans). */
export function exportActions(c: ExportContext) {
  const { project, base, comp, build, panels, nesting, settings, labels, dxf3d, stepExtras, stepColor, layerCount, xcs, machine, warnEstimated, setBusy, setBusyAr } = c
  // Exportar-lo el deixa a l'Historial encara que no s'hagi tocat (s'ha de poder trobar què es va enviar al taller).
  const downloadBlob = (blob: Blob, name: string) => {
    saveBlob(blob, name)
    void keepProject(project.id)
  }
  const downloadText = (text: string, name: string, mime?: string) => {
    saveText(text, name, mime)
    void keepProject(project.id)
  }

  const doStep = () => {
    if (!comp || !build) return
    warnEstimated()
    const step = toStepCad(stepCadGroups(comp, build, { extras: stepExtras }), { name: project.name, color: stepColor })
    downloadBlob(new Blob([step.text], { type: "application/step" }), `${base}.step`)
    toaster.create({
      title: "STEP de TopSolid generat",
      description: `${step.solids} peces en conjunts per mòdul, amb ingletes i colors` + (step.warnings.length ? ` · ${step.warnings.length} avisos` : ""),
      type: step.warnings.length ? "warning" : "success",
    })
  }
  const doTopsolidCsv = () => {
    if (!nesting) return
    warnEstimated()
    const csv = toTopsolidCsv(panels, nesting, { project: project.name, label: settings.label })
    downloadBlob(new Blob([encodeUtf16le(csv.text)], { type: "text/csv" }), `${base}_res.csv`)
    const tight = csv.rows.filter((r) => !r.labelFits).length
    toaster.create({
      title: "CSV de nesting generat",
      description:
        `${csv.rows.length} peces en ${nesting.boards.length + csv.unplaced.length} taulers` +
        (tight ? `. ${tight} peces massa petites per a l'etiqueta (al centre).` : ""),
      type: csv.unplaced.length ? "warning" : "success",
    })
  }
  const doDxf = () => {
    warnEstimated()
    downloadText(toDxf(panels, { labels, threeD: dxf3d }), `${base}.dxf`, "application/dxf")
    toaster.create({ title: "DXF generat", description: `${panels.length} peces, ${layerCount} capes`, type: "success" })
  }
  const doXcs = () => {
    if (!xcs || !machine) return
    warnEstimated()
    const zip = xcsZip(xcs)
    downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${base}-maestro.zip`)
    toaster.create({
      title: "Programes de Maestro generats",
      description: `${xcs.programs} programes .xcs per tauler per a ${machine.name}` + (xcs.warnings.length ? ` · ${xcs.warnings.length} avisos (al LLEGEIX-ME.txt)` : ""),
      type: xcs.warnings.length ? "warning" : "success",
    })
  }
  const doLabels = () => {
    warnEstimated()
    const list = pieceLabels(panels, nesting)
    downloadBlob(new Blob([labelsPdf(list, { project: project.name, label: settings.label }) as BlobPart], { type: "application/pdf" }), `${base}-etiquetes.pdf`)
    toaster.create({ title: "Etiquetes generades", description: `${list.length} etiquetes de ${settings.label.w} × ${settings.label.h} mm`, type: "success" })
  }
  const doCsv = () => downloadText(cutListToCsv(toCutList(panels), {}, linearCsvRows(build?.linearOrders ?? [])), `${base}-peces.csv`, "text/csv")
  const doJson = () =>
    downloadText(
      JSON.stringify(toUnifiedData(panels, { name: project.name, nesting }), null, 2),
      `${base}-unified.json`,
      "application/json",
    )
  const doGlb = async () => {
    setBusy(true)
    try {
      downloadBlob(await exportGlb(panels, project.name, { materials: settings.materials, make: exportablePanel }, build?.models), `${base}.glb`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar el GLB", description: String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  const doUsdz = async (open: boolean) => {
    setBusyAr(true)
    try {
      const blob = await exportUsdz(panels, project.name, { materials: settings.materials, make: exportablePanel }, build?.models)
      if (open) openQuickLook(blob, `${base}.usdz`)
      else downloadBlob(blob, `${base}.usdz`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar l'USDZ", description: String(e), type: "error" })
    } finally {
      setBusyAr(false)
    }
  }

  return { doStep, doTopsolidCsv, doDxf, doXcs, doLabels, doCsv, doJson, doGlb, doUsdz }
}
