import type { AttachKind } from "../attachments"
import type { AssistantError } from "../errors"

/** Un tros de la resposta: text o una eina feta (amb la nota del que ha fet). */
type Part = { kind: "text"; text: string } | { kind: "tool"; name: string; ok: boolean; note: string }
/** Un missatge de la conversa tal com es veu al xat. */
export type Item =
  | { id: number; role: "user"; text: string; files?: { kind: AttachKind; name: string; url?: string }[] }
  | { id: number; role: "assistant"; parts: Part[]; error?: AssistantError; note?: string; running?: boolean; changed?: boolean }

export interface Attached {
  kind: AttachKind
  /** Només les imatges (miniatura). */
  url?: string
  blob: Blob
  name: string
}
