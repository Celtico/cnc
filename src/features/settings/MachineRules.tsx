import { Box, Button, HStack, IconButton, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuFactory, LuPlus, LuRotateCcw, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { NumberField, NumRow } from "../../components/NumRow"
import { SettingsGroup } from "../../components/SettingsGroup"
import { defaultMachineRules, machineNesting, machineRules, toolMslName, type Machine, type MachineRules } from "../../core/model"
import { findRuleTool } from "../../core/machine/rules"

/**
 * Preferències › Màquines CNC › «Regles de mecanitzat»: les regles del taller (eines per tipus de mecanitzat, passades
 * de les ranures, perfilar per gruix, rampa del nesting i peces petites). Les eines es trien d'entre les freses de la
 * màquina; una que no hi és surt marcada («falta») i l'export tria com sempre, amb un avís.
 */
export function MachineRulesGroup({ m, onChange }: { m: Machine; onChange: (rules: MachineRules) => void }) {
  const r = machineRules(m)
  const set = (patch: Partial<MachineRules>) => onChange({ ...r, ...patch })
  const missing = [r.grooves.tool, r.pockets.tool, ...r.profile.map((x) => x.tool)].filter((n) => n.trim() && !findRuleTool(m, n))
  const summary = `ranures ${r.grooves.tool || "auto"} · ${r.profile.length} gruixos · peces petites < ${r.small.maxArea} m²${missing.length ? ` · ${missing.length} eines falten` : ""}`
  return (
    <SettingsGroup
      icon={<LuFactory />}
      title="Regles de mecanitzat"
      summary={summary}
      actions={
        <Button size="xs" variant="ghost" title="Tornar a les regles del taller" onClick={() => onChange(defaultMachineRules())}>
          <LuRotateCcw /> Les del taller
        </Button>
      }
    >
      <Text fontSize="sm" color="fg.muted">
        Com mecanitza el taller: quina fresa per a cada cosa i en quantes passades. Les eines van pel nom de Maestro; si la màquina no en té cap
        amb aquell nom surt «falta» i l'export la tria com sempre i avisa (afegeix-la a «Eines» o importa un .pgmx que la faci servir).
      </Text>

      <FormSection title="Ranures">
        <FormRow label="Fresa" help="Ranures obertes per algun extrem (també les de cantell a cantell, si a «Ranures» no es prefereix el disc).">
          <ToolPick m={m} label="Fresa de les ranures" value={r.grooves.tool} onChange={(tool) => set({ grooves: { ...r.grooves, tool } })} />
        </FormRow>
        <NumRow label="Per passada" help="Fondària màxima de cada passada: més fondes, en diverses (CreateBidirectionalMillingStrategy)." value={r.grooves.maxPass} min={0.5} max={50} step={0.5} onChange={(maxPass) => set({ grooves: { ...r.grooves, maxPass } })} />
      </FormSection>

      <FormSection title="Caixeres">
        <FormRow label="Fresa" help="Rebaixos cecs tancats pels quatre costats (CreateContourPocket). Si la fresa no hi cap, es fan com una ranura.">
          <ToolPick m={m} label="Fresa de les caixeres" value={r.pockets.tool} onChange={(tool) => set({ pockets: { tool } })} />
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
                <HStack gap={2} align="center">
                  <Box maxW="110px">
                    <NumberField label="" ariaLabel="Gruix des de" value={row.min} min={0} max={200} step={1} onChange={(min) => put({ min })} />
                  </Box>
                  <Text fontSize="sm">–</Text>
                  <Box maxW="110px">
                    <NumberField label="" ariaLabel="Gruix fins a" value={row.max} min={0} max={200} step={1} onChange={(max) => put({ max })} />
                  </Box>
                  <IconButton size="xs" variant="ghost" aria-label="Treure aquests gruixos" title="Treure aquests gruixos" onClick={() => set({ profile: r.profile.filter((_, j) => j !== k) })}>
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </FormRow>
              <FormRow label="Fresa">
                <ToolPick m={m} label={`Fresa per a ${row.min}–${row.max} mm`} value={row.tool} onChange={(tool) => put({ tool })} />
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
          Provisional (falta confirmar-ho amb el taller): és petita si algun costat fa menys de la mida o l'àrea és més petita. El contorn es fa en
          passades de desbast (deixen material a baix i al costat) i una final.
        </Text>
        <NumRow label="Costat menor que" help="0 = no compta (només l'àrea)." value={r.small.maxSide} min={0} max={3000} step={10} onChange={(maxSide) => set({ small: { ...r.small, maxSide } })} />
        <NumRow label="Àrea menor que" suffix="m²" value={r.small.maxArea} min={0} max={6} step={0.01} onChange={(maxArea) => set({ small: { ...r.small, maxArea } })} />
        {r.small.passes.map((p, k) => {
          const put = (patch: Partial<MachineRules["small"]["passes"][number]>) => set({ small: { ...r.small, passes: r.small.passes.map((x, j) => (j === k ? { ...x, ...patch } : x)) } })
          return (
            <FormRow key={k} label={`Passada ${k + 1}`} help="Material que deixa a baix (Z) i al costat (XY).">
              <HStack gap={2} align="center">
                <Text fontSize="sm">Z</Text>
                <Box maxW="110px">
                  <NumberField label="" ariaLabel={`Passada ${k + 1}: Z`} value={p.z} min={0} max={20} step={0.1} onChange={(z) => put({ z })} />
                </Box>
                <Text fontSize="sm">XY</Text>
                <Box maxW="110px">
                  <NumberField label="" ariaLabel={`Passada ${k + 1}: XY`} value={p.xy} min={0} max={10} step={0.1} onChange={(xy) => put({ xy })} />
                </Box>
                <IconButton size="xs" variant="ghost" aria-label="Treure la passada" title="Treure la passada" onClick={() => set({ small: { ...r.small, passes: r.small.passes.filter((_, j) => j !== k) } })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
            </FormRow>
          )
        })}
        <FormRow label={`Passada ${r.small.passes.length + 1}`} help="La de sempre: al nesting fins al martiri; per peça, els passants de més.">
          <Text fontSize="sm" pt="6px">
            Final · Z −{String(machineNesting(m).overcut).replace(".", ",")} (martiri) · XY 0
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

/** Fresa d'una regla: «Automàtica», les freses de la màquina pel nom de Maestro i, si el nom no hi és, «falta». */
function ToolPick({ m, label, value, onChange }: { m: Machine; label: string; value: string; onChange: (v: string) => void }) {
  const found = value.trim() ? findRuleTool(m, value) : undefined
  const routers = m.tools.filter((t) => t.kind === "router" && t.mounted && t.diameter > 0)
  const options = [
    { id: "", label: "Automàtica" },
    ...routers.map((t) => ({ id: toolMslName(t), label: `${toolMslName(t)} · Ø${t.diameter}` })),
    ...(value.trim() && !found ? [{ id: value, label: `${value} · falta` }] : []),
  ]
  // El valor desat pot ser el nom o el codi: es marca l'eina trobada.
  const current = found ? toolMslName(found) : value
  const seen = new Set<string>()
  return <ChoiceChips<string> label={label} options={options.filter((o) => !seen.has(o.id) && !!seen.add(o.id))} value={current} onChange={onChange} />
}

/**
 * Preferències › Ferratges i mecanitzats › «Regles de mecanitzat»: les de la màquina per defecte (o la triada, si n'hi ha
 * diverses). Es desen a cada màquina, perquè les eines són d'ella.
 */
export function MachiningRulesSection({ machines, onChange }: { machines: Machine[]; onChange: (machines: Machine[]) => void }) {
  const def = machines.find((m) => m.isDefault) ?? machines[0]
  const [sel, setSel] = useState<string | undefined>(undefined)
  const m = machines.find((x) => x.id === sel) ?? def
  if (!m) {
    return (
      <SettingsGroup icon={<LuFactory />} title="Regles de mecanitzat" summary="sense màquina">
        <Text fontSize="sm" color="fg.muted">
          Les regles de mecanitzat (fresa de les ranures, perfilar per gruix, rampa, peces petites) van amb la màquina i les seves eines. Importa-la
          a Preferències › Màquines CNC.
        </Text>
      </SettingsGroup>
    )
  }
  return (
    <Stack gap={3}>
      {machines.length > 1 && (
        <FormRow label="Màquina">
          <ChoiceChips label="Màquina" value={m.id} options={machines.map((x) => ({ id: x.id, label: x.name }))} onChange={setSel} />
        </FormRow>
      )}
      <MachineRulesGroup m={m} onChange={(rules) => onChange(machines.map((x) => (x.id === m.id ? { ...x, rules } : x)))} />
    </Stack>
  )
}
