const KEY = "mobles:chunk-reload"

/**
 * Després de publicar una versió nova, una pestanya oberta demana trossos de l'app (`import()`) que ja no hi són: Vite
 * avisa (`vite:preloadError`) i es recarrega la pàgina un cop, per agafar la versió nova. Abans es desa el pendent. Si
 * torna a passar al cap de poc (el servidor no té el tros), no es recarrega més: l'error arriba a la pantalla.
 */
export function reloadOnStaleChunks(): void {
  window.addEventListener("vite:preloadError", (ev) => {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0)
    } catch {
      // sense sessionStorage, com si no s'hagués recarregat mai
    }
    if (Date.now() - last < 30_000) return
    ev.preventDefault()
    try {
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch {
      // igualment es recarrega
    }
    window.dispatchEvent(new Event("mobles:flush-save"))
    // Que la desada (IndexedDB) surti abans de recarregar.
    setTimeout(() => window.location.reload(), 300)
  })
}
