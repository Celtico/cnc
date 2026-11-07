import { fmtNum } from "../../lib/format"

/**
 * Tarifes de preus dels proveïdors (PDF): de les línies de text del PDF (`PdfLine`, les fa `features/export/pdfText.ts`
 * amb pdf.js) a les files referència · descripció · preu · unitat, amb el capítol i el títol de producte de cadascuna.
 * Cerca a totes les tarifes alhora i preu net amb el descompte del proveïdor. Pur.
 */

/** Una línia del PDF: les cel·les (trossos de text separats per un buit gran) i on comença cadascuna (x, en punts). */
export interface PdfLine {
  page: number
  /** Alçada de la lletra més gran de la línia (punts). */
  h: number
  cells: string[]
  xs: number[]
}

/** Un marcador de l'índex del PDF: on comença un capítol. */
export interface PdfOutlineItem {
  title: string
  page: number
}

export interface PriceRow {
  ref: string
  desc: string
  /** Preu de tarifa (sense descompte), en €. */
  price: number
  /** Unitat de la capçalera de la columna del preu («m2», «ml», «u»…) o "" si no se sap. */
  unit: string
  page: number
  /** Índex a `PriceList.chapters`. */
  chap: number
  /** Índex a `PriceList.titles` (0 = sense títol). */
  title: number
}

export interface ParsedPriceList {
  rows: PriceRow[]
  chapters: string[]
  titles: string[]
}

/** Una tarifa desada (`db/priceLists.ts`). */
export interface PriceList extends ParsedPriceList {
  id: string
  supplier: string
  file: string
  /** Descompte del proveïdor, en %. */
  discount: number
  createdAt: number
}

/** Text sense accents i en minúscules, per comparar. */
const normText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Un número de tarifa («1.234,56», «1 234,56», «12.50») → 1234.56. */
export function toNum(s: string): number {
  let t = s.replace(/\s/g, "")
  if (/,\d{2,3}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".")
  else t = t.replace(/,/g, "")
  const v = parseFloat(t)
  return Number.isFinite(v) ? v : NaN
}

/** Una cel·la que només és un preu: «12,50», «1.234,00 €», «€ 3,20», «4,10 €/ml». */
const PURE = /^\s*(?:€\s*)?((?:\d{1,3}(?:[.\s]\d{3})+|\d+)[,.]\d{2})\s*(?:€|eur|euros)?\s*(?:\/\s*\w+)?\s*$/i
const HEADER = /preu|precio|pvp|€|tires|uds|unitats|refer|codi|c[oó]digo|secci|mides|medidas|gruix|espesor|format|llarg|ample/i
const JUNK = /^(p[aà]g|page|tarifa|iva|www\.|tel|aquesta|esta|\*)/i
const letters = (t: string) => t.replace(/[^A-Za-zÀ-ÿ]/g, "")

/**
 * Les files amb preu. Capítols: els marcadors del PDF o, si no en té, l'índex (línies «Nom ....... pàg. 12»); si tampoc,
 * els títols en majúscules o de lletra gran. Títol de producte: la línia de lletra més gran de les que no tenen preu
 * just abans de les files. Columnes: les capçaleres (línies sense preu) donen nom a cada columna per la seva posició; el
 * primer preu de la línia és el principal (la seva unitat surt de la capçalera: «preu €/ml» → ml) i els altres preus i
 * columnes van a la descripció.
 */
