import { Box, HStack, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { KINDS } from "./kinds"
import {
  LuArrowDown,
  LuArrowUp,
  LuBox,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuEllipsis,
  LuGroup,
  LuUngroup,
  LuPlus,
  LuScan,
  LuScissors,
  LuTrash2,
} from "react-icons/lu"
import { zoneIcon } from "./zoneIcon"
import { compositionKind, duplicateGroup, newGroupName, partGroups, insertPartCopy, insertRefCopy, modulePresetsFor, movePartToGroup, removePartFromGroup, newId, reorderModule, reorderPart, reorderRef, rowOf, type Composition, type Module, type Zone } from "../../core/model"
import { PartAddMenu } from "./PartInspector"
import { ORIENT_ICON } from "./partOrient"
import { RefAddMenu } from "./RefInspector"
import { zoneLabel } from "./zoneLabel"

type DragKind = "module" | "ref" | "part"

export type Selection =
  | { kind: "moble" }
  | { kind: "module"; id: string }
  | { kind: "zone"; moduleId: string; zoneId: string }
  | { kind: "ref"; id: string }
  | { kind: "part"; id: string }
  /** Grup de peces lliures (id = nom del grup). */
  | { kind: "group"; id: string }

/**
 * Arbre d'estructura (com l'outliner de Figma o Fusion): el moble, els seus mòduls amb
 * els compartiments, i els objectes de referència. Seleccionar aquí, al 3D o a l'alçat és
 * el mateix.
 */
export function StructureTree({
  name,
  comp,
  selection,
  onSelect,
  onChange,
  newModule,
  partCenter,
}: {
  name: string
  comp: Composition
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (c: Composition) => void
  newModule: (id: string, name: string) => Module
  /** On apareix una peça lliure nova (mm). */
  partCenter: { x: number; y: number; z: number }
}) {
  const selModuleId = selection.kind === "module" ? selection.id : selection.kind === "zone" ? selection.moduleId : null
  // Com un acordió: només un mòdul desplegat alhora. En desplegar-ne un es pleguen els
  // altres; en seleccionar un mòdul (o un compartiment seu) es desplega ell sol. La fletxa
  // plega o desplega sense canviar la selecció.
  const [openId, setOpenId] = useState<string | null>(selModuleId)
  const [lastSel, setLastSel] = useState(selModuleId)
  if (selModuleId !== lastSel) {
    setLastSel(selModuleId)
    if (selModuleId) setOpenId(selModuleId)
  }
  const toggle = (id: string) => setOpenId((o) => (o === id ? null : id))

  const addModule = (m: Module) => {
    onChange({ ...comp, modules: [...comp.modules, { ...m, gapBefore: 0 }] })
    onSelect({ kind: "module", id: m.id })
  }
  const duplicate = (i: number) => {
    const src = comp.modules[i]!
    const copy: Module = { ...structuredClone(src), id: newId("m"), name: `${src.name} (còpia)` }
    const modules = [...comp.modules]
    modules.splice(i + 1, 0, copy)
    onChange({ ...comp, modules })
    onSelect({ kind: "module", id: copy.id })
  }
  const remove = (i: number) => {
    if (comp.modules.length <= 1) return
    const modules = comp.modules.filter((_, k) => k !== i)
    onChange({ ...comp, modules })
    onSelect({ kind: "module", id: modules[Math.max(0, i - 1)]!.id })
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
  // Arrossegar per ordenar (mòduls dins de la seva fila, i objectes).
  const [drag, setDrag] = useState<{ kind: DragKind; id: string } | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  const canDrop = (kind: DragKind, id: string) => {
    if (!drag || drag.kind !== kind || drag.id === id) return false
    if (kind !== "module") return true
    const a = comp.modules.find((m) => m.id === drag.id)
    const b = comp.modules.find((m) => m.id === id)
    return !!a && !!b && rowOf(a) === rowOf(b)
  }
  const dnd = (kind: DragKind, id: string): RowDnd => ({
    dragging: drag?.id === id,
    indicator: over?.id === id && canDrop(kind, id) ? (over.after ? "after" : "before") : null,
    onStart: () => setDrag({ kind, id }),
    onOver: (after) => {
      if (!canDrop(kind, id)) return false
      if (over?.id !== id || over.after !== after) setOver({ id, after })
      return true
    },
    onDrop: (after) => {
      if (drag && canDrop(kind, id)) onChange(kind === "module" ? reorderModule(comp, drag.id, id, after) : kind === "part" ? reorderPart(comp, drag.id, id, after) : reorderRef(comp, drag.id, id, after))
      setDrag(null)
      setOver(null)
    },
    onEnd: () => {
      setDrag(null)
      setOver(null)
    },
  })
  // La fila d'un grup: s'hi pot deixar una peça (entra al grup).
  const groupDnd = (g: string): RowDnd => {
    const ok = () => drag?.kind === "part" && (comp.parts ?? []).find((q) => q.id === drag.id)?.group !== g
    return {
      noDrag: true,
      dragging: false,
      indicator: over?.id === `g:${g}` && ok() ? "inside" : null,
      onStart: () => {},
      onOver: () => {
        if (!ok()) return false
        if (over?.id !== `g:${g}`) setOver({ id: `g:${g}`, after: false })
        return true
      },
      onDrop: () => {
        if (drag && ok()) {
          onChange(movePartToGroup(comp, drag.id, g))
          setOpenGroups((o) => new Set([...o, g]))
        }
        setDrag(null)
        setOver(null)
      },
      onEnd: () => {
        setDrag(null)
        setOver(null)
      },
    }
  }
  const hasWall = comp.modules.some((m) => rowOf(m) === "wall")
  const rows: { row: "floor" | "wall"; label: string }[] = hasWall
    ? [
        { row: "floor", label: "A terra" },
        { row: "wall", label: "Penjats a la paret" },
      ]
    : [{ row: "floor", label: "" }]
  const onlyParts = compositionKind(comp) === "lliure"
  const parts = comp.parts ?? []
  // Grups de peces: plegats; s'obre sol el de la peça seleccionada.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const selGroup = selection.kind === "part" ? parts.find((q) => q.id === selection.id)?.group : undefined
  if (selGroup && !openGroups.has(selGroup)) setOpenGroups(new Set([...openGroups, selGroup]))
  const toggleGroup = (g: string) => setOpenGroups((o) => {
    const n = new Set(o)
    if (n.has(g)) n.delete(g)
    else n.add(g)
    return n
  })
  const setPartGroup = (id: string, group: string | undefined) => {
    onChange({ ...comp, parts: parts.map((q) => (q.id === id ? { ...q, group } : q)) })
    if (group) setOpenGroups((o) => new Set([...o, group]))
  }
  const removePart = (id: string) => {
    onChange({ ...comp, parts: parts.filter((r) => r.id !== id) })
    if (selection.kind === "part" && selection.id === id) onSelect({ kind: "moble" })
  }
  const removeRef = (id: string) => {
    onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
    if (selection.kind === "ref" && selection.id === id) onSelect({ kind: "moble" })
  }

  return (
    <Stack gap={0.5} role="tree" aria-label="Estructura del moble" fontSize="sm">
      <Row icon={<LuBox />} label={name || "Moble"} bold selected={selection.kind === "moble"} onClick={() => onSelect({ kind: "moble" })} depth={0} />

      {!onlyParts && rows.map(({ row, label }) => (
        <Box key={row}>
          {label && (
            <Text fontSize="2xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" pl="20px" pt={2} pb={0.5}>
              {label}
            </Text>
          )}
      {comp.modules.map((m, i) => ({ m, i })).filter(({ m }) => rowOf(m) === row).map(({ m, i }, k) => {
        const open = openId === m.id
        return (
          <Box key={m.id}>
            <Row
              depth={1}
              icon={open ? <LuChevronDown /> : <LuChevronRight />}
              onToggle={() => toggle(m.id)}
              toggleLabel={open ? `Plegar «${m.name}»` : `Desplegar «${m.name}»`}
              label={`${k + 1}. ${m.name}`}
              hint={`${m.carcass.width} × ${m.carcass.height}`}
              selected={selection.kind === "module" && selection.id === m.id}
              onClick={() => onSelect({ kind: "module", id: m.id })}
              dnd={dnd("module", m.id)}
              menu={
                <RowMenu label={`Opcions de «${m.name}»`}>
                  <Menu.Item value="up" disabled={neighbourIndex(i, -1) < 0} onClick={() => move(i, -1)}>
                    <LuArrowUp /> Moure a l'esquerra
                  </Menu.Item>
                  <Menu.Item value="down" disabled={neighbourIndex(i, 1) < 0} onClick={() => move(i, 1)}>
                    <LuArrowDown /> Moure a la dreta
                  </Menu.Item>
                  <Menu.Item value="dup" onClick={() => duplicate(i)}>
                    <LuCopy /> Duplicar
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="del" color="fg.error" disabled={comp.modules.length <= 1} onClick={() => remove(i)}>
                    <LuTrash2 /> Eliminar
                  </Menu.Item>
                </RowMenu>
              }
            />
            {open && <ZoneRows zone={m.root} depth={2} moduleId={m.id} selection={selection} onSelect={onSelect} root />}
          </Box>
        )
      })}
        </Box>
      ))}

      {!onlyParts && <Menu.Root>
        <Menu.Trigger asChild>
          <HStack as="button" gap={2} pl={7} py={1.5} color="fg.muted" _hover={{ color: "fg" }} rounded="md" cursor="pointer">
            <LuPlus /> <Text>Afegir mòdul</Text>
          </HStack>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="empty" onClick={() => addModule(newModule(newId("m"), `Mòdul ${comp.modules.length + 1}`))}>
                <LuBox /> Caixa buida
              </Menu.Item>
              {/* Mòduls especials del tipus de moble (cuina: baixos, alts, columnes…). */}
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>{KINDS.find((k) => k.value === compositionKind(comp))!.label}</Menu.ItemGroupLabel>
                {modulePresetsFor(compositionKind(comp)).map((p) => (
                  <Menu.Item key={p.id} value={p.id} onClick={() => addModule({ ...p.make(), id: newId("m") })}>
                    {p.name}
                  </Menu.Item>
                ))}
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>}

      {/* Peces lliures (flat-pack): com els objectes, però són peces de debò amb encaixos. */}
      <HStack justify="space-between" pt={3} pb={1} px={1}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
          Peces lliures
        </Text>
        <PartAddMenu comp={comp} onChange={onChange} center={partCenter} onAdded={(id) => onSelect({ kind: "part", id })} />
      </HStack>
      {parts.length === 0 && (
        <Text fontSize="xs" color="fg.subtle" px={2}>
          {onlyParts ? "Cap. Afegeix-ne amb el +: on dues peces es toquen o s'encreuen, s'hi fa l'encaix sol." : "Cap. Taulers solts (prestatges, travessers, potes…) o elements de ferro, pedra o vidre. Els encaixos automàtics són del tipus Flat-pack."}
        </Text>
      )}
      {(() => {
        const seen = new Set<string>()
        const partRow = (r: (typeof parts)[number], depth: number) => {
          const Icon = r.effect === "cut" ? LuScissors : ORIENT_ICON[r.orient]
          const groups = partGroups(parts).filter((g) => g !== r.group)
          return (
            <Row
              key={r.id}
              depth={depth}
              icon={<Icon />}
              label={r.name}
              hint={`${r.w} × ${r.h}`}
              selected={selection.kind === "part" && selection.id === r.id}
              onClick={() => onSelect({ kind: "part", id: r.id })}
              dnd={dnd("part", r.id)}
              menu={
                <RowMenu label={`Opcions de «${r.name}»`}>
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
                </RowMenu>
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
              <Row
                depth={1}
                icon={open ? <LuChevronDown /> : <LuChevronRight />}
                onToggle={() => toggleGroup(g)}
                toggleLabel={open ? `Plegar «${g}»` : `Desplegar «${g}»`}
                label={g}
                hint={`${members.length} peces`}
                dnd={groupDnd(g)}
                selected={selection.kind === "group" && selection.id === g}
                onClick={() => onSelect({ kind: "group", id: g })}
                menu={
                  <RowMenu label={`Opcions de «${g}»`}>
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
                    <Menu.Item value="ungroup" onClick={() => onChange({ ...comp, parts: parts.map((q) => (q.group === g ? { ...q, group: undefined } : q)) })}>
                      <LuUngroup /> Desagrupar
                    </Menu.Item>
                    <Menu.Separator />
                    <Menu.Item
                      value="del"
                      color="fg.error"
                      onClick={() => {
                        onChange({ ...comp, parts: parts.filter((q) => q.group !== g) })
                        onSelect({ kind: "moble" })
                      }}
                    >
                      <LuTrash2 /> Eliminar el grup
                    </Menu.Item>
                  </RowMenu>
                }
              />
              {open && members.map((q) => partRow(q, 2))}
            </Box>
          )
        })
      })()}
      {/* Arrossegant una peça d'un grup: zona per treure-la'n (queda solta). */}
      {drag?.kind === "part" && parts.find((q) => q.id === drag.id)?.group && (
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
            onChange(removePartFromGroup(comp, drag.id))
            setDrag(null)
            setOver(null)
          }}
        >
          <LuUngroup /> Deixa-la aquí per treure-la del grup
        </HStack>
      )}

      <HStack justify="space-between" pt={3} pb={1} px={1}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
          Objectes de referència
        </Text>
        <RefAddMenu comp={comp} onChange={onChange} onAdded={(id) => onSelect({ kind: "ref", id })} />
      </HStack>
      {comp.references.length === 0 && (
        <Text fontSize="xs" color="fg.subtle" px={2}>
          Cap. Afegeix-ne per comprovar que tot hi cap (radiador, tele...).
        </Text>
      )}
      {comp.references.map((r) => (
        <Row
          key={r.id}
          depth={1}
          icon={<LuScan />}
          label={r.name}
          hint={`${r.w} × ${r.h}`}
          selected={selection.kind === "ref" && selection.id === r.id}
          onClick={() => onSelect({ kind: "ref", id: r.id })}
          dnd={dnd("ref", r.id)}
          menu={
            <RowMenu label={`Opcions de «${r.name}»`}>
              <Menu.Item
                value="dup"
                onClick={() => {
                  const res = insertRefCopy(comp, r)
                  onChange(res.comp)
                  onSelect({ kind: "ref", id: res.id })
                }}
              >
                <LuCopy /> Duplicar
              </Menu.Item>
              <Menu.Item value="del" color="fg.error" onClick={() => removeRef(r.id)}>
                <LuTrash2 /> Eliminar
              </Menu.Item>
            </RowMenu>
          }
        />
      ))}
    </Stack>
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
  // L'arrel sense divisions és el mòdul sencer: es mostra com un compartiment.
  if (root && zone.split) {
    return (
      <>
        {zone.split.children.map((c) => (
          <ZoneRows key={c.id} zone={c} depth={depth} moduleId={moduleId} selection={selection} onSelect={onSelect} />
        ))}
      </>
    )
  }
  const selected = selection.kind === "zone" && selection.zoneId === zone.id
  // Icona segons el contingut (la mateixa que a les propietats).
  const Icon = zoneIcon(zone)
  const icon = <Icon />
  return (
    <>
      <Row depth={depth} icon={icon} label={zoneLabel(zone)} selected={selected} onClick={() => onSelect({ kind: "zone", moduleId, zoneId: zone.id })} muted />
      {zone.split?.children.map((c) => (
        <ZoneRows key={c.id} zone={c} depth={depth + 1} moduleId={moduleId} selection={selection} onSelect={onSelect} />
      ))}
    </>
  )
}

interface RowDnd {
  /** Només s'hi pot deixar (la fila no s'arrossega). */
  noDrag?: boolean
  dragging: boolean
  indicator: DropIndicator
  onStart: () => void
  /** Torna false si no s'hi pot deixar (p. ex. un mòdul d'una altra fila). */
  onOver: (after: boolean) => boolean
  onDrop: (after: boolean) => void
  onEnd: () => void
}

/** Indicador de la fila de destí: línia abans/després, o la fila marcada si hi entra (grup). */
type DropIndicator = "before" | "after" | "inside" | null

function Row({
  icon,
  label,
  hint,
  selected,
  onClick,
  depth,
  bold,
  muted,
  menu,
  onToggle,
  toggleLabel,
  dnd,
}: {
  /** Arrossegar per ordenar: la fila es pot agafar i deixar abans/després d'una altra. */
  dnd?: RowDnd
  /** Si hi és, la icona és una fletxa que plega/desplega sense seleccionar la fila. */
  onToggle?: () => void
  toggleLabel?: string
  icon: ReactNode
  label: string
  hint?: string
  selected: boolean
  onClick: () => void
  depth: number
  bold?: boolean
  muted?: boolean
  menu?: ReactNode
}) {
  return (
    <HStack
      role="treeitem"
      aria-selected={selected}
      gap={2}
      pl={`${depth * 14 + 6}px`}
      pr={1}
      py={1}
      rounded="md"
      cursor="pointer"
      bg={selected ? "wood.muted" : undefined}
      color={selected ? "wood.fg" : muted ? "fg.muted" : "fg"}
      _hover={{ bg: selected ? "wood.muted" : "bg.muted" }}
      onClick={onClick}
      className="group"
      minH="30px"
      position="relative"
      opacity={dnd?.dragging ? 0.4 : 1}
      draggable={!!dnd && !dnd.noDrag}
      onDragStart={
        dnd
          ? (e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", label)
              dnd.onStart()
            }
          : undefined
      }
      onDragOver={
        dnd
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect()
              if (dnd.onOver(e.clientY > r.top + r.height / 2)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
              }
            }
          : undefined
      }
      onDrop={
        dnd
          ? (e) => {
              e.preventDefault()
              const r = e.currentTarget.getBoundingClientRect()
              dnd.onDrop(e.clientY > r.top + r.height / 2)
            }
          : undefined
      }
      onDragEnd={dnd?.onEnd}
      outline={dnd?.indicator === "inside" ? "2px solid" : undefined}
      outlineColor={dnd?.indicator === "inside" ? "wood.solid" : undefined}
      outlineOffset="-2px"
      _before={
        dnd?.indicator && dnd.indicator !== "inside"
          ? { content: '""', position: "absolute", left: `${depth * 14 + 6}px`, right: 1, height: "2px", bg: "wood.solid", borderRadius: "full", pointerEvents: "none", ...(dnd.indicator === "before" ? { top: "-1px" } : { bottom: "-1px" }) }
          : undefined
      }
    >
      {onToggle ? (
        <Box
          as="button"
          aria-label={toggleLabel}
          aria-expanded={toggleLabel?.startsWith("Plegar")}
          flexShrink={0}
          fontSize="sm"
          color={selected ? "wood.fg" : "fg.muted"}
          rounded="sm"
          p={0.5}
          m={-0.5}
          _hover={{ bg: "bg.emphasized", color: "fg" }}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {icon}
        </Box>
      ) : (
        <Box flexShrink={0} fontSize="sm" color={selected ? "wood.fg" : "fg.muted"}>
          {icon}
        </Box>
      )}
      <Text flex={1} truncate fontWeight={bold || selected ? "semibold" : "normal"}>
        {label}
      </Text>
      {hint && (
        <Text fontSize="xs" color="fg.subtle" flexShrink={0}>
          {hint}
        </Text>
      )}
      {menu && (
        <Box flexShrink={0} opacity={selected ? 1 : 0} _groupHover={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
          {menu}
        </Box>
      )}
    </HStack>
  )
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label={label} size="2xs" variant="ghost">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>{children}</Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
