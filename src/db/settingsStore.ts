import { DEFAULT_SETTINGS, parseSettings, type Settings } from "../core/model"
import { setKnownMaterialNames } from "../core/model/photoUpgrade"
import { db } from "./db"

const ROW_ID = "user"

/** Preferències guardades (validades i migrades). Si no n'hi ha, es creen amb els valors inicials. */
export async function loadSettings(): Promise<{ settings: Settings; problems: string[] }> {
  const row = await db.settings.get(ROW_ID)
  if (!row) {
    await db.settings.put({ id: ROW_ID, data: DEFAULT_SETTINGS, updatedAt: Date.now() })
    return remember({ settings: DEFAULT_SETTINGS, problems: [] })
  }
  const res = parseSettings(row.data)
  // Migració: es desa la versió nova perquè no es repeteixi.
  if (res.migrated && res.problems.length === 0) await db.settings.put({ id: ROW_ID, data: res.settings, updatedAt: Date.now() })
  return remember({ settings: res.settings, problems: res.problems })
}

/** Els àlies dels noms antics de material («X (foto)») depenen dels materials de l'usuari. */
function remember<T extends { settings: Settings }>(r: T): T {
  setKnownMaterialNames(r.settings.materials.map((m) => m.name))
  return r
}

const storedVersion = (data: unknown) => (typeof data === "object" && data !== null && typeof (data as { version?: unknown }).version === "number" ? (data as { version: number }).version : 0)

/**
 * Desa les preferències. La versió desada mai baixa (una versió antiga de l'app oberta en una altra pestanya o des
 * de la memòria cau): les migracions depenen només d'aquesta versió i no s'han de tornar a fer.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const prev = await db.settings.get(ROW_ID)
    const version = Math.max(settings.version, storedVersion(prev?.data))
    await db.settings.put({ id: ROW_ID, data: version === settings.version ? settings : { ...settings, version }, updatedAt: Date.now() })
  })
}

/** Consulta per a `useLiveQuery`: preferències actuals (o valors inicials mentre no n'hi ha). */
export async function currentSettings(): Promise<Settings> {
  const row = await db.settings.get(ROW_ID)
  return remember({ settings: row ? parseSettings(row.data).settings : DEFAULT_SETTINGS }).settings
}
