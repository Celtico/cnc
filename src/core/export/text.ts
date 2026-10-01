/**
 * Text dels fitxers per al taller. Els parsers del taller parteixen per `;` sense mirar
 * cometes (CSV i STEP) i prenen per fila de tauler qualsevol `Nombre_pieza` amb `:`.
 */

/** Treu els diacrítics (NFD): «Façana» → «Facana». La resta de no-ASCII queda igual. */
export function asciiFold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ßæœÆŒøØłŁđĐ]/g, (c) => FOLD[c] ?? c)
}

const FOLD: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", Æ: "AE", Œ: "OE", ø: "o", Ø: "O", ł: "l", Ł: "L", đ: "d", Đ: "D" }

/** Camp del CSV de TopSolid: sense `;` (→ `,`), sense `:` (→ `-`) i sense salts de línia. */
export function csvField(s: string): string {
  return s
    .replace(/[\r\n]+/g, " ")
    .replace(/;/g, ",")
    .replace(/:/g, "-")
    .trim()
}

/** Nom de peça amb el vocabulari del taller: ASCII sense accents, igual al CSV i al STEP. */
export function workshopName(s: string): string {
  return csvField(asciiFold(s))
}
