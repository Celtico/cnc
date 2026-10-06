import { HARDWARE_CATEGORIES, type HardwareCategory } from "../model"
import { classifyHettich, cleanFolders, FAMILY_DIRS, hettichLabel, tr, type ImportKind } from "./hettichNames"
import { importFormatOf } from "./formats"

export { classifyHettich, cleanFolders, hettichLabel, hettichSeries, itemSeries, migrateImportedNames, type Classified, type ImportKind } from "./hettichNames"

/**
 * Descàrregues CAD de Hettich (`hettich.com › Hettich CAD › Descàrregues CAD`): un ZIP per família i format
 * (`STEP_Scharniere.zip`, `DWG_DXF_Scharniere.zip`, `3DS_…`, `dxf_einbau.zip`…) amb carpetes per tipus en alemany i un
 * fitxer (o tres vistes 2D) per **número d'article**. Aquí s'agrupen els fitxers per article i es tradueixen les carpetes a
 * les categories de l'app. Pur (els fitxers ja llegits els passa `features/settings`). Detall a `docs/ferratges-import.md`.
 */

/**
 * `ref`: plànol de muntatge o exemple d'aplicació (`dxf_einbau`, `Anschlagloesungen_…`, carpetes `…_KB_2d`, PDF): no és
 * d'un sol article; s'adjunta com a referència als articles que nomena (`refArticles`).
 */
export type HettichFileKind =
  | "step"
  | "front"
  | "side"
  | "top"
  | "dxf3d"
  | "dwg"
  | "3ds"
  | "pdf"
  | "ref"
  | "other"
  /** IGES (`IGES_*.zip` de Hettich): el 3D amb OpenCascade si no hi ha STEP (sense forats). */
  | "iges"
  /** Collada (`.dae`, Blum): el 3D si no hi ha STEP ni IGES. */
  | "dae"
  /** glTF (`.glb`, o `.gltf` sense fitxers a part): el 3D si no hi ha STEP, IGES, 3DS ni Collada. */
  | "glb"
  /** Programa Xilog de SCM (`.pgm`, «Esquemas de taladrado» de Blum): mecanitzats exactes. */
  | "pgm"
  /** woodWOP (`.mpr`): no es llegeix (encara). */
  | "mpr"
  /** Altres dades CAM de Blum (`.fmc` IMA, `.hop` Biesse, `.tcn` Felder): no es llegeixen. */
  | "cam"
  /** ACIS (`.sat`) i 3ds Max (`.max`): no es llegeixen. */
  | "sat"
  | "max"

export interface HettichFile {
  path: string
  kind: HettichFileKind
  size?: number
}

export interface HettichArticle {
  /** Fabricant (`Hettich` si no ho diu; `Blum`, `blum.ts`). Amb l'article, la clau de la biblioteca. */
  maker?: string
  article: string
  /** Blum: el nom del producte (el del ZIP de E-SERVICES, en castellà). */
  product?: string
  /** Blum: la mà del programa Xilog (`_R`/`_L`). */
  hand?: "R" | "L"
  /** Blum: la peça on van els forats del programa Xilog (`any` = l'usuari la tria a l'editor). */
  part?: import("../model/hardwareOps").PartKind
  /** Carpetes (sense la de l'usuari, el ZIP ni la carpeta de format), p. ex. `["Scharniere", "Sensys", "Oeffnungswinkel_110", "aufliegend"]`. */
  folders: string[]
  category: HardwareCategory
  tags: string[]
  /** Nom proposat en català («Frontissa Sensys 110° · 9071205»). */
  label: string
  /** Descripció curta de la carpeta, traduïda. */
  group: string
  kind: ImportKind
  /** Per què no es pot importar (si `kind` és `none`). */
  reason?: string
  /** Què se'n farà en una línia («Tirador · distància del STEP», «Només 3D: sense forats»…; `none`: el motiu). */
  plan?: string
  files: HettichFile[]
  /** Sense STEP, amb les vistes DXF: entra «només 3D» sense el 3D (el 3D i els forats arriben quan s'hi afegeix el STEP). */
  only2d?: boolean
  /** Només hi ha plànols de muntatge d'un article que ja és a la biblioteca (`known`): s'hi afegeixen. */
  refsOnly?: boolean
}

