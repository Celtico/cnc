import { Badge, HStack, IconButton, Text } from "@chakra-ui/react"
import { LuMessageSquarePlus, LuX } from "react-icons/lu"
import { Tooltip } from "../../../components/ui/tooltip"
import type { ASSISTANT_MODELS } from "../../../core/model"

/** Capçalera del xat: el títol, el model, «Nova conversa» i (al calaix) tancar. */
export function ChatHeader({ model, canStartNew, onNewChat, onClose }: { model: (typeof ASSISTANT_MODELS)[number]; canStartNew: boolean; onNewChat: () => void; onClose?: (() => void) | undefined }) {
  return (
    <HStack gap={2} flexShrink={0}>
      <Text fontSize="sm" fontWeight="semibold" flex={1} minW={0} truncate>
        Assistent
      </Text>
      <Badge size="sm" variant="subtle" title={`${model.label}: ${model.price} per milió de tokens`}>
        {model.label}
      </Badge>
      <Tooltip content="Nova conversa">
        <IconButton size="xs" variant="ghost" aria-label="Nova conversa" disabled={!canStartNew} onClick={onNewChat}>
          <LuMessageSquarePlus />
        </IconButton>
      </Tooltip>
      {onClose && (
        <Tooltip content="Tancar">
          <IconButton size="xs" variant="ghost" aria-label="Tancar l'assistent" onClick={onClose}>
            <LuX />
          </IconButton>
        </Tooltip>
      )}
    </HStack>
  )
}
