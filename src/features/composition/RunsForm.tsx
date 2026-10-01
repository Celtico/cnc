import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuChevronDown, LuChevronRight, LuPanelBottom, LuPanelTop, LuPlus, LuSquareDashed, LuTrash2 } from "react-icons/lu"
import { CUTOUT_PRESETS, newId, type Composition, type Run, type WorktopCutout, type WorktopRun } from "../../core/model"
import { NumRow } from "../editor/ParamsForm"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { MaterialSelect } from "../settings/SettingsScreen"
import { useSettings } from "../settings/SettingsContext"

/**
 * Taulells i sòcols correguts del moble: peces d'una sola tirada que van d'un mòdul a un
 * altre de la fila (p. ex. el taulell de la cuina amb els forats de la pica i la vitro).
 */
export function RunsForm({ comp, onChange }: { comp: Composition; onChange: (c: Composition) => void }) {
  const { settings } = useSettings()
  const runs = comp.runs ?? []
  const row = comp.modules.filter((m) => m.carcass.base.kind !== "wall")
  const setRuns = (next: Run[]) => onChange({ ...comp, runs: next })
  const update = (id: string, patch: Partial<Run>) => setRuns(runs.map((r) => (r.id === id ? ({ ...r, ...patch } as Run) : r)))
  const first = row[0]
  const last = row.at(-1)
  // Acordió: només una peça oberta alhora (la nova s'obre sola).
  const [openId, setOpenId] = useState<string | null>(null)
  const name = (id: string) => comp.modules.find((m) => m.id === id)?.name ?? "?"

  const addWorktop = () => {
    if (!first || !last) return
    const id = newId("run")
    setOpenId(id)
    setRuns([
      ...runs,
      { id, kind: "worktop", from: first.id, to: last.id, material: "Roure massís / xapat", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [] },
    ])
  }
  const addPlinth = () => {
    if (!first || !last) return
    const id = newId("run")
    setOpenId(id)
    setRuns([...runs, { id, kind: "plinth", from: first.id, to: last.id, material: first.carcass.frontMaterial ?? first.carcass.material, thickness: 16, setback: 50 }])
  }

  const moduleSelect = (label: string, value: string, onPick: (id: string) => void) => (
    <FormRow label={label}>
      <ChoiceChips label={label} options={row.map((m) => ({ id: m.id, label: m.name }))} value={value} onChange={onPick} />
    </FormRow>
  )

  return (
    <Stack gap={4}>
      {runs.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          Peces d'una sola tirada per sobre o per sota de diversos mòduls: el taulell (amb els forats de la pica i la vitro) i el sòcol de davant de les potes.
        </Text>
      )}
      {runs.map((r) => (
        <Fold
          key={r.id}
          open={openId === r.id}
          onToggle={() => setOpenId(openId === r.id ? null : r.id)}
          icon={r.kind === "worktop" ? <LuPanelTop /> : <LuPanelBottom />}
          title={r.kind === "worktop" ? "Taulell" : "Sòcol corregut"}
          summary={`${name(r.from)} → ${name(r.to)} · ${r.thickness} mm${r.kind === "worktop" && r.cutouts.length ? ` · ${r.cutouts.length} ${r.cutouts.length === 1 ? "forat" : "forats"}` : ""}`}
          onRemove={() => setRuns(runs.filter((x) => x.id !== r.id))}
          removeLabel={r.kind === "worktop" ? "Eliminar el taulell" : "Eliminar el sòcol"}
        >
          {moduleSelect("Des de", r.from, (from) => update(r.id, { from }))}
          {moduleSelect("Fins a", r.to, (to) => update(r.id, { to }))}
          <FormRow label="Material" maxW="280px">
            <MaterialSelect label="Material" hideLabel materials={settings.materials.filter((m) => !m.forBacks && m.category !== "sim")} value={r.material} onChange={(material) => update(r.id, { material })} />
          </FormRow>
          <NumRow label="Gruix" value={r.thickness} min={10} max={60} step={1} onChange={(thickness) => update(r.id, { thickness })} />
          {r.kind === "plinth" ? (
            <>
              <NumRow label="Retranqueig" value={r.setback} min={0} max={150} step={5} onChange={(setback) => update(r.id, { setback })} help="Des de la cara dels fronts. L'alçada és la de les potes." />
            </>
          ) : (
            <WorktopFields run={r} comp={comp} onChange={(patch) => update(r.id, patch)} />
          )}
        </Fold>
      ))}
      <HStack wrap="wrap" gap={2}>
        <Button size="xs" variant="outline" disabled={!first} onClick={addWorktop}>
          <LuPlus /> Taulell
        </Button>
        <Button size="xs" variant="outline" disabled={!first} onClick={addPlinth}>
          <LuPlus /> Sòcol corregut
        </Button>
      </HStack>
    </Stack>
  )
}

