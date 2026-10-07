import { FormRow } from "../../components/FormRow"
import { hardwareSummary, slotOf, type HardwareEngine, type HardwareItem, type HardwareSlot } from "../../core/model"
import { HardwareSelect, type HardwareNoneOption } from "../settings/HardwareSelect"
import { useSettings } from "../settings/SettingsContext"

/**
 * Quin ferratge de la biblioteca fa servir un lloc (la frontissa d'una porta, la guia dels calaixos, el braç d'un
 * abatible, el tirador, l'imant d'una reixeta, la barra o la llum d'un compartiment, el marc d'una vitrina, la pota de la
 * base o, a l'Interior i a la Fusteria del mòdul, el de tot el mòdul): el selector comú amb calaix (`HardwareSelect`) amb
 * els de Preferències › Ferratges del mateix tipus. En triar-ne un, se'n desa una **còpia** (`onPick`), com fan els
 * mòduls: el moble no canvia si la biblioteca canvia. `inherited` = el del mòdul (als fronts i compartiments): triar-lo
 * treu el propi (`onPick(undefined)`). Una còpia que no és a la biblioteca **tal qual** surt a part, «Del moble», i és la
 * triada. Sense `slot`, el tipus es dona amb `engine` (la pota: cap lloc al mòdul) i `emptyLabel` és l'opció sense
 * ferratge («Genèriques»). `none`: una opció més sense ferratge («Cap (push)» al tirador).
 */
export function HardwarePick({ slot, engine, current, inherited, onPick, label, help, emptyLabel, none }: { slot?: HardwareSlot; engine?: HardwareEngine; current?: HardwareItem; inherited?: HardwareItem; onPick: (item: HardwareItem | undefined) => void; label?: string; /** Ajuda pròpia (si no, el resum de l'item). */ help?: string; emptyLabel?: string; none?: HardwareNoneOption }) {
  const { settings } = useSettings()
  const s = slot ? slotOf(slot) : undefined
  const eng = engine ?? s!.engine
  const name = label ?? s?.label ?? ""
  const shown = current ?? inherited
  const summary = help ?? (none?.selected ? none.help ?? "" : shown ? `${hardwareSummary(shown)}${inherited && (!current || current === inherited) ? " · la del mòdul" : ""}` : "")
  return (
    <FormRow label={name} help={summary || undefined}>
      {/* A «Guia» també els jocs paramètrics de calaix de doble paret (es trien en lloc de la guia). */}
      <HardwareSelect label={name} items={settings.hardwareLibrary.filter((x) => x.engine === eng || (slot === "slide" && x.engine === "drawerKit"))} current={current} inherited={inherited} emptyLabel={emptyLabel} none={none} onPick={onPick} />
    </FormRow>
  )
}
