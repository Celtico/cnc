import { z } from "zod"
import { migrateImportedNames } from "./makers/hettichNames"
import { DEFAULT_HARDWARE_DEFAULTS, DEFAULT_HARDWARE_KITS, DEFAULT_HARDWARE_LIBRARY, DEFAULT_LEGACY_HARDWARE, HardwareDefaultsSchema, HardwareItemSchema, LegacyHardwareSchema, V27_ITEMS, V28_ITEMS, V31_ITEMS, V34_ITEMS, V35_ITEMS, V39_ITEMS, V41_ITEMS, V42_ITEMS, V43_ITEMS, V44_ITEMS, V45_ITEMS, V46_ITEMS, V54_ITEMS, fixHardwareDefaults, kitPilotFromLibrary, libraryFromLegacy, setKitPilot, type HardwareItem } from "./hardware"
import { KitPilotSchema } from "./hardwareKit"
import { PHOTO_MATERIALS } from "./textureSets"
import { deepEqual, MATERIAL_MERGES, rescalePhotoTiles, resolveMaterialAlias, restorePhotoThicknesses, upgradeToPhoto } from "./photoUpgrade"
import { defaultMachine, defaultMachineRules, MachineRulesSchema, migrateMachine, repairMachine, type Machine, type MachineRules } from "./machine"
import { repairValue } from "./repair"
import { AssistantPrefSchema, GapsPrefSchema, MaterialPrefSchema, RefPresetSchema, SETTINGS_VERSION, SettingsSchema, materialNameKey, type MaterialPref, type RefPreset, type Settings } from "./settingsSchema"
import { CORIAN_CATALOG } from "./corianColors"
import { BUILTIN_MATERIALS, BUILTIN_REFERENCES, CLADDING_MATERIALS, CORIAN_MATERIALS, CORIAN_V50_FINISH, DEFAULT_GROOVE_CLEARANCE, DEFAULT_INNER_CLEARANCE, DEFAULT_SETTINGS, APPLIANCE_MATERIALS, FRAME_MATERIALS, GLOSS_MATERIALS, LAMPSHADE_GLOW, LAWN_FINISH, LED_MATERIALS, NON_CNC_MATERIALS, OLD_LAWN_FINISH, RETIRED_TEMPLATE_MATERIALS, RIFT_MATERIALS, SIM_MATERIALS, SIM_MATERIALS_SINCE, SOLID_WOOD_MATERIALS, TEMPLATE_MATERIALS, isRetired } from "./settingsDefaults"

// --- Migració i importació ------------------------------------------------------------

