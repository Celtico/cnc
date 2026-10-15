import { FormRow } from "../../../components/FormRow"
import type { MaterialPref } from "../../../core/model"
import { MaterialSelect } from "../../settings/MaterialSelect"

/** Material de les preferències, agrupat per categories (el mateix selector que a Preferències). */
export function MaterialPick({ label, value, materials, onChange, emptyLabel }: { label: string; value: string; materials: MaterialPref[]; onChange: (v: string) => void; onlySim?: boolean; emptyLabel?: string }) {
  return (
    <FormRow label={label} maxW="280px">
      <MaterialSelect label={label} materials={materials} value={value} onChange={onChange} emptyLabel={emptyLabel} hideLabel />
    </FormRow>
  )
}
