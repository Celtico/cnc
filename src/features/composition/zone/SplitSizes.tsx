import { Box, Button, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { setSplitSize, setSplitThickness, type Zone } from "../../../core/model"
import { NumberField, NumRow } from "../../../components/NumRow"
import { FormRow } from "../../../components/FormRow"
import { splitRows } from "../zoneLabel"
import { fmtNum } from "../../../lib/format"

/**
 * La mida de cada zona d'una divisió, al pare (per decisió de l'usuari, 2026-10-08: «a les obertures no té sentit
 * l'amplada; ha d'anar a la divisió»). Amb n zones es posen n−1 mides (per decisió de l'usuari: «si només hi ha dos,
 * només pot posar una mida»): les files «Amplada 1»… (vertical) o «Alçada 1»… (horitzontal), «Auto» o els mm (clicar el
 * nom selecciona el compartiment; el nom de l'arbre, a l'ajuda), i l'última no s'edita: diu el que sobra. Al costat de
 * les «Auto», els mm que fan (les reals, `childSizes`).
 */
export function SplitSizes({ root, zone, onChange, onSelect, childSizes }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; onSelect?: (id: string) => void; childSizes?: number[] }) {
  if (!zone.split) return null
  const what = zone.split.dir === "v" ? "Amplada" : "Alçada"
  const set = (i: number, size: number | "auto") => onChange(setSplitSize(root, zone.id, i, size, childSizes))
  return (
    <Stack gap={2}>
      <Text textStyle="xs" color="fg.muted">
        {what} de la llum de cada zona. Les «Auto» es reparteixen el que queda; l'última és el que sobra.
      </Text>
      {splitRows(zone).map((row, i) => {
        const real = childSizes?.[i]
        return (
          <FormRow
            key={row.id}
            optionId="zone.split.sizes"
            label={
              onSelect ? (
                <Button variant="plain" size="sm" h="auto" p={0} minW={0} fontWeight="normal" color="fg.muted" textAlign="start" whiteSpace="normal" _hover={{ color: "fg", textDecoration: "underline" }} title={`${row.name} · seleccionar el compartiment`} onClick={() => onSelect(row.id)}>
                  {row.label}
                </Button>
              ) : (
                <span title={row.name}>{row.label}</span>
              )
            }
          >
            {row.rest ? (
              <Text fontSize="sm" color="fg.muted">
                {real !== undefined ? `${fmtNum(real)} mm` : "—"} (el que sobra)
              </Text>
            ) : (
              <HStack gap={3}>
                <Switch.Root size="sm" flexShrink={0} checked={row.size === "auto"} onCheckedChange={(e) => set(i, e.checked ? "auto" : real !== undefined && real > 0 ? Math.round(real) : 400)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Auto</Switch.Label>
                </Switch.Root>
                {row.size !== "auto" ? (
                  <Box flex="1" minW={0} maxW="160px">
                    <NumberField label="" ariaLabel={`${row.label} (${row.name})`} value={row.size} min={1} max={3000} step={10} onChange={(v) => set(i, v)} />
                  </Box>
                ) : real !== undefined ? (
                  <Text fontSize="sm" color="fg.muted">
                    {fmtNum(real)} mm
                  </Text>
                ) : null}
              </HStack>
            )}
          </FormRow>
        )
      })}
    </Stack>
  )
}

/**
 * Divisors gruixuts (buits) d'una divisió (per petició de l'usuari, 2026-10-20: «al fer divisions ficar l'opció de
 * gruixuts (buits)»): com Prestatges › Gruix, l'interruptor i el gruix aparent. Vertical: els divisors; horitzontal: els
 * prestatges fixos.
 */
export function SplitThickness({ root, zone, onChange, bodyThickness }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; bodyThickness?: number }) {
  if (!zone.split) return null
  const thickness = zone.split.thickness
  const what = zone.split.dir === "v" ? "divisors" : "prestatges fixos"
  const min = bodyThickness ? 2 * bodyThickness + 6 : undefined
  return (
    <>
      <FormRow optionId="zone.split.thick" label="Gruix">
        <Switch.Root size="sm" pt="6px" checked={!!thickness} onCheckedChange={(e) => onChange(setSplitThickness(root, zone.id, e.checked ? 50 : undefined))}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Gruixuts (buits)</Switch.Label>
        </Switch.Root>
      </FormRow>
      {thickness && (
        <NumRow
          optionId="zone.split.thickness"
          label="Gruix aparent"
          value={thickness}
          min={20}
          max={200}
          step={5}
          onChange={(v) => Number.isFinite(v) && v >= 20 && onChange(setSplitThickness(root, zone.id, v))}
          help={`Els ${what} d'aquesta divisió: dues pells, llistons i una tira al davant, com els prestatges gruixuts.${min ? ` Almenys ${fmtNum(min)} mm (2 × tauler + 6); si no, es fan massissos.` : ""}`}
        />
      )}
    </>
  )
}
