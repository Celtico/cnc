import { HARDWARE_CATEGORIES, type HardwareCategory } from "../model"

/**
 * Descàrregues CAD de Hettich (`hettich.com › Hettich CAD › Descàrregues CAD`): un ZIP per família i format
 * (`STEP_Scharniere.zip`, `DWG_DXF_Scharniere.zip`, `3DS_…`, `dxf_einbau.zip`…) amb carpetes per tipus en alemany i un
 * fitxer (o tres vistes 2D) per **número d'article**. Aquí s'agrupen els fitxers per article i es tradueixen les carpetes a
 * les categories de l'app. Pur (els fitxers ja llegits els passa `features/settings`). Detall a `docs/ferratges-import.md`.
 */

export type HettichFileKind = "step" | "front" | "side" | "top" | "dxf3d" | "dwg" | "3ds" | "pdf" | "other"

export interface HettichFile {
  path: string
  kind: HettichFileKind
  size?: number
}

/**
 * Què es fa amb l'article a l'app: frontissa i placa (forats del STEP, regles de sempre), tirador (la distància entre
 * forats del STEP, al motor del tirador), pota (forats de la placa a la base «Potes»), **només 3D** (`model`: el model i el
 * volum, cap forat: estructures de taula, portes corredisses i plegables, Cadro, accessoris i les carpetes que no es
 * coneixen) o res (`none`: sense STEP no hi ha ni forats ni 3D).
 */
export type ImportKind = "hinge" | "plate" | "handle" | "leg" | "model" | "none"

export interface HettichArticle {
  article: string
  /** Carpetes (sense el ZIP ni la carpeta de format), p. ex. `["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"]`. */
  folders: string[]
  category: HardwareCategory
  tags: string[]
  /** Nom proposat en català («Frontissa Sensys 110° recobrent 9071205»). */
  label: string
  /** Descripció curta de la carpeta, traduïda. */
  group: string
  kind: ImportKind
  /** Per què no es pot importar (si `kind` és `none`). */
  reason?: string
  /** Què se'n farà en una línia («Tirador · distància del STEP», «Només 3D: sense forats»…; `none`: el motiu). */
  plan?: string
  files: HettichFile[]
}

const FORMAT_DIRS = /^(step|dwg|dxf|3ds|igs|iges|stl|sat|pdf)(_[^/]*)?$/i

/** Tipus de fitxer pel nom (les vistes 2D: `<art>_2D_front_view.dxf`, majúscules o minúscules). */
export function hettichFileKind(path: string): HettichFileKind {
  const name = path.split("/").pop()!.toLowerCase()
  if (/\.(stp|step)$/.test(name)) return "step"
  if (/_2d_front_view\.dxf$/.test(name)) return "front"
  if (/_2d_side_view\.dxf$/.test(name)) return "side"
  if (/_2d_top_view\.dxf$/.test(name)) return "top"
  if (/_3d\.dxf$/.test(name)) return "dxf3d"
  if (name.endsWith(".dwg")) return "dwg"
  if (name.endsWith(".3ds")) return "3ds"
  if (name.endsWith(".pdf")) return "pdf"
  return "other"
}

/** Número d'article del nom del fitxer (`9071205.stp`, `9071205_2D_front_view.DXF`, `45064_2d_top_view.dxf`). */
export function hettichArticle(path: string): string | null {
  const name = path.split("/").pop()!
  const m = /^(\d{4,9})(?=[._ -]|$)/.exec(name)
  return m ? m[1]! : null
}

