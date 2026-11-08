import { Box, chakra, HStack, Text } from "@chakra-ui/react"
import { useEffect, useState, type ReactNode } from "react"
import { hoverKey, useHoverLink } from "../../components/hoverLink"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { type Composition, type Panel, type PieceEdit } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { TaulellIcon } from "./TaulellIcon"
import { machiningRows, modulePieces, withoutRow } from "./modelingPieces"
import type { TaulellIconName } from "./taulellIcons"
import { LuEye, LuEyeOff } from "react-icons/lu"

/**
 * L'arbre de Modelatge, com el del Taulell (cel, 2026-11-07: «l'estructura d'aquell arbre, fes-la igual»): cada moble (amb
 * la seva mida) i, desplegat, les seves peces numerades (moble.peça: «1.01 Lateral esquerre») amb els mecanitzats a sota;
 * després, les peces soltes («S.01»). Clicar un moble o una de les seves peces tria el moble (les opcions, a la dreta);
 * clicar una peça solta, la peça. La peça triada d'un moble (`piece`) la mostra `PieceInspector` a la dreta.
 */
export function ModelingTree({ comp, build, selection, onSelect, piece, setPiece, sketchSel, onSketch, onRemoveSketch, hiddenPieces, onToggleHidden, onPieceEdit }: { comp: Composition; build: CompositionBuild | undefined; selection: Selection; onSelect: (s: Selection) => void; piece: string | null; setPiece: (id: string | null) => void; sketchSel?: string; onSketch: (id: string | undefined) => void; onRemoveSketch: (id: string) => void; hiddenPieces?: string[]; onToggleHidden: (kind: "module" | "piece" | "part", id: string) => void; onPieceEdit: (moduleId: string, panelId: string, f: (cur: PieceEdit | undefined) => PieceEdit) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(comp.modules.slice(0, 1).map((m) => m.id)))
  const link = useHoverLink()
  // Una peça triada al 3D: el seu moble es desplega.
  const pieceModule = piece && selection.kind === "module" ? selection.id : null
  useEffect(() => {
    if (pieceModule) setOpen((s) => (s.has(pieceModule) ? s : new Set([...s, pieceModule])))
  }, [pieceModule, piece])
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const panels = build?.panels ?? []
  const free = comp.parts ?? []
  const sketches = comp.sketches ?? []
  if (!comp.modules.length && !free.length && !sketches.length)
    return (
      <Text fontSize="sm" color="fg.muted" px={2} py={3}>
        El model és buit. Fes «Nou moble» a la barra d'eines.
      </Text>
    )

  const pieceRow = (p: Panel, code: string, sel: boolean, onClick: () => void, hover?: string, moduleId?: string, eye?: Eye) => (
    <Box key={p.id}>
      <Row level={1} icon="panel" selected={sel} onClick={onClick} hover={hover} link={link} eye={eye}>
        <Code>{code}</Code>
        {p.label}
      </Row>
      {machiningRows(p).map((r) => (
        <Row key={r.key} level={2} icon="feat" muted onRemove={moduleId && (r.drop || r.hand) ? () => onPieceEdit(moduleId, p.id, (cur) => withoutRow(cur, r)) : undefined}>
          {r.label}
        </Row>
      ))}
    </Box>
  )

  return (
    <Box fontSize="sm" role="tree" aria-label="Arbre del model">
      {comp.modules.map((m, i) => {
        const own = modulePieces(panels, i)
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
              eye={{ hidden: !!m.hidden, onToggle: () => onToggleHidden("module", m.id) }}
            >
              {m.name}
            </Row>
            {isOpen &&
              own.map(({ panel: p, code }) =>
                pieceRow(p, code, piece === p.id && selection.kind === "module" && selection.id === m.id, () => {
                  setPiece(p.id)
                  onSelect({ kind: "module", id: m.id })
                }, undefined, m.id, { hidden: !!m.hidden || !!hiddenPieces?.includes(p.id), onToggle: () => onToggleHidden("piece", p.id) }),
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
            }, hoverKey("part", part.id), undefined, { hidden: !!part.hidden, onToggle: () => onToggleHidden("part", part.id) })
          })}
        </>
      )}
      {sketches.length > 0 && (
        <>
          <Row level={0} icon="poly" strong>
            Croquis ({sketches.length})
          </Row>
          {sketches.map((k) => (
            <Row key={k.id} level={1} icon={k.rect ? "rect" : k.pts.length === 48 ? "circle" : "poly"} selected={sketchSel === k.id} onClick={() => onSketch(sketchSel === k.id ? undefined : k.id)} onRemove={() => onRemoveSketch(k.id)}>
              {k.name}
            </Row>
          ))}
        </>
      )}
    </Box>
  )
}

/** L'ull d'una fila (amagar o mostrar al 3D, com al Taulell). */
type Eye = { hidden: boolean; onToggle: () => void }

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
  onRemove,
  eye,
}: {
  eye?: Eye
  onRemove?: () => void
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
      {eye && (
        <chakra.button type="button" aria-label={eye.hidden ? "Mostrar" : "Amagar"} title={eye.hidden ? "Mostrar" : "Amagar"} color={eye.hidden ? "fg.muted" : "fg.subtle"} opacity={eye.hidden ? 1 : 0.6} _hover={{ color: "fg", opacity: 1 }} onClick={(e) => (e.stopPropagation(), eye.onToggle())}>
          {eye.hidden ? <LuEyeOff size={13} /> : <LuEye size={13} />}
        </chakra.button>
      )}
      {onRemove && (
        <chakra.button type="button" aria-label="Treure" title="Treure" color="fg.muted" px={1} _hover={{ color: "fg" }} onClick={(e) => (e.stopPropagation(), onRemove())}>
          ✕
        </chakra.button>
      )}
      {end && (
        <Text as="span" fontFamily="mono" fontSize="xs" color="fg.muted" fontWeight="normal">
          {end}
        </Text>
      )}
    </HStack>
  )
}
