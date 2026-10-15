import { Input, Switch, Text } from "@chakra-ui/react"
import { LuFactory } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../../components/FormRow"
import { NumRow } from "../../../components/NumRow"
import { SettingsGroup } from "../../../components/SettingsGroup"
import type { Machine } from "../../../core/model"

/** «Programes .xcs»: la capçalera (SetMachiningParameters), els passants, les broques, les ranures i la codificació. */
export function XcsGroup({ m, update }: { m: Machine; update: (patch: Partial<Machine>) => void }) {
  return (
    <SettingsGroup icon={<LuFactory />} title="Programes .xcs" summary={`capçalera ${m.header.executionFields} · passants +${m.throughExtra} mm`}>
      <FormSection title="Capçalera (SetMachiningParameters)">
        <FormRow label="Àrea de treball" help="ExecutionFields de Maestro, p. ex. «AD».">
          <Input size="sm" maxW="120px" value={m.header.executionFields} onChange={(e) => update({ header: { ...m.header, executionFields: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || "A" } })} />
        </FormRow>
        <NumRow label="Repeticions" suffix="" value={m.header.repetitions} min={1} max={99} step={1} onChange={(repetitions) => update({ header: { ...m.header, repetitions: Math.max(1, Math.round(repetitions)) } })} />
        <FormRow label="Taula" help="TableOptions (tipus de fixació). El .pgmx del taller diu 10.">
          <Input size="sm" maxW="160px" inputMode="numeric" value={String(m.header.tableOptions)} onChange={(e) => update({ header: { ...m.header, tableOptions: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} />
        </FormRow>
        <FormRow label="Cicle continu">
          <Switch.Root size="sm" pt={1.5} checked={m.header.continuousCycle} onCheckedChange={(e) => update({ header: { ...m.header, continuousCycle: e.checked } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">ContinuousCycle</Switch.Label>
          </Switch.Root>
        </FormRow>
        {(m.header.technologicalMirror !== undefined || m.header.preserveWorkingSequence !== undefined) && (
          <FormRow label="Altres (Maestro)" help="«Conservar la seqüència» surt als programes per tauler (SetPreserveWorkingSequence, com el programa real del taller); el mirall tecnològic no té instrucció a l'MSL.">
            <Text fontSize="sm" pt="6px">
              Mirall tecnològic: {m.header.technologicalMirror ? "sí" : "no"} · Conservar la seqüència: {m.header.preserveWorkingSequence ? "sí" : "no"}
            </Text>
          </FormRow>
        )}
      </FormSection>
      <NumRow label="Passants (de més)" help="Els forats i talls passants baixen aquest tant per sota de la peça." value={m.throughExtra} min={0} max={5} step={0.5} onChange={(throughExtra) => update({ throughExtra })} />
      <FormRow label="Broques" help="Forats de cara i passants: «-1» deixa triar la broca al Maestro (com fan els projectes del taller); si no, la que tria l'app pel Ø i la fondària.">
        <ChoiceChips<Machine["verticalDrills"]>
          label="Broques"
          options={[
            { id: "auto", label: "Tria el Maestro" },
            { id: "tool", label: "Eina concreta" },
          ]}
          value={m.verticalDrills}
          onChange={(verticalDrills) => update({ verticalDrills })}
        />
      </FormRow>
      <FormRow label="Ranures" help="Amb disc només les rectes de cantell a cantell (passades del gruix del disc); la resta, amb fresa.">
        <ChoiceChips<Machine["grooves"]>
          label="Ranures"
          options={[
            { id: "auto", label: "Disc si es pot" },
            { id: "router", label: "Sempre fresa" },
            { id: "blade", label: "Preferir disc" },
          ]}
          value={m.grooves}
          onChange={(grooves) => update({ grooves })}
        />
      </FormRow>
      <FormRow
        label="Codificació"
        help="Com es desen els .xcs. El programa real del taller (TopSolid) és ASCII sense BOM; l'app els ha fet sempre en UTF-8 amb BOM (el Maestro, que és .NET, hauria de llegir tots dos). Sense BOM, si un nom d'eina porta accents, Exportar avisa. El LLEGEIX-ME va sempre amb BOM. Pendent de confirmar amb el taller."
      >
        <ChoiceChips<NonNullable<Machine["xcsEncoding"]>>
          label="Codificació"
          options={[
            { id: "utf8-bom", label: "UTF-8 amb BOM" },
            { id: "ascii", label: "Sense BOM (com TopSolid)" },
          ]}
          value={m.xcsEncoding ?? "utf8-bom"}
          onChange={(xcsEncoding) => update({ xcsEncoding })}
        />
      </FormRow>
    </SettingsGroup>
  )
}
