import { useMemo, useState } from "react"
import { SettingsSchema, type Settings } from "../../../core/model"
import { useDebouncedSave } from "../../../lib/useDebouncedSave"

export type SectionKey = keyof Omit<Settings, "version">

/** Missatge en català d'un problema de validació. */
function issueText(issue: { path: PropertyKey[]; code: string; message: string; minimum?: unknown; maximum?: unknown }): string {
  const path = issue.path.map(String).join(" › ")
  if (issue.code === "too_small" && typeof issue.minimum === "number") return `${path}: mínim ${issue.minimum}`
  if (issue.code === "too_big" && typeof issue.maximum === "number") return `${path}: màxim ${issue.maximum}`
  if (issue.code === "invalid_type") return `${path}: cal un valor`
  return `${path}: ${issue.message}`
}

/** Les preferències en edició: l'esborrany, si és vàlid (i què falla) i el desat amb retard. */
export function useSettingsDraft(initial: Settings, save: (s: Settings) => Promise<void>) {
  const [draft, setDraft] = useState<Settings>(initial)
  const validation = useMemo(() => SettingsSchema.safeParse(draft), [draft])
  const problems = validation.success ? [] : validation.error.issues.map(issueText)

  // Desa amb retard, només si és vàlid (també el que queda pendent en sortir de Preferències).
  useDebouncedSave(
    draft,
    (d) => {
      const r = SettingsSchema.safeParse(d)
      return r.success ? save(r.data) : undefined
    },
    400,
  )

  const set = <K extends SectionKey>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  return { draft, setDraft, validation, problems, set }
}
