import { Button, Spinner, Stack, Text } from "@chakra-ui/react"
import { useRef, useState } from "react"
import { LuUpload } from "react-icons/lu"
import { fileAccept } from "../file/fileAccept"
import { MODEL_UPLOAD_HELP, uploadUserModel, type ModelChoice } from "./useModelAssets"

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
      <Button size="xs" variant="outline" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner size="xs" /> : <LuUpload />} {busy ? "Optimitzant el model…" : "Pujar un model (.glb)…"}
      </Button>
      <Text fontSize="xs" color="fg.subtle">
        {MODEL_UPLOAD_HELP}
      </Text>
    </Stack>
  )
}
