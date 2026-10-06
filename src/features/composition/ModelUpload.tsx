import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react"
import { useRef, useState } from "react"
import { LuFileUp, LuFolderOpen } from "react-icons/lu"
import { ModelImportDialog, type ModelImportHandle } from "./ModelImportDialog"
import { MODEL_UPLOAD_HELP, type ModelChoice } from "./useModelAssets"

/**
 * «Canviar» el model (inspector): «Triar fitxers…» (un .glb, un .gltf amb el .bin i les textures, un .fbx o un .zip de
 * Poly Haven) o «Carpeta…»; la finestra d'importar diu el progrés i el resultat i avisa amb el model nou.
 */
export function ModelUploadButton({ onUploaded }: { onUploaded: (m: ModelChoice) => void }) {
  const dialog = useRef<ModelImportHandle>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Stack gap={1} align="flex-start">
      <ModelImportDialog handle={dialog} onImported={onUploaded} onBusy={setBusy} />
      <HStack gap={1.5} wrap="wrap">
        <Button size="xs" variant="outline" disabled={busy} aria-busy={busy} onClick={() => dialog.current?.pick("files")}>
          {busy ? <Spinner size="xs" /> : <LuFileUp />} {busy ? "Important el model…" : "Triar fitxers…"}
        </Button>
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => dialog.current?.pick("folder")}>
          <LuFolderOpen /> Carpeta…
        </Button>
      </HStack>
      <Text fontSize="xs" color="fg.subtle">
        {MODEL_UPLOAD_HELP}
      </Text>
    </Stack>
  )
}
