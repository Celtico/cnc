import { type Module } from "./composition"
import { kitFrom } from "./hardware"
import { defaultMachine, withWorkshopRules, type Machine, type MachineRules } from "./machine"
import type { MaterialPref, RefPreset, Settings } from "./settingsSchema"

/**
 * Preferències de l'usuari (vegeu `settingsSchema.ts`): els esquemes a `settingsSchema.ts`, els valors inicials a
 * `settingsDefaults.ts` i la lectura, migració i importació a `settingsParse.ts`. Aquí, el que se'n fa servir als mòduls.
 */
export * from "./settingsSchema"
export { BUILTIN_REFERENCES, NON_CNC_MATERIALS, LAWN_FINISH, LAMPSHADE_GLOW, SIM_MATERIALS, SIM_MATERIALS_SINCE, TEMPLATE_MATERIALS, BUILTIN_MATERIALS, DEFAULT_SETTINGS } from "./settingsDefaults"
export { parseSettings, addCatalogThicknesses, rulesFromMachines, settingsToJson, settingsFromJson, importSettingsJson } from "./settingsParse"

/**
 * La màquina de l'export (la per defecte, `defaultMachine`) amb les regles del taller a `rules` (`withWorkshopRules`): la
 * forma que llegeixen els exports (`toMaestroNestXcs`, `cncNestOptions`, `nestPlan`). Mateix objecte per a les mateixes
 * preferències (memòria per objecte), així es pot posar a les dependències d'un `useMemo`.
 */
export function machineWithRules(s: Pick<Settings, "machines" | "machiningRules">): Machine | undefined {
  const hit = workshopMachineCache.get(s)
  if (hit && hit.machines === s.machines && hit.rules === s.machiningRules) return hit.machine
  const m = defaultMachine(s.machines)
  const machine = m ? withWorkshopRules(m, s.machiningRules) : undefined
  workshopMachineCache.set(s, { machines: s.machines, rules: s.machiningRules, machine })
  return machine
}
const workshopMachineCache = new WeakMap<object, { machines: readonly Machine[]; rules: MachineRules; machine: Machine | undefined }>()

// --- Aplicació a mòduls nous -----------------------------------------------------------

/** Referències visibles (no amagades). */
export function visibleReferences(s: Settings): RefPreset[] {
  return s.references.filter((r) => !r.hidden)
}

/** Un objecte només pot ser fantasma 3D si té fondària. */
export function canBeGhost(r: RefPreset): boolean {
  return typeof r.d === "number" && r.d > 0
}

export function materialByName(s: Settings, name: string): MaterialPref | undefined {
  return s.materials.find((m) => m.name === name)
}

/** Un mòdul nou pren ferratges, jocs i materials de les preferències; els existents no canvien. */
export function applySettingsToModule(s: Settings, m: Module): Module {
  return {
    ...m,
    carcass: {
      ...m.carcass,
      material: s.defaults.material,
      thickness: s.defaults.thickness,
      backMaterial: s.defaults.backMaterial,
      backThickness: s.defaults.backThickness,
      shelfClearance: s.gaps.shelfClearance,
      shelfSetback: s.gaps.shelfSetback,
      backClearance: s.gaps.backClearance,
      backSetback: s.gaps.backSetback,
      grooveDepth: s.gaps.grooveDepth,
      ...(s.gaps.grooveClearance ? { grooveClearance: s.gaps.grooveClearance } : {}),
      innerClearance: s.gaps.innerClearance,
    },
    fronts: { ...m.fronts, outerGap: s.gaps.outerGap, betweenGap: s.gaps.betweenGap },
    hardware: kitFrom(s.hardwareLibrary, s.hardwareDefaults),
  }
}

/** Mida de tauler per a un material (la primera regla que coincideix; buit = totes). */
export function sheetFor(s: Settings, material: string): { w: number; h: number } {
  const hit = s.boards.sheets.find((x) => x.material === material) ?? s.boards.sheets.find((x) => x.material === "")
  return hit ? { w: hit.w, h: hit.h } : { w: 2800, h: 2070 }
}
