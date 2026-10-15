/**
 * L'adreça d'una imatge que pot ser un fitxer de l'app (camí a `public/`, p. ex. `appliances/….webp`) o una data URL (una
 * foto que ha pujat l'usuari): els de l'app van des de l'arrel de l'app (`BASE_URL`).
 */
export const publicUrl = (src: string): string => (src.startsWith("data:") ? src : `${import.meta.env.BASE_URL}${src}`)