export function parsePriceList(lines: readonly PdfLine[], outline: readonly PdfOutlineItem[] = []): ParsedPriceList {
  const rows: PriceRow[] = []
  const chapters: string[] = []
  const titles: string[] = [""]
  const indexOf = (list: string[], t: string) => {
    const i = list.indexOf(t)
    return i >= 0 ? i : list.push(t) - 1
  }
  const hs = lines.map((l) => l.h).filter((h) => h > 0).sort((a, b) => a - b)
  const hMed = hs.length ? hs[Math.floor(hs.length / 2)]! : 0

  let ol = [...outline].sort((a, b) => a.page - b.page)
  if (!ol.length) {
    // Índex escrit: «Frontisses ........ pàg. 12» (almenys 4 línies que apuntin més endavant).
    const ix: (PdfOutlineItem & { src: number })[] = []
    for (const l of lines) {
      const m = l.cells.join(" ").trim().match(/^(.{3,80}?)[\s.…·_-]*p[àa]g(?:ina)?\.?\s*(\d{1,4})\s*$/i)
      if (m) ix.push({ title: m[1]!.replace(/[.…·_\s-]+$/, "").trim(), page: +m[2]!, src: l.page })
    }
    if (ix.length >= 4) ol = ix.filter((o) => o.page > o.src).sort((a, b) => a.page - b.page)
  }

  let chap = ""
  let block: { t: string; h: number }[] = []
  let header: { t: string; x: number; w: number }[] = []
  let lastPrice = false
  let justChap = false
  const reset = () => {
    block = []
    header = []
  }
  const colLabel = (x: number | undefined) =>
    x === undefined
      ? ""
      : header
          .filter((c) => Math.abs(c.x - x) < Math.max(30, c.w * 0.6) || (x >= c.x - 4 && x <= c.x + c.w + 4))
          .map((c) => c.t)
          .join(" ")
          .trim()

  for (const l of lines) {
    const { cells, xs } = l
    const t = cells.join(" ").replace(/\s+/g, " ").trim()
    const pc = cells.flatMap((c, i) => (PURE.test(c) ? [i] : []))
    const hasPrice = pc.length > 0
    const junk = JUNK.test(t) || /^\d+$/.test(t) || t.length < 3 || /^\d{1,2} \w+ 20\d\d$/.test(t)
    let isChap = false
    if (ol.length) {
      const o = ol.filter((x) => x.page <= l.page).pop()
      const next = o?.title ?? ""
      if (next !== chap) {
        chap = next
        reset()
      }
    } else {
      const lt = letters(t)
      if (!hasPrice && !junk && t.length <= 70 && lt.length >= 3 && cells.length <= 2 && !justChap && (lt === lt.toUpperCase() || (hMed > 0 && l.h > hMed * 1.6))) {
        chap = t
        reset()
        isChap = justChap = true
      }
    }
    if (!hasPrice) {
      if (isChap || junk) continue
      if (lastPrice) {
        reset()
        lastPrice = false
      }
      block.push({ t, h: l.h })
      if (HEADER.test(t)) cells.forEach((c, i) => header.push({ t: c, x: xs[i] ?? i * 60, w: c.length * 4 }))
      continue
    }
    lastPrice = true
    justChap = false

    const big = block.filter((b) => !/preu|precio|pvp|€/i.test(b.t) && letters(b.t).length >= 3)
    let title = ""
    if (big.length) {
      const mh = Math.max(...big.map((b) => b.h))
      title = big
        .filter((b) => b.h >= mh - 0.3)
        .map((b) => b.t)
        .slice(-2)
        .join(" · ")
        .replace(/\s*\b\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+20\d\d\b/g, "")
        .trim()
    }
    const main = pc[0]!
    const price = toNum(cells[main]!.match(PURE)![1]!)
    const lab = colLabel(xs[main])
    const um = `${lab} ${cells[main]}`.match(/€\s*\/\s*(m2|m²|ml|m|u|ud|uds|kg|l|caixa|pq|paquet)\b/i) ?? lab.match(/\b(m2|m²|ml|tauler|tira|full|placa|caixa|unitat|ud)\b/i)

    // Referència: la primera cel·la si és un codi curt amb xifres; si no, la primera paraula que sembli un codi.
    let ref = ""
    let ri = -1
    if (cells.length > 1 && main !== 0 && /\d/.test(cells[0]!) && cells[0]!.length <= 28) {
      ref = cells[0]!
      ri = 0
    } else {
      search: for (let i = 0; i < cells.length; i++) {
        if (pc.includes(i)) continue
        for (const w of cells[i]!.split(/\s+/))
          if (/\d/.test(w) && /^[A-Z0-9][A-Z0-9./_-]{3,}$/i.test(w) && !/^\d{1,3}$/.test(w)) {
            ref = w
            break search
          }
      }
    }
    const parts: string[] = []
    cells.forEach((c, i) => {
      if (i === main || i === ri || /^[-–—]+$/.test(c.trim())) return
      let v = c
      if (ri < 0 && ref && v.includes(ref)) v = v.split(ref).join(" ").trim()
      if (!v) return
      const lb = colLabel(xs[i])
      if (pc.includes(i)) parts.push(`${(lb || "preu").replace(/^preu\s*/i, "") || "preu"}: ${v.replace(/\s*€\s*$/, "")} €`)
      else parts.push(lb && !/refer|codi|secci/i.test(lb) && v.length <= 12 ? `${lb} ${v}` : v)
    })
    const desc = parts.join(" · ").replace(/\s+/g, " ").trim()
    if (!desc && !ref && !title) continue
    rows.push({
      ref,
      desc: desc.slice(0, 160),
      price,
      unit: um ? um[1]!.toLowerCase().replace("m²", "m2") : "",
      page: l.page,
      chap: indexOf(chapters, chap || "Sense capítol"),
      title: indexOf(titles, title.slice(0, 140)),
    })
  }
  return { rows, chapters, titles }
}

/** El nom del proveïdor que suggereix el nom del fitxer («Tarifa_Häfele_2026.pdf» → «Häfele»). */
export function supplierFromFile(file: string, known: readonly string[] = []): string {
  const s = file
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(tarifa|tarifas|precios|preus|pvp|20\d\d)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
  return known.find((k) => k && normText(s).includes(normText(k))) ?? s
}

