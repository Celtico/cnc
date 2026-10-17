import type { Machine } from "../../model/machine"

/** Codificació dels fitxers .xcs de la màquina (BOM o ASCII) i els seus textos. */

export const xcsEncodingOf = (m: Pick<Machine, "xcsEncoding">): NonNullable<Machine["xcsEncoding"]> => m.xcsEncoding ?? "utf8-bom"

/** Text de la codificació per al LLEGEIX-ME. */
export const encodingReadme = (m: Pick<Machine, "xcsEncoding">): string =>
  xcsEncodingOf(m) === "ascii" ? "- Fitxers .xcs sense BOM (ASCII, com els programes de TopSolid; un nom d'eina amb accents hi va en UTF-8)." : "- Fitxers .xcs en UTF-8 amb BOM."

/** Avís si els .xcs van sense BOM però algun porta caràcters que no són ASCII (noms d'eina): el Maestro els podria llegir malament. */
export function encodingWarning(m: Pick<Machine, "xcsEncoding">, files: readonly { name: string; text: string }[]): string | null {
  if (xcsEncodingOf(m) !== "ascii") return null
  // eslint-disable-next-line no-control-regex -- el rang ASCII sencer (des de \x00) és el que es comprova
  const odd = files.filter((f) => f.name.toLowerCase().endsWith(".xcs") && /[^\x00-\x7f]/.test(f.text)).map((f) => f.name)
  return odd.length ? `fitxers sense BOM amb caràcters que no són ASCII (noms d'eina?): ${odd.join(", ")}; van en UTF-8 i el Maestro els podria llegir malament` : null
}
