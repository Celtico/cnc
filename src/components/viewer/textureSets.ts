/**
 * Jocs de textures PBR (fotos de Poly Haven amb normal i rugositat). El manifest és dades pures a
 * `core/model/textureSets.ts` (les preferències en fan materials, v6); aquí es reexporta per al
 * visor. Els `.jpg` no es precachegen (PWA): es desen a la memòria cau en fer-los servir.
 */
export { TEXTURE_SETS, textureSetFile, textureSetMaterial, type TextureSet } from "../../core/model/textureSets"
