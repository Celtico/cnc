import { useTheme } from "next-themes"
import { Box, HStack } from "@chakra-ui/react"
import { LuCheck, LuMonitor, LuMoon, LuSun } from "react-icons/lu"
import { ACCENTS, useAccent } from "../../../theme/accent"
import { ChoiceChips, FormRow } from "../../../components/FormRow"

/**
 * Aparença (clar / fosc / com el sistema). És una preferència del dispositiu, no de les
 * dades: la desa next-themes al navegador, no s'exporta amb les preferències.
 */
export function ThemeField() {
  const { theme, setTheme } = useTheme()
  return (
    <FormRow label="Tema">
      {/* Pastilles que salten de línia (el control segmentat es desbordava al mòbil). */}
      <ChoiceChips
        label="Tema"
        value={(theme ?? "system") as "light" | "dark" | "system"}
        onChange={setTheme}
        options={[
          { id: "light", label: <><LuSun /> Dia</> },
          { id: "dark", label: <><LuMoon /> Nit</> },
          { id: "system", label: <><LuMonitor /> Sistema</> },
        ]}
      />
    </FormRow>
  )
}

export function AccentField() {
  const [accent, setAccent] = useAccent()
  return (
    <FormRow label="Color principal" help="Botons, seleccions i ressaltats.">
      <HStack gap={2} wrap="wrap" role="radiogroup" aria-label="Color principal">
        {ACCENTS.map((a) => {
          const on = a.id === accent
          return (
            <Box
              key={a.id}
              asChild
              w="36px"
              h="36px"
              rounded="full"
              borderWidth="2px"
              borderColor={on ? "fg" : "transparent"}
              p="3px"
            >
              <button type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label} onClick={() => setAccent(a.id)}>
                <Box w="full" h="full" rounded="full" bg={a.swatch} display="flex" alignItems="center" justifyContent="center" color="white">
                  {on && <LuCheck />}
                </Box>
              </button>
            </Box>
          )
        })}
      </HStack>
    </FormRow>
  )
}