const isRefPath = (path: string) => /(^|\/)(dxf_einbau|Anschlagloesungen[^/]*|Anwendungsbeispiele[^/]*|Korpusbibliothek)(\/|$)|_KB_2d(\/|$)/i.test(path)

/** Tipus de fitxer pel camí (les vistes 2D: `<art>_2D_front_view.dxf`, majúscules o minúscules). */
export function hettichFileKind(path: string): HettichFileKind {
  const name = path.split("/").pop()!.toLowerCase()
  // Pel format (la mateixa taula que l'`accept` del selector, `formats.ts`); els DXF i els PDF, també pel nom.
  const kind = importFormatOf(name)?.kind
  if (!kind || kind === "zip") return "other"
  if (kind === "pdf") return isRefPath(path) || !hettichArticle(path) ? "ref" : "pdf"
  if (kind !== "dxf") return kind
  if (isRefPath(path) || !hettichArticle(path)) return "ref"
  if (/_2d_front_view\.dxf$/.test(name)) return "front"
  if (/_2d_side_view\.dxf$/.test(name)) return "side"
  if (/_2d_top_view\.dxf$/.test(name)) return "top"
  if (/_3d\.dxf$/.test(name)) return "dxf3d"
  return "other"
}

/** Número d'article del nom del fitxer (`9071205.stp`, `9071205_2D_front_view.DXF`, `45064_2d_top_view.dxf`). */
export function hettichArticle(path: string): string | null {
  const name = path.split("/").pop()!
  const m = /^(\d{4,9})(?=[._ -]|$)/.exec(name)
  return m ? m[1]! : null
}

/**
 * Els números d'article que nomena un plànol de muntatge (al nom o a les carpetes: `79349_KB_2d/105_Sensys_8639i_B-4_D0_
 * 79349_79350_9072231.dxf` → 79349, 79350, 9072231). Només s'adjunta als articles que hi ha al lot o a la biblioteca.
 */
export function refArticles(path: string): string[] {
  const out = new Set<string>()
  for (const m of path.matchAll(/(?:^|[/_ .-])(\d{4,9})(?=[/_ .-]|$)/g)) out.add(m[1]!)
  return [...out]
}

/** Les vistes 2D del DXF d'un article. */
export const VIEW_KINDS: readonly HettichFileKind[] = ["front", "side", "top"]
export const isRefKind = (k: HettichFileKind) => k === "ref" || k === "pdf"

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

/** Carpetes significatives d'un camí (sense el nom del fitxer, `cleanFolders`). */
function foldersOf(path: string): string[] {
  const parts = path.split("/").filter(Boolean)
  parts.pop()
  return cleanFolders(parts)
}

/**
 * Agrupa fitxers per número d'article (de tots els ZIP i carpetes que s'hagin deixat anar alhora: STEP i DXF del mateix
 * article van junts). Els plànols de muntatge (`ref`) s'afegeixen als articles que nomenen, si són al lot o a la
 * biblioteca (`known`: número → carpetes de l'item; així un ZIP de plànols sol amplia els que ja tens). Ordenats per
 * categoria i número.
 */
