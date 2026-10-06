import { ChoiceChips, FormRow } from "../../components/FormRow"
import { hardwareChoices, hardwareSummary, slotOf, type HardwareItem, type HardwareSlot } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"

/**
 * Quin ferratge de la biblioteca fa servir un lloc (la frontissa d'una porta, la guia dels calaixos, el braç d'un
 * abatible o, a la Fusteria del mòdul, el de tot el mòdul): `ChoiceChips` amb els de Preferències › Ferratges del mateix
 * tipus. En triar-ne un, se'n desa una **còpia** (`onPick`), com fan els mòduls: el moble no canvia si la biblioteca
 * canvia. `inherited` = el del mòdul (als fronts): triar-lo treu el propi (`onPick(undefined)`). Una còpia que no és a la
 * biblioteca **tal qual** (esborrada, d'un `.moble` d'un altre, o amb el mateix id i un altre contingut, com un mòdul
 * d'abans) surt a part, «del moble», i és la triada: es veu el que es fabrica i s'hi pot tornar (`hardwareChoices`).
 */
export function HardwarePick({ slot, current, inherited, onPick, label }: { slot: HardwareSlot; current: HardwareItem; inherited?: HardwareItem; onPick: (item: HardwareItem | undefined) => void; label?: string }) {
  const { settings } = useSettings()
  const s = slotOf(slot)
  const { options, value, inheritedKey } = hardwareChoices(settings.hardwareLibrary.filter((x) => x.engine === s.engine), current, inherited)
  const pick = (key: string) => {
    if (key === inheritedKey) return onPick(undefined)
    const hit = options.find((o) => o.key === key)
    if (hit) onPick(structuredClone(hit.item))
  }
  return (
    <FormRow label={label ?? s.label} help={`${hardwareSummary(current)}${inheritedKey !== undefined && value === inheritedKey ? " · la del mòdul" : ""}`}>
      <ChoiceChips label={label ?? s.label} value={value} options={options.map((o) => ({ id: o.key, label: o.label }))} onChange={pick} />
    </FormRow>
  )
}
