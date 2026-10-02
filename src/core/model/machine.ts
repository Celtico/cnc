import { z } from "zod"

/**
 * Màquina CNC del taller (SCM amb Xilog Maestro), importada del context de màquina que exporta
 * Maestro (`<sèrie>.machinecontext`: Tlgx/def.tlgx, Atrx/def.atrx, Cfgx/<sèrie>.cfgx…). Es desa a
 * les preferències (`Settings.machines`). Mm sempre.
 */

/** Tipus d'eina per a l'export: broca (perforadora), fresa (electromandrí), disc de serra, agregat, palpador. */
export const ToolKindSchema = z.enum(["drill", "router", "blade", "aggregate", "probe", "other"])
export type ToolKind = z.infer<typeof ToolKindSchema>

export const TOOL_KIND_LABELS: Record<ToolKind, string> = {
  drill: "Broques",
  router: "Freses",
  blade: "Discs de serra",
  aggregate: "Agregats",
  probe: "Palpadors",
  other: "Altres",
}

export const MachineToolSchema = z.object({
  /** Codi de l'eina a Maestro (el que va al paràmetre `tool` de l'MSL): «003», «E128». */
  code: z.string().min(1),
  /** Nom llegible (descripció de Maestro o del taller): «5mm ESQ», «Diamant D12». Editable. */
  name: z.string(),
  kind: ToolKindSchema,
  /** Broques: vertical (cara de dalt) o horitzontal (cantells). */
  orientation: z.enum(["vertical", "horizontal"]).optional(),
  /** Diàmetre de tall. */
  diameter: z.number().min(0),
  /** Fondària màxima útil (SinkingLength de Maestro). 0 = desconeguda. */
  maxDepth: z.number().min(0),
  /** Llargada total (OverallAssemblyLength / PilotLength). */
  length: z.number().min(0).optional(),
  /** Discs: gruix del tall. */
  bladeThickness: z.number().min(0).optional(),
  /** Sentit de gir (HandOfCut): les broques van en parells esquerra/dreta. */
  rotation: z.enum(["left", "right"]).optional(),
  /** Tipus de punta de la broca (Maestro: FlatDrill, LanceDrill…). */
  tip: z.string().optional(),
  /** Capçals on és muntada (de l'.atrx): 1 = perforadora, 3/6 = electromandrins… */
  heads: z.array(z.number().int()).optional(),
  /** Mandrins de la perforadora on és muntada (de l'.atrx). */
  spindles: z.array(z.number().int()).optional(),
  /** Muntada a la màquina (a l'.atrx). Sense .atrx es considera que sí. */
  mounted: z.boolean(),
  /** Es fa servir per triar eines automàticament a l'export (no els exemples ni els palpadors). */
  auto: z.boolean(),
  /** Afegida a mà (no ve de Maestro). */
  manual: z.boolean().optional(),
})
export type MachineTool = z.infer<typeof MachineToolSchema>

export const MachineSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Número de sèrie / nom del context: «AA10008021». */
  serial: z.string(),
  /** Model o descripció de la configuració: «5020*1905 8 BARRE MATIC 4 BASI». */
  model: z.string(),
  /** Versió de Maestro de l'equipament d'eines (.atrx): «2.00.004». */
  maestroVersion: z.string(),
  /** Camp de treball útil, si se'n coneix (de la descripció de la configuració). */
  workArea: z.object({ x: z.number().positive(), y: z.number().positive() }).optional(),
  /** Àrees de treball de la configuració (A, B…). */
  areas: z.array(z.string()),
  /** Capçalera del programa (XilogHeaderParameters): `SetMachiningParameters(fields, 1, table, mech, false)`. */
  header: z.object({
    executionFields: z.string().min(1),
    tableOptions: z.number().int(),
    mechanicalOptions: z.number().int(),
  }),
  /** Passada de més dels talls i forats passants per sota de la peça (mm). */
  throughExtra: z.number().min(0).max(5),
  /** Ranures: serra si es pot (i fresa si no), sempre fresa o sempre serra. */
  grooves: z.enum(["auto", "router", "blade"]),
  /** La màquina per defecte de l'export. */
  isDefault: z.boolean(),
  tools: z.array(MachineToolSchema),
  importedAt: z.number().optional(),
})
export type Machine = z.infer<typeof MachineSchema>

/** La màquina de l'export: la marcada per defecte o la primera. */
export function defaultMachine(machines: readonly Machine[]): Machine | undefined {
  return machines.find((m) => m.isDefault) ?? machines[0]
}
