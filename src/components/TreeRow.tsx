import { Box, HStack, IconButton, Menu, Portal, Spinner, Text } from "@chakra-ui/react"
import { useEffect, useRef, type ReactNode } from "react"
import { LuEllipsis, LuEye, LuEyeOff, LuLock, LuLockOpen, LuPlus } from "react-icons/lu"
import { SectionLabel } from "./SectionLabel"

/**
 * Fila i títol de grup dels arbres (com l'outliner de Figma o Fusion): l'Estructura de l'editor (`StructureTree`) i la
 * llista dels Ambients fan servir aquestes, no còpies (mateix sagnat, color de selecció, cursor, menú ⋯ i fletxa de plegar).
 */

export interface TreeRowDnd {
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

/**
 * L'ull i el cadenat de la fila (com Figma): amagar a l'editor i no deixar moure. Surten en passar per sobre i sempre que
 * estan actius. Per a un grup, l'estat del grup (amagat / bloquejat si ho són tots).
 */
export interface TreeRowFlags {
  hidden?: boolean
  locked?: boolean
  onHide: () => void
  onLock: () => void
}

/** A les pantalles tàctils (sense «passar per sobre»), l'ull i el cadenat sempre a la vista. */
const TOUCH_VISIBLE = { "@media (hover: none)": { opacity: 1 } }

/** Indicador de la fila de destí: línia abans/després, o la fila marcada si hi entra (grup). */
export type DropIndicator = "before" | "after" | "inside" | null

export function TreeRow({
  icon,
  iconColor,
  label,
  hint,
  selected,
  highlighted,
  onClick,
  depth,
  bold,
  muted,
  menu,
  onToggle,
  toggleLabel,
  dnd,
  flags,
}: {
  /** L'ull (veure / amagar) i el cadenat (no es pot moure). */
  flags?: TreeRowFlags
  /** Arrossegar per ordenar: la fila es pot agafar i deixar abans/després d'una altra. */
  dnd?: TreeRowDnd
  /** Si hi és, la icona és una fletxa que plega/desplega sense seleccionar la fila. */
  onToggle?: () => void
  toggleLabel?: string
  icon: ReactNode
  /** Color de la icona quan la fila no està triada (per defecte `fg.muted`). */
  iconColor?: string
  label: string
  hint?: string
  selected: boolean
  /** Fila d'un grup triat (tota la fila amb fons suau, sense ser la selecció). */
  highlighted?: boolean
  onClick: () => void
  depth: number
  bold?: boolean
  muted?: boolean
  menu?: ReactNode
}) {
  // Triat des d'un altre lloc (el 3D, l'alçat): la fila es fa veure a l'arbre (el grup plegat ja s'obre, `useOpenGroups`).
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest" })
  }, [selected])
  return (
    <HStack
      ref={ref}
      role="treeitem"
      aria-selected={selected}
      gap={2}
      pl={`${depth * 14 + 6}px`}
      pr={1}
      py={1}
      rounded="md"
      bg={selected ? "wood.muted" : highlighted ? "bg.muted" : undefined}
      color={selected ? "wood.fg" : muted || flags?.hidden ? "fg.muted" : "fg"}
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
        <Box flexShrink={0} fontSize="sm" color={selected ? "wood.fg" : (iconColor ?? "fg.muted")}>
          {icon}
        </Box>
      )}
      <Text flex="1 1 auto" minW={0} truncate fontWeight={bold || selected ? "semibold" : "normal"} title={label}>
        {label}
      </Text>
      {/* Mides arrodonides al mm i, si no hi caben, tallades primer: el nom té preferència. */}
      {hint && (
        <Text fontSize="xs" color="fg.subtle" flexShrink={4} minW={0} maxW="45%" truncate>
          {hint}
        </Text>
      )}
      {flags && (
        <HStack gap={0} flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <IconButton aria-label={flags.locked ? `Desbloquejar «${label}»` : `Bloquejar «${label}»`} title={flags.locked ? "Bloquejat: no es pot moure" : "Bloquejar (que no es pugui moure)"} size="2xs" variant="ghost" opacity={flags.locked ? 1 : 0} _groupHover={{ opacity: 1 }} _focusVisible={{ opacity: 1 }} css={TOUCH_VISIBLE} onClick={flags.onLock}>
            {flags.locked ? <LuLock /> : <LuLockOpen />}
          </IconButton>
          <IconButton aria-label={flags.hidden ? `Mostrar «${label}»` : `Amagar «${label}»`} title={flags.hidden ? "Amagat a l'editor (es fabrica igual)" : "Amagar a l'editor"} size="2xs" variant="ghost" opacity={flags.hidden ? 1 : 0} _groupHover={{ opacity: 1 }} _focusVisible={{ opacity: 1 }} css={TOUCH_VISIBLE} onClick={flags.onHide}>
            {flags.hidden ? <LuEyeOff /> : <LuEye />}
          </IconButton>
        </HStack>
      )}
      {menu && (
        <Box flexShrink={0} opacity={selected ? 1 : 0} _groupHover={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
          {menu}
        </Box>
      )}
    </HStack>
  )
}

/** Menú ⋯ d'una fila de l'arbre (surt en passar per sobre o amb la fila triada). */
export function TreeRowMenu({ label, children }: { label: string; children: ReactNode }) {
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

/**
 * Títol d'un grup de l'arbre (mòduls, peces lliures, objectes de referència, models 3D; mobles i objectes d'un ambient)
 * amb el seu + per afegir-ne. `menu`: el + obre un menú; `hideAdd`: només el títol.
 */
export function TreeSection({ children, onAdd, addLabel, busy, menu, hideAdd }: { children: ReactNode; onAdd?: () => void; addLabel?: string; busy?: boolean; menu?: ReactNode; hideAdd?: boolean }) {
  // Sense + (grup que ja no s'ofereix en aquest tipus de document però que encara en té): només el títol.
  if (hideAdd || !addLabel)
    return (
      <HStack pt={3} pb={1} px={1} minH="6">
        <SectionLabel>{children}</SectionLabel>
      </HStack>
    )
  const plus = (
    <IconButton aria-label={addLabel} title={busy ? "Optimitzant el model…" : addLabel} size="2xs" variant="ghost" onClick={onAdd} disabled={busy} aria-busy={busy}>
      {busy ? <Spinner size="xs" /> : <LuPlus />}
    </IconButton>
  )
  return (
    <HStack justify="space-between" pt={3} pb={1} px={1}>
      <SectionLabel>{children}</SectionLabel>
      {/* Amb `menu`, el + obre un menú (les opcions per afegir-ne); si no, afegeix directament. */}
      {menu ? (
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>{plus}</Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxW="340px" maxH="70vh" overflowY="auto">
                {menu}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : (
        plus
      )}
    </HStack>
  )
}
