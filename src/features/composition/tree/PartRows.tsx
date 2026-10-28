import { Box, Menu } from "@chakra-ui/react"
import { LuCopy, LuGroup, LuScissors, LuTrash2, LuUngroup } from "react-icons/lu"
import { groupNames, insertPartCopy, newGroupName, removePartFromGroup, ungroupMulti } from "../../../core/model"
import { hoverKey } from "../../../components/hoverLink"
import { TreeRow, TreeRowMenu } from "../../../components/TreeRow"
import { ORIENT_ICON } from "../partOrient"
import { GroupRow } from "./GroupRow"
import { UngroupDropZone } from "./UngroupDropZone"
import type { TreeCtx } from "./treeCtx"

/** Les files de les peces lliures (soltes o en grups plegables) i, arrossegant-ne una d'un grup, la zona per treure-la'n (a sota del grup). */
export function PartRows({ tree }: { tree: TreeCtx }) {
  const { comp, selection, onSelect, onChange, dnd, flagsOf, inMultiSel, openGroups, openGroup } = tree
  const { drag } = dnd
  const parts = comp.parts ?? []
  const setPartGroup = (id: string, group: string | undefined) => {
    onChange({ ...comp, parts: parts.map((q) => (q.id === id ? { ...q, group } : q)) })
    if (group) openGroup(group)
  }
  const removePart = (id: string) => {
    onChange({ ...comp, parts: parts.filter((r) => r.id !== id) })
    if (selection.kind === "part" && selection.id === id) onSelect({ kind: "moble" })
  }

  return (
    <>
      {(() => {
        const seen = new Set<string>()
        const partRow = (r: (typeof parts)[number], depth: number) => {
          const Icon = r.effect === "cut" ? LuScissors : ORIENT_ICON[r.orient]
          const groups = groupNames(comp).filter((g) => g !== r.group)
          return (
            <TreeRow
              key={r.id}
              depth={depth}
              icon={<Icon />}
              label={r.name.trim() || "Peça"}
              hint={`${Math.round(r.w)} × ${Math.round(r.h)}`}
              selected={(selection.kind === "part" && selection.id === r.id) || inMultiSel("part", r.id)}
              onClick={() => onSelect({ kind: "part", id: r.id })}
              hoverKey={hoverKey("part", r.id)}
              dnd={dnd.dnd("part", r.id)}
              flags={flagsOf("parts", r)}
              menu={
                <TreeRowMenu label={`Accions de «${r.name}»`}>
                  <Menu.Item
                    value="dup"
                    onClick={() => {
                      const res = insertPartCopy(comp, r)
                      onChange(res.comp)
                      onSelect({ kind: "part", id: res.id })
                    }}
                  >
                    <LuCopy /> Duplicar
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="group-new" onClick={() => setPartGroup(r.id, newGroupName(comp))}>
                    <LuGroup /> Agrupar en un grup nou
                  </Menu.Item>
                  {groups.map((g) => (
                    <Menu.Item key={g} value={`group-${g}`} onClick={() => setPartGroup(r.id, g)}>
                      <LuGroup /> Posar a «{g}»
                    </Menu.Item>
                  ))}
                  {r.group && (
                    <Menu.Item value="ungroup" onClick={() => setPartGroup(r.id, undefined)}>
                      <LuUngroup /> Treure del grup
                    </Menu.Item>
                  )}
                  <Menu.Separator />
                  <Menu.Item value="del" color="fg.error" onClick={() => removePart(r.id)}>
                    <LuTrash2 /> Eliminar
                  </Menu.Item>
                </TreeRowMenu>
              }
            />
          )
        }
        return parts.map((r) => {
          if (!r.group) return partRow(r, 1)
          if (seen.has(r.group)) return null
          const g = r.group
          seen.add(g)
          const members = parts.filter((q) => q.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`g:${g}`}>
              <GroupRow tree={tree} g={g} open={open} hint={`${members.length} ${members.length === 1 ? "peça" : "peces"}`} />
              {open && members.map((q) => partRow(q, 2))}
              {/* Arrossegant una peça d'aquest grup: zona per treure-la'n (queda solta), just a sota. */}
              {drag?.kind === "part" && dnd.dragGroup === g && (
                <UngroupDropZone {...dnd.ungroupZone(() => (drag.multi ? ungroupMulti(comp, drag.multi) : removePartFromGroup(comp, drag.id)))}>
                  <LuUngroup /> Deixa-la aquí per treure-la del grup
                </UngroupDropZone>
              )}
            </Box>
          )
        })
      })()}
    </>
  )
}
