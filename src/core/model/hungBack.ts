import type { Carcass } from "./moduleSchema"

/**
 * **Fons dels mòduls penjats** (per decisió de l'usuari, 2026-10-15: «fem-ho tot el més estàndard possible»): el penjador
 * ocult estàndard (Libra H2 / Häfele 290.41.910) i la regleta van **darrere del fons**, que va en ranura **retirat 20 mm**
 * del darrere (espai de servei: Libra 15 com a mínim, Häfele 16–20). És el que fan per defecte els mòduls penjats nous
 * (`defaultModule`, plantilles, catàleg, col·leccions, mòduls de Preferències) i el que passa en penjar-ne un
 * (`setModuleMount`). Els mobles desats no es toquen (el fons és el que tenien; si no hi cap, l'avís `hanging`).
 */
const HUNG_BACK_SETBACK = 20

/** La caixa d'un mòdul penjat amb el fons estàndard: en ranura (o encastat) retirat `HUNG_BACK_SETBACK`; la resta, igual. */
export function hungBack(c: Carcass): Carcass {
  if (c.base.kind !== "wall") return c
  if (c.back === "screwed") return { ...c, back: "groove", backSetback: HUNG_BACK_SETBACK }
  if (c.back === "groove" && c.backSetback < HUNG_BACK_SETBACK) return { ...c, backSetback: HUNG_BACK_SETBACK }
  if (c.back === "inset" && (c.backInsetSetback ?? 0) < HUNG_BACK_SETBACK) return { ...c, backInsetSetback: HUNG_BACK_SETBACK }
  return c
}
