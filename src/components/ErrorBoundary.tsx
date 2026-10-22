import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu"

interface Props {
  children: ReactNode
  /** Quan canvia (una altra pantalla, un altre moble), es torna a provar sol. */
  resetKey?: unknown
  /** Què ha fallat, en poques paraules («Aquesta pantalla», «L'assistent»). */
  what?: string
  /** «Anar a la llista»: una sortida segura si tornar-ho a provar torna a fallar. */
  onLeave?: () => void
  leaveLabel?: string
}

interface State {
  error: Error | null
  resetKey: unknown
}

/**
 * Un error mentre es dibuixa una part de l'app no la deixa en blanc: aquella part diu què ha passat i es pot tornar a
 * provar. Abans de res, es desa el que estava pendent (`mobles:flush-save`): el document no es perd.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return Object.is(props.resetKey, state.resetKey) ? null : { error: null, resetKey: props.resetKey }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    window.dispatchEvent(new Event("mobles:flush-save"))
    console.error(error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { what = "Aquesta part de l'app", onLeave, leaveLabel = "Tornar a la llista" } = this.props
    const detail = `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim()
    return (
      <Stack role="alert" gap={3} maxW="xl" mx="auto" my={10} p={5} borderWidth="1px" borderRadius="lg" bg="bg.panel">
        <HStack gap={2} color="fg.error">
          <LuTriangleAlert />
          <Text fontWeight="semibold">{what} ha fallat.</Text>
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          El que tenies fet està desat. Torna-ho a provar; si torna a passar, copia l'error i envia'l, que ajuda a arreglar-ho.
        </Text>
        <HStack gap={2} wrap="wrap">
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            <LuRefreshCw /> Tornar a provar
          </Button>
          {onLeave && (
            <Button size="sm" variant="outline" onClick={() => (this.setState({ error: null }), onLeave())}>
              {leaveLabel}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(detail).catch(() => undefined)}>
            Copiar l'error
          </Button>
        </HStack>
        <Box as="details" fontSize="xs" color="fg.muted">
          <summary>Detalls</summary>
          <Code display="block" whiteSpace="pre-wrap" mt={2} p={2} fontSize="xs" maxH="200px" overflowY="auto">
            {detail}
          </Code>
        </Box>
      </Stack>
    )
  }
}
