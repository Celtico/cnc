import { Button, Dialog, HStack, IconButton, Portal, Spinner, Stack, Text } from "@chakra-ui/react"
import { useRef, useState } from "react"
import { LuTrash2, LuUpload } from "react-icons/lu"
import { Tooltip } from "../../components/ui/tooltip"
import { fileAccept } from "../file/fileAccept"
import { formatBytes, MODEL_UPLOAD_HELP, removeUserModel, uploadUserModel, useModelAssets, type ModelChoice } from "./useModelAssets"

/** Botó «Pujar un model (.glb)…»: obre el selector de fitxers, l'importa (`db.models`) i avisa amb el model nou. */
export function ModelUploadButton({ onUploaded }: { onUploaded: (m: ModelChoice) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = ""
    if (!file) return
    setBusy(true)
    const m = await uploadUserModel(file)
    setBusy(false)
    if (m) onUploaded(m)
  }
  return (
    <Stack gap={1} align="flex-start">
      <input ref={input} type="file" accept={fileAccept(".glb,model/gltf-binary")} hidden data-testid="model-upload-input" onChange={(e) => void pick(e.target.files?.[0])} />
      <Button size="xs" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner size="xs" /> : <LuUpload />} Pujar un model (.glb)…
      </Button>
      <Text fontSize="xs" color="fg.subtle">
        {MODEL_UPLOAD_HELP}
      </Text>
    </Stack>
  )
}

/** «Els teus models 3D»: nom, mida i esborrar (els objectes que el facin servir es quedaran sense res a dins). */
export function UserModelsList() {
  const { userModels } = useModelAssets()
  const [toDelete, setToDelete] = useState<ModelChoice | null>(null)
  if (!userModels.length) return null
  return (
    <Stack gap={1}>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
        Els teus models 3D
      </Text>
      {userModels.map((m) => (
        <HStack key={m.id} gap={2} fontSize="xs" minW={0}>
          <Stack gap={0} flex={1} minW={0}>
            <Text truncate title={m.name}>
              {m.name}
            </Text>
            <Text color="fg.subtle">
              {m.size.join(" × ")} mm{m.bytes !== undefined ? ` · ${formatBytes(m.bytes)}` : ""}
            </Text>
          </Stack>
          <Tooltip content="Esborrar el model">
            <IconButton size="2xs" variant="ghost" aria-label={`Esborrar ${m.name}`} onClick={() => setToDelete(m)}>
              <LuTrash2 />
            </IconButton>
          </Tooltip>
        </HStack>
      ))}
      <Dialog.Root role="alertdialog" open={toDelete !== null} onOpenChange={(e) => !e.open && setToDelete(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar «{toDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Els objectes i mobles que el facin servir no mostraran res al seu lloc (la caixa es manté).</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setToDelete(null)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    if (toDelete) void removeUserModel(toDelete.id)
                    setToDelete(null)
                  }}
                >
                  <LuTrash2 /> Esborrar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}
