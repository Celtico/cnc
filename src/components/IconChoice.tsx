import { HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import { Tooltip } from "./ui/tooltip"

export interface IconOption<T extends string> {
  value: T
  label: string
  icon: IconType
  /** Explicació més llarga per al tooltip (si no, el nom). */
  hint?: string
}

/**
 * Tria entre poques opcions amb botons d'icona (com el tipus de front): la icona al botó,
 * el nom al tooltip i, al costat del títol, el nom de l'opció triada.
 */
export function IconChoice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: IconOption<T>[]; onChange: (v: T) => void }) {
  const current = options.find((o) => o.value === value)
  return (
    <Stack gap={1.5}>
      <HStack gap={1.5} fontSize="sm">
        <Text fontWeight="medium">{label}</Text>
        {current && <Text color="fg.muted">· {current.label}</Text>}
      </HStack>
      <HStack gap={1} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = o.value === value
          const Icon = o.icon
          return (
            <Tooltip key={o.value} content={o.hint ?? o.label}>
              <IconButton
                flex={1}
                size="sm"
                role="radio"
                aria-checked={on}
                aria-label={o.label}
                variant={on ? "solid" : "outline"}
                colorPalette={on ? "wood" : "gray"}
                onClick={() => !on && onChange(o.value)}
              >
                <Icon />
              </IconButton>
            </Tooltip>
          )
        })}
      </HStack>
    </Stack>
  )
}
