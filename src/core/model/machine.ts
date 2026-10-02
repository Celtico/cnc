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

/** Camps d'una eina que l'usuari pot tocar: una reimportació no els trepitja (`MachineTool.edited`). */
export const TOOL_EDITABLE = ["name", "auto", "mounted", "maxDepth", "orientation"] as const
export type ToolEditable = (typeof TOOL_EDITABLE)[number]

export const MachineToolSchema = z.object({
  /** Codi de l'eina al .tlgx (`Name` del `CoreTool`): «003», «E128». Identifica l'eina a l'app. */
  code: z.string().min(1),
  /** Nom llegible (descripció de Maestro o del taller): «5mm ESQ», «Diamant D12». Editable. */
  name: z.string(),
  /** Identificador intern de Maestro (`Key/ID` del `CoreTool`, `ToolKey/ID` dels .pgmx): «2149647431». */
  id: z.string().optional(),
  /**
   * Nom de l'eina a la versió de Maestro del taller, llegit d'un .pgmx (`ToolKey/Name`, «12mm diamant
   * nesting»). És el que va al paràmetre `tool` de l'MSL (manual p36: «Tool name»); sense, el codi.
   */
  mslName: z.string().min(1).optional(),
  /** Camps tocats a mà (es conserven en tornar a importar). */
  edited: z.array(z.enum(TOOL_EDITABLE)).optional(),
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

/**
 * Regles de mecanitzat (les del taller). Les eines van pel nom (el de l'MSL, el nom o el codi: `findRuleTool`);
 * si la màquina no en té cap amb aquell nom, l'export tria com sempre i avisa.
 */
export const MachineRulesSchema = z.object({
  /** Ranures (obertes per algun extrem): eina i fondària màxima per passada (més fondes, diverses passades). */
  grooves: z.object({ tool: z.string(), maxPass: z.number().min(0.5).max(50) }),
  /** Caixeres (rebaixos cecs tancats pels quatre costats): eina. */
  pockets: z.object({ tool: z.string() }),
  /** Perfilar (contorns per fora i talls passants per dins): eina segons el gruix del tauler (mm, inclosos). */
  profile: z.array(z.object({ min: z.number().min(0), max: z.number().min(0), tool: z.string() })),
  /** Perfilats del nesting: entrada en rampa (`SetApproachStrategy` en baixada, manual p71); llargada en mm. */
  ramp: z.object({ enabled: z.boolean(), length: z.number().min(1).max(500) }),
  /**
   * Peces petites (àrea < `maxArea` m², o algun costat < `maxSide` si no és 0): el contorn en passades de desbast que deixen
   * `z` mm a baix i `xy` mm al costat, i una passada final fins al martiri (la de sempre). Les normals, una passada.
   */
  small: z.object({
    maxSide: z.number().min(0),
    maxArea: z.number().min(0),
    passes: z.array(z.object({ z: z.number().min(0).max(20), xy: z.number().min(0).max(10) })),
  }),
})
export type MachineRules = z.infer<typeof MachineRulesSchema>

/**
 * Regles per defecte (les del germà, 2026): ranures «8mm diamant» a 6 mm per passada; caixeres «12mm diamant
 * nesting»; perfilar 8–22 mm amb «12mm diamant nesting» i 23–41 mm amb «14mm diamant nesting»; rampa de 40 mm;
 * peces petites (menys de 0,8 m², del taller) en 3 passades: Z 1 / XY 1, Z 0,5 / XY 0 i la final.
 */
export const defaultMachineRules = (): MachineRules => ({
  grooves: { tool: "8mm diamant", maxPass: 6 },
  pockets: { tool: "12mm diamant nesting" },
  profile: [
    { min: 8, max: 22, tool: "12mm diamant nesting" },
    { min: 23, max: 41, tool: "14mm diamant nesting" },
  ],
  ramp: { enabled: true, length: 40 },
  small: {
    maxSide: 0,
    maxArea: 0.8,
    passes: [
      { z: 1, xy: 1 },
      { z: 0.5, xy: 0 },
    ],
  },
})

/** Regles de la màquina (les de per defecte si no en té). */
export const machineRules = (m: Pick<Machine, "rules">): MachineRules => m.rules ?? defaultMachineRules()

/** Màquina amb regles (migració en carregar: additiu i idempotent; les que ja en tenen no es toquen). */
export const withMachineRules = <M extends Pick<Machine, "rules"> & { nesting?: Machine["nesting"] }>(m0: M): M => {
  // Separació provisional d'abans (Ø + 1) → la del taller (Ø + 2); una d'editada es queda.
  const m = m0.nesting?.spacingExtra === 1 ? { ...m0, nesting: { ...m0.nesting, spacingExtra: 2 } } : m0
  if (!m.rules) return { ...m, rules: defaultMachineRules() }
  // El llindar provisional d'abans (costat < 300 mm o < 0,1 m²) passa al del taller (< 0,8 m²); un d'editat es queda.
  const s = m.rules.small
  return s.maxSide === 300 && s.maxArea === 0.1 ? { ...m, rules: { ...m.rules, small: { ...s, maxSide: 0, maxArea: 0.8 } } } : m
}

/** Peça petita segons les regles: àrea (m²) < `maxArea`, o algun costat < `maxSide` (si no és 0). */
export const isSmallPart = (r: MachineRules, length: number, width: number, area = length * width): boolean =>
  (r.small.maxSide > 0 && Math.min(length, width) < r.small.maxSide) || area / 1e6 < r.small.maxArea

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
  /**
   * Capçalera del programa: `SetMachiningParameters(executionFields, repetitions, tableOptions,
   * mechanicalOptions, continuousCycle)` (manual §3.9.1 p114, Table 79). Valors de XilogHeaderParameters o
   * d'un .pgmx del taller (`MachiningParameters`). `technologicalMirror` i `preserveWorkingSequence` no
   * tenen paràmetre a l'MSL: només es desen per informar (vegeu docs/maestro-xcs.md).
   */
  header: z.object({
    executionFields: z.string().min(1),
    repetitions: z.number().int().min(1).default(1),
    tableOptions: z.number().int(),
    mechanicalOptions: z.number().int(),
    continuousCycle: z.boolean().default(false),
    technologicalMirror: z.boolean().optional(),
    preserveWorkingSequence: z.boolean().optional(),
  }),
  /** Passada de més dels talls i forats passants per sota de la peça (mm). */
  throughExtra: z.number().min(0).max(5),
  /** Ranures: serra si es pot (i fresa si no), sempre fresa o sempre serra. */
  grooves: z.enum(["auto", "router", "blade"]),
  /**
   * Broques verticals: «auto» = eina `"-1"` (la tria el Maestro, com als .pgmx del taller: la
   * DrillingOperation no porta ToolKey); «tool» = el nom de la broca triada per l'app.
   */
  verticalDrills: z.enum(["auto", "tool"]).default("auto"),
  /**
   * Programes per tauler (nesting): fresa del contorn, separació entre peces, marge del tauler i passada
   * dins del martiri. Opcional: sense, `DEFAULT_MACHINE_NESTING` (`machineNesting`).
   */
  nesting: z
    .object({
      /** Codi de la fresa de nesting; sense, la que diu «nesting» al nom o la més petita que travessa. */
      tool: z.string().optional(),
      /** Marge de la vora del tauler que no s'aprofita (mm). */
      edgeTrim: z.number().min(0).max(100),
      /** Separació entre peces = Ø de la fresa + això (mm). */
      spacingExtra: z.number().min(0).max(20),
      /** Passada de més dins del martiri als talls passants i contorns (mm). */
      overcut: z.number().min(0).max(3),
      /** Contorns de les peces petites: al final (per defecte) o al principi. */
      smallParts: z.enum(["last", "first"]),
    })
    .optional(),
  /**
   * Regles de mecanitzat del taller (eines per tipus de mecanitzat, passades, rampa, peces petites). Opcional a
   * l'esquema: les màquines desades abans no en tenen i en carregar-les se'ls posen les de per defecte
   * (`withMachineRules`); per llegir-les, `machineRules`.
   */
  rules: MachineRulesSchema.optional(),
  /** D'on venen els noms de les eines (`mslName`) i la capçalera: el .pgmx importat. */
  pgmx: z.object({ file: z.string(), version: z.string(), tools: z.number().int(), importedAt: z.number() }).optional(),
  /** La màquina per defecte de l'export. */
  isDefault: z.boolean(),
  tools: z.array(MachineToolSchema),
  importedAt: z.number().optional(),
})
export type Machine = z.infer<typeof MachineSchema>

