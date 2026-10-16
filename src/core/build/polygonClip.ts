import * as pcNs from "polygon-clipping"

/** `polygon-clipping`: el paquet només té export per defecte (el .d.ts declara els noms); acceptem les dues formes. */
export const pc = ((pcNs as unknown as { default?: typeof pcNs }).default ?? pcNs) as typeof pcNs