export const netPrice = (row: Pick<PriceRow, "price">, list: Pick<PriceList, "discount">): number => row.price * (1 - (list.discount || 0) / 100)

interface PriceHit {
  list: PriceList
  row: PriceRow
  score: number
}

/**
 * Cerca a totes les tarifes: cada paraula de la consulta (de 2 lletres o més) que surt a la referència, el títol o la
 * descripció suma; cal que en surtin almenys el 60 %. Primer les més semblants (la referència exacta, al capdavant) i,
 * després, les més barates (preu net). Com a molt `limit`.
 */
export function searchPriceLists(lists: readonly PriceList[], query: string, limit = 200): PriceHit[] {
  const words = normText(query).split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const need = Math.min(words.length, Math.max(1, Math.ceil(words.length * 0.6)))
  const exact = normText(query.trim())
  const out: PriceHit[] = []
  for (const list of lists)
    for (const row of list.rows) {
      const hay = normText(`${row.ref} ${list.titles[row.title] ?? ""} ${row.desc}`)
      let score = 0
      for (const w of words) if (hay.includes(w)) score++
      if (score >= need) out.push({ list, row, score: score + (normText(row.ref) === exact ? 5 : 0) })
    }
  return out.sort((a, b) => b.score - a.score || netPrice(a.row, a.list) - netPrice(b.row, b.list)).slice(0, limit)
}

/** Mida d'un tauler escrita a la descripció («2800x2070», «2.440 × 1.220 mm») → m², o null. */
export function boardAreaOf(text: string): number | null {
  const m = text.match(/(\d{1,2}[.]?\d{3})\s*[x×*]\s*(\d{1,2}[.]?\d{3})/i)
  if (!m) return null
  const a = +m[1]!.replace(".", "")
  const b = +m[2]!.replace(".", "")
  return a >= 300 && b >= 300 ? (a * b) / 1e6 : null
}

/** Un tros de text d'una pàgina del PDF (de pdf.js): posició de la línia base i amplada, en punts. */
interface PdfTextItem {
  s: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Els trossos de text d'una pàgina → línies: els que són a la mateixa alçada fan una línia, d'esquerra a dreta, i un buit
 * gran entre dos trossos separa cel·les (un de petit hi posa un espai).
 */
export function itemsToLines(page: number, items: readonly PdfTextItem[]): PdfLine[] {
  const it = items.filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: { y: number; it: PdfTextItem[] }[] = []
  for (const i of it) {
    const r = rows.find((r) => Math.abs(r.y - i.y) < Math.max(2, i.h * 0.45))
    if (r) r.it.push(i)
    else rows.push({ y: i.y, it: [i] })
  }
  return rows.map((r) => {
    r.it.sort((a, b) => a.x - b.x)
    const cells: string[] = []
    const xs: number[] = []
    let last: PdfTextItem | null = null
    for (const i of r.it) {
      const gap = last ? i.x - (last.x + last.w) : Infinity
      if (last && gap < Math.max(3, i.h * 0.6)) cells[cells.length - 1] += (gap > i.h * 0.15 ? " " : "") + i.s
      else {
        cells.push(i.s)
        xs.push(i.x)
      }
      last = i
    }
    const keep = cells.map((c, i) => [c.trim(), xs[i]!] as const).filter(([c]) => c)
    return { page, h: Math.max(...r.it.map((i) => i.h)), cells: keep.map(([c]) => c), xs: keep.map(([, x]) => Math.round(x)) }
  })
}

/**
 * El preu que posa una fila de tarifa a una fila del pressupost: el net (amb el descompte). Per a una fila en m² (tauler)
 * si la tarifa no ve en m², el preu és per tauler: es divideix pels m² del tauler (els de la descripció o, si no n'hi ha,
 * `boardArea`). `note` explica d'on surt.
 */
export function budgetPriceFrom(hit: Pick<PriceHit, "list" | "row">, target: { unit: "m²" | "m" | "u"; boardArea?: number | null }): { price: number; note: string } {
  const net = netPrice(hit.row, hit.list)
  const r2 = (v: number) => Math.round(v * 100) / 100
  const e = (v: number) => `${fmtNum(r2(v), 2)} €`
  const disc = hit.list.discount ? ` (−${fmtNum(hit.list.discount)}%)` : ""
  if (target.unit === "m²" && hit.row.unit !== "m2") {
    const area = boardAreaOf(`${hit.list.titles[hit.row.title] ?? ""} ${hit.row.desc}`) ?? target.boardArea ?? null
    if (area) return { price: r2(net / area), note: `${hit.list.supplier}: ${e(net)}/tauler${disc} ÷ ${fmtNum(r2(area), 2)} m²` }
  }
  return { price: r2(net), note: `${hit.list.supplier}: ${e(net)}${hit.row.unit ? `/${hit.row.unit}` : ""}${disc}` }
}