export function groupHettich(files: HettichFile[], known?: ReadonlyMap<string, readonly string[]>, unattached?: string[]): HettichArticle[] {
  const by = new Map<string, HettichArticle>()
  const empty = (article: string, folders: string[]): HettichArticle => ({ article, folders, category: "misc", tags: [], label: "", group: "", kind: "none", plan: "", files: [] })
  const refs: HettichFile[] = []
  for (const f of files) {
    if (isRefKind(f.kind)) {
      refs.push(f)
      continue
    }
    const art = hettichArticle(f.path)
    if (!art) continue
    const folders = foldersOf(f.path)
    let a = by.get(art)
    if (!a) {
      a = empty(art, folders)
      by.set(art, a)
    }
    // La carpeta més llarga (més precisa) mana; els fitxers solts no en tenen.
    if (folders.length > a.folders.length) a.folders = folders
    a.files.push(f)
  }
  const refsOnly = new Set<string>()
  for (const f of refs) {
    let hit = false
    for (const art of new Set([...(hettichArticle(f.path) ? [hettichArticle(f.path)!] : []), ...refArticles(f.path)])) {
      let a = by.get(art)
      if (!a && known?.has(art)) {
        a = empty(art, [...known.get(art)!])
        by.set(art, a)
        refsOnly.add(art)
      }
      if (a && !a.files.some((x) => x.path === f.path)) a.files.push(f)
      if (a) hit = true
    }
    // Sense cap número: un PDF que nomena una sèrie (`Planungshilfen_Sensys…`, `2D_Konfiguration_Sensys.pdf`) s'adjunta
    // als articles del lot d'aquella sèrie, si no són massa (un manual no es copia a centenars d'articles).
    if (!hit && /\.pdf$/i.test(f.path)) {
      const matches = seriesMatches(f.path, [...by.values()].filter((a) => !refsOnly.has(a.article)))
      if (matches.length && matches.length <= MAX_SERIES_DOCS) {
        for (const a of matches) a.files.push(f)
        hit = true
      }
    }
    if (!hit) unattached?.push(f.path)
  }
  const out = [...by.values()].map((a): HettichArticle => {
    const c = classifyHettich(a.folders)
    const words = a.folders.filter((f) => !FAMILY_DIRS.test(f)).map(tr)
    const group = words.join(" · ") || "Fitxers solts"
    const hasStep = a.files.some((f) => f.kind === "step")
    const hasViews = a.files.some((f) => VIEW_KINDS.includes(f.kind))
    // Un altre 3D (IGES, 3DS): el model sense la proposta de forats (la fa el STEP).
    const other3d = a.files.find((f) => f.kind === "iges" || f.kind === "3ds")
    let kind = c.kind
    let reason: string | undefined
    let plan: string
    let only2d = false
    if (refsOnly.has(a.article)) plan = "Plànols de muntatge"
    else if (!hasStep && other3d) {
      kind = "model"
      plan = `Només 3D (${other3d.kind === "iges" ? "IGES" : "3DS"}): sense forats${c.kind === "model" ? "" : " (els forats proposats surten del STEP)"}`
    } else if (!hasStep && hasViews) {
      // Només les vistes DXF: entra sense el 3D (ni els forats) fins que s'hi afegeixi el STEP.
      kind = "model"
      only2d = true
      plan = `Només 2D: vistes del DXF i punts de connexió (el 3D${c.kind === "model" ? "" : " i els forats"} arribaran amb el STEP)`
    } else if (!hasStep) {
      kind = "none"
      reason = "Sense STEP, IGES, 3DS ni vistes DXF (el 3D DWG/DXF, el SAT i el MAX no es llegeixen)."
      plan = reason
    } else plan = importPlan(kind, c.why)
    const label = hettichLabel(a.folders, a.article, c.noun)
    return { ...a, category: c.category, tags: c.tags, label, group, kind, plan, ...(reason ? { reason } : {}), ...(only2d ? { only2d } : {}), ...(refsOnly.has(a.article) ? { refsOnly: true } : {}) }
  })
  const order = (k: HardwareCategory) => HARDWARE_CATEGORIES.findIndex((c) => c.id === k)
  return out.sort((a, b) => order(a.category) - order(b.category) || a.group.localeCompare(b.group) || a.article.localeCompare(b.article))
}

/** Com a molt a quants articles s'adjunta un PDF d'una sèrie (`groupHettich`). */
export const MAX_SERIES_DOCS = 12

/** Els articles d'una sèrie que nomena un camí (`Planungshilfen_Sensys/…pdf` → els de Sensys). */
function seriesMatches(path: string, articles: HettichArticle[]): HettichArticle[] {
  const words = new Set(path.toLowerCase().split(/[^a-z0-9äöü]+/).filter((w) => w.length >= 4))
  return articles.filter((a) => {
    const dir = a.folders.find((f) => !FAMILY_DIRS.test(f))
    const id = dir?.toLowerCase().split(/[^a-z0-9äöü]+/)[0]
    return !!id && id.length >= 4 && words.has(id)
  })
}

/** Vol dir que el fitxer pot ser d'una descàrrega de Hettich (per no llegir la resta d'una carpeta). */
export const hettichCandidate = (path: string): boolean => {
  const k = hettichFileKind(path)
  // Amb número d'article: també els DXF del taller per peça (`<art>_porta.dxf`, capes de mecanitzat; tipus `other`).
  if (hettichArticle(path) !== null) return k !== "other" || /\.dxf$/i.test(path)
  // Els PDF sense número (manuals, «Overview», «Planungshilfen»…): s'adjunten per sèrie o es diuen «sense article».
  return isRefKind(k) && (refArticles(path).length > 0 || /\.pdf$/i.test(path))
}
