import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react"
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react"
import { LuFileUp, LuFolderOpen, LuUpload } from "react-icons/lu"
import { pickedFromDrop, pickedFromList, type PickedFile } from "./pickedFiles"

/** Per obrir els selectors des d'un altre botó (p. ex. «Importar .pgmx» al detall d'una màquina). */
export interface ImportDropZoneHandle {
  pick: (which: "folder" | "files") => void
}

/**
 * Zona d'importar fitxers (com a les apps d'escriptori): «Triar carpeta…» (`webkitdirectory`), «Triar fitxers…» i deixar
 * anar fitxers i carpetes a sobre (`webkitGetAsEntry`). La fan servir Màquines CNC («Importar de Maestro») i Ferratges
 * («Importar del fabricant»). `onPicked` rep els fitxers amb el camí relatiu; mentre `busy`, els botons esperen.
 */
export function ImportDropZone({
  title,
  children,
  accept,
  busy,
  onPicked,
  testId,
  handle,
}: {
  title: string
  /** Explicació de què es pot importar. */
  children: ReactNode
  /** Extensions del selector de fitxers (`.zip,.stp`). */
  accept: string
  busy: boolean
  onPicked: (picked: PickedFile[]) => void | Promise<void>
  /** Prefix dels `data-testid` (`<id>-drop`, `<id>-folder`, `<id>-files`). */
  testId: string
  handle?: Ref<ImportDropZoneHandle>
}) {
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const pick = (which: "folder" | "files") => (which === "folder" ? folderInput : filesInput).current?.click()
  useImperativeHandle(handle, () => ({ pick }), [])
  const take = (list: FileList | null, input: HTMLInputElement) => {
    const picked = pickedFromList(list ?? [])
    // El mateix fitxer es pot tornar a triar.
    input.value = ""
    if (picked.length) void onPicked(picked)
  }
  return (
    <>
      {/* Carpeta o fitxers: el navegador no deixa triar totes dues coses alhora. */}
      <input
        ref={(el) => {
          folderInput.current = el
          el?.setAttribute("webkitdirectory", "")
        }}
        type="file"
        multiple
        hidden
        data-testid={`${testId}-folder`}
        onChange={(e) => take(e.target.files, e.target)}
      />
      <input ref={filesInput} type="file" multiple hidden accept={accept} data-testid={`${testId}-files`} onChange={(e) => take(e.target.files, e.target)} />
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor={dragOver ? "wood.solid" : "border"}
        bg={dragOver ? "wood.subtle" : "bg.subtle"}
        rounded="l2"
        p={3}
        data-testid={`${testId}-drop`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void pickedFromDrop(e.dataTransfer).then((p) => p.length && onPicked(p))
        }}
      >
        <Stack gap={2}>
          <Text fontSize="sm" fontWeight="medium">
            <LuUpload style={{ display: "inline", verticalAlign: "-2px" }} /> {title}
          </Text>
          <Text fontSize="xs" color="fg.muted" as="div">
            {children}
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button colorPalette="wood" size="sm" loading={busy} onClick={() => pick("folder")}>
              <LuFolderOpen /> Triar carpeta…
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => pick("files")}>
              <LuFileUp /> Triar fitxers…
            </Button>
          </HStack>
        </Stack>
      </Box>
    </>
  )
}
