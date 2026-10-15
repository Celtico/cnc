import { useEffect, useState } from "react"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { toStepCad } from "../../core/export/step"
import { stepCadGroups } from "../../core/export/stepGroups"
import type { Composition, Panel } from "../../core/model"

/**
 * Els avisos del STEP demanen fer tot el fitxer (~0,25 s en una cuina gran): es calculen quan el navegador és lliure,
 * després de pintar la pàgina, i l'alerta surt en acabar (la pàgina no s'encalla en obrir-la ni en tocar un interruptor).
 */
export function useStepWarnings(comp: Composition | undefined, build: CompositionBuild | undefined, panels: Panel[], stepExtras: boolean): string[] {
  const [stepWarningsRaw, setStepWarnings] = useState<string[]>([])
  const stepWarnings = comp && build && panels.length ? stepWarningsRaw : []
  useEffect(() => {
    if (!comp || !build || !panels.length) return
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const run = () => setStepWarnings(toStepCad(stepCadGroups(comp, build, { extras: stepExtras }), { name: "check" }).warnings)
    const id = idle ? idle(run, { timeout: 1500 }) : window.setTimeout(run, 50)
    return () => {
      const cancel = (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
      if (idle && cancel) cancel(id)
      else window.clearTimeout(id)
    }
  }, [comp, build, panels, stepExtras])
  return stepWarnings
}
