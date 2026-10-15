import { Box, Menu } from "@chakra-ui/react"
import { useState } from "react"
import { LuBrickWall, LuChevronDown, LuChevronRight, LuGroup, LuTrash2, LuUngroup } from "react-icons/lu"
import { TreeRow, TreeRowMenu } from "../../../components/TreeRow"
import { newItemGroupName, setWallGroup, wallLength, type Ambient, type Wall } from "../../../core/model"
import { formatLength, useUnit } from "../../../lib/units"
import type { Tool } from "../planGeom"
import { groupFlags, wallFlags } from "./treeFlags"
import type { AmbientSelection } from "./useAmbientSelection"

/** Parets: un grup plegable a l'arbre (com els grups de l'editor); s'obre sol en triar-ne una al plànol. */
export function WallTreeSection({
  amb,
  change,
  selection,
  groups,
  folded,
  setFolded,
  totalLength,
  setTool,
}: {
  amb: Ambient
  change: (next: Ambient, commit: boolean) => void
  selection: AmbientSelection
  groups: string[]
  folded: string[]
  setFolded: (v: string[]) => void
  /** El llarg de totes les parets (mm), del resum. */
  totalLength: number
  setTool: (t: Tool) => void
}) {
  const unit = useUnit()
  const { sel, setSel, select, groupSel, wall, treeClick, shiftRef, rangeAnchor } = selection
  const [wallsOpen, setWallsOpen] = useState(false)
  const [lastWall, setLastWall] = useState<string | undefined>(undefined)
  if (wall?.id !== lastWall) {
    setLastWall(wall?.id)
    if (wall) setWallsOpen(true)
  }
  if (!(amb.walls.length > 0)) return null
  return (
    <Box>
      <TreeRow
        depth={1}
        icon={wallsOpen ? <LuChevronDown /> : <LuChevronRight />}
        onToggle={() => setWallsOpen((o) => !o)}
        toggleLabel={wallsOpen ? "Plegar «Parets»" : "Desplegar «Parets»"}
        label="Parets"
        hint={`${amb.walls.length} · ${formatLength(Math.round(totalLength), unit)}`}
        selected={false}
        highlighted={!!wall}
        onClick={() => setWallsOpen((o) => !o)}
      />
      {wallsOpen && (() => {
        // Les parets, en l'ordre de la llista; les d'un grup, plegables on surt la primera (com els elements).
        const order = amb.walls.map((w) => w.id)
        const wallRow = (w: Wall, depth: number) => {
          const i = amb.walls.indexOf(w)
          return (
            <TreeRow
              key={w.id}
              depth={depth}
              icon={<LuBrickWall />}
              label={`Paret ${i + 1}`}
              hint={`${formatLength(Math.round(wallLength(w)), unit)}${w.openings?.length ? ` · ${w.openings.length} ${w.openings.length === 1 ? "obertura" : "obertures"}` : ""}`}
              selected={(sel?.kind === "wall" && sel.id === w.id) || (sel?.kind === "multi" && sel.ids.includes(w.id))}
              highlighted={sel?.kind === "group" && sel.id === w.group}
              onClick={() => {
                // Maj = el tram, ⌘ = afegir o treure (com els elements); si no, la paret sola.
                if (shiftRef.current) treeClick(w.id, order)
                else {
                  rangeAnchor.current = w.id
                  select({ kind: "wall", id: w.id })
                }
                setTool("select")
              }}
              flags={wallFlags(amb, change, w)}
              menu={
                <TreeRowMenu label={`Accions de «Paret ${i + 1}»`}>
                  <Menu.Item value="new-group" onClick={() => {
                    const name = newItemGroupName(amb)
                    change(setWallGroup(amb, [w.id], name), true)
                    groupSel(name)
                  }}>
                    <LuGroup /> Grup nou
                  </Menu.Item>
                  {groups.filter((g) => g !== w.group).map((g) => (
                    <Menu.Item key={g} value={`to:${g}`} onClick={() => change(setWallGroup(amb, [w.id], g), true)}>
                      <LuGroup /> Posar a «{g}»
                    </Menu.Item>
                  ))}
                  {w.group && (
                    <Menu.Item value="out" onClick={() => change(setWallGroup(amb, [w.id], undefined), true)}>
                      <LuUngroup /> Treure del grup
                    </Menu.Item>
                  )}
                  <Menu.Separator />
                  <Menu.Item
                    value="del"
                    color="fg.error"
                    onClick={() => {
                      change({ ...amb, walls: amb.walls.filter((x) => x.id !== w.id) }, true)
                      if (sel?.kind === "wall" && sel.id === w.id) setSel(null)
                    }}
                  >
                    <LuTrash2 /> Eliminar la paret
                  </Menu.Item>
                </TreeRowMenu>
              }
            />
          )
        }
        const seen = new Set<string>()
        return amb.walls.map((w) => {
          if (!w.group) return wallRow(w, 2)
          if (seen.has(w.group)) return null
          const g = w.group
          seen.add(g)
          const members = amb.walls.filter((x) => x.group === g)
          const fold = `walls:${g}`
          const open = !folded.includes(fold)
          return (
            <Box key={`wg:${g}`}>
              <TreeRow
                depth={2}
                icon={open ? <LuChevronDown /> : <LuChevronRight />}
                onToggle={() => setFolded(open ? [...folded, fold] : folded.filter((f) => f !== fold))}
                toggleLabel={open ? `Plegar «${g}»` : `Desplegar «${g}»`}
                label={g}
                hint={`${members.length} ${members.length === 1 ? "paret" : "parets"}`}
                selected={sel?.kind === "group" && sel.id === g}
                onClick={() => (groupSel(g), setTool("select"))}
                flags={groupFlags(amb, change, g)}
              />
              {open && members.map((x) => wallRow(x, 3))}
            </Box>
          )
        })
      })()}
    </Box>
  )
}
