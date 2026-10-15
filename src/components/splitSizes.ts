import type { SplitterPanelData, SplitterRootProps } from "@chakra-ui/react"

/**
 * Un panell del `PanelSplit` (el `Splitter` de Chakra): amb `width`, un panell lateral d'amplada recordada en px (el que
 * es desa, `usePersistentNumber`); sense, el panell flexible que es queda la resta (el visor, la foto, l'app).
 */
export interface SplitPanelSpec {
  id: string
  /** Amplada (px) del panell lateral. */
  width?: number
  setWidth?: (w: number) => void
  min?: number
  max?: number
  /** Plegat (amplada 0): el botó de plegar o, a l'assistent, tancat. */
  hidden?: boolean
  /** Arrossegar la vora fins a menys de la meitat del mínim (o Retorn a la vora) el plega. Sense, no es plega arrossegant. */
  onHide?: () => void
}

type PanelSize = NonNullable<SplitterRootProps["size"]>[number]

/** Les restriccions del Splitter: mínim i màxim en px; els que es poden plegar, a 0 (`collapsible`). */
export function splitterPanels(panels: SplitPanelSpec[]): SplitterPanelData[] {
  return panels.map((p) =>
    p.width === undefined
      ? { id: p.id }
      : {
          id: p.id,
          minSize: p.min !== undefined ? `${p.min}px` : undefined,
          maxSize: p.max !== undefined ? `${p.max}px` : undefined,
          // Un panell que es pot amagar es plega a 0 (`hidden`); si no hi ha `onHide`, arrossegar no el plega (`widthUpdates`).
          collapsible: p.hidden !== undefined,
          collapsedSize: 0,
          // En canviar la finestra (o obrir l'assistent), els laterals es queden amb els px i el flexible s'adapta.
          resizeBehavior: "preserve-pixel-size",
        },
  )
}

/**
 * Mida controlada del Splitter: els laterals en px (0 si són plegats) i el flexible sense mida (un forat a la llista: el
 * Splitter li dona la resta).
 */
export function splitterSizes(panels: SplitPanelSpec[]): PanelSize[] {
  const size: PanelSize[] = []
  panels.forEach((p, i) => {
    if (p.width !== undefined) size[i] = p.hidden ? 0 : `${p.width}px`
  })
  return size
}

/**
 * Del que diu el Splitter en arrossegar (percentatges de l'amplada del grup) a les amplades en px que es desen: només
 * les que han canviat. Un lateral que arriba a 0 es plega (`onHide`) i es queda amb l'amplada d'abans. Amb la vora que
 * s'arrossega (`trigger`, «esquerra:dreta»), només els seus dos panells: un altre que el Splitter hagi encongit perquè no
 * hi cabia (finestra estreta) no perd l'amplada desada.
 */
export function widthUpdates(panels: SplitPanelSpec[], size: number[], groupPx: number, trigger?: string | null): { panel: SplitPanelSpec; width: number | null }[] {
  if (groupPx <= 0) return []
  const near = trigger ? new Set(trigger.split(":")) : null
  const out: { panel: SplitPanelSpec; width: number | null }[] = []
  panels.forEach((p, i) => {
    const pct = size[i]
    if (p.width === undefined || p.hidden || pct === undefined || (near && !near.has(p.id))) return
    if (pct < 0.01) {
      if (p.onHide) out.push({ panel: p, width: null })
      return
    }
    const px = Math.round((pct / 100) * groupPx)
    if (px !== Math.round(p.width)) out.push({ panel: p, width: px })
  })
  return out
}
