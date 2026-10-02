import { Alert } from "@chakra-ui/react"

/**
 * Avís de composició il·legible (`readComposition(…).unreadable`): la desada no es pot llegir ni reparant-la. Peces,
 * Nesting i Exportar no fan res amb la caixa per defecte (sortirien peces i fitxers d'un moble que no és el teu).
 */
export function UnreadableAlert() {
  return (
    <Alert.Root status="error" size="sm">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>La composició d'aquest moble no es pot llegir</Alert.Title>
        <Alert.Description>
          Les dades desades estan malmeses o són d'una versió més nova de l'app. No es fan peces, nesting ni fitxers per al taller (sortiria una
          caixa per defecte). Les dades no es toquen.
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  )
}
