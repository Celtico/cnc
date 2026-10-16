import { useState } from "react"

/**
 * Com un acordió: només un mòdul desplegat alhora. En desplegar-ne un es pleguen els altres; en seleccionar un mòdul (o
 * un compartiment seu) es desplega ell sol. La fletxa plega o desplega sense canviar la selecció.
 */
export function useModuleAccordion(selModuleId: string | null) {
  const [openId, setOpenId] = useState<string | null>(selModuleId)
  const [lastSel, setLastSel] = useState(selModuleId)
  if (selModuleId !== lastSel) {
    setLastSel(selModuleId)
    if (selModuleId) setOpenId(selModuleId)
  }
  const toggle = (id: string) => setOpenId((o) => (o === id ? null : id))
  return { openId, toggle }
}

/**
 * Grups: plegats; en seleccionar un element d'un grup (`selKey` canvia), el seu grup (`selGroup`) s'obre sol. Plegar-lo
 * després, amb l'element encara triat, el deixa plegat.
 */
export function useOpenGroups(selGroup: string | undefined, selKey: string) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(selGroup ? [selGroup] : []))
  const [lastKey, setLastKey] = useState(selKey)
  if (selKey !== lastKey) {
    setLastKey(selKey)
    if (selGroup && !openGroups.has(selGroup)) setOpenGroups(new Set([...openGroups, selGroup]))
  }
  const toggleGroup = (g: string) => setOpenGroups((o) => {
    const n = new Set(o)
    if (n.has(g)) n.delete(g)
    else n.add(g)
    return n
  })
  /** Desplega un grup (en posar-hi un element). */
  const openGroup = (g: string) => setOpenGroups((o) => new Set([...o, g]))
  return { openGroups, toggleGroup, openGroup }
}
