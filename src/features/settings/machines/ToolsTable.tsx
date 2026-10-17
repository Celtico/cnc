import { Badge, Box, Button, Grid, HStack, Input, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuFactory, LuPlus, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../../components/FormRow"
import { FoldGroup, FoldItem } from "../../../components/Fold"
import { NumRow } from "../../../components/NumRow"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { SectionLabel } from "../../../components/SectionLabel"
import { isPlaceholderTool, TOOL_EDITABLE, TOOL_KIND_LABELS, type MachineTool, type ToolEditable, type ToolKind } from "../../../core/model"

/** Grups de la taula d'eines, en l'ordre del taller. */
const TOOL_GROUPS: { id: string; label: string; match: (t: MachineTool) => boolean }[] = [
  { id: "drill-v", label: "Broques verticals", match: (t) => t.kind === "drill" && t.orientation !== "horizontal" },
  { id: "drill-h", label: "Broques horitzontals", match: (t) => t.kind === "drill" && t.orientation === "horizontal" },
  { id: "router", label: TOOL_KIND_LABELS.router, match: (t) => t.kind === "router" },
  { id: "blade", label: TOOL_KIND_LABELS.blade, match: (t) => t.kind === "blade" },
  { id: "other", label: "Agregats, palpadors i altres", match: (t) => t.kind === "aggregate" || t.kind === "probe" || t.kind === "other" },
]

/**
 * Columnes de la taula d'eines: codi · nom · Ø · fondària · posició. Al mòbil, columnes estretes i sense «Posició» (va
 * sota el nom): a 390 px el nom ha de tenir lloc.
 */
const COLS = { base: "40px minmax(0, 1fr) 36px 44px", md: "52px minmax(0, 1fr) 56px 64px minmax(0, 96px)" }
const COL_GAP = { base: 2, md: 3 }
const MD_ONLY = { base: "none", md: "block" }
const BASE_ONLY = { base: "block", md: "none" }

const where = (t: MachineTool) =>
  !t.mounted ? "no muntada" : t.spindles?.length ? `mandrí ${t.spindles.join(", ")}` : t.heads?.length ? `capçal ${t.heads.join(", ")}` : "—"

/** Taula d'eines agrupada per tipus; tocar-ne una l'obre per editar-la. */
export function ToolsTable({ tools, onChange }: { tools: MachineTool[]; onChange: (t: MachineTool[]) => void }) {
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
              <Grid templateColumns={COLS} columnGap={COL_GAP} py={1} bg="bg.subtle" color="fg.muted" fontSize="xs">
                <Text px={2}>Codi</Text>
                <Text>Nom</Text>
                <Text textAlign="right">Ø</Text>
                <Text textAlign="right" pe={{ base: 2, md: 0 }} title="Fondària útil">
                  <Box as="span" display={BASE_ONLY}>Fond.</Box>
                  <Box as="span" display={MD_ONLY}>Fondària</Box>
                </Text>
                <Text pe={2} display={MD_ONLY}>Posició</Text>
              </Grid>
              <FoldGroup variant="row" multiple={false} value={open ? [open] : []} onValueChange={(v) => setOpen(v[0] ?? null)}>
                {list.map((t) => {
                  const dim = !t.mounted || !t.auto
                  return (
                    <FoldItem
                      key={t.code}
                      id={t.code}
                      title={t.name}
                      header={
                        <Grid templateColumns={COLS} columnGap={COL_GAP} alignItems="center" py={1.5} opacity={dim ? 0.55 : 1}>
                          <Text fontFamily="mono" fontSize="xs" px={2} truncate>{t.code}</Text>
                          <Box minW={0}>
                            <Text truncate title={t.mslName ? `${t.name} · a l'MSL: ${t.mslName}` : t.name}>{t.name}{t.ball ? " · esfèrica" : ""}{t.manual ? " · a mà" : ""}{isPlaceholderTool(t) ? " · falta el codi" : ""}</Text>
                            <Text fontSize="xs" color="fg.muted" truncate display={BASE_ONLY}>{where(t)}</Text>
                          </Box>
                          <Text textAlign="right">{String(t.diameter).replace(".", ",")}</Text>
                          <Text textAlign="right" pe={{ base: 2, md: 0 }}>{t.maxDepth ? String(t.maxDepth).replace(".", ",") : "—"}</Text>
                          <Text fontSize="xs" color="fg.muted" truncate pe={2} display={MD_ONLY}>{where(t)}</Text>
                        </Grid>
                      }
                    >
                      <ToolEditor tool={t} codes={tools.map((x) => x.code)} onChange={(patch) => { set(t.code, patch); if (patch.code) setOpen(patch.code) }} onDelete={t.manual ? () => { onChange(tools.filter((x) => x.code !== t.code)); setOpen(null) } : undefined} />
                    </FoldItem>
                  )
                })}
              </FoldGroup>
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
      {t.kind === "router" && (
        <FormRow label="Punta" help="Esfèrica: la fa servir l'acabat dels buidats amb el fons arrodonit o de forma (piques, relleus 3D). Maestro no ho diu: marca-la a mà.">
          <ChoiceChips<"flat" | "ball">
            label="Punta"
            options={[
              { id: "flat", label: "Plana" },
              { id: "ball", label: "Esfèrica" },
            ]}
            value={t.ball ? "ball" : "flat"}
            onChange={(v) => onChange({ ball: v === "ball" || undefined })}
          />
        </FormRow>
      )}
      {t.kind === "blade" && <NumRow label="Gruix del disc" value={t.bladeThickness ?? 0} min={0} max={20} step={0.1} onChange={(bladeThickness) => onChange({ bladeThickness })} />}
      <FormRow label="Exportació">
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
