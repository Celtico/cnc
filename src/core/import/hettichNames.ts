import type { HardwareCategory, HardwareItem } from "../model/hardware"
import { blumSeries, migrateBlumItem } from "./blum"

/**
 * Noms, carpetes i sèries dels articles de Hettich: què és cada carpeta (alemany → categoria de l'app), el nom que es
 * proposa («Porta corredissa SlideLine 55 · 9060402») i la sèrie per agrupar la biblioteca (Frontisses › Sensys). Pur i
 * sense dependències de temps d'execució del model (només tipus): el fan servir el lector de les descàrregues
 * (`hettich.ts`) i la lectura de les preferències (`migrateImportedNames`). Detall a `docs/ferratges-import.md`.
 */

/**
 * Què es fa amb l'article a l'app: frontissa i placa (forats del STEP, regles de sempre), tirador (la distància entre
 * forats del STEP, al motor del tirador), pota (forats de la placa a la base «Potes»), **només 3D** (`model`: el model i el
 * volum, cap forat: estructures de taula, portes corredisses i plegables, Cadro, accessoris i les carpetes que no es
 * coneixen; també els que només porten les vistes DXF, fins que s'hi afegeix el STEP) o res (`none`).
 */
export type ImportKind = "hinge" | "plate" | "handle" | "leg" | "model" | "none"

/** Carpetes de format de les descàrregues (la del ZIP desplegat: `STEP_Scharniere`, `DWG_DXF_Griffe`, `dxf_einbau`…). */
const FORMAT_DIRS = /^(step|dwg|dxf|3ds|igs|iges|stl|sat|pdf)(_[^/]*)?$/i
const isFormatDir = (d: string) => FORMAT_DIRS.test(d) || /^(STEP|DWG|DXF|3DS|IGES?|STL)_/i.test(d) || /^Anschlagloesungen/i.test(d)

/** Carpetes de família (la primera de la descàrrega), que no surten al nom ni al grup. */
export const FAMILY_DIRS = /^(Scharniere|Montageplatten|Schubkastensysteme|Griffe|Tischgestelle.*|Cadro_Aluminiumrahmensystem|Schiebetuersysteme|Falttuersysteme)$/i

/**
 * Les carpetes que diuen què és l'article, d'un camí (sense el nom del fitxer): **sense** la carpeta de l'usuari (p. ex.
 * «ferratges», on hi ha els ZIP), la del ZIP o de format (`STEP_…`, `DWG_DXF_…`, `dxf_einbau`) ni res d'abans de la
 * família (`Scharniere`, `Griffe`…), i sense les carpetes de plànols (`…_KB_2d`). El mateix article des del ZIP STEP i
 * des del DWG/DXF dona les mateixes carpetes.
 */
export function cleanFolders(dirs: readonly string[]): string[] {
  let out = [...dirs]
  let last = -1
  out.forEach((d, i) => {
    if (isFormatDir(d)) last = i
  })
  if (last >= 0) out = out.slice(last + 1)
  const fam = out.findIndex((d) => FAMILY_DIRS.test(d))
  if (fam > 0) out = out.slice(fam)
  return out.filter((p) => !/_KB_2d$/i.test(p))
}

