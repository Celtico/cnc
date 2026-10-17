import { Badge, Box, Button, HStack, Input, Menu, Stack, Table, Text } from "@chakra-ui/react"
import { LuCircleCheck, LuEye, LuMoveHorizontal, LuRectangleHorizontal, LuTrash2, LuWand } from "react-icons/lu"
import type { ApplyTarget } from "./applyTargets"
import type { Measure, MeasureValue } from "../../core/photo/measure"
import { IconAction } from "../../components/IconAction"
import { ActionsMenu } from "../../components/ActionsMenu"

const fmt = (v: number | null | undefined): string => (v === null || v === undefined ? "" : Math.round(v).toLocaleString("ca-ES"))
const fmtRel = (v: number): string => v.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Llista de mesures: nom, relativa, total (amb estat) i mida amb cinta. */
export function MeasureTable({
  measures,
  values,
  targets,
  applied,
  onChange,
  onRemove,
  onApply,
}: {
  measures: Measure[]
  values: MeasureValue[]
  targets: ApplyTarget[]
  /** Etiquetes dels objectius als quals ja s'ha aplicat cada mesura. */
  applied: Map<string, string[]>
  onChange: (id: string, patch: Partial<Measure>) => void
  onRemove: (id: string) => void
  onApply: (measure: Measure, target: ApplyTarget, value: number, which: "main" | "second") => void
}) {
  if (!measures.length) {
    return (
      <Text fontSize="sm" color="fg.muted">
        Encara no hi ha cap mesura. Fes servir Distància (2 punts) o Rectangle (4 punts).
      </Text>
    )
  }
  const byId = new Map(values.map((v) => [v.id, v]))
  return (
    <Stack gap={2}>
      {/* Dins del panell de propietats (340 px) la taula no hi cap sencera: es desplaça ella, no el panell. */}
      <Table.ScrollArea>
      <Table.Root size="sm" variant="line" interactive={false}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Mesura</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Relativa</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Total (mm)</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Cinta</Table.ColumnHeader>
            <Table.ColumnHeader />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {measures.map((m) => {
            const v = byId.get(m.id)
            const tags = applied.get(m.id) ?? []
            return (
              <Table.Row key={m.id}>
                <Table.Cell px={1} minW="120px">
                  <HStack gap={1}>
                    <Box color="fg.muted" flexShrink={0}>
                      {m.kind === "distance" ? <LuMoveHorizontal /> : <LuRectangleHorizontal />}
                    </Box>
                    <Input size="xs" variant="flushed" value={m.name} aria-label="Nom de la mesura" onChange={(e) => onChange(m.id, { name: e.target.value })} />
                  </HStack>
                  {tags.length > 0 && (
                    <Text fontSize="xs" color="fg.muted">
                      → {tags.join(", ")}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell px={1} textAlign="end" fontFamily="mono">
                  {v ? fmtRel(v.relative) : "–"}
                  {v?.relative2 !== undefined && (
                    <Text as="span" color="fg.muted">
                      {" × "}
                      {fmtRel(v.relative2)}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell px={1} textAlign="end" fontFamily="mono" whiteSpace="nowrap">
                  {v && v.total !== null ? (
                    <HStack gap={1} justify="flex-end">
                      <Text>
                        {fmt(v.total)}
                        {v.total2 !== undefined && v.total2 !== null && (
                          <Text as="span" color="fg.muted" title={v.state2 === "real" ? undefined : `Alçada estimada ±${Math.round((v.error2 ?? v.error) * 100)} %`}>
                            {` × ${fmt(v.total2)}${v.state === "real" && v.state2 !== "real" ? " ~" : ""}`}
                          </Text>
                        )}
                      </Text>
                      {v.state === "real" ? (
                        <Box color="green.fg" title="Real (cinta)">
                          <LuCircleCheck />
                        </Box>
                      ) : (
                        <Badge size="xs" variant="subtle" colorPalette="orange" title="Estimada">
                          <LuEye /> ±{Math.round(v.error * 100)} %
                        </Badge>
                      )}
                    </HStack>
                  ) : null}
                </Table.Cell>
                <Table.Cell px={1} textAlign="end">
                  <Input
                    size="xs"
                    type="number"
                    inputMode="decimal"
                    w="72px"
                    textAlign="end"
                    aria-label="Mida amb cinta (mm)"
                    placeholder="mm"
                    value={m.tape ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      onChange(m.id, { tape: e.target.value === "" || !Number.isFinite(n) || n <= 0 ? null : n })
                    }}
                  />
                </Table.Cell>
                <Table.Cell px={0}>
                  <HStack gap={0}>
                    <ActionsMenu label="Aplicar al moble" tip="Aplicar al moble" icon={<LuWand />} disabled={!v || v.total === null || !targets.length} contentProps={{ maxH: "50vh", overflowY: "auto" }}>
                      {v?.total2 !== undefined && v.total2 !== null && (
                        <Text fontSize="xs" color="fg.muted" px={3} py={1}>
                          Amplada {fmt(v.total)}
                        </Text>
                      )}
                      {targets.map((t) => (
                        <Menu.Item key={t.id} value={t.id} onClick={() => v?.total !== null && v && onApply(m, t, v.total, "main")}>
                          {t.label}
                        </Menu.Item>
                      ))}
                      {v?.total2 !== undefined && v.total2 !== null && (
                        <>
                          <Menu.Separator />
                          <Text fontSize="xs" color="fg.muted" px={3} py={1}>
                            Alçada {fmt(v.total2)}
                          </Text>
                          {targets.map((t) => (
                            <Menu.Item key={`2${t.id}`} value={`2${t.id}`} onClick={() => onApply(m, t, v.total2!, "second")}>
                              {t.label}
                            </Menu.Item>
                          ))}
                        </>
                      )}
                    </ActionsMenu>
                    <IconAction label="Eliminar mesura" size="xs" variant="ghost" colorPalette="red" onClick={() => onRemove(m.id)}>
                      <LuTrash2 />
                    </IconAction>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table.Root>
      </Table.ScrollArea>
      <HStack gap={3} fontSize="xs" color="fg.muted" wrap="wrap">
        <HStack gap={1}>
          <LuEye /> estimada
        </HStack>
        <HStack gap={1}>
          <LuCircleCheck /> real (cinta)
        </HStack>
        <Text>Relativa = proporció respecte a l'amplada de la referència (1,00).</Text>
      </HStack>
      {values.some((v) => v.state === "relative") && (
        <Button size="xs" variant="ghost" disabled>
          Sense mides conegudes: escriu una mida amb cinta per tenir totals.
        </Button>
      )}
    </Stack>
  )
}
