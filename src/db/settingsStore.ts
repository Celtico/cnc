import { DEFAULT_SETTINGS, SETTINGS_VERSION, parseSettings, type Settings } from "../core/model"
import { setKnownMaterialNames } from "../core/model/photoUpgrade"
import { setKitPilotRule } from "../core/model/hardwareKit"
import { db } from "./db"
import { renameMaterialEverywhere } from "./materialRefs"

const ROW_ID = "user"

/** Preferències guardades (validades i migrades). Si no n'hi ha, es creen amb els valors inicials. */
export async function loadSettings(): Promise<{ settings: Settings; problems: string[]; readOnly: boolean }> {
  const row = await db.settings.get(ROW_ID)
  if (!row) {
    await db.settings.put({ id: ROW_ID, data: DEFAULT_SETTINGS, updatedAt: Date.now() })
    return remember({ settings: DEFAULT_SETTINGS, problems: [], readOnly: false })
  }
  const res = parseSettings(row.data)
  if (isNewer(row.data)) {
    // Desades per una versió més nova de l'app: només lectura (desar-hi el que entén aquesta versió les esborraria).
    console.warn(`Preferències de la versió ${storedVersion(row.data)} (aquesta app és la ${SETTINGS_VERSION}): no es desaran.`)
    return remember({ settings: res.settings, problems: [...res.problems, "Les preferències són d'una versió més nova de l'app: els canvis no es desaran fins que l'actualitzis."], readOnly: true })
  }
  // Migració: es desa la versió nova perquè no es repeteixi. Els noms de material que ha canviat (v12: «Melamina 19» →
  // «Melamina blanca»…) es segueixen als mobles i ambients desats, a la mateixa transacció (si no es desen, la propera
  // lectura ho torna a fer: és idempotent).
  const save = res.migrated && res.problems.length === 0 ? () => db.settings.put({ id: ROW_ID, data: res.settings, updatedAt: Date.now() }) : undefined
  if (res.renames?.length) await renameMaterialEverywhere(res.renames, save)
  else if (save) await save()
  return remember({ settings: res.settings, problems: res.problems, readOnly: false })
}

/**
 * Els àlies dels noms antics de material («X (foto)») depenen dels materials de l'usuari, i la regla del taller de la
 * prebroca (`kitPilot`) la llegeix el constructor dels jocs (`planKit`): es posen en carregar i en desar.
 */
function remember<T extends { settings: Settings }>(r: T): T {
  setKnownMaterialNames(r.settings.materials.map((m) => m.name))
  setKitPilotRule(r.settings.kitPilot)
  return r
}

const storedVersion = (data: unknown) => (typeof data === "object" && data !== null && typeof (data as { version?: unknown }).version === "number" ? (data as { version: number }).version : 0)

/** Desades per una versió més nova de l'app (`SETTINGS_VERSION` més alta): aquesta no les pot reescriure. */
const isNewer = (data: unknown) => storedVersion(data) > SETTINGS_VERSION

/**
 * Desa les preferències. La versió desada mai baixa (una versió antiga de l'app oberta en una altra pestanya o des
 * de la memòria cau): les migracions depenen només d'aquesta versió i no s'han de tornar a fer.
 *
 * Si les desades són d'una versió **més nova** de l'app, **no desa** (torna `false`): el que aquesta versió no
 * entén (camps i materials nous) es perdria. Torna `true` si ha desat.
 */
export async function saveSettings(settings: Settings): Promise<boolean> {
  return db.transaction("rw", db.settings, async () => {
    const prev = await db.settings.get(ROW_ID)
    if (prev && isNewer(prev.data)) {
      console.warn(`Preferències de la versió ${storedVersion(prev.data)}: aquesta app (versió ${SETTINGS_VERSION}) no les desa.`)
      return false
    }
    const version = Math.max(settings.version, storedVersion(prev?.data))
    await db.settings.put({ id: ROW_ID, data: version === settings.version ? settings : { ...settings, version }, updatedAt: Date.now() })
    setKitPilotRule(settings.kitPilot)
    return true
  })
}

/** Consulta per a `useLiveQuery`: preferències actuals (o valors inicials mentre no n'hi ha). */
export async function currentSettings(): Promise<Settings> {
  const row = await db.settings.get(ROW_ID)
  return remember({ settings: row ? parseSettings(row.data).settings : DEFAULT_SETTINGS }).settings
}
