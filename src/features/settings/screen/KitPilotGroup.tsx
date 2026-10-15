import { Box, Switch } from "@chakra-ui/react"
import { LuDrill } from "react-icons/lu"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { FormRow } from "../../../components/FormRow"
import { NumRow } from "../../../components/NumRow"
import type { Settings } from "../../../core/model"

/** «Prebroca dels cargols», a Preferències › Regles de mecanitzat. `onChange`: la regla nova sencera. */
export function KitPilotGroup({ pilot, onChange }: { pilot: Settings["kitPilot"]; onChange: (next: Settings["kitPilot"]) => void }) {
  // Regla del taller, amb les altres regles de mecanitzat (per decisió de l'usuari: no és un ferratge; una sola font, `Settings.kitPilot`): prebroca a cada cargol d'un ferratge que no té
  // mecanitzat propi. Els jocs de la biblioteca en copien els números i les còpies dels mobles la segueixen en construir.
  const setPilot = (patch: Partial<typeof pilot>) => onChange({ ...pilot, ...patch })
  return (
    <Box maxW="760px" w="full">
      <SettingsGroup icon={<LuDrill />} title="Prebroca dels cargols" summary={pilot.enabled ? `Ø${pilot.diameter} × ${pilot.depth}, activada` : "desactivada"}>
        <FormRow label="Prebroca" help="Forat guia a cada cargol d'un ferratge que no té mecanitzat propi: els de la guia al lateral del moble i els dels suports al front i al darrere dels jocs de calaix de doble paret. Els ferratges de sempre ja foraden cada cargol (guia Ø5 / Ø4, placa i System 32 Ø5, espigues, imants, braços). Regla del taller: la segueixen tots els jocs, també els dels mobles fets.">
          <Switch.Root size="sm" pt={1.5} checked={pilot.enabled} onCheckedChange={(e) => setPilot({ enabled: e.checked })} data-testid="pilot-switch">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Prebrocar els cargols</Switch.Label>
          </Switch.Root>
        </FormRow>
        <NumRow label="Diàmetre" value={pilot.diameter} min={1} max={6} step={0.5} onChange={(diameter) => setPilot({ diameter })} />
        <NumRow label="Fondària" value={pilot.depth} min={3} max={30} step={1} onChange={(depth) => setPilot({ depth })} />
      </SettingsGroup>
    </Box>
  )
}
