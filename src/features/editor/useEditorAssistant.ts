import { useEffect, useMemo } from "react"
import { findZone, partsOnlyKind, type Composition, type compositionKind, type Settings } from "../../core/model"
import { chatTarget } from "../assistant/chatTarget"
import { registerDoc } from "../assistant/assistantHub"
import type { Selection } from "../composition/StructureTree"
import { zoneLabel } from "../composition/zoneLabel"
import { useLatest } from "../../lib/useLatest"

/** Xat de l'assistent IA (docs/xat-ia.md): a demanda, el primer cop que s'obre la pestanya «Assistent». */

const MOBLE_SUGGESTIONS = [
  "Fes-me un moble de TV de 1800 × 450 × 400 amb dos calaixos a baix i un forat obert al mig.",
  "Divideix aquest mòdul en tres columnes iguals i posa prestatges regulables a les dels costats.",
  "Canvia els fronts a lacat negre brillant.",
  "Revisa els avisos de fusteria i corregeix-los.",
]
const OBJECT_SUGGESTIONS = [
  "Fes-me una tauleta rodona de Ø 500 i 450 d'alt, sobre de marbre i peu de ferro negre.",
  "Afegeix un coixí de 450 × 450 × 120 de vellut verd sobre el seient.",
  "Agrupa les potes i baixa-les 20 mm.",
]

/** L'assistent personal: les eines d'aquest document i què hi ha seleccionat, registrats a `assistantHub.ts`. */
export function useEditorAssistant({
  projectId,
  name,
  kind,
  settings,
  comp,
  selection,
  getComp,
  applyLive,
  commitHistory,
}: {
  projectId: number
  name: string
  kind: ReturnType<typeof compositionKind>
  settings: Settings
  comp: Composition
  selection: Selection
  getComp: () => Composition
  applyLive: (next: Composition) => void
  commitHistory: () => void
}) {
  // Assistent IA: les eines del moble o de l'objecte (docs/xat-ia.md); un torn = un pas de desfer.
  const assistantTarget = useMemo(() => {
    const live = { getDoc: getComp, apply: applyLive, commit: commitHistory }
    if (kind === "objecte")
      return chatTarget({ ...live, toolset: () => import("../../core/assistant/objectTools").then((m) => m.objectToolSet({ settings })), intro: "Demana-li que faci o canviï l'objecte obert (mides en mm; és decoratiu, no es fabrica). Pots adjuntar-ne una foto: les mides que en tregui són estimades.", suggestions: OBJECT_SUGGESTIONS })
    if (partsOnlyKind(kind)) return undefined
    return chatTarget({ ...live, toolset: () => import("../../core/assistant/tools").then((m) => m.mobleToolSet({ settings })), intro: "Demana-li que faci o canviï el moble obert (mides en mm). Pots adjuntar una foto o un plànol: les mides que en tregui són estimades.", suggestions: MOBLE_SUGGESTIONS })
  }, [kind, settings, getComp, applyLive, commitHistory])
  // Assistent personal (`assistantHub.ts`): aquest document s'hi registra amb les seves eines i què hi ha seleccionat
  // (amb els ids que fan servir les eines). La selecció es llegeix en el moment (ref), no en registrar-se.
  const describeSelection = useLatest((): string | undefined => {
    const name = (id: string) => comp.modules.find((m) => m.id === id)?.name ?? id
    switch (selection.kind) {
      case "module":
        return `mòdul «${name(selection.id)}» (module: ${selection.id})`
      case "zone": {
        const m = comp.modules.find((x) => x.id === selection.moduleId)
        const z = m ? findZone(m.root, selection.zoneId) : undefined
        return `compartiment «${z ? zoneLabel(z, { root: z.id === m?.root.id }) : selection.zoneId}» (zone: ${selection.zoneId}) del mòdul «${name(selection.moduleId)}» (module: ${selection.moduleId})`
      }
      case "ref":
        return `objecte de referència «${comp.references.find((r) => r.id === selection.id)?.name ?? selection.id}» (id ${selection.id})`
      case "part":
        return `peça lliure «${comp.parts?.find((p) => p.id === selection.id)?.name ?? selection.id}» (part_id ${selection.id})`
      case "group":
        return `grup de peces «${selection.id}»`
      case "model":
        return `model 3D (id ${selection.id})`
      case "hardware":
        return `ferratge col·locat (id ${selection.id})`
      case "multi":
        return `${selection.items.length} elements: ${selection.items.map((x) => `${x.kind} ${x.id}`).join(", ")}`
      default:
        return undefined
    }
  })
  useEffect(() => {
    if (!assistantTarget) return
    const docKind = kind === "objecte" ? "objecte" : "moble"
    return registerDoc({ key: `${docKind}:${projectId}`, kind: docKind, id: projectId, name, target: assistantTarget, selection: () => describeSelection.current() })
  }, [assistantTarget, kind, projectId, name, describeSelection])
}
