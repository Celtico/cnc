import type { CutList } from "../cutlist/toCutList"
import type { Grain } from "../model"

const GRAIN_LABEL: Record<Grain, string> = {
  x: "Llarg",
  y: "Ample",
  none: "Indiferent",
}

export interface CsvOptions {
  /** Separador de camps. Excel en català espera ";". */
  separator?: string
  /** Separador decimal. Excel en català espera ",". */
  decimal?: string
}

function cell(value: string | number, o: Required<CsvOptions>): string {
  if (typeof value === "number") {
    return String(value).replace(".", o.decimal)
  }
  const needsQuotes = value.includes(o.separator) || value.includes('"') || value.includes("\n")
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

/** CSV de la llista de peces, una fila per grup de peces idèntiques. */
export function cutListToCsv(list: CutList, options: CsvOptions = {}): string {
  const o: Required<CsvOptions> = {
    separator: options.separator ?? ";",
    decimal: options.decimal ?? ",",
  }
  const header = [
    "Peça",
    "Quantitat",
    "Llarg (mm)",
    "Ample (mm)",
    "Gruix (mm)",
    "Material",
    "Veta",
    "Cantells",
    "Cantell (m)",
    "Forats",
    "Superfície (m²)",
  ]
  const rows = list.items.map((it) => [
    it.label,
    it.qty,
    it.length,
    it.width,
    it.thickness,
    it.material,
    GRAIN_LABEL[it.grain],
    it.edgeNumbers.join("+") || "-",
    it.edgeLength,
    it.holes,
    it.area,
  ])
  const lines = [header, ...rows].map((r) => r.map((v) => cell(v, o)).join(o.separator))
  // BOM perquè Excel/Numbers reconeguin l'UTF-8 dels accents.
  return "﻿" + lines.join("\r\n") + "\r\n"
}
