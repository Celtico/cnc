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
      ? // El flexible (el visor): amb `min`, no es fa més estret; si no hi cap, s'encongeixen els laterals.
        { id: p.id, minSize: p.min !== undefined ? `${p.min}px` : undefined }
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
 * Splitter li dona la resta). Amb l'amplada del grup (`groupPx`): si els laterals no hi caben deixant el mínim del
 * flexible (el visor), s'encongeixen tots en proporció fins al seu mínim, com abans (sense desar-ho: l'amplada desada
 * torna quan la finestra es fa gran).
 */
export function splitterSizes(panels: SplitPanelSpec[], groupPx = 0): PanelSize[] {
  // L'amplada desada, dins del mínim i el màxim d'ara (un valor d'abans pot quedar-ne fora).
  const clamp = (p: SplitPanelSpec) => Math.min(p.max ?? Infinity, Math.max(p.min ?? 0, p.width ?? 0))
  const sides = panels.map((p) => (p.width === undefined || p.hidden ? 0 : clamp(p)))
  const flexMin = panels.reduce((a, p) => a + (p.width === undefined ? (p.min ?? 0) : 0), 0)
  const total = sides.reduce((a, b) => a + b, 0)
  const room = groupPx - flexMin
  const scale = groupPx > 0 && total > room ? Math.max(0, room) / total : 1
  const size: PanelSize[] = []
  panels.forEach((p, i) => {
    if (p.width === undefined) return
    if (p.hidden) size[i] = 0
    else size[i] = `${Math.round(scale < 1 ? Math.max(p.min ?? 0, sides[i]! * scale) : sides[i]!)}px`
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
  // Només el que fa l'usuari (arrossegar o el teclat a una vora): un canvi de finestra no es desa.
  if (groupPx <= 0 || !trigger) return []
  const near = new Set(trigger.split(":"))
  const out: { panel: SplitPanelSpec; width: number | null }[] = []
  panels.forEach((p, i) => {
    const pct = size[i]
    if (p.width === undefined || p.hidden || pct === undefined || !near.has(p.id)) return
    if (pct < 0.01) {
      if (p.onHide) out.push({ panel: p, width: null })
      return
    }
    const px = Math.round((pct / 100) * groupPx)
    if (px !== Math.round(p.width)) out.push({ panel: p, width: px })
  })
  return out
}
