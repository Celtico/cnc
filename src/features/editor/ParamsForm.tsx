import type { ReactNode } from "react"
import {
  Field,
  Heading,
  Input,
  NumberInput,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react"
import { LuHammer, LuLayoutPanelLeft, LuMoveDiagonal, LuSquareStack } from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
import { FormRow } from "../../components/FormRow"
import type { CabinetParams } from "../../core/model"
import { useUnit } from "../units"

/** Esborrany editable: com CabinetParams però els números poden ser NaN mentre s'escriu. */
export type Draft = CabinetParams

export interface ParamsFormProps {
  draft: Draft
  errors: Record<string, string>
  onChange: (patch: (d: Draft) => Draft) => void
}

export function ParamsForm({ draft, errors, onChange }: ParamsFormProps) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange((d) => ({ ...d, [key]: value }))
  const setNested = <K extends "hinge" | "system32" | "dowel", F extends keyof Draft[K]>(
    group: K,
    field: F,
    value: Draft[K][F],
  ) => onChange((d) => ({ ...d, [group]: { ...d[group], [field]: value } }))

  return (
    <Stack gap={0}>
      <PanelSection id="mides" title="Mides exteriors" icon={LuMoveDiagonal}>
        <NumRow label="Amplada" value={draft.width} onChange={(v) => set("width", v)} min={100} max={2500} step={10} error={errors.width} />
        <NumRow label="Alçada" value={draft.height} onChange={(v) => set("height", v)} min={100} max={2800} step={10} error={errors.height} />
        <NumRow label="Fondària" value={draft.depth} onChange={(v) => set("depth", v)} min={100} max={1200} step={10} error={errors.depth} />
      </PanelSection>

      <PanelSection id="taulers" title="Taulers" icon={LuSquareStack}>
        <NumRow label="Gruix tauler" value={draft.panelThickness} onChange={(v) => set("panelThickness", v)} min={8} max={40} step={1} error={errors.panelThickness} help="Habituals: 10 · 12 · 16 · 19 · 30" />
        <NumRow label="Gruix fons" value={draft.backThickness} onChange={(v) => set("backThickness", v)} min={3} max={20} step={1} error={errors.backThickness} />
        <FormRow label="Fons">
          <SegmentGroup.Root
            aria-label="Fons"
            value={draft.backType}
            onValueChange={(e) => {
              if (e.value === "groove" || e.value === "screwed") set("backType", e.value)
            }}
            size="sm"
          >
            <SegmentGroup.Indicator />
            <SegmentGroup.Item value="groove">
              <SegmentGroup.ItemText>En ranura</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
            <SegmentGroup.Item value="screwed">
              <SegmentGroup.ItemText>Cargolat darrere</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          </SegmentGroup.Root>
        </FormRow>
      </PanelSection>

      <PanelSection id="interior" title="Interior i front" icon={LuLayoutPanelLeft}>
        <NumRow label="Prestatges" value={draft.shelves} onChange={(v) => set("shelves", v)} min={0} max={20} step={1} suffix="u" error={errors.shelves} />
        <FormRow label="Portes">
          <Field.Root invalid={!!errors.doors}>
            <SegmentGroup.Root
              aria-label="Portes"
              value={String(draft.doors)}
              onValueChange={(e) => {
                const n = Number(e.value)
                if (n === 0 || n === 1 || n === 2) set("doors", n)
              }}
              size="sm"
            >
              <SegmentGroup.Indicator />
              {[0, 1, 2].map((n) => (
                <SegmentGroup.Item key={n} value={String(n)}>
                  <SegmentGroup.ItemText>{n}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </Field.Root>
        </FormRow>
      </PanelSection>

      <PanelSection id="fusteria" title="Fusteria (avançat)" icon={LuHammer}>
          <Stack gap={5}>
            <Section title="Materials" small>
              <FormRow label="Tauler" maxW="280px">
                <Input aria-label="Tauler" value={draft.material} onChange={(e) => set("material", e.target.value)} />
              </FormRow>
              <FormRow label="Fons" maxW="280px">
                <Input aria-label="Fons" value={draft.backMaterial} onChange={(e) => set("backMaterial", e.target.value)} />
              </FormRow>
            </Section>

            <Section title="Portes" small>
              <NumRow label="Joc porta–cos" value={draft.doorGap} onChange={(v) => set("doorGap", v)} min={0} max={10} step={0.5} error={errors.doorGap} />
              <NumRow label="Joc entre portes" value={draft.doorGapBetween} onChange={(v) => set("doorGapBetween", v)} min={0} max={10} step={0.5} error={errors.doorGapBetween} />
              <NumRow label="Cassoleta Ø" value={draft.hinge.cupDiameter} onChange={(v) => setNested("hinge", "cupDiameter", v)} min={20} max={40} step={1} error={errors["hinge.cupDiameter"]} />
              <NumRow label="Profunditat" value={draft.hinge.cupDepth} onChange={(v) => setNested("hinge", "cupDepth", v)} min={5} max={20} step={0.5} error={errors["hinge.cupDepth"]} />
              <NumRow label="Al cantell" value={draft.hinge.cupOffset} onChange={(v) => setNested("hinge", "cupOffset", v)} min={15} max={30} step={0.5} error={errors["hinge.cupOffset"]} />
            </Section>

            <Section title="Prestatges i fons" small>
              <NumRow label="Retranqueig prestatge" value={draft.shelfSetback} onChange={(v) => set("shelfSetback", v)} min={0} max={100} step={1} error={errors.shelfSetback} />
              <NumRow label="Joc prestatge" value={draft.shelfClearance} onChange={(v) => set("shelfClearance", v)} min={0} max={5} step={0.5} error={errors.shelfClearance} />
              <NumRow label="Ranura des del darrere" value={draft.backSetback} onChange={(v) => set("backSetback", v)} min={0} max={60} step={1} error={errors.backSetback} />
              <NumRow label="Profunditat ranura" value={draft.grooveDepth} onChange={(v) => set("grooveDepth", v)} min={3} max={15} step={1} error={errors.grooveDepth} />
              <NumRow label="Joc del fons" value={draft.backClearance} onChange={(v) => set("backClearance", v)} min={0} max={4} step={0.5} error={errors.backClearance} />
            </Section>

            <Section title="System 32" small>
              <NumRow label="Filera al cantell" value={draft.system32.edgeOffset} onChange={(v) => setNested("system32", "edgeOffset", v)} min={20} max={60} step={1} error={errors["system32.edgeOffset"]} />
              <NumRow label="Pas" value={draft.system32.pitch} onChange={(v) => setNested("system32", "pitch", v)} min={16} max={64} step={1} error={errors["system32.pitch"]} />
              <NumRow label="Ø forat" value={draft.system32.diameter} onChange={(v) => setNested("system32", "diameter", v)} min={3} max={10} step={0.5} error={errors["system32.diameter"]} />
              <NumRow label="Profunditat" value={draft.system32.depth} onChange={(v) => setNested("system32", "depth", v)} min={5} max={16} step={0.5} error={errors["system32.depth"]} />
            </Section>

            <Section title="Espigues (lateral ↔ base/sostre)" small>
              <NumRow label="Ø espiga" value={draft.dowel.diameter} onChange={(v) => setNested("dowel", "diameter", v)} min={5} max={12} step={1} error={errors["dowel.diameter"]} />
              <NumRow label="Als cantells" value={draft.dowel.endOffset} onChange={(v) => setNested("dowel", "endOffset", v)} min={20} max={120} step={5} error={errors["dowel.endOffset"]} />
              <NumRow label="Fondària a la cara" value={draft.dowel.faceDepth} onChange={(v) => setNested("dowel", "faceDepth", v)} min={5} max={20} step={0.5} error={errors["dowel.faceDepth"]} />
              <NumRow label="Fondària al cantell" value={draft.dowel.edgeDepth} onChange={(v) => setNested("dowel", "edgeDepth", v)} min={10} max={40} step={0.5} error={errors["dowel.edgeDepth"]} />
            </Section>
          </Stack>
      </PanelSection>
    </Stack>
  )
}

function Section({ title, small, children }: { title: string; small?: boolean; children: React.ReactNode }) {
  return (
    <Stack gap={3}>
      {small ? (
        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
          {title}
        </Text>
      ) : (
        <Heading size="md">{title}</Heading>
      )}
      {children}
    </Stack>
  )
}

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
