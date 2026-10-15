import { Box, HStack, Menu, Stack } from "@chakra-ui/react"
import { LuBox, LuChevronDown, LuChevronRight, LuCopy, LuExternalLink, LuGroup, LuHouse, LuSofa, LuTrash2, LuTriangleAlert, LuUngroup } from "react-icons/lu"
import { useSessionList } from "../../../components/sessionState"
import { TreeRow, TreeRowMenu, TreeSection } from "../../../components/TreeRow"
import { duplicateItems, groupIds, newItemGroupName, removeItems, setItemGroup, type Ambient, type AmbientItem } from "../../../core/model"
import type { Project } from "../../../db/db"
import { isEmptyGeometry, type ItemGeometry } from "../ambientData"
import type { Tool } from "../planGeom"
import { isObjItem, kindOf } from "./itemKind"
import { groupFlags, itemFlags } from "./treeFlags"
import type { AmbientSelection } from "./useAmbientSelection"
import { useTreeDnd } from "./useTreeDnd"
import { WallTreeSection } from "./WallTreeSection"

type ListRow = { kind: "group"; name: string; items: AmbientItem[] } | { kind: "item"; item: AmbientItem }

/**
 * Com l'Estructura de l'editor (mateixes files, `TreeRow`): l'ambient a dalt (el selecciona), les parets en un grup
 * plegable i dos apartats, Mobles i Objectes, amb el + i els seus elements i grups.
 */
