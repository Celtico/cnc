import { Alert, Button, HStack, Stack, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { LuFileUp, LuWifiOff } from "react-icons/lu"
import { ASSISTANT_MODELS, type Settings } from "../../core/model"
import { openSettings } from "../settings/openSettings"
import type { ChatTarget } from "./chatTarget"
import { useLatest } from "../../lib/useLatest"
import { useChatAttachments } from "./chatPanel/useChatAttachments"
import { useChatScroll } from "./chatPanel/useChatScroll"
import { useChatTurn } from "./chatPanel/useChatTurn"
import { useOnline } from "./chatPanel/useOnline"
import { ChatHeader } from "./chatPanel/ChatHeader"
import { NewChatDialog } from "./chatPanel/NewChatDialog"
import { ChatMessages } from "./chatPanel/ChatMessages"
import { ChatComposer } from "./chatPanel/ChatComposer"

/**
 * Xat de l'assistent IA (docs/xat-ia.md), el mateix a l'Editor (moble i objecte) i als Ambients: la conversa, el text en
 * directe, les eines que fa servir i els errors, amb el camp de text, adjuntar fotos, plànols (≤ 1568 px JPEG), PDF i
 * fitxers de text (amb el clip o deixant-los anar a sobre del panell, `attachments.ts`) i aturar. Les eines i les instruccions són les del document (`target.toolset`). Cada torn és **un sol pas de desfer**
 * (`apply` en viu i `commit` en acabar). La conversa es queda mentre l'editor és obert.
 */
export default function ChatPanel({ settings, target, onClose, closeRequest = 0 }: { settings: Settings; target: ChatTarget<unknown>; /** Tancar (al calaix de l'assistent personal): una ✕ a la capçalera. */ onClose?: () => void; /** Cada cop que puja, es demana tancar com la ✕ (tornar a tocar el botó «Assistent»). */ closeRequest?: number }) {
  const apiKey = settings.assistant.apiKey
  const model = ASSISTANT_MODELS.find((m) => m.id === settings.assistant.model) ?? ASSISTANT_MODELS[0]
  const [input, setInput] = useState("")
  const files = useChatAttachments()
  const [confirmClose, setConfirmClose] = useState(false)
  const online = useOnline()
  // Si es segueix el final de la conversa (`useChatScroll`); enviar un missatge hi torna.
  const atBottom = useRef(true)
  const { items, running, send, newChat, stop } = useChatTurn({
    target,
    apiKey,
    model,
    input,
    attached: files.attached,
    clearDraft: () => {
      setInput("")
      files.clear()
    },
    atBottom,
  })
  const { list, onListScroll } = useChatScroll(items, atBottom)

  // Tancar el calaix no esborra res (per decisió de l'usuari, 2026-10-14: «encara que es tanqui, no cal esborrar mai el
  // que hi ha al xat»): en tornar-lo a obrir, la conversa hi és (i una resposta a mig escriure continua). Només «Nova
  // conversa» la buida, i ho pregunta.
  const close = () => onClose?.()
  const askNewChat = () => (items.length || running ? setConfirmClose(true) : newChat())
  // Tornar a tocar el botó «Assistent» del menú el tanca com la ✕ (per decisió de l'usuari, 2026-10-14).
  const lastReq = useRef(closeRequest)
  const onCloseRef = useLatest(onClose)
  useEffect(() => {
    if (closeRequest === lastReq.current) return
    lastReq.current = closeRequest
    onCloseRef.current?.()
  }, [closeRequest, onCloseRef])
  const startFresh = () => {
    setConfirmClose(false)
    newChat()
    setInput("")
    files.clear()
  }

  return (
    <Stack gap={2} h="full" minH={0} position="relative" data-testid="assistant-panel" {...files.dropProps}>
      {files.dragOver && (
        <Stack position="absolute" inset={0} zIndex={2} pointerEvents="none" align="center" justify="center" gap={2} rounded="md" borderWidth="2px" borderStyle="dashed" borderColor="wood.solid" bg="bg.panel/90" color="fg.muted" data-testid="assistant-drop">
          <LuFileUp size={28} />
          <Text fontSize="sm">Deixa anar fotos, PDF o fitxers de text</Text>
        </Stack>
      )}
      <ChatHeader model={model} canStartNew={!!items.length || running} onNewChat={askNewChat} onClose={onClose && close} />
      <NewChatDialog open={confirmClose} running={running} onCancel={() => setConfirmClose(false)} onConfirm={startFresh} />

      {!apiKey && (
        <Alert.Root status="info" size="sm" flexShrink={0}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Falta la clau de l'API</Alert.Title>
            <Alert.Description>
              L'assistent fa servir l'API de Claude amb la teva clau.
              <Button size="xs" variant="plain" ml={1} onClick={() => openSettings("assistant")}>
                Preferències › Assistent IA
              </Button>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {apiKey && !online && (
        <HStack gap={1.5} fontSize="xs" color="fg.muted" flexShrink={0}>
          <LuWifiOff /> <Text>Sense connexió: l'assistent no pot respondre fins que tornis a tenir internet.</Text>
        </HStack>
      )}

      <ChatMessages listRef={list} onScroll={onListScroll} items={items} intro={target.intro} suggestions={target.suggestions} onSuggestion={setInput} />

      <ChatComposer
        hasKey={!!apiKey}
        input={input}
        onInput={setInput}
        attached={files.attached}
        attachNote={files.attachNote}
        fileInput={files.fileInput}
        onFiles={files.attach}
        onRemove={files.remove}
        running={running}
        onSend={() => void send()}
        onStop={stop}
      />
    </Stack>
  )
}
