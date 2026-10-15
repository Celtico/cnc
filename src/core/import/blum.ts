import type { HardwareCategory, HardwareItem } from "../model/hardware"
import type { PartKind } from "../model/hardwareOps"

/**
 * Descàrregues de **Blum** (E-SERVICES › cerca de producte; `docs/ferratges-import.md` §10): per article, el 3D
 * (`.step`, `.dae`), un `.dxf` (un sòlid 3D ACIS: no es llegeix) i els «Esquemas de taladrado» (dades CAM per
 * producte: `*.pgm` Xilog de SCM, `*.mpr` woodWOP, `*.hop` Biesse, `*.fmc` IMA, `*.tcn` Felder). Noms
 * `<article>_<id de document de 8 xifres>[_R|_L].<ext>` (p. ex. `48N0510.02_41302774_R.pgm`, dins dels ZIP amb un espai
 * al davant); els ZIP es diuen com el producte, en castellà («Placa soporte TIP-ON para puertas, Versión corta…»).
 *
 * Aquí: reconèixer els fitxers, el nom del producte de la carpeta, i què és cada article (categoria, sèrie, nom en
 * català i **la peça on van els forats** del programa Xilog). Pur i sense dependències de temps d'execució del model.
 */

export const BLUM = "Blum"

interface BlumFileInfo {
  /** Número d'article de Blum (`71T453T`, `48N0510.02`, `ZSI.500BI1S`). */
  article: string
  /** Id del document (8 xifres). */
  doc: string
  /** Mà del programa: `R` dreta, `L` esquerra. */
  hand?: "R" | "L"
  ext: string
}

/**
 * El nom d'un fitxer de Blum, o `null`. L'article porta alguna lletra o un punt (els de Hettich són només xifres: un
 * `79349_79350123.dxf` de Hettich no és de Blum).
 */
export function blumFileInfo(path: string): BlumFileInfo | null {
  const name = path.split("/").pop()!.trim().replace(/ \(\d+\)(?=\.[^.]+$)/, "")
  const m = /^([A-Z0-9][A-Z0-9.]*[A-Z0-9])_(\d{8})(?:_([RL]))?\.([a-z0-9]+)$/i.exec(name)
  if (!m || !/[A-Z.]/i.test(m[1]!)) return null
  return { article: m[1]!.toUpperCase(), doc: m[2]!, ...(m[3] ? { hand: m[3].toUpperCase() as "R" | "L" } : {}), ext: m[4]!.toLowerCase() }
}

/** Paraules de producte de Blum (per reconèixer una carpeta o un ZIP de Blum i el nom del producte). */
const BLUM_WORDS = /\b(AVENTOS|CLIP\s*top|CLIP|MOVENTO|TANDEMBOX|TANDEM|LEGRABOX|METABOX|MERIVOBOX|ANTARO|TIP-ON|SERVO-DRIVE|BLUMOTION|SPACE\s*STEP|SPACE\s*TOWER|SPACE\s*CORNER|CABLOXX|REVEGO|EXPANDO|INSERTA|ORGA-LINE|AMBIA-LINE|ZOOM|PLICOBOX)\b/i

/**
 * La carpeta és (probablement) el nom d'un producte de Blum (el del ZIP de E-SERVICES). Una carpeta que només diu la
 * marca («blum», «Descàrregues de Blum») no ho és: el seu nom feia de producte i l'article sortia «Accessori».
 */
export function isBlumProductName(dir: string): boolean {
  const d = cleanProduct(dir).replace(/\bblum\b/gi, " ").replace(/\s+/g, " ").trim()
  return BLUM_WORDS.test(d) || (d.split(/\s+/).length >= 3 && /[a-záéíóú]/.test(d) && !/^(STEP|DWG|DXF|3DS|IGES)_/i.test(d))
}

