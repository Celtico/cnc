import { Stat } from "@chakra-ui/react"

/** Xifra de resum (peces, superfície, taulers…), la mateixa a Peces i a Nesting. */
export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Stat.Root borderWidth="1px" rounded="lg" p={3}>
      <Stat.Label>{label}</Stat.Label>
      <Stat.ValueText fontSize={{ base: "lg", md: "2xl" }}>{value}</Stat.ValueText>
    </Stat.Root>
  )
}
