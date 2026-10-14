import { Alert, Badge, Box, Button, Dialog, HStack, IconButton, Image, Portal, Stack, Text, Textarea } from "@chakra-ui/react"
import { useEffect, useRef, useState, type DragEvent } from "react"
import { LuCheck, LuCircleStop, LuFileText, LuFileUp, LuMessageSquarePlus, LuPaperclip, LuSendHorizontal, LuTriangleAlert, LuWifiOff, LuWrench, LuX } from "react-icons/lu"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import { Tooltip } from "../../components/ui/tooltip"
import { ASSISTANT_MODELS, type Settings } from "../../core/model"
import { blobToBase64 } from "../file/mobleIo"
import { shrinkImage } from "../imageShrink"
import { openSettings } from "../settings/openSettings"
import { ATTACH_ACCEPT, attachKind, MAX_PDF_BYTES, textAttachment, type AttachKind } from "./attachments"
import { describeFailure, loadSdk, makeClient } from "./claudeClient"
import { runTurn } from "./chatTurn"
import type { ChatTarget } from "./chatTarget"
import { NO_KEY_ERROR, OFFLINE_ERROR, type AssistantError } from "./errors"

/** Costat llarg màxim de les fotos i plànols que s'envien (docs/xat-ia.md). */
const MAX_IMAGE_PX = 1568

type Part = { kind: "text"; text: string } | { kind: "tool"; name: string; ok: boolean; note: string }
type Item =
  | { id: number; role: "user"; text: string; files?: { kind: AttachKind; name: string; url?: string }[] }
  | { id: number; role: "assistant"; parts: Part[]; error?: AssistantError; note?: string; running?: boolean; changed?: boolean }

interface Attached {
  kind: AttachKind
  /** Només les imatges (miniatura). */
  url?: string
  blob: Blob
  name: string
}

/**
 * Xat de l'assistent IA (docs/xat-ia.md), el mateix a l'Editor (moble i objecte) i als Ambients: la conversa, el text en
 * directe, les eines que fa servir i els errors, amb el camp de text, adjuntar fotos, plànols (≤ 1568 px JPEG), PDF i
 * fitxers de text (amb el clip o deixant-los anar a sobre del panell, `attachments.ts`) i aturar. Les eines i les instruccions són les del document (`target.toolset`). Cada torn és **un sol pas de desfer**
 * (`apply` en viu i `commit` en acabar). La conversa es queda mentre l'editor és obert.
 */
