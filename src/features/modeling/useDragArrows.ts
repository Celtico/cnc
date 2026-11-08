import { useMemo, useRef } from "react"
import type { ArrowHandles } from "../../components/viewer/facePick"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { Composition } from "../../core/model"
import type { SetComp } from "../editor/useEditorDoc"
import { dragArrow, dragArrows } from "./dragArrows"
import type { FaceToolId, FaceToolOpts } from "./faceToolOptions"

/**
 * Les fletxes d'arrossegar de l'eina activa (`dragArrows`) per al visor: en viu mentre s'arrossega (des de la composició
 * d'abans de començar) i un sol pas de desfer en deixar-les.
 */
export function useDragArrows(tool: FaceToolId | null, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, selectedPart: string | null, setComp: SetComp, commit: () => void): ArrowHandles | null {
  const base = useRef<{ comp: Composition; build: CompositionBuild } | null>(null)
  const arrows = useMemo(() => dragArrows(tool, o, comp, build, selectedPart), [tool, o, comp, build, selectedPart])
  const latest = useRef({ comp, build })
  latest.current = { comp, build }
  return useMemo(() => {
    if (!arrows.length) return null
    return {
      arrows,
      onDrag: (id, mm, tol, free) => {
        if (!base.current) {
          const { comp: c, build: b } = latest.current
          if (!b) return null
          base.current = { comp: c, build: b }
        }
        const r = dragArrow(id, mm, base.current.comp, base.current.build, tol, free)
        if (!r) return null
        setComp(r.comp, { commit: false })
        return r.label
      },
      onDrop: (id) => {
        const was = base.current
        base.current = null
        if (id && was) commit()
      },
    }
  }, [arrows, setComp, commit])
}
