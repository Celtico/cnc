import { useMemo } from "react"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { cncNestOptions, toMaestroNestXcs } from "../../core/export/maestroNestXcs"
import type { Machine, Panel } from "../../core/model"
import { DEFAULT_NEST_OPTIONS, nest, type NestOptions } from "../../core/nesting/nest"

/** Un programa per tauler del nesting (el Maestro del taller no en fa). */
export function useMaestroPrograms(machine: Machine | undefined, panels: Panel[], projectName: string | undefined, nestOptions: NestOptions | undefined, build: CompositionBuild | undefined) {
  return useMemo(() => {
    if (!machine || !panels.length) return null
    const name = projectName ?? "moble"
    const plan = cncNestOptions(panels, machine, nestOptions ?? DEFAULT_NEST_OPTIONS)
    const x = toMaestroNestXcs(panels, nest(panels, plan.options), machine, { project: name, kits: build?.hardwareKits, lights: build?.lightKits, fittings: build?.fittingOrders })
    // `sheetList`: els programes amb el seu text (el mateix que va al zip) per a la Vista CAM.
    return { ...x, sheets: x.sheets.length, sheetList: x.sheets, rows: x.panels, spacingTool: plan.tool }
  }, [machine, panels, projectName, nestOptions, build?.hardwareKits, build?.lightKits, build?.fittingOrders])
}

export type MaestroPrograms = NonNullable<ReturnType<typeof useMaestroPrograms>>
