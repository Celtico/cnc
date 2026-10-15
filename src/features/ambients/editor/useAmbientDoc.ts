import { useCallback, useEffect, useMemo, useRef } from "react"
import { keepLocked, mergeHidden, type Ambient, type Composition } from "../../../core/model"
import { updateProjectComposition } from "../../../db/compositionStore"
import { updateAmbient } from "../../../db/db"
import { useDebouncedSave } from "../../../lib/useDebouncedSave"
import { useLatest } from "../../../lib/useLatest"
import { useHistory } from "../../history/useHistory"

/** L'ambient obert: desfer/refer (amb els mobles enllaçats), el desat i els canvis (cadenats i elements amagats). */
export function useAmbientDoc(ambientId: number, initial: Ambient) {
  // Ambient amb desfer/refer (`useHistory`, fins a 100 passos; la càmera es desa a part, fora del desfer).
  // Les mides generals d'un moble o objecte enllaçat també són un pas (per decisió de l'usuari: ⌘Z ho ha de desfer tot):
  // l'historial porta, a més de l'ambient, la composició de cada moble que s'hi ha canviat (`linked`).
  const history = useHistory<{ amb: Ambient; linked?: Record<number, Composition> }>({ amb: initial }, { limit: 100 })
  const { set: setDoc } = history
  const amb = history.value.amb
  const setAmb = useCallback((next: Ambient, opts?: { commit?: boolean }) => setDoc((h) => ({ ...h, amb: next }), opts), [setDoc])
  // La composició d'abans del primer canvi de cada moble (desfer fins al principi hi torna) i la que hi ha ara desada.
  const linkedOrig = useRef(new Map<number, Composition>())
  const linkedSaved = useRef(new Map<number, Composition>())
  const resizeLinked = useCallback((id: number, before: Composition, next: Composition) => {
    if (!linkedOrig.current.has(id)) linkedOrig.current.set(id, before)
    setDoc((h) => ({ ...h, linked: { ...h.linked, [id]: next } }))
  }, [setDoc])
  const linked = history.value.linked
  useEffect(() => {
    // Desfer o refer: cada moble tocat, a la composició del pas (o a la d'abans de tocar-lo).
    for (const [id, orig] of linkedOrig.current) {
      const want = linked?.[id] ?? orig
      if (linkedSaved.current.get(id) === want) continue
      linkedSaved.current.set(id, want)
      void updateProjectComposition(id, want)
    }
  }, [linked])

  // Desar (esperant una mica mentre s'arrossega; el que queda pendent, en sortir). Obrir-lo no el desa.
  useDebouncedSave(amb, (a) => void updateAmbient(ambientId, { data: a }))

  // L'ambient d'ara, per als callbacks (que no es tornen a crear a cada canvi).
  const ambRef = useLatest(amb)
  // Canvi de l'ambient: `commit` = un pas de desfer (en deixar anar); si no, en viu (arrossegant).
  // El cadenat de l'arbre: els elements i les parets bloquejats no es mouen, vingui d'on vingui el canvi.
  const change = useCallback(
    (next: Ambient, commit: boolean) => {
      const prev = ambRef.current
      setAmb({ ...next, items: keepLocked(prev.items, next.items, ["x", "y", "rot", "elevation"]), walls: keepLocked(prev.walls, next.walls, ["a", "b"]) }, { commit })
    },
    [setAmb, ambRef],
  )

  // L'ull: el plànol i el 3D només veuen el que no està amagat; el que hi canvien es torna a ajuntar amb els amagats.
  const shownAmb = useMemo(() => (amb.items.some((it) => it.hidden) || amb.walls.some((w) => w.hidden) ? { ...amb, items: amb.items.filter((it) => !it.hidden), walls: amb.walls.filter((w) => !w.hidden) } : amb), [amb])
  const changeShown = useCallback(
    (next: Ambient, commit: boolean) => {
      const all = ambRef.current
      change({ ...next, items: mergeHidden(all.items, all.items.filter((it) => !it.hidden), next.items), walls: mergeHidden(all.walls, all.walls.filter((w) => !w.hidden), next.walls) }, commit)
    },
    [change, ambRef],
  )

  return { history, amb, setAmb, ambRef, change, resizeLinked, shownAmb, changeShown }
}