/** Paraules de les carpetes (alemany) → català, per al nom i el grup (les d'abans: el nom antic es reconeix amb aquestes). */
const LEGACY_WORDS: [RegExp, string][] = [
  [/^Oeffnungswinkel_(\d+)(_Glas)?$/i, "$1°"],
  [/^Opening_angle_(.+)$/i, "$1°"],
  [/^Innenwinkel_(\d+)_W(-?\d+)$/i, "angle $2°"],
  [/^Intermat_(\d+)_W(-?\d+)$/i, "Intermat $1 angle $2°"],
  [/^aufliegend-Mittelseiten$/i, "mig recobrent"],
  [/^aufliegend$/i, "recobrent"],
  [/^einliegend$/i, "encastat"],
  [/^vorliegend$/i, "recobrent"],
  [/^halb_vorliegend$/i, "mig recobrent"],
  [/^Scharniere_Topf_26mm$/i, "cassoleta Ø26"],
  [/^Mit_vor_Euroschrauben$/i, "amb cargols euro"],
  [/^Mit_vor_Spanplattenschrauben$/i, "amb cargols d'aglomerat"],
  [/^Zum_Einpressen$/i, "per pressió (espigues)"],
  [/^Zum_Anschrauben$/i, "per cargolar"],
  [/^Zum_Ankleben$/i, "per encolar"],
  [/^Mit_Spreizmuffen$/i, "amb tacs d'expansió"],
  [/^Linearmontageplatten$/i, "lineal"],
  [/^Faceframe_Stollenwand$/i, "marc (face frame)"],
  [/^Hettich_Direkt$/i, "Hettich Direkt"],
  [/^System_(\d+)$/i, "sistema $1"],
  [/^New_Modern$/i, "New Modern"],
  [/^Touch_In$/i, "Touch-in"],
  [/^Exclusive_Designgriffe$/i, "Exclusive (de disseny)"],
  [/^Aluminium_Moebelfuesse$/i, "d'alumini"],
  [/^Stahl_Moebelfuesse$/i, "d'acer"],
  [/^Tischbeine_Moebelfuesse$/i, "de taula"],
  [/^Steelforce_Elektronik$/i, "Steelforce electrònica"],
  [/^Handschalter$/i, "comandament"],
  [/^Netzkabel$/i, "cable de corrent"],
  [/^Kabelmanagement$/i, "passacables"],
  [/^Sicht-und_Schallschutz$/i, "pantalla"],
  [/^Stauraum_am_Tisch$/i, "calaix sota taula"],
  [/^Steelforce_SF_Homeoffice_Line$/i, "Steelforce SF Homeoffice"],
  [/^Steelforce_SLS_Professional_Line$/i, "Steelforce SLS Professional"],
  [/^Zubehoer$/i, "accessori"],
  [/^Profile$/i, "perfil"],
  [/^Profilsets$/i, "perfils"],
  [/^EB_(\S+)$/i, "EB $1"],
]
/** Les que s'hi han afegit després (sistemes de calaix). */
const WORDS: [RegExp, string][] = [
  ...LEGACY_WORDS,
  [/^(?:Doppelwandiges|Einwandiges)_System_(.+)$/i, "$1"],
  [/^Elektromechanisches_Oeffnen_(.+)$/i, "$1"],
  [/^Innenorganisation$/i, "organització interior"],
  [/^Wirebaskets$/i, "cistelles"],
]
const translate = (words: [RegExp, string][]) => (dir: string): string => {
  for (const [re, out] of words) if (re.test(dir)) return dir.replace(re, out).replace(/_/g, " ")
  return dir.replace(/_/g, " ")
}
/** Una carpeta en català (les sèries, com venen: «SlideLine 55», «Sensys»). */
export const tr = translate(WORDS)
const trLegacy = (dir: string): string => {
  for (const [re, out] of LEGACY_WORDS) if (re.test(dir)) return dir.replace(re, out)
  return dir.replace(/_/g, " ")
}

interface Classified {
  category: HardwareCategory
  tags: string[]
  kind: ImportKind
  noun: string
  /** Per què és «només 3D» (sense regla de mecanitzat a l'app). */
  why?: string
}

/**
 * Carpetes → categoria de l'app, etiquetes i què se'n fa. Primer la família de la descàrrega (la carpeta de dalt:
 * `Griffe`, `Tischgestelle_…`, `Cadro_…`, `Schiebetuersysteme`, `Falttuersysteme`, `Scharniere`…), després la subcarpeta.
 * El que no es coneix es pot importar igual, com a «Ferratge» només 3D.
 */
