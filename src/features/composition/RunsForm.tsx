import { Button, HStack, IconButton, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuPanelBottom, LuPanelTop, LuPlus, LuSquareDashed, LuTrash2 } from "react-icons/lu"
import { CUTOUT_PRESETS, boardChoices, newId, type Composition, type Run, type WorktopCutout, type WorktopRun } from "../../core/model"
import { NumRow } from "../../components/NumRow"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { moduleChips } from "./moduleChips"
import { MaterialSelect } from "../settings/MaterialSelect"
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
      // `off: false`: es fa (els que no en porten, d'un moble que no era cuina, `migrateRuns` els apaga en llegir).
      { id, kind: "worktop", from: first.id, to: last.id, material: "Roure massís / xapat", thickness: 30, overhangFront: 20, overhangLeft: 0, overhangRight: 0, cutouts: [], off: false },
    ])
  }
  const addPlinth = () => {
    if (!first || !last) return
    const id = newId("run")
    setOpenId(id)
    setRuns([...runs, { id, kind: "plinth", from: first.id, to: last.id, material: first.carcass.frontMaterial ?? first.carcass.material, thickness: 16, setback: 50, off: false }])
  }

  const moduleSelect = (label: string, value: string, onPick: (id: string) => void) => (
    <FormRow label={label}>
      <ChoiceChips label={label} options={moduleChips(row, value)} value={value} onChange={onPick} />
    </FormRow>
  )

  return (
    <Stack gap={4}>
      {runs.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          Peces d'una sola tirada per sobre o per sota de diversos mòduls: el taulell (amb els forats de la pica i la vitro) i el sòcol de davant de les potes.
        </Text>
      )}
      {runs.length > 0 && (
        <FoldGroup variant="card" multiple={false} value={openId ? [openId] : []} onValueChange={(v) => setOpenId(v[0] ?? null)}>
          {runs.map((r) => (
            <FoldItem
              key={r.id}
              id={r.id}
              icon={r.kind === "worktop" ? LuPanelTop : LuPanelBottom}
              title={r.kind === "worktop" ? "Taulell" : "Sòcol corregut"}
              badge={r.off ? "Apagat" : undefined}
              badgePalette="gray"
              summary={`${r.off ? "Apagat · " : ""}${name(r.from)} → ${name(r.to)} · ${r.thickness} mm${r.kind === "worktop" && r.cutouts.length ? ` · ${r.cutouts.length} ${r.cutouts.length === 1 ? "forat" : "forats"}` : ""}`}
              actions={<RemoveButton label={r.kind === "worktop" ? "Eliminar el taulell" : "Eliminar el sòcol"} onClick={() => setRuns(runs.filter((x) => x.id !== r.id))} />}
            >
              {/* Res amagat compta: un d'apagat (el d'un moble que no era cuina) es conserva però no es fa. */}
              <FormRow label="Es fa" help={r.off ? "Apagat: es conserva però no surt a les peces ni als fitxers del taller." : undefined}>
                <Switch.Root size="sm" pt="6px" checked={!r.off} onCheckedChange={(e) => update(r.id, { off: !e.checked })}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">{r.kind === "worktop" ? "Fer el taulell" : "Fer el sòcol"}</Switch.Label>
                </Switch.Root>
              </FormRow>
              {moduleSelect("Des de", r.from, (from) => update(r.id, { from }))}
              {moduleSelect("Fins a", r.to, (to) => update(r.id, { to }))}
              <FormRow label="Material" maxW="280px">
                <MaterialSelect label="Material" hideLabel materials={boardChoices(settings.materials)} value={r.material} onChange={(material) => update(r.id, { material })} />
              </FormRow>
              <NumRow label="Gruix" value={r.thickness} min={10} max={60} step={1} onChange={(thickness) => update(r.id, { thickness })} />
              {r.kind === "plinth" ? (
                <>
                  <NumRow label="Retranqueig" value={r.setback} min={0} max={150} step={5} onChange={(setback) => update(r.id, { setback })} help="Des de la cara dels fronts. L'alçada és la de les potes." />
                </>
              ) : (
                <WorktopFields run={r} comp={comp} onChange={(patch) => update(r.id, patch)} />
              )}
            </FoldItem>
          ))}
        </FoldGroup>
      )}
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
      {run.cutouts.length > 0 && (
        <FoldGroup variant="card" size="sm" multiple={false} value={openCut ? [openCut] : []} onValueChange={(v) => setOpenCut(v[0] ?? null)}>
          {run.cutouts.map((c) => (
            <FoldItem
              key={c.id}
              id={c.id}
              icon={LuSquareDashed}
              title={CUTOUT_PRESETS[c.kind].label}
              summary={`${c.w} × ${c.d} · ${comp.modules.find((m) => m.id === c.module)?.name ?? "?"}`}
              actions={<RemoveButton label="Treure el forat" onClick={() => onChange({ cutouts: run.cutouts.filter((x) => x.id !== c.id) })} />}
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
                    options={moduleChips(comp.modules.filter((m) => m.carcass.base.kind !== "wall"), c.module)}
                    value={c.module}
                    onChange={(module) => setCut(c.id, { module })}
                  />
                </FormRow>
                <NumRow label="Ample" value={c.w} min={50} max={2000} step={5} onChange={(w) => setCut(c.id, { w })} />
                <NumRow label="Fondària" value={c.d} min={50} max={1000} step={5} onChange={(d) => setCut(c.id, { d })} />
                <NumRow label="Desplaçament" help="Mida del forat d'encastar (la del full d'instruccions de l'aparell), centrat al mòdul; el desplaçament el mou a la dreta (+) o a l'esquerra (−)." value={c.dx} min={-1000} max={1000} step={5} onChange={(dx) => setCut(c.id, { dx })} />
              </Stack>
            </FoldItem>
          ))}
        </FoldGroup>
      )}
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

/** La paperera de la capçalera d'un taulell, sòcol o forat (al costat del plegable, no a dins). */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton size="xs" variant="ghost" colorPalette="red" aria-label={label} title={label} onClick={onClick}>
      <LuTrash2 />
    </IconButton>
  )
}
