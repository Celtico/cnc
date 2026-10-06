import { partKindOf } from "../model/hardwareOps"
import { MODEL_3D_KINDS } from "./formats"
import { BLUM, blumFileInfo, blumLabel, blumProduct, classifyBlum, isBlumProductName } from "./blum"
import { groupHettich, hettichCandidate, hettichFileKind, type HettichArticle, type HettichFile, type HettichFileKind } from "./hettich"

/**
 * **Un sol camí d'importar, segons el fabricant** (Preferències › Ferratges › «Importar del fabricant»): els fitxers
 * triats (solts, carpetes o ZIP) es reparteixen per fabricant pel nom (`detectMaker`) i cadascun els agrupa per article
 * a la seva manera (Hettich: `groupHettich`; Blum: `groupBlum`). Surt la mateixa llista d'articles (`HettichArticle` amb
 * `maker`) i la resta (proposta, 3D, mecanitzats, ampliar el que ja hi és amb `merge.ts`) és comuna. Pur.
 */

export type Maker = "Hettich" | "Blum"

/** De quin fabricant és un fitxer: Blum pel nom (`<article>_<8 xifres>[_R|_L].<ext>`) o per la carpeta d'un producte de Blum. */
export function detectMaker(path: string): Maker {
  if (blumFileInfo(path)) return BLUM
  const dirs = path.split("/").slice(0, -1)
  if (dirs.some((d) => /\bblum\b/i.test(d)) && /\.(pgm|mpr|dae|glb|gltf|step|stp)$/i.test(path)) return BLUM
  if (dirs.some(isBlumProductName) && !/^\d{4,9}(?=[._ -]|$)/.test(path.split("/").pop()!)) return BLUM
  return "Hettich"
}

/** Tipus de fitxer (el de Hettich per a tots; un DXF de Blum és un sòlid 3D ACIS: `dxf3d`). */
export function importFileKind(path: string): HettichFileKind {
  const k = hettichFileKind(path)
  if (detectMaker(path) === BLUM && (k === "ref" || k === "other" || k === "front" || k === "side" || k === "top") && /\.dxf$/i.test(path)) return "dxf3d"
  if (detectMaker(path) === BLUM && k === "ref") return "pdf"
  return k
}

/** El fitxer pot ser d'una descàrrega d'un fabricant (per no llegir la resta d'una carpeta). */
export function importCandidate(path: string): boolean {
  const b = blumFileInfo(path)
  if (b) return importFileKind(path) !== "other"
  return hettichCandidate(path)
}

/** Les fonts d'un article («STEP · PGM · DAE»), per al diàleg. */
export const FILE_SOURCE: Partial<Record<HettichFileKind, string>> = {
  step: "STEP",
  iges: "IGES",
  "3ds": "3DS",
  dae: "DAE",
  glb: "GLB",
  pgm: "PGM (Xilog)",
  mpr: "MPR",
  cam: "CAM",
  front: "DXF",
  side: "DXF",
  top: "DXF",
  dxf3d: "DXF 3D",
  dwg: "DWG",
  sat: "SAT",
  max: "MAX",
  pdf: "PDF",
  ref: "PDF / plànol",
}

/** L'ordre de les fonts al diàleg (el que es fa servir primer). */
const FILE_ORDER = Object.keys(FILE_SOURCE)

/** Té 3D (algun format que es llegeix). */
export const has3d = (files: readonly { kind: HettichFileKind }[]) => files.some((f) => (MODEL_3D_KINDS as readonly string[]).includes(f.kind))

/**
 * Agrupa els fitxers de Blum per article: el número sense l'id del document ni la mà (`_R`/`_L`); el nom del producte
 * surt de la carpeta (el ZIP). **Una mà = un article**: els programes `_R` i `_L` del **mateix** article van al mateix
 * item (el primer, dreta si n'hi ha; l'altre es diu a les notes); dues mans amb articles diferents (`48N0510.02_…_R` i
 * `48N0510.03_…_L`) són dos items, cadascun amb la seva mà al nom.
 */
