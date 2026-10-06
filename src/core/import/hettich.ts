import type { HardwareCategory } from "../model"

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

/** Què es pot fer amb l'article a l'app. */
export type ImportKind = "hinge" | "plate" | "none"

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
  reason?: string
}

/** Carpetes → categoria de l'app, etiquetes i si es pot importar. */
export function classifyHettich(folders: string[]): Classified {
  const has = (re: RegExp) => folders.some((f) => re.test(f))
  const tags: string[] = []
  if (has(/Glas/i)) tags.push("vidre")
  if (has(/Alurahmen/i)) tags.push("alumini")
  if (has(/einliegend/i)) tags.push("encastat")
  else if (has(/Mittelseiten|halb_vorliegend/i)) tags.push("mig recobrent")
  else if (has(/aufliegend|vorliegend/i)) tags.push("recobrent")
  if (has(/^Montageplatten$/i)) return { category: "plate", tags, kind: "plate", noun: "Placa de muntatge" }
  if (has(/^(Zubehoer|Atira_Zubehoer)$/i)) return { category: "misc", tags, kind: "none", noun: "Accessori", reason: "Accessori: no fa forats segons cap regla del moble." }
  if (has(/Scharniertoepfe/i)) return { category: "misc", tags, kind: "none", noun: "Cassoleta solta", reason: "Peça d'una frontissa: importa la frontissa sencera." }
  if (has(/Schubkasten|Auszug|Auszuege|Laufschiene|Wirebaskets|Innenorganisation|Tech$/i))
    return { category: "slide", tags, kind: "none", noun: "Calaix o guia", reason: "Guies i calaixos encara no: cal la regla dels forats de la guia (pendent)." }
  if (has(/Push_to_open/i)) return { category: "push", tags, kind: "none", noun: "Push", reason: "Obertura per pressió: encara no fa forats." }
  if (has(/Klappen|Lift/i)) return { category: "lift", tags, kind: "none", noun: "Elevable", reason: "Elevables i abatibles encara no." }
  if (has(/Moebelbaender/i)) return { category: "misc", tags, kind: "none", noun: "Frontissa de pala", reason: "No és de cassoleta." }
  if (has(/Scharnier|Sensys|Intermat|Novisys|Veosys|Onsys|Avosys|Perfekt/i)) {
    const noun = tags.includes("vidre") ? "Frontissa de vidre" : tags.includes("alumini") ? "Frontissa per a marc d'alumini" : "Frontissa"
    return { category: "hinge", tags, kind: "hinge", noun }
  }
  return { category: "misc", tags, kind: "none", noun: "Ferratge", reason: "Carpeta desconeguda." }
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
      a = { article: art, folders, category: "misc", tags: [], label: "", group: "", kind: "none", files: [] }
      by.set(art, a)
    }
    // La carpeta més llarga (més precisa) mana; els fitxers solts no en tenen.
    if (folders.length > a.folders.length) a.folders = folders
    a.files.push(f)
  }
  const out = [...by.values()].map((a) => {
    const c = classifyHettich(a.folders)
    const words = a.folders.filter((f) => !/^(Scharniere|Montageplatten|Schubkastensysteme)$/i.test(f)).map(tr)
    const group = words.join(" · ") || "Fitxers solts"
    const hasStep = a.files.some((f) => f.kind === "step")
    let kind = c.kind
    let reason = c.reason
    if (kind !== "none" && !hasStep) {
      kind = "none"
      reason = "Falta el STEP (els forats i el 3D surten del STEP; les vistes DXF només es dibuixen)."
    }
    const label = `${c.noun}${words.length ? ` ${words.filter((w) => !/^sistema/.test(w)).slice(0, 3).join(" ")}` : ""} ${a.article}`.replace(/\s+/g, " ").trim()
    return { ...a, category: c.category, tags: c.tags, label, group, kind, ...(reason ? { reason } : {}) }
  })
  const order = (k: HardwareCategory) => ["hinge", "plate", "slide", "lift", "push", "misc"].indexOf(k)
  return out.sort((a, b) => order(a.category) - order(b.category) || a.group.localeCompare(b.group) || a.article.localeCompare(b.article))
}

/** Vol dir que el fitxer pot ser d'una descàrrega de Hettich (per no llegir la resta d'una carpeta). */
export const hettichCandidate = (path: string): boolean => hettichArticle(path) !== null && hettichFileKind(path) !== "other"
