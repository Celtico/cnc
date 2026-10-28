import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Element sota el ratolí, compartit entre l'arbre i el 3D (com Figma, per decisió de l'usuari, 2026-10-28): passar per
 * sobre d'un element al 3D en marca la fila a l'arbre, i passar per sobre d'una fila en dibuixa el contorn al 3D. La
 * selecció ja és una de sola (l'arbre, el 3D i l'alçat fan servir la mateixa); això n'és el «passar per sobre».
 *
 * Clau: `tipus:id` (`hoverKey`), la mateixa a totes dues bandes. Una pantalla la comparteix amb `HoverLinkProvider`;
 * sense, cada visor o arbre té la seva (no es lliguen).
 */
export interface HoverLink {
  hover: string | null
  /** El ratolí entra a l'element `key`. */
  enter: (key: string) => void
  /** El ratolí en surt (només esborra si encara era aquest: entrar a un altre pot arribar abans de sortir de l'anterior). */
  leave: (key: string) => void
}

export const HoverLinkContext = createContext<HoverLink | null>(null)

export function useHoverLinkState(): HoverLink {
  const [hover, setHover] = useState<string | null>(null)
  const enter = useCallback((key: string) => setHover(key), [])
  const leave = useCallback((key: string) => setHover((h) => (h === key ? null : h)), [])
  return useMemo(() => ({ hover, enter, leave }), [hover, enter, leave])
}

/** El de la pantalla, o un de propi si la pantalla no en comparteix cap. */
export function useHoverLink(): HoverLink {
  const own = useHoverLinkState()
  return useContext(HoverLinkContext) ?? own
}

export function hoverKey(kind: string, id: string): string {
  return `${kind}:${id}`
}

/** Un compartiment: el mòdul i la zona (els ids de zona només són únics dins del mòdul). */
export function zoneHoverKey(moduleId: string, zoneId: string): string {
  return hoverKey("zone", `${moduleId}/${zoneId}`)
}

/** El tipus i l'id d'una clau (`hoverKey`). */
export function hoverTarget(key: string | null): { kind: string; id: string } | null {
  const i = key?.indexOf(":") ?? -1
  return key && i > 0 ? { kind: key.slice(0, i), id: key.slice(i + 1) } : null
}
