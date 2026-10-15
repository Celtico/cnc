import { IconButton, Menu, Portal } from "@chakra-ui/react"
import { LuEllipsis, LuSave } from "react-icons/lu"

/** El menú «…» de la barra del moble (o objecte) obert: desar-lo com a fitxer. */
export function ProjectMenu({ isObject, onSaveFile }: { isObject: boolean; onSaveFile: () => void }) {
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label={isObject ? "Menú de l'objecte" : "Menú del moble"} title={isObject ? "Menú de l'objecte" : "Menú del moble"} size="sm" variant="ghost">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="file" onClick={onSaveFile}>
              <LuSave /> Desar com a fitxer…
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
