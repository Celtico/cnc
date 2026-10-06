/** Símbol de la tecla de drecera: ⌘ al Mac/iPad, Ctrl+ a la resta (tooltips i ajudes: `${MOD}Z`). */
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl+"
