import { LuColumns2, LuDoorClosed, LuRows3 } from "react-icons/lu"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { NumRow } from "../../../components/NumRow"
import type { Settings } from "../../../core/model"
import { FoldGrid } from "./FoldGrid"

/** Preferències › Folgances per defecte: fronts, prestatges i fons, i divisions. */
export function GapsFields({ gaps, onChange }: { gaps: Settings["gaps"]; onChange: (gaps: Settings["gaps"]) => void }) {
  return (
    <FoldGrid>
    <SettingsGroup icon={<LuDoorClosed />} title="Fronts" summary={`porta–cos ${gaps.outerGap} · entre fronts ${gaps.betweenGap}`}>
    <NumRow label="Front–cos" help="Folgança entre el front i la vora del cos." value={gaps.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => onChange({ ...gaps, outerGap })} />
    <NumRow label="Entre fronts" value={gaps.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => onChange({ ...gaps, betweenGap })} />
    </SettingsGroup>
    <SettingsGroup icon={<LuRows3 />} title="Prestatges i fons" summary={`prestatge ${gaps.shelfClearance} / ${gaps.shelfSetback} · ranura ${gaps.backSetback} × ${gaps.grooveDepth}${gaps.grooveClearance ? ` + ${String(gaps.grooveClearance).replace(".", ",")}` : ""}`}>
    <NumRow label="Prestatge (folgança)" value={gaps.shelfClearance} min={0} max={5} step={0.5} onChange={(shelfClearance) => onChange({ ...gaps, shelfClearance })} />
    <NumRow label="Retranqueig dels prestatges" help="Quant es fiquen cap endins respecte del davant." value={gaps.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => onChange({ ...gaps, shelfSetback })} />
    <NumRow label="Fons (folgança)" value={gaps.backClearance} min={0} max={4} step={0.5} onChange={(backClearance) => onChange({ ...gaps, backClearance })} />
    <NumRow label="Ranura del fons" help="Distància al cantell posterior." value={gaps.backSetback} min={0} max={60} step={1} onChange={(backSetback) => onChange({ ...gaps, backSetback })} />
    <NumRow label="Fondària ranura" value={gaps.grooveDepth} min={3} max={15} step={1} onChange={(grooveDepth) => onChange({ ...gaps, grooveDepth })} />
    <NumRow label="Joc de la ranura" help="La ranura del fons, tants mm més ampla que el gruix del fons (p. ex. 0,8: un fons de 10 fa una ranura de 10,8). El joc va cap al davant. Als mòduls nous." value={gaps.grooveClearance} min={0} max={2} step={0.1} onChange={(grooveClearance) => onChange({ ...gaps, grooveClearance })} />
    </SettingsGroup>
    <SettingsGroup icon={<LuColumns2 />} title="Divisions" summary={`peces de dins ${String(gaps.innerClearance).replace(".", ",")}`}>
    <NumRow label="Peces de dins" help="Amb el mòdul dividit, tots els divisors i prestatges fixos, de qualsevol nivell (horitzontal o vertical): tant menys de llarg, la meitat a cada cap. Sense dividir, els prestatges fixos van sencers; la caixa, mai." value={gaps.innerClearance} min={0} max={3} step={0.5} onChange={(innerClearance) => onChange({ ...gaps, innerClearance })} />
    </SettingsGroup>
    </FoldGrid>
  )
}
