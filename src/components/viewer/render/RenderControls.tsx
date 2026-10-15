import { HStack, Stack, Switch, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { FormRow } from "../../FormRow"
import { FoldItem } from "../../Fold"

/** Control lliscant compacte en fila: rètol a l'esquerra; el range natiu i el valor a la dreta. */
export function Range({ label, value, min, max, step, format, onChange, help }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; help?: string }) {
  return (
    <FormRow label={label} help={help}>
      <HStack gap={2} minH="32px">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: "var(--chakra-colors-wood-solid)" }}
        />
        <Text fontSize="xs" fontVariantNumeric="tabular-nums" flexShrink={0} minW="4.5em" textAlign="right">
          {format(value)}
        </Text>
      </HStack>
    </FormRow>
  )
}

/** Interruptor (el `Switch` de l'app, com a la resta de formularis) amb el rètol a la `FormRow`. */
export function Toggle({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <HStack minH="32px" gap={2}>
      <Switch.Root size="sm" checked={checked} onCheckedChange={(e) => onChange(e.checked)}>
        <Switch.HiddenInput aria-label={label} />
        <Switch.Control />
      </Switch.Root>
      {children}
    </HStack>
  )
}

/** Secció plegable de les opcions (la mateixa `FoldItem` dels inspectors): comencen tancades i es recorden durant la sessió. */
export function Sec({ id, title, icon, hint, badge, children }: { id: string; title: string; icon: IconType; hint: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <FoldItem id={`render-${id}`} title={title} icon={icon} badge={badge}>
      <Stack gap={3}>
        {children}
        <Text fontSize="2xs" color="fg.subtle">
          {hint}
        </Text>
      </Stack>
    </FoldItem>
  )
}
