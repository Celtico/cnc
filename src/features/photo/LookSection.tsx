import { Button, HStack, Slider, Switch } from "@chakra-ui/react"
import { LuImageDown, LuPaintbrush } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import type { PhotoCalibration } from "../../db/db"
import type { SetCal } from "./calibration"

/** Secció «Aspecte»: com es dibuixa el moble, què es mostra i la imatge PNG. */
export function LookSection({
  setCal,
  renderMode,
  renderShadows,
  opacity,
  layer,
  marksInRender,
  setMarksInRender,
  canDownload,
  onDownload,
}: {
  setCal: SetCal
  renderMode: NonNullable<PhotoCalibration["render"]>
  renderShadows: boolean
  opacity: number
  layer: NonNullable<PhotoCalibration["layer"]>
  marksInRender: boolean
  setMarksInRender: (v: boolean) => void
  canDownload: boolean
  onDownload: () => void
}) {
  return (
    <FoldItem id="photo-look" title="Aspecte" icon={LuPaintbrush} badge={renderMode === "realistic" ? "Realista" : "Línies"}>
      <FormRow
        label="Aspecte del moble"
        help={
          renderMode === "lines"
            ? "Ràpid i transparent: per encaixar el moble amb la foto."
            : "Materials, llum i ombres. La llum és la de Preferències › Visor 3D."
        }
      >
        <ChoiceChips
          label="Aspecte del moble"
          value={renderMode}
          options={[
            { id: "lines", label: "Línies" },
            { id: "realistic", label: "Realista" },
          ]}
          onChange={(render) => setCal((c) => ({ ...c, render }))}
        />
      </FormRow>
      {renderMode === "realistic" && (
        <FormRow label="Ombres">
          <Switch.Root size="sm" pt="6px" checked={renderShadows} onCheckedChange={(e) => setCal((c) => ({ ...c, shadows: e.checked }))}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Ombres a terra i a la paret</Switch.Label>
          </Switch.Root>
        </FormRow>
      )}
      {renderMode === "realistic" && (
        <FormRow label="Marques">
          <Switch.Root size="sm" pt="6px" checked={marksInRender} onCheckedChange={(e) => setMarksInRender(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Mostrar les marques</Switch.Label>
          </Switch.Root>
        </FormRow>
      )}

      {/* Fila: el lliscador i el valor a la dreta de l'etiqueta. */}
      <FormRow label="Opacitat del moble">
        <Slider.Root size="sm" aria-label={["Opacitat del moble"]} value={[Math.round(opacity * 100)]} min={10} max={100} step={5} onValueChange={(e) => setCal((c) => ({ ...c, opacity: (e.value[0] ?? 70) / 100 }))}>
          <HStack gap={3} minH="32px">
            <Slider.Control flex={1}>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
            <Slider.ValueText fontSize="sm" color="fg.muted" minW="3em" textAlign="right" />
          </HStack>
        </Slider.Root>
      </FormRow>
      <FormRow label="Mostrar">
        <ChoiceChips
          label="Mostrar"
          value={layer}
          options={[
            { id: "photo", label: "Foto" },
            { id: "cabinet", label: "Moble" },
            { id: "both", label: "Tots dos" },
          ]}
          onChange={(layer) => setCal((c) => ({ ...c, layer }))}
        />
      </FormRow>
      <Button size="xs" variant="outline" alignSelf="flex-start" disabled={!canDownload} onClick={onDownload}>
        <LuImageDown /> Imatge PNG
      </Button>
    </FoldItem>
  )
}
