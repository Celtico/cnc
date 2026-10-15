import { Alert, Button, Dialog, Portal, Spinner, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { LuTrash2 } from "react-icons/lu"
import { backChoices, boardChoices, materialCategory, materialSettingsUsage, type MaterialPref, type Settings } from "../../core/model"
import { materialUsage } from "../../db/materialRefs"
import { FormRow } from "../../components/FormRow"
import { keepDialogOnWindowEscape, WINDOWS_PERSIST } from "../../components/windowRect"
import { MaterialSelect } from "./MaterialSelect"

/**
 * Confirmació d'eliminar un material, amb on es fa servir («Es fa servir a: moble A, moble B… i com a material per
 * defecte / mida de tauler»). Si es fa servir, es pot triar un substitut (les referències hi passen, com en canviar el
 * nom); si és el tauler o el fons per defecte, cal triar-ne un.
 */
export function DeleteMaterialDialog({ material, settings, onCancel, onConfirm }: { material: MaterialPref | null; settings: Settings; onCancel: () => void; onConfirm: (replacement: string | null) => void }) {
  const name = material?.name ?? ""
  const [usage, setUsage] = useState<{ name: string; projects: string[]; ambients: string[] } | null>(null)
  // El substitut és d'aquest material (en obrir-lo per a un altre, buit).
  const [pick, setPick] = useState({ of: "", name: "" })
  const replacement = pick.of === name ? pick.name : ""
  const setReplacement = (n: string) => setPick({ of: name, name: n })
  useEffect(() => {
    if (!name) return
    let live = true
    void materialUsage(name).then((u) => live && setUsage({ name, ...u }))
    return () => {
      live = false
    }
  }, [name])
  const loaded = usage?.name === name ? usage : null
  const inSettings = materialSettingsUsage(settings, name)
  const mandatory = inSettings.defaultBody || inSettings.defaultBack
  // El substitut: de la mateixa mena (el tauler per defecte, un tauler; el fons, un tauler o un fons).
  const choices = (inSettings.defaultBody ? boardChoices(settings.materials) : inSettings.defaultBack ? backChoices(settings.materials) : material ? settings.materials.filter((m) => materialCategory(m) === materialCategory(material)) : []).filter((m) => m.name !== name)
  const usedBy = loaded ? [...loaded.projects, ...loaded.ambients.map((a) => `l'ambient ${a}`)] : []
  const roles = [inSettings.defaultBody && "tauler per defecte", inSettings.defaultBack && "fons per defecte", inSettings.sheets > 0 && "mida de tauler"].filter(Boolean) as string[]
  const used = usedBy.length > 0 || roles.length > 0
  const shown = usedBy.slice(0, 6)
  return (
    // El substitut es tria a la finestra de tria (`MaterialSelect`), que va per sobre del diàleg: no el tanca en tocar-la,
    // el focus hi pot entrar i Esc la tanca a ella.
    <Dialog.Root role="alertdialog" open={material !== null} onOpenChange={(e) => !e.open && onCancel()} placement="center" trapFocus={false} persistentElements={WINDOWS_PERSIST} onEscapeKeyDown={keepDialogOnWindowEscape}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx={4}>
            <Dialog.Header>
              <Dialog.Title>Eliminar «{name}»?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                {!loaded ? (
                  <Spinner size="sm" color="wood.solid" />
                ) : used ? (
                  <Text fontSize="sm">
                    Es fa servir{shown.length > 0 ? " a " : " "}
                    {shown.length > 0 && <strong>{shown.join(", ")}{usedBy.length > shown.length ? ` i ${usedBy.length - shown.length} més` : ""}</strong>}
                    {shown.length > 0 && roles.length > 0 && " i "}
                    {roles.length > 0 && `com a ${roles.join(" / ")}`}.
                  </Text>
                ) : (
                  <Text fontSize="sm">No el fa servir cap moble, objecte ni ambient.</Text>
                )}
                {used && (
                  <FormRow label="Substituir per" help={mandatory ? "És un material per defecte: cal triar-ne un altre." : "Opcional: els mobles i ambients que el fan servir passen al que triïs."}>
                    <MaterialSelect label="Substituir per" hideLabel materials={choices} value={replacement} emptyLabel={mandatory ? undefined : "Cap (es queden amb aquest nom)"} onChange={setReplacement} />
                  </FormRow>
                )}
                {used && !replacement && !mandatory && usedBy.length > 0 && (
                  <Alert.Root status="warning" size="sm">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>Sense substitut, aquests mobles es veuran amb un color per defecte i al taller sortiran amb el nom «{name}».</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onCancel}>
                Cancel·lar
              </Button>
              <Button colorPalette="red" disabled={!loaded || (mandatory && !replacement)} onClick={() => onConfirm(replacement || null)}>
                <LuTrash2 /> {replacement ? "Substituir i eliminar" : "Eliminar"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