interface SettingsParse {
  settings: Settings
  /** Problemes trobats (en català). Buit si tot era vàlid. */
  problems: string[]
  migrated: boolean
  /**
   * Noms de material canviats per la migració (v12, `mergeDuplicateMaterials`): `loadSettings` els segueix als mobles
   * i ambients desats (`renameMaterialEverywhere`). Buit si no n'hi ha.
   */
  renames?: [string, string][]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Llegeix unes preferències guardades (o importades): completa el que falti amb els
 * valors inicials, migra versions anteriors i descarta entrades invàlides dient-ho.
 * Mai llança: si tot és inservible, retorna els valors inicials.
 */
export function parseSettings(raw: unknown): SettingsParse {
  const problems: string[] = []
  if (!isRecord(raw)) {
    return { settings: DEFAULT_SETTINGS, problems: ["El fitxer no conté cap objecte de preferències."], migrated: false }
  }
  let migrated = false
  let obj: Record<string, unknown> = { ...raw }
  const version = typeof obj.version === "number" ? obj.version : 0
  if (version < 1) {
    // v0: sense `version`; les referències podien portar `wall` en lloc de `wallOffset`.
    migrated = true
    const refs = Array.isArray(obj.references)
      ? obj.references.map((r) => (isRecord(r) && "wall" in r && !("wallOffset" in r) ? { ...r, wallOffset: r.wall } : r))
      : undefined
    obj = { ...obj, ...(refs ? { references: refs } : {}), version: 1 }
  }
  // Una versió anterior es desa ja migrada. Cada pas depèn només de la versió desada, que mai baixa (`saveSettings`
  // desa la més alta): un fitxer ja migrat no torna a afegir els materials que l'usuari ha esborrat.
  if (version < SETTINGS_VERSION) migrated = true
  if (version > SETTINGS_VERSION) problems.push(`Preferències d'una versió més nova (${version}); s'ha llegit el que s'ha pogut.`)
  // v25: la folgança de les peces de dins, amb el valor inicial (additiu: si ja n'hi ha una, es queda).
  if (version < 25 && isRecord(obj.gaps) && !("innerClearance" in obj.gaps)) obj = { ...obj, gaps: { ...obj.gaps, innerClearance: DEFAULT_INNER_CLEARANCE } }
  // v32: el joc de l'ample de la ranura del fons, 0 (additiu: la fabricació no canvia fins que l'usuari el posa).
  if (version < 32 && isRecord(obj.gaps) && !("grooveClearance" in obj.gaps)) obj = { ...obj, gaps: { ...obj.gaps, grooveClearance: 0 } }
  // v33: el per defecte és 0,8; el 0 de la v32 (o sense) hi passa, un altre valor de l'usuari es queda.
  if (version < 33 && isRecord(obj.gaps) && !obj.gaps.grooveClearance) obj = { ...obj, gaps: { ...obj.gaps, grooveClearance: DEFAULT_GROOVE_CLEARANCE } }

  // Camp a camp (`repairValue`): un valor dolent només torna aquell valor a l'inicial (un tauler o una llargada de
  // guia dolents només es treuen), no tota la secció.
  const section = <T>(key: string, schema: z.ZodType<T>, fallback: T, label: string): T => {
    if (!(key in obj)) return fallback
    const res = schema.safeParse(obj[key])
    if (res.success) return res.data
    const fixed: string[] = []
    const out = repairValue(schema, obj[key], fallback, (path, what) => fixed.push(`${path || "tot"} ${what}`))
    problems.push(`${label}: ${fixed.join("; ") || "valor invàlid"}; la resta es manté.`)
    return out ?? fallback
  }
  const list = <T extends { id: string }>(key: string, schema: z.ZodType<T>, fallback: T[], label: string): T[] => {
    if (!Array.isArray(obj[key])) return fallback
    const out: T[] = []
    for (const item of obj[key] as unknown[]) {
      const res = schema.safeParse(item)
      if (res.success) out.push(res.data)
      else problems.push(`${label}: s'ha descartat una entrada (${res.error.issues[0]?.message ?? "invàlida"}).`)
    }
    return out
  }

  const stored = list("references", RefPresetSchema, BUILTIN_REFERENCES, "Objectes de referència")
  const kept = stored.filter((r) => !isRetired(r))
  if (kept.length !== stored.length) migrated = true
  const references = withBuiltins(kept, BUILTIN_REFERENCES)
  const materialsRaw = list("materials", MaterialPrefSchema, BUILTIN_MATERIALS, "Materials")
  const v12 = migrateMaterials(materialsRaw, version, problems)
  const materials = v12.materials
  const renamed = (n: string) => v12.renames.find(([from]) => from === n)?.[1] ?? n
  const boards = section("boards", SettingsSchema.shape.boards, DEFAULT_SETTINGS.boards, "Taulers")
  const defaults = section("defaults", SettingsSchema.shape.defaults, DEFAULT_SETTINGS.defaults, "Materials (per defecte als mòduls nous)")
  const v7 = version < 7
  const machines = oneDefault(machinesOf(obj.machines, problems, () => (migrated = true)))
  // v11: regles del taller. Si les preferències no en porten (anteriors a la v11), les de les màquines (`rulesFromMachines`).
  const machiningRules = "machiningRules" in obj
    ? section("machiningRules", MachineRulesSchema, defaultMachineRules(), "Regles de mecanitzat")
    : (rulesFromMachines(machines) ?? defaultMachineRules())
  if (machines.some((m) => m.rules !== undefined)) migrated = true
  // v19: biblioteca de ferratges. Sense (anteriors a la v19), els items inicials amb els números d'abans (`hardware`):
  // cap forat no canvia de lloc. Un item dolent només treu aquell item; cada lloc apunta a un item que hi és.
  const hardwareRaw = "hardwareLibrary" in obj
    ? list("hardwareLibrary", HardwareItemSchema, DEFAULT_HARDWARE_LIBRARY, "Ferratges")
    : libraryFromLegacy(section("hardware", LegacyHardwareSchema, DEFAULT_LEGACY_HARDWARE, "Ferratges"))
  // Els importats amb el nom que posava l'app abans (carpeta de l'usuari i del ZIP al nom) passen al d'ara.
  const hardwareLibrary = migrateHardwareLibrary(hardwareRaw, version)
  if (hardwareLibrary.migrated) migrated = true
  const hardware = fixHardwareDefaults(hardwareLibrary.library, section("hardwareDefaults", HardwareDefaultsSchema.partial(), DEFAULT_HARDWARE_DEFAULTS, "Ferratges (per defecte)"))
  if (hardware.changed) migrated = true
  // Prebroca dels cargols, una sola font: la regla desada o, a les preferències d'abans, la del primer joc de la
  // biblioteca (el que es feia servir); els jocs de la biblioteca en copien els números.
  const pilotRule = (() => {
    const pilot = "kitPilot" in obj ? section("kitPilot", KitPilotSchema, kitPilotFromLibrary(hardware.library), "Ferratges (prebroca)") : kitPilotFromLibrary(hardware.library)
    if (!("kitPilot" in obj)) migrated = true
    const library = setKitPilot(hardware.library, pilot)
    return { pilot, library: library.some((x, i) => x !== hardware.library[i]) ? library : hardware.library }
  })()
  // Àlies segons els materials d'aquestes preferències (un «X (foto)» que encara hi és no es toca).
  const names = new Set(materials.map((m) => m.name))
  const alias = (n: string) => resolveMaterialAlias(n, names)
  const settings: Settings = {
    version: SETTINGS_VERSION,
    references,
    materials,
    boards: v7 || v12.renames.length ? { ...boards, sheets: boards.sheets.map((x) => ({ ...x, material: renamed(v7 ? alias(x.material) : x.material) })) } : boards,
    hardwareLibrary: pilotRule.library,
    hardwareDefaults: hardware.defaults,
    kitPilot: pilotRule.pilot,
    gaps: section("gaps", GapsPrefSchema, DEFAULT_SETTINGS.gaps, "Folgances per defecte"),
    label: section("label", SettingsSchema.shape.label, DEFAULT_SETTINGS.label, "Etiquetes"),
    display: section("display", SettingsSchema.shape.display, DEFAULT_SETTINGS.display, "Visualització"),
    defaults: v7 || v12.renames.length ? { ...defaults, material: renamed(v7 ? alias(defaults.material) : defaults.material), backMaterial: renamed(v7 ? alias(defaults.backMaterial) : defaults.backMaterial) } : defaults,
    // v10: màquines CNC (additiu: abans no n'hi havia). Si n'hi ha més d'una per defecte, només la primera.
    // Una eina invàlida només treu aquella eina, no tota la màquina (`repairMachine`).
    // v11: les regles ja no són de la màquina (`machiningRules`); les `rules` desades es treuen.
    machines: machines.map(stripRules),
    machiningRules,
    // v26: additiu (sense, sense clau i el model per defecte); un model que ja no hi és torna al per defecte.
    assistant: section("assistant", AssistantPrefSchema, DEFAULT_SETTINGS.assistant, "Assistent IA"),
    // v53: additiu (sense, els preus a 0 i la merma i l'IVA inicials).
    prices: section("prices", SettingsSchema.shape.prices, DEFAULT_SETTINGS.prices, "Preus del pressupost"),
    // v49: les `optionPrefs` de la v48 (amagar opcions i per defecte propis) es treuen: no es llegeixen.
  }
  return { settings, problems, migrated: migrated || problems.length > 0, renames: v12.renames }
}

/**
 * Passos de migració dels materials (v2…v36, en ordre) i noms únics (sempre). Cada pas depèn només de la versió desada.
 * Els avisos dels noms repetits van a `problems`.
 */
function migrateMaterials(materialsRaw: MaterialPref[], version: number, problems: string[]): { materials: MaterialPref[]; renames: [string, string][] } {
  // v2: materials que no són de CNC (ferro, inox, pedra, vidre), per a les peces lliures.
  // v3: materials de simulació (teixits, parquet, rajola, pintura) per als ambients.
  const missing = (list: MaterialPref[], from: MaterialPref[]) => list.filter((m) => !from.some((x) => x.id === m.id || x.name === m.name))
  const v2 = materialsRaw.length && version < 2 ? [...materialsRaw, ...missing(NON_CNC_MATERIALS, materialsRaw)] : materialsRaw
  // Cada grup només s'afegeix a qui encara no l'havia rebut (versió desada anterior a la que el va portar): així els
  // que l'usuari ha esborrat no tornen.
  const sims = (v: number) => SIM_MATERIALS.filter((m) => SIM_MATERIALS_SINCE[m.id] === v)
  const v4 = v2.length ? [...v2, ...missing([...(version < 3 ? sims(3) : []), ...(version < 4 ? sims(4) : []), ...(version < 5 ? sims(5) : [])], v2)] : BUILTIN_MATERIALS
  // v5: llum i translucidesa dels materials de simulació de sempre (si no se n'hi ha posat).
  const v5 = version < 5 ? v4.map((m) => {
    const b = SIM_MATERIALS.find((x) => x.id === m.id)
    return b && (b.glow !== undefined || b.translucent !== undefined) && m.glow === undefined && m.translucent === undefined ? { ...m, ...(b.glow !== undefined ? { glow: b.glow } : {}), ...(b.translucent !== undefined ? { translucent: b.translucent } : {}) } : m
  }) : v4
  // v6: materials de foto amb mapes PBR (Poly Haven), només els que falten.
  const v6 = version < 6 && v5 !== BUILTIN_MATERIALS ? [...v5, ...missing(PHOTO_MATERIALS, v5)] : v5
  // v7: els de sempre amb l'acabat de foto; els «(foto)» repetits fora i la resta sense «(foto)» (idempotent).
  const v7m = version < 7 && v6 !== BUILTIN_MATERIALS ? upgradeToPhoto(v6) : v6
  // v8: mida real de les xapes de foto (roure 1100 → 600, noguera…), només si encara tenen la d'abans.
  const v8m = version < 8 && v7m !== BUILTIN_MATERIALS ? rescalePhotoTiles(v7m) : v7m
  // v9: gruixos perduts a la v7 (xapes de foto) i materials de les plantilles que faltaven (mai se'n sobreescriu cap).
  const v9m = version < 9 && v8m !== BUILTIN_MATERIALS ? [...restorePhotoThicknesses(v8m), ...missing(TEMPLATE_MATERIALS, v8m)] : v8m
  // v12: duplicats fora («Melamina 19», «DM 10», «Pi»); els noms canviats es segueixen a tot arreu (`renames`).
  const v12 = version < 12 && v9m !== BUILTIN_MATERIALS ? mergeDuplicateMaterials(v9m) : { materials: v9m, renames: [] }
  // v13: gruixos que les plantilles del catàleg fan servir i els materials inicials no tenien (només s'afegeixen).
  const v13m = version < 13 && v12.materials !== BUILTIN_MATERIALS ? addCatalogThicknesses(v12.materials) : v12.materials
  // v14: «Tira LED» (llum dels mobles), si no hi és.
  const v14m = version < 14 && v13m !== BUILTIN_MATERIALS ? [...v13m, ...missing(LED_MATERIALS, v13m)] : v13m
  // v15: lacats brillants (vernís), si no hi són.
  const v15m = version < 15 && v14m !== BUILTIN_MATERIALS ? [...v14m, ...missing(GLOSS_MATERIALS, v14m)] : v14m
  // v16: fusta de fil (roure i noguera), si no hi són.
  const v16m = version < 16 && v15m !== BUILTIN_MATERIALS ? [...v15m, ...missing(RIFT_MATERIALS, v15m)] : v15m
  // v17: revestiment de roure de fil, i la llum de les pantalles de lli (només si encara tenen la d'abans, 4).
  const v17m = version < 17 && v16m !== BUILTIN_MATERIALS
    ? [...v16m.map((m) => (m.id === "sim-lampshade" && m.glow === 4 ? { ...m, glow: LAMPSHADE_GLOW } : m)), ...missing(CLADDING_MATERIALS, v16m)]
    : v16m
  // v18: la «Gespa» de foto, si encara tenia la tela de la v17.
  const v18m = version < 18 && v17m !== BUILTIN_MATERIALS ? v17m.map((m) => (m.id === "sim-lawn" && deepEqual(m.finish, OLD_LAWN_FINISH) ? { ...m, finish: LAWN_FINISH } : m)) : v17m
  // v36: l'alumini plata dels marcs de vitrina Häfele, si no hi és.
  const v36m = version < 36 && v18m !== BUILTIN_MATERIALS ? [...v18m, ...missing(FRAME_MATERIALS, v18m)] : v18m
  // v47: el vidre negre del cos dels electrodomèstics, si no hi és.
  const v47m = version < 47 && v36m !== BUILTIN_MATERIALS ? [...v36m, ...missing(APPLIANCE_MATERIALS, v36m)] : v36m
  // v50: les superfícies sòlides tipus Corian, si no hi són.
  const v50m = version < 50 && v47m !== BUILTIN_MATERIALS ? [...v47m, ...missing(CORIAN_MATERIALS, v47m)] : v47m
  // v51: els Corian de la v50 a la categoria Corian, amb el gra més fi (el de la v50 semblava granit), si no s'han tocat, i els blocs de 38 i 57.
  const v51m = version < 51 && v50m !== BUILTIN_MATERIALS
    ? v50m.map((m) => {
        const fresh = CORIAN_V50_FINISH[m.id] ? CORIAN_MATERIALS.find((c) => c.id === m.id) : undefined
        if (!fresh) return m
        return { ...m, ...(deepEqual(m.finish, CORIAN_V50_FINISH[m.id]) ? { finish: fresh.finish } : {}), thicknesses: [...new Set([...m.thicknesses, 38, 57])].sort((a, b) => a - b), ...(m.category === "board" ? { category: "corian" as const } : {}) }
      })
    : v50m
  // v51: la carta de colors de Corian (categoria Corian), si no hi és.
  const v51c = version < 51 && v51m !== BUILTIN_MATERIALS ? [...v51m, ...missing(CORIAN_CATALOG, v51m)] : v51m
  // v52: el roure massís que no es canteja (galeria Llistons), si no hi és.
  const v52m = version < 52 && v51c !== BUILTIN_MATERIALS ? [...v51c, ...missing(SOLID_WOOD_MATERIALS, v51c)] : v51c
  // Noms únics (sempre): un de repetit passa a «X 2» amb un avís (abans no es comprovava).
  const unique = dedupeMaterialNames(v52m)
  problems.push(...unique.problems)
  return { materials: unique.materials, renames: v12.renames }
}

/**
 * Passos de migració de la biblioteca de ferratges (noms dels importats, v23…v44, en ordre). `migrated`: algun pas l'ha
 * canviada.
 */
function migrateHardwareLibrary(hardwareRaw: HardwareItem[], version: number): { library: HardwareItem[]; migrated: boolean } {
  let migrated = false
  const named = migrateImportedNames(hardwareRaw)
  if (named.changed) migrated = true
  // v23: els jocs de calaix inicials, si no hi són (per id; un d'esborrat a propòsit torna un sol cop, com els materials).
  const withKits = version < 23 ? [...named.library, ...DEFAULT_HARDWARE_KITS.filter((k) => !named.library.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : named.library
  if (withKits !== named.library && withKits.length !== named.library.length) migrated = true
  // v24: els jocs inicials reben les dades del joc d'ara (formes 3D, acabats); nom i prebroca de l'usuari es queden.
  const freshKits = version < 24
    ? withKits.map((x) => {
        const fresh = x.builtin && x.engine === "drawerKit" ? DEFAULT_HARDWARE_KITS.find((k) => k.id === x.id) : undefined
        return fresh?.kit ? { ...x, kit: structuredClone(fresh.kit) } : x
      })
    : withKits
  if (freshKits.some((x, i) => x !== withKits[i])) migrated = true
  // v27: els jocs i els push latch del catàleg DTC 2026, si no hi són (per id; un d'esborrat a propòsit torna un sol cop).
  const withV27 = version < 27 ? [...freshKits, ...V27_ITEMS.filter((k) => !freshKits.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : freshKits
  if (withV27.length !== freshKits.length) migrated = true
  // v28: la resta del catàleg DTC 2026, si no hi és (per id).
  const withV28 = version < 28 ? [...withV27, ...V28_ITEMS.filter((k) => !withV27.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : withV27
  if (withV28.length !== withV27.length) migrated = true
  // v29: fora els «només 3D» sense mecanitzat i els inicials DTC que ja no són a la biblioteca de l'app.
  // (La v29 primera només treia els `model` sense `machining`; qui ja era a la 29 amb els push latch, unions… desats
  // hi passa a la v30 amb la regla d'ara, idempotent.)
  const withV29 = version < 30 ? withV28.filter((x) => !(x.engine === "model" && (x.builtin || !x.machining?.length)) && !(x.builtin && x.maker === "DTC" && !DEFAULT_HARDWARE_LIBRARY.some((d) => d.id === x.id))) : withV28
  if (withV29.length !== withV28.length) migrated = true
  // v31: els jocs de llum Häfele Loox (`V31_ITEMS`), si no hi són (per id).
  const withV31 = version < 31 ? [...withV29, ...V31_ITEMS.filter((k) => !withV29.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : withV29
  if (withV31.length !== withV29.length) migrated = true
  // v34: les potes de sòcol Häfele AXILO 78 (`V34_ITEMS`), si no hi són (per id).
  const withV34 = version < 34 ? [...withV31, ...V34_ITEMS.filter((k) => !withV31.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : withV31
  if (withV34.length !== withV31.length) migrated = true
  // v35: el catàleg general Häfele (`V35_ITEMS`), si no hi és (per id).
  const withV35 = version < 35 ? [...withV34, ...V35_ITEMS.filter((k) => !withV34.some((x) => x.id === k.id)).map((k) => structuredClone(k))] : withV34
  if (withV35.length !== withV34.length) migrated = true
  // v36: els marcs Häfele de la v35 desats sense material reben el seu (plata); un de canviat a mà es queda.
  const withV36 = version < 36 ? withV35.map((x) => {
    const fresh = x.builtin && !x.material ? V35_ITEMS.find((k) => k.id === x.id && k.material) : undefined
    return fresh ? { ...x, material: fresh.material } : x
  }) : withV35
  if (withV36.some((x, i) => x !== withV35[i])) migrated = true
  // v39: la pota AXILO 78 de mobles, si no hi és (per id); v41: la frontissa Metallamat A; v45: penjador, regleta i
  // sòcols d'alumini; v46: els electrodomèstics.
  const v39add = version < 39 ? V39_ITEMS : []
  const v41add = [...(version < 41 ? V41_ITEMS : []), ...(version < 42 ? V42_ITEMS : []), ...(version < 43 ? V43_ITEMS : []), ...(version < 44 ? V44_ITEMS : []), ...(version < 45 ? V45_ITEMS : []), ...(version < 46 ? V46_ITEMS : []), ...(version < 54 ? V54_ITEMS : [])]
  const withV39 = [...withV36, ...[...v39add, ...v41add].filter((k) => !withV36.some((x) => x.id === k.id)).map((k) => structuredClone(k))]
  if (withV39.length !== withV36.length) migrated = true
  // La pota AXILO 78 (v34) d'una versió anterior de l'item passa a la d'ara (com la munta el taller, la placa per
  // dibuixar-la, a 50 dels cantells): sempre, no només en pujar de versió de les preferències (l'item canvia de `version`
  // sense que en canviï la de les preferències). El mateix per al penjador, la regleta i els sòcols d'alumini (v45) i els
  // electrodomèstics (v46), que passen als estàndard del fabricant (2026-10-15). Idempotent.
  const withV37 = withV39.map((x) => {
    const fresh = x.builtin ? [...V34_ITEMS, ...V39_ITEMS, ...V35_ITEMS, ...V45_ITEMS, ...V46_ITEMS].find((k) => k.id === x.id && k.version > x.version) : undefined
    return fresh ? structuredClone(fresh) : x
  })
  if (withV37.some((x, i) => x !== withV39[i])) migrated = true
  // v40: els perfils de LED (motor `ledProfile`) són a «Llums», no a «Perfils i marcs».
  const withV40 = version < 40 ? withV37.map((x) => (x.engine === "ledProfile" && x.category === "profile" ? { ...x, category: "light" as const } : x)) : withV37
  if (withV40.some((x, i) => x !== withV37[i])) migrated = true
  return { library: withV40, migrated }
}

/** Un material sense l'`id` (per comparar-lo amb un valor inicial). */
const withoutId = ({ id: _id, ...rest }: MaterialPref) => rest

/**
 * v12: duplicats fora. «Melamina 19» → «Melamina blanca» i «DM 10» → «DM (fons)» (només si encara són els inicials de
 * la v9 i el de sempre hi és; els gruixos passen al de sempre) i «Pi» (fulles, `sim-pine`) → «Fulles de pi» (si el nom
 * és lliure). Torna els canvis de nom (`from → to`) perquè les preferències (per defecte, taulers) i els mobles i
 * ambients desats els segueixin. Idempotent.
 */
/** Gruixos que fan servir les plantilles del catàleg (v13): s'afegeixen als materials inicials que no els tenien. */
const CATALOG_THICKNESSES: Record<string, number[]> = { "mel-white": [30], "mel-grey": [30], "mel-oak": [30], oak: [40], ash: [16, 30] }
export function addCatalogThicknesses(list: MaterialPref[]): MaterialPref[] {
  return list.map((m) => {
    const add = (CATALOG_THICKNESSES[m.id] ?? []).filter((t) => !m.thicknesses.includes(t))
    return add.length ? { ...m, thicknesses: [...m.thicknesses, ...add].sort((a, b) => a - b) } : m
  })
}

function mergeDuplicateMaterials(list: MaterialPref[]): { materials: MaterialPref[]; renames: [string, string][] } {
  let out = list
  const renames: [string, string][] = []
  const has = (name: string) => out.some((m) => m.name === name)
  for (const retired of RETIRED_TEMPLATE_MATERIALS) {
    const target = MATERIAL_MERGES[retired.name]!
    const dup = out.find((m) => m.name === retired.name)
    const owner = out.find((m) => m.name === target)
    if (!dup || !owner || !deepEqual(withoutId(dup), withoutId(retired))) continue
    const thicknesses = [...new Set([...owner.thicknesses, ...dup.thicknesses])].sort((a, b) => a - b)
    out = out.filter((m) => m !== dup).map((m) => (m === owner && thicknesses.length !== m.thicknesses.length ? { ...m, thicknesses } : m))
    renames.push([retired.name, target])
  }
  // Només si «Pi» és les fulles (sim-pine) i cap altre material es diu «Pi» (p. ex. la fusta de pi de la biblioteca): si
  // no, es reanomenarien també els mobles de fusta de pi.
  const pine = out.find((m) => m.id === "sim-pine" && m.name === "Pi")
  const otherPi = out.some((m) => m !== pine && m.name.trim().toLowerCase() === "pi")
  if (pine && !otherPi && !has(MATERIAL_MERGES.Pi!)) {
    out = out.map((m) => (m === pine ? { ...m, name: MATERIAL_MERGES.Pi! } : m))
    renames.push(["Pi", MATERIAL_MERGES.Pi!])
  }
  return { materials: out, renames }
}

/**
 * Noms repetits (`materialNameKey`: majúscules i espais a part) en unes preferències desades: el segon es diu «X 2»
 * (el tercer «X 3»…). Les dades es conserven; els mobles continuen apuntant al primer.
 */
function dedupeMaterialNames(list: MaterialPref[]): { materials: MaterialPref[]; problems: string[] } {
  const keys = new Set<string>()
  const problems: string[] = []
  const all = new Set(list.map((m) => materialNameKey(m.name)))
  const materials = list.map((m) => {
    const k = materialNameKey(m.name)
    if (!keys.has(k)) {
      keys.add(k)
      return m
    }
    let n = 2
    while (all.has(materialNameKey(`${m.name.trim()} ${n}`))) n++
    const name = `${m.name.trim()} ${n}`
    all.add(materialNameKey(name))
    keys.add(materialNameKey(name))
    problems.push(`Materials: «${m.name.trim()}» estava repetit; l'altre ara es diu «${name}».`)
    return { ...m, name }
  })
  return { materials: problems.length ? materials : list, problems }
}

const stripRules = (m: Machine): Machine => {
  if (m.rules === undefined) return m
  const { rules: _rules, ...rest } = m
  return rest
}

/**
 * v11: regles del taller d'unes preferències que encara les tenien per màquina: les de la màquina per defecte (o, si no
 * en té, les de la primera que en tingui; si cap, les inicials). Les màquines ja han passat per `migrateMachine`
 * (llindars provisionals d'abans migrats). `undefined` si cap màquina en porta.
 */
export function rulesFromMachines(machines: readonly Machine[]): MachineRules | undefined {
  return defaultMachine(machines)?.rules ?? machines.find((m) => m.rules)?.rules
}

function machinesOf(raw: unknown, problems: string[], onMigrated: () => void): Machine[] {
  if (!Array.isArray(raw)) return []
  const out: Machine[] = []
  for (const item of raw) {
    const r = repairMachine(item)
    const name = isRecord(item) && typeof item.name === "string" ? item.name : "?"
    // Els valors provisionals d'abans es migren un sol cop (`rulesVersion`); si canvia alguna cosa, es desa (així una
    // tria posterior de l'usuari es queda).
    if (r.machine) {
      const m = migrateMachine(r.machine)
      if (m !== r.machine) onMigrated()
      out.push(m)
    }
    else problems.push(`Màquines CNC: s'ha descartat la màquina ${name} (${r.problems.at(-1) ?? "invàlida"}).`)
    if (r.machine && r.problems.length) problems.push(`Màquines CNC (${name}): ${r.problems.join("; ")}.`)
  }
  return out
}

function oneDefault(ms: Machine[]): Machine[] {
  let seen = false
  return ms.map((m) => {
    if (!m.isDefault) return m
    if (seen) return { ...m, isDefault: false }
    seen = true
    return m
  })
}

/** Els valors inicials sempre hi són (amagats o no): si falten, s'afegeixen al final. */
function withBuiltins(refs: RefPreset[], builtins: RefPreset[]): RefPreset[] {
  const ids = new Set(refs.map((r) => r.id))
  return [...refs, ...builtins.filter((b) => !ids.has(b.id))]
}

/**
 * Text JSON per exportar (còpia o passar-les a un altre dispositiu). **Sense la clau de l'assistent**: és secreta i
 * només es desa en aquest dispositiu (el fitxer es pot passar a algú altre).
 */
export function settingsToJson(s: Settings): string {
  const { apiKey: _key, ...assistant } = s.assistant
  void _key
  return JSON.stringify({ ...s, assistant }, null, 2)
}

/** Importa un JSON: mai llança. */
export function settingsFromJson(text: string): SettingsParse {
  try {
    return parseSettings(JSON.parse(text))
  } catch {
    return { settings: DEFAULT_SETTINGS, problems: ["El fitxer no és un JSON vàlid."], migrated: false }
  }
}

/**
 * Importa un JSON de preferències **sobre les actuals**: només se substitueixen les seccions que porta el fitxer
 * (un fitxer sense `machines`, p. ex. d'abans de la v10, no esborra les màquines). Mai llança.
 */
export function importSettingsJson(current: Settings, text: string): SettingsParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { settings: current, problems: ["El fitxer no és un JSON vàlid."], migrated: false }
  }
  const res = parseSettings(raw)
  if (!isRecord(raw)) return { ...res, settings: current }
  const merged: Settings = { ...current }
  for (const key of Object.keys(current) as (keyof Settings)[]) {
    if (key !== "version" && key in raw) (merged as Record<string, unknown>)[key] = res.settings[key]
  }
  // Un fitxer d'abans de la v19 porta els ferratges com a números (`hardware`): la biblioteca que en surt.
  if (!("hardwareLibrary" in raw) && "hardware" in raw) {
    merged.hardwareLibrary = res.settings.hardwareLibrary
    merged.hardwareDefaults = res.settings.hardwareDefaults
  }
  // Els per defecte de ferratges es comproven contra la biblioteca que queda (no la inicial, com a `parseSettings`): un
  // fitxer només amb `hardwareDefaults` pot apuntar a un item teu, i un només amb `hardwareLibrary` pot deixar-ne d'orfes.
  const wantDefaults = "hardwareDefaults" in raw
    ? { ...merged.hardwareDefaults, ...repairValue(HardwareDefaultsSchema.partial(), raw.hardwareDefaults, {}, () => {}) }
    : merged.hardwareDefaults
  const hw = fixHardwareDefaults(merged.hardwareLibrary, wantDefaults)
  if (hw.changed) merged.hardwareLibrary = hw.library
  merged.hardwareDefaults = hw.defaults
  // La clau de l'assistent és d'aquest dispositiu: un fitxer (que no n'hauria de portar cap) no la canvia ni la treu.
  merged.assistant = { ...merged.assistant, ...(current.assistant.apiKey ? { apiKey: current.assistant.apiKey } : {}) }
  if (!current.assistant.apiKey) delete merged.assistant.apiKey
  // Un fitxer d'abans de la v11 porta les regles a les màquines: es fan servir (`rulesFromMachines`).
  if (!("machiningRules" in raw) && Array.isArray(raw.machines) && raw.machines.some((m) => isRecord(m) && m.rules !== undefined)) {
    merged.machiningRules = res.settings.machiningRules
  }
  return { ...res, settings: merged }
}
