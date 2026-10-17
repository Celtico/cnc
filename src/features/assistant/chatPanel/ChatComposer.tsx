import { Box, Button, HStack, IconButton, Image, Stack, Text, Textarea } from "@chakra-ui/react"
import type { RefObject } from "react"
import { LuCircleStop, LuFileText, LuPaperclip, LuSendHorizontal, LuX } from "react-icons/lu"
import { Tooltip } from "../../../components/ui/tooltip"
import { ATTACH_ACCEPT } from "../attachments"
import type { Attached } from "./types"
import { IconAction } from "../../../components/IconAction"

/** On s'escriu: els adjunts, l'avís dels que no s'han pogut adjuntar, el camp de text, el clip i Enviar (o Aturar). */
export function ChatComposer({
  hasKey,
  input,
  onInput,
  attached,
  attachNote,
  fileInput,
  onFiles,
  onRemove,
  running,
  onSend,
  onStop,
}: {
  hasKey: boolean
  input: string
  onInput: (text: string) => void
  attached: Attached[]
  attachNote: string | null
  fileInput: RefObject<HTMLInputElement | null>
  onFiles: (files: File[]) => void
  onRemove: (k: number) => void
  running: boolean
  onSend: () => void
  onStop: () => void
}) {
  return (
    <Stack gap={1.5} flexShrink={0} borderTopWidth="1px" pt={2}>
      {attached.map((f, k) => (
        <HStack key={k} gap={2}>
          {f.url ? (
            <Image src={f.url} alt={f.name} h="48px" maxW="80px" objectFit="cover" rounded="md" />
          ) : (
            <Box color="fg.muted" flexShrink={0}>
              <LuFileText />
            </Box>
          )}
          <Text fontSize="xs" color="fg.muted" flex={1} minW={0} truncate>
            {f.name}
          </Text>
          <IconAction size="xs" variant="ghost" label={`Treure ${f.name}`} onClick={() => onRemove(k)}>
            <LuX />
          </IconAction>
        </HStack>
      ))}
      {attachNote && (
        <Text fontSize="xs" color="orange.fg">
          {attachNote}
        </Text>
      )}
      <Textarea
        size="sm"
        rows={3}
        resize="none"
        placeholder={hasKey ? "Què vols fer? (Retorn envia; Maj+Retorn, línia nova)" : "Posa la clau a Preferències › Assistent IA"}
        aria-label="Missatge per a l'assistent"
        value={input}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          }
        }}
      />
      <HStack gap={2}>
        <input ref={fileInput} type="file" accept={ATTACH_ACCEPT} multiple hidden onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
        <Tooltip content="Adjuntar fotos, plànols, PDF o fitxers de text (també deixant-los anar a sobre)">
          <IconButton size="sm" variant="ghost" aria-label="Adjuntar fitxers" disabled={running} onClick={() => fileInput.current?.click()}>
            <LuPaperclip />
          </IconButton>
        </Tooltip>
        <Box flex={1} />
        {running ? (
          <Button size="sm" variant="outline" colorPalette="red" onClick={onStop}>
            <LuCircleStop /> Aturar
          </Button>
        ) : (
          <Button size="sm" colorPalette="wood" disabled={!input.trim() && !attached.length} onClick={onSend}>
            <LuSendHorizontal /> Enviar
          </Button>
        )}
      </HStack>
    </Stack>
  )
}
