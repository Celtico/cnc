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

/** Regles que porta la màquina (les del taller, injectades per `withWorkshopRules`; sense, les de per defecte). */
export const machineRules = (m: Pick<Machine, "rules">): MachineRules => m.rules ?? defaultMachineRules()

/**
 * Versió de les migracions d'un sol cop de les opcions de la màquina (`Machine.rulesVersion`). 1: separació Ø + 1 → Ø + 2
 * i llindar de peça petita 300 mm / 0,1 m² → 0,8 m².
 */
export const MACHINE_RULES_VERSION = 1

/**
 * Migracions d'un sol cop de la màquina en carregar (`rulesVersion`): els valors provisionals d'abans (separació Ø + 1,
 * peça petita 300 mm / 0,1 m²) passen als del taller; si l'usuari els torna a posar després, es queden. Ja no hi posa
 * regles: des de la v11 de les preferències les regles són del taller (`Settings.machiningRules`) i les `rules` d'una
 * màquina només es llegeixen per migrar-les. Idempotent: una màquina ja migrada es retorna tal qual (el mateix objecte).
 */
export const migrateMachine = <M extends Pick<Machine, "rules"> & { nesting?: Machine["nesting"]; rulesVersion?: number }>(m0: M): M => {
  let m = m0
  if ((m.rulesVersion ?? 0) < MACHINE_RULES_VERSION) {
    // Separació provisional d'abans (Ø + 1) → la del taller (Ø + 2).
    if (m.nesting?.spacingExtra === 1) m = { ...m, nesting: { ...m.nesting, spacingExtra: 2 } }
    // El llindar provisional d'abans (costat < 300 mm o < 0,1 m²) passa al del taller (< 0,8 m²).
    const s = m.rules?.small
    if (m.rules && s && s.maxSide === 300 && s.maxArea === 0.1) m = { ...m, rules: { ...m.rules, small: { ...s, maxSide: 0, maxArea: 0.8 } } }
    m = { ...m, rulesVersion: MACHINE_RULES_VERSION }
  }
  return m
}

/**
 * La màquina amb les regles del taller (`Settings.machiningRules`) a `rules`, la forma que llegeix l'export
 * (`machineRules`, `RulePicker`). Les eines es busquen pel nom a la màquina que exporta.
 */
export const withWorkshopRules = (m: Machine, rules: MachineRules): Machine => (m.rules === rules ? m : { ...m, rules })

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
   * d'un .pgmx del taller (`MachiningParameters`). `technologicalMirror` no té instrucció a l'MSL (només es desa per
   * informar); `preserveWorkingSequence` surt als programes per tauler com `SetPreserveWorkingSequence` (com el programa
   * real del taller; sense valor, `true`). Vegeu docs/maestro-xcs.md.
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
      /**
       * Capçalera dels programes per tauler, com el programa de nesting real del taller
       * (docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs). Opcional: sense, `DEFAULT_NEST_PROGRAM` (`nestProgram`).
       */
      program: z
        .object({
          /** `MechanicalOptions` del `SetMachiningParameters` dels programes per tauler (el real: 16777216). */
          mechanicalOptions: z.number().int().min(0),
          /** `SetWorkpieceSetupPosition(x, y, z, rot)` (manual §3.9.2 p115; el real: 0, −20, 0, 0). */
          setupPosition: z.object({ x: z.number(), y: z.number(), z: z.number(), rot: z.number() }),
          /** La macro de càrrega del taller `CreateMacro("Pload", "PLOAD", …)` (§3.6.2 p103), tal com surt al real. */
          loadMacro: z.boolean(),
          /** `SetPneumaticHoodPosition(n)` (Table 50 p79: 0 = alta, 1–8 = baixa a la posició n; el real: 1). */
          pneumaticHood: z.number().int().min(0).max(8),
          /** `SetWorkPieceFallPrevention(true)` (no és al manual R4; el real el porta). */
          fallPrevention: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  /**
   * Regles de mecanitzat d'abans de la v11 de les preferències (eren per màquina). Es llegeix per compatibilitat i per
   * migrar-les a `Settings.machiningRules` (les del taller, iguals per a totes les màquines); en carregar es treu. A
   * l'export només hi és la còpia de les del taller (`withWorkshopRules`, `machineWithRules`); per llegir-les, `machineRules`.
   */
  rules: MachineRulesSchema.optional(),
  /** Migracions d'un sol cop ja fetes (`migrateMachine`, `MACHINE_RULES_VERSION`). Sense: cap. */
  rulesVersion: z.number().int().min(0).optional(),
  /** D'on venen els noms de les eines (`mslName`) i la capçalera: el .pgmx importat. */
  pgmx: z.object({ file: z.string(), version: z.string(), tools: z.number().int(), importedAt: z.number() }).optional(),
  /** La màquina per defecte: la de l'export .xcs i la que dona la separació i el marge del nesting (pàgina Nesting, CSV, JSON). */
  isDefault: z.boolean(),
  tools: z.array(MachineToolSchema),
  importedAt: z.number().optional(),
})
export type Machine = z.infer<typeof MachineSchema>