/** «Placa soporte … (1)» → «Placa soporte …» (els ZIP repetits del navegador; `_` pels `/` del nom). */
const cleanProduct = (dir: string): string => dir.normalize("NFC").replace(/\.zip$/i, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim()

/** El nom del producte d'un camí (la carpeta més propera que en sembla un), o `undefined`. */
export function blumProduct(path: string): string | undefined {
  const dirs = path.split("/").slice(0, -1)
  for (let i = dirs.length - 1; i >= 0; i--) if (isBlumProductName(dirs[i]!)) return cleanProduct(dirs[i]!)
  return undefined
}

interface BlumClass {
  category: HardwareCategory
  /** Nom en català («Frontissa», «Placa», «Elevable», «Guia», «Accessori»). */
  noun: string
  /** Sèrie (subgrup de la biblioteca): «CLIP top», «AVENTOS HF», «LEGRABOX», «TIP-ON», «CABLOXX»… */
  series?: string
  /** On van els forats del programa Xilog; `any` = no se sap (l'usuari la tria a l'editor). */
  part: PartKind
  /** D'on surt (per a les notes): el nom del producte o el número d'article. */
  from: "product" | "article" | "none"
}

const has = (s: string, re: RegExp) => re.test(s)

/** La sèrie de la marca que diu el nom del producte («LEGRABOX», «AVENTOS HF top»…). */
function brandSeries(p: string): string | undefined {
  const av = /AVENTOS\s+(H[FSLK](?:-?(?:XS|S|i))?(?:[_/]H[FSLK])*(?:\s*top)?)/i.exec(p)
  if (av) return `AVENTOS ${av[1]!.replace(/\s*top$/i, " top").replace(/_/g, "/")}`
  if (/AVENTOS/i.test(p)) return "AVENTOS"
  for (const re of [/LEGRABOX/i, /MOVENTO/i, /TANDEMBOX/i, /METABOX/i, /MERIVOBOX/i, /ANTARO/i, /TANDEM/i, /SPACE\s*STEP/i, /SPACE\s*TOWER/i, /CABLOXX/i, /REVEGO/i, /TIP-ON/i, /SERVO-DRIVE/i, /EXPANDO/i, /INSERTA/i, /CLIP\s*top/i, /CLIP/i]) {
    const m = re.exec(p)
    if (m) return m[0].toUpperCase().replace(/\s+/g, " ").replace("CLIP TOP", "CLIP top")
  }
  return undefined
}

type Kind = Omit<BlumClass, "from">

const lift = (series: string, part: PartKind = "side"): Kind => ({ category: "lift", noun: "Elevable", series, part })

/**
 * **Prefixos dels articles de Blum** (quan no hi ha el nom del producte, o el producte no diu prou). La família AVENTOS
 * és «2» + generació + lletra: **K = HK**, **S = HS**, **F = HF**, **L = HL** (`22x` = la generació «top»). Les que diuen
 * «hipòtesi» no estan contrastades amb un nom de producte de les descàrregues (només coneixement de Blum):
 * - 20K1… AVENTOS HK-XS (20K1101, 20K1301, 20K1501; `T` = amb TIP-ON) — hipòtesi.
 * - 20K2… AVENTOS HK-S (20K2A00…20K2E00; 20K2C01T) — hipòtesi.
 * - 22K…/24K… AVENTOS HK top — hipòtesi (24K2300, 24K2300T).
 * - 22F… AVENTOS HF top (22F3900 «Compás abatible plegable AVENTOS HF top»); 20F/21F… AVENTOS HF (21F8020 «… AVENTOS HF,
 *   Tapa…», 21FA000 SERVO-DRIVE per a AVENTOS HF/HL/HS).
 * - 20S…/22S… AVENTOS HS (top) i 20L…/21L…/22L… AVENTOS HL (top) — hipòtesi (20S42E1).
 * - 7xT… frontisses CLIP top (71T453T); 17xL/175H plaques CLIP; 75x LEGRABOX (750.4501T, 753.5001T); 76x MOVENTO
 *   (760H3200S); 55x/56x TANDEM; 32x METABOX (320K5000C); 35x–37x… TANDEMBOX (378L, 378M) — hipòtesi per a TANDEMBOX;
 *   956 TIP-ON (956.1201); 800… REVEGO (800A0001) — hipòtesi per a la resta; Z… accessoris.
 */
const BLUM_PREFIXES: [RegExp, Kind][] = [
  [/^20K1/, lift("AVENTOS HK-XS")],
  [/^20K2/, lift("AVENTOS HK-S")],
  [/^2[24]K/, lift("AVENTOS HK top")],
  [/^2\dK/, lift("AVENTOS HK")],
  [/^22S/, lift("AVENTOS HS top")],
  [/^2\dS/, lift("AVENTOS HS")],
  [/^22F/, lift("AVENTOS HF top")],
  [/^2\dF/, lift("AVENTOS HF")],
  [/^22L/, lift("AVENTOS HL top")],
  [/^2\dL/, lift("AVENTOS HL")],
  [/^2\d[A-Z]/, lift("AVENTOS")],
  [/^7\d[A-Z]/, { category: "hinge", noun: "Frontissa", series: "CLIP top", part: "front" }],
  [/^1[37]\d[A-Z]/, { category: "plate", noun: "Placa", series: "CLIP", part: "side" }],
  [/^75\d/, { category: "slide", noun: "Guia", series: "LEGRABOX", part: "side" }],
  [/^76\d/, { category: "slide", noun: "Guia", series: "MOVENTO", part: "side" }],
  [/^5[5-6]\d/, { category: "slide", noun: "Guia", series: "TANDEM", part: "side" }],
  [/^3[2-4]\d[A-Z]/, { category: "slide", noun: "Guia", series: "METABOX", part: "side" }],
  [/^3[5-7]\d[A-Z]/, { category: "slide", noun: "Lateral de calaix", series: "TANDEMBOX", part: "side" }],
  [/^956/, { category: "push", noun: "Obertura", series: "TIP-ON", part: "side" }],
  [/^800[A-Z]/, { category: "misc", noun: "Accessori", series: "REVEGO", part: "any" }],
  [/^Z/, { category: "misc", noun: "Accessori", series: "Accessoris", part: "any" }],
]

/** Pel prefix de l'article (`BLUM_PREFIXES`), o `null`. */
function byArticle(article: string): Kind | null {
  const a = article.toUpperCase()
  for (const [re, k] of BLUM_PREFIXES) if (re.test(a)) return k
  return null
}

/**
 * Què és un article de Blum: primer pel **nom del producte** (castellà, anglès o alemany: «Placa soporte…» → placa al
 * lateral, «bisagra / CLIP top» → frontissa a la porta, «Guía / MOVENTO / TANDEM / LEGRABOX» → guia al lateral,
 * «AVENTOS» → elevable al lateral, o a la porta si és la fixació frontal), després pel prefix de l'article
 * (`BLUM_PREFIXES`). Si el producte només diu «AVENTOS» (sense HK/HS/HF/HL), la família surt de l'article; si el
 * producte no es reconeix, mana l'article. Si no se sap, `part: "any"`.
 */
export function classifyBlum(article: string, product?: string): BlumClass {
  const p = product ?? ""
  const series = brandSeries(p)
  const art = byArticle(article)
  if (p) {
    const front = has(p, /\b(frontal|fijaci[oó]n frontal|front fixing|Frontbeschlag|Frontmontage|para frentes?)\b/i)
    if (has(p, /AVENTOS|compás abatible|lift system|Klappen/i)) {
      const s = (!series || series === "AVENTOS") && art?.category === "lift" ? art.series! : (series ?? "AVENTOS")
      return { ...lift(s, front ? "front" : "side"), from: "product" }
    }
    if (has(p, /LEGRABOX|MOVENTO|TANDEMBOX|TANDEM|METABOX|MERIVOBOX|ANTARO|SPACE\s*STEP|\bgu[ií]a\b|runner|F[üu]hrung|Schubkasten|caj[oó]n|drawer/i))
      return { category: "slide", noun: has(p, /estabilizador/i) ? "Estabilitzador" : "Guia", ...(series ? { series } : {}), part: front ? "front" : "side", from: "product" }
    if (has(p, /\bplaca\b|mounting plate|Montageplatte|\bplate\b/i)) return { category: has(p, /TIP-ON/i) ? "push" : "plate", noun: "Placa", ...(series ? { series } : {}), part: "side", from: "product" }
    if (has(p, /TIP-ON|SERVO-DRIVE|push/i)) return { category: "push", noun: "Obertura", ...(series ? { series } : {}), part: "any", from: "product" }
    if (has(p, /bisagra|hinge|Scharnier|CLIP|INSERTA|EXPANDO/i)) return { category: "hinge", noun: "Frontissa", series: series ?? "CLIP", part: "front", from: "product" }
    if (series) return { category: "misc", noun: "Accessori", series, part: "any", from: "product" }
  }
  if (art) return { ...art, from: "article" }
  return { category: "misc", noun: "Ferratge", part: "any", from: "none" }
}

const HAND: Record<"R" | "L", string> = { R: "dreta", L: "esquerra" }

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** La sèrie no repeteix el nom («Accessori Accessoris», «Guia Guies»): es deixa fora del nom. */
const repeats = (noun: string, series: string) => fold(series).startsWith(fold(noun).slice(0, -1))

/** Nom proposat: «<nom> <sèrie> · <article>» (+ « · dreta» si el programa és d'una mà); mai «Accessori Accessoris». */
export function blumLabel(article: string, c: Pick<BlumClass, "noun" | "series">, hand?: "R" | "L"): string {
  const series = c.series && !repeats(c.noun, c.series) ? ` ${c.series}` : ""
  return `${c.noun}${series} · ${article}${hand ? ` · ${HAND[hand]}` : ""}`.replace(/\s+/g, " ").trim()
}

/** La sèrie d'un importat de Blum per agrupar la biblioteca (de la carpeta desada = el nom del producte). */
export function blumSeries(article: string, folders: readonly string[]): { id: string; label: string } | null {
  const s = classifyBlum(article, folders[0]).series
  return s ? { id: `blum:${s.toLowerCase()}`, label: s } : null
}

/** Els noms que posa (o ha posat) l'app als articles de Blum. */
const AUTO_NOUNS = ["Frontissa", "Placa", "Elevable", "Guia", "Estabilitzador", "Lateral de calaix", "Obertura", "Accessori", "Ferratge"]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Lectura de les preferències: un article de Blum que encara porta el nom automàtic («<nom> [<sèrie>] · <article>
 * [· dreta][ 2]») passa al d'ara (`classifyBlum` + `blumLabel`: «Accessori Accessoris · 20K1101T» → «Elevable AVENTOS
 * HK-XS · 20K1101T»), i si era a «Altres» i ara se sap què és, a la seva categoria. La carpeta desada que no és un
 * producte («blum») es treu. Un nom que l'usuari ha canviat es queda. Idempotent; torna el mateix item si no canvia.
 */
export function migrateBlumItem(it: HardwareItem): HardwareItem {
  const imp = it.imported
  if (!imp || imp.damaged || imp.maker !== BLUM || !imp.article) return it
  const folders = imp.folders.filter(isBlumProductName)
  const c = classifyBlum(imp.article, folders[0])
  const nouns = AUTO_NOUNS.map(escapeRe).join("|")
  const m = new RegExp(`^(?:${nouns})(?: .+?)? · ${escapeRe(imp.article)}( · (?:dreta|esquerra))?( \\d+)?$`).exec(it.name)
  const name = m ? `${blumLabel(imp.article, c)}${m[1] ?? ""}${m[2] ?? ""}` : it.name
  const category = m && it.category === "misc" && c.category !== "misc" ? c.category : it.category
  const sameFolders = folders.length === imp.folders.length
  if (name === it.name && category === it.category && sameFolders) return it
  return { ...it, name, category, ...(sameFolders ? {} : { imported: { ...imp, folders } }) }
}
