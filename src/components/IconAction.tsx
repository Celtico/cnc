import { IconButton, type IconButtonProps } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { Tooltip } from "./ui/tooltip"

/**
 * Botó d'icona amb el seu `Tooltip` (la regla de l'app: tot `IconButton` porta `aria-label` en català i `Tooltip`).
 * `label` fa d'`aria-label` i, si no hi ha `tip`, de text del tooltip.
 */
export function IconAction({ label, tip, children, ...rest }: Omit<IconButtonProps, "aria-label"> & { label: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <Tooltip content={tip ?? label}>
      <IconButton aria-label={label} {...rest}>
        {children}
      </IconButton>
    </Tooltip>
  )
}
