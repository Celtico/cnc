import { Alert, Box, Button, HStack, Image, Stack, Text } from "@chakra-ui/react"
import type { RefObject } from "react"
import { LuCheck, LuFileText, LuTriangleAlert, LuWrench } from "react-icons/lu"
import { openSettings } from "../../settings/openSettings"
import type { Item } from "./types"

/** La conversa (o, buida, la presentació i les propostes per començar), amb el seu propi desplaçament. */
export function ChatMessages({
  listRef,
  onScroll,
  items,
  intro,
  suggestions,
  onSuggestion,
}: {
  listRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  items: Item[]
  intro: string
  suggestions: string[]
  onSuggestion: (s: string) => void
}) {
  return (
    <Box ref={listRef} onScroll={onScroll} flex={1} minH={0} overflowY="auto" css={{ scrollbarWidth: "thin" }} pr={1}>
      {items.length === 0 ? (
        <Stack gap={2} py={2}>
          <Text fontSize="sm" color="fg.muted">
            {intro} Cada resposta és un sol pas de desfer (⌘Z).
          </Text>
          {suggestions.map((s) => (
            <Button key={s} size="xs" variant="outline" h="auto" py={1.5} whiteSpace="normal" textAlign="left" justifyContent="flex-start" fontWeight="normal" onClick={() => onSuggestion(s)}>
              {s}
            </Button>
          ))}
        </Stack>
      ) : (
        <Stack gap={3} py={1}>
          {items.map((it) =>
            it.role === "user" ? (
              <Stack key={it.id} alignSelf="flex-end" maxW="88%" bg="wood.subtle" rounded="lg" px={3} py={2} gap={2}>
                {it.files?.map((f, k) =>
                  f.url ? (
                    <Image key={k} src={f.url} alt={f.name} maxH="160px" rounded="md" objectFit="contain" />
                  ) : (
                    <HStack key={k} gap={1.5} fontSize="xs" color="fg.muted" minW={0}>
                      <LuFileText /> <Text truncate>{f.name}</Text>
                    </HStack>
                  ),
                )}
                {it.text && (
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {it.text}
                  </Text>
                )}
              </Stack>
            ) : (
              <AssistantReply key={it.id} it={it} />
            ),
          )}
        </Stack>
      )}
    </Box>
  )
}

/** Una resposta de l'assistent: el text, les eines que ha fet, si es pot desfer, la nota i l'error. */
function AssistantReply({ it }: { it: Extract<Item, { role: "assistant" }> }) {
  return (
    <Stack gap={1.5} data-testid="assistant-reply">
      {it.parts.map((p, k) =>
        p.kind === "text" ? (
          <Text key={k} fontSize="sm" whiteSpace="pre-wrap">
            {p.text}
          </Text>
        ) : (
          <HStack key={k} gap={1.5} fontSize="xs" color={p.ok ? "fg.muted" : "orange.fg"} align="flex-start">
            <Box mt="2px" flexShrink={0}>
              {p.ok ? <LuWrench /> : <LuTriangleAlert />}
            </Box>
            <Text>{p.note}</Text>
          </HStack>
        ),
      )}
      {it.running && (
        <Text fontSize="xs" color="fg.muted">
          {it.parts.length ? "…" : "Pensant…"}
        </Text>
      )}
      {!it.running && !it.error && it.changed && (
        <HStack gap={1.5} fontSize="xs" color="fg.muted">
          <LuCheck /> <Text>Desfer-ho tot: ⌘Z (un sol pas).</Text>
        </HStack>
      )}
      {it.note && (
        <Text fontSize="xs" color="fg.muted">
          {it.note}
        </Text>
      )}
      {it.error && (
        <Alert.Root status={it.error.kind === "offline" ? "warning" : "error"} size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{it.error.title}</Alert.Title>
            <Alert.Description>
              {it.error.description}
              {(it.error.kind === "no-key" || it.error.kind === "auth" || it.error.kind === "not-found") && (
                <Button size="xs" variant="plain" ml={1} onClick={() => openSettings("assistant")}>
                  Obrir Preferències
                </Button>
              )}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Stack>
  )
}
