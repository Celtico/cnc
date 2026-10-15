import { Alert, Badge, Box, Button, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuCheck, LuCopy, LuFileUp, LuPlus } from "react-icons/lu"
import type { MaterialPref } from "../../core/model"
import { MaterialPreview } from "./MaterialBits"
import { MATERIAL_LIBRARY, ownedMaterial, type LibraryItem } from "./libraryItems"
import { FloatingWindow } from "../../components/FloatingWindow"
import { SectionLabel } from "../../components/SectionLabel"

/**
 * Finestra «Afegir material» (`FloatingWindow`): la biblioteca de materials fets en graella (i «En blanc» per començar de zero). Els que ja
 * tens (mateix nom o mateix acabat, `ownedMaterial`) porten «Ja el tens»: tocar-ne un no en fa un «X 2» sense dir res,
 * sinó que ofereix obrir el teu o afegir-ne una còpia igualment.
 */
export function MaterialLibrary({ open, onClose, onPick, onBlank, onTextureSet, materials, onOpenExisting }: { open: boolean; onClose: () => void; onPick: (m: LibraryItem) => void; onBlank: () => void; /** «Joc de textures…»: un material nou amb un joc PBR (el .zip de Poly Haven, fitxers…). */ onTextureSet: () => void; materials: readonly MaterialPref[]; onOpenExisting: (id: string) => void }) {
  const groups = [...new Set(MATERIAL_LIBRARY.map((m) => m.group))]
  const owned = useMemo(() => new Map(MATERIAL_LIBRARY.map((m) => [m.name, ownedMaterial(m, materials)])), [materials])
  const [ask, setAsk] = useState<{ item: LibraryItem; mine: MaterialPref } | null>(null)
  const close = () => {
    setAsk(null)
    onClose()
  }
  return (
    <FloatingWindow
      id="material-library"
      open={open}
      onClose={close}
      title="Afegir un material"
      width={900}
      footer={
        ask ? (
          <Stack gap={3} w="full">
            <Alert.Root status="info" size="sm">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  {ask.mine.name === ask.item.name ? `Ja tens «${ask.mine.name}».` : `«${ask.item.name}» és igual que el teu «${ask.mine.name}».`} El vols obrir o n'afegeixes una còpia?
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
            <HStack justify="flex-end" gap={2} wrap="wrap">
              <Button variant="ghost" onClick={() => setAsk(null)}>
                Tornar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onPick(ask.item)
                  close()
                }}
              >
                <LuCopy /> Afegir una còpia
              </Button>
              <Button
                colorPalette="wood"
                onClick={() => {
                  onOpenExisting(ask.mine.id)
                  close()
                }}
              >
                Obrir el meu
              </Button>
            </HStack>
          </Stack>
        ) : (
        <>
          <Button
            variant="ghost"
            mr="auto"
            onClick={() => {
              onBlank()
              close()
            }}
          >
            <LuPlus /> En blanc
          </Button>
          <Button
            variant="ghost"
            title="Un material amb foto, relleu i brillantor: el .zip de textures de Poly Haven tal com es baixa (qualsevol format, també amb EXR), una carpeta o els fitxers."
            onClick={() => {
              close()
              onTextureSet()
            }}
          >
            <LuFileUp /> Joc de textures…
          </Button>
          <Button variant="outline" onClick={close}>
            Cancel·lar
          </Button>
        </>
        )
      }
    >
      <Stack gap={6}>
        <Text fontSize="sm" color="fg.muted">
          Tria'n un de fet: queda afegit amb la seva categoria, gruixos i cantell. Després el pots retocar amb «Editar la textura». Amb «Joc de textures…», un de teu a partir d'un joc PBR (el .zip de textures de Poly Haven tal com es baixa, fitxers o una carpeta).
        </Text>
        {groups.map((g) => (
          <Stack key={g} gap={2}>
            <SectionLabel>
              {g}
            </SectionLabel>
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={3}>
              {MATERIAL_LIBRARY.filter((m) => m.group === g).map((m) => {
                const mine = owned.get(m.name)
                return (
                <Box
                  key={m.name}
                  as="button"
                  textAlign="left"
                  rounded="md"
                  p={1.5}
                  borderWidth="1px"
                  borderColor="transparent"
                  _hover={{ borderColor: "wood.solid", bg: "bg.muted" }}
                  aria-label={mine ? `${m.name} (ja el tens: ${mine.name})` : m.name}
                  onClick={() => {
                    if (mine) {
                      setAsk({ item: m, mine })
                      return
                    }
                    onPick(m)
                    close()
                  }}
                >
                  <Box position="relative">
                    <MaterialPreview m={{ ...m, id: m.name } as MaterialPref} w={150} h={90} caption={false} />
                    {mine && (
                      <Badge position="absolute" top={1.5} left={1.5} size="xs" colorPalette="wood" variant="solid" title={`Ja el tens: «${mine.name}»`}>
                        <LuCheck /> Ja el tens
                      </Badge>
                    )}
                  </Box>
                  <Text fontSize="sm" fontWeight="medium" mt={1.5} truncate>
                    {m.name}
                  </Text>
                </Box>
                )
              })}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </FloatingWindow>
  )
}
