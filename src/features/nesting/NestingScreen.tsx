import {
  Alert,
  Badge,
  Card,
  HStack,
  SimpleGrid,
  Stack,
  Stat,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"
import { BoardDrawing } from "../../components/BoardDrawing"
import { STANDARD_SHEETS, type NestOptions } from "../../core/nesting/nest"
import { updateProjectNesting } from "../../db/db"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumRow } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"
import { useCompositionPanels, useNesting, useProject } from "../useProject"

export function NestingScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  if (!project) return null
  return <NestingView key={project.id} projectId={project.id} initial={project.nesting} />
}

function NestingView({ projectId, initial }: { projectId: number; initial: NestOptions }) {
  const project = useProject(projectId)
  const panels = useCompositionPanels(project)
  const [options, setOptions] = useState<NestOptions>(initial)
  const nesting = useNesting(panels, options)

  useEffect(() => {
    if (options === initial) return
    const t = setTimeout(() => void updateProjectNesting(projectId, options), 300)
    return () => clearTimeout(t)
  }, [options, projectId, initial])

  const byId = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels])
  const { settings } = useSettings()
  const sheetKey = `${options.sheet.w}x${options.sheet.h}`
  // Taulers estàndard més els de les preferències (sense repetir).
  const sheets = useMemo(() => {
    const out = [...STANDARD_SHEETS]
    for (const s of settings.boards.sheets) if (!out.some((x) => x.w === s.w && x.h === s.h)) out.push({ label: `${s.w} × ${s.h}`, w: s.w, h: s.h })
    return out
  }, [settings])
  const standardKey = sheets.find((s) => `${s.w}x${s.h}` === sheetKey) ? sheetKey : "custom"

  return (
    <VStack align="stretch" gap={5}>

      <Card.Root variant="outline">
        <Card.Body gap={4}>
          {/* Molts formats de tauler: pastilles que salten de línia en lloc d'un control segmentat. */}
          <FormRow label="Tauler">
            <ChoiceChips
              label="Tauler"
              value={standardKey}
              options={[...sheets.map((s) => ({ id: `${s.w}x${s.h}`, label: s.label })), ...(standardKey === "custom" ? [{ id: "custom", label: "A mida" }] : [])]}
              onChange={(v) => {
                const s = sheets.find((x) => `${x.w}x${x.h}` === v)
                if (s) setOptions((o) => ({ ...o, sheet: { w: s.w, h: s.h } }))
              }}
            />
          </FormRow>
          <NumRow label="Ample tauler" value={options.sheet.w} min={300} max={6000} step={10} onChange={(w) => setOptions((o) => ({ ...o, sheet: { ...o.sheet, w } }))} />
          <NumRow label="Alt tauler" value={options.sheet.h} min={300} max={6000} step={10} onChange={(h) => setOptions((o) => ({ ...o, sheet: { ...o.sheet, h } }))} />
          <NumRow label="Kerf (fresa)" value={options.kerf} min={0} max={30} step={0.5} onChange={(kerf) => setOptions((o) => ({ ...o, kerf }))} />
          <NumRow label="Marge tauler" value={options.margin} min={0} max={100} step={1} onChange={(margin) => setOptions((o) => ({ ...o, margin }))} />
          <FormRow label="Veta">
            <Switch.Root size="sm" pt="6px" checked={!!options.ignoreGrain} onCheckedChange={(e) => setOptions((o) => ({ ...o, ignoreGrain: e.checked || undefined }))}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Permetre girar les peces encara que tinguin veta</Switch.Label>
            </Switch.Root>
          </FormRow>
          {options.sheetsByMaterial && Object.keys(options.sheetsByMaterial).length > 0 && (
            <Text fontSize="xs" color="fg.muted">
              Taulers per material (de les preferències):{" "}
              {Object.entries(options.sheetsByMaterial)
                .map(([m, s]) => `${m} ${s.w} × ${s.h}`)
                .join(" · ")}
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      {nesting && (
        <>
          <SimpleGrid columns={3} gap={3}>
            <StatBox label="Taulers" value={String(nesting.boards.length)} />
            <StatBox label="Peces" value={`${panels.length - nesting.unplaced.length} / ${panels.length}`} />
            <StatBox label="Aprofitament" value={`${Math.round(nesting.totalEfficiency * 100)} %`} />
          </SimpleGrid>

          {nesting.unplaced.length > 0 && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Hi ha peces que no caben al tauler</Alert.Title>
                <Alert.Description>
                  {nesting.unplaced.map((id) => byId.get(id)?.label ?? id).join(", ")}. Canvia el tauler o
                  redueix el marge.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}

          <Stack gap={5}>
            {nesting.boards.map((b) => (
              <Card.Root key={b.tab} variant="outline">
                <Card.Header>
                  <HStack justify="space-between" wrap="wrap" gap={2}>
                    <Card.Title>
                      Tauler {b.tab} · {b.material}
                    </Card.Title>
                    <HStack gap={2}>
                      <Badge variant="surface">
                        {b.w} × {b.h} × {b.thickness}
                      </Badge>
                      <Badge colorPalette="wood" variant="subtle">
                        {b.placements.length} peces
                      </Badge>
                      <Badge colorPalette={b.efficiency > 0.6 ? "green" : "orange"} variant="subtle">
                        {Math.round(b.efficiency * 100)} %
                      </Badge>
                    </HStack>
                  </HStack>
                </Card.Header>
                <Card.Body>
                  <BoardDrawing board={b} panels={byId} margin={options.margin} />
                </Card.Body>
              </Card.Root>
            ))}
          </Stack>
          <Text fontSize="xs" color="fg.muted">
            Nesting per franges, sense optimitzar. La ratlla fina marca la direcció de la veta. La línia
            discontínua és el marge del tauler que no s'aprofita.
          </Text>
        </>
      )}
    </VStack>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Stat.Root borderWidth="1px" rounded="lg" p={3}>
      <Stat.Label>{label}</Stat.Label>
      <Stat.ValueText fontSize={{ base: "lg", md: "2xl" }}>{value}</Stat.ValueText>
    </Stat.Root>
  )
}
