import { HStack, Slider, Stack, Switch } from "@chakra-ui/react"
import { LuBlend, LuDoorOpen } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"

export interface ViewerState {
  opening: number
  /** Opacitat de les peces (0,1–1): per sota d'1, la fusta es veu a través i es veuen tots els mecanitzats. */
  opacity: number
  openOnlySelected: boolean
  materialMode: "material" | "role"
  /** Filferro (el del Taulell): només els cantells de les peces. */
  wire?: boolean
  /** Interior (el del Taulell): sense portes ni frontals, per veure el que hi ha dins. */
  hideFronts?: boolean
  /** Secció (la del Taulell): un pla d'escaire talla el moble i es veu una meitat (eix, posició en mm, quina meitat). */
  section?: { axis: 0 | 1 | 2; pos: number; flip: boolean } | null
  /** Peces dels mobles amagades amb l'ull de l'arbre de Modelatge (ids de la composició): només no es dibuixen. */
  hiddenPieces?: string[]
}

/** Part de baix d'Opcions de vista: obertura, opacitat, selecció i imatge (les vistes, a la barra de baix del 3D). */
export function ViewerControls({
  state,
  onChange,
  hasMoving,
  hasSelectedZone,
}: {
  state: ViewerState
  onChange: (patch: Partial<ViewerState>) => void
  hasMoving: boolean
  hasSelectedZone: boolean
}) {
  return (
    <Stack gap={4}>
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
      <FormRow
        label={
          <HStack gap={1.5}>
            <LuBlend /> Opacitat
          </HStack>
        }
        help={state.opacity < 1 ? "Les peces es veuen a través, amb tots els forats, ranures i talls (com a l'explosió)." : "Abaixa-la per veure a través de les peces tots els mecanitzats."}
      >
        <Slider.Root
          size="sm"
          pt="6px"
          aria-label={["Opacitat"]}
          value={[Math.round(state.opacity * 100)]}
          min={10}
          max={100}
          step={5}
          onValueChange={(e) => onChange({ opacity: (e.value[0] ?? 100) / 100 })}
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
    </Stack>
  )
}
