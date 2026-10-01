import { Text, type TextProps } from "@chakra-ui/react"

/** Títol petit de secció (majúscules, gris), el mateix a tota l'app: seccions de targeta, grups de llista, Opcions de vista. */
export function SectionLabel({ children, ...rest }: TextProps) {
  return (
    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" {...rest}>
      {children}
    </Text>
  )
}
