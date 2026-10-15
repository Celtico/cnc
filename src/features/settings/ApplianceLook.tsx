import { Button, FileUpload, HStack, Image, Spinner, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuImageUp, LuPalette, LuTrash2, LuUndo2 } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { toaster } from "../../components/ui/toaster"
import { APPLIANCE_ITEMS, applianceBodyMaterial, type Appliance, type HardwareItem } from "../../core/model"
import { publicUrl } from "../../lib/publicUrl"
import { encodeAppliancePhoto } from "./appliancePhoto"
import { MaterialSelect } from "./MaterialSelect"
import { useSettings } from "./SettingsContext"

/** Sense fitxers retinguts: cada tria és nova (es pot tornar a triar el mateix fitxer). */
const NO_FILES: File[] = []

/**
 * **Aspecte** d'un electrodomèstic (Preferències › Ferratges › Electrodomèstics; per petició de l'usuari, 2026-10-15:
 * «que es pugui ficar un material/textura o canviar la foto»): la **foto** de la cara vista (canviar-la per una de
 * pròpia, sense el fons blanc: `encodeAppliancePhoto`; tornar a la del catàleg; o cap) i el material del **cos** de
 * l'aparell (`HardwareItem.material`; sense, el de la família: `applianceBodyMaterial`). Només es veu (3D, render,
 * miniatures): no canvia res de la fabricació. Els mòduls fets porten la seva còpia (com tots els ferratges).
 */
export function ApplianceLook({ item, appliance: a, onChange }: { item: HardwareItem; appliance: Appliance; onChange: (next: HardwareItem) => void }) {
  const { settings } = useSettings()
  const [busy, setBusy] = useState(false)
  // La foto del catàleg de l'app (el mateix item o un duplicat seu: la mateixa marca i referència).
  const catalog = APPLIANCE_ITEMS.find((x) => x.id === item.id || (!!item.ref && x.maker === item.maker && x.ref === item.ref))?.appliance?.image
  const setImage = (image: string | undefined) => {
    const { image: _old, ...rest } = a
    onChange({ ...item, appliance: image ? { ...rest, image } : rest })
  }
  const upload = async (file: File | undefined) => {
    if (!file || busy) return
    setBusy(true)
    try {
      setImage(await encodeAppliancePhoto(file))
    } catch (e) {
      toaster.create({ type: "error", title: "No s'ha pogut fer servir la foto", description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }
  const own = !!a.image && a.image !== catalog
  return (
    <FoldItem id="appliance-look" icon={LuPalette} title="Aspecte" badge={own ? "Foto pròpia" : undefined} defaultOpen>
      <FormRow label="Foto" help="La cara vista de l'aparell al 3D, al render i a la miniatura: sencera i centrada sobre el material del cos. En pujar-ne una, el fons blanc es treu sol i es retalla a l'aparell.">
        <Stack gap={2} pt="2px" align="flex-start">
          {a.image ? (
            <Image src={publicUrl(a.image)} alt={item.name} rounded="md" maxW="240px" maxH="240px" objectFit="contain" borderWidth="1px" bg="bg.muted" />
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Sense foto: la cara és del material del cos.
            </Text>
          )}
          <HStack gap={2} wrap="wrap">
            <FileUpload.Root accept="image/*" maxFiles={1} acceptedFiles={NO_FILES} onFileAccept={(d) => void upload(d.files[0])} w="auto" disabled={busy}>
              <FileUpload.HiddenInput data-testid="appliance-photo" />
              <FileUpload.Trigger asChild>
                <Button size="xs" variant="outline">
                  {busy ? <Spinner size="xs" /> : <LuImageUp />} Canviar la foto
                </Button>
              </FileUpload.Trigger>
            </FileUpload.Root>
            {catalog && a.image !== catalog && (
              <Button size="xs" variant="ghost" onClick={() => setImage(catalog)}>
                <LuUndo2 /> La del catàleg
              </Button>
            )}
            {a.image && (
              <Button size="xs" variant="ghost" colorPalette="red" onClick={() => setImage(undefined)}>
                <LuTrash2 /> Treure
              </Button>
            )}
          </HStack>
        </Stack>
      </FormRow>
      <FormRow label="Cos" help="El material de la caixa de l'aparell (els costats i, al voltant de la foto, la cara vista). Per defecte, el de la família: vidre negre els forns, microones i plaques; blanc els frigorífics i les rentadores; inox la resta." maxW="280px">
        <MaterialSelect label="Cos" hideLabel materials={settings.materials} value={item.material ?? ""} emptyLabel={`Per defecte (${applianceBodyMaterial(a)})`} onChange={(v) => {
          const { material: _m, ...rest } = item
          onChange(v ? { ...rest, material: v } : rest)
        }} />
      </FormRow>
    </FoldItem>
  )
}
