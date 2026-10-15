import { Box } from "@chakra-ui/react"
import type { StepRule } from "../core/model"
import { FormRow } from "./FormRow"
import { NumberField, NumRow } from "./NumRow"

/** Els textos d'una regla de quantitat («2 frontisses», «Fins a aquesta alçada de porta», «Més altes»…). */
interface CountWords {
  /** Què es compta, en plural: «frontisses», «còpies». */
  unit: string
  /** Ajuda del primer graó: «Fins a aquesta alçada de porta.» */
  upToHelp: string
  /** Etiqueta i ajuda de l'últim («Més altes»). */
  elseLabel: string
  elseHelp: string
}

const HINGE_WORDS: CountWords = { unit: "frontisses", upToHelp: "Fins a aquesta alçada de porta.", elseLabel: "Més altes", elseHelp: "Frontisses de les portes més altes que l'últim graó." }

/**
 * Graons d'una regla (`StepRule`), la mateixa a tota l'app: **quantitat** per mida (frontisses per alçada de porta, a
 * Preferències › Ferratges; còpies d'un ferratge col·locat per la llargada de la peça, a l'Editor) o **distància** dels
 * forats del tirador per espai. Una fila per graó (fins a quina mida) i la de l'últim; `editCount`: també la quantitat de
 * cada graó (als col·locats; a les frontisses és fixa, 2/3/4).
 */
export function StepRuleRows({ rule, kind, onChange, words = HINGE_WORDS, editCount = false }: { rule: StepRule; kind: "count" | "pitch"; onChange: (r: StepRule) => void; words?: CountWords; editCount?: boolean }) {
  const setStep = (i: number, patch: Partial<StepRule["steps"][number]>) => onChange({ ...rule, steps: rule.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  const upToRange = (i: number) => ({ min: i > 0 ? rule.steps[i - 1]!.upTo + 1 : 100, max: i < rule.steps.length - 1 ? rule.steps[i + 1]!.upTo - 1 : 4000 })
  if (kind === "count")
    return (
      <>
        {rule.steps.map((s, i) =>
          editCount ? (
            <FormRow key={i} label={`Graó ${i + 1}`} help={i === 0 ? `${words.upToHelp} A la dreta, quantes.` : undefined}>
              <Box display="flex" gap={2}>
                <Box w="130px">
                  <NumberField label="" ariaLabel={`Graó ${i + 1}: fins a`} value={s.upTo} {...upToRange(i)} step={10} onChange={(upTo) => Number.isFinite(upTo) && setStep(i, { upTo })} />
                </Box>
                <Box w="100px">
                  <NumberField label="" ariaLabel={`Graó ${i + 1}: ${words.unit}`} suffix="u" value={s.n} min={1} max={100} step={1} onChange={(n) => Number.isFinite(n) && n >= 1 && setStep(i, { n: Math.round(n) })} />
                </Box>
              </Box>
            </FormRow>
          ) : (
            <NumRow key={i} label={`${s.n} ${words.unit}`} help={i === 0 ? words.upToHelp : undefined} value={s.upTo} {...upToRange(i)} step={10} onChange={(upTo) => Number.isFinite(upTo) && setStep(i, { upTo })} />
          ),
        )}
        <FormRow label={words.elseLabel} help={words.elseHelp}>
          <Box w="120px">
            <NumberField label="" ariaLabel={`${words.unit}: ${words.elseLabel.toLowerCase()}`} suffix="u" value={rule.else} min={1} max={editCount ? 100 : 12} step={1} onChange={(v) => Number.isFinite(v) && v >= 1 && onChange({ ...rule, else: Math.round(v) })} />
          </Box>
        </FormRow>
      </>
    )
  return (
    <>
      {rule.steps.map((s, i) => (
        <NumRow key={i} label={`Menys de ${s.upTo}`} help={i === 0 ? "Distància entre els dos forats si el front fa menys d'aquesta mida." : undefined} value={s.n} min={16} max={1000} step={1} onChange={(n) => Number.isFinite(n) && setStep(i, { n })} />
      ))}
      <NumRow label="Si hi cap" help="La distància quan hi ha prou lloc." value={rule.else} min={16} max={1000} step={1} onChange={(v) => Number.isFinite(v) && onChange({ ...rule, else: v })} />
    </>
  )
}
