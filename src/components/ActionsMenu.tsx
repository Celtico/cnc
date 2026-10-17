import { IconButton, Menu, Portal, type IconButtonProps, type MenuContentProps } from "@chakra-ui/react"
import { useId, type ReactNode } from "react"
import { LuEllipsis } from "react-icons/lu"
import { Tooltip } from "./ui/tooltip"

/**
 * Menú ⋯ d'accions (targetes, files de l'arbre, inspectors, barres): el botó d'icona amb el seu `Tooltip` («Accions») i el
 * menú de Chakra. El tooltip i el menú comparteixen l'id del botó (el patró de Chakra per a un tooltip en un disparador de
 * menú).
 */
export function ActionsMenu({
  label,
  tip = "Accions",
  icon,
  size = "xs",
  disabled,
  trigger,
  contentProps,
  children,
}: {
  /** `aria-label` del botó («Accions de «x»»). */
  label: string
  tip?: ReactNode
  /** Per defecte, ⋯. */
  icon?: ReactNode
  size?: IconButtonProps["size"]
  disabled?: boolean
  /** Propietats del botó (p. ex. `aria-busy`). */
  trigger?: Omit<IconButtonProps, "aria-label" | "size" | "disabled" | "children">
  contentProps?: MenuContentProps
  children: ReactNode
}) {
  const id = useId()
  return (
    <Menu.Root ids={{ trigger: id }} positioning={{ placement: "bottom-end" }}>
      <Tooltip ids={{ trigger: id }} content={tip}>
        <Menu.Trigger asChild>
          <IconButton aria-label={label} size={size} variant="ghost" disabled={disabled} {...trigger}>
            {icon ?? <LuEllipsis />}
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content {...contentProps}>{children}</Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
