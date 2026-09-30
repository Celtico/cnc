/**
 * Estil comú dels grups d'opcions (botons d'icona, pastilles, «Fila» del mòdul): un control
 * segmentat discret com el de Figma o macOS, no botons plens de colors. El grup té un fons suau i
 * l'opció triada es veu amb un fons clar, ombra i el color principal a la icona; no ocupa tota
 * l'amplada.
 */
export const segGroup = {
  gap: "2px",
  p: "2px",
  borderWidth: "1px",
  rounded: "md",
  bg: "bg.muted",
  w: "fit-content",
  maxW: "full",
  flexWrap: "wrap",
} as const

export function segItem(on: boolean) {
  return {
    size: "xs",
    variant: "ghost",
    minW: "32px",
    rounded: "sm",
    bg: on ? { base: "bg.panel", _dark: "gray.700" } : "transparent",
    color: on ? "wood.fg" : "fg.muted",
    boxShadow: on ? "xs" : "none",
    fontWeight: on ? "semibold" : "normal",
    _hover: { bg: on ? { base: "bg.panel", _dark: "gray.700" } : "bg.emphasized", color: on ? "wood.fg" : "fg" },
  } as const
}
