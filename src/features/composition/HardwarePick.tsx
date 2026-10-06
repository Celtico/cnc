import { ChoiceChips, FormRow } from "../../components/FormRow"
import { hardwareSummary, slotOf, type HardwareItem, type HardwareSlot } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"

/**
 * Quin ferratge de la biblioteca fa servir un lloc (la frontissa d'una porta, la guia dels calaixos, el braç d'un
 * abatible o, a la Fusteria del mòdul, el de tot el mòdul): `ChoiceChips` amb els de Preferències › Ferratges del mateix
 * tipus. En triar-ne un, se'n desa una **còpia** (`onPick`), com fan els mòduls: el moble no canvia si la biblioteca
 * canvia. `inherited` = el del mòdul (als fronts): triar-lo treu el propi (`onPick(undefined)`). Un que ja no és a la
 * biblioteca (esborrat, o d'un `.moble` d'un altre) es veu igual, amb «del moble».
 */
export function HardwarePick({ slot, current, inherited, onPick, label }: { slot: HardwareSlot; current: HardwareItem; inherited?: HardwareItem; onPick: (item: HardwareItem | undefined) => void; label?: string }) {
  const { settings } = useSettings()
  const s = slotOf(slot)
  const lib = settings.hardwareLibrary.filter((x) => x.engine === s.engine)
  const extra = [current, inherited].filter((x): x is HardwareItem => !!x && !lib.some((l) => l.id === x.id))
  const all = [...lib, ...extra.filter((x, i) => extra.findIndex((y) => y.id === x.id) === i)]
  const name = (x: HardwareItem) => `${x.name}${extra.some((e) => e.id === x.id) ? " (del moble)" : ""}`
  const pick = (id: string) => {
    if (inherited && id === inherited.id) return onPick(undefined)
    const hit = lib.find((x) => x.id === id) ?? all.find((x) => x.id === id)
    if (hit) onPick(structuredClone(hit))
  }
  return (
    <FormRow label={label ?? s.label} help={`${hardwareSummary(current)}${inherited && current.id === inherited.id ? " · la del mòdul" : ""}`}>
      <ChoiceChips label={label ?? s.label} value={current.id} options={all.map((x) => ({ id: x.id, label: name(x) }))} onChange={pick} />
    </FormRow>
  )
}
