import { Box, Menu, Stack, Text } from "@chakra-ui/react"
import { LuCopy, LuFileUp, LuFolderOpen, LuGroup, LuSprout, LuTrash2, LuUngroup } from "react-icons/lu"
import { groupNames, insertModelCopy, newGroupName, setModelGroup, ungroupMulti } from "../../../core/model"
import { TreeRow, TreeRowMenu, TreeSection } from "../../../components/TreeRow"
import { MODEL_FORMAT_HELP } from "../addElements"
import { GroupRow } from "./GroupRow"
import { UngroupDropZone } from "./UngroupDropZone"
import type { TreeCtx } from "./treeCtx"

/**
 * «Models 3D»: el títol amb el + (importar: `onPick`, `uploading`), les files (`show`; soltes o en grups) i, arrossegant-ne
 * un d'un grup, la zona per treure'l. `isObject`: només els objectes n'importen i dupliquen.
 */
export function ModelSection({ tree, show, isObject, uploading, onPick }: { tree: TreeCtx; show: boolean; isObject: boolean; uploading: boolean; onPick: (what: "files" | "folder") => void }) {
  const { comp, selection, onSelect, onChange, dnd, flagsOf, inMultiSel, openGroups, openGroup } = tree
  const { drag } = dnd
  const models = comp.models ?? []
  const removeModel = (id: string) => {
    onChange({ ...comp, models: models.filter((g) => g.id !== id) })
    if (selection.kind === "model" && selection.id === id) onSelect({ kind: "moble" })
  }

  return (
    <>
      {show && (
      <TreeSection
        addLabel="Importar un model 3D"
        hideAdd={!isObject}
        busy={uploading}
        menu={
          <>
            {/* Quin fitxer cal (per decisió de l'usuari: format, extensió, mida…), abans de triar-lo. */}
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Quin fitxer?</Menu.ItemGroupLabel>
              <Stack gap={1.5} px={2} pb={2} fontSize="xs" color="fg.muted" lineHeight="1.4">
                {MODEL_FORMAT_HELP.map(([k, v]) => (
                  <Text key={k}>
                    <Text as="span" fontWeight="semibold" color="fg">
                      {k}:
                    </Text>{" "}
                    {v}
                  </Text>
                ))}
              </Stack>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.Item value="upload" onClick={() => onPick("files")}>
              <LuFileUp /> Triar fitxers…
            </Menu.Item>
            <Menu.Item value="folder" onClick={() => onPick("folder")}>
              <LuFolderOpen /> Triar carpeta…
            </Menu.Item>
          </>
        }
      >
        Models 3D
      </TreeSection>
      )}
      {show && (() => {
        const seen = new Set<string>()
        const modelRow = (g: (typeof models)[number], depth: number) => (
          <TreeRow
            key={g.id}
            depth={depth}
            icon={<LuSprout />}
            label={g.name.trim() || "Model"}
            hint={`${Math.round(g.w)} × ${Math.round(g.h)}`}
            selected={(selection.kind === "model" && selection.id === g.id) || inMultiSel("model", g.id)}
            onClick={() => onSelect({ kind: "model", id: g.id })}
            flags={flagsOf("models", g)}
            dnd={dnd.dnd("model", g.id)}
            menu={
              <TreeRowMenu label={`Accions de «${g.name}»`}>
                {isObject && (
                  <Menu.Item
                    value="dup"
                    onClick={() => {
                      const res = insertModelCopy(comp, g)
                      onChange(res.comp)
                      onSelect({ kind: "model", id: res.id })
                    }}
                  >
                    <LuCopy /> Duplicar
                  </Menu.Item>
                )}
                <Menu.Separator />
                <Menu.Item value="group-new" onClick={() => {
                  const name = newGroupName(comp)
                  onChange(setModelGroup(comp, g.id, name))
                  openGroup(name)
                }}>
                  <LuGroup /> Agrupar en un grup nou
                </Menu.Item>
                {groupNames(comp).filter((n) => n !== g.group).map((n) => (
                  <Menu.Item key={n} value={`group-${n}`} onClick={() => onChange(setModelGroup(comp, g.id, n))}>
                    <LuGroup /> Posar a «{n}»
                  </Menu.Item>
                ))}
                {g.group && (
                  <Menu.Item value="ungroup" onClick={() => onChange(setModelGroup(comp, g.id, undefined))}>
                    <LuUngroup /> Treure del grup
                  </Menu.Item>
                )}
                <Menu.Separator />
                <Menu.Item value="del" color="fg.error" onClick={() => removeModel(g.id)}>
                  <LuTrash2 /> Eliminar
                </Menu.Item>
              </TreeRowMenu>
            }
          />
        )
        return models.map((m) => {
          if (!m.group) return modelRow(m, 1)
          if (seen.has(m.group)) return null
          const g = m.group
          seen.add(g)
          const members = models.filter((q) => q.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`mg:${g}`}>
              <GroupRow tree={tree} g={g} open={open} hint={`${members.length} ${members.length === 1 ? "model" : "models"}`} />
              {open && members.map((q) => modelRow(q, 2))}
              {/* Arrossegant un model d'aquest grup: zona per treure'l (queda solt), just a sota. */}
              {drag?.kind === "model" && dnd.dragGroup === g && (
                <UngroupDropZone {...dnd.ungroupZone(() => (drag.multi ? ungroupMulti(comp, drag.multi) : setModelGroup(comp, drag.id, undefined)))}>
                  <LuUngroup /> Deixa'l aquí per treure'l del grup
                </UngroupDropZone>
              )}
            </Box>
          )
        })
      })()}
    </>
  )
}
