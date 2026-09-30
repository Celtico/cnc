/**
 * Límits per a dispositius tàctils (iPhone, iPad): Safari hi dona poca memòria a cada pàgina i, si
 * se supera, iOS la tanca i la torna a carregar (sembla que l'app «peta i es recupera»). El 3D és el
 * que més en gasta: textures, mapa d'ombres, resolució i els processos del render.
 */
export const LOW_MEMORY = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches

/** Textures generades que es guarden en memòria (per tipus). */
export const TEXTURE_CACHE_MAX = LOW_MEMORY ? 12 : 48