export function AmbientTree({
  ambientId,
  name,
  amb,
  change,
  selection,
  geos,
  names,
  projects,
  groups,
  totalWallLength,
  setTool,
  onSelectAmbient,
  onAddMoble,
  onAddObject,
  onOpenProject,
}: {
  ambientId: number
  name: string
  amb: Ambient
  change: (next: Ambient, commit: boolean) => void
  selection: AmbientSelection
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  projects: Project[] | undefined
  groups: string[]
  totalWallLength: number
  setTool: (t: Tool) => void
  onSelectAmbient: () => void
  onAddMoble: () => void
  onAddObject: () => void
  onOpenProject: (id: number) => void
}) {
  const { sel, setSel, select, groupSel, ambientSel, treeClick } = selection
  // Arbre: dos apartats, **Mobles** i **Objectes** (com «Peces lliures» i «Models 3D» de l'editor), cadascun amb els seus
  // elements i els grups (en l'ordre del primer element) amb els seus a dins. Un grup amb mobles i objectes surt als dos
  // apartats, a cadascun amb els seus; triar-lo tria tot el grup. Els blocs d'abans van amb els objectes; un moble que ja no
  // hi és, amb els mobles.
  // Els grups plegats de l'arbre, recordats per ambient durant la sessió (per decisió de l'usuari: en sortir i tornar
  // a entrar, es queden com eren).
  const [folded, setFolded] = useSessionList(`mobles:ambient-folded:${ambientId}`)
  const rowsOf = (list: AmbientItem[]): ListRow[] => {
    const out: ListRow[] = []
    for (const it of list) {
      if (!it.group) out.push({ kind: "item", item: it })
      else if (!out.some((r) => r.kind === "group" && r.name === it.group)) out.push({ kind: "group", name: it.group, items: list.filter((x) => x.group === it.group) })
    }
    return out
  }
  // L'ordre de l'arbre de l'apartat d'un element (Mobles o Objectes; els grups, on surt el primer dels seus).
  const sectionOrder = (it: AmbientItem): string[] => {
    const obj = kindOf(it, projects) === "object"
    return rowsOf(amb.items.filter((x) => (kindOf(x, projects) === "object") === obj)).flatMap((r) => (r.kind === "item" ? [r.item.id] : r.items.map((x) => x.id)))
  }
  const objectItems = amb.items.filter((it) => kindOf(it, projects) === "object")
  const mobleItems = amb.items.filter((it) => kindOf(it, projects) !== "object")
  const { drag, over, setOver, endDrag, itemDnd, groupDnd, dragOutOfGroup } = useTreeDnd(amb, change)
  const itemRow = (it: AmbientItem, depth: number) => {
    const g = geos.get(it.id)
    const missing = kindOf(it, projects) === "missing"
    const label = names.get(it.id) ?? ""
    return (
      <TreeRow
        key={it.id}
        depth={depth}
        icon={missing ? <LuTriangleAlert /> : isObjItem(it, projects) ? <LuSofa /> : <LuBox />}
        iconColor={missing ? "fg.error" : isObjItem(it, projects) ? "fg.muted" : "wood.fg"}
        label={label}
        hint={isEmptyGeometry(g) ? "Buit" : g ? `${Math.round(g.w)} × ${Math.round(g.d)}` : undefined}
        selected={(sel?.kind === "item" && sel.id === it.id) || (sel?.kind === "multi" && sel.ids.includes(it.id))}
        highlighted={sel?.kind === "group" && sel.id === it.group}
        onClick={() => (treeClick(it.id, sectionOrder(it)), setTool("select"))}
        flags={itemFlags(amb, change, it)}
        dnd={itemDnd(it)}
        menu={
          <TreeRowMenu label={`Accions de «${label}»`}>
            <Menu.Item value="dup" onClick={() => {
              const d = duplicateItems(amb, [it.id])
              change(d.ambient, true)
              select({ kind: "item", id: d.ids[0]! })
            }}>
              <LuCopy /> Duplicar
            </Menu.Item>
            <Menu.Item value="new-group" onClick={() => {
              const name = newItemGroupName(amb)
              change(setItemGroup(amb, [it.id], name), true)
              groupSel(name)
            }}>
              <LuGroup /> Grup nou
            </Menu.Item>
            {groups.filter((gname) => gname !== it.group).map((gname) => (
              <Menu.Item key={gname} value={`to:${gname}`} onClick={() => change(setItemGroup(amb, [it.id], gname), true)}>
                <LuGroup /> Posar a «{gname}»
              </Menu.Item>
            ))}
            {it.group && (
              <Menu.Item value="out" onClick={() => change(setItemGroup(amb, [it.id], undefined), true)}>
                <LuUngroup /> Treure del grup
              </Menu.Item>
            )}
            {it.kind === "moble" && projects?.some((p) => p.id === it.projectId) && (
              <Menu.Item value="open" onClick={() => onOpenProject(it.projectId)}>
                <LuExternalLink /> Obrir a l'editor
              </Menu.Item>
            )}
            <Menu.Separator />
            <Menu.Item value="del" color="fg.error" onClick={() => {
              change(removeItems(amb, [it.id]), true)
              if (sel?.kind === "item" && sel.id === it.id) setSel(null)
            }}>
              <LuTrash2 /> Treure de l'ambient
            </Menu.Item>
          </TreeRowMenu>
        }
      />
    )
  }

  /** Fila de l'arbre: un element o un grup (plegable, amb els seus elements de l'apartat `section` a dins). */
  const listRow = (r: ListRow, section: "moble" | "object") => {
    if (r.kind === "item") return itemRow(r.item, 1)
    const fold = `${section}:${r.name}`
    const open = !folded.includes(fold)
    return (
      <Box key={`g:${section}:${r.name}`}>
        <TreeRow
          depth={1}
          icon={open ? <LuChevronDown /> : <LuChevronRight />}
          onToggle={() => setFolded(open ? [...folded, fold] : folded.filter((f) => f !== fold))}
          toggleLabel={open ? `Plegar «${r.name}»` : `Desplegar «${r.name}»`}
          label={r.name}
          hint={`${r.items.length} ${section === "moble" ? (r.items.length === 1 ? "moble" : "mobles") : r.items.length === 1 ? "objecte" : "objectes"}`}
          selected={sel?.kind === "group" && sel.id === r.name}
          onClick={() => (groupSel(r.name), setTool("select"))}
          flags={groupFlags(amb, change, r.name)}
          dnd={groupDnd(r.name)}
          menu={
            <TreeRowMenu label={`Accions de «${r.name}»`}>
              <Menu.Item value="dup" onClick={() => {
                const d = duplicateItems(amb, groupIds(amb, r.name))
                change(d.ambient, true)
                if (d.group) groupSel(d.group)
              }}>
                <LuCopy /> Duplicar el grup
              </Menu.Item>
              <Menu.Item value="ungroup" onClick={() => (change(setItemGroup(amb, groupIds(amb, r.name), undefined), true), setSel(null))}>
                <LuUngroup /> Desagrupar
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="del" color="fg.error" onClick={() => (change(removeItems(amb, groupIds(amb, r.name)), true), setSel(null))}>
                <LuTrash2 /> Eliminar el grup
              </Menu.Item>
            </TreeRowMenu>
          }
        />
        {open && r.items.map((it) => itemRow(it, 2))}
      </Box>
    )
  }

  return (
    <Stack gap={0.5} role="tree" aria-label="Estructura de l'ambient" fontSize="sm">
      <TreeRow icon={<LuHouse />} label={name || "Ambient"} bold depth={0} selected={ambientSel} onClick={onSelectAmbient} />
      <WallTreeSection amb={amb} change={change} selection={selection} groups={groups} folded={folded} setFolded={setFolded} totalLength={totalWallLength} setTool={setTool} />
      {/* Com els grups de l'arbre de l'editor (Peces lliures +, Models 3D +): títol i el + que obre la galeria. */}
      <TreeSection onAdd={onAddMoble} addLabel="Afegir moble">
        Mobles
      </TreeSection>
      {rowsOf(mobleItems).map((r) => listRow(r, "moble"))}
      <TreeSection onAdd={onAddObject} addLabel="Afegir objecte">
        Objectes
      </TreeSection>
      {rowsOf(objectItems).map((r) => listRow(r, "object"))}
      {/* Arrossegant un element d'un grup: zona per treure'l (queda solt), com a l'editor. */}
      {dragOutOfGroup && (
        <HStack
          mt={1}
          mx={1}
          px={2}
          py={1.5}
          gap={2}
          rounded="md"
          fontSize="xs"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor={over?.id === "ungroup" ? "wood.solid" : "border.emphasized"}
          bg={over?.id === "ungroup" ? "wood.muted" : undefined}
          color={over?.id === "ungroup" ? "wood.fg" : "fg.muted"}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            if (over?.id !== "ungroup") setOver({ id: "ungroup", after: false })
          }}
          onDragLeave={() => over?.id === "ungroup" && setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            if (drag) change(setItemGroup(amb, drag.ids, undefined), true)
            endDrag()
          }}
        >
          <LuUngroup /> Deixa'l aquí per treure'l del grup
        </HStack>
      )}
    </Stack>
  )
}
