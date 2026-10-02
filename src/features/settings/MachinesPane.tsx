import { Badge, Box, Button, Grid, HStack, IconButton, Input, Stack, Switch, Text } from "@chakra-ui/react"
import { Fragment, useContext, useEffect, useRef, useState } from "react"
import { LuCopy, LuFactory, LuFolderOpen, LuPlus, LuStar, LuTrash2, LuUpload } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { MasterDetail } from "../../components/MasterDetail"
import { NumRow } from "../../components/NumRow"
import { SettingsGroup } from "../../components/SettingsGroup"
import { SectionLabel } from "../../components/SectionLabel"
import { toaster } from "../../components/ui/toaster"
import { newId, TOOL_KIND_LABELS, type Machine, type MachineTool, type ToolKind } from "../../core/model"
import { importMachineFiles } from "./machineImport"
import { PaneHeadContext } from "./paneHead"
import { useSessionString } from "./useSessionString"

const KEY = "mobles:settings-machine"

/** Grups de la taula d'eines, en l'ordre del taller. */
const TOOL_GROUPS: { id: string; label: string; match: (t: MachineTool) => boolean }[] = [
  { id: "drill-v", label: "Broques verticals", match: (t) => t.kind === "drill" && t.orientation !== "horizontal" },
  { id: "drill-h", label: "Broques horitzontals", match: (t) => t.kind === "drill" && t.orientation === "horizontal" },
  { id: "router", label: TOOL_KIND_LABELS.router, match: (t) => t.kind === "router" },
  { id: "blade", label: TOOL_KIND_LABELS.blade, match: (t) => t.kind === "blade" },
  { id: "other", label: "Agregats, palpadors i altres", match: (t) => t.kind === "aggregate" || t.kind === "probe" || t.kind === "other" },
]

/** Columnes de la taula d'eines: codi · nom · Ø · fondària · posició. */
const COLS = "52px minmax(0, 1fr) 56px 64px minmax(0, 96px)"

const where = (t: MachineTool) =>
  !t.mounted ? "no muntada" : t.spindles?.length ? `mandrí ${t.spindles.join(", ")}` : t.heads?.length ? `capçal ${t.heads.join(", ")}` : "—"

/**
 * Preferències › Màquines CNC: llista de màquines (importades de Maestro) i detall amb les dades
 * de la màquina, les opcions de l'export .xcs i la taula d'eines per tipus.
 */
