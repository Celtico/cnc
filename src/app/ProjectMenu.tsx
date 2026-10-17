import { Menu } from "@chakra-ui/react"
import { LuSave } from "react-icons/lu"
import { ActionsMenu } from "../components/ActionsMenu"

/** El menú «…» de la barra del moble (o objecte) obert: desar-lo com a fitxer. */
export function ProjectMenu({ isObject, onSaveFile }: { isObject: boolean; onSaveFile: () => void }) {
  return (
    <ActionsMenu label={isObject ? "Menú de l'objecte" : "Menú del moble"} size="sm">
      <Menu.Item value="file" onClick={onSaveFile}>
        <LuSave /> Desar com a fitxer…
      </Menu.Item>
    </ActionsMenu>
  )
}
