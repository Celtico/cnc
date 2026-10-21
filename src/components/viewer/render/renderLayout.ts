/**
 * El panell del Render (`RenderFrame`) és un contenidor (`render`): la imatge i les opcions es posen de costat quan el
 * panell és prou ample, no segons la mida de la finestra (a l'ordinador el panell pot ser estret).
 */
export const WIDE = "@container render (min-width: 720px)"
/** El contrari de `WIDE`: la imatge i les opcions, una sota l'altra. */
export const NARROW = "@container render (max-width: 719.98px)"
