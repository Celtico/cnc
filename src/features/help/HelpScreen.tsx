import { Box, HStack, Kbd, Stack, Text, VStack } from "@chakra-ui/react"
import { Fragment } from "react"
import { LuKeyboard, LuMousePointer2, LuMove3D } from "react-icons/lu"
import { PageHeader } from "../../components/PageHeader"
import { SettingsGroup } from "../../components/SettingsGroup"

/** ⌘ al Mac, Ctrl a la resta. */
const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOD = MAC ? "⌘" : "Ctrl"
const ALT = MAC ? "⌥" : "Alt"
const SHIFT = MAC ? "⇧" : "Maj"

/** Una drecera: les tecles (cada llista, una combinació; diverses llistes, alternatives) i què fa. */
type Shortcut = { keys: string[][]; what: string }

const GROUPS: { title: string; icon: React.ReactNode; summary: string; items: Shortcut[] }[] = [
  {
    title: "Editar",
    icon: <LuKeyboard />,
    summary: "Al Moble i a Modelatge, amb un mòdul, un compartiment, una peça o diversos triats.",
    items: [
      { keys: [[MOD, "Z"]], what: "Desfer" },
      { keys: [[MOD, SHIFT, "Z"], [MOD, "Y"]], what: "Refer" },
      { keys: [[MOD, "C"]], what: "Copiar (es pot enganxar en un altre moble)" },
      { keys: [[MOD, "X"]], what: "Retallar" },
      { keys: [[MOD, "V"]], what: "Enganxar" },
      { keys: [[MOD, ALT, "V"]], what: "Enganxar les propietats del mòdul copiat al mòdul triat (es queda on és i amb les seves mides)" },
      { keys: [[MOD, "D"]], what: "Duplicar" },
      { keys: [[MOD, "G"]], what: "Agrupar els triats" },
      { keys: [[MOD, SHIFT, "G"]], what: "Desagrupar" },
      { keys: [["Supr"], ["⌫"]], what: "Esborrar" },
      { keys: [["Esc"]], what: "Deixar l'eina activa (Modelatge)" },
    ],
  },
  {
    title: "Moure",
    icon: <LuMove3D />,
    summary: "Les fletxes del 3D s'imanten a les vores de les altres peces i mobles.",
    items: [
      { keys: [[ALT, "arrossegar"]], what: "Moure o estirar sense imant" },
      { keys: [[SHIFT, "arrossegar"]], what: "Moure el moble sencer (tots els mòduls junts)" },
      { keys: [["←"], ["→"], ["↑"], ["↓"]], what: "Moure la peça o l'objecte triat 1 mm (X i Y)" },
      { keys: [["Re Pàg"], ["Av Pàg"]], what: "Moure'l 1 mm endavant o endarrere (Z)" },
      { keys: [[SHIFT, "fletxa"]], what: "Moure'l 10 mm" },
    ],
  },
  {
    title: "Triar i mirar",
    icon: <LuMousePointer2 />,
    summary: "A l'arbre i al 3D.",
    items: [
      { keys: [[MOD, "clic"], [SHIFT, "clic"]], what: "Afegir o treure de la selecció" },
      { keys: [[MOD, "arrossegar"]], what: "Desplaçar la vista (al 3D)" },
      { keys: [["roda"]], what: "Apropar i allunyar" },
      { keys: [["clic al buit"]], what: "Deseleccionar, i treure la mida del làser" },
    ],
  },
]

/** Ajuda (cel, 2026-11-08): de moment, les dreceres de teclat. */
export function HelpScreen() {
  return (
    <VStack align="stretch" gap={5}>
      <PageHeader title="Ajuda" description="Les dreceres de teclat per treballar més de pressa: moure sense imant, copiar propietats, duplicar, desfer…" />
      <Stack gap={5} maxW="900px">
        {GROUPS.map((g) => (
          <SettingsGroup key={g.title} icon={g.icon} title={g.title} summary={g.summary}>
            <Stack gap={0} px={6} py={2}>
              {g.items.map((s, i) => (
                <HStack key={s.what} justify="space-between" gap={6} py={2.5} borderTopWidth={i ? "1px" : 0}>
                  <Text fontSize="sm">{s.what}</Text>
                  <HStack gap={1.5} flexShrink={0} flexWrap="wrap" justify="flex-end">
                    {s.keys.map((combo, k) => (
                      <Fragment key={k}>
                        {k > 0 && (
                          <Text as="span" fontSize="xs" color="fg.muted">
                            o
                          </Text>
                        )}
                        <Box display="inline-flex" gap={1}>
                          {combo.map((key) => (
                            <Kbd key={key} size="sm">
                              {key}
                            </Kbd>
                          ))}
                        </Box>
                      </Fragment>
                    ))}
                  </HStack>
                </HStack>
              ))}
            </Stack>
          </SettingsGroup>
        ))}
      </Stack>
    </VStack>
  )
}
