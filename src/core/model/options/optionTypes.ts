/**
 * El registre de les **opcions en cascada** de l'Editor (Preferències › Opcions en cascada): una entrada per secció o fila
 * dels inspectors (moble, mòdul, compartiment, peça lliure, objecte de referència i selecció múltiple), amb un id estable
 * que la fila de la UI porta (`optionId`) i que un test comprova (`src/optionCascade.test.ts`). Només dades.
 *
 * És la cascada **tal com és al codi** i la llavor de l'esborrany de Preferències › Opcions en cascada (`cascadeDraft.ts`):
 * l'usuari hi dibuixa com la vol, però res no s'aplica a l'Editor (per decisió de l'usuari, 2026-10-15: «no per aplicar a la
 * realitat fins que no ho tinguem clar»). `hideable`, `defaultEditable` i `why` són informatius: el que es podria amagar o
 * triar si un dia es fa.
 */

/** Valor per defecte: el `value` d'una tria, un número (mm, unitats) o un interruptor. */
export type OptionValue = string | number | boolean

/** `group`: un inspector o un apartat que no és cap fila (no porta `optionId`); `section`: una secció plegable; `field`: una fila. */
export type OptionKind = "group" | "section" | "field"

/** El control de la fila a l'inspector. */
export type OptionControl = "choice" | "switch" | "number" | "material" | "hardware" | "text" | "buttons"

/** Icones de les seccions (les de l'inspector; la UI les tradueix a `react-icons/lu`). */
export const OPTION_ICON_IDS = [
  "structure", "moble", "module", "zone", "part", "ref", "multi",
  "summary", "joinery", "scene", "materials", "position", "dims", "appliance", "carcass", "doors", "joint",
  "front", "shelves", "divide", "split", "subsection", "effect", "orient", "shape", "cnc", "group", "attach",
  "hardware", "align", "items",
] as const
export type OptionIcon = (typeof OPTION_ICON_IDS)[number]

export interface OptionChoice {
  value: string
  label: string
  /** Opcions que fa aparèixer (ids del registre). */
  reveals?: string[]
  /** Opcions que fa desaparèixer (ids del registre). */
  hides?: string[]
  note?: string
}

export interface OptionNode {
  /** Estable: `module.carcass.back`, `zone.front.kind`… La fila de la UI el porta a `optionId`. */
  id: string
  label: string
  kind: OptionKind
  icon?: OptionIcon
  control?: OptionControl
  choices?: OptionChoice[]
  /** Límits del valor (`number`): els de la fila de l'inspector. */
  range?: { min: number; max: number; step: number; suffix?: string }
  /** Quan surt (en català). Sense: sempre que surt la secció de sobre. */
  showIf?: string
  /** El valor d'un mòdul (compartiment, peça) nou segons el codi. */
  default?: OptionValue
  /** El per defecte en paraules quan no és un valor simple («Com el mòdul», «Preferències › Materials»…). */
  defaultText?: string
  /** Informatiu: se'n podria triar el valor per defecte (no s'aplica). */
  defaultEditable?: boolean
  /** Informatiu: es podria amagar (llavors faria servir el valor per defecte; no s'aplica). */
  hideable: boolean
  /** Per què no es pot amagar (o una nota de l'amagar). */
  why?: string
  /** El fitxer de la UI on és (relatiu a `src/`): el test comprova que hi porta l'id. */
  code: string
  /** Possible incoherència trobada a l'auditoria (2026-10-15): surt marcada a l'esborrany, no s'ha corregit. */
  issue?: string
  note?: string
  children?: OptionNode[]
}

type Props = Omit<Partial<OptionNode>, "id" | "label" | "kind" | "children">

/** Un inspector o un apartat sense fila (no es pot amagar ni té valor per defecte). */
export const group = (id: string, label: string, p: Props, children: OptionNode[] = []): OptionNode => ({ id, label, kind: "group", hideable: false, code: "", ...p, children })

/** Una secció plegable de l'inspector (`FoldItem optionId`). Per defecte, es pot amagar. */
export const section = (id: string, label: string, p: Props & { code: string }, children: OptionNode[] = []): OptionNode => ({ id, label, kind: "section", hideable: true, ...p, children })

/** Una fila de l'inspector (`FormRow`/`NumRow`/`HardwarePick optionId`). Per defecte, es pot amagar. */
export const field = (id: string, label: string, p: Props & { code: string }, children: OptionNode[] = []): OptionNode => ({ id, label, kind: "field", hideable: true, ...p, children })

/** Fitxers de la UI (relatius a `src/`). */
export const UI = {
  inspector: "features/editor/EditorInspector.tsx",
  sections: "features/editor/InspectorSections.tsx",
  carcass: "features/composition/CarcassForm.tsx",
  base: "features/composition/BaseFields.tsx",
  pick: "features/composition/HardwarePick.tsx",
  zonePanel: "features/composition/ZonePanel.tsx",
  frontSection: "features/composition/zone/FrontSection.tsx",
  frontFields: "features/composition/zone/FrontFields.tsx",
  drawers: "features/composition/zone/DrawerFields.tsx",
  shelves: "features/composition/zone/ShelvesSection.tsx",
  split: "features/composition/zone/SplitSizes.tsx",
  appliance: "features/composition/zone/ApplianceSection.tsx",
  part: "features/composition/PartInspector.tsx",
  multi: "features/composition/PartInspector.tsx",
  ref: "features/composition/RefInspector.tsx",
  tree: "features/composition/StructureTree.tsx",
} as const

/** Per defecte d'un ferratge triat a cada front o compartiment. */
export const AS_MODULE = "Com el mòdul (el de Preferències › Ferratges)"
/** No es pot amagar: sense, no es podria fer el moble (o la peça) que cal. */
export const STRUCTURAL = "No es pot amagar: sense aquesta opció no es podria fer el moble que cal (mides, posició o una peça de la caixa de la qual depèn tot el que hi va a dins)."
