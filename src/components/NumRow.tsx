import { useState, type ReactNode } from "react"
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
  /** El camp es pot deixar buit: llavors `onChange` rep `NaN` (sense, mai rep un valor que no sigui un número). */
  allowEmpty?: boolean
}

/** Camp numèric de mides. Amb `suffix="mm"` respecta la unitat de pantalla (mm o cm); el valor sempre és en mm. */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix = "mm", help, error, disabled, ariaLabel, allowEmpty = false }: NumberFieldProps) {
  const unit = useUnit()
  const cm = suffix === "mm" && unit === "cm"
  const k = cm ? 10 : 1
  const shown = Number.isFinite(value) ? String(Math.round((value / k) * 1000) / 1000) : ""
  // El text del camp mentre s'escriu («», «-», «12.») i el número que hi llegeix el camp: el text es queda encara
  // que no sigui un número vàlid.
  const [edit, setEdit] = useState({ text: shown, num: Number.isFinite(value) ? value / k : NaN })
  const [prevShown, setPrevShown] = useState(shown)
  if (shown !== prevShown) {
    setPrevShown(shown)
    // El valor ha canviat de fora (o s'ha arrodonit): si el text ja hi correspon, no es toca (no es perd el «12.»).
    if (!(Number.isFinite(edit.num) && Math.abs(edit.num * k - value) < 1e-6)) setEdit({ text: shown, num: Number.isFinite(value) ? value / k : NaN })
  }
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
        value={edit.text}
        onValueChange={(e) => {
          setEdit({ text: e.value, num: e.valueAsNumber })
          if (Number.isFinite(e.valueAsNumber)) onChange(Math.round(e.valueAsNumber * k * 1000) / 1000)
          else if (allowEmpty) onChange(NaN)
        }}
        min={min === undefined ? undefined : min / k}
        max={max === undefined ? undefined : max / k}
        step={step / k}
        allowMouseWheel
        disabled={disabled}
        w="full"
        position="relative"
      >
        <NumberInput.Input
          inputMode="decimal"
          pe="14"
          // En sortir amb el camp buit o a mig escriure («-»), torna l'últim valor vàlid.
          onBlur={() => {
            if (!allowEmpty && !Number.isFinite(edit.num)) setEdit({ text: shown, num: Number.isFinite(value) ? value / k : NaN })
          }}
          aria-label={ariaLabel ?? (typeof label === "string" && label ? label : undefined)} />
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
