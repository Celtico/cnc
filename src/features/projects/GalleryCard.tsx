import { Card, HStack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * La targeta de totes les graelles (Mobles, Objectes, Ambients; historial, grups i catàleg), sempre en el mateix ordre:
 * miniatura 2:1 · nom (sempre dues línies d'alt, `.card-title`) · què és (`kicker`, opcional) · descripció (dues línies)
 * · etiquetes a l'esquerra i, a la dreta, un valor (`aside`: el preu) a baix de tot · peu (`footer`: data i ⋯ o
 * «Afegir»). Sense peu, tota la targeta és un botó; amb peu, només la part de dalt obre.
 */
export function GalleryCard({
  thumb,
  title,
  kicker,
  description,
  tags,
  aside,
  footer,
  onClick,
  selected,
  disabled,
}: {
  thumb: ReactNode
  title: string
  kicker?: string
  description?: ReactNode
  tags?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  /** Vora del color principal (el moble ja és a l'ambient obert). */
  selected?: boolean
  disabled?: boolean
}) {
  const body = (
    <Card.Body p={3} gap={2} alignItems="stretch" textAlign="left" cursor={onClick ? "pointer" : undefined} onClick={footer ? onClick : undefined}>
      {thumb}
      <Text className="card-title" fontWeight="semibold" fontSize="sm" lineClamp={2} title={title}>
        {title}
      </Text>
      {kicker && (
        <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" truncate mb={-1.5}>
          {kicker}
        </Text>
      )}
      {description && (
        <Text fontSize="xs" color="fg.muted" lineClamp={2} title={typeof description === "string" ? description : undefined}>
          {description}
        </Text>
      )}
      {(tags || aside) && (
        // A baix de tot (mt auto): a cada fila, les etiquetes i el preu queden a la mateixa altura.
        <HStack justify="space-between" gap={2} mt="auto" minW={0}>
          <HStack gap={1} wrap="wrap" minW={0}>
            {tags}
          </HStack>
          {aside}
        </HStack>
      )}
    </Card.Body>
  )
  const card = { variant: "outline" as const, size: "sm" as const, _hover: { borderColor: "wood.solid" }, borderColor: selected ? "wood.solid" : undefined, opacity: disabled ? 0.6 : 1 }
  if (footer)
    return (
      <Card.Root {...card}>
        {body}
        <Card.Footer px={3} pb={3} pt={0} gap={0.5} justifyContent="space-between">
          {footer}
        </Card.Footer>
      </Card.Root>
    )
  return (
    <Card.Root asChild {...card} cursor="pointer">
      <button type="button" onClick={onClick} disabled={disabled}>
        {body}
      </button>
    </Card.Root>
  )
}

/** Data del peu de les targetes («1 d'oct. del 2026»). */
export function CardDate({ at }: { at: number }) {
  return (
    <Text fontSize="xs" color="fg.subtle" truncate>
      {new Date(at).toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })}
    </Text>
  )
}
