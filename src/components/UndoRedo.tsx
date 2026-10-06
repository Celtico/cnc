import { HStack, IconButton } from "@chakra-ui/react"
import { LuRedo2, LuUndo2 } from "react-icons/lu"
import { MOD } from "./modKey"
import { Tooltip } from "./ui/tooltip"

/**
 * Botons Desfer · Refer (`LuUndo2` · `LuRedo2`) d'un document amb `useHistory`: a la barra de dalt de l'editor i dels
 * ambients i a la barra d'eines de l'editor de perfils. Les dreceres són a `useUndoKeys`.
 */
export function UndoRedo({ canUndo, canRedo, undo, redo, size = "sm" }: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void; size?: "xs" | "sm" }) {
  return (
    <HStack gap={1}>
      <Tooltip content={`Desfer (${MOD}Z)`}>
        <IconButton aria-label="Desfer" size={size} variant="ghost" disabled={!canUndo} onClick={() => undo()}>
          <LuUndo2 />
        </IconButton>
      </Tooltip>
      <Tooltip content={`Refer (⇧${MOD}Z)`}>
        <IconButton aria-label="Refer" size={size} variant="ghost" disabled={!canRedo} onClick={() => redo()}>
          <LuRedo2 />
        </IconButton>
      </Tooltip>
    </HStack>
  )
}