/** Capçalera per defecte: la del .pgmx real del taller (Proyecto1, Maestro 2.0.5 rev 1005). */
export const DEFAULT_HEADER: Machine["header"] = { executionFields: "AD", repetitions: 1, tableOptions: 10, mechanicalOptions: 16973824, continuousCycle: false }

export type MachineNesting = NonNullable<Machine["nesting"]>

/** Opcions de nesting per defecte: marge 10, separació Ø + 1, martiri 0,3 mm, peces petites al final. */
// Separació del taller: Ø + 2 (14 mm amb la fresa de 12, 16 amb la de 14).
export const DEFAULT_MACHINE_NESTING: MachineNesting = { edgeTrim: 10, spacingExtra: 2, overcut: 0.3, smallParts: "last" }

/** Opcions de nesting de la màquina (amb els valors per defecte). */
export const machineNesting = (m: Pick<Machine, "nesting">): MachineNesting => ({ ...DEFAULT_MACHINE_NESTING, ...m.nesting })

/** Codi provisional d'una «Eina nova» (`NOVA1`…): no es tria fins que no se li posa el codi de Maestro. */
export const isPlaceholderTool = (t: Pick<MachineTool, "code" | "manual">): boolean => !!t.manual && /^NOVA\d+$/.test(t.code)

/** Nom de l'eina per al paràmetre `tool` de l'MSL. */
export const toolMslName = (t: MachineTool): string => t.mslName ?? t.code

/**
 * Llegeix una màquina desada sense perdre-la per una eina invàlida: les eines que no passen l'esquema es
 * descarten d'una en una (amb un problema per a cadascuna). Si la màquina tampoc és vàlida, `machine` és buit.
 */
export function repairMachine(raw: unknown): { machine?: Machine; problems: string[] } {
  const whole = MachineSchema.safeParse(raw)
  if (whole.success) return { machine: whole.data, problems: [] }
  const problems: string[] = []
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { problems: ["no és una màquina"] }
  const r = raw as Record<string, unknown>
  const tools: MachineTool[] = []
  for (const t of Array.isArray(r.tools) ? r.tools : []) {
    const res = MachineToolSchema.safeParse(t)
    if (res.success) tools.push(res.data)
    else {
      const code = typeof t === "object" && t && "code" in t ? String((t as { code: unknown }).code) : "?"
      problems.push(`eina ${code} descartada (${res.error.issues[0]?.message ?? "invàlida"})`)
    }
  }
  const again = MachineSchema.safeParse({ ...r, tools })
  if (again.success) return { machine: again.data, problems }
  return { problems: [...problems, again.error.issues[0]?.message ?? "invàlida"] }
}

/** La màquina de l'export: la marcada per defecte o la primera. */
export function defaultMachine(machines: readonly Machine[]): Machine | undefined {
  return machines.find((m) => m.isDefault) ?? machines[0]
}
