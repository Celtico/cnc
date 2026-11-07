import { Box, chakra, HStack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { hoverKey, useHoverLink } from "../../components/hoverLink"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { Composition, Panel } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { TaulellIcon, type TaulellIconName } from "./TaulellIcon"

/** El nom d'un forat al taller, pel que fa (com els anomena el Taulell). */
const HOLE_NAMES: Record<string, string> = { hinge: "Cassoleta", plate: "Placa de frontissa", system32: "Línia de forats", dowel: "Clavilla", leg: "Pota" }
const mm = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/** Els mecanitzats d'una peça, agrupats com els llista el Taulell: «Perforació Ø8×12 · 6», «Ranura 8×8». */
export function machiningRows(p: Panel): { key: string; label: string; icon: TaulellIconName }[] {
  const rows = new Map<string, { label: string; icon: TaulellIconName; n: number }>()
  const add = (key: string, label: string, icon: TaulellIconName) => {
    const r = rows.get(key)
    if (r) r.n++
    else rows.set(key, { label, icon, n: 1 })
  }
  for (const h of p.holes) {
    const name = (h.tag && HOLE_NAMES[h.tag]) || "Perforació"
    add(`h:${name}:${h.diameter}:${h.depth}`, `${name} Ø${mm(h.diameter)}×${mm(h.depth)}`, h.tag === "hinge" ? "cup" : h.tag === "system32" ? "line32" : h.tag === "dowel" ? "dowel" : "hole")
  }
  for (const g of p.grooves) add(`g:${Math.min(g.w, g.h)}:${g.depth}`, `Ranura ${mm(Math.min(g.w, g.h))}×${mm(g.depth)}`, "groove")
  for (const k of p.pockets ?? []) add(`p:${k.depth}`, `Buidat ×${mm(k.depth)}`, "rebate")
  for (const c of p.cutouts ?? []) add(`c:${c.kind}`, "Retall", "cut")
  return [...rows.entries()].map(([key, r]) => ({ key, icon: r.icon, label: r.n > 1 ? `${r.label} · ${r.n}` : r.label }))
}

/**
 * L'arbre de Modelatge, com el del Taulell (cel, 2026-11-07: «l'estructura d'aquell arbre, fes-la igual»): cada moble (amb
 * la seva mida) i, desplegat, les seves peces numerades (moble.peça: «1.01 Lateral esquerre») amb els mecanitzats a sota;
 * després, les peces soltes («S.01»). Clicar un moble o una de les seves peces tria el moble (les opcions, a la dreta);
 * clicar una peça solta, la peça.
 */
export function ModelingTree({ comp, build, selection, onSelect }: { comp: Composition; build: CompositionBuild | undefined; selection: Selection; onSelect: (s: Selection) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(comp.modules.slice(0, 1).map((m) => m.id)))
  const [piece, setPiece] = useState<string | null>(null)
  const link = useHoverLink()
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const panels = build?.panels ?? []
  const free = comp.parts ?? []
  if (!comp.modules.length && !free.length)
    return (
      <Text fontSize="sm" color="fg.muted" px={2} py={3}>
        El model és buit. Fes «Nou moble» a la barra d'eines.
      </Text>
    )

  const pieceRow = (p: Panel, code: string, sel: boolean, onClick: () => void, hover: string) => (
    <Box key={p.id}>
      <Row level={1} icon="panel" selected={sel} onClick={onClick} hover={hover} link={link}>
        <Code>{code}</Code>
        {p.label}
      </Row>
      {machiningRows(p).map((r) => (
        <Row key={r.key} level={2} icon="feat" muted>
          {r.label}
        </Row>
      ))}
    </Box>
  )

  return (
    <Box fontSize="sm" role="tree" aria-label="Arbre del model">
      {comp.modules.map((m, i) => {
        const own = panels.filter((p) => p.module === i + 1 && p.role !== "hardware")
        const isOpen = open.has(m.id)
        const sel = selection.kind === "module" && selection.id === m.id && !piece
        return (
          <Box key={m.id}>
            <Row
              level={0}
              icon="cabinet"
              strong
              selected={sel}
              hover={hoverKey("module", m.id)}
              link={link}
              caret={isOpen ? "▾" : "▸"}
              onCaret={() => toggle(m.id)}
              onClick={() => {
                setPiece(null)
                onSelect({ kind: "module", id: m.id })
              }}
              end={`${Math.round(m.carcass.width)}×${Math.round(m.carcass.height)}`}
            >
              {m.name}
            </Row>
            {isOpen &&
              own.map((p, k) =>
                pieceRow(p, `${i + 1}.${String(k + 1).padStart(2, "0")}`, piece === p.id && selection.kind === "module" && selection.id === m.id, () => {
                  setPiece(p.id)
                  onSelect({ kind: "module", id: m.id })
                }, hoverKey("module", m.id)),
              )}
          </Box>
        )
      })}
      {free.length > 0 && (
        <>
          <Row level={0} icon="panel" strong>
            Peces soltes ({free.length})
          </Row>
          {free.map((part, k) => {
            const p = panels.find((q) => q.id === `part:${part.id}`)
            if (!p) return null
            return pieceRow({ ...p, label: part.name }, `S.${String(k + 1).padStart(2, "0")}`, selection.kind === "part" && selection.id === part.id, () => {
              setPiece(null)
              onSelect({ kind: "part", id: part.id })
            }, hoverKey("part", part.id))
          })}
        </>
      )}
    </Box>
  )
}

const Code = ({ children }: { children: ReactNode }) => (
  <chakra.span fontFamily="mono" fontSize="xs" color="fg.muted" me={1.5}>
    {children}
  </chakra.span>
)

/** Una fila de l'arbre (la del Taulell): sagnat, icona, nom i, a la dreta, la mida. */
function Row({
  level,
  icon,
  children,
  selected,
  onClick,
  muted,
  strong,
  caret,
  onCaret,
  end,
  hover,
  link,
}: {
  level: number
  icon: TaulellIconName
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  muted?: boolean
  strong?: boolean
  caret?: string
  onCaret?: () => void
  end?: string
  hover?: string
  link?: ReturnType<typeof useHoverLink>
}) {
  const hovered = !!hover && link?.hover === hover && !selected
  return (
    <HStack
      role="treeitem"
      aria-selected={selected}
      gap={1.5}
      ps={`${4 + level * 16}px`}
      pe={2}
      py={1}
      rounded="sm"
      cursor={onClick ? "pointer" : "default"}
      color={selected ? "wood.fg" : muted ? "fg.muted" : "fg"}
      bg={selected ? "wood.subtle" : hovered ? "bg.muted" : undefined}
      _hover={onClick ? { bg: selected ? "wood.subtle" : "bg.muted" } : undefined}
      fontWeight={strong ? "semibold" : "normal"}
      fontSize={muted ? "xs" : "sm"}
      whiteSpace="nowrap"
      onClick={onClick}
      onMouseEnter={hover && link ? () => link.enter(hover) : undefined}
      onMouseLeave={hover && link ? () => link.leave(hover) : undefined}
    >
      {caret !== undefined ? (
        <chakra.button
          type="button"
          aria-label={caret === "▾" ? "Plegar" : "Desplegar"}
          aria-expanded={caret === "▾"}
          color="fg.muted"
          w={3}
          onClick={(e) => {
            e.stopPropagation()
            onCaret?.()
          }}
        >
          {caret}
        </chakra.button>
      ) : null}
      <TaulellIcon name={icon} size={muted ? "12px" : "15px"} />
      <Box flex={1} minW={0} truncate>
        {children}
      </Box>
      {end && (
        <Text as="span" fontFamily="mono" fontSize="xs" color="fg.muted" fontWeight="normal">
          {end}
        </Text>
      )}
    </HStack>
  )
}
