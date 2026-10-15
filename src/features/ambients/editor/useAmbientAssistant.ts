import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react"
import type { Ambient, Settings } from "../../../core/model"
import { registerDoc } from "../../assistant/assistantHub"
import type { ChatTarget } from "../../assistant/chatTarget"
import type { Selection } from "../planGeom"

/** Xat de l'assistent IA (docs/xat-ia.md): a demanda, el primer cop que s'obre la pestanya «Assistent». */

const AMBIENT_SUGGESTIONS = [
  "Fes-me una habitació de 4 × 3 m (per dins) amb una finestra de 1200 a la paret de dalt i una porta de 800 a la de la dreta.",
  "Posa el moble de TV arrambat a la paret de dalt, centrat.",
  "Afegeix un sofà de 3 places del catàleg davant de la TV, a 2,5 m, mirant-la.",
  "Llegeix aquest plànol i fes-ne les parets, les finestres i les portes.",
]

/** Registra l'ambient obert a l'assistent personal (`assistantHub`): les seves eines i què hi ha seleccionat. */
export function useAmbientAssistant({
  ambientId,
  name,
  settings,
  amb,
  sel,
  ambRef,
  setAmb,
  commit,
}: {
  ambientId: number
  name: string
  settings: Settings
  amb: Ambient
  sel: Selection
  ambRef: RefObject<Ambient>
  setAmb: (next: Ambient, opts?: { commit?: boolean }) => void
  commit: () => void
}) {
  // Assistent IA: llegeix l'ambient d'ara i hi aplica els canvis en viu; en acabar el torn, un sol pas de desfer.
  const getAmb = useCallback(() => ambRef.current, [ambRef])
  const applyLive = useCallback((next: Ambient) => setAmb(next, { commit: false }), [setAmb])
  const commitLive = commit
  const assistantTarget = useMemo(() => {
    const target: ChatTarget<Ambient> = {
      getDoc: getAmb,
      apply: applyLive,
      commit: commitLive,
      toolset: () => import("../../assistant/ambientLibrary").then((m) => m.ambientAssistantToolSet(settings)),
      intro: "Demana-li que faci o canviï l'ambient obert: parets, finestres i portes, col·locar mobles i objectes (els teus o del catàleg), grups i materials (mides en mm). Pots adjuntar un plànol o una foto: llegirà les cotes i demanarà les que no es vegin.",
      suggestions: AMBIENT_SUGGESTIONS,
    }
    return target as unknown as ChatTarget<unknown>
  }, [settings, getAmb, applyLive, commitLive])
  // Assistent personal: aquest ambient s'hi registra amb les seves eines i què hi ha seleccionat (llegit en el moment).
  const describeSel = useRef<() => string | undefined>(() => undefined)
  describeSel.current = () => {
    if (sel?.kind === "item") {
      const it = amb.items.find((i) => i.id === sel.id)
      return it ? `element ${it.kind === "moble" ? `(moble enllaçat, project_id ${it.projectId})` : "(bloc)"} (id ${it.id})` : undefined
    }
    if (sel?.kind === "group") return `grup «${sel.id}»`
    if (sel?.kind === "multi") return `${sel.ids.length} elements (ids ${sel.ids.join(", ")})`
    if (sel?.kind === "wall") {
      const n = amb.walls.findIndex((w) => w.id === sel.id)
      return n >= 0 ? `Paret ${n + 1} (id ${sel.id})` : undefined
    }
    return undefined
  }
  useEffect(() => registerDoc({ key: `ambient:${ambientId}`, kind: "ambient", id: ambientId, name, target: assistantTarget, selection: () => describeSel.current() }), [assistantTarget, ambientId, name])
}
