import { Button, Input, Stack, Switch, Text } from "@chakra-ui/react"
import { LuCopy, LuFactory, LuStar, LuTrash2, LuUpload } from "react-icons/lu"
import { FormRow } from "../../../components/FormRow"
import { SettingsGroup } from "../../../components/SettingsGroup"
import type { Machine } from "../../../core/model"
import { NestingGroup } from "./NestingGroup"
import { ToolsTable } from "./ToolsTable"
import { XcsGroup } from "./XcsGroup"
import { IconAction } from "../../../components/IconAction"

/**
 * El detall d'una màquina: les dades (nom, sèrie, camp de treball, per defecte), el projecte de Maestro, les opcions dels
 * programes .xcs i per tauler i la taula d'eines.
 */
export function MachineDetail({
  m,
  busy,
  update,
  onDefault,
  onDuplicate,
  onDelete,
  onPickPgmx,
}: {
  m: Machine
  busy: boolean
  update: (patch: Partial<Machine>) => void
  onDefault: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** Importar un .pgmx a aquesta màquina. */
  onPickPgmx: () => void
}) {
  return (
    <Stack gap={6}>
      <SettingsGroup
        icon={<LuFactory />}
        title={m.name}
        summary={[m.serial, m.model].filter(Boolean).join(" · ") || "Màquina"}
        actions={
          <>
            <IconAction label="Màquina per defecte" tip="Màquina per defecte (exportació .xcs i separació del nesting)" size="xs" variant="ghost" colorPalette={m.isDefault ? "wood" : undefined} onClick={() => onDefault()}>
              <LuStar fill={m.isDefault ? "currentColor" : "none"} />
            </IconAction>
            <IconAction
              label="Duplicar màquina"
              size="xs"
              variant="ghost"
              onClick={onDuplicate}
            >
              <LuCopy />
            </IconAction>
            <IconAction
              label="Eliminar màquina"
              size="xs"
              variant="ghost"
              colorPalette="red"
              onClick={onDelete}
            >
              <LuTrash2 />
            </IconAction>
          </>
        }
      >
        <FormRow label="Nom" maxW="360px">
          <Input size="sm" value={m.name} onChange={(e) => update({ name: e.target.value })} />
        </FormRow>
        <FormRow label="Sèrie">
          <Text fontSize="sm" pt="6px">{m.serial || "—"}</Text>
        </FormRow>
        <FormRow label="Configuració">
          <Text fontSize="sm" pt="6px">{m.model || "—"}</Text>
        </FormRow>
        <FormRow label="Maestro">
          <Text fontSize="sm" pt="6px">{m.maestroVersion || "—"}</Text>
        </FormRow>
        <FormRow label="Camp de treball">
          <Text fontSize="sm" pt="6px">
            {m.workArea ? `${m.workArea.x} × ${m.workArea.y} mm` : "—"}
            {m.areas.length ? ` · àrees ${m.areas.join(" ")}` : ""}
          </Text>
        </FormRow>
        <FormRow label="Per defecte">
          <Switch.Root size="sm" pt={1.5} checked={m.isDefault} onCheckedChange={(e) => (e.checked ? onDefault() : update({ isDefault: false }))}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">La de l'exportació .xcs i del nesting (separació i marge)</Switch.Label>
          </Switch.Root>
        </FormRow>
      </SettingsGroup>

      <SettingsGroup
        icon={<LuFactory />}
        title="Projecte de Maestro (.pgmx)"
        summary={m.pgmx ? `${m.pgmx.file} · Maestro ${m.pgmx.version}` : "noms de les eines del taller"}
        actions={
          <Button size="xs" variant="ghost" loading={busy} title="Importar un .pgmx a aquesta màquina" onClick={onPickPgmx}>
            <LuUpload /> Importar .pgmx
          </Button>
        }
      >
        <Text fontSize="sm" color="fg.muted">
          Els programes diuen cada eina pel seu nom de Maestro, i el nom pot haver canviat des que es va exportar el context (p. ex.
          l'E128 es diu «12mm diamant nesting» a Maestro 2.0.5). Tria un projecte desat al taller (.pgmx, o l'XML de dins): s'hi llegeixen els
          noms de les eines que fa servir (per l'ID de Maestro; el codi no canvia) i la capçalera. És el mateix importador de dalt, amb aquesta
          màquina triada; una carpeta .pgmx desplegada es tria amb «Triar carpeta…».
        </Text>
      </SettingsGroup>

      <XcsGroup m={m} update={update} />

      <NestingGroup m={m} update={update} />

      <Text fontSize="sm" color="fg.muted">
        Les regles de mecanitzat (fresa de les ranures, perfilar per gruix, rampa, peces petites) són del taller, les mateixes per a
        totes les màquines: Preferències › Regles de mecanitzat.
      </Text>

      <ToolsTable tools={m.tools} onChange={(tools) => update({ tools })} />
    </Stack>
  )
}
