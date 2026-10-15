/**
 * Les dreceres de teclat d'una pàgina (editor de mobles, ambients) i les finestres i diàlegs de sobre.
 * Les finestres flotants (`FloatingWindow`) no són modals: amb una oberta, les dreceres de la pàgina funcionen quan el
 * focus és a la pàgina, i no quan és a dins de la finestra. Els diàlegs modals (les confirmacions) les aturen totes.
 */

/** Un diàleg modal obert (una confirmació, «Esborrar?»). Les finestres flotants no ho són. */
export const MODAL_OPEN = '[role="dialog"][aria-modal="true"][data-state="open"], [role="alertdialog"][aria-modal="true"][data-state="open"]'

/** La tecla és d'una finestra, d'un diàleg o d'un popover (el focus hi és a dins): la pàgina de sota no hi fa res. */
export function keyInDialog(target: EventTarget | null): boolean {
  return !!(target as Element | null)?.closest?.('[role="dialog"], [role="alertdialog"]')
}

/** Hi ha un diàleg modal obert: la pàgina de sota no rep cap tecla. */
export function modalOpen(): boolean {
  return !!document.querySelector(MODAL_OPEN)
}
