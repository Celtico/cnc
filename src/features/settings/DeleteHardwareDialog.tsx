import { Alert, Button, Dialog, Portal, Spinner, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { HARDWARE_SLOTS, type HardwareDefaults, type HardwareItem } from "../../core/model"
import { hardwareUsage } from "../../db/hardwareRefs"

/**
 * Confirmació d'eliminar un ferratge de la biblioteca (com `DeleteMaterialDialog`): diu on es fa servir (mobles desats que
 * en porten una còpia, i si és el per defecte d'algun lloc). **Si es fa servir, cal triar un substitut** del mateix tipus:
 * els mobles hi passen (les seves còpies es canvien) i el per defecte també. Sense cap altre del mateix tipus, no es pot.
 */
export function DeleteHardwareDialog({ item, items, defaults, onCancel, onConfirm }: { item: HardwareItem | null; items: HardwareItem[]; defaults: HardwareDefaults; onCancel: () => void; onConfirm: (replacement: string | null) => void }) {
  const id = item?.id ?? ""
  const [usage, setUsage] = useState<{ id: string; projects: string[] } | null>(null)
  const [pick, setPick] = useState({ of: "", id: "" })
  const replacement = pick.of === id ? pick.id : ""
  useEffect(() => {
    if (!id) return
    let live = true
    void hardwareUsage(id).then((projects) => live && setUsage({ id, projects }))
    return () => {
      live = false
    }
  }, [id])
  const loaded = usage?.id === id ? usage : null
  const slots = item ? HARDWARE_SLOTS.filter((s) => defaults[s.slot] === item.id) : []
  const choices = item ? items.filter((x) => x.engine === item.engine && x.id !== item.id) : []
  const used = (loaded?.projects.length ?? 0) > 0 || slots.length > 0
  const shown = loaded?.projects.slice(0, 6) ?? []
  const blocked = used && choices.length === 0
  return (
    <Dialog.Root role="alertdialog" open={item !== null} onOpenChange={(e) => !e.open && onCancel()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx={4}>
            <Dialog.Header>
              <Dialog.Title>Eliminar «{item?.name}»?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                {!loaded ? (
                  <Spinner size="sm" color="wood.solid" />
                ) : used ? (
                  <Text fontSize="sm">
                    Es fa servir{shown.length > 0 ? " a " : " "}
                    {shown.length > 0 && <strong>{shown.join(", ")}{loaded.projects.length > shown.length ? ` i ${loaded.projects.length - shown.length} més` : ""}</strong>}
                    {shown.length > 0 && slots.length > 0 && " i "}
                    {slots.length > 0 && `com a ${slots.map((s) => s.label.toLowerCase()).join(" / ")} per defecte`}.
                  </Text>
                ) : (
                  <Text fontSize="sm">No el fa servir cap moble desat ni és el per defecte de cap lloc.</Text>
                )}
                {loaded && used && !blocked && (
                  <FormRow label="Substituir per" help="Cal triar-ne un altre del mateix tipus: els mobles que el fan servir i el per defecte hi passen (els forats poden canviar).">
                    <ChoiceChips label="Substituir per" value={replacement} options={choices.map((x) => ({ id: x.id, label: x.name }))} onChange={(v) => setPick({ of: id, id: v })} />
                  </FormRow>
                )}
                {blocked && (
                  <Alert.Root status="warning" size="sm">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>És l'únic d'aquest tipus i es fa servir: afegeix-ne un altre abans d'eliminar-lo.</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onCancel}>
                Cancel·lar
              </Button>
              <Button colorPalette="red" disabled={!loaded || blocked || (used && !replacement)} onClick={() => onConfirm(replacement || null)}>
                <LuTrash2 /> {replacement ? "Substituir i eliminar" : "Eliminar"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
