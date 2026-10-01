import type { ReactNode } from "react"
import { Field, NumberInput, Text } from "@chakra-ui/react"
import { FormRow } from "./FormRow"
import { useUnit } from "../features/units"

interface NumberFieldProps {
  /** Text o, si cal, icona + text (p. ex. la direcció d'un moviment). */
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  help?: string
  error?: string
  /** Només lectura (valor calculat, p. ex. un passacables que segueix un objecte). */
  disabled?: boolean
  /** Nom accessible quan l'etiqueta és fora (a `FormRow`/`NumRow`). */
  ariaLabel?: string
}

/** Camp numèric de mides. Amb `suffix="mm"` respecta la unitat de pantalla (mm o cm); el valor sempre és en mm. */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix = "mm", help, error, disabled, ariaLabel }: NumberFieldProps) {
  const unit = useUnit()
  const cm = suffix === "mm" && unit === "cm"
  const k = cm ? 10 : 1
  const shown = Number.isFinite(value) ? String(Math.round((value / k) * 1000) / 1000) : ""
  return (
    <Field.Root
      invalid={!!error}
      // Si la columna és estreta (tres camps en fila a l'inspector), s'amaga la unitat
      // (els botons + i − es queden) perquè el número no quedi tapat.
      css={{
        containerType: "inline-size",
        "@container (max-width: 130px)": {
          "& .nf-unit": { display: "none" },
          "& [data-scope=number-input][data-part=input]": { paddingInlineEnd: "7" },
        },
      }}
    >
      {label && <Field.Label fontSize="sm">{label}</Field.Label>}
      <NumberInput.Root
        value={shown}
        onValueChange={(e) => onChange(Number.isFinite(e.valueAsNumber) ? Math.round(e.valueAsNumber * k * 1000) / 1000 : e.valueAsNumber)}
        min={min === undefined ? undefined : min / k}
        max={max === undefined ? undefined : max / k}
        step={step / k}
        allowMouseWheel
        disabled={disabled}
        w="full"
        position="relative"
      >
        <NumberInput.Input inputMode="decimal" pe="14" aria-label={ariaLabel ?? (typeof label === "string" && label ? label : undefined)} />
        <Text
          className="nf-unit"
          position="absolute"
          right="9"
          top="50%"
          transform="translateY(-50%)"
          fontSize="sm"
          color="fg.muted"
          pointerEvents="none"
        >
          {cm ? "cm" : suffix}
        </Text>
        <NumberInput.Control />
      </NumberInput.Root>
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : help ? <Field.HelperText>{help}</Field.HelperText> : null}
    </Field.Root>
  )
}

/** Fila de formulari (`FormRow`) amb un camp numèric: mm, si no es diu una altra unitat. */
export function NumRow({ label, help, maxW = "180px", ...p }: { label: ReactNode; help?: ReactNode; maxW?: string } & Omit<NumberFieldProps, "label" | "help">) {
  return (
    <FormRow label={label} help={help} maxW={maxW}>
      <NumberField label="" ariaLabel={typeof label === "string" ? label : undefined} {...p} />
    </FormRow>
  )
}
