import { edgeLengthOf } from "../cutlist/toCutList"
import { flatten, type Panel } from "../model"
import type { PricesPref } from "../model/settingsSchema"
import type { KitOrderLine } from "../build/drawerKit"
import type { Nesting } from "../nesting/nest"
import { PdfPage, pdfBytes } from "./pdf"
import { fmtNum, roundTo } from "../../lib/format"

/**
 * Pressupost del projecte: les quantitats surten de les peces (m² de tauler per material i gruix, metres de cantell, de
 * perfilat i de ranura, forats, buidats) i dels ferratges de la comanda; els preus, de Preferències (`Settings.prices`,
 * els mateixos per a tots els projectes). Subtotal + marge = base; + IVA = total. Pur.
 */

/** Què cobra una fila: la clau diu quin preu de `PricesPref` fa servir. */
export type BudgetKey =
  | { kind: "material"; material: string; thickness: number }
  | { kind: "edge" | "profile" | "groove" | "hole" | "pocket" }
  | { kind: "hardware"; name: string }

interface BudgetRow {
  key: BudgetKey
  concept: string
  qty: number
  unit: "m²" | "m" | "u"
  price: number
  amount: number
}

interface Budget {
  rows: BudgetRow[]
  subtotal: number
  margin: number
  base: number
  vat: number
  total: number
}

const r2 = (v: number) => roundTo(v, 2)

/** El preu d'una fila a les preferències (0 si no n'hi ha). */
export function priceOf(prices: PricesPref, key: BudgetKey): number {
  if (key.kind === "material") return prices.materials.find((m) => m.material === key.material && m.thickness === key.thickness)?.price ?? 0
  if (key.kind === "hardware") return prices.hardware.find((h) => h.name === key.name)?.price ?? 0
  return prices[key.kind]
}

/** Les preferències amb el preu d'una fila canviat. */
export function withPrice(prices: PricesPref, key: BudgetKey, price: number): PricesPref {
  const p = Math.max(0, price || 0)
  if (key.kind === "material") {
    const rest = prices.materials.filter((m) => !(m.material === key.material && m.thickness === key.thickness))
    return { ...prices, materials: [...rest, { material: key.material, thickness: key.thickness, price: p }] }
  }
  if (key.kind === "hardware") return { ...prices, hardware: [...prices.hardware.filter((h) => h.name !== key.name), { name: key.name, price: p }] }
  return { ...prices, [key.kind]: p }
}

function perimeter(p: Panel): number {
  if (!p.outline) return 2 * (p.length + p.width)
  const pts = flatten(p.outline)
  return pts.reduce((a, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!
    return a + Math.hypot(nx - x, ny - y)
  }, 0)
}

/**
 * Les files del pressupost. `hardware`: totes les línies de comanda (calaixos, llums, ferratges col·locats i per metres);
 * les del mateix nom se sumen.
 */
export function toBudget(panels: Panel[], prices: PricesPref, opts: { nesting?: Nesting; hardware?: readonly KitOrderLine[] } = {}): Budget {
  const made = panels.filter((p) => p.role !== "hardware")
  const mats = new Map<string, { material: string; thickness: number; m2: number }>()
  let edge = 0, profile = 0, groove = 0, holes = 0, pockets = 0
  for (const p of made) {
    const k = `${p.material}|${p.thickness}`
    const m = mats.get(k) ?? { material: p.material, thickness: p.thickness, m2: 0 }
    m.m2 += (p.length * p.width) / 1e6
    mats.set(k, m)
    edge += edgeLengthOf(p.length, p.width, p.edges, p.outline)
    profile += perimeter(p)
    groove += p.grooves.reduce((a, g) => a + Math.max(g.w, g.h), 0)
    holes += p.holes.length
    pockets += (p.pockets?.length ?? 0) + (p.cutouts?.length ?? 0)
  }
  // Taulers sencers del nesting: els m² dels taulers que s'obren, per material i gruix.
  const sheets = new Map<string, { n: number; m2: number }>()
  if (prices.wholeSheets && opts.nesting) {
    for (const b of opts.nesting.boards) {
      const k = `${b.material}|${b.thickness}`
      const s = sheets.get(k) ?? { n: 0, m2: 0 }
      s.n += 1
      s.m2 += (b.w * b.h) / 1e6
      sheets.set(k, s)
    }
  }

  const rows: BudgetRow[] = []
  const push = (key: BudgetKey, concept: string, qty: number, unit: BudgetRow["unit"]) => {
    const price = priceOf(prices, key)
    rows.push({ key, concept, qty, unit, price, amount: r2(qty * price) })
  }
  for (const [k, m] of [...mats].sort((a, b) => b[1].m2 - a[1].m2)) {
    const name = `Tauler ${m.material} ${fmtNum(m.thickness)} mm`
    const s = sheets.get(k)
    if (s) push({ kind: "material", material: m.material, thickness: m.thickness }, `${name} (${s.n} ${s.n === 1 ? "tauler sencer" : "taulers sencers"})`, r2(s.m2), "m²")
    else push({ kind: "material", material: m.material, thickness: m.thickness }, `${name} (${fmtNum(m.m2, 2)} m² + ${fmtNum(prices.waste)}% de merma)`, r2(m.m2 * (1 + prices.waste / 100)), "m²")
  }
  if (profile > 0) push({ kind: "profile" }, "Perfilat (contorn de les peces a la CNC)", r2(profile / 1000), "m")
  if (edge > 0) push({ kind: "edge" }, "Cantejar", r2(edge / 1000), "m")
  if (groove > 0) push({ kind: "groove" }, "Ranures", r2(groove / 1000), "m")
  if (holes > 0) push({ kind: "hole" }, "Forats", holes, "u")
  if (pockets > 0) push({ kind: "pocket" }, "Buidats i talls", pockets, "u")
  const hw = new Map<string, number>()
  for (const l of opts.hardware ?? []) {
    const name = l.item ? `${l.name} · ${l.item}` : l.name
    hw.set(name, (hw.get(name) ?? 0) + l.qty)
  }
  for (const [name, qty] of [...hw].sort((a, b) => a[0].localeCompare(b[0], "ca"))) if (qty > 0) push({ kind: "hardware", name }, name, qty, "u")

  const subtotal = r2(rows.reduce((a, r) => a + r.amount, 0))
  const margin = r2((subtotal * prices.margin) / 100)
  const base = r2(subtotal + margin)
  const vat = r2((base * prices.vat) / 100)
  return { rows, subtotal, margin, base, vat, total: r2(base + vat) }
}

