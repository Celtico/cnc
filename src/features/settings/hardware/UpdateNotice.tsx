import { Alert, Box, Button, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { applyImportUpdate, dismissImportUpdate } from "../../../core/import/merge"
import { evalExpr, type HardwareItem, type HardwareTarget, type MachiningOp } from "../../../core/model"
import { fmt } from "./format"

/** Un mecanitzat en text amb els números de l'item (per comparar la proposta d'ara amb la nova). */
function opLine(op: MachiningOp, vars: Record<string, number>): string {
  const v = (e: number | string) => {
    try {
      return fmt(Math.round(evalExpr(e, vars) * 100) / 100)
    } catch {
      return fmt(e)
    }
  }
  if (op.kind === "edgeDrill") return `Ø${v(op.d)} × ${v(op.depth)} al cantell`
  if (op.kind === "through") return `Ø${v(op.d)} passant a ${v(op.u)} / ${v(op.v)}`
  return `Ø${v(op.d)} × ${v(op.depth)} a ${v(op.u)} / ${v(op.v)}`
}

/**
 * «Hi ha una proposta nova: revisar»: s'ha tornat a importar l'article i els fitxers donen uns altres forats, però l'item
 * està confirmat (o se n'han editat els forats) i no s'ha tocat. Compara la d'ara amb la nova; aplicar-la el deixa sense
 * confirmar (cal revisar-lo i tornar-lo a confirmar); descartar-la no canvia res.
 */
export function UpdateNotice({ item, onChange }: { item: HardwareItem; onChange: (next: HardwareItem) => void }) {
  const u = item.imported!.update!
  const varsNow = { ...item.params, cupOffset: 0, pitch: item.pitch?.else ?? 0 }
  const { pitch, ...rest } = u.params
  const varsNew = { ...item.params, ...rest, cupOffset: 0, pitch: pitch ?? item.pitch?.else ?? 0 }
  const now = item.targets.filter((t) => u.targets.some((x) => x.key === t.key))
  const col = (title: string, targets: HardwareTarget[], vars: Record<string, number>, gen?: number) => (
    <Stack gap={0.5} minW={0}>
      <Text fontSize="xs" fontWeight="semibold">
        {title}
      </Text>
      {item.engine === "barHandle" && (
        <Text fontSize="xs" fontFamily="mono">
          {vars.pitch ? `${fmt(vars.pitch)} mm entre centres` : "pom (1 forat)"}
        </Text>
      )}
      {targets.flatMap((t) => t.ops.map((op, k) => (
        <Text key={`${t.key}${k}`} fontSize="xs" fontFamily="mono" wordBreak="break-word">
          {opLine(op, vars)}
        </Text>
      )))}
      {u.machining && (
        <Text fontSize="xs" fontFamily="mono">
          {gen ?? 0} {gen === 1 ? "mecanitzat col·locat a mà" : "mecanitzats col·locats a mà"}
        </Text>
      )}
    </Stack>
  )
  return (
    <Box py={2}>
      <Alert.Root status="warning" size="sm" data-testid="hardware-update">
        <Alert.Indicator />
        <Alert.Content gap={2}>
          <Alert.Title>Hi ha una proposta nova: revisar</Alert.Title>
          <Alert.Description>
            <Stack gap={2}>
              <Text fontSize="sm">
                S'ha tornat a importar i els fitxers donen uns altres forats. {item.imported!.confirmed ? "Com que està confirmat" : "Com que n'has editat els forats"}, no s'ha tocat res: el moble continua fent els d'ara. Si aplices la nova, queda sense confirmar (cap forat als mobles) fins que la revisis i la confirmis.
              </Text>
              <SimpleGrid columns={2} gap={3}>
                {col("Ara", now, varsNow, item.machining?.length ?? 0)}
                {col("Nova", u.targets, varsNew, u.machining?.length)}
              </SimpleGrid>
              {u.notes.length > 0 && (
                <Text fontSize="xs" color="fg.muted">
                  {u.notes.join(" ")}
                </Text>
              )}
              <HStack gap={2} wrap="wrap">
                <Button size="xs" colorPalette="wood" onClick={() => onChange(applyImportUpdate(item))} data-testid="hardware-update-apply">
                  Aplicar la nova (sense confirmar)
                </Button>
                <Button size="xs" variant="outline" onClick={() => onChange(dismissImportUpdate(item))}>
                  Descartar-la
                </Button>
              </HStack>
            </Stack>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Box>
  )
}
