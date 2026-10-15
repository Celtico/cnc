import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import { LuCheck, LuLampFloor, LuSparkles, LuSun } from "react-icons/lu"
import { QUALITY_LABELS, useRenderQuality, type RenderQuality } from "../../../components/viewer/renderQuality"
import { SKIES, useSkyPref, type SkyId } from "../../../components/viewer/render/skies"
import { FLOORS, LIGHTS, SKIRTINGS, WALLS, usePresentationScene, type FloorId } from "../../../components/viewer/presentationScene"
import { floorSwatchUrl } from "../../../components/viewer/floorTextures"
import type { Composition } from "../../../core/model"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { ScenePreview } from "../ScenePreview"
import { MaterialSelect } from "../MaterialSelect"
import { useSettings } from "../SettingsContext"
import { FoldGrid } from "./FoldGrid"

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160
}

/** Una fila de mostres de color rodones (com el color principal). */
function Swatches<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string; swatch: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <HStack gap={2} wrap="wrap" role="radiogroup" aria-label={label}>
      {items.map((a) => {
        const on = a.id === value
        return (
          <Box key={a.id} asChild w="36px" h="36px" rounded="full" borderWidth="2px" borderColor={on ? "fg" : "transparent"} p="3px">
            <button type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label} onClick={() => onChange(a.id)}>
              <Box w="full" h="full" rounded="full" bg={a.swatch} borderWidth="1px" borderColor="blackAlpha.200" display="flex" alignItems="center" justifyContent="center" color={isLight(a.swatch) ? "gray.800" : "white"}>
                {on && <LuCheck />}
              </Box>
            </button>
          </Box>
        )
      })}
    </HStack>
  )
}

/** Mostres de terra: rajoles amb la textura real i el nom a sota. */
function FloorTiles({ value, onChange }: { value: FloorId; onChange: (v: FloorId) => void }) {
  return (
    <HStack gap={2} wrap="wrap" role="radiogroup" aria-label="Terra">
      {FLOORS.map((f) => {
        const on = f.id === value
        const img = floorSwatchUrl(f.id)
        return (
          <Stack key={f.id} asChild gap={1} align="center">
            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(f.id)}>
              <Box w="72px" h="52px" rounded="md" borderWidth="2px" borderColor={on ? "colorPalette.solid" : "border"} colorPalette="wood" p="2px">
                <Box w="full" h="full" rounded="sm" bg={f.swatch} bgImage={img ? `url(${img})` : undefined} bgSize="cover" />
              </Box>
              <Text textStyle="xs" color={on ? "fg" : "fg.muted"} fontWeight={on ? "medium" : "normal"}>
                {f.label}
              </Text>
            </button>
          </Stack>
        )
      })}
    </HStack>
  )
}

/** Cel de defecte del render (Preferències › Visor 3D): un per als mobles i un per als ambients. */
function SkyFields() {
  const [moble, setMoble] = useSkyPref("moble")
  const [ambient, setAmbient] = useSkyPref("ambient")
  const opts = SKIES.map((k) => ({ id: k.id, label: k.label }))
  const label = (id: SkyId) => SKIES.find((k) => k.id === id)?.label ?? ""
  return (
    <SettingsGroup icon={<LuSun />} title="Cel del render" summary={`${label(moble)} · ${label(ambient)}`}>
      <Text textStyle="sm" color="fg.muted">
        Amb quin cel comença el render. «Núvols» i «Interior» són cels reals (HDRI de Poly Haven): llum i reflexos de debò. Al render es pot canviar o carregar-ne un de teu.
      </Text>
      <FormRow label="Mobles" help={SKIES.find((k) => k.id === moble)?.help}>
        <ChoiceChips label="Cel dels mobles" value={moble} onChange={setMoble} options={opts} />
      </FormRow>
      <FormRow label="Ambients" help={SKIES.find((k) => k.id === ambient)?.help}>
        <ChoiceChips label="Cel dels ambients" value={ambient} onChange={setAmbient} options={opts} />
      </FormRow>
    </SettingsGroup>
  )
}

/**
 * Qualitat del visor i escena del mode Presentació. Preferències del dispositiu (es
 * desen al navegador): no s'exporten amb la resta de preferències.
 */
export function SceneFields({ previewComposition }: { previewComposition?: Composition }) {
  const [quality, setQuality] = useRenderQuality()
  const [scene, setScene] = usePresentationScene()
  const { settings } = useSettings()
  const wallName = scene.wallMaterial ?? WALLS.find((w) => w.color === scene.wall)?.label
  return (
    <FoldGrid>
      <SettingsGroup icon={<LuSparkles />} title="Qualitat" summary={QUALITY_LABELS[quality]}>
      <FormRow label="Qualitat" help="Ràpida per treballar (al visor, modes «Per peça» i «Textura»); Presentació per ensenyar-lo. També es canvia a «Opcions de vista» del visor.">
        <ChoiceChips label="Qualitat" value={quality} onChange={setQuality} options={(Object.keys(QUALITY_LABELS) as RenderQuality[]).map((k) => ({ id: k, label: QUALITY_LABELS[k] }))} />
      </FormRow>
      </SettingsGroup>

      <SkyFields />

      <SettingsGroup icon={<LuLampFloor />} title="Escena de presentació" summary={`${wallName ?? "Paret personalitzada"} · ${LIGHTS.find((l) => l.id === scene.light)?.label ?? ""}`}>
      <Text textStyle="sm" color="fg.muted">
        Escena de «Presentació»: on es posa el moble per ensenyar-lo o fer-ne una imatge.
      </Text>
      <ScenePreview composition={previewComposition} />
      {/* Terra i paret: un material de la biblioteca (els mateixos dels ambients) o una mostra ràpida. */}
      <FormRow label="Terra" help="Un material de la biblioteca (Preferències › Materials) o una de les mostres ràpides.">
        <Stack gap={2.5}>
          <Box maxW="280px">
            <MaterialSelect label="Material del terra" hideLabel materials={settings.materials} value={scene.floorMaterial ?? ""} emptyLabel="Mostra ràpida (a sota)" onChange={(name) => setScene({ floorMaterial: name || undefined })} />
          </Box>
          <FloorTiles value={scene.floorMaterial ? ("" as FloorId) : scene.floor} onChange={(floor) => setScene({ floor, floorMaterial: undefined })} />
        </Stack>
      </FormRow>
      <FormRow label="Paret" help={scene.wallMaterial ? undefined : (wallName ?? "Personalitzada")}>
        <Stack gap={2.5}>
          <Box maxW="280px">
            <MaterialSelect label="Material de la paret" hideLabel materials={settings.materials} value={scene.wallMaterial ?? ""} emptyLabel="Color (a sota)" onChange={(name) => setScene({ wallMaterial: name || undefined })} />
          </Box>
          <Swatches label="Paret" items={WALLS.map((w) => ({ id: w.color, label: w.label, swatch: w.color }))} value={scene.wallMaterial ? "" : scene.wall} onChange={(wall) => setScene({ wall, wallMaterial: undefined })} />
        </Stack>
      </FormRow>
      <FormRow label="Sòcol de paret">
        <ChoiceChips label="Sòcol de paret" options={SKIRTINGS} value={scene.skirting} onChange={(skirting) => setScene({ skirting })} />
      </FormRow>
      <FormRow label="Llum" help={LIGHTS.find((l) => l.id === scene.light)?.help}>
        <ChoiceChips label="Llum" options={LIGHTS} value={scene.light} onChange={(light) => setScene({ light })} />
      </FormRow>
      </SettingsGroup>
    </FoldGrid>
  )
}
