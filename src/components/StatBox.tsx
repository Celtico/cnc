import { Stat } from "@chakra-ui/react"

/**
 * Xifra de resum (peces, superfície, taulers…), la mateixa a Peces i a Nesting. Al mòbil van tres en una fila: el nom
 * es talla amb «…» (sencer al `title`) i la xifra és més petita perquè «Aprofitament» no surti retallat a mitja lletra.
 */
export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Stat.Root borderWidth="1px" rounded="lg" p={{ base: 2, md: 3 }} minW={0}>
      <Stat.Label fontSize={{ base: "xs", md: "sm" }} minW={0} maxW="full" display="block" truncate title={label}>
        {label}
      </Stat.Label>
      <Stat.ValueText fontSize={{ base: "md", md: "2xl" }} truncate title={value}>
        {value}
      </Stat.ValueText>
    </Stat.Root>
  )
}
