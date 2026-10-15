import { HStack } from "@chakra-ui/react"
import type { DragEvent, ReactNode } from "react"

/** Arrossegant un element d'un grup: zona per treure'l (queda solt). Els handlers, de `useTreeDnd().ungroupZone`. */
export function UngroupDropZone({ active, onDragOver, onDragLeave, onDrop, children }: { active: boolean; onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: (e: DragEvent) => void; children: ReactNode }) {
  return (
    <HStack
      mt={1}
      mx={1}
      px={2}
      py={1.5}
      gap={2}
      rounded="md"
      fontSize="xs"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={active ? "wood.solid" : "border.emphasized"}
      bg={active ? "wood.muted" : undefined}
      color={active ? "wood.fg" : "fg.muted"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </HStack>
  )
}
