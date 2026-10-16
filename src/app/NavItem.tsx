import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import { Tooltip } from "../components/ui/tooltip"

/** Un apartat de la barra lateral (plegada: només la icona, amb el nom al tooltip). */
export function NavItem({
  icon: Icon,
  label,
  detail,
  collapsed,
  active,
  disabled,
  onClick,
  alert = false,
}: {
  icon: IconType
  label: string
  /** Segona línia, petita (p. ex. el progrés del render); plegada, va al tooltip. */
  detail?: string
  collapsed: boolean
  active: boolean
  disabled: boolean
  onClick: () => void
  /** La icona en vermell i fent pampallugues (p. ex. un render que calcula). */
  alert?: boolean
}) {
  return (
    <Tooltip content={detail ? `${label} · ${detail}` : label} disabled={!collapsed} positioning={{ placement: "right" }}>
      <HStack
        asChild
        px={3}
        py={2}
        rounded="md"
        gap={3}
        justify={collapsed ? "center" : "flex-start"}
        bg={active ? "wood.muted" : "transparent"}
        color={active ? "wood.fg" : disabled ? "fg.subtle" : "fg"}
        _hover={disabled ? {} : { bg: active ? "wood.muted" : "bg.muted" }}
        fontWeight={active ? "semibold" : "normal"}
      >
        <button
          disabled={disabled}
          onClick={onClick}
          aria-current={active ? "page" : undefined}
          aria-label={collapsed ? label : undefined}
        >
          {alert ? (
            <Box as="span" display="inline-flex" color="red.solid" animation="blink 1.6s ease-in-out infinite" _motionReduce={{ animation: "none" }}>
              <Icon />
            </Box>
          ) : (
            <Icon />
          )}
          {!collapsed &&
            (detail ? (
              <Stack gap={0} minW={0} align="start" textAlign="start">
                <Text truncate maxW="full">
                  {label}
                </Text>
                <Text fontSize="2xs" color="fg.muted" fontWeight="normal" fontVariantNumeric="tabular-nums" truncate maxW="full">
                  {detail}
                </Text>
              </Stack>
            ) : (
              <Text>{label}</Text>
            ))}
        </button>
      </HStack>
    </Tooltip>
  )
}
