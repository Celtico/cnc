import { Box, Button, HStack, IconButton, Stack, Switch, Text } from "@chakra-ui/react"
import { LuCheck, LuRoute, LuPlus, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { NumberField, NumRow } from "../../components/NumRow"
import { SettingsGroup } from "../../components/SettingsGroup"
import { defaultMachine, machineNesting, toolMslName, type Machine, type MachineRules } from "../../core/model"
import { findRuleTool, missingRuleTools } from "../../core/machine/rules"
import { usableTool } from "../../core/machine/tools"

/**
 * Preferències › Regles de mecanitzat: les regles del taller (`Settings.machiningRules`: eines per tipus de mecanitzat,
 * passades de les ranures, perfilar per gruix, rampa del nesting i peces petites), **les mateixes per a totes les
 * màquines**. «Restaurar valors inicials» de la pàgina les torna a les del taller (`defaultMachineRules`).
 * Les eines van pel nom i es trien d'entre les freses que es poden fer servir (`usableTool`) de qualsevol màquina; per a
 * cada màquina, una línia diu si les té totes (✓) o quines li falten: a l'export, la que falta es tria com sempre, amb un avís.
 */
export function MachineRulesGroup({ rules: r, machines, onChange }: { rules: MachineRules; machines: Machine[]; onChange: (rules: MachineRules) => void }) {
  const set = (patch: Partial<MachineRules>) => onChange({ ...r, ...patch })
  const missingBy = machines.map((m) => ({ m, missing: missingRuleTools(m, r) }))
  const short = missingBy.filter((x) => x.missing.length).length
  const summary = `ranures ${r.grooves.tool || "auto"} · ${r.profile.length} gruixos · peces petites < ${comma(r.small.maxArea)} m²${short ? ` · eines que falten a ${short} ${short === 1 ? "màquina" : "màquines"}` : ""}`
  const nestingOf = defaultMachine(machines)
  return (
    <SettingsGroup icon={<LuRoute />} title="Regles del taller" summary={summary}>
      <Text fontSize="sm" color="fg.muted">
        Com mecanitza el taller: quina fresa per a cada cosa i en quantes passades. Són les mateixes per a totes les màquines; les eines van pel nom
        de Maestro i es busquen a la màquina que exporta. Si no en té cap amb aquell nom, l'export la tria com sempre i avisa (afegeix-la a
        Preferències › Màquines CNC (Eines) o importa un .pgmx que la faci servir).
      </Text>
      {machines.length > 0 ? (
        <Stack gap={1}>
          {missingBy.map(({ m, missing }) => (
            <HStack key={m.id} gap={2} align="flex-start" fontSize="sm">
              {missing.length ? (
                <Text color="fg.warning">
                  {m.name}: falta {missing.map((n) => `«${n}»`).join(", ")}
                </Text>
              ) : (
                <>
                  <Box color="fg.success" pt="3px" flexShrink={0}>
                    <LuCheck />
                  </Box>
                  <Text>{m.name}: té totes les eines</Text>
                </>
              )}
            </HStack>
          ))}
        </Stack>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          Sense màquina: importa-la a Preferències › Màquines CNC per triar les freses d'entre les seves eines.
        </Text>
      )}

      <FormSection title="Ranures">
        <FormRow label="Fresa" help="Ranures obertes per algun extrem (també les de cantell a cantell, si a Preferències › Màquines CNC › Programes .xcs › «Ranures» no es prefereix el disc).">
          <ToolPick machines={machines} label="Fresa de les ranures" value={r.grooves.tool} onChange={(tool) => set({ grooves: { ...r.grooves, tool } })} />
        </FormRow>
        <NumRow label="Per passada" help="Fondària màxima de cada passada: més fondes, en diverses (CreateBidirectionalMillingStrategy)." value={r.grooves.maxPass} min={0.5} max={50} step={0.5} onChange={(maxPass) => set({ grooves: { ...r.grooves, maxPass } })} />
      </FormSection>

      <FormSection title="Caixeres">
        <FormRow label="Fresa" help="Rebaixos cecs tancats pels quatre costats (CreateContourPocket). Si la fresa no hi cap, es fan com una ranura.">
          <ToolPick machines={machines} label="Fresa de les caixeres" value={r.pockets.tool} onChange={(tool) => set({ pockets: { tool } })} />
        </FormRow>
      </FormSection>

      <FormSection title="Perfilar (per gruix del tauler)">
        <Text fontSize="sm" color="fg.muted">
          Contorns per fora i talls passants per dins. Un gruix que no és a cap fila: la fresa de sempre.
        </Text>
        {r.profile.map((row, k) => {
          const put = (patch: Partial<MachineRules["profile"][number]>) => set({ profile: r.profile.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
          return (
            <Stack key={k} gap={2}>
              <FormRow label={`Gruixos ${k + 1}`}>
                <HStack gap={2} align="center" wrap="wrap">
                  <Box w={PAIR_W} flexShrink={0}>
                    <NumberField label="" ariaLabel="Gruix des de" value={row.min} min={0} max={200} step={1} onChange={(min) => put({ min })} />
                  </Box>
                  {/* Cada etiqueta amb el seu camp: en saltar de línia, el «–» no es queda sol. */}
                  <HStack gap={2} flexShrink={0}>
                    <Text fontSize="sm">–</Text>
                    <Box w={PAIR_W}>
                      <NumberField label="" ariaLabel="Gruix fins a" value={row.max} min={0} max={200} step={1} onChange={(max) => put({ max })} />
                    </Box>
                  </HStack>
                  <IconButton size="xs" variant="ghost" aria-label="Treure aquests gruixos" title="Treure aquests gruixos" onClick={() => set({ profile: r.profile.filter((_, j) => j !== k) })}>
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </FormRow>
              <FormRow label="Fresa">
                <ToolPick machines={machines} label={`Fresa per a ${row.min}–${row.max} mm`} value={row.tool} onChange={(tool) => put({ tool })} />
              </FormRow>
            </Stack>
          )
        })}
        <HStack>
          <Button size="xs" variant="ghost" onClick={() => {
            const last = r.profile.at(-1)
            const min = last ? last.max + 1 : 8
            set({ profile: [...r.profile, { min, max: min + 10, tool: last?.tool ?? "" }] })
          }}>
            <LuPlus /> Afegir gruixos
          </Button>
        </HStack>
      </FormSection>

      <FormSection title="Rampa (nesting)">
        <FormRow label="Entrada en rampa" help="Els perfilats del nesting entren baixant en línia (SetApproachStrategy en baixada), pel mig del costat recte més llarg.">
          <Switch.Root size="sm" pt={1.5} checked={r.ramp.enabled} onCheckedChange={(e) => set({ ramp: { ...r.ramp, enabled: e.checked } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">{r.ramp.enabled ? "Sí" : "No"}</Switch.Label>
          </Switch.Root>
        </FormRow>
        {r.ramp.enabled && <NumRow label="Llargada" help="Com a molt la meitat d'aquell costat. A Maestro va com a múltiple del radi de la fresa." value={r.ramp.length} min={1} max={500} step={5} onChange={(length) => set({ ramp: { ...r.ramp, length } })} />}
      </FormSection>

      <FormSection title="Peces petites">
        <Text fontSize="sm" color="fg.muted">
          Del taller: una peça és petita si l'àrea (o algun costat, si s'hi posa una mida) és més petita; el contorn es fa en passades de desbast
          (deixen material a baix i al costat) i una final. Les grans, d'una passada.
        </Text>
        <NumRow label="Costat menor que" help="0 = no compta (només l'àrea)." value={r.small.maxSide} min={0} max={3000} step={10} onChange={(maxSide) => set({ small: { ...r.small, maxSide } })} />
        <NumRow label="Àrea menor que" suffix="m²" value={r.small.maxArea} min={0} max={6} step={0.01} onChange={(maxArea) => set({ small: { ...r.small, maxArea } })} />
        {r.small.passes.map((p, k) => {
          const put = (patch: Partial<MachineRules["small"]["passes"][number]>) => set({ small: { ...r.small, passes: r.small.passes.map((x, j) => (j === k ? { ...x, ...patch } : x)) } })
          return (
            <FormRow key={k} label={`Passada ${k + 1}`} help="Material que deixa a baix (Z) i al costat (XY).">
              <HStack gap={2} align="center" wrap="wrap">
                <HStack gap={2} flexShrink={0}>
                  <Text fontSize="sm">Z</Text>
                  <Box w={PAIR_W}>
                    <NumberField label="" ariaLabel={`Passada ${k + 1}: Z`} value={p.z} min={0} max={20} step={0.1} onChange={(z) => put({ z })} />
                  </Box>
                </HStack>
                <HStack gap={2} flexShrink={0}>
                  <Text fontSize="sm">XY</Text>
                  <Box w={PAIR_W}>
                    <NumberField label="" ariaLabel={`Passada ${k + 1}: XY`} value={p.xy} min={0} max={10} step={0.1} onChange={(xy) => put({ xy })} />
                  </Box>
                </HStack>
                <IconButton size="xs" variant="ghost" aria-label="Treure la passada" title="Treure la passada" onClick={() => set({ small: { ...r.small, passes: r.small.passes.filter((_, j) => j !== k) } })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
            </FormRow>
          )
        })}
        <FormRow label={`Passada ${r.small.passes.length + 1}`} help="La de sempre: fins al martiri.">
          <Text fontSize="sm" pt="6px">
            Final · Z −{comma(machineNesting(nestingOf ?? {}).overcut)} (martiri) · XY 0
          </Text>
        </FormRow>
        <HStack>
          <Button size="xs" variant="ghost" onClick={() => set({ small: { ...r.small, passes: [...r.small.passes, { z: 0.5, xy: 0 }] } })}>
            <LuPlus /> Afegir passada
          </Button>
        </HStack>
      </FormSection>
    </SettingsGroup>
  )
}

/** Amplada dels camps en parella (des de – fins a, Z · XY): estrets al mòbil; a l'ordinador, prou per al sufix «mm». */
const PAIR_W = { base: "100px", md: "140px" }

/** Número amb coma decimal. */
const comma = (n: number) => String(n).replace(".", ",")

/**
 * Fresa d'una regla: «Automàtica», les freses que es poden fer servir de totes les màquines (pel nom de Maestro i el nom,
 * sense repetir-les) i, si el nom no és a cap màquina, «falta».
 */
function ToolPick({ machines, label, value, onChange }: { machines: Machine[]; label: string; value: string; onChange: (v: string) => void }) {
  const found = value.trim() ? machines.map((m) => findRuleTool(m, value)).find((t) => !!t) : undefined
  // Les mateixes que pot fer servir l'export (`findRuleTool`): muntades, automàtiques i amb codi de Maestro.
  const routers = machines.flatMap((m) => m.tools.filter((t) => t.kind === "router" && usableTool(t) && t.diameter > 0))
  const options = [
    { id: "", label: "Automàtica" },
    ...routers.map((t) => ({ id: toolMslName(t), label: `${toolMslName(t)}${t.name.trim() && t.name !== toolMslName(t) ? ` (${t.name})` : ""} · Ø${comma(t.diameter)}` })),
    ...(value.trim() && !found ? [{ id: value, label: `${value} · falta` }] : []),
  ]
  // El valor desat pot ser el nom o el codi: es marca l'eina trobada.
  const current = found ? toolMslName(found) : value
  const seen = new Set<string>()
  return <ChoiceChips<string> label={label} options={options.filter((o) => !seen.has(o.id) && !!seen.add(o.id))} value={current} onChange={onChange} />
}
