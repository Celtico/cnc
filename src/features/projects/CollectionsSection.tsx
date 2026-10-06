import { Badge, Box, Button, CloseButton, Drawer, HStack, Link, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuExternalLink, LuLibrary, LuPlus } from "react-icons/lu"
import type { CollectionPiece, FurnitureCollection, Grade, PieceStudy } from "../../core/model"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { GALLERY_COLS } from "./galleryGrid"
import { TemplateCard } from "./NewMobleGallery"

/** Files de la fitxa d'estudi, en l'ordre dels criteris de la biblioteca. */
const ROWS: [keyof PieceStudy, string][] = [
  ["reference", "Referència"],
  ["family", "Família"],
  ["language", "Llenguatge formal"],
  ["geometry", "Geometria"],
  ["proportions", "Proporcions"],
  ["materials", "Materials"],
  ["finishes", "Acabats"],
  ["combination", "Combinació de materials"],
  ["surfaces", "Superfícies"],
  ["thickness", "Gruixos i volums"],
  ["hardware", "Ferratges"],
  ["feeling", "Sensació visual"],
  ["architecture", "Relació amb l'espai"],
  ["quality", "Percepció de qualitat"],
  ["sizes", "Mides de la família"],
  ["finishOptions", "Acabats possibles"],
]

const GRADES: [keyof PieceStudy, string][] = [
  ["minimalism", "Minimalisme"],
  ["sophistication", "Sofisticació"],
  ["warmth", "Calidesa"],
  ["functionality", "Funcionalitat"],
]

/** Grau d'1 a 5 com cinc punts (els plens, del color principal). */
function GradeDots({ value, label }: { value: Grade; label: string }) {
  return (
    <HStack gap={1} aria-label={`${label}: ${value} de 5`} title={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box key={i} w="8px" h="8px" rounded="full" bg={i <= value ? "wood.solid" : "bg.emphasized"} />
      ))}
    </HStack>
  )
}