export function MachinesList({ machines, onChange }: { machines: Machine[]; onChange: (m: Machine[]) => void }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useSessionString(KEY)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const i = machines.findIndex((m) => m.id === sel)
  const m = i >= 0 ? machines[i]! : null
  useEffect(() => {
    if (sel !== null && i < 0) setSel(null)
  }, [sel, i, setSel])

  const update = (patch: Partial<Machine>) => onChange(machines.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const makeDefault = (id: string) => onChange(machines.map((x) => ({ ...x, isDefault: x.id === id })))

  const doImport = async (list: FileList | null, input: HTMLInputElement | null) => {
    if (!list?.length) return
    setBusy(true)
    try {
      const { machine, problems } = await importMachineFiles(list)
      // La mateixa sèrie ja importada: se substitueix (es conserva el nom, el per defecte i les eines afegides a mà).
      const old = machines.find((x) => machine.serial && x.serial === machine.serial)
      const merged: Machine = old
        ? { ...machine, id: old.id, name: old.name, isDefault: old.isDefault, throughExtra: old.throughExtra, grooves: old.grooves, tools: [...machine.tools, ...old.tools.filter((t) => t.manual && !machine.tools.some((x) => x.code === t.code))] }
        : { ...machine, isDefault: machines.length === 0 }
      onChange(old ? machines.map((x) => (x.id === old.id ? merged : x)) : [...machines, merged])
      setSel(merged.id)
      const n = merged.tools.length
      toaster.create({
        title: old ? `Màquina ${merged.name} actualitzada` : `Màquina ${merged.name} importada`,
        description: `${n} eines, ${merged.tools.filter((t) => t.mounted && t.auto).length} disponibles per a l'export.` + (problems.length ? ` ${problems.join(" ")}` : ""),
        type: problems.length ? "warning" : "success",
        duration: 8000,
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut importar la màquina", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    } finally {
      setBusy(false)
      if (input) input.value = ""
    }
  }

  const q = query.trim().toLowerCase()
  const shown = machines.filter((x) => !q || `${x.name} ${x.serial} ${x.model}`.toLowerCase().includes(q))

  return (
    <>
      {/* Carpeta sencera (`webkitdirectory`) o fitxers solts. */}
      <input ref={(el) => { folderInput.current = el; el?.setAttribute("webkitdirectory", "") }} type="file" multiple hidden data-testid="machine-folder" onChange={(e) => void doImport(e.target.files, e.target)} />
      <input ref={filesInput} type="file" multiple hidden data-testid="machine-files" onChange={(e) => void doImport(e.target.files, e.target)} />
      <MasterDetail
        head={
          <Stack gap={3}>
            {head}
            <Text fontSize="sm" color="fg.muted">
              Exporta el context de màquina de Maestro (la carpeta <Text as="span" fontFamily="mono">.machinecontext</Text>) i importa'l aquí: les
              eines de la biblioteca (.tlgx), on és muntada cada una (.atrx) i la configuració (.cfgx). L'export «Programes .xcs» les fa servir.
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button colorPalette="wood" size="sm" loading={busy} onClick={() => folderInput.current?.click()}>
                <LuUpload /> Importar de Maestro
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => filesInput.current?.click()}>
                <LuFolderOpen /> Fitxers solts
              </Button>
            </HStack>
          </Stack>
        }
        groups={[
          {
            id: "machines",
            label: "Màquines",
            items: shown.map((x) => ({
              id: x.id,
              lead: <LuFactory />,
              title: x.name,
              subtitle: `${x.tools.length} eines${x.maestroVersion ? ` · Maestro ${x.maestroVersion}` : ""}`,
              badge: x.isDefault ? (
                <Badge size="xs" variant="subtle" colorPalette="wood">
                  per defecte
                </Badge>
              ) : undefined,
            })),
          },
        ]}
        selected={m ? m.id : null}
        onSelect={setSel}
        query={query}
        onQuery={setQuery}
        addLabel="Importar de Maestro"
        onAdd={() => folderInput.current?.click()}
        backLabel="Màquines CNC"
        detailMaxW="860px"
        empty={
          <Text fontSize="sm" color="fg.muted">
            {machines.length ? "Tria una màquina de la llista." : "Encara no hi ha cap màquina: importa-la de Maestro."}
          </Text>
        }
        detail={
          m && (
            <Stack gap={6}>
              <SettingsGroup
                icon={<LuFactory />}
                title={m.name}
                summary={[m.serial, m.model].filter(Boolean).join(" · ") || "Màquina"}
                actions={
                  <>
                    <IconButton aria-label="Per defecte a l'export" title="Per defecte a l'export" size="xs" variant="ghost" colorPalette={m.isDefault ? "wood" : undefined} onClick={() => makeDefault(m.id)}>
                      <LuStar fill={m.isDefault ? "currentColor" : "none"} />
                    </IconButton>
                    <IconButton
                      aria-label="Duplicar màquina"
                      title="Duplicar màquina"
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        const copy: Machine = { ...structuredClone(m), id: newId("mach"), name: `${m.name} (còpia)`, isDefault: false }
                        const next = [...machines]
                        next.splice(i + 1, 0, copy)
                        onChange(next)
                        setSel(copy.id)
                      }}
                    >
                      <LuCopy />
                    </IconButton>
                    <IconButton
                      aria-label="Eliminar màquina"
                      title="Eliminar màquina"
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      onClick={() => {
                        const rest = machines.filter((_, k) => k !== i)
                        if (m.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true }
                        onChange(rest)
                        setSel(null)
                      }}
                    >
                      <LuTrash2 />
                    </IconButton>
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
                  <Switch.Root size="sm" pt={1.5} checked={m.isDefault} onCheckedChange={(e) => (e.checked ? makeDefault(m.id) : update({ isDefault: false }))}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">La de l'export «Programes .xcs»</Switch.Label>
                  </Switch.Root>
                </FormRow>
              </SettingsGroup>

              <SettingsGroup icon={<LuFactory />} title="Programes .xcs" summary={`capçalera ${m.header.executionFields} · passants +${m.throughExtra} mm`}>
                <FormRow label="Àrea de treball" help="Primer paràmetre de SetMachiningParameters (ExecutionFields de Maestro), p. ex. «AD».">
                  <Input size="sm" maxW="120px" value={m.header.executionFields} onChange={(e) => update({ header: { ...m.header, executionFields: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || "A" } })} />
                </FormRow>
                <NumRow label="Passants (de més)" help="Els forats i talls passants baixen aquest tant per sota de la peça." value={m.throughExtra} min={0} max={5} step={0.5} onChange={(throughExtra) => update({ throughExtra })} />
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
              </SettingsGroup>

              <ToolsTable tools={m.tools} onChange={(tools) => update({ tools })} />
            </Stack>
          )
        }
      />
    </>
  )
}

/** Taula d'eines agrupada per tipus; tocar-ne una l'obre per editar-la. */
function ToolsTable({ tools, onChange }: { tools: MachineTool[]; onChange: (t: MachineTool[]) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const set = (code: string, patch: Partial<MachineTool>) => onChange(tools.map((t) => (t.code === code ? { ...t, ...patch } : t)))
  const add = () => {
    let n = 1
    while (tools.some((t) => t.code === `NOVA${n}`)) n++
    const t: MachineTool = { code: `NOVA${n}`, name: "Eina nova", kind: "router", diameter: 10, maxDepth: 30, mounted: true, auto: true, manual: true }
    onChange([...tools, t])
    setOpen(t.code)
  }
  const available = tools.filter((t) => t.mounted && t.auto).length
  return (
    <SettingsGroup
      icon={<LuFactory />}
      title="Eines"
      summary={`${tools.length} eines · ${available} per a l'export (muntades i automàtiques)`}
      actions={
        <Button size="xs" variant="ghost" onClick={add}>
          <LuPlus /> Afegir eina
        </Button>
      }
    >
      <Text fontSize="sm" color="fg.muted">
        L'export tria les broques pel diàmetre exacte i la fondària útil, i les freses i els discs per la mida que hi cap. Només fa servir les
        eines muntades i marcades com a automàtiques (els exemples de SCM i els palpadors, no). Les eines que no surten a Maestro es poden
        afegir a mà amb el codi de Maestro.
      </Text>
      {TOOL_GROUPS.map((g) => {
        const list = tools.filter(g.match)
        if (!list.length) return null
        return (
          <Stack key={g.id} gap={1.5}>
            <HStack gap={2}>
              <SectionLabel>{g.label}</SectionLabel>
              <Badge size="xs" variant="subtle" colorPalette="gray">
                {list.length}
              </Badge>
            </HStack>
            <Grid templateColumns="minmax(0, 1fr)" fontSize="sm" borderWidth="1px" rounded="md" overflow="hidden" bg="bg.panel">
              <Grid templateColumns={COLS} columnGap={3} py={1} bg="bg.subtle" color="fg.muted" fontSize="xs">
                <Text px={2}>Codi</Text>
                <Text>Nom</Text>
                <Text textAlign="right">Ø</Text>
                <Text textAlign="right">Fondària</Text>
                <Text pe={2}>Posició</Text>
              </Grid>
              {list.map((t) => {
                const on = open === t.code
                const dim = !t.mounted || !t.auto
                return (
                  <Fragment key={t.code}>
                    <Box gridColumn="1 / -1" as="button" textAlign="left" cursor="pointer" borderTopWidth="1px" bg={on ? "wood.subtle" : undefined} _hover={{ bg: on ? "wood.subtle" : "bg.muted" }} onClick={() => setOpen(on ? null : t.code)} aria-expanded={on}>
                      <Grid templateColumns={COLS} columnGap={3} alignItems="center" py={1.5} opacity={dim ? 0.55 : 1}>
                        <Text fontFamily="mono" fontSize="xs" px={2}>{t.code}</Text>
                        <Text truncate title={t.name}>{t.name}{t.manual ? " ·  a mà" : ""}</Text>
                        <Text textAlign="right">{t.diameter}</Text>
                        <Text textAlign="right">{t.maxDepth || "—"}</Text>
                        <Text fontSize="xs" color="fg.muted" truncate pe={2}>{where(t)}</Text>
                      </Grid>
                    </Box>
                    {on && (
                      <Box gridColumn="1 / -1" borderTopWidth="1px">
                        <ToolEditor tool={t} codes={tools.map((x) => x.code)} onChange={(patch) => { set(t.code, patch); if (patch.code) setOpen(patch.code) }} onDelete={t.manual ? () => { onChange(tools.filter((x) => x.code !== t.code)); setOpen(null) } : undefined} />
                      </Box>
                    )}
                  </Fragment>
                )
              })}
            </Grid>
          </Stack>
        )
      })}
    </SettingsGroup>
  )
}

const KINDS: ToolKind[] = ["drill", "router", "blade", "aggregate", "probe", "other"]

function ToolEditor({ tool: t, codes, onChange, onDelete }: { tool: MachineTool; codes: string[]; onChange: (p: Partial<MachineTool>) => void; onDelete?: () => void }) {
  const [code, setCode] = useState(t.code)
  const clash = code !== t.code && codes.includes(code)
  return (
    <FormSection title={`Eina ${t.code}`}>
      <FormRow label="Nom" maxW="360px">
        <Input size="sm" value={t.name} onChange={(e) => onChange({ name: e.target.value })} />
      </FormRow>
      {t.manual && (
        <FormRow label="Codi a Maestro" help={clash ? "Ja hi ha una eina amb aquest codi." : "El que va al paràmetre «tool» de l'MSL (p. ex. E128)."} maxW="160px">
          <Input size="sm" value={code} onChange={(e) => setCode(e.target.value.trim())} onBlur={() => code && !clash && code !== t.code && onChange({ code })} />
        </FormRow>
      )}
      {t.manual && (
        <FormRow label="Tipus">
          <ChoiceChips<ToolKind> label="Tipus" options={KINDS.map((k) => ({ id: k, label: TOOL_KIND_LABELS[k] }))} value={t.kind} onChange={(kind) => onChange({ kind, ...(kind === "drill" ? { orientation: t.orientation ?? "vertical" } : {}) })} />
        </FormRow>
      )}
      {t.kind === "drill" && (
        <FormRow label="Orientació">
          <ChoiceChips<"vertical" | "horizontal">
            label="Orientació"
            options={[
              { id: "vertical", label: "Vertical (cara)" },
              { id: "horizontal", label: "Horitzontal (cantell)" },
            ]}
            value={t.orientation ?? "vertical"}
            onChange={(orientation) => onChange({ orientation })}
          />
        </FormRow>
      )}
      <NumRow label="Diàmetre" value={t.diameter} min={0} max={400} step={0.5} onChange={(diameter) => onChange({ diameter })} />
      <NumRow label="Fondària útil" help="0 = desconeguda (no es comprova)." value={t.maxDepth} min={0} max={300} step={1} onChange={(maxDepth) => onChange({ maxDepth })} />
      {t.kind === "blade" && <NumRow label="Gruix del disc" value={t.bladeThickness ?? 0} min={0} max={20} step={0.1} onChange={(bladeThickness) => onChange({ bladeThickness })} />}
      <FormRow label="Export">
        <Stack gap={2} pt={1.5}>
          <Switch.Root size="sm" checked={t.auto} onCheckedChange={(e) => onChange({ auto: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Triar-la automàticament</Switch.Label>
          </Switch.Root>
          <Switch.Root size="sm" checked={t.mounted} onCheckedChange={(e) => onChange({ mounted: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Muntada a la màquina</Switch.Label>
          </Switch.Root>
        </Stack>
      </FormRow>
      {onDelete && (
        <Button size="xs" variant="ghost" colorPalette="red" alignSelf="flex-start" onClick={onDelete}>
          <LuTrash2 /> Eliminar l'eina
        </Button>
      )}
    </FormSection>
  )
}
