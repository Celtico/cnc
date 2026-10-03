import { DocBar } from "../../components/TopBar"
import { db, renameAmbient } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"

/** Barra de dalt de l'ambient obert («Ambients › nom»). A part de l'editor perquè l'editor es carrega a demanda. */
export function AmbientTopBar({ ambientId, onBack, onSettings, actionsRef }: { ambientId: number; onBack: () => void; onSettings: () => void; actionsRef: (el: HTMLDivElement | null) => void }) {
  const row = useLiveQuery(() => db.ambients.get(ambientId), [ambientId])
  return <DocBar rootLabel="Ambients" name={row?.name ?? ""} nameLabel="Nom de l'ambient" onRename={(v) => void renameAmbient(ambientId, v)} onBack={onBack} onSettings={onSettings} actionsRef={actionsRef} />
}
