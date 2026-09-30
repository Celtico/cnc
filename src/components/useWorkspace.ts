import { useState } from "react"
import { usePersistentFlag } from "../features/usePersistentFlag"
import { usePersistentNumber } from "../features/usePersistentNumber"

/**
 * Estat de l'espai de treball d'un editor (`Workspace`): amplades i panells plegats, recordats
 * per editor (`mobles:<id>-tree-width`, …), i la pestanya del mòbil.
 */
export function useWorkspace(id: string, defaults = { tree: 280, form: 340 }) {
  const [formWidth, setFormWidth] = usePersistentNumber(`mobles:${id}-inspector-width`, defaults.form)
  const [treeWidth, setTreeWidth] = usePersistentNumber(`mobles:${id}-tree-width`, defaults.tree)
  const [treeHidden, setTreeHidden] = usePersistentFlag(`mobles:${id}-tree-hidden`)
  const [propsHidden, setPropsHidden] = usePersistentFlag(`mobles:${id}-props-hidden`)
  const [mobilePane, setMobilePane] = useState<"tree" | "props">("props")
  return { defaults, formWidth, setFormWidth, treeWidth, setTreeWidth, treeHidden, setTreeHidden, propsHidden, setPropsHidden, mobilePane, setMobilePane }
}

export type WorkspaceState = ReturnType<typeof useWorkspace>
