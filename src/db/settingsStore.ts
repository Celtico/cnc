import { DEFAULT_SETTINGS, parseSettings, type Settings } from "../core/model"
import { db } from "./db"

const ROW_ID = "user"

/** Preferències guardades (validades i migrades). Si no n'hi ha, es creen amb els valors inicials. */
export async function loadSettings(): Promise<{ settings: Settings; problems: string[] }> {
  const row = await db.settings.get(ROW_ID)
  if (!row) {
    await db.settings.put({ id: ROW_ID, data: DEFAULT_SETTINGS, updatedAt: Date.now() })
    return { settings: DEFAULT_SETTINGS, problems: [] }
  }
  const res = parseSettings(row.data)
  // Migració: es desa la versió nova perquè no es repeteixi.
  if (res.migrated && res.problems.length === 0) await db.settings.put({ id: ROW_ID, data: res.settings, updatedAt: Date.now() })
  return { settings: res.settings, problems: res.problems }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ id: ROW_ID, data: settings, updatedAt: Date.now() })
}

/** Consulta per a `useLiveQuery`: preferències actuals (o valors inicials mentre no n'hi ha). */
export async function currentSettings(): Promise<Settings> {
  const row = await db.settings.get(ROW_ID)
  return row ? parseSettings(row.data).settings : DEFAULT_SETTINGS
}