/** Fitxa d'una peça: tots els criteris d'estudi i «Crear el moble». */
function PieceSheet({ piece, onClose, onCreate }: { piece: CollectionPiece | null; onClose: () => void; onCreate: (p: CollectionPiece) => void }) {
  const s = piece?.study
  return (
    <Drawer.Root open={!!piece} onOpenChange={(e) => !e.open && onClose()} placement={{ base: "bottom", md: "end" }} size={{ base: "full", md: "md" }}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop={{ base: "l3", md: "none" }} maxH={{ base: "90dvh", md: "none" }} pb="env(safe-area-inset-bottom, 0px)">
            {piece && s && (
              <>
                <Drawer.Header pt={{ base: 4, md: "calc(var(--chakra-spacing-4) + env(safe-area-inset-top, 0px))" }} flexDirection="column" alignItems="start" gap={1}>
                  <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                    {piece.type}
                  </Text>
                  <Drawer.Title>{piece.name.replace(`${piece.type} `, "")}</Drawer.Title>
                  <Text fontSize="sm" color="fg.muted">
                    {piece.description}
                  </Text>
                </Drawer.Header>
                <Drawer.Body>
                  <Stack gap={5}>
                    <Button colorPalette="wood" size="sm" alignSelf="start" onClick={() => onCreate(piece)}>
                      <LuPlus /> Crear el moble
                    </Button>
                    <SimpleGrid columns={2} gap={3}>
                      {GRADES.map(([k, label]) => (
                        <Stack key={k} gap={1}>
                          <Text fontSize="xs" color="fg.muted">
                            {label}
                          </Text>
                          <GradeDots value={s[k] as Grade} label={label} />
                        </Stack>
                      ))}
                    </SimpleGrid>
                    <Stack gap={0} borderTopWidth="1px">
                      {ROWS.filter(([k]) => s[k]).map(([k, label]) => (
                        <Stack key={k} gap={0.5} py={2.5} borderBottomWidth="1px">
                          <Text fontSize="xs" color="fg.muted">
                            {label}
                          </Text>
                          <Text fontSize="sm">{String(s[k])}</Text>
                        </Stack>
                      ))}
                    </Stack>
                    {!!s.photos?.length && (
                      <Stack gap={1}>
                        <Text fontSize="xs" color="fg.muted">
                          Fotos de referència (carpeta «referencies»)
                        </Text>
                        {s.photos.map((p) => (
                          <Text key={p} fontSize="xs" fontFamily="mono" wordBreak="break-all">
                            {p}
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Drawer.Body>
              </>
            )}
            <Drawer.CloseTrigger asChild top={{ base: 3, md: "calc(var(--chakra-spacing-3) + env(safe-area-inset-top, 0px))" }}>
              <CloseButton size="sm" aria-label="Tancar" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

/** Capçalera d'una col·lecció: què s'hi estudia i les referències. */
function CollectionIntro({ c }: { c: FurnitureCollection }) {
  return (
    <Stack gap={2} px="var(--gallery-px, 0)" pb={3}>
      <Text fontSize="sm">{c.description}</Text>
      <Stack as="ul" gap={0.5} ps={4} fontSize="xs" color="fg.muted" listStyleType="disc">
        {c.principles.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </Stack>
      <HStack gap={1.5} wrap="wrap">
        {c.references.map((r) => (
          <Badge key={r.name} asChild size="sm" variant="outline" colorPalette="gray" title={r.note}>
            <Link href={r.url} target="_blank" rel="noreferrer">
              {r.name} <LuExternalLink />
            </Link>
          </Badge>
        ))}
      </HStack>
    </Stack>
  )
}

/**
 * Secció «Col·leccions de mobles» de la pàgina Mobles (després del Catàleg): biblioteca de referències per a una
 * col·lecció pròpia. Un acordió per col·lecció amb els principis, les referències i les peces paramètriques; tocar una
 * peça obre la seva fitxa d'estudi, i des d'allà es crea el moble.
 */
export function CollectionsSection({
  value,
  collections,
  searching,
  open,
  onOpenChange,
  onCreate,
}: {
  value: string
  /** Col·leccions amb les peces que passen la cerca. */
  collections: FurnitureCollection[]
  searching: boolean
  open: string[]
  onOpenChange: (v: string[]) => void
  onCreate: (p: CollectionPiece) => void
}) {
  const [sheet, setSheet] = useState<CollectionPiece | null>(null)
  const shown = collections.filter((c) => c.pieces.length > 0)
  return (
    <>
      <FoldItem id={value} icon={LuLibrary} title="Col·leccions de mobles" count={shown.reduce((n, c) => n + c.pieces.length, 0)}>
        <Stack gap={3}>
          <Text fontSize="xs" color="fg.muted" px="var(--gallery-px, 0)" pt={3}>
            Biblioteca de referències per dissenyar una col·lecció pròpia: peces paramètriques amb la fitxa d'estudi (llenguatge, proporcions, materials, gruixos, ferratges i graus). Toca'n una per veure la fitxa.
          </Text>
          <FoldGroup variant="nested" value={open} onValueChange={onOpenChange} forceOpen={searching ? shown.map((c) => c.id) : null}>
            {shown.map((c) => (
              <FoldItem key={c.id} id={c.id} title={c.name} count={c.pieces.length}>
                {!searching && <CollectionIntro c={c} />}
                <SimpleGrid columns={GALLERY_COLS} gap={3}>
                  {c.pieces.map((p) => (
                    <TemplateCard key={p.id} t={p} kicker={p.type} title={p.name.replace(`${p.type} `, "")} onPick={() => setSheet(p)} />
                  ))}
                </SimpleGrid>
              </FoldItem>
            ))}
          </FoldGroup>
        </Stack>
      </FoldItem>
      <PieceSheet
        piece={sheet}
        onClose={() => setSheet(null)}
        onCreate={(p) => {
          setSheet(null)
          onCreate(p)
        }}
      />
    </>
  )
}
