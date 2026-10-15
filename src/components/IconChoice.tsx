import { HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import { Tooltip } from "./ui/tooltip"
import { segGroup, segItem } from "./segmented"

export interface IconOption<T extends string> {
  value: T
  label: string
  icon: IconType
  /** Explicació més llarga per al tooltip (si no, el nom). */
  hint?: string
  /** No es pot triar ara (el tooltip diu per què). */
  disabled?: boolean
}

/**
 * Tria entre poques opcions amb botons d'icona (com el tipus de front): la icona al botó,
 * el nom al tooltip i, al costat del títol, el nom de l'opció triada.
 */
export function IconChoice<T extends string>({ label, value, options, onChange, hideLabel }: { label: string; value: T; options: IconOption<T>[]; onChange: (v: T) => void; /** Sense títol (dins d'un `FormRow`, que ja porta l'etiqueta): l'opció triada va a sota dels botons. */ hideLabel?: boolean }) {
  const current = options.find((o) => o.value === value)
  return (
    <Stack gap={1.5}>
      {!hideLabel && (
        <HStack gap={1.5} fontSize="sm">
          <Text fontWeight="medium">{label}</Text>
          {current && <Text color="fg.muted">· {current.label}</Text>}
        </HStack>
      )}
      <HStack {...segGroup} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = o.value === value
          const Icon = o.icon
          return (
            <Tooltip key={o.value} content={o.hint ?? o.label}>
              <IconButton
                {...segItem(on)}
                role="radio"
                aria-checked={on}
                aria-label={o.label}
                disabled={o.disabled}
                onClick={() => !on && !o.disabled && onChange(o.value)}
              >
                <Icon />
              </IconButton>
            </Tooltip>
          )
        })}
      </HStack>
      {hideLabel && current && (
        <Text fontSize="xs" color="fg.muted">
          {current.label}
        </Text>
      )}
    </Stack>
  )
}