export default function ChatPanel({ settings, target, onClose }: { settings: Settings; target: ChatTarget<unknown>; /** Tancar (al calaix de l'assistent personal): una ✕ a la capçalera. */ onClose?: () => void }) {
  const { getDoc, apply, commit } = target
  const apiKey = settings.assistant.apiKey
  const model = ASSISTANT_MODELS.find((m) => m.id === settings.assistant.model) ?? ASSISTANT_MODELS[0]
  const [items, setItems] = useState<Item[]>([])
  const [input, setInput] = useState("")
  const [attached, setAttached] = useState<Attached[]>([])
  const [attachNote, setAttachNote] = useState<string | null>(null)
  // Arrossegant fitxers a sobre del panell (comptador: dragenter/dragleave salten a cada fill).
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const [running, setRunning] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const history = useRef<MessageParam[]>([])
  const abort = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const list = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Les fotos de la conversa (URL de blob) s'alliberen en sortir de l'Editor.
  const urls = useRef<string[]>([])

  // El SDK es carrega en obrir el xat (no és al bloc d'entrada de l'app).
  useEffect(() => {
    void loadSdk().catch(() => {})
  }, [])
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener("online", on)
    window.addEventListener("offline", on)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", on)
    }
  }, [])
  useEffect(() => {
    const own = urls.current
    return () => {
      abort.current?.abort()
      own.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])
  // Baixa fins al final quan arriba text nou, però només si ja s'hi era: si l'usuari ha pujat a llegir (també mentre
  // escriu la resposta), no se l'estira avall.
  const atBottom = useRef(true)
  useEffect(() => {
    const el = list.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [items])
  const onListScroll = () => {
    const el = list.current
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const updateLast = (fn: (it: Extract<Item, { role: "assistant" }>) => Extract<Item, { role: "assistant" }>) =>
    setItems((xs) => {
      const last = xs.at(-1)
      return last?.role === "assistant" ? [...xs.slice(0, -1), fn(last)] : xs
    })

  const attach = (files: Iterable<File>) => {
    const ok: Attached[] = []
    const skipped: string[] = []
    for (const file of files) {
      const kind = attachKind(file)
      if (!kind || (kind === "pdf" && file.size > MAX_PDF_BYTES)) {
        skipped.push(kind ? `${file.name} (més de 30 MB)` : file.name)
        continue
      }
      let url: string | undefined
      if (kind === "image") {
        url = URL.createObjectURL(file)
        urls.current.push(url)
      }
      ok.push({ kind, ...(url ? { url } : {}), blob: file, name: file.name })
    }
    if (ok.length) setAttached((xs) => [...xs, ...ok])
    setAttachNote(skipped.length ? `No es pot adjuntar: ${skipped.join(", ")}. Només fotos, PDF i fitxers de text.` : null)
    if (fileInput.current) fileInput.current.value = ""
  }
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files")
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current++
      setDragOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return
      if (--dragDepth.current <= 0) {
        dragDepth.current = 0
        setDragOver(false)
      }
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragOver(false)
      attach(Array.from(e.dataTransfer.files))
    },
  }

  const newChat = () => {
    abort.current?.abort()
    history.current = []
    setItems([])
  }
  // Tancar el calaix acaba la conversa (no se'n desa l'historial): si n'hi ha, primer ho pregunta.
  const close = () => {
    if (items.length || running) setConfirmClose(true)
    else onClose?.()
  }
  const closeAndForget = () => {
    setConfirmClose(false)
    newChat()
    setInput("")
    setAttached([])
    setAttachNote(null)
    onClose?.()
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !attached.length) || running) return
    // El missatge nou es veu sempre: torna a seguir el final.
    atBottom.current = true
    if (!apiKey) {
      setItems((xs) => [...xs, { id: nextId.current++, role: "assistant", parts: [], error: NO_KEY_ERROR }])
      return
    }
    if (!navigator.onLine) {
      setItems((xs) => [...xs, { id: nextId.current++, role: "assistant", parts: [], error: OFFLINE_ERROR }])
      return
    }
    const files = attached
    setInput("")
    setAttached([])
    setAttachNote(null)
    setItems((xs) => [...xs, { id: nextId.current++, role: "user", text, ...(files.length ? { files: files.map(({ kind, name, url }) => ({ kind, name, ...(url ? { url } : {}) })) } : {}) }, { id: nextId.current++, role: "assistant", parts: [], running: true }])
    setRunning(true)
    const ctl = new AbortController()
    abort.current = ctl
    // Només si ha canviat el document surt «Desfer-ho tot» (llegir o navegar no es desfà).
    let changed = false
    try {
      // Els adjunts abans del text (recomanació de l'API): les imatges reduïdes a 1568 px JPEG, els PDF tal qual i els
      // fitxers de text com a text.
      const content: Exclude<MessageParam["content"], string> = []
      for (const f of files) {
        if (f.kind === "image") {
          const small = await shrinkImage(f.blob, MAX_IMAGE_PX, { jpeg: true, quality: 0.85 })
          content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await blobToBase64(small.blob) } })
        } else if (f.kind === "pdf") content.push({ type: "document", title: f.name, source: { type: "base64", media_type: "application/pdf", data: await blobToBase64(f.blob) } })
        else content.push({ type: "text", text: textAttachment(f.name, await f.blob.text()) })
      }
      // L'assistent personal hi posa davant on és l'usuari i què té seleccionat.
      const ctx = target.context?.()
      content.push({ type: "text", text: `${ctx ? `${ctx}\n\n` : ""}${text || (files.every((f) => f.kind === "image") ? "Mira aquesta imatge." : "Mira aquest fitxer.")}` })
      history.current.push({ role: "user", content })
      const [client, toolset] = await Promise.all([makeClient(apiKey), target.toolset()])
      const res = await runTurn({
        client,
        model: model.id,
        history: history.current,
        toolset,
        getDoc,
        apply: (d) => {
          changed = true
          apply(d)
        },
        ...(target.refresh ? { refresh: target.refresh } : {}),
        signal: ctl.signal,
        onText: (delta) =>
          updateLast((it) => {
            const last = it.parts.at(-1)
            return { ...it, parts: last?.kind === "text" ? [...it.parts.slice(0, -1), { kind: "text", text: last.text + delta }] : [...it.parts, { kind: "text", text: delta }] }
          }),
        onTool: (t) => updateLast((it) => ({ ...it, parts: [...it.parts, { kind: "tool", ...t }] })),
      })
      const note =
        res.stop === "aborted"
          ? "Aturat."
          : res.stop === "max_tokens"
            ? "La resposta s'ha tallat (massa llarga)."
            : res.stop === "rounds"
              ? "S'ha parat després de moltes eines seguides: demana-li que continuï si cal."
              : res.stop === "refusal"
                ? "L'assistent no ha volgut respondre aquesta petició."
                : undefined
      updateLast((it) => ({ ...it, running: false, changed, ...(note ? { note } : {}) }))
    } catch (e) {
      const error = await describeFailure(e)
      // L'historial ha d'acabar amb l'assistent: el missatge següent no pot anar enganxat a aquest.
      if (history.current.at(-1)?.role === "user") history.current.push({ role: "assistant", content: [{ type: "text", text: `(Error: ${error.title}.)` }] })
      updateLast((it) => ({ ...it, running: false, ...(error.kind === "aborted" ? { note: "Aturat." } : { error }) }))
    } finally {
      // Tot el que ha fet en aquest torn, un sol pas de desfer.
      commit()
      abort.current = null
      setRunning(false)
    }
  }

  return (
    <Stack gap={2} h="full" minH={0} position="relative" data-testid="assistant-panel" {...dropProps}>
      {dragOver && (
        <Stack position="absolute" inset={0} zIndex={2} pointerEvents="none" align="center" justify="center" gap={2} rounded="md" borderWidth="2px" borderStyle="dashed" borderColor="wood.solid" bg="bg.panel/90" color="fg.muted" data-testid="assistant-drop">
          <LuFileUp size={28} />
          <Text fontSize="sm">Deixa anar fotos, PDF o fitxers de text</Text>
        </Stack>
      )}
      <HStack gap={2} flexShrink={0}>
        <Text fontSize="sm" fontWeight="semibold" flex={1} minW={0} truncate>
          Assistent
        </Text>
        <Badge size="sm" variant="subtle" title={`${model.label}: ${model.price} per milió de tokens`}>
          {model.label}
        </Badge>
        <Tooltip content="Nova conversa">
          <IconButton size="xs" variant="ghost" aria-label="Nova conversa" disabled={running || !items.length} onClick={newChat}>
            <LuMessageSquarePlus />
          </IconButton>
        </Tooltip>
        {onClose && (
          <Tooltip content="Tancar">
            <IconButton size="xs" variant="ghost" aria-label="Tancar l'assistent" onClick={close}>
              <LuX />
            </IconButton>
          </Tooltip>
        )}
      </HStack>
      <Dialog.Root role="alertdialog" open={confirmClose} onOpenChange={(e) => !e.open && setConfirmClose(false)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Tancar l'assistent?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  Perdràs la conversa: no es desa.{running ? " La resposta que està escrivint s'aturarà." : ""} Els canvis que ha fet als mobles i ambients es queden (es poden desfer amb ⌘Z).
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setConfirmClose(false)}>
                  Cancel·lar
                </Button>
                <Button colorPalette="red" onClick={closeAndForget}>
                  <LuX /> Tancar i perdre la conversa
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

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

      <Box ref={list} onScroll={onListScroll} flex={1} minH={0} overflowY="auto" css={{ scrollbarWidth: "thin" }} pr={1}>
        {items.length === 0 ? (
          <Stack gap={2} py={2}>
            <Text fontSize="sm" color="fg.muted">
              {target.intro} Cada resposta és un sol pas de desfer (⌘Z).
            </Text>
            {target.suggestions.map((s) => (
              <Button key={s} size="xs" variant="outline" h="auto" py={1.5} whiteSpace="normal" textAlign="left" justifyContent="flex-start" fontWeight="normal" onClick={() => setInput(s)}>
                {s}
              </Button>
            ))}
          </Stack>
        ) : (
          <Stack gap={3} py={1}>
            {items.map((it) =>
              it.role === "user" ? (
                <Stack key={it.id} alignSelf="flex-end" maxW="88%" bg="wood.subtle" rounded="lg" px={3} py={2} gap={2}>
                  {it.files?.map((f, k) =>
                    f.url ? (
                      <Image key={k} src={f.url} alt={f.name} maxH="160px" rounded="md" objectFit="contain" />
                    ) : (
                      <HStack key={k} gap={1.5} fontSize="xs" color="fg.muted" minW={0}>
                        <LuFileText /> <Text truncate>{f.name}</Text>
                      </HStack>
                    ),
                  )}
                  {it.text && (
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {it.text}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Stack key={it.id} gap={1.5} data-testid="assistant-reply">
                  {it.parts.map((p, k) =>
                    p.kind === "text" ? (
                      <Text key={k} fontSize="sm" whiteSpace="pre-wrap">
                        {p.text}
                      </Text>
                    ) : (
                      <HStack key={k} gap={1.5} fontSize="xs" color={p.ok ? "fg.muted" : "orange.fg"} align="flex-start">
                        <Box mt="2px" flexShrink={0}>
                          {p.ok ? <LuWrench /> : <LuTriangleAlert />}
                        </Box>
                        <Text>{p.note}</Text>
                      </HStack>
                    ),
                  )}
                  {it.running && (
                    <Text fontSize="xs" color="fg.muted">
                      {it.parts.length ? "…" : "Pensant…"}
                    </Text>
                  )}
                  {!it.running && !it.error && it.changed && (
                    <HStack gap={1.5} fontSize="xs" color="fg.muted">
                      <LuCheck /> <Text>Desfer-ho tot: ⌘Z (un sol pas).</Text>
                    </HStack>
                  )}
                  {it.note && (
                    <Text fontSize="xs" color="fg.muted">
                      {it.note}
                    </Text>
                  )}
                  {it.error && (
                    <Alert.Root status={it.error.kind === "offline" ? "warning" : "error"} size="sm">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{it.error.title}</Alert.Title>
                        <Alert.Description>
                          {it.error.description}
                          {(it.error.kind === "no-key" || it.error.kind === "auth" || it.error.kind === "not-found") && (
                            <Button size="xs" variant="plain" ml={1} onClick={() => openSettings("assistant")}>
                              Obrir Preferències
                            </Button>
                          )}
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                </Stack>
              ),
            )}
          </Stack>
        )}
      </Box>

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
            <IconButton size="xs" variant="ghost" aria-label={`Treure ${f.name}`} onClick={() => setAttached((xs) => xs.filter((_, i) => i !== k))}>
              <LuX />
            </IconButton>
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
          placeholder={apiKey ? "Què vols fer? (Retorn envia; Maj+Retorn, línia nova)" : "Posa la clau a Preferències › Assistent IA"}
          aria-label="Missatge per a l'assistent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <HStack gap={2}>
          <input ref={fileInput} type="file" accept={ATTACH_ACCEPT} multiple hidden onChange={(e) => attach(Array.from(e.target.files ?? []))} />
          <Tooltip content="Adjuntar fotos, plànols, PDF o fitxers de text (també deixant-los anar a sobre)">
            <IconButton size="sm" variant="ghost" aria-label="Adjuntar fitxers" disabled={running} onClick={() => fileInput.current?.click()}>
              <LuPaperclip />
            </IconButton>
          </Tooltip>
          <Box flex={1} />
          {running ? (
            <Button size="sm" variant="outline" colorPalette="red" onClick={() => abort.current?.abort()}>
              <LuCircleStop /> Aturar
            </Button>
          ) : (
            <Button size="sm" colorPalette="wood" disabled={!input.trim() && !attached.length} onClick={() => void send()}>
              <LuSendHorizontal /> Enviar
            </Button>
          )}
        </HStack>
      </Stack>
    </Stack>
  )
}