export const eur = (v: number): string => `${v.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** CSV (punt i coma, coma decimal, BOM per a l'Excel). */
export function budgetCsv(b: Budget, prices: PricesPref): string {
  const n = (v: number) => String(r2(v)).replace(".", ",")
  const q = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = ["Concepte;Quantitat;Unitat;Preu (€);Import (€)", ...b.rows.map((r) => [q(r.concept), n(r.qty), r.unit, n(r.price), n(r.amount)].join(";"))]
  lines.push("", `Subtotal;;;;${n(b.subtotal)}`, `Marge (${n(prices.margin)}%);;;;${n(b.margin)}`, `Base;;;;${n(b.base)}`, `IVA (${n(prices.vat)}%);;;;${n(b.vat)}`, `Total;;;;${n(b.total)}`)
  return "﻿" + lines.join("\r\n") + "\r\n"
}

/** PDF en A4 vertical: capçalera, taula i totals (es parteix en pàgines si cal). */
export function budgetPdf(b: Budget, prices: PricesPref, options: { project: string; date?: Date }): Uint8Array {
  const W = 210, H = 297, M = 15
  const date = (options.date ?? new Date()).toLocaleDateString("ca-ES")
  const cols = { concept: M, qty: 128, unit: 131, price: 162, amount: W - M }
  const pages: PdfPage[] = []
  let page = new PdfPage(W, H)
  let y = 0
  const header = (first: boolean) => {
    page = new PdfPage(W, H)
    pages.push(page)
    y = M + 6
    if (first) {
      page.text(M, y, "Pressupost", { size: 7, font: "bold" })
      page.text(M, y + 7, `${options.project} · ${date}`, { size: 3.6, maxW: W - 2 * M })
      y += 18
    }
    page.text(cols.concept, y, "Concepte", { size: 3, font: "bold" })
    page.text(cols.qty, y, "Quantitat", { size: 3, font: "bold", align: "right" })
    page.text(cols.unit, y, "Unitat", { size: 3, font: "bold" })
    page.text(cols.price, y, "Preu", { size: 3, font: "bold", align: "right" })
    page.text(cols.amount, y, "Import", { size: 3, font: "bold", align: "right" })
    page.line([[M, y + 1.8], [W - M, y + 1.8]], { width: 0.3 })
    y += 6.5
  }
  header(true)
  for (const r of b.rows) {
    if (y > H - M - 50) header(false)
    page.text(cols.concept, y, r.concept, { size: 3, maxW: cols.qty - cols.concept - 22 })
    page.text(cols.qty, y, fmtNum(r.qty), { size: 3, align: "right" })
    page.text(cols.unit, y, r.unit, { size: 3 })
    page.text(cols.price, y, r.price ? eur(r.price) : "—", { size: 3, align: "right" })
    page.text(cols.amount, y, eur(r.amount), { size: 3, align: "right" })
    page.line([[M, y + 1.6], [W - M, y + 1.6]], { width: 0.08 })
    y += 5.2
  }
  y += 4
  const total = (label: string, v: number, bold = false) => {
    page.text(cols.price, y, label, { size: bold ? 3.8 : 3.2, font: bold ? "bold" : "regular", align: "right" })
    page.text(cols.amount, y, eur(v), { size: bold ? 3.8 : 3.2, font: bold ? "bold" : "regular", align: "right" })
    y += bold ? 6.5 : 5.2
  }
  total("Subtotal", b.subtotal)
  if (prices.margin) total(`Marge (${fmtNum(prices.margin)}%)`, b.margin)
  total("Base imposable", b.base)
  total(`IVA (${fmtNum(prices.vat)}%)`, b.vat)
  page.line([[cols.price - 30, y - 4], [W - M, y - 4]], { width: 0.3 })
  total("Total", b.total, true)
  pages.forEach((p, i) => p.text(W - M, H - M + 4, `${i + 1}/${pages.length}`, { size: 2.6, align: "right" }))
  return pdfBytes(pages, `Pressupost · ${options.project}`)
}
