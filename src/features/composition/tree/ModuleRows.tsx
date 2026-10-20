import { Box, Menu, Text } from "@chakra-ui/react"
import { createElement } from "react"
import { LuArrowLeft, LuArrowRight, LuChevronDown, LuCornerDownLeft, LuCornerDownRight, LuChevronRight, LuCopy, LuGroup, LuRefrigerator, LuTrash2, LuUngroup } from "react-icons/lu"
import { APPLIANCE_LABELS, addCorner, groupMulti, nicheAppliance, groupNames, newGroupName, newId, removeModule, rowOf, ungroupMulti, type Module, type Zone } from "../../../core/model"
import { toaster } from "../../../components/ui/toaster"
import { TreeRow, TreeRowMenu } from "../../../components/TreeRow"
import { zoneIcon } from "../zoneIcons"
import { zoneLabel } from "../zoneLabel"
import type { Selection } from "../StructureTree"
import { GroupRow } from "./GroupRow"
import { UngroupDropZone } from "./UngroupDropZone"
import type { TreeCtx } from "./treeCtx"

/**
 * Les files dels mòduls (a terra i, si n'hi ha, penjats a la paret), amb els compartiments del desplegat (`openId`, un
 * alhora) i els grups de mòduls (arrossegant-ne un d'un grup, a sota hi surt la zona per treure'l).
 */
export function ModuleRows({ tree, openId, toggle }: { tree: TreeCtx; openId: string | null; toggle: (id: string) => void }) {
  const { comp, selection, onSelect, onChange, dnd, flagsOf, inMultiSel, openGroups, openGroup } = tree
  const duplicate = (i: number) => {
    const src = comp.modules[i]!
    const copy: Module = { ...structuredClone(src), id: newId("m"), name: `${src.name} (còpia)` }
    const modules = [...comp.modules]
    modules.splice(i + 1, 0, copy)
    onChange({ ...comp, modules })
    onSelect({ kind: "module", id: copy.id })
  }
  // Cantonada en L (`addCorner`): el mòdul girat de l'altre braç, a un costat d'aquest.
  const corner = (i: number, side: "left" | "right") => {
    const res = addCorner(comp, comp.modules[i]!.id, side)
    if (!res) return
    onChange(res.comp)
    onSelect({ kind: "module", id: res.id })
    toaster.create({ title: "Cantonada en L: el mòdul nou és l'altre braç, girat. Canvia'n l'amplada a Mides; el racó s'obre per la porta d'aquest mòdul.", type: "info" })
  }
  const remove = (i: number) => {
    // Peces enganxades, taulell i sòcol i forats del taulell que en depenen (`removeModule`). Pot quedar sense cap mòdul.
    const res = removeModule(comp, comp.modules[i]!.id)
    onChange(res.comp)
    for (const n of res.notes) toaster.create({ title: n, type: "info" })
    const next = res.comp.modules[Math.max(0, i - 1)]
    onSelect(next ? { kind: "module", id: next.id } : { kind: "moble" })
  }
  /** Veí de la mateixa fila (a terra / penjats) cap a l'esquerra (-1) o la dreta (1). */
  const neighbourIndex = (i: number, dir: -1 | 1): number => {
    const row = rowOf(comp.modules[i]!)
    for (let j = i + dir; j >= 0 && j < comp.modules.length; j += dir) if (rowOf(comp.modules[j]!) === row) return j
    return -1
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = neighbourIndex(i, dir)
    if (j < 0) return
    const modules = [...comp.modules]
    ;[modules[i], modules[j]] = [modules[j]!, modules[i]!]
    onChange({ ...comp, modules })
  }
  const hasWall = comp.modules.some((m) => rowOf(m) === "wall")
  const rows: { row: "floor" | "wall"; label: string }[] = hasWall
    ? [
        { row: "floor", label: "A terra" },
        { row: "wall", label: "Penjats a la paret" },
      ]
    : [{ row: "floor", label: "" }]

  return (
    <>
      {rows.map(({ row, label }) => (
        <Box key={row}>
          {label && (
            <Text fontSize="2xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" pl="20px" pt={2} pb={0.5}>
              {label}
            </Text>
          )}
      {(() => {
        // Els mòduls de la fila; els d'un grup, plegables on surt el primer (com les peces lliures).
        const inRow = comp.modules.map((m, i) => ({ m, i })).filter(({ m }) => rowOf(m) === row)
        const moduleRow = ({ m, i }: { m: Module; i: number }, k: number, depth: number) => {
        // El mòdul sense dividir que és un electrodomèstic (l'ocupa sencer, `isApplianceModule`): la fila del mòdul és
        // l'aparell (la seva icona i el tipus a la pista) i no es desplega: l'«Interior» no surt (un sol lloc per decisió).
        const appliance = nicheAppliance(m.root)
        const open = !appliance && openId === m.id
        const size = `${Math.round(m.carcass.width)} × ${Math.round(m.carcass.height)}`
        return (
          <Box key={m.id}>
            <TreeRow
              depth={depth}
              icon={appliance ? <LuRefrigerator /> : open ? <LuChevronDown /> : <LuChevronRight />}
              onToggle={appliance ? undefined : () => toggle(m.id)}
              toggleLabel={appliance ? undefined : open ? `Plegar «${m.name}»` : `Desplegar «${m.name}»`}
              label={`${k + 1}. ${m.name}`}
              hint={appliance ? `${APPLIANCE_LABELS[appliance.kind]} · ${size}` : size}
              selected={(selection.kind === "module" && selection.id === m.id) || inMultiSel("module", m.id)}
              highlighted={selection.kind === "group" && selection.id === m.group}
              onClick={() => onSelect({ kind: "module", id: m.id })}
              dnd={dnd.dnd("module", m.id)}
              flags={flagsOf("modules", m)}
              menu={
                <TreeRowMenu label={`Accions de «${m.name}»`}>
                  <Menu.Item value="up" disabled={neighbourIndex(i, -1) < 0} onClick={() => move(i, -1)}>
                    <LuArrowLeft /> Moure a l'esquerra
                  </Menu.Item>
                  <Menu.Item value="down" disabled={neighbourIndex(i, 1) < 0} onClick={() => move(i, 1)}>
                    <LuArrowRight /> Moure a la dreta
                  </Menu.Item>
                  <Menu.Item value="dup" onClick={() => duplicate(i)}>
                    <LuCopy /> Duplicar
                  </Menu.Item>
                  {!m.rot && !m.turned && m.x === undefined && (
                    <>
                      <Menu.Item value="corner-left" onClick={() => corner(i, "left")}>
                        <LuCornerDownLeft /> Cantonada a l'esquerra
                      </Menu.Item>
                      <Menu.Item value="corner-right" onClick={() => corner(i, "right")}>
                        <LuCornerDownRight /> Cantonada a la dreta
                      </Menu.Item>
                    </>
                  )}
                  <Menu.Separator />
                  <Menu.Item value="group-new" onClick={() => {
                    const g = newGroupName(comp)
                    onChange(groupMulti(comp, [{ kind: "module", id: m.id }], g))
                    openGroup(g)
                  }}>
                    <LuGroup /> Agrupar en un grup nou
                  </Menu.Item>
                  {groupNames(comp).filter((g) => g !== m.group).map((g) => (
                    <Menu.Item key={g} value={`group-${g}`} onClick={() => onChange(groupMulti(comp, [{ kind: "module", id: m.id }], g))}>
                      <LuGroup /> Posar a «{g}»
                    </Menu.Item>
                  ))}
                  {m.group && (
                    <Menu.Item value="ungroup" onClick={() => onChange(ungroupMulti(comp, [{ kind: "module", id: m.id }]))}>
                      <LuUngroup /> Treure del grup
                    </Menu.Item>
                  )}
                  <Menu.Separator />
                  <Menu.Item value="del" color="fg.error" onClick={() => remove(i)}>
                    <LuTrash2 /> Eliminar
                  </Menu.Item>
                </TreeRowMenu>
              }
            />
            {open && <ZoneRows zone={m.root} depth={depth + 1} moduleId={m.id} selection={selection} onSelect={onSelect} root />}
          </Box>
        )
        }
        const seen = new Set<string>()
        return inRow.map((x, k) => {
          if (!x.m.group) return moduleRow(x, k, 1)
          if (seen.has(x.m.group)) return null
          const g = x.m.group
          seen.add(g)
          const members = inRow.filter((y) => y.m.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`mg:${row}:${g}`}>
              <GroupRow tree={tree} g={g} open={open} hint={`${members.length} ${members.length === 1 ? "mòdul" : "mòduls"}`} />
              {open && members.map((y) => moduleRow(y, inRow.indexOf(y), 2))}
              {/* Arrossegant un mòdul d'aquest grup: zona per treure'l (queda solt, al mateix lloc), just a sota. */}
              {dnd.drag?.kind === "module" && dnd.dragGroup === g && (
                <UngroupDropZone {...dnd.ungroupZone(() => ungroupMulti(comp, dnd.drag?.multi ?? [{ kind: "module", id: dnd.drag!.id }]))}>
                  <LuUngroup /> Deixa'l aquí per treure'l del grup
                </UngroupDropZone>
              )}
            </Box>
          )
        })
      })()}
        </Box>
      ))}
    </>
  )
}

