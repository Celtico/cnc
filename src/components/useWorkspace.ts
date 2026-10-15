import { useState } from "react"
import { usePersistentFlag } from "../lib/usePersistentFlag"
import { usePersistentNumber } from "../lib/usePersistentNumber"

/**
 * Estat de l'espai de treball d'un editor (`Workspace`): amplades i panells plegats, recordats
 * per editor (`mobles:<id>-tree-width`, …), la pestanya del mòbil i, si l'editor en té, la pestanya de la columna de la
 * dreta (Propietats o el panell extra, p. ex. l'Assistent).
 */
export function useWorkspace(id: string, defaults = { tree: 280, form: 340 }) {
  const [formWidth, setFormWidth] = usePersistentNumber(`mobles:${id}-inspector-width`, defaults.form)
  const [treeWidth, setTreeWidth] = usePersistentNumber(`mobles:${id}-tree-width`, defaults.tree)
  const [treeHidden, setTreeHidden] = usePersistentFlag(`mobles:${id}-tree-hidden`)
  const [propsHidden, setPropsHidden] = usePersistentFlag(`mobles:${id}-props-hidden`)
  const [mobilePane, setMobilePane] = useState<"tree" | "props" | "extra">("props")
  // Ordinador: què ensenya la columna de la dreta (amb un panell extra; sense, sempre les propietats).
  const [rightPane, setRightPane] = useState<"props" | "extra">("props")
  return { defaults, formWidth, setFormWidth, treeWidth, setTreeWidth, treeHidden, setTreeHidden, propsHidden, setPropsHidden, mobilePane, setMobilePane, rightPane, setRightPane }
}

export type WorkspaceState = ReturnType<typeof useWorkspace>
