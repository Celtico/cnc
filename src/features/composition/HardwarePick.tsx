import { FormRow } from "../../components/FormRow"
import { INHERITED_LABEL, hardwareSummary, isFrameHardware, slotOf, type HardwareEngine, type HardwareItem, type HardwareSlot } from "../../core/model"
import { HardwareSelect, type HardwareNoneOption } from "../settings/HardwareSelect"
import { useSettings } from "../settings/SettingsContext"

/**
 * Quin ferratge de la biblioteca fa servir un lloc (la frontissa d'una porta, la guia dels calaixos, el braç d'un
 * abatible, el tirador, l'imant d'una reixeta, la barra o la llum d'un compartiment, el marc d'una vitrina, la pota de la
 * base o, a Mòdul › Unió, l'espiga de tot el mòdul): el selector comú amb finestra de tria (`HardwareSelect`) amb
 * els de Preferències › Ferratges del mateix tipus. En triar-ne un, se'n desa una **còpia** (`onPick`), com fan els
 * mòduls: el moble no canvia si la biblioteca canvia. `inherited` = el del mòdul (als fronts i compartiments): triar-lo
 * treu el propi (`onPick(undefined)`). Una còpia que no és a la biblioteca **tal qual** surt a part, «Còpia pròpia», i és la
 * triada. Sense `slot`, el tipus es dona amb `engine` (la pota: cap lloc al mòdul) i `emptyLabel` és l'opció sense
 * ferratge («Genèriques»). `none`: una opció més sense ferratge («Cap (push)» al tirador).
 */
export function HardwarePick({ slot, engine, current, inherited, onPick, label, help, emptyLabel, none, glass }: { /** Front de vidre (true) o de fusta (false): frontisses i tiradors, només els compatibles (`isFrameHardware`). */ glass?: boolean; slot?: HardwareSlot; engine?: HardwareEngine; current?: HardwareItem; inherited?: HardwareItem; onPick: (item: HardwareItem | undefined) => void; label?: string; /** Ajuda pròpia (si no, el resum de l'item). */ help?: string; emptyLabel?: string; none?: HardwareNoneOption }) {
  const { settings } = useSettings()
  const s = slot ? slotOf(slot) : undefined
  const eng = engine ?? s!.engine
  const name = label ?? s?.label ?? ""
  // Frontisses i tiradors: a un front de vidre només els de marc d'alumini; a un de fusta, mai (res incompatible a la llista).
  const fits = (x: HardwareItem) => glass === undefined || (x.engine !== "cup" && x.engine !== "barHandle") || isFrameHardware(x) === glass
  if (inherited && !fits(inherited)) inherited = undefined
  const shown = current ?? inherited
  const summary = help ?? (none?.selected ? none.help ?? "" : shown ? `${hardwareSummary(shown)}${inherited && (!current || current === inherited) ? ` · ${INHERITED_LABEL}` : ""}` : "")
  return (
    <FormRow label={name} help={summary || undefined}>
      {/* A «Guia» també els jocs paramètrics de calaix de doble paret (es trien en lloc de la guia). */}
      <HardwareSelect label={name} items={settings.hardwareLibrary.filter((x) => (x.engine === eng || (slot === "slide" && x.engine === "drawerKit")) && fits(x))} current={current} inherited={inherited} emptyLabel={emptyLabel} none={none} onPick={onPick} />
    </FormRow>
  )
}

/**
 * La **filera System 32 del mòdul** (`module.hardware.system32`, una per mòdul) a l'inspector del compartiment: als
 * Prestatges (al costat de «Regulables») o al Front (després de la «Frontissa»), on diu `system32RowPlace`. Edita la de tot
 * el mòdul: l'ajuda ho diu.
 */
export function System32Pick({ current, what, onPick }: { current: HardwareItem; /** Qui la fa servir (`usedHardwareSlots`). */ what: string; onPick: (item: HardwareItem) => void }) {
  return <HardwarePick slot="system32" label="Filera System 32" current={current} help={`La de tot el mòdul: la fan servir ${what} de tots els compartiments. ${hardwareSummary(current)}.`} onPick={(next) => next && onPick(next)} />
}
