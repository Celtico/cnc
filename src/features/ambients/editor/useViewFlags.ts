import { usePersistentFlag } from "../../../lib/usePersistentFlag"

/** Opcions de vista (recordades), com a l'editor. */
export function useViewFlags() {
  const [showGrid, setShowGrid] = usePersistentFlag("mobles:ambient-grid", true)
  const [showDims, setShowDims] = usePersistentFlag("mobles:ambient-dims", true)
  const [showLabels, setShowLabels] = usePersistentFlag("mobles:ambient-labels", true)
  const [showDetail, setShowDetail] = usePersistentFlag("mobles:ambient-detail", true)
  const [snapOn, setSnapOn] = usePersistentFlag("mobles:ambient-snap", true)
  const [showPlan, setShowPlan] = usePersistentFlag("mobles:ambient-plan", true)
  const [dollhouse, setDollhouse] = usePersistentFlag("mobles:ambient-dollhouse", true)
  const [shadows, setShadows] = usePersistentFlag("mobles:ambient-shadows", true)
  const [ceiling, setCeiling] = usePersistentFlag("mobles:ambient-ceiling", true)
  const [roofOn, setRoofOn] = usePersistentFlag("mobles:ambient-roof", true)
  return {
    showGrid,
    setShowGrid,
    showDims,
    setShowDims,
    showLabels,
    setShowLabels,
    showDetail,
    setShowDetail,
    snapOn,
    setSnapOn,
    showPlan,
    setShowPlan,
    dollhouse,
    setDollhouse,
    shadows,
    setShadows,
    ceiling,
    setCeiling,
    roofOn,
    setRoofOn,
  }
}

export type ViewFlagsState = ReturnType<typeof useViewFlags>
