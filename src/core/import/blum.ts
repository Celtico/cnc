import type { HardwareCategory } from "../model/hardware"
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

export interface BlumFileInfo {
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
const BLUM_WORDS = /\b(blum|AVENTOS|CLIP\s*top|CLIP|MOVENTO|TANDEMBOX|TANDEM|LEGRABOX|METABOX|MERIVOBOX|ANTARO|TIP-ON|SERVO-DRIVE|BLUMOTION|SPACE\s*STEP|SPACE\s*TOWER|SPACE\s*CORNER|CABLOXX|REVEGO|EXPANDO|INSERTA|ORGA-LINE|AMBIA-LINE|ZOOM|PLICOBOX)\b/i

/** La carpeta és (probablement) el nom d'un producte de Blum (el del ZIP de E-SERVICES). */
export function isBlumProductName(dir: string): boolean {
  const d = cleanProduct(dir)
  return BLUM_WORDS.test(d) || (d.split(/\s+/).length >= 3 && /[a-záéíóú]/.test(d) && !/^(STEP|DWG|DXF|3DS|IGES)_/i.test(d))
}

/** «Placa soporte … (1)» → «Placa soporte …» (els ZIP repetits del navegador; `_` pels `/` del nom). */
export const cleanProduct = (dir: string): string => dir.normalize("NFC").replace(/\.zip$/i, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim()

/** El nom del producte d'un camí (la carpeta més propera que en sembla un), o `undefined`. */
export function blumProduct(path: string): string | undefined {
  const dirs = path.split("/").slice(0, -1)
  for (let i = dirs.length - 1; i >= 0; i--) if (isBlumProductName(dirs[i]!)) return cleanProduct(dirs[i]!)
  return undefined
}

export interface BlumClass {
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
  const av = /AVENTOS\s+(H[FSLK](?:-?(?:XS|S|i))?(?:\s*top)?)/i.exec(p)
  if (av) return `AVENTOS ${av[1]!.replace(/\s*top$/i, " top").replace(/_/g, "/")}`
  if (/AVENTOS/i.test(p)) return "AVENTOS"
  for (const re of [/LEGRABOX/i, /MOVENTO/i, /TANDEMBOX/i, /METABOX/i, /MERIVOBOX/i, /ANTARO/i, /TANDEM/i, /SPACE\s*STEP/i, /SPACE\s*TOWER/i, /CABLOXX/i, /REVEGO/i, /TIP-ON/i, /SERVO-DRIVE/i, /EXPANDO/i, /INSERTA/i, /CLIP\s*top/i, /CLIP/i]) {
    const m = re.exec(p)
    if (m) return m[0].toUpperCase().replace(/\s+/g, " ").replace("CLIP TOP", "CLIP top")
  }
  return undefined
}

/**
 * Què és un article de Blum: primer pel **nom del producte** (castellà, anglès o alemany: «Placa soporte…» → placa al
 * lateral, «bisagra / CLIP top» → frontissa a la porta, «Guía / MOVENTO / TANDEM / LEGRABOX» → guia al lateral,
 * «AVENTOS» → elevable al lateral, o a la porta si és la fixació frontal), després pel prefix de l'article (71T/72T/75T/
 * 79T frontisses CLIP top → porta; 173L/174L/175L plaques → lateral; 20K/20S/21F/22F/24K AVENTOS → lateral;
 * 550/560/750/760 guies → lateral; 956 TIP-ON → lateral; Z… accessoris). Si no se sap, `part: "any"`.
 */
export function classifyBlum(article: string, product?: string): BlumClass {
  const p = product ?? ""
  const series = brandSeries(p)
  if (p) {
    const front = has(p, /\b(frontal|fijaci[oó]n frontal|front fixing|Frontbeschlag|Frontmontage|para frentes?)\b/i)
    if (has(p, /AVENTOS|compás abatible|lift system|Klappen/i)) return { category: "lift", noun: "Elevable", series: series ?? "AVENTOS", part: front ? "front" : "side", from: "product" }
    if (has(p, /LEGRABOX|MOVENTO|TANDEMBOX|TANDEM|METABOX|MERIVOBOX|ANTARO|SPACE\s*STEP|\bgu[ií]a\b|runner|F[üu]hrung|Schubkasten|caj[oó]n|drawer/i))
      return { category: "slide", noun: has(p, /estabilizador/i) ? "Estabilitzador" : "Guia", ...(series ? { series } : {}), part: front ? "front" : "side", from: "product" }
    if (has(p, /\bplaca\b|mounting plate|Montageplatte|\bplate\b/i)) return { category: has(p, /TIP-ON/i) ? "push" : "plate", noun: "Placa", ...(series ? { series } : {}), part: "side", from: "product" }
    if (has(p, /TIP-ON|SERVO-DRIVE|push/i)) return { category: "push", noun: "Obertura", ...(series ? { series } : {}), part: "any", from: "product" }
    if (has(p, /bisagra|hinge|Scharnier|CLIP|INSERTA|EXPANDO/i)) return { category: "hinge", noun: "Frontissa", series: series ?? "CLIP", part: "front", from: "product" }
    return { category: "misc", noun: "Accessori", series: series ?? "Accessoris", part: "any", from: "product" }
  }
  const a = article.toUpperCase()
  if (/^7\d[A-Z]/.test(a)) return { category: "hinge", noun: "Frontissa", series: "CLIP top", part: "front", from: "article" }
  if (/^1[37]\d[A-Z]/.test(a)) return { category: "plate", noun: "Placa", series: "CLIP", part: "side", from: "article" }
  if (/^2[0-4][A-Z]/.test(a)) return { category: "lift", noun: "Elevable", series: "AVENTOS", part: "side", from: "article" }
  if (/^(5[5-6]\d|7[5-6]\d)/.test(a)) return { category: "slide", noun: "Guia", part: "side", from: "article" }
  if (/^3[2-7]\d[A-Z]/.test(a)) return { category: "slide", noun: "Guia", series: "TANDEMBOX / METABOX", part: "side", from: "article" }
  if (/^956/.test(a)) return { category: "push", noun: "Obertura", series: "TIP-ON", part: "side", from: "article" }
  if (/^Z/.test(a)) return { category: "misc", noun: "Accessori", series: "Accessoris", part: "any", from: "article" }
  return { category: "misc", noun: "Ferratge", part: "any", from: "none" }
}

const HAND: Record<"R" | "L", string> = { R: "dreta", L: "esquerra" }

/** Nom proposat: «<nom> <sèrie> · <article>» (+ « · dreta» si el programa és d'una mà). */
export function blumLabel(article: string, c: BlumClass, hand?: "R" | "L"): string {
  return `${c.noun}${c.series ? ` ${c.series}` : ""} · ${article}${hand ? ` · ${HAND[hand]}` : ""}`.replace(/\s+/g, " ").trim()
}

/** La sèrie d'un importat de Blum per agrupar la biblioteca (de la carpeta desada = el nom del producte). */
export function blumSeries(article: string, folders: readonly string[]): { id: string; label: string } | null {
  const s = classifyBlum(article, folders[0]).series
  return s ? { id: `blum:${s.toLowerCase()}`, label: s } : null
}
