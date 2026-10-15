import { Button, Text } from "@chakra-ui/react"
import { LuCrosshair, LuRotateCcw } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumRow } from "../../components/NumRow"
import { visibleReferences } from "../../core/model"
import type { ReferencePlane } from "../../core/photo/camera"
import type { Photo, PhotoCalibration } from "../../db/db"
import { useSettings } from "../settings/SettingsContext"
import { known, type SetCal } from "./calibration"
import type { CalibrationScene } from "./useCalibrationScene"

/** Secció «Referència»: el rectangle de mida coneguda, on és i la focal. */
export function ReferenceSection({
  cal,
  setCal,
  scene,
  exifFocal35,
  customRef,
  setCustomRef,
}: {
  cal: PhotoCalibration
  setCal: SetCal
  scene: CalibrationScene
  exifFocal35: Photo["exifFocal35"]
  customRef: boolean
  setCustomRef: (v: boolean) => void
}) {
  const { settings } = useSettings()
  const { refW, refH, effective } = scene
  const presets = visibleReferences(settings)
  const presetKey = presets.findIndex((r) => r.w === cal.ref.w && r.h === cal.ref.h && (r.wallOffset ?? 0) === (cal.refWallOffset ?? 0))
  // "A mida" és una tria de l'usuari, no només "cap preset coincideix": si no ho
  // recordem, la tria torna al preset i no deixa triar-la.
  const refMode = customRef || presetKey < 0 ? "custom" : String(presetKey)

  return (
    <FoldItem id="photo-ref" title="Referència" icon={LuCrosshair}>
      <FormRow label="Rectangle de referència">
        <ChoiceChips
          label="Rectangle de referència"
          options={[
            ...presets.map((r, i) => ({
              id: String(i),
              label: (
                <>
                  {r.name}
                  <Text as="span" color="fg.subtle" ms={1}>
                    {r.w} × {r.h}
                  </Text>
                </>
              ),
            })),
            { id: "custom", label: "A mida" },
          ]}
          value={refMode}
          onChange={(v) => {
            if (v === "custom") {
              setCustomRef(true)
              return
            }
            const r = presets[Number(v)]
            if (r) {
              setCustomRef(false)
              setCal((c) => ({ ...c, ref: { w: r.w, h: r.h }, refAspect: r.w / r.h, refWallOffset: r.wallOffset ?? 0, plane: r.plane }))
            }
          }}
        />
      </FormRow>
      <Text fontSize="sm" fontWeight="medium">
        Mida coneguda
      </Text>
      <NumRow label="Amplada" value={cal.ref.w ?? NaN} allowEmpty min={10} max={5000} step={1} onChange={(w) => setCal((c) => ({ ...c, ref: { ...c.ref, w: known(w) } }))} />
      {/* L'explicació de la mida coneguda va com a ajuda de la segona fila (val per a totes dues). */}
      <NumRow
        label="Alçada"
        value={cal.ref.h ?? NaN}
        allowEmpty
        min={10}
        max={5000}
        step={1}
        onChange={(h) => setCal((c) => ({ ...c, ref: { ...c.ref, h: known(h) } }))}
        help={
          refW && refH
            ? effective && (effective.w !== refW || effective.h !== refH)
              ? `Recalibrada amb cinta: ${effective.w} × ${effective.h} mm.`
              : "Donen l'escala de la foto. Es poden deixar en blanc per treballar només amb proporcions."
            : effective
              ? `Sense mides: l'escala surt de la cinta (${effective.w} × ${effective.h} mm).`
              : "En blanc: només mesures relatives fins que hi hagi una mida amb cinta."
        }
      />
      {cal.plane === "wall" && (
        <NumRow label="Distància a la paret" value={cal.refWallOffset ?? 0} min={0} max={2000} step={10} help="De la referència a la paret. Una tele sobre un moble: uns 200." onChange={(v) => setCal((c) => ({ ...c, refWallOffset: Number.isFinite(v) ? v : 0 }))} />
      )}

      <FormRow label="El rectangle és a…">
        <ChoiceChips
          label="El rectangle és a…"
          value={cal.plane}
          options={[
            { id: "wall", label: "La paret" },
            { id: "floor", label: "El terra" },
          ]}
          onChange={(plane: ReferencePlane) => setCal((c) => ({ ...c, plane }))}
        />
      </FormRow>
      <NumRow
        label="Focal (35 mm)"
        value={cal.focal35}
        min={10}
        max={200}
        step={1}
        suffix="mm"
        help={exifFocal35 ? `Llegida de l'EXIF: ${exifFocal35} mm` : "La foto no porta EXIF; 26 mm és la càmera principal d'un mòbil"}
        onChange={(focal35) => setCal((c) => ({ ...c, focal35 }))}
      />

      <Button variant="outline" size="sm" alignSelf="flex-start" onClick={() => setCal((c) => ({ ...c, points: [] }))}>
        <LuRotateCcw /> Tornar a marcar els punts
      </Button>
    </FoldItem>
  )
}
