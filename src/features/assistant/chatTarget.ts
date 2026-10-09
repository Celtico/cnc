import type { AssistantToolSet } from "../../core/assistant/toolset"

/**
 * El document que fa servir el xat de l'assistent (`ChatPanel`): les eines i les instruccions del seu tipus (moble, objecte
 * o ambient), llegir-lo, aplicar-hi un canvi en viu i fer el pas de desfer en acabar el torn; i què diu el xat buit.
 */
export interface ChatTarget<D> {
  toolset: AssistantToolSet<D>
  getDoc: () => D
  apply: (next: D) => void
  commit: () => void
  /** Text del xat buit. */
  intro: string
  /** Propostes per començar (tocar-ne una l'escriu al camp). */
  suggestions: string[]
}

/** El mateix objecte sense el tipus del document (el xat no el mira: el passa al torn). */
export const chatTarget = <D>(t: ChatTarget<D>): ChatTarget<unknown> => t as unknown as ChatTarget<unknown>
