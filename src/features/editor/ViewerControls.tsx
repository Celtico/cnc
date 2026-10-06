import { Button, HStack, Slider, Stack, Switch } from "@chakra-ui/react"
import { LuDoorOpen, LuImageDown } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"
import { segGroup, segItem } from "../../components/segmented"
import { VIEWS, VIEW_LABELS, type ViewName } from "../../components/viewer/viewNames"

/**
 * Vistes Davant · Darrere · Esquerra · Dreta · Dalt: botons de text (sense estat triat) que col·loquen la càmera
 * d'aquell costat i enquadren, com «Enquadrar». Un sol lloc per triar-les: Opcions de vista.
 */
export function CameraViews({ onView }: { onView: (v: ViewName) => void }) {
  return (
    <HStack {...segGroup} role="group" aria-label="Vistes">
      {VIEWS.map((v) => (
        <Button key={v} {...segItem(false)} aria-label={`Vista ${VIEW_LABELS[v]}`} onClick={() => onView(v)}>
          {VIEW_LABELS[v]}
        </Button>
      ))}
    </HStack>
  )
}

export interface ViewerState {
  opening: number
  openOnlySelected: boolean
  materialMode: "material" | "role"
}

/** Part de baix d'Opcions de vista: vistes, obertura, selecció i imatge. */
export function ViewerControls({
  state,
  onChange,
  onView,
  hasMoving,
  hasSelectedZone,
  onImage,
}: {
  state: ViewerState
  onChange: (patch: Partial<ViewerState>) => void
  onView: (v: ViewName) => void
  hasMoving: boolean
  hasSelectedZone: boolean
  onImage: () => void
}) {
  return (
    <Stack gap={4}>
      <FormRow label="Vista" help="Col·loca la càmera d'aquell costat i enquadra el moble; després es pot girar com sempre. Les cotes són a l'Alçat.">
        <CameraViews onView={onView} />
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
      <FormRow label="Selecció">
        <Switch.Root size="sm" pt="6px" checked={state.openOnlySelected} disabled={!hasSelectedZone} onCheckedChange={(e) => onChange({ openOnlySelected: e.checked })}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Obrir només el compartiment seleccionat</Switch.Label>
        </Switch.Root>
      </FormRow>

      <Button size="sm" variant="outline" colorPalette="wood" alignSelf="flex-start" onClick={onImage}>
        <LuImageDown /> Descarregar imatge
      </Button>
    </Stack>
  )
}
