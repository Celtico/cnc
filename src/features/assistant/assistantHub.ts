import { useSyncExternalStore } from "react"
import type { ChatTarget } from "./chatTarget"

/**
 * **Assistent personal de tota l'app** (per decisió de l'usuari, 2026-10-13: «un botó de l'assistent personal al menú
 * principal… que tingui tot el context de l'app, que pugui fer tot el que pot fer una persona i que sàpiga si tinc alguna
 * cosa seleccionada»). Aquí es troben les dues meitats sense que es coneguin:
 * - el **document obert** (l'Editor d'un moble o d'un objecte, l'editor d'un ambient) s'hi registra amb el seu
 *   `ChatTarget` (eines, llegir, aplicar, desfer) i una funció que diu què hi ha seleccionat;
 * - l'**app** (`App.tsx`) hi posa la navegació (obrir un document, anar a una pàgina) i on som.
 * El xat (`GlobalAssistant`) ho llegeix a cada volta del torn: si l'assistent obre un document a mitja conversa, la volta
 * següent ja té les eines d'aquell document.
 */

export type HubDocKind = "moble" | "objecte" | "ambient"

export interface HubDoc {
  /** Identificador estable («moble:12», «ambient:3»): canvia quan canvia el document obert. */
  key: string
  kind: HubDocKind
  id: number
  name: string
  target: ChatTarget<unknown>
  /** Què hi ha seleccionat ara, en una frase amb els ids que fan servir les eines (o res). */
  selection: () => string | undefined
}

export interface HubNav {
  /** On som: l'apartat i la pàgina (Editor, Peces…). */
  where: () => { section: string; page: string }
  openMoble: (id: number) => void
  openAmbient: (id: number) => void
  /** Apartats (mobles, ambients, objectes, preferències) i pàgines del moble obert (editor, peces, nesting, exportar). */
  goTo: (place: string) => boolean
}

let doc: HubDoc | null = null
let nav: HubNav | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** El document obert s'hi registra (en muntar-se) i en treu el registre en desmuntar-se. */
export function registerDoc(d: HubDoc): () => void {
  doc = d
  emit()
  return () => {
    if (doc === d) {
      doc = null
      emit()
    }
  }
}

export function registerNav(n: HubNav): () => void {
  nav = n
  return () => {
    if (nav === n) nav = null
  }
}

export const currentDoc = (): HubDoc | null => doc
export const currentNav = (): HubNav | null => nav

/** Espera que el document `key` s'hagi registrat (després d'obrir-lo), com a molt `ms`. */
export function waitForDoc(key: string, ms = 4000): Promise<HubDoc | null> {
  if (doc?.key === key) return Promise.resolve(doc)
  return new Promise((resolve) => {
    const done = (v: HubDoc | null) => {
      listeners.delete(check)
      clearTimeout(timer)
      resolve(v)
    }
    const check = () => doc?.key === key && done(doc)
    const timer = setTimeout(() => done(doc?.key === key ? doc : null), ms)
    listeners.add(check)
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** El document obert (per al xat: què diu a dalt). */
export function useHubDoc(): HubDoc | null {
  return useSyncExternalStore(subscribe, currentDoc, currentDoc)
}
