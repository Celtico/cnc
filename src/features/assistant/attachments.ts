/**
 * **Què es pot adjuntar al xat** (per decisió de l'usuari, 2026-10-14: «que els documents es puguin pujar fent drag and
 * drop»): fotos i plànols (imatge, reduïda abans d'enviar), PDF (bloc `document` de l'API) i fitxers de text (el text va
 * dins del missatge). La resta no.
 */
export type AttachKind = "image" | "pdf" | "text"

/** Límit de l'API per als PDF (32 MB la petició sencera): una mica per sota. */
export const MAX_PDF_BYTES = 30 * 1024 * 1024
/** Caràcters màxims d'un fitxer de text (la resta es talla i s'avisa). */
export const MAX_TEXT_CHARS = 200_000

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|xcs|pgmx|html?|ya?ml|log|ini|cfg)$/i

/** El tipus d'un fitxer per al xat, o `null` si no s'hi pot adjuntar. */
export function attachKind(file: { name: string; type: string }): AttachKind | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf"
  if (file.type.startsWith("text/") || file.type === "application/json" || file.type === "application/xml" || TEXT_EXT.test(file.name)) return "text"
  return null
}

/** El que accepta el selector de fitxers del xat. */
export const ATTACH_ACCEPT = "image/*,application/pdf,.pdf,text/*,.txt,.md,.csv,.tsv,.json,.xml,.xcs,.pgmx,.html,.yaml,.yml,.log"

/** El text d'un fitxer com va al missatge, amb el nom i tallat si és massa llarg. */
export function textAttachment(name: string, text: string): string {
  const cut = text.length > MAX_TEXT_CHARS
  return `Fitxer adjunt «${name}»${cut ? ` (tallat als primers ${MAX_TEXT_CHARS} caràcters)` : ""}:\n\n${cut ? text.slice(0, MAX_TEXT_CHARS) : text}`
}
