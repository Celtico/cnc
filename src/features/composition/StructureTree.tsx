import { Box, HStack, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import {
  LuArrowDown,
  LuArrowUp,
  LuBox,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuDoorClosed,
  LuEllipsis,
  LuPlus,
  LuScan,
  LuSquare,
  LuColumns2,
  LuRows2,
  LuTrash2,
} from "react-icons/lu"
import { BUILTIN_TEMPLATES, insertRefCopy, newId, rowOf, type Composition, type Module, type Zone } from "../../core/model"
import { RefAddMenu } from "./RefInspector"
import { zoneLabel } from "./zoneLabel"

export type Selection =
  | { kind: "moble" }
  | { kind: "module"; id: string }
  | { kind: "zone"; moduleId: string; zoneId: string }
  | { kind: "ref"; id: string }

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
}: {
  name: string
  comp: Composition
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (c: Composition) => void
  newModule: (id: string, name: string) => Module
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
  const hasWall = comp.modules.some((m) => rowOf(m) === "wall")
  const rows: { row: "floor" | "wall"; label: string }[] = hasWall
    ? [
        { row: "floor", label: "A terra" },
        { row: "wall", label: "Penjats a la paret" },
      ]
    : [{ row: "floor", label: "" }]
  const removeRef = (id: string) => {
    onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
    if (selection.kind === "ref" && selection.id === id) onSelect({ kind: "moble" })
  }

  return (
    <Stack gap={0.5} role="tree" aria-label="Estructura del moble" fontSize="sm">
      <Row icon={<LuBox />} label={name || "Moble"} bold selected={selection.kind === "moble"} onClick={() => onSelect({ kind: "moble" })} depth={0} />

      {rows.map(({ row, label }) => (
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

      <Menu.Root>
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
              {BUILTIN_TEMPLATES.filter((t) => t.make().modules.length === 1).map((t) => (
                <Menu.Item key={t.id} value={t.id} onClick={() => addModule({ ...t.make().modules[0]!, id: newId("m") })}>
                  {t.name}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

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
  // Compartiment amb front: la mateixa icona que la secció «Front» de les propietats.
  const icon = zone.split ? zone.split.dir === "v" ? <LuColumns2 /> : <LuRows2 /> : zone.front ? <LuDoorClosed /> : <LuSquare />
  return (
    <>
      <Row depth={depth} icon={icon} label={zoneLabel(zone)} selected={selected} onClick={() => onSelect({ kind: "zone", moduleId, zoneId: zone.id })} muted />
      {zone.split?.children.map((c) => (
        <ZoneRows key={c.id} zone={c} depth={depth + 1} moduleId={moduleId} selection={selection} onSelect={onSelect} />
      ))}
    </>
  )
}

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
}: {
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
