import { FormRow } from "../../components/FormRow"
import { hardwareSummary, slotOf, type HardwareItem, type HardwareSlot } from "../../core/model"
import { HardwareSelect } from "../settings/HardwareSelect"
import { useSettings } from "../settings/SettingsContext"

/**
 * Quin ferratge de la biblioteca fa servir un lloc (la frontissa d'una porta, la guia dels calaixos, el braç d'un
 * abatible, el tirador o, a la Fusteria del mòdul, el de tot el mòdul): el selector comú amb calaix (`HardwareSelect`)
 * amb els de Preferències › Ferratges del mateix tipus. En triar-ne un, se'n desa una **còpia** (`onPick`), com fan els
 * mòduls: el moble no canvia si la biblioteca canvia. `inherited` = el del mòdul (als fronts): triar-lo treu el propi
 * (`onPick(undefined)`). Una còpia que no és a la biblioteca **tal qual** surt a part, «Del moble», i és la triada.
 */
export function HardwarePick({ slot, current, inherited, onPick, label }: { slot: HardwareSlot; current: HardwareItem; inherited?: HardwareItem; onPick: (item: HardwareItem | undefined) => void; label?: string }) {
  const { settings } = useSettings()
  const s = slotOf(slot)
  const name = label ?? s.label
  return (
    <FormRow label={name} help={`${hardwareSummary(current)}${inherited && current === inherited ? " · la del mòdul" : ""}`}>
      {/* A «Guia» també els jocs paramètrics de calaix de doble paret (es trien en lloc de la guia). */}
      <HardwareSelect label={name} items={settings.hardwareLibrary.filter((x) => x.engine === s.engine || (slot === "slide" && x.engine === "drawerKit"))} current={current} inherited={inherited} onPick={onPick} />
    </FormRow>
  )
}
