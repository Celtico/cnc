import { Alert, Badge, Box, Button, HStack, IconButton, Image, Stack, Text, Textarea } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { LuCheck, LuCircleStop, LuImagePlus, LuMessageSquarePlus, LuSendHorizontal, LuTriangleAlert, LuWifiOff, LuWrench, LuX } from "react-icons/lu"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import { Tooltip } from "../../components/ui/tooltip"
import { ASSISTANT_MODELS, type Composition, type Settings } from "../../core/model"
import { blobToBase64 } from "../file/mobleIo"
import { shrinkImage } from "../imageShrink"
import { openSettings } from "../settings/openSettings"
import { describeFailure, loadSdk, makeClient } from "./claudeClient"
import { runTurn } from "./chatTurn"
import { NO_KEY_ERROR, OFFLINE_ERROR, type AssistantError } from "./errors"

/** Costat llarg màxim de les fotos i plànols que s'envien (docs/xat-ia.md). */
const MAX_IMAGE_PX = 1568

type Part = { kind: "text"; text: string } | { kind: "tool"; name: string; ok: boolean; note: string }
type Item =
  | { id: number; role: "user"; text: string; image?: string }
  | { id: number; role: "assistant"; parts: Part[]; error?: AssistantError; note?: string; running?: boolean }

interface Attached {
  url: string
  blob: Blob
  name: string
}

const SUGGESTIONS = [
  "Fes-me un moble de TV de 1800 × 450 × 400 amb dos calaixos a baix i un forat obert al mig.",
  "Divideix aquest mòdul en tres columnes iguals i posa prestatges regulables a les dels costats.",
  "Canvia els fronts a lacat negre brillant.",
  "Revisa els avisos de fusteria i corregeix-los.",
]

/**
 * Xat de l'assistent IA a l'Editor del moble (docs/xat-ia.md): la conversa, el text en directe, les eines que fa servir i
 * els errors, amb el camp de text, adjuntar una foto o un plànol (≤ 1568 px JPEG) i aturar. Cada torn és **un sol pas de
 * desfer** (`apply` en viu i `commit` en acabar). La conversa es queda mentre l'Editor és obert.
 */
export default function ChatPanel({ settings, getComp, apply, commit }: { settings: Settings; getComp: () => Composition; apply: (next: Composition) => void; commit: () => void }) {
  const apiKey = settings.assistant.apiKey
  const model = ASSISTANT_MODELS.find((m) => m.id === settings.assistant.model) ?? ASSISTANT_MODELS[0]
  const [items, setItems] = useState<Item[]>([])
  const [input, setInput] = useState("")
  const [attached, setAttached] = useState<Attached | null>(null)
  const [running, setRunning] = useState(false)
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
  // Baixa fins al final quan arriba text nou.
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items])

  const updateLast = (fn: (it: Extract<Item, { role: "assistant" }>) => Extract<Item, { role: "assistant" }>) =>
    setItems((xs) => {
      const last = xs.at(-1)
      return last?.role === "assistant" ? [...xs.slice(0, -1), fn(last)] : xs
    })

  const attach = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    urls.current.push(url)
    setAttached({ url, blob: file, name: file.name })
    if (fileInput.current) fileInput.current.value = ""
  }

  const newChat = () => {
    abort.current?.abort()
    history.current = []
    setItems([])
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !attached) || running) return
    if (!apiKey) {
      setItems((xs) => [...xs, { id: nextId.current++, role: "assistant", parts: [], error: NO_KEY_ERROR }])
      return
    }
    if (!navigator.onLine) {
      setItems((xs) => [...xs, { id: nextId.current++, role: "assistant", parts: [], error: OFFLINE_ERROR }])
      return
    }
    const image = attached
    setInput("")
    setAttached(null)
    setItems((xs) => [...xs, { id: nextId.current++, role: "user", text, ...(image ? { image: image.url } : {}) }, { id: nextId.current++, role: "assistant", parts: [], running: true }])
    setRunning(true)
    const ctl = new AbortController()
    abort.current = ctl
    try {
      // La imatge abans del text (recomanació de l'API), reduïda a 1568 px JPEG.
      const content: Exclude<MessageParam["content"], string> = []
      if (image) {
        const small = await shrinkImage(image.blob, MAX_IMAGE_PX, { jpeg: true, quality: 0.85 })
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await blobToBase64(small.blob) } })
      }
      content.push({ type: "text", text: text || "Mira aquesta imatge." })
      history.current.push({ role: "user", content })
      const client = await makeClient(apiKey)
      const res = await runTurn({
        client,
        model: model.id,
        history: history.current,
        getComp,
        apply,
        ctx: { settings },
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
      updateLast((it) => ({ ...it, running: false, ...(note ? { note } : {}) }))
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
    <Stack gap={2} h="full" minH={0} data-testid="assistant-panel">
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
      </HStack>

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

      <Box ref={list} flex={1} minH={0} overflowY="auto" css={{ scrollbarWidth: "thin" }} pr={1}>
        {items.length === 0 ? (
          <Stack gap={2} py={2}>
            <Text fontSize="sm" color="fg.muted">
              Demana-li que faci o canviï el moble obert (mides en mm). Pots adjuntar una foto o un plànol: les mides que en
              tregui són estimades. Cada resposta és un sol pas de desfer (⌘Z).
            </Text>
            {SUGGESTIONS.map((s) => (
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
                  {it.image && <Image src={it.image} alt="Imatge adjunta" maxH="160px" rounded="md" objectFit="contain" />}
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
                  {!it.running && !it.error && it.parts.some((p) => p.kind === "tool" && p.ok) && (
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
        {attached && (
          <HStack gap={2}>
            <Image src={attached.url} alt={attached.name} h="48px" maxW="80px" objectFit="cover" rounded="md" />
            <Text fontSize="xs" color="fg.muted" flex={1} minW={0} truncate>
              {attached.name}
            </Text>
            <IconButton size="xs" variant="ghost" aria-label="Treure la imatge" onClick={() => setAttached(null)}>
              <LuX />
            </IconButton>
          </HStack>
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
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0])} />
          <Tooltip content="Adjuntar una foto o un plànol">
            <IconButton size="sm" variant="ghost" aria-label="Adjuntar una foto o un plànol" disabled={running} onClick={() => fileInput.current?.click()}>
              <LuImagePlus />
            </IconButton>
          </Tooltip>
          <Box flex={1} />
          {running ? (
            <Button size="sm" variant="outline" colorPalette="red" onClick={() => abort.current?.abort()}>
              <LuCircleStop /> Aturar
            </Button>
          ) : (
            <Button size="sm" colorPalette="wood" disabled={!input.trim() && !attached} onClick={() => void send()}>
              <LuSendHorizontal /> Enviar
            </Button>
          )}
        </HStack>
      </Stack>
    </Stack>
  )
}
