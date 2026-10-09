/**
 * Obre Preferències en un apartat (p. ex. des del xat de l'Editor, «Posa la clau a Preferències › Assistent IA»): l'apartat
 * va a la mateixa clau de sessió que fa servir la pàgina (`useSessionString`) i l'App hi va amb `mobles:open-settings`.
 */
export const SETTINGS_SECTION_KEY = "mobles:settings-section"

export function openSettings(section: string): void {
  try {
    sessionStorage.setItem(SETTINGS_SECTION_KEY, section)
  } catch {
    /* sense sessionStorage */
  }
  window.dispatchEvent(new CustomEvent("mobles:session-string", { detail: { key: SETTINGS_SECTION_KEY, value: section } }))
  window.dispatchEvent(new Event("mobles:open-settings"))
}