export function groupBlum(files: HettichFile[]): HettichArticle[] {
  const by = new Map<string, HettichArticle>()
  for (const f of files) {
    const info = blumFileInfo(f.path)
    if (!info) continue
    // El mateix fitxer dues vegades (els ZIP i fitxers repetits del navegador, « (1)»): un de sol.
    const key = (p: string) => p.split("/").pop()!.trim().replace(/ \(\d+\)(?=\.[^.]+$)/, "").toLowerCase()
    if (by.get(info.article)?.files.some((x) => key(x.path) === key(f.path))) continue
    let a = by.get(info.article)
    if (!a) by.set(info.article, (a = { maker: BLUM, article: info.article, folders: [], category: "misc", tags: [], label: "", group: "", kind: "none", files: [] }))
    const product = blumProduct(f.path)
    // El producte més llarg (el ZIP d'un joc diu més que el d'un article sol).
    if (product && (!a.product || product.length > a.product.length)) a.product = product
    if (info.hand && (!a.hand || info.hand === "R")) a.hand = info.hand
    a.files.push(f)
  }
  return [...by.values()].map((a): HettichArticle => {
    a.files.sort((x, y) => FILE_ORDER.indexOf(x.kind) - FILE_ORDER.indexOf(y.kind))
    const c = classifyBlum(a.article, a.product)
    const pgm = a.files.some((f) => f.kind === "pgm")
    const model = has3d(a.files)
    const where = c.part === "any" ? "peça per triar" : partKindOf(c.part).label.toLowerCase()
    let kind: HettichArticle["kind"] = "model"
    let plan: string
    let reason: string | undefined
    if (pgm) plan = `Mecanitzats exactes (Xilog) · ${where}${model ? "" : " · sense 3D"}`
    else if (model) plan = "Només 3D: sense forats (per als forats, baixa l'«Esquema de taladrado» en Xilog *.pgm)"
    else {
      kind = "none"
      reason = a.files.some((f) => f.kind === "mpr" || f.kind === "cam")
        ? "Només dades CAM d'un altre format: l'app llegeix el Xilog (*.pgm)."
        : "Sense STEP, DAE ni programa Xilog (*.pgm): el DXF de Blum és un sòlid 3D (ACIS) que no es llegeix."
      plan = reason
    }
    const { hand: _h, ...rest } = a
    return {
      ...rest,
      ...(a.hand && pgm ? { hand: a.hand } : {}),
      folders: a.product ? [a.product] : [],
      category: c.category,
      label: blumLabel(a.article, c, pgm ? a.hand : undefined),
      group: [a.product ?? "Fitxers solts", c.series].filter(Boolean).join(" · "),
      kind,
      plan,
      part: c.part,
      ...(reason ? { reason } : {}),
    }
  }).sort((a, b) => a.article.localeCompare(b.article))
}

export interface GroupedImport {
  articles: HettichArticle[]
  /** Fitxers que no s'adjunten a cap article (manuals, «Overview»…): es diuen al diàleg «sense article». */
  loose: string[]
}

/**
 * Tots els fabricants alhora: els de Blum (`groupBlum`) i la resta com a Hettich (`groupHettich`, amb `known` = els
 * articles de Hettich de la biblioteca, perquè un ZIP només de plànols els ampliï).
 */
export function groupImport(files: HettichFile[], known?: ReadonlyMap<string, readonly string[]>): GroupedImport {
  const blum = files.filter((f) => detectMaker(f.path) === BLUM && blumFileInfo(f.path))
  const rest = files.filter((f) => !blum.includes(f))
  const loose: string[] = []
  const hettich = groupHettich(rest, known, loose)
  return { articles: [...hettich, ...groupBlum(blum)], loose }
}

/** El fabricant d'un article (`Hettich` si no ho diu). */
export const makerOf = (a: Pick<HettichArticle, "maker">): string => a.maker ?? "Hettich"
