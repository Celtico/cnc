import { Badge, Box, Button, Card, Clipboard, HStack, Stack, Text, Wrap } from "@chakra-ui/react"
import { LuBox, LuCheck, LuCopy, LuLayers2 } from "react-icons/lu"
import type { KitGroup } from "../../core/build/kitOrders"
import { fmtNum } from "../../lib/format"

/**
 * El títol del grup («DTC MAGIC-PRO HT14 F · NL 550 · Tancament suau · … · 4 calaixos (mòduls 2, 4)») partit per pintar-lo:
 * el primer tros en negreta, la resta com a etiquetes i els mòduls a part.
 */
function titleParts(title: string): { name: string; tags: string[]; where?: string } {
  const m = /^(.*) \((mòduls? [^)]+)\)$/.exec(title)
  const [name = title, ...tags] = (m ? m[1]! : title).split(" · ")
  return { name, tags, ...(m ? { where: m[2]! } : {}) }
}

/** El número d'article en una pastilla monoespaiada: tocar-la el copia. */
function ItemRef({ item }: { item: string }) {
  return (
    <Clipboard.Root value={item}>
      <Clipboard.Trigger asChild>
        <Button size="xs" variant="subtle" colorPalette="wood" fontFamily="mono" fontWeight="semibold" letterSpacing="tight" title="Copiar el número d'article" aria-label={`Copiar ${item}`}>
          {item}
          <Clipboard.Indicator copied={<LuCheck />} color="fg.muted">
            <LuCopy />
          </Clipboard.Indicator>
        </Button>
      </Clipboard.Trigger>
    </Clipboard.Root>
  )
}

/** La comanda d'un joc (calaix, ferratges d'un mòdul o llum): capçalera, una fila per component i la fusta per calaix. */
export function KitOrderCard({ group: g }: { group: KitGroup }) {
  const { name, tags, where } = titleParts(g.title)
  return (
    <Card.Root variant="outline" size="sm" overflow="hidden">
      <Card.Header bg="bg.muted" py={3} gap={2}>
        <Text fontWeight="semibold" fontSize="md" lineHeight="short">
          {name}
        </Text>
        {(tags.length > 0 || where) && (
          <Wrap gap={1.5}>
            {tags.map((t, i) => (
              <Badge key={i} variant={i === tags.length - 1 && g.drawers > 0 ? "solid" : "surface"} colorPalette={i === tags.length - 1 && g.drawers > 0 ? "wood" : "gray"} size="sm">
                {t}
              </Badge>
            ))}
            {where && (
              <Badge variant="outline" colorPalette="wood" size="sm">
                <LuBox /> {where}
              </Badge>
            )}
          </Wrap>
        )}
      </Card.Header>
      <Card.Body p={0}>
        <Stack gap={0} separator={<Box borderTopWidth="1px" borderColor="border.muted" />}>
          {g.lines.map((l, i) => {
            const note = [l.cutLength !== undefined ? `tallar a ${fmtNum(l.cutLength)} mm` : "", l.note ?? ""].filter(Boolean).join(" · ")
            return (
              <HStack key={i} align="start" gap={3} px={4} py={2.5}>
                <Text fontWeight="bold" fontSize="md" minW="2.5rem" textAlign="end" fontVariantNumeric="tabular-nums" color="wood.fg" lineHeight="1.75rem">
                  {l.qty}×
                </Text>
                <Stack gap={1} flex={1} minW={0} direction={{ base: "column", md: "row" }} align={{ base: "start", md: "start" }} justify="space-between">
                  <Stack gap={0.5} minW={0} maxW="42rem">
                    <Text fontWeight="medium" lineHeight="1.75rem">
                      {l.name}
                    </Text>
                    {note && (
                      <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                        {note}
                      </Text>
                    )}
                  </Stack>
                  {l.item ? (
                    <Box flexShrink={0}>
                      <ItemRef item={l.item} />
                    </Box>
                  ) : (
                    <Text fontSize="xs" color="fg.subtle" flexShrink={0} lineHeight="1.75rem">
                      sense número d'article
                    </Text>
                  )}
                </Stack>
              </HStack>
            )
          })}
        </Stack>
      </Card.Body>
      {(g.woodParts?.length || g.wood) && (
        <Card.Footer borderTopWidth="1px" borderColor="border.muted" bg="bg.subtle" py={3} flexDirection="column" alignItems="stretch" gap={2}>
          {g.woodParts?.length ? (
            <>
              <HStack gap={1.5} fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                <LuLayers2 /> Fusta per calaix
              </HStack>
              <Wrap gap={2}>
                {g.woodParts.map((w) => (
                  <Stack key={w.key} gap={0} borderWidth="1px" rounded="md" bg="bg.panel" px={3} py={1.5}>
                    <Text fontSize="sm" fontWeight="medium">
                      {w.name}
                    </Text>
                    <Text fontSize="sm" fontFamily="mono" color="fg.muted">
                      {fmtNum(w.width)} × {fmtNum(w.depth ?? w.height ?? 0)} × {fmtNum(w.thickness)} mm
                    </Text>
                    {w.note && (
                      <Text fontSize="xs" color="fg.subtle">
                        {w.note}
                      </Text>
                    )}
                  </Stack>
                ))}
              </Wrap>
            </>
          ) : (
            <Text fontSize="xs" color="fg.muted" maxW="42rem">
              {g.wood}
            </Text>
          )}
        </Card.Footer>
      )}
    </Card.Root>
  )
}
