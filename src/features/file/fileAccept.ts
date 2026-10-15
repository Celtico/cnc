/** iPhone/iPad (inclosos els iPad que es presenten com a Mac). */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

/**
 * Valor de l'`accept` d'un `<input type="file">`. L'iOS no coneix extensions pròpies
 * com `.moble` (no tenen tipus registrat) i deixa aquests fitxers en gris, sense poder-los
 * triar: allà no es filtra i ja valida el lector en obrir-lo.
 */
export function fileAccept(accept: string): string | undefined {
  return isIOS() ? undefined : accept
}
