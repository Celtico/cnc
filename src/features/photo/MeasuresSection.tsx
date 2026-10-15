import { useMemo } from "react"
import { LuMoveHorizontal } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { toaster } from "../../components/ui/toaster"
import type { Composition } from "../../core/model"
import type { Measure } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"
import type { SetCal } from "./calibration"
import { MeasureTable } from "./MeasureTable"
import { applyTargets, type ApplyTarget } from "./applyTargets"
import type { CalibrationScene } from "./useCalibrationScene"

/** Secció «Mesures»: la taula de mesures i aplicar-les al moble. */
export function MeasuresSection({
  applied,
  setCal,
  scene,
  composition,
  onApplyMeasure,
}: {
  applied: PhotoCalibration["applied"]
  setCal: SetCal
  scene: CalibrationScene
  composition?: Composition
  onApplyMeasure?: (target: string, valueMm: number) => void
}) {
  const { measures, values } = scene
  const targets = useMemo(() => applyTargets(composition), [composition])
  const appliedByMeasure = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of applied ?? []) m.set(a.measureId, [...(m.get(a.measureId) ?? []), a.label])
    return m
  }, [applied])

  const updateMeasure = (id: string, patch: Partial<Measure>) => setCal((c) => ({ ...c, measures: (c.measures ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  const removeMeasure = (id: string) => setCal((c) => ({ ...c, measures: (c.measures ?? []).filter((m) => m.id !== id), applied: (c.applied ?? []).filter((a) => a.measureId !== id) }))

  const applyMeasure = (m: Measure, t: ApplyTarget, value: number, which: "main" | "second") => {
    if (!onApplyMeasure) return
    onApplyMeasure(t.id, Math.round(value))
    const label = which === "second" ? `${t.label} (alçada)` : t.label
    setCal((c) => ({ ...c, applied: [...(c.applied ?? []).filter((a) => a.target !== t.id), { measureId: m.id, target: t.id, label, which }] }))
    const v = values.find((x) => x.id === m.id)
    // La cinta només dona el valor principal: l'alçada d'un rectangle continua essent estimada.
    const real = (which === "second" ? v?.state2 : v?.state) === "real"
    toaster.create({ title: `${t.label}: ${Math.round(value)} mm`, description: real ? "Mida real (cinta)." : "Mida estimada a partir de la foto: no tallis amb aquesta mida.", type: "success" })
  }

  return (
    <FoldItem id="photo-measures" title="Mesures" icon={LuMoveHorizontal} badge={measures.length || undefined}>
      <MeasureTable measures={measures} values={values} targets={targets} applied={appliedByMeasure} onChange={updateMeasure} onRemove={removeMeasure} onApply={applyMeasure} />
    </FoldItem>
  )
}
