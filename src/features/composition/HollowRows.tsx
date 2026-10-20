import { Switch } from "@chakra-ui/react"
import { FormRow } from "../../components/FormRow"
import { NumRow } from "../../components/NumRow"

/** El mínim d'una peça gruixuda (buida): dues pells i un llistó (la construcció fa massisses les que no hi arriben). */
const hollowMin = (board: number) => 2 * board + 6
/** El que es posa en encendre «Gruixuts (buits)». */
const hollowDefault = (board: number) => Math.max(50, 2 * board + 12)

/**
 * **Gruix** (cas 9 del model únic): la mateixa opció a les parets de la caixa, als prestatges i als divisors. Un
 * interruptor «Gruixuts (buits)» i el «Gruix aparent», amb el mateix mínim, el mateix valor d'entrada i la mateixa ajuda.
 */
export function HollowRows({ optionIds, value, board, what, onChange }: {
  optionIds: { thick: string; thickness: string }
  /** El gruix aparent (mm), o `undefined` si són del gruix del tauler. */
  value: number | undefined
  /** El gruix del tauler (mm). */
  board: number
  /** Les peces: «Laterals, base i tapa», «Els prestatges»... */
  what: string
  onChange: (thickness: number | undefined) => void
}) {
  const min = hollowMin(board)
  return (
    <>
      <FormRow optionId={optionIds.thick} label="Gruix">
        <Switch.Root size="sm" pt="6px" checked={!!value} onCheckedChange={(e) => onChange(e.checked ? hollowDefault(board) : undefined)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Gruixuts (buits)</Switch.Label>
        </Switch.Root>
      </FormRow>
      {value && (
        <NumRow
          optionId={optionIds.thickness}
          label="Gruix aparent"
          value={value}
          min={min}
          max={300}
          step={5}
          onChange={(v) => Number.isFinite(v) && v >= min && onChange(v)}
          help={`${what}: dues pells de ${board} mm, llistons a dins i una tira al davant. Almenys ${min} mm.`}
        />
      )}
    </>
  )
}