function WorktopFields({ run, comp, onChange }: { run: WorktopRun; comp: Composition; onChange: (patch: Partial<WorktopRun>) => void }) {
  const [openCut, setOpenCut] = useState<string | null>(null)
  const setCut = (id: string, patch: Partial<WorktopCutout>) => onChange({ cutouts: run.cutouts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const addCut = (kind: WorktopCutout["kind"]) => {
    const p = CUTOUT_PRESETS[kind]
    const target = comp.modules.find((m) => m.id === run.from) ?? comp.modules[0]!
    const id = newId("cut")
    setOpenCut(id)
    onChange({ cutouts: [...run.cutouts, { id, kind, module: target.id, w: p.w, d: p.d, dx: 0 }] })
  }
  return (
    <>
      {/* Voladís per davant dels fronts i per cada costat. */}
      <NumRow label="Voladís davant" help="Per davant dels fronts." value={run.overhangFront} min={0} max={200} step={5} onChange={(overhangFront) => onChange({ overhangFront })} />
      <NumRow label="Voladís esquerra" value={run.overhangLeft} min={0} max={500} step={5} onChange={(overhangLeft) => onChange({ overhangLeft })} />
      <NumRow label="Voladís dreta" value={run.overhangRight} min={0} max={500} step={5} onChange={(overhangRight) => onChange({ overhangRight })} />
      {run.cutouts.map((c) => (
        <Fold
          key={c.id}
          small
          open={openCut === c.id}
          onToggle={() => setOpenCut(openCut === c.id ? null : c.id)}
          icon={<LuSquareDashed />}
          title={CUTOUT_PRESETS[c.kind].label}
          summary={`${c.w} × ${c.d} · ${comp.modules.find((m) => m.id === c.module)?.name ?? "?"}`}
          onRemove={() => onChange({ cutouts: run.cutouts.filter((x) => x.id !== c.id) })}
          removeLabel="Treure el forat"
        >
          <Stack gap={2}>
            <FormRow label="Tipus">
              <ChoiceChips
                label="Tipus"
                options={(Object.keys(CUTOUT_PRESETS) as WorktopCutout["kind"][]).map((k) => ({ id: k, label: CUTOUT_PRESETS[k].label }))}
                value={c.kind}
                onChange={(kind) => setCut(c.id, { kind })}
              />
            </FormRow>
            <FormRow label="Sobre">
              <ChoiceChips
                label="Sobre"
                options={comp.modules.filter((m) => m.carcass.base.kind !== "wall").map((m) => ({ id: m.id, label: m.name }))}
                value={c.module}
                onChange={(module) => setCut(c.id, { module })}
              />
            </FormRow>
            <NumRow label="Ample" value={c.w} min={50} max={2000} step={5} onChange={(w) => setCut(c.id, { w })} />
            <NumRow label="Fons" value={c.d} min={50} max={1000} step={5} onChange={(d) => setCut(c.id, { d })} />
            <NumRow label="Desplaçament" help="Mida del forat d'encastar (la del full d'instruccions de l'aparell), centrat al mòdul; el desplaçament el mou a la dreta (+) o a l'esquerra (−)." value={c.dx} min={-1000} max={1000} step={5} onChange={(dx) => setCut(c.id, { dx })} />
          </Stack>
        </Fold>
      ))}
      <HStack wrap="wrap" gap={2}>
        <Button size="xs" variant="ghost" onClick={() => addCut("hob")}>
          <LuPlus /> Forat de placa
        </Button>
        <Button size="xs" variant="ghost" onClick={() => addCut("sink")}>
          <LuPlus /> Forat de pica
        </Button>
        <Button size="xs" variant="ghost" onClick={() => addCut("custom")}>
          <LuPlus /> A mida
        </Button>
      </HStack>
    </>
  )
}

/** Element plegable (acordió) dins del formulari: capçalera amb resum i paperera. */
function Fold({
  open,
  onToggle,
  icon,
  title,
  summary,
  onRemove,
  removeLabel,
  small,
  children,
}: {
  open: boolean
  onToggle: () => void
  icon: ReactNode
  title: string
  summary: string
  onRemove: () => void
  removeLabel: string
  small?: boolean
  children: ReactNode
}) {
  return (
    <Box borderWidth="1px" rounded="md" bg={open ? undefined : "bg.subtle"}>
      <HStack gap={1} pl={2} pr={1} py={small ? 1 : 1.5}>
        <HStack as="button" flex={1} minW={0} gap={2} textAlign="left" cursor="pointer" onClick={onToggle} aria-expanded={open}>
          <Box color="fg.muted" flexShrink={0}>
            {open ? <LuChevronDown /> : <LuChevronRight />}
          </Box>
          <Box color="wood.fg" flexShrink={0}>
            {icon}
          </Box>
          <Stack gap={0} minW={0}>
            <Text fontWeight="semibold" fontSize="sm" truncate>
              {title}
            </Text>
            {!open && (
              <Text fontSize="xs" color="fg.muted" truncate>
                {summary}
              </Text>
            )}
          </Stack>
        </HStack>
        <IconButton size="xs" variant="ghost" colorPalette="red" aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      {open && (
        <Stack gap={3} px={3} pb={3} pt={1}>
          {children}
        </Stack>
      )}
    </Box>
  )
}
