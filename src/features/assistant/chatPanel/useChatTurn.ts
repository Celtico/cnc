import { useEffect, useRef, useState, type RefObject } from "react"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import type { ASSISTANT_MODELS } from "../../../core/model"
import { blobToBase64 } from "../../file/mobleIo"
import { shrinkImage } from "../../../lib/imageShrink"
import { textAttachment } from "../attachments"
import { describeFailure, loadSdk, makeClient } from "../claudeClient"
import { runTurn } from "../chatTurn"
import type { ChatTarget } from "../chatTarget"
import { NO_KEY_ERROR, OFFLINE_ERROR } from "../errors"
import type { Attached, Item } from "./types"

/** Costat llarg màxim de les fotos i plànols que s'envien (docs/xat-ia.md). */
const MAX_IMAGE_PX = 1568

type AssistantItem = Extract<Item, { role: "assistant" }>

/**
 * La conversa amb l'assistent: els missatges que es veuen, l'historial per a l'API i enviar un torn (adjunts, text en
 * directe, eines, errors i aturar). Cada torn és un sol pas de desfer (`commit` en acabar).
 */
export function useChatTurn({
  target,
  apiKey,
  model,
  input,
  attached,
  clearDraft,
  atBottom,
}: {
  target: ChatTarget<unknown>
  apiKey: string | undefined
  model: (typeof ASSISTANT_MODELS)[number]
  /** El text i els adjunts del missatge que s'escriu. */
  input: string
  attached: Attached[]
  /** Buida el camp i els adjunts (el missatge ja surt a la conversa). */
  clearDraft: () => void
  atBottom: RefObject<boolean>
}) {
  const { getDoc, apply, commit } = target
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const history = useRef<MessageParam[]>([])
  const abort = useRef<AbortController | null>(null)
  const nextId = useRef(1)

  // El SDK es carrega en obrir el xat (no és al bloc d'entrada de l'app).
  useEffect(() => {
    void loadSdk().catch(() => {})
  }, [])
  // En sortir, s'atura la resposta que s'estigui escrivint.
  useEffect(() => () => abort.current?.abort(), [])

  const updateLast = (fn: (it: AssistantItem) => AssistantItem) =>
    setItems((xs) => {
      const last = xs.at(-1)
      return last?.role === "assistant" ? [...xs.slice(0, -1), fn(last)] : xs
    })

  const newChat = () => {
    abort.current?.abort()
    history.current = []
    setItems([])
  }
  const stop = () => abort.current?.abort()

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
    clearDraft()
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

  return { items, running, send, newChat, stop }
}
