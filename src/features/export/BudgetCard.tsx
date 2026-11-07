import { Box, Button, HStack, Input, Switch, Table, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuCalculator, LuFileDown, LuFileText } from "react-icons/lu"
import { fittingGroups } from "../../core/build/fittingOrders"
import { kitGroups } from "../../core/build/kitOrders"
import { lightGroups } from "../../core/build/lightOrders"
import { linearGroups } from "../../core/build/linearOrders"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { budgetCsv, budgetPdf, eur, toBudget, withPrice, type BudgetKey } from "../../core/export/budget"
import type { Panel, Settings } from "../../core/model"
import type { PricesPref } from "../../core/model/settingsSchema"
import type { Nesting } from "../../core/nesting/nest"
import { fmtNum } from "../../lib/format"
import { ExportCard } from "./ExportCard"

/** Un preu que es desa en sortir del camp (no a cada tecla: les preferències van a la base de dades). */
function PriceInput({ value, onCommit, width = "84px", ariaLabel }: { value: number; onCommit: (v: number) => void; width?: string; ariaLabel: string }) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value ? String(value).replace(".", ",") : "")
  const commit = () => {
    if (text === null) return
    const v = Number(text.replace(",", "."))
    setText(null)
    if (Number.isFinite(v) && v !== value) onCommit(Math.max(0, v))
  }
  return (
    <Input
      size="xs"
      width={width}
      textAlign="right"
      inputMode="decimal"
      placeholder="0,00"
      aria-label={ariaLabel}
      value={shown}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}

/**
 * Pressupost del projecte a Exportar: quantitats del projecte i preus de Preferències (els mateixos per a tots els
 * projectes, es desen en sortir del camp), amb merma, marge i IVA. Descàrrega en PDF o CSV.
 */
export function BudgetCard({
  project,
  base,
  panels,
  build,
  nesting,
  settings,
  save,
  download,
}: {
  project: string
  base: string
  panels: Panel[]
  build: CompositionBuild | undefined
  nesting: Nesting | undefined
  settings: Settings
  save: (next: Settings) => Promise<void>
  download: (blob: Blob, name: string) => void
}) {
  const prices = settings.prices
  const hardware = useMemo(
    () =>
      build
        ? [...kitGroups(build.hardwareKits), ...lightGroups(build.lightKits), ...fittingGroups(build.fittingOrders), ...linearGroups(build.linearOrders)].flatMap((g) => g.lines)
        : [],
    [build],
  )
  const budget = useMemo(() => toBudget(panels, prices, { nesting, hardware }), [panels, prices, nesting, hardware])
  const setPrices = (next: PricesPref) => void save({ ...settings, prices: next })
  const setPrice = (key: BudgetKey, v: number) => setPrices(withPrice(prices, key, v))
  const missing = budget.rows.filter((r) => !r.price).length

  return (
    <ExportCard
      icon={<LuCalculator />}
      title="Pressupost"
      description="Les quantitats del projecte (m² de tauler per material i gruix, metres de cantell, de perfilat i de ranura, forats, buidats i els ferratges de la comanda) pels teus preus. Els preus es desen per a tots els projectes."
      files={`${base}-pressupost.pdf · ${base}-pressupost.csv`}
      action={
        <HStack gap={2} wrap="wrap">
          <Button variant="outline" disabled={!panels.length} onClick={() => download(new Blob([budgetPdf(budget, prices, { project }) as BlobPart], { type: "application/pdf" }), `${base}-pressupost.pdf`)}>
            <LuFileText /> PDF
          </Button>
          <Button size="sm" variant="ghost" disabled={!panels.length} onClick={() => download(new Blob([budgetCsv(budget, prices)], { type: "text/csv;charset=utf-8" }), `${base}-pressupost.csv`)}>
            <LuFileDown /> CSV
          </Button>
        </HStack>
      }
    >
      <HStack gap={4} wrap="wrap" fontSize="sm">
        {(
          [
            ["waste", "Merma %"],
            ["margin", "Marge %"],
            ["vat", "IVA %"],
          ] as const
        ).map(([k, label]) => (
          <HStack key={k} gap={2}>
            <Text color="fg.muted">{label}</Text>
            <PriceInput width="60px" ariaLabel={label} value={prices[k]} onCommit={(v) => setPrices({ ...prices, [k]: v })} />
          </HStack>
        ))}
        <Switch.Root size="sm" checked={prices.wholeSheets} onCheckedChange={(e) => setPrices({ ...prices, wholeSheets: e.checked })} disabled={!nesting}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Cobrar taulers sencers (nesting)</Switch.Label>
        </Switch.Root>
      </HStack>
      <Box overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Concepte</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Quantitat</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Preu (€)</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Import</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {budget.rows.map((r) => (
              <Table.Row key={JSON.stringify(r.key)}>
                <Table.Cell whiteSpace="normal">{r.concept}</Table.Cell>
                <Table.Cell textAlign="end" whiteSpace="nowrap">
                  {fmtNum(r.qty)} {r.unit}
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <HStack justify="end" gap={1}>
                    <PriceInput ariaLabel={`Preu: ${r.concept}`} value={r.price} onCommit={(v) => setPrice(r.key, v)} />
                    <Text fontSize="xs" color="fg.subtle" minW="24px">
                      /{r.unit}
                    </Text>
                  </HStack>
                </Table.Cell>
                <Table.Cell textAlign="end" whiteSpace="nowrap">
                  {eur(r.amount)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
      <HStack justify="space-between" align="start" wrap="wrap" gap={3}>
        <Text fontSize="xs" color="fg.muted" flex={1} minW="200px">
          {missing ? `${missing} ${missing === 1 ? "fila sense preu" : "files sense preu"}: escriu-lo i es desa per a tots els projectes.` : "Tots els conceptes tenen preu."}
        </Text>
        <Box fontSize="sm" minW="220px">
          {[
            ["Subtotal", budget.subtotal],
            ...(prices.margin ? [[`Marge (${fmtNum(prices.margin)}%)`, budget.margin] as const] : []),
            ["Base imposable", budget.base],
            [`IVA (${fmtNum(prices.vat)}%)`, budget.vat],
          ].map(([label, v]) => (
            <HStack key={label as string} justify="space-between">
              <Text color="fg.muted">{label}</Text>
              <Text>{eur(v as number)}</Text>
            </HStack>
          ))}
          <HStack justify="space-between" fontWeight="semibold" borderTopWidth="1px" mt={1} pt={1}>
            <Text>Total</Text>
            <Text>{eur(budget.total)}</Text>
          </HStack>
        </Box>
      </HStack>
    </ExportCard>
  )
}
