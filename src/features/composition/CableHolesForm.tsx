import { Button, Field, HStack, IconButton, NativeSelect, SegmentGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { LuPlus, LuScan, LuTrash2 } from "react-icons/lu"
import { refOnPanel, type CableHole, type Module, type RefObject } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"

const PANELS: { value: CableHole["panel"]; label: string; axes: string }[] = [
  { value: "back", label: "Fons", axes: "X des de l'esquerra, Y des de baix" },
  { value: "top", label: "Tapa", axes: "X des de l'esquerra, Y des del darrere" },
  { value: "bottom", label: "Base", axes: "X des de l'esquerra, Y des del darrere" },
  { value: "left", label: "Lateral esquerre", axes: "X des del darrere, Y des de baix" },
  { value: "right", label: "Lateral dret", axes: "X des del darrere, Y des de baix" },
]

/**
 * Passacables del mòdul: forats passants rodons o rectangulars a les peces de la carcassa.
 * Cadascun es pot posar a mà (X, Y) o fer que segueixi un objecte de referència: el centre
 * queda davant de l'objecte i, si l'objecte es mou (també arrossegant-lo al 3D), el forat el segueix.
 */
export function CableHolesForm({ module, onChange, refs, at }: { module: Module; onChange: (m: Module) => void; refs: RefObject[]; at: { x: number; y: number } }) {
  const holes = module.extras.cableHoles
  const c = module.carcass
  const set = (next: CableHole[]) => onChange({ ...module, extras: { ...module.extras, cableHoles: next } })
  return (
    <Stack gap={2}>
      <HStack justify="space-between">
        <Text fontSize="xs" color="fg.muted">
          Forats passants per a cables, endolls, tubs…
        </Text>
        <Button size="xs" variant="ghost" onClick={() => set([...holes, { panel: "back", x: Math.round(c.width / 2), y: Math.round(c.height * 0.6), diameter: 60 }])}>
          <LuPlus /> Afegir
        </Button>
      </HStack>
      {holes.map((h, i) => {
        const update = (patch: Partial<CableHole>) => set(holes.map((x, k) => (k === i ? { ...x, ...patch } : x)))
        const ref = h.ref ? refs.find((r) => r.id === h.ref) : undefined
        const onRef = ref ? refOnPanel(ref, h.panel, at) : null
        const pos = onRef ? { x: Math.round(onRef.x * 10) / 10, y: Math.round(onRef.y * 10) / 10 } : { x: h.x, y: h.y }
        const rect = h.shape === "rect"
        const panel = PANELS.find((p) => p.value === h.panel)!
        return (
          <Stack key={i} gap={2} borderTopWidth="1px" pt={2}>
            <HStack align="end" gap={2}>
              <Field.Root flex={1} minW={0}>
                <Field.Label>Passacables {i + 1} a</Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field value={h.panel} onChange={(e) => update({ panel: e.target.value as CableHole["panel"] })}>
                    {PANELS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <IconButton aria-label="Eliminar passacables" size="sm" variant="ghost" colorPalette="red" onClick={() => set(holes.filter((_, k) => k !== i))}>
                <LuTrash2 />
              </IconButton>
            </HStack>
            <Field.Root>
              <Field.Label>Posició</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={h.ref ?? ""}
                  onChange={(e) => {
                    const id = e.target.value
                    // En deixar de seguir l'objecte, el forat es queda on era.
                    update(id ? { ref: id } : { ref: undefined, x: pos.x, y: pos.y })
                  }}
                >
                  <option value="">A mà (X, Y)</option>
                  {refs.map((r) => (
                    <option key={r.id} value={r.id}>
                      Segueix «{r.name}»
                    </option>
                  ))}
                  {h.ref && !ref && <option value={h.ref}>(objecte eliminat)</option>}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <SegmentGroup.Root size="sm" w="full" value={rect ? "rect" : "circle"} onValueChange={(e) => update({ shape: e.value === "rect" ? "rect" : undefined, ...(e.value === "rect" && !h.w ? { w: h.diameter, h: h.diameter } : {}) })}>
              <SegmentGroup.Indicator />
              <SegmentGroup.Item value="circle" flex={1}>
                <SegmentGroup.ItemText>Rodó</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
              <SegmentGroup.Item value="rect" flex={1}>
                <SegmentGroup.ItemText>Rectangular</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            </SegmentGroup.Root>
            <SimpleGrid columns={rect ? 2 : 3} gap={2}>
              <NumberField label="X" value={pos.x} min={-3000} max={3000} step={10} disabled={!!ref} onChange={(x) => update({ x })} />
              <NumberField label="Y" value={pos.y} min={-3000} max={3000} step={10} disabled={!!ref} onChange={(y) => update({ y })} />
              {rect ? (
                <>
                  <NumberField label="Ample" value={h.w ?? h.diameter} min={5} max={2000} step={5} onChange={(w) => update({ w })} />
                  <NumberField label="Alt" value={h.h ?? h.diameter} min={5} max={2000} step={5} onChange={(v) => update({ h: v })} />
                </>
              ) : (
                <NumberField label="Ø" value={h.diameter} min={5} max={500} step={5} onChange={(diameter) => update({ diameter })} />
              )}
            </SimpleGrid>
            {onRef && (
              <Button
                size="xs"
                variant="outline"
                alignSelf="flex-start"
                onClick={() => update(rect ? { w: Math.round(onRef.w), h: Math.round(onRef.h) } : { diameter: Math.round(Math.min(onRef.w, onRef.h)) })}
              >
                <LuScan /> Mida de l'objecte ({Math.round(onRef.w)} × {Math.round(onRef.h)})
              </Button>
            )}
            <Text fontSize="xs" color="fg.muted">
              {ref ? `Centrat davant de «${ref.name}»: si el mous, el forat el segueix. ` : ""}
              {panel.axes}.
            </Text>
          </Stack>
        )
      })}
    </Stack>
  )
}
