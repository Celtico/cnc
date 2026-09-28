/**
 * Quan un text tallat amb punts suspensius (etiquetes de camp o qualsevol element amb
 * `data-truncate`) es passa amb el ratolí, se li posa el text sencer com a `title`.
 * Un sol listener per a tota l'app: no cal recordar-ho a cada component.
 */
const SELECTOR = "[data-scope=field][data-part=label], [data-truncate]"

export function initTruncatedTitles(): void {
  document.addEventListener(
    "pointerover",
    (e) => {
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null
      if (!el) return
      if (el.scrollWidth > el.clientWidth + 1) {
        if (!el.title) {
          el.title = el.textContent?.trim() ?? ""
          el.dataset.autoTitle = "1"
        }
      } else if (el.dataset.autoTitle) {
        el.removeAttribute("title")
        delete el.dataset.autoTitle
      }
    },
    { passive: true },
  )
}
