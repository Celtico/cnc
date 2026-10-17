import { Menu } from "@chakra-ui/react"
import { LuCopy, LuFolderInput, LuSave, LuTrash2 } from "react-icons/lu"
import { ActionsMenu } from "../../components/ActionsMenu"

/**
 * Menú ⋯ d'una targeta de document (Mobles, Objectes, Ambients): el mateix text, icones i ordre a totes les galeries.
 * Només surten les accions que es passen.
 */
export function CardMenu({ name, onSaveFile, onDuplicate, duplicateLabel = "Duplicar", onMove, onDelete }: { name: string; onSaveFile?: () => void; onDuplicate?: () => void; /** P. ex. «Duplicar (per a un client)…» als ambients. */ duplicateLabel?: string; onMove?: () => void; onDelete?: () => void }) {
  return (
    <ActionsMenu label={`Accions de «${name}»`}>
      {onSaveFile && (
        <Menu.Item value="file" onClick={onSaveFile}>
          <LuSave /> Desar com a fitxer…
        </Menu.Item>
      )}
      {onDuplicate && (
        <Menu.Item value="dup" onClick={onDuplicate}>
          <LuCopy /> {duplicateLabel}
        </Menu.Item>
      )}
      {onMove && (
        <Menu.Item value="move" onClick={onMove}>
          <LuFolderInput /> Moure a un grup…
        </Menu.Item>
      )}
      {onDelete && (
        <>
          <Menu.Separator />
          <Menu.Item value="del" color="fg.error" onClick={onDelete}>
            <LuTrash2 /> Esborrar
          </Menu.Item>
        </>
      )}
    </ActionsMenu>
  )
}