export function classifyHettich(folders: readonly string[]): Classified {
  const has = (re: RegExp) => folders.some((f) => re.test(f))
  // Les subcarpetes (la de la família, p. ex. «Tischgestelle_-beine_Moebelfuesse_…», ja diu «Moebelfuesse»).
  const sub = folders.filter((f) => !FAMILY_DIRS.test(f))
  const hasSub = (re: RegExp) => sub.some((f) => re.test(f))
  const tags: string[] = []
  const model = (category: HardwareCategory, noun: string, why: string): Classified => ({ category, tags, kind: "model", noun, why })
  // Famílies que no són de frontisses.
  if (has(/^Griffe$/i)) {
    if (has(/^Zubehoer$/i)) return model("handle", "Accessori de tirador", "Accessori de tirador: no fa forats segons cap regla del moble.")
    return { category: "handle", tags, kind: "handle", noun: has(/^Touch_In$/i) ? "Tirador Touch-in" : "Tirador" }
  }
  if (has(/^Tischgestelle/i) || hasSub(/Moebelfuesse|^Tischbeine|^LegaDrive$|^LegaMove$|^Steelforce|^Trimanis$|^Change$/i)) {
    if (hasSub(/Elektronik|Handschalter|Netzkabel/i)) return model("misc", "Accessori", "Electrònica de la taula: només es veu.")
    if (hasSub(/^Zubehoer$|Kabelmanagement|Sicht-und_Schallschutz|Stauraum_am_Tisch/i)) return model("misc", "Accessori", "Accessori de taula: no fa forats segons cap regla del moble.")
    if (hasSub(/^Tischbeine/i)) return { category: "leg", tags, kind: "leg", noun: "Pota de taula" }
    if (hasSub(/Moebelfuesse/i)) return { category: "leg", tags, kind: "leg", noun: "Pota" }
    if (hasSub(/^Trimanis$/i)) return model("table", "Guia de taula", "Guia d'extensió de taula: encara no hi ha la regla dels seus forats (pendent).")
    return model("table", "Estructura de taula", "Estructura de taula: encara no hi ha la regla dels seus forats (pendent).")
  }
  if (has(/^Cadro/i)) return model("profile", "Marc d'alumini (Cadro)", "Marc d'alumini per a portes de vidre: encara no hi ha la regla (pendent, amb la porta de vidre).")
  if (has(/^Schiebetuer/i)) return model("door-system", has(/^Zubehoer$/i) ? "Accessori de porta corredissa" : "Porta corredissa", "Porta corredissa: encara no hi ha la regla de les ranures i els forats dels perfils (pendent).")
  if (has(/^Falttuer/i)) return model("door-system", "Porta plegable", "Porta plegable: encara no hi ha la regla de les frontisses entre fulles (pendent).")
  // Frontisses, plaques i el que ve amb elles.
  if (has(/Glas/i)) tags.push("vidre")
  if (has(/Alurahmen/i)) tags.push("alumini")
  if (has(/einliegend/i)) tags.push("encastat")
  else if (has(/Mittelseiten|halb_vorliegend/i)) tags.push("mig recobrent")
  else if (has(/aufliegend|vorliegend/i)) tags.push("recobrent")
  if (has(/^Montageplatten$/i)) return { category: "plate", tags, kind: "plate", noun: "Placa de muntatge" }
  if (has(/^(Zubehoer|Atira_Zubehoer)$/i)) return model("misc", "Accessori", "Accessori: no fa forats segons cap regla del moble.")
  if (has(/Scharniertoepfe/i)) return model("misc", "Cassoleta solta", "Peça d'una frontissa: per als forats, importa la frontissa sencera.")
  if (has(/Schubkasten|Auszug|Auszuege|Laufschiene|Wirebaskets|Innenorganisation|Tech$/i))
    return model("slide", "Calaix o guia", "Guies i calaixos: encara no hi ha la regla dels forats de la guia (pendent).")
  if (has(/Push_to_open/i)) return model("push", "Push", "Obertura per pressió: encara no fa forats.")
  if (has(/Klappen|Lift/i)) return model("lift", "Elevable", "Elevables i abatibles: encara no fan forats.")
  if (has(/Moebelbaender/i)) return model("misc", "Frontissa de pala", "No és de cassoleta: encara no fa forats.")
  if (has(/Scharnier|Sensys|Intermat|Novisys|Veosys|Onsys|Avosys|Perfekt/i)) {
    const noun = tags.includes("vidre") ? "Frontissa de vidre" : tags.includes("alumini") ? "Frontissa per a marc d'alumini" : "Frontissa"
    return { category: "hinge", tags, kind: "hinge", noun }
  }
  return model("misc", "Ferratge", "Carpeta que l'app no coneix: s'importa el model, sense forats.")
}

/** Paraules de la carpeta que ja són etiquetes (recobrent, encastat…): no van al nom. */
const OVERLAY = /^(mig recobrent|recobrent|encastat)$/

/**
 * Nom proposat: «<nom en català> <sèrie> · <article>» («Porta corredissa SlideLine 55 · 9060402», «Frontissa Sensys
 * 110° · 9071205», «Pota d'acer · 1225»). Les carpetes han de ser les de l'article (`cleanFolders`); la sèrie es queda en
 * alemany, com al catàleg. Com a molt dues paraules de carpeta, sense les que ja diu el nom ni les etiquetes.
 */
export function hettichLabel(folders: readonly string[], article: string, noun = classifyHettich(folders).noun): string {
  const words = folders
    .filter((f) => !FAMILY_DIRS.test(f))
    .map(tr)
    .filter((w) => !/^sistema/.test(w) && w !== "accessori" && !OVERLAY.test(w) && !noun.toLowerCase().includes(w.toLowerCase()))
  return `${noun}${words.length ? ` ${words.slice(0, 2).join(" ")}` : ""} · ${article}`.replace(/\s+/g, " ").trim()
}

