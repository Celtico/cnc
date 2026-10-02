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

function quote(value: string, o: Required<CsvOptions>): string {
  const needsQuotes = value.includes(o.separator) || value.includes('"') || value.includes("\n") || value.includes("\r")
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

function cell(value: string | number, o: Required<CsvOptions>): string {
  // Un número amb la coma decimal igual que el separador (p. ex. «,» i «,») va entre cometes.
  return quote(typeof value === "number" ? String(value).replace(".", o.decimal) : value, o)
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
    "Processos",
  ]
  const rows = list.items.map((it) => [
    it.label,
    it.qty,
    it.length,
    it.width,
    it.thickness,
    it.material,
    GRAIN_LABEL[it.grain],
    [it.edgeNumbers.join("+"), it.mitreNumbers.map((n) => `${n}(45°)`).join("+")].filter(Boolean).join(" ") || "-",
    it.edgeLength,
    it.holes,
    it.area,
    it.processes || "-",
  ])
  const lines = [header, ...rows].map((r) => r.map((v) => cell(v, o)).join(o.separator))
  // BOM perquè Excel/Numbers reconeguin l'UTF-8 dels accents.
  return "﻿" + lines.join("\r\n") + "\r\n"
}
