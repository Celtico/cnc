import { Menu } from "@chakra-ui/react"
import { useState } from "react"
import { LuSave } from "react-icons/lu"
import { DocBar } from "../../components/TopBar"
import { db, renameAmbient } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"
import { SaveAmbientFileDialog } from "../file/SaveFileDialog"
import { ActionsMenu } from "../../components/ActionsMenu"

/**
 * Barra de dalt de l'ambient obert («Ambients › nom») amb el menú ⋯ del document («Desar com a fitxer…», com el del moble).
 * A part de l'editor perquè l'editor es carrega a demanda.
 */
export function AmbientTopBar({ ambientId, onBack, onSettings, actionsRef }: { ambientId: number; onBack: () => void; onSettings: () => void; actionsRef: (el: HTMLDivElement | null) => void }) {
  const row = useLiveQuery(() => db.ambients.get(ambientId), [ambientId])
  const [saveOpen, setSaveOpen] = useState(false)
  return (
    <>
      <DocBar
        rootLabel="Ambients"
        name={row?.name ?? ""}
        nameLabel="Nom de l'ambient"
        onRename={(v) => void renameAmbient(ambientId, v)}
        onBack={onBack}
        onSettings={onSettings}
        actionsRef={actionsRef}
        menu={
          <ActionsMenu label="Menú de l'ambient" size="sm">
            {/* Primer es desa el que hi hagi pendent a l'editor (el fitxer es fa amb el que hi ha a la base de dades). */}
            <Menu.Item value="file" onClick={() => (window.dispatchEvent(new Event("mobles:flush-save")), setSaveOpen(true))}>
              <LuSave /> Desar com a fitxer…
            </Menu.Item>
          </ActionsMenu>
        }
      />
      <SaveAmbientFileDialog ambientId={saveOpen ? ambientId : null} name={row?.name ?? ""} open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  )
}
