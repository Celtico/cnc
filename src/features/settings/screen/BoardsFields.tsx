import { Box, Button, Grid, Stack, Switch, Text } from "@chakra-ui/react"
import { Fragment } from "react"
import { LuFactory, LuLayoutGrid, LuPlus, LuRotateCw, LuTrash2 } from "react-icons/lu"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { FormRow } from "../../../components/FormRow"
import { NumberField } from "../../../components/NumRow"
import { backChoices, type Machine, type MaterialPref, type Settings } from "../../../core/model"
import { MaterialSelect } from "../MaterialSelect"
import { IconAction } from "../../../components/IconAction"

/** Preferències › Taulers: el camp de treball de la màquina, les mides de tauler de fàbrica i la distribució. */
export function BoardsFields({ boards, materials, machine, onChange }: { boards: Settings["boards"]; materials: MaterialPref[]; machine: Machine | undefined; onChange: (boards: Settings["boards"]) => void }) {
  return (
    <Stack gap={6}>
    {/* Com es talla (separació, marge, fresa) és de la màquina: aquí només el camp de treball, al costat de les mides dels taulers (sense avís si n'és més gran). */}
    <SettingsGroup icon={<LuFactory />} title="Màquina CNC" summary={machine ? machine.name : "sense màquina"}>
      {machine ? (
        <FormRow label="Camp de treball" help={`El màxim que mecanitza ${machine.name}. La separació entre peces i el marge del tauler són de la màquina (Preferències › Màquines CNC).`}>
          <Text fontSize="sm" pt="6px">{machine.workArea ? `${machine.workArea.x} × ${machine.workArea.y} mm` : "—"}</Text>
        </FormRow>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          Sense màquina CNC: importa-la a Preferències › Màquines CNC. Mentrestant, la separació i el marge del nesting es trien a la pàgina Nesting de cada moble.
        </Text>
      )}
    </SettingsGroup>
    <SettingsGroup icon={<LuLayoutGrid />} title="Mides de tauler de fàbrica" summary={boards.sheets.map((x) => `${x.w}×${x.h}`).join(" · ")}>
    <Text fontSize="sm" color="fg.muted">
      Els taulers que es compren, per material («Tots els altres»: la resta). El nesting hi reparteix les peces.
    </Text>
    {/* Taula en graella: capçalera una sola vegada i una fila per mida. */}
    <Grid templateColumns={{ base: "minmax(0, 1fr) minmax(0, 1fr) 32px", sm: "minmax(0, 1fr) 150px 150px 32px" }} gap={2} alignItems="center">
      <Text textStyle="xs" color="fg.muted" display={{ base: "none", sm: "block" }}>Material</Text>
      <Text textStyle="xs" color="fg.muted">Llarg</Text>
      <Text textStyle="xs" color="fg.muted">Ample</Text>
      <span />
      {boards.sheets.map((s, i) => {
        const update = (patch: Partial<typeof s>) => onChange({ ...boards, sheets: boards.sheets.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
        return (
          <Fragment key={i}>
            {/* Al mòbil, el material ocupa tota la fila i les mides van a sota. */}
            <Box gridColumn={{ base: "1 / -1", sm: "auto" }} mt={{ base: i > 0 ? 2 : 0, sm: 0 }} minW={0}>
              <MaterialSelect label="Material" hideLabel materials={backChoices(materials)} value={s.material} emptyLabel="Tots els altres" onChange={(material) => update({ material })} />
            </Box>
            <NumberField label="" ariaLabel="Llarg" value={s.w} min={300} max={6000} step={10} onChange={(w) => update({ w })} />
            <NumberField label="" ariaLabel="Ample" value={s.h} min={300} max={6000} step={10} onChange={(h) => update({ h })} />
            <IconAction label="Eliminar tauler" size="sm" variant="ghost" colorPalette="red" disabled={boards.sheets.length <= 1} onClick={() => onChange({ ...boards, sheets: boards.sheets.filter((_, k) => k !== i) })}>
              <LuTrash2 />
            </IconAction>
          </Fragment>
        )
      })}
    </Grid>
    <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => onChange({ ...boards, sheets: [...boards.sheets, { material: "", w: 2440, h: 1220 }] })}>
      <LuPlus /> Afegir mida de tauler
    </Button>
    </SettingsGroup>
    <SettingsGroup icon={<LuRotateCw />} title="Distribució" summary={boards.ignoreGrain ? "gira les peces amb veta" : "respecta la veta"}>
    <FormRow label="Veta" help="Aprofita més el tauler, però la veta de les peces girades no segueix la del moble.">
      <Switch.Root size="sm" pt={1.5} checked={boards.ignoreGrain} onCheckedChange={(e) => onChange({ ...boards, ignoreGrain: e.checked })}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label fontSize="sm">Girar les peces</Switch.Label>
      </Switch.Root>
    </FormRow>
    </SettingsGroup>
    </Stack>
  )
}
