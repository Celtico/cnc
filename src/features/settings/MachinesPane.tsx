import { Badge, Box, Button, Grid, HStack, IconButton, Input, Stack, Switch, Text } from "@chakra-ui/react"
import { Fragment, useContext, useEffect, useRef, useState } from "react"
import { LuCopy, LuFactory, LuFileUp, LuFolderOpen, LuPlus, LuStar, LuTrash2, LuUpload } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { MasterDetail } from "../../components/MasterDetail"
import { NumRow } from "../../components/NumRow"
import { SettingsGroup } from "../../components/SettingsGroup"
import { SectionLabel } from "../../components/SectionLabel"
import { toaster } from "../../components/ui/toaster"
import { isPlaceholderTool, machineNesting, newId, TOOL_EDITABLE, TOOL_KIND_LABELS, type Machine, type MachineTool, type ToolEditable, type ToolKind } from "../../core/model"
import { usableTool } from "../../core/machine/tools"
import { importMaestroFiles, pickedFromDrop, pickedFromList, type PickedFile } from "./machineImport"
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

  /** Màquina on van els .pgmx sense màquina pròpia: la del botó del detall o la seleccionada. */
  const target = useRef<string | undefined>(undefined)
  const [dragOver, setDragOver] = useState(false)

  const doImport = async (picked: PickedFile[], input?: HTMLInputElement | null) => {
    if (!picked.length) return
    setBusy(true)
    try {
      const r = await importMaestroFiles(picked, machines, target.current ?? m?.id)
      onChange(r.machines)
      if (r.selected) setSel(r.selected)
      toaster.create({
        title: "Importat de Maestro",
        description: [...r.lines, ...r.problems].join(" "),
        type: r.problems.length ? "warning" : "success",
        duration: 12000,
      })
    } catch (e) {
      toaster.create({ title: "No s'ha pogut importar de Maestro", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    } finally {
      setBusy(false)
      target.current = undefined
      if (input) input.value = ""
    }
  }
  const pick = (which: "folder" | "files", machineId?: string) => {
    target.current = machineId
    ;(which === "folder" ? folderInput : filesInput).current?.click()
  }

  const q = query.trim().toLowerCase()
  const shown = machines.filter((x) => !q || `${x.name} ${x.serial} ${x.model}`.toLowerCase().includes(q))

  return (
    <>
      {/* Carpeta (`webkitdirectory`: .machinecontext o .pgmx desplegat) o fitxers; el navegador no deixa triar totes dues coses alhora. */}
      <input ref={(el) => { folderInput.current = el; el?.setAttribute("webkitdirectory", "") }} type="file" multiple hidden data-testid="machine-folder" onChange={(e) => void doImport(pickedFromList(e.target.files ?? []), e.target)} />
      <input ref={filesInput} type="file" multiple hidden accept=".pgmx,.xml,.zip,.tlgx,.atrx,.cfgx" data-testid="machine-files" onChange={(e) => void doImport(pickedFromList(e.target.files ?? []), e.target)} />
      <MasterDetail
        head={
          <Stack gap={3}>
            {head}
            <Box
              borderWidth="1px"
              borderStyle="dashed"
              borderColor={dragOver ? "wood.solid" : "border"}
              bg={dragOver ? "wood.subtle" : "bg.subtle"}
              rounded="l2"
              p={3}
              data-testid="machine-drop"
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void pickedFromDrop(e.dataTransfer).then((p) => doImport(p))
              }}
            >
              <Stack gap={2}>
                <Text fontSize="sm" fontWeight="medium">
                  <LuUpload style={{ display: "inline", verticalAlign: "-2px" }} /> Importar de Maestro
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Carpeta <Text as="span" fontFamily="mono">.machinecontext</Text> (configuració de la màquina) · Projecte{" "}
                  <Text as="span" fontFamily="mono">.pgmx</Text> (fitxer o carpeta desplegada) · fitxers <Text as="span" fontFamily="mono">.tlgx</Text> /{" "}
                  <Text as="span" fontFamily="mono">.atrx</Text>. També es poden deixar anar aquí. El context crea o actualitza la màquina; el
                  .pgmx hi posa els noms de les eines del taller i la capçalera.
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Button colorPalette="wood" size="sm" loading={busy} onClick={() => pick("folder")}>
                    <LuFolderOpen /> Triar carpeta…
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => pick("files")}>
                    <LuFileUp /> Triar fitxers…
                  </Button>
                </HStack>
              </Stack>
            </Box>
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
        onAdd={() => pick("folder")}
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

              <SettingsGroup
                icon={<LuFactory />}
                title="Projecte de Maestro (.pgmx)"
                summary={m.pgmx ? `${m.pgmx.file} · Maestro ${m.pgmx.version}` : "noms de les eines del taller"}
                actions={
                  <Button size="xs" variant="ghost" loading={busy} title="Importar un .pgmx a aquesta màquina" onClick={() => pick("files", m.id)}>
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

              <SettingsGroup icon={<LuFactory />} title="Programes .xcs" summary={`capçalera ${m.header.executionFields} · passants +${m.throughExtra} mm`}>
                <FormSection title="Capçalera (SetMachiningParameters)">
                  <FormRow label="Àrea de treball" help="ExecutionFields de Maestro, p. ex. «AD».">
                    <Input size="sm" maxW="120px" value={m.header.executionFields} onChange={(e) => update({ header: { ...m.header, executionFields: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || "A" } })} />
                  </FormRow>
                  <NumRow label="Repeticions" suffix="" value={m.header.repetitions} min={1} max={99} step={1} onChange={(repetitions) => update({ header: { ...m.header, repetitions: Math.max(1, Math.round(repetitions)) } })} />
                  <FormRow label="Taula" help="TableOptions (tipus de fixació). El .pgmx del taller diu 10.">
                    <Input size="sm" maxW="160px" inputMode="numeric" value={String(m.header.tableOptions)} onChange={(e) => update({ header: { ...m.header, tableOptions: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} />
                  </FormRow>
                  <FormRow label="Opcions mecàniques" help="MechanicalOptions: un número de Maestro (bits). El .pgmx del taller diu 16973824.">
                    <Input size="sm" maxW="160px" inputMode="numeric" value={String(m.header.mechanicalOptions)} onChange={(e) => update({ header: { ...m.header, mechanicalOptions: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} />
                  </FormRow>
                  <FormRow label="Cicle continu">
                    <Switch.Root size="sm" pt={1.5} checked={m.header.continuousCycle} onCheckedChange={(e) => update({ header: { ...m.header, continuousCycle: e.checked } })}>
                      <Switch.HiddenInput />
                      <Switch.Control />
                      <Switch.Label fontSize="sm">ContinuousCycle</Switch.Label>
                    </Switch.Root>
                  </FormRow>
                  {(m.header.technologicalMirror !== undefined || m.header.preserveWorkingSequence !== undefined) && (
                    <FormRow label="Altres (Maestro)" help="No tenen paràmetre a l'MSL: es posen a Maestro si cal.">
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
              </SettingsGroup>

              <SettingsGroup
                icon={<LuFactory />}
                title="Programes per tauler (nesting)"
                summary={`marge ${machineNesting(m).edgeTrim} mm · separació Ø + ${machineNesting(m).spacingExtra} · martiri ${machineNesting(m).overcut} mm`}
              >
                <FormRow label="Fresa del contorn" help="Contorns de les peces per fora. Automàtica: la que diu «nesting» al nom o, si no, la més petita que travessa el tauler.">
                  <ChoiceChips<string>
                    label="Fresa del contorn"
                    options={[
                      { id: "", label: "Automàtica" },
                      ...m.tools.filter((t) => t.kind === "router" && usableTool(t)).map((t) => ({ id: t.code, label: `${t.code} · Ø${t.diameter}` })),
                    ]}
                    value={machineNesting(m).tool ?? ""}
                    onChange={(tool) => update({ nesting: { ...machineNesting(m), tool: tool || undefined } })}
                  />
                </FormRow>
                <NumRow label="Marge del tauler" help="Vora del tauler que no s'aprofita." value={machineNesting(m).edgeTrim} min={0} max={100} step={1} onChange={(edgeTrim) => update({ nesting: { ...machineNesting(m), edgeTrim } })} />
                <NumRow label="Separació (Ø +)" help="Entre peces: el Ø de la fresa del contorn més aquest tant." value={machineNesting(m).spacingExtra} min={0} max={20} step={0.5} onChange={(spacingExtra) => update({ nesting: { ...machineNesting(m), spacingExtra } })} />
                <NumRow label="Martiri" help="Els contorns i talls passants baixen aquest tant per sota del tauler." value={machineNesting(m).overcut} min={0} max={3} step={0.1} onChange={(overcut) => update({ nesting: { ...machineNesting(m), overcut } })} />
                <FormRow label="Peces petites" help="Ordre dels contorns: les peces petites (menys aguantades pel buit) al final o al principi.">
                  <ChoiceChips<"last" | "first">
                    label="Peces petites"
                    options={[
                      { id: "last", label: "Al final" },
                      { id: "first", label: "Al principi" },
                    ]}
                    value={machineNesting(m).smallParts}
                    onChange={(smallParts) => update({ nesting: { ...machineNesting(m), smallParts } })}
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
  // Els camps tocats queden a `edited` (una reimportació no els trepitja).
  const set = (code: string, patch: Partial<MachineTool>) =>
    onChange(
      tools.map((t) => {
        if (t.code !== code) return t
        const touched = (Object.keys(patch) as ToolEditable[]).filter((k) => (TOOL_EDITABLE as readonly string[]).includes(k))
        const edited = [...new Set([...(t.edited ?? []), ...touched])]
        const next = { ...t, ...patch, ...(edited.length ? { edited } : {}) }
        // Una «Eina nova» passa a automàtica quan rep el codi de Maestro (si no s'ha tocat a mà).
        if (patch.code && isPlaceholderTool(t) && !isPlaceholderTool(next) && !t.edited?.includes("auto")) next.auto = true
        return next
      }),
    )
  const add = () => {
    let n = 1
    while (tools.some((t) => t.code === `NOVA${n}`)) n++
    // Sense codi de Maestro de debò no es pot triar (auto: false fins que se li posa).
    const t: MachineTool = { code: `NOVA${n}`, name: "Eina nova", kind: "router", diameter: 10, maxDepth: 30, mounted: true, auto: false, manual: true }
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
                        <Text truncate title={t.mslName ? `${t.name} · a l'MSL: ${t.mslName}` : t.name}>{t.name}{t.manual ? " ·  a mà" : ""}{isPlaceholderTool(t) ? " · falta el codi" : ""}</Text>
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
      <FormRow label="Nom a Maestro" help={`El que va al paràmetre «tool» de l'MSL. Buit = el codi (${t.code}). Ve del .pgmx importat.`} maxW="360px">
        <Input size="sm" value={t.mslName ?? ""} placeholder={t.code} onChange={(e) => onChange({ mslName: e.target.value || undefined })} />
      </FormRow>
      {t.manual && (
        <FormRow label="Codi a Maestro" help={clash ? "Ja hi ha una eina amb aquest codi." : isPlaceholderTool(t) ? "Posa-hi el codi de Maestro (p. ex. E128): fins llavors no es tria." : "El codi de l'eina a Maestro (p. ex. E128)."} maxW="160px">
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