/** Capçalera per defecte: la del .pgmx real del taller (Proyecto1, Maestro 2.0.5 rev 1005). */
export const DEFAULT_HEADER: Machine["header"] = { executionFields: "AD", repetitions: 1, tableOptions: 10, mechanicalOptions: 16973824, continuousCycle: false }

export type MachineNesting = NonNullable<Machine["nesting"]>

/** Opcions de nesting per defecte: marge 10, separació Ø + 2 (la del taller: 14 mm amb la fresa de 12, 16 amb la de 14), martiri 0,3 mm, peces petites al final. */
export const DEFAULT_MACHINE_NESTING: MachineNesting = { edgeTrim: 10, spacingExtra: 2, overcut: 0.3, smallParts: "last" }

/** Opcions de nesting de la màquina (amb els valors per defecte). */
export const machineNesting = (m: Pick<Machine, "nesting">): MachineNesting => ({ ...DEFAULT_MACHINE_NESTING, ...m.nesting })

export type NestProgram = NonNullable<MachineNesting["program"]>

/**
 * Capçalera dels programes per tauler per defecte: la del programa de nesting real del taller (TopSolid → Maestro, el
 * va mecanitzar aquesta màquina): `MechanicalOptions` 16777216 (el .pgmx d'una peça diu 16973824),
 * `SetWorkpieceSetupPosition(0, -20, 0, 0)`, la macro `Pload`, campana baixa a la posició 1 i `SetWorkPieceFallPrevention(true)`.
 */
export const DEFAULT_NEST_PROGRAM: NestProgram = { mechanicalOptions: 16777216, setupPosition: { x: 0, y: -20, z: 0, rot: 0 }, loadMacro: true, pneumaticHood: 1, fallPrevention: true }

/** Capçalera dels programes per tauler de la màquina (amb els valors per defecte). */
export const nestProgram = (m: Pick<Machine, "nesting">): NestProgram => ({ ...DEFAULT_NEST_PROGRAM, ...m.nesting?.program })

/** Codi provisional d'una «Eina nova» (`NOVA1`…): no es tria fins que no se li posa el codi de Maestro. */
export const isPlaceholderTool = (t: Pick<MachineTool, "code" | "manual">): boolean => !!t.manual && /^NOVA\d+$/.test(t.code)

/** Nom de l'eina per al paràmetre `tool` de l'MSL. */
export const toolMslName = (t: MachineTool): string => t.mslName ?? t.code

/**
 * Llegeix una màquina desada sense perdre-la per una eina invàlida: les eines que no passen l'esquema es
 * descarten d'una en una (amb un problema per a cadascuna). Si encara no és vàlida, es tornen a provar sense les regles i
 * després sense les opcions de nesting (valors per defecte, amb un problema). Si tampoc, `machine` és buit.
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
  // Regles (d'abans de la v11) o opcions de nesting invàlides: es treuen (`machineNesting` dona les per defecte) abans
  // de perdre la màquina sencera.
  const RULES = "regles de mecanitzat invàlides: es restauren les del taller"
  const NESTING = "opcions dels programes per tauler invàlides: es restauren les inicials"
  const tries: [Record<string, unknown>, string[]][] = [
    [{ rules: undefined }, [RULES]],
    [{ nesting: undefined }, [NESTING]],
    [{ rules: undefined, nesting: undefined }, [RULES, NESTING]],
  ]
  for (const [patch, why] of tries) {
    const res = MachineSchema.safeParse({ ...r, tools, ...patch })
    if (res.success) return { machine: res.data, problems: [...problems, ...why] }
  }
  return { problems: [...problems, again.error.issues[0]?.message ?? "invàlida"] }
}

/** La màquina de l'export: la marcada per defecte o la primera. */
export function defaultMachine(machines: readonly Machine[]): Machine | undefined {
  return machines.find((m) => m.isDefault) ?? machines[0]
}
