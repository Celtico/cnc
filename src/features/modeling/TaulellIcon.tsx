import { chakra } from "@chakra-ui/react"
import { TAULELL_ICONS, type TaulellIconName } from "./taulellIcons"

/** Una icona del Taulell, de la mida del text (com les de `react-icons`). */
export function TaulellIcon({ name, size = "1em" }: { name: TaulellIconName; size?: string }) {
  return (
    <chakra.svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} flexShrink={0} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {TAULELL_ICONS[name].split("|").map((d) => (
        <path key={d} d={d} />
      ))}
    </chakra.svg>
  )
}