/** El nom que posava l'app abans (amb les carpetes tal com es desaven): per reconèixer els que no s'han tocat. */
export function legacyHettichLabel(folders: readonly string[], article: string): string {
  const c = classifyHettich(folders)
  const words = folders.filter((f) => !FAMILY_DIRS.test(f)).map(trLegacy)
  const named = words.filter((w) => !/^sistema/.test(w) && w !== "accessori" && !c.noun.toLowerCase().includes(w.toLowerCase()))
  return `${c.noun}${named.length ? ` ${named.slice(0, 3).join(" ")}` : ""} ${article}`.replace(/\s+/g, " ").trim()
}

/** Sèries que no són una marca (en alemany a la carpeta): el nom del grup en català. */
const SERIES_WORDS: [RegExp, string][] = [
  [/^Aluminium_Moebelfuesse$/i, "Alumini"],
  [/^Stahl_Moebelfuesse$/i, "Acer"],
  [/^Tischbeine_Moebelfuesse$/i, "Potes de taula"],
  [/^Standardscharniere$/i, "Estàndard"],
  [/^Spezial-Scharniere$/i, "Especials"],
  [/^Profilscharniere$/i, "De perfil"],
  [/^Eingelenkscharniere$/i, "D'una articulació"],
  [/^Winkelscharniere$/i, "D'angle"],
  [/^Glastuerscharniere$/i, "De vidre"],
  [/^Alurahmen-Scharniere$/i, "Per a marc d'alumini"],
  [/^Scharniere_Topf_26mm$/i, "Cassoleta Ø26"],
  [/^Push_to_open.*$/i, "Push to open"],
  [/^Moebelbaender$/i, "De pala"],
  [/^Zubehoer$/i, "Accessoris"],
  [/^System_(\d+)$/i, "System $1"],
  [/^Linearmontageplatten$/i, "Lineals"],
  [/^Hettich_Direkt$/i, "Hettich Direkt"],
]

/**
 * La sèrie d'un article importat (la carpeta de després de la família: «Sensys», «Classic», «SlideLine 55», «System
 * 8099»), per agrupar la biblioteca. `null` si no n'hi ha (Cadro, fitxers solts, els de l'app).
 */
export function hettichSeries(folders: readonly string[]): { id: string; label: string } | null {
  const dir = cleanFolders(folders).find((f) => !FAMILY_DIRS.test(f))
  if (!dir) return null
  for (const [re, out] of SERIES_WORDS) if (re.test(dir)) return { id: dir.toLowerCase(), label: dir.replace(re, out) }
  const label = tr(dir)
  return { id: dir.toLowerCase(), label: label.charAt(0).toUpperCase() + label.slice(1) }
}

/** La sèrie d'un item de la biblioteca (els importats de Hettich i de Blum), o `null`. */
export const itemSeries = (item: HardwareItem): { id: string; label: string } | null =>
  !item.imported || item.imported.damaged ? null
  : item.imported.maker === "Hettich" ? hettichSeries(item.imported.folders)
  : item.imported.maker === "Blum" ? blumSeries(item.imported.article, item.imported.folders)
  : null

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Lectura de les preferències: els importats de Hettich amb el nom que posava l'app abans («Porta corredissa ferratges
 * DWG DXF Schiebetuersysteme SlideLine 55 9060402», amb el número de repetit, « 2») passen al d'ara («Porta corredissa
 * SlideLine 55 · 9060402»); un nom que l'usuari ha canviat es queda. Les carpetes desades es netegen (sense la de
 * l'usuari ni la del ZIP, `cleanFolders`). Els de Blum, `migrateBlumItem`. Idempotent; torna la mateixa llista si no
 * canvia res.
 */
export function migrateImportedNames(library: readonly HardwareItem[]): { library: HardwareItem[]; changed: boolean } {
  let changed = false
  const out = library.map((it) => {
    const imp = it.imported
    if (imp?.maker === "Blum") {
      const next = migrateBlumItem(it)
      if (next !== it) changed = true
      return next
    }
    if (!imp || imp.damaged || imp.maker !== "Hettich" || !imp.article) return it
    const folders = cleanFolders(imp.folders)
    const sameFolders = folders.length === imp.folders.length && folders.every((f, i) => f === imp.folders[i])
    const old = legacyHettichLabel(imp.folders, imp.article)
    const m = new RegExp(`^${escapeRe(old)}( \\d+)?$`).exec(it.name)
    const name = m ? `${hettichLabel(folders, imp.article)}${m[1] ?? ""}` : it.name
    if (sameFolders && name === it.name) return it
    changed = true
    return { ...it, name, imported: { ...imp, folders } }
  })
  return { library: changed ? out : (library as HardwareItem[]), changed }
}