/** Paraules de les carpetes (alemany) → català, per al nom i el grup. */
const WORDS: [RegExp, string][] = [
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
const tr = (dir: string): string => {
  for (const [re, out] of WORDS) if (re.test(dir)) return dir.replace(re, out)
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

/** Carpetes de família (la primera de la descàrrega), que no surten al nom ni al grup. */
const FAMILY_DIRS = /^(Scharniere|Montageplatten|Schubkastensysteme|Griffe|Tischgestelle.*|Cadro_Aluminiumrahmensystem|Schiebetuersysteme|Falttuersysteme)$/i

/**
 * Carpetes → categoria de l'app, etiquetes i què se'n fa. Primer la família de la descàrrega (la carpeta de dalt:
 * `Griffe`, `Tischgestelle_…`, `Cadro_…`, `Schiebetuersysteme`, `Falttuersysteme`, `Scharniere`…), després la subcarpeta.
 * El que no es coneix es pot importar igual, com a «Ferratge» només 3D.
 */
export function classifyHettich(folders: string[]): Classified {
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

/** Què se'n farà (la nota de cada fila del diàleg d'importar), abans de llegir el STEP. */
export function importPlan(kind: ImportKind, why?: string): string {
  switch (kind) {
    case "hinge":
      return "Frontissa · cassoleta i forats del STEP"
    case "plate":
      return "Placa · forats del STEP"
    case "handle":
      return "Tirador · distància dels forats del STEP"
    case "leg":
      return "Pota · forats de la placa del STEP"
    case "model":
      return `Només 3D: sense forats${why ? ` (${why.replace(/\.$/, "")})` : ""}`
    case "none":
      return why ?? "No es pot importar."
  }
}

/** Carpetes significatives del camí (sense el ZIP/carpeta de format ni el nom del fitxer). */
function foldersOf(path: string): string[] {
  const parts = path.split("/").filter(Boolean)
  parts.pop()
  // Treu el prefix del ZIP desplegat («STEP_Scharniere/…», «DWG_DXF_Scharniere/…») i carpetes del fitxer de l'article.
  while (parts.length && (FORMAT_DIRS.test(parts[0]!) || /^(STEP|DWG|DXF|3DS)_/i.test(parts[0]!) || /^dxf_einbau$/i.test(parts[0]!))) parts.shift()
  return parts.filter((p) => !/_KB_2d$/i.test(p))
}

/**
 * Agrupa fitxers per número d'article (de tots els ZIP i carpetes que s'hagin deixat anar alhora: STEP i DXF del mateix
 * article van junts). Els que no tenen número d'article es descarten. Ordenats per categoria i número.
 */
export function groupHettich(files: HettichFile[]): HettichArticle[] {
  const by = new Map<string, HettichArticle>()
  for (const f of files) {
    const art = hettichArticle(f.path)
    if (!art) continue
    const folders = foldersOf(f.path)
    let a = by.get(art)
    if (!a) {
      a = { article: art, folders, category: "misc", tags: [], label: "", group: "", kind: "none", plan: "", files: [] }
      by.set(art, a)
    }
    // La carpeta més llarga (més precisa) mana; els fitxers solts no en tenen.
    if (folders.length > a.folders.length) a.folders = folders
    a.files.push(f)
  }
  const out = [...by.values()].map((a) => {
    const c = classifyHettich(a.folders)
    const words = a.folders.filter((f) => !FAMILY_DIRS.test(f)).map(tr)
    const group = words.join(" · ") || "Fitxers solts"
    const hasStep = a.files.some((f) => f.kind === "step")
    let kind = c.kind
    let reason: string | undefined
    if (!hasStep) {
      kind = "none"
      reason = "Falta el STEP (els forats i el 3D surten del STEP; les vistes DXF només es dibuixen)."
    }
    // Al nom, les paraules de la carpeta que no diu ja el nom («Pota de taula», no «Pota de taula de taula»).
    const named = words.filter((w) => !/^sistema/.test(w) && w !== "accessori" && !c.noun.toLowerCase().includes(w.toLowerCase()))
    const label = `${c.noun}${named.length ? ` ${named.slice(0, 3).join(" ")}` : ""} ${a.article}`.replace(/\s+/g, " ").trim()
    const plan = importPlan(kind, reason ?? c.why)
    return { ...a, category: c.category, tags: c.tags, label, group, kind, plan, ...(reason ? { reason } : {}) }
  })
  const order = (k: HardwareCategory) => HARDWARE_CATEGORIES.findIndex((c) => c.id === k)
  return out.sort((a, b) => order(a.category) - order(b.category) || a.group.localeCompare(b.group) || a.article.localeCompare(b.article))
}

/** Vol dir que el fitxer pot ser d'una descàrrega de Hettich (per no llegir la resta d'una carpeta). */
export const hettichCandidate = (path: string): boolean => hettichArticle(path) !== null && hettichFileKind(path) !== "other"
