import { useState, type Dispatch, type SetStateAction } from "react"
import { toaster } from "../../../components/ui/toaster"
import { renamePresentationMaterial } from "../../../components/viewer/presentationScene"
import { SettingsSchema, removeMaterialFromSettings, renameMaterialInSettings, type HardwareItem, type MaterialPref, type Settings } from "../../../core/model"
import { replaceHardwareEverywhere } from "../../../db/hardwareRefs"
import { renameMaterialEverywhere, type RenameCount } from "../../../db/materialRefs"

/** Canviar el nom o eliminar un material: els mobles, objectes i ambients desats el segueixen. */
export function useMaterialActions(draft: Settings, setDraft: Dispatch<SetStateAction<Settings>>, save: (s: Settings) => Promise<void>) {
  // Noms de material canviats (canviar el nom, eliminar amb substitut, importar un fitxer antic): els mobles, objectes i
  // ambients desats el segueixen en una transacció, amb les preferències noves (si són vàlides).
  const cascade = (renames: [string, string][], next: Settings): Promise<RenameCount> => {
    for (const [from, to] of renames) renamePresentationMaterial(from, to)
    const valid = SettingsSchema.safeParse(next)
    return renameMaterialEverywhere(renames, valid.success ? () => save(valid.data) : undefined)
  }
  const counted = (c: RenameCount) => `${c.projects} ${c.projects === 1 ? "moble" : "mobles"} i ${c.ambients} ${c.ambients === 1 ? "ambient" : "ambients"} actualitzats`
  const renameMaterial = (from: string, to: string) => {
    const next = renameMaterialInSettings(draft, from, to)
    setDraft(next)
    void cascade([[from, to]], next).then((c) => toaster.create({ title: `Nom canviat: ${counted(c)}`, type: "success" }))
  }
  const [deleting, setDeleting] = useState<MaterialPref | null>(null)
  const confirmDelete = (replacement: string | null) => {
    const m = deleting
    setDeleting(null)
    if (!m) return
    const next = removeMaterialFromSettings(draft, m.name, replacement)
    setDraft(next)
    if (replacement) void cascade([[m.name, replacement]], next).then((c) => toaster.create({ title: `«${m.name}» eliminat`, description: `Passen a «${replacement}»: ${counted(c)}.`, type: "success" }))
    else toaster.create({ title: `«${m.name}» eliminat`, type: "info" })
  }
  return { cascade, renameMaterial, deleting, setDeleting, confirmDelete }
}

/** Eliminar un ferratge o canviar-ne la confirmació: els mobles desats amb la còpia d'abans passen al nou. */
export function useHardwareActions(draft: Settings, setDraft: Dispatch<SetStateAction<Settings>>, save: (s: Settings) => Promise<void>) {
  // Eliminar un ferratge: si es fa servir, amb substitut (el per defecte i les còpies dels mobles desats hi passen).
  const [deletingHw, setDeletingHw] = useState<HardwareItem | null>(null)
  const confirmDeleteHw = (replacement: string | null) => {
    const it = deletingHw
    setDeletingHw(null)
    if (!it) return
    const hardwareLibrary = draft.hardwareLibrary.filter((x) => x.id !== it.id)
    const to = replacement ? hardwareLibrary.find((x) => x.id === replacement) : undefined
    const hardwareDefaults = Object.fromEntries(Object.entries(draft.hardwareDefaults).map(([k, v]) => [k, v === it.id && to ? to.id : v])) as Settings["hardwareDefaults"]
    const next = { ...draft, hardwareLibrary, hardwareDefaults }
    setDraft(next)
    if (!to) {
      toaster.create({ title: `«${it.name}» eliminat`, type: "info" })
      return
    }
    const valid = SettingsSchema.safeParse(next)
    void replaceHardwareEverywhere(it, to, valid.success ? () => save(valid.data) : undefined).then((n) =>
      toaster.create({ title: `«${it.name}» eliminat`, description: `Passen a «${to.name}»: ${n} ${n === 1 ? "moble actualitzat" : "mobles actualitzats"}.`, type: "success" }),
    )
  }

  // Un ferratge importat confirmat (o desconfirmat): els mobles desats amb la còpia d'abans passen a la nova.
  const confirmedHw = (before: HardwareItem, after: HardwareItem, hardwareLibrary: HardwareItem[]) => {
    const valid = SettingsSchema.safeParse({ ...draft, hardwareLibrary })
    void replaceHardwareEverywhere(before, after, valid.success ? () => save(valid.data) : undefined).then((n) => {
      if (n) toaster.create({ title: `«${after.name}» ${after.imported?.confirmed ? "confirmat" : "sense confirmar"}`, description: `${n} ${n === 1 ? "moble actualitzat" : "mobles actualitzats"}.`, type: "info" })
    })
  }
  return { deletingHw, setDeletingHw, confirmDeleteHw, confirmedHw }
}
