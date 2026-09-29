import { Button, Field, HStack, Menu, NativeSelect, Portal, SegmentGroup, Slider, Stack, Switch, Text } from "@chakra-ui/react"
import { LuChevronDown, LuDoorOpen, LuImageDown } from "react-icons/lu"
import { VIEW_LABELS, type ViewName } from "../../components/viewer/CabinetViewer"

const VIEWS: ViewName[] = ["front", "back", "left", "right", "top", "3d"]

/** Barra de vistes sobre el visor: botons a l'escriptori, menú desplegable al mòbil. */
export function ViewBar({ view, onChange }: { view: ViewName; onChange: (v: ViewName) => void }) {
  return (
    <>
      <SegmentGroup.Root size="sm" bg="bg.panel" value={view} onValueChange={(e) => e.value && onChange(e.value as ViewName)} display={{ base: "none", md: "flex" }}>
        <SegmentGroup.Indicator />
        {VIEWS.map((v) => (
          <SegmentGroup.Item key={v} value={v} aria-label={`Vista ${VIEW_LABELS[v]}`}>
            <SegmentGroup.ItemText>{VIEW_LABELS[v]}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="surface" colorPalette="wood" display={{ base: "inline-flex", md: "none" }} aria-label="Triar la vista">
            {VIEW_LABELS[view]} <LuChevronDown />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {VIEWS.map((v) => (
                <Menu.Item key={v} value={v} onClick={() => onChange(v)}>
                  {VIEW_LABELS[v]}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </>
  )
}

export interface ViewerState {
  view: ViewName
  opening: number
  openOnlySelected: boolean
  materialMode: "material" | "role"
}

/** Secció «Visor 3D» del panell esquerre: vista, obertura, materials i imatge. */
export function ViewerControls({
  state,
  onChange,
  hasMoving,
  hasSelectedZone,
  onImage,
}: {
  state: ViewerState
  onChange: (patch: Partial<ViewerState>) => void
  hasMoving: boolean
  hasSelectedZone: boolean
  onImage: () => void
}) {
  return (
    <Stack gap={4}>
      <Field.Root>
        <Field.Label>Vista</Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field value={state.view} onChange={(e) => onChange({ view: e.target.value as ViewName })}>
            {VIEWS.map((v) => (
              <option key={v} value={v}>
                {VIEW_LABELS[v]}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Field.HelperText>Les vistes de davant, costats i dalt són ortogràfiques i porten les cotes generals.</Field.HelperText>
      </Field.Root>

      <Slider.Root
        size="sm"
        value={[Math.round(state.opening * 100)]}
        min={0}
        max={100}
        step={5}
        disabled={!hasMoving}
        onValueChange={(e) => onChange({ opening: (e.value[0] ?? 0) / 100 })}
      >
        <HStack justify="space-between">
          <Slider.Label>
            <HStack gap={1.5}>
              <LuDoorOpen /> Obertura
            </HStack>
          </Slider.Label>
          <Slider.ValueText />
        </HStack>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      {!hasMoving && (
        <Text fontSize="xs" color="fg.muted" mt={-3}>
          Aquesta composició no té portes, abatibles ni calaixos.
        </Text>
      )}
      <Switch.Root size="sm" checked={state.openOnlySelected} disabled={!hasSelectedZone} onCheckedChange={(e) => onChange({ openOnlySelected: e.checked })}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>Obrir només el compartiment seleccionat</Switch.Label>
      </Switch.Root>


      <Button size="sm" variant="outline" colorPalette="wood" alignSelf="flex-start" onClick={onImage}>
        <LuImageDown /> Descarregar imatge
      </Button>
    </Stack>
  )
}
