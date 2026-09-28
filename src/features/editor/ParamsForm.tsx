import {
  Field,
  Heading,
  Input,
  NumberInput,
  SegmentGroup,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react"
import { LuHammer, LuLayoutPanelLeft, LuMoveDiagonal, LuSquareStack } from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
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
        <SimpleGrid columns={{ base: 3 }} gap={3}>
          <NumberField label="Amplada" value={draft.width} onChange={(v) => set("width", v)} min={100} max={2500} step={10} error={errors.width} />
          <NumberField label="Alçada" value={draft.height} onChange={(v) => set("height", v)} min={100} max={2800} step={10} error={errors.height} />
          <NumberField label="Fondària" value={draft.depth} onChange={(v) => set("depth", v)} min={100} max={1200} step={10} error={errors.depth} />
        </SimpleGrid>
      </PanelSection>

      <PanelSection id="taulers" title="Taulers" icon={LuSquareStack}>
        <SimpleGrid columns={2} gap={3}>
          <NumberField label="Gruix tauler" value={draft.panelThickness} onChange={(v) => set("panelThickness", v)} min={8} max={40} step={1} error={errors.panelThickness} help="Habituals: 10 · 12 · 16 · 19 · 30" />
          <NumberField label="Gruix fons" value={draft.backThickness} onChange={(v) => set("backThickness", v)} min={3} max={20} step={1} error={errors.backThickness} />
        </SimpleGrid>
        <Field.Root>
          <Field.Label>Fons</Field.Label>
          <SegmentGroup.Root
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
        </Field.Root>
      </PanelSection>

      <PanelSection id="interior" title="Interior i front" icon={LuLayoutPanelLeft}>
        <SimpleGrid columns={2} gap={3}>
          <NumberField label="Prestatges" value={draft.shelves} onChange={(v) => set("shelves", v)} min={0} max={20} step={1} suffix="u" error={errors.shelves} />
          <Field.Root invalid={!!errors.doors}>
            <Field.Label>Portes</Field.Label>
            <SegmentGroup.Root
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
        </SimpleGrid>
      </PanelSection>

      <PanelSection id="fusteria" title="Fusteria (avançat)" icon={LuHammer}>
          <Stack gap={5}>
            <Section title="Materials" small>
              <SimpleGrid columns={2} gap={3}>
                <Field.Root>
                  <Field.Label>Tauler</Field.Label>
                  <Input value={draft.material} onChange={(e) => set("material", e.target.value)} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Fons</Field.Label>
                  <Input value={draft.backMaterial} onChange={(e) => set("backMaterial", e.target.value)} />
                </Field.Root>
              </SimpleGrid>
            </Section>

            <Section title="Portes" small>
              <SimpleGrid columns={2} gap={3}>
                <NumberField label="Joc porta–cos" value={draft.doorGap} onChange={(v) => set("doorGap", v)} min={0} max={10} step={0.5} error={errors.doorGap} />
                <NumberField label="Joc entre portes" value={draft.doorGapBetween} onChange={(v) => set("doorGapBetween", v)} min={0} max={10} step={0.5} error={errors.doorGapBetween} />
              </SimpleGrid>
              <SimpleGrid columns={3} gap={3}>
                <NumberField label="Cassoleta Ø" value={draft.hinge.cupDiameter} onChange={(v) => setNested("hinge", "cupDiameter", v)} min={20} max={40} step={1} error={errors["hinge.cupDiameter"]} />
                <NumberField label="Profunditat" value={draft.hinge.cupDepth} onChange={(v) => setNested("hinge", "cupDepth", v)} min={5} max={20} step={0.5} error={errors["hinge.cupDepth"]} />
                <NumberField label="Al cantell" value={draft.hinge.cupOffset} onChange={(v) => setNested("hinge", "cupOffset", v)} min={15} max={30} step={0.5} error={errors["hinge.cupOffset"]} />
              </SimpleGrid>
            </Section>

            <Section title="Prestatges i fons" small>
              <SimpleGrid columns={2} gap={3}>
                <NumberField label="Retranqueig prestatge" value={draft.shelfSetback} onChange={(v) => set("shelfSetback", v)} min={0} max={100} step={1} error={errors.shelfSetback} />
                <NumberField label="Joc prestatge" value={draft.shelfClearance} onChange={(v) => set("shelfClearance", v)} min={0} max={5} step={0.5} error={errors.shelfClearance} />
                <NumberField label="Ranura des del darrere" value={draft.backSetback} onChange={(v) => set("backSetback", v)} min={0} max={60} step={1} error={errors.backSetback} />
                <NumberField label="Profunditat ranura" value={draft.grooveDepth} onChange={(v) => set("grooveDepth", v)} min={3} max={15} step={1} error={errors.grooveDepth} />
                <NumberField label="Joc del fons" value={draft.backClearance} onChange={(v) => set("backClearance", v)} min={0} max={4} step={0.5} error={errors.backClearance} />
              </SimpleGrid>
            </Section>

            <Section title="System 32" small>
              <SimpleGrid columns={2} gap={3}>
                <NumberField label="Filera al cantell" value={draft.system32.edgeOffset} onChange={(v) => setNested("system32", "edgeOffset", v)} min={20} max={60} step={1} error={errors["system32.edgeOffset"]} />
                <NumberField label="Pas" value={draft.system32.pitch} onChange={(v) => setNested("system32", "pitch", v)} min={16} max={64} step={1} error={errors["system32.pitch"]} />
                <NumberField label="Ø forat" value={draft.system32.diameter} onChange={(v) => setNested("system32", "diameter", v)} min={3} max={10} step={0.5} error={errors["system32.diameter"]} />
                <NumberField label="Profunditat" value={draft.system32.depth} onChange={(v) => setNested("system32", "depth", v)} min={5} max={16} step={0.5} error={errors["system32.depth"]} />
              </SimpleGrid>
            </Section>

            <Section title="Espigues (lateral ↔ base/sostre)" small>
              <SimpleGrid columns={2} gap={3}>
                <NumberField label="Ø espiga" value={draft.dowel.diameter} onChange={(v) => setNested("dowel", "diameter", v)} min={5} max={12} step={1} error={errors["dowel.diameter"]} />
                <NumberField label="Als cantells" value={draft.dowel.endOffset} onChange={(v) => setNested("dowel", "endOffset", v)} min={20} max={120} step={5} error={errors["dowel.endOffset"]} />
                <NumberField label="Prof. a la cara" value={draft.dowel.faceDepth} onChange={(v) => setNested("dowel", "faceDepth", v)} min={5} max={20} step={0.5} error={errors["dowel.faceDepth"]} />
                <NumberField label="Prof. al cantell" value={draft.dowel.edgeDepth} onChange={(v) => setNested("dowel", "edgeDepth", v)} min={10} max={40} step={0.5} error={errors["dowel.edgeDepth"]} />
              </SimpleGrid>
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
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  help?: string
  error?: string
}

/** Camp numèric de mides. Amb `suffix="mm"` respecta la unitat de pantalla (mm o cm); el valor sempre és en mm. */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix = "mm", help, error }: NumberFieldProps) {
  const unit = useUnit()
  const cm = suffix === "mm" && unit === "cm"
  const k = cm ? 10 : 1
  const shown = Number.isFinite(value) ? String(Math.round((value / k) * 1000) / 1000) : ""
  return (
    <Field.Root invalid={!!error}>
      <Field.Label fontSize="sm">{label}</Field.Label>
      <NumberInput.Root
        value={shown}
        onValueChange={(e) => onChange(Number.isFinite(e.valueAsNumber) ? Math.round(e.valueAsNumber * k * 1000) / 1000 : e.valueAsNumber)}
        min={min === undefined ? undefined : min / k}
        max={max === undefined ? undefined : max / k}
        step={step / k}
        allowMouseWheel
        w="full"
        position="relative"
      >
        <NumberInput.Input inputMode="decimal" pe="14" />
        <Text
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
