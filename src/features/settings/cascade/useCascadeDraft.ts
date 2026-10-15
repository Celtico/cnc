import { useEffect, useMemo, useState } from "react"
import { appCascade, branchIds, draftTree, parseStoredDraft, type CascadeDraft } from "../../../core/model"
import { loadCascadeDraft, saveCascadeDraft } from "../../../db/cascadeDraftStore"
import { useDebouncedSave } from "../../../lib/useDebouncedSave"
import { useHistory } from "../../history/useHistory"

/** D'entrada: les arrels obertes i la resta de branques plegades (es veuen els inspectors i les seves seccions). */
export function initialCollapsed(draft: CascadeDraft): Set<string> {
  const tree = draftTree(draft)
  const roots = new Set(tree.roots)
  return new Set(branchIds(tree).filter((id) => !roots.has(id)))
}

/** Com està el desat: tot desat, per desar (es desa sol en mig segon) o no s'ha pogut desar. */
export type DraftSaveState = "saved" | "saving" | "failed"

/**
 * L'esborrany de la cascada amb desfer/refer (`useHistory`) i les branques plegades (fora de l'historial), desats sols a
 * IndexedDB (`db.drafts`, `useDebouncedSave`): sobreviu a recarregar la pàgina. No toca res de l'Editor.
 */
export function useCascadeDraft() {
  const history = useHistory<CascadeDraft>(appCascade(), { limit: 200 })
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(appCascade()))
  const [loaded, setLoaded] = useState(false)
  const { reset } = history
  useEffect(() => {
    let live = true
    void loadCascadeDraft().then((raw) => {
      if (!live) return
      const stored = parseStoredDraft(raw)
      if (stored) {
        reset(stored.draft)
        setCollapsed(new Set(stored.collapsed))
      }
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [reset])
  const stored = useMemo(() => (loaded ? { draft: history.value, collapsed: [...collapsed] } : null), [loaded, history.value, collapsed])
  const [saved, setSaved] = useState<{ value: unknown; ok: boolean } | null>(null)
  useDebouncedSave(stored, (v) => {
    if (!v) return undefined
    return saveCascadeDraft(v).then((ok) => {
      setSaved({ value: v, ok })
      return ok
    })
  }, 500)
  // Acabat de carregar, el que hi ha és el desat (o la llavor de l'app, que no cal desar).
  const save: DraftSaveState = !stored || saved === null ? "saved" : saved.value === stored ? (saved.ok ? "saved" : "failed") : "saving"
  return { history, collapsed, setCollapsed, loaded, save }
}
