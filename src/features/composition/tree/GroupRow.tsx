import { Menu } from "@chakra-ui/react"
import { LuChevronDown, LuChevronRight, LuCopy, LuTrash2, LuUngroup } from "react-icons/lu"
import { duplicateGroup, removeGroup, renameGroup } from "../../../core/model"
import { TreeRow, TreeRowMenu } from "../../../components/TreeRow"
import type { TreeCtx } from "./treeCtx"

/** La fila d'un grup (el mateix grup a Peces lliures i a Models 3D: es mou, es duplica i s'esborra sencer). */
export function GroupRow({ tree, g, open, hint }: { tree: TreeCtx; g: string; open: boolean; hint: string }) {
  const { comp, selection, onSelect, onChange, dnd, groupFlags, toggleGroup } = tree
  return (
    <TreeRow
      depth={1}
      icon={open ? <LuChevronDown /> : <LuChevronRight />}
      onToggle={() => toggleGroup(g)}
      toggleLabel={open ? `Plegar «${g}»` : `Desplegar «${g}»`}
      label={g}
      hint={hint}
      dnd={dnd.groupDnd(g)}
      flags={groupFlags(g)}
      selected={selection.kind === "group" && selection.id === g}
      onClick={() => onSelect({ kind: "group", id: g })}
      menu={
        <TreeRowMenu label={`Accions de «${g}»`}>
          <Menu.Item
            value="dup"
            onClick={() => {
              const res = duplicateGroup(comp, g)
              onChange(res.comp)
              onSelect({ kind: "group", id: res.group })
            }}
          >
            <LuCopy /> Duplicar el grup
          </Menu.Item>
          <Menu.Item value="ungroup" onClick={() => onChange(renameGroup(comp, g, undefined))}>
            <LuUngroup /> Desagrupar
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            value="del"
            color="fg.error"
            onClick={() => {
              onChange(removeGroup(comp, g))
              onSelect({ kind: "moble" })
            }}
          >
            <LuTrash2 /> Eliminar el grup
          </Menu.Item>
        </TreeRowMenu>
      }
    />
  )
}
