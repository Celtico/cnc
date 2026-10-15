import { useEffect, useState } from "react"

/**
 * Color principal de l'app. Tot el codi fa servir la paleta `wood` (colorPalette="wood",
 * "wood.fg"...); per canviar-lo, les variables CSS de `wood` apunten a una altra paleta
 * de Chakra. És una preferència del dispositiu (com dia/nit): va a localStorage.
 */
export const ACCENTS = [
  { id: "wood", label: "Fusta", swatch: "#b57a37" },
  { id: "orange", label: "Taronja", swatch: "#ea580c" },
  { id: "red", label: "Vermell", swatch: "#dc2626" },
  { id: "green", label: "Verd", swatch: "#16a34a" },
  { id: "teal", label: "Turquesa", swatch: "#0d9488" },
  { id: "blue", label: "Blau", swatch: "#2563eb" },
  { id: "purple", label: "Lila", swatch: "#9333ea" },
  { id: "gray", label: "Gris", swatch: "#52525b" },
] as const
type AccentId = (typeof ACCENTS)[number]["id"]

const KEY = "mobles:accent"
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const EVENT = "mobles:accent-change"

function read(): AccentId {
  try {
    const v = localStorage.getItem(KEY)
    return ACCENTS.some((a) => a.id === v) ? (v as AccentId) : "wood"
  } catch {
    return "wood"
  }
}

/** Aplica el color a l'arrel del document. "wood" treu la substitució. */
function applyAccent(id: AccentId): void {
  const root = document.documentElement.style
  for (const s of SHADES) {
    if (id === "wood") root.removeProperty(`--chakra-colors-wood-${s}`)
    else root.setProperty(`--chakra-colors-wood-${s}`, `var(--chakra-colors-${id}-${s})`)
  }
}

export function useAccent(): [AccentId, (id: AccentId) => void] {
  const [accent, setAccentState] = useState<AccentId>(read)
  useEffect(() => {
    const on = () => setAccentState(read())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const setAccent = (id: AccentId) => {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* sense localStorage: només aquesta sessió */
    }
    applyAccent(id)
    setAccentState(id)
    window.dispatchEvent(new Event(EVENT))
  }
  return [accent, setAccent]
}

/** Crida-ho un cop en arrencar l'app perquè el color triat s'apliqui abans de pintar. */
export function initAccent(): void {
  applyAccent(read())
}