function ZoneRows({
  zone,
  depth,
  moduleId,
  selection,
  onSelect,
  root,
}: {
  zone: Zone
  depth: number
  moduleId: string
  selection: Selection
  onSelect: (s: Selection) => void
  root?: boolean
}) {
  // L'arrel és l'«Interior» del mòdul (dividida o no; si el mòdul és un electrodomèstic que l'ocupa, no surt: la fila del
  // mòdul és l'aparell): sense dividir, seleccionar-la dona el seu Front; dividida, la
  // Divisió (les portes de tot el mòdul, p. ex. d'un armari amb penjador i maleter, són a Mòdul › Portes; l'etiqueta ho
  // diu: «Interior · 2 portes»). Els compartiments hi pengen a sota.
  const selected = selection.kind === "zone" && selection.zoneId === zone.id
  // Icona segons el contingut (la mateixa que a les propietats).
  const icon = createElement(zoneIcon(zone, { root }))
  return (
    <>
      <TreeRow depth={depth} icon={icon} label={zoneLabel(zone, { root })} selected={selected} onClick={() => onSelect({ kind: "zone", moduleId, zoneId: zone.id })} muted />
      {zone.split?.children.map((c) => (
        <ZoneRows key={c.id} zone={c} depth={depth + 1} moduleId={moduleId} selection={selection} onSelect={onSelect} />
      ))}
    </>
  )
}
