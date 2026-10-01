import { Button, HStack, Menu, Portal, SegmentGroup, Slider, Stack, Switch } from "@chakra-ui/react"
import { LuChevronDown, LuDoorOpen, LuImageDown } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { VIEW_LABELS, type ViewName } from "../../components/viewer/viewNames"

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
      <FormRow label="Vista" help="Les vistes de davant, costats i dalt són ortogràfiques i porten les cotes generals.">
        <ChoiceChips label="Vista" options={VIEWS.map((v) => ({ id: v, label: VIEW_LABELS[v] }))} value={state.view} onChange={(view) => onChange({ view })} />
      </FormRow>

      <FormRow
        label={
          <HStack gap={1.5}>
            <LuDoorOpen /> Obertura
          </HStack>
        }
        help={!hasMoving ? "Aquesta composició no té portes, abatibles ni calaixos." : undefined}
      >
        <Slider.Root
          size="sm"
          pt="6px"
          aria-label={["Obertura"]}
          value={[Math.round(state.opening * 100)]}
          min={0}
          max={100}
          step={5}
          disabled={!hasMoving}
          onValueChange={(e) => onChange({ opening: (e.value[0] ?? 0) / 100 })}
        >
          <HStack gap={3}>
            <Slider.Control flex={1}>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
            <Slider.ValueText minW="8" textAlign="end" fontSize="sm" />
          </HStack>
        </Slider.Root>
      </FormRow>
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
