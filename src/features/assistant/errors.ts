/**
 * Errors de l'assistent en català (pur, sense el SDK: es fa servir abans de carregar-lo i als tests). El SDK
 * (`@anthropic-ai/sdk`) llança subclasses d'`APIError` amb `status` (401, 403, 404, 429, 5xx) o sense (`APIConnectionError`,
 * `APIUserAbortError`); es distingeixen pel `status` i pel nom de la classe, no amb `instanceof` (el SDK es carrega a
 * demanda). **Mai es mostra ni es registra la clau.**
 */
export type AssistantErrorKind = "no-key" | "offline" | "auth" | "permission" | "not-found" | "rate" | "overloaded" | "bad-request" | "aborted" | "other"

export interface AssistantError {
  kind: AssistantErrorKind
  title: string
  description: string
}

/** Sense clau: on posar-la. */
export const NO_KEY_ERROR: AssistantError = {
  kind: "no-key",
  title: "Falta la clau de l'API",
  description: "Posa la teva clau de l'API de Claude a Preferències › Assistent IA.",
}

export const OFFLINE_ERROR: AssistantError = {
  kind: "offline",
  title: "Sense connexió",
  description: "L'assistent necessita internet (crida l'API de Claude). La resta de l'app funciona igual sense connexió.",
}

/** Les classes d'error del SDK carregat (el codi minificat no conserva els noms de les classes). */
export interface SdkErrorClasses {
  APIUserAbortError: abstract new (...args: never[]) => unknown
  APIConnectionError: abstract new (...args: never[]) => unknown
}

/** Text d'un error del SDK (o de qualsevol cosa llançada). `online`: `navigator.onLine`. */
export function assistantError(e: unknown, online = true, sdk?: SdkErrorClasses): AssistantError {
  if (!online) return OFFLINE_ERROR
  const err = (e ?? {}) as { status?: unknown; name?: unknown; constructor?: { name?: unknown }; message?: unknown; error?: { error?: { type?: unknown; message?: unknown } } }
  const status = typeof err.status === "number" ? err.status : undefined
  const name =
    sdk && e instanceof sdk.APIUserAbortError
      ? "APIUserAbortError"
      : sdk && e instanceof sdk.APIConnectionError
        ? "APIConnectionError"
        : typeof err.name === "string" && err.name !== "Error"
          ? err.name
          : String(err.constructor?.name ?? "")
  const apiType = typeof err.error?.error?.type === "string" ? err.error.error.type : undefined
  const apiMessage = typeof err.error?.error?.message === "string" ? err.error.error.message : undefined
  if (name === "APIUserAbortError" || name === "AbortError") return { kind: "aborted", title: "Aturat", description: "Has aturat la resposta." }
  if (name === "APIConnectionError" || name === "APIConnectionTimeoutError" || (status === undefined && /fetch|network|connection/i.test(String(err.message ?? ""))))
    return { kind: "offline", title: "No s'ha pogut connectar", description: "No s'arriba a l'API de Claude: comprova la connexió i torna-ho a provar." }
  if (status === 401) return { kind: "auth", title: "Clau no vàlida", description: "L'API no accepta la clau. Comprova-la (o fes-ne una de nova) a Preferències › Assistent IA." }
  if (status === 403) return { kind: "permission", title: "Sense permís", description: "La clau no té permís per a aquest model o aquesta operació. Mira la Claude Console." }
  if (status === 404) return { kind: "not-found", title: "Model no disponible", description: "La clau no té accés al model triat. Prova l'altre model a Preferències › Assistent IA." }
  if (status === 429) return { kind: "rate", title: "Massa peticions", description: "S'ha arribat al límit de la clau (o no hi ha saldo). Espera una mica o mira la Claude Console." }
  if (status === 529 || apiType === "overloaded_error") return { kind: "overloaded", title: "API saturada", description: "L'API de Claude va molt carregada ara mateix. Torna-ho a provar d'aquí a una estona." }
  if (status === 400) return { kind: "bad-request", title: "Petició rebutjada", description: apiMessage ?? "L'API no ha acceptat la petició." }
  if (status !== undefined && status >= 500) return { kind: "other", title: "Error de l'API", description: `L'API de Claude ha fallat (${status}). Torna-ho a provar.` }
  return { kind: "other", title: "Error de l'assistent", description: apiMessage ?? (typeof err.message === "string" && err.message ? err.message : "Error desconegut.") }
}

/** Els 4 últims caràcters de la clau («•••• abcd»): l'únic que se'n mostra. */
export function maskKey(key: string | undefined): string {
  const k = (key ?? "").trim()
  return k ? `•••• ${k.slice(-4)}` : ""
}
