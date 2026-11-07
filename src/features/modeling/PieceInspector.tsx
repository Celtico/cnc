import { Box, Button, Checkbox, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import type { Panel } from "../../core/model"
import { machiningRows } from "./ModelingTree"
import { TaulellIcon } from "./TaulellIcon"

const mm = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
/** Els cantells de la peça: els dos llargs (de baix i de dalt) i els dos amples (esquerra i dreta). */
const EDGES: [keyof Panel["edges"], string][] = [
  ["bottom", "Llarg 1"],
  ["top", "Llarg 2"],
  ["left", "Ample 1"],
  ["right", "Ample 2"],
]

/**
 * Les propietats d'una peça d'un moble a Modelatge (com al Taulell, cel 2026-11-07): de quin moble és, que les mides i la
 * posició les porta el moble («Edita el moble» hi torna), i el nom, el material, les mides, els cantells i els mecanitzats.
 * De moment es miren; els retocs a mà de la peça (cantells, mecanitzats) vénen al pas següent.
 */
export function PieceInspector({ panel, code, moduleName, onEditModule }: { panel: Panel; code: string; moduleName: string; onEditModule: () => void }) {
  const rows = machiningRows(panel)
  return (
    <Stack gap={4} fontSize="sm">
      <Box>
        <Text fontSize="xs" color="fg.muted">
          Peça de {moduleName}
        </Text>
        <HStack gap={2} mt={0.5}>
          <Text fontFamily="mono" fontSize="xs" color="fg.muted">
            {code}
          </Text>
          <Text fontWeight="semibold" fontSize="md">
            {panel.label}
          </Text>
        </HStack>
      </Box>
      <Box bg="bg.muted" rounded="md" p={3}>
        <Text color="fg.muted">
          Peça de <b>{moduleName}</b>. Les mides i la posició les porta el moble; els mecanitzats, cantells i material que hi afegeixis es conservaran.
        </Text>
        <Button mt={2} size="xs" variant="outline" colorPalette="wood" onClick={onEditModule}>
          Edita el moble
        </Button>
      </Box>
      <Stack gap={1.5}>
        <Field label="Nom" value={panel.label} />
        <Field label="Material" value={panel.material} />
        <Field label="Mides" value={`${mm(panel.length)} × ${mm(panel.width)} × ${mm(panel.thickness)} mm`} />
      </Stack>
      <Box>
        <Heading>Cantells</Heading>
        <Stack gap={1}>
          {EDGES.map(([k, l]) => (
            <Checkbox.Root key={k} size="sm" checked={panel.edges[k]} readOnly colorPalette="wood">
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>{l}</Checkbox.Label>
            </Checkbox.Root>
          ))}
        </Stack>
      </Box>
      <Box>
        <Heading>Mecanitzats ({rows.length})</Heading>
        {rows.length ? (
          <Stack gap={1}>
            {rows.map((r) => (
              <HStack key={r.key} gap={2}>
                <TaulellIcon name={r.icon} size="14px" />
                <Text>{r.label}</Text>
              </HStack>
            ))}
          </Stack>
        ) : (
          <Text color="fg.muted">Cap.</Text>
        )}
      </Box>
    </Stack>
  )
}

const Heading = ({ children }: { children: ReactNode }) => (
  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb={1.5}>
    {children}
  </Text>
)

function Field({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between" gap={3}>
      <Text color="fg.muted">{label}</Text>
      <Text textAlign="end" truncate>
        {value}
      </Text>
    </HStack>
  )
}
