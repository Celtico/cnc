import { Button, Card, Dialog, EmptyState, HStack, Heading, IconButton, Portal, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { useState } from "react"
import { LuCopy, LuHouse, LuPlus, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { EMPTY_AMBIENT, footprintCorners, parseAmbient, roomWalls, wallCorners, type Ambient } from "../../core/model"
import { createAmbient, db, deleteAmbient, duplicateAmbient, type AmbientRow } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"

/**
 * Ambients: plànols de la casa on es col·loquen els mobles (els de la llista, enllaçats) i
 * blocs senzills. Cada targeta és un ambient; «Ambient nou» en crea un amb una habitació de
 * 4 × 3 m per començar.
 */
export function AmbientsScreen({ onOpen }: { onOpen: (id: number) => void }) {
  const rows = useLiveQuery(() => db.ambients.orderBy("updatedAt").reverse().toArray(), [])
  const [toDelete, setToDelete] = useState<AmbientRow | null>(null)
  const create = async () => {
    const n = (await db.ambients.count()) + 1
    const data: Ambient = { ...EMPTY_AMBIENT, walls: roomWalls(0, 0, 4000, 3000) }
    onOpen(await createAmbient(`Ambient ${n}`, data))
  }
  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Ambients</Heading>
        <Button colorPalette="wood" onClick={() => void create()}>
          <LuPlus /> Ambient nou
        </Button>
      </HStack>
      <Text fontSize="sm" color="fg.muted" maxW="640px" mt={-3}>
        El plànol de la casa amb els mobles al seu lloc: dibuixa les parets (o posa-hi la imatge d'un plànol), col·loca-hi els teus mobles i blocs (sofà, llit, nevera…) i mira-ho en 3D.
      </Text>
      {rows === undefined ? null : rows.length === 0 ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuHouse />
            </EmptyState.Indicator>
            <VStack textAlign="center">
              <EmptyState.Title>Encara no tens cap ambient</EmptyState.Title>
              <EmptyState.Description>Crea'n un i hi dibuixes el plànol del pis o de l'habitació.</EmptyState.Description>
            </VStack>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, "2xl": 4 }} gap={4}>
          {rows.map((r) => {
            const a = parseAmbient(r.data)
            return (
              <Card.Root key={r.id} variant="outline">
                <Card.Body gap={1} cursor="pointer" onClick={() => onOpen(r.id)}>
                  <AmbientThumb a={a} />
                  <Card.Title mt={2}>{r.name}</Card.Title>
                  <Text color="fg.muted" fontSize="sm">
                    {a.walls.length} {a.walls.length === 1 ? "paret" : "parets"} · {a.items.length} {a.items.length === 1 ? "element" : "elements"}
                  </Text>
                  <Text color="fg.subtle" fontSize="xs">
                    Modificat el {new Date(r.updatedAt).toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </Card.Body>
                <Card.Footer justifyContent="flex-end" gap={2}>
                  <IconButton aria-label="Duplicar l'ambient" variant="ghost" onClick={() => void duplicateAmbient(r.id).then(() => toaster.create({ title: "Ambient duplicat", type: "success" }))}>
                    <LuCopy />
                  </IconButton>
                  <IconButton aria-label="Esborrar l'ambient" variant="ghost" colorPalette="red" onClick={() => setToDelete(r)}>
                    <LuTrash2 />
                  </IconButton>
                  <Button size="sm" colorPalette="wood" onClick={() => onOpen(r.id)}>
                    Obrir
                  </Button>
                </Card.Footer>
              </Card.Root>
            )
          })}
        </SimpleGrid>
      )}

      <Dialog.Root role="alertdialog" open={toDelete !== null} onOpenChange={(e) => !e.open && setToDelete(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar «{toDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Els mobles que hi ha no s'esborren: continuen a la llista de Mobles.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setToDelete(null)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    if (toDelete) void deleteAmbient(toDelete.id)
                    setToDelete(null)
                  }}
                >
                  <LuTrash2 /> Esborrar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  )
}

/** Miniatura: parets i elements (els mobles, amb una petjada aproximada). */
function AmbientThumb({ a }: { a: Ambient }) {
  const polys = [
    ...a.walls.map((w) => ({ pts: wallCorners(w), wall: true })),
    ...a.items.map((it) => ({ pts: footprintCorners(it.x, it.y, it.kind === "block" ? it.w : 800, it.kind === "block" ? it.d : 500, it.rot), wall: false })),
  ]
  const xs = polys.flatMap((p) => p.pts.map((q) => q[0])), ys = polys.flatMap((p) => p.pts.map((q) => q[1]))
  const x0 = Math.min(0, ...xs), y0 = Math.min(0, ...ys), x1 = Math.max(1000, ...xs), y1 = Math.max(1000, ...ys)
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} style={{ width: "100%", height: 120, background: "var(--chakra-colors-bg-subtle)", borderRadius: 6 }} aria-hidden>
      {polys.map((p, i) => (
        <polygon key={i} points={p.pts.map((q) => q.join(",")).join(" ")} fill={p.wall ? "var(--chakra-colors-fg)" : "var(--chakra-colors-wood-muted)"} stroke={p.wall ? "none" : "var(--chakra-colors-wood-solid)"} strokeWidth={(x1 - x0) / 300} />
      ))}
    </svg>
  )
}
