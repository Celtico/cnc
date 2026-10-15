import type { PickedFile } from "../../components/pickedFiles"
import { polyHavenTitle, textureTileMm, type PolyHavenInfo } from "../../core/import"
import { newId, pbrSetMaterial, uniqueMaterialName, type MaterialPref } from "../../core/model"
import { groupTextureSets } from "../../core/photo/pbrMaps"
import { fetchPolyHavenInfo } from "../file/polyHavenApi"
import { loadTextureFiles, loadTextureSet, withTextureSet, type ImageFinish, type LoadedTextureSet } from "./textureImport"

/**
 * «Afegir les textures a Materials»: els jocs de textures d'un model importat (o d'un zip de textures) com a materials de
 * Simulació amb foto de color, relleu i brillantor (com «Joc PBR» de l'editor de materials).
 */

/** Nom del material d'un joc: el de Poly Haven si n'hi ha un sol joc; si no, el del fitxer («potted plant 04» → «Potted plant 04»). */
export function textureSetName(key: string, info: PolyHavenInfo | null | undefined, sets: number, fallback: string): string {
  if (info?.name && sets === 1) return info.name
  const k = key.trim()
  return k ? polyHavenTitle(k.replace(/ /g, "_")) : fallback
}

interface TextureMaterialsResult {
  added: MaterialPref[]
  /** Jocs sense foto de color (no se'n pot fer cap material). */
  skipped: string[]
}

/**
 * Fa un material per joc (`groupTextureSets`) amb la mida real `tileMm`. Els noms no xoquen amb els que ja hi ha
 * (`uniqueMaterialName`). No desa res: qui crida afegeix `added` a les preferències.
 */
export async function materialsFromTextures(textures: Map<string, Blob>, opts: { info?: PolyHavenInfo | null; fallbackName: string; tileMm: number; materials: readonly MaterialPref[] }): Promise<TextureMaterialsResult> {
  const sets = groupTextureSets([...textures.keys()])
  const added: MaterialPref[] = []
  const skipped: string[] = []
  for (const s of sets) {
    const files = new Map(s.paths.map((p) => [p, textures.get(p)!]))
    const name = textureSetName(s.key, opts.info, sets.length, opts.fallbackName)
    const set = await loadTextureFiles(files, false)
    const finish = withTextureSet({ kind: "color", color: "#808080" }, set, opts.tileMm)
    if (!finish || !set.color) {
      skipped.push(name)
      continue
    }
    added.push(pbrSetMaterial(newId("mat"), uniqueMaterialName([...opts.materials, ...added], name), finish))
  }
  return { added, skipped }
}

/** Mida real d'una repetició si no se'n sap res (la de «Joc PBR» de sempre). */
const DEFAULT_SET_TILE_MM = 800

interface PickedTextureSet {
  set: LoadedTextureSet
  /** Nom per al material: el de Poly Haven (API o l'id), si no el dels fitxers. */
  name: string
  /** Mida real de Poly Haven (textures: `dimensions`); `null` si no se sap. */
  tileMm: number | null
  /** L'acabat de foto amb els mapes; `null` si no hi ha foto de color. */
  finish: ImageFinish | null
}

/**
 * Un joc de textures triat (fitxers, carpeta o el `.zip` de Poly Haven en qualsevol format, també amb EXR): el llegeix i,
 * si és de Poly Haven, en pregunta el nom i la mida real a l'API (sense connexió, el nom de l'id i la mida per defecte).
 */
export async function readPickedTextureSet(picked: PickedFile[], normalDx = false): Promise<PickedTextureSet> {
  const set = await loadTextureSet(picked, normalDx)
  const info = set.polyHaven ? await fetchPolyHavenInfo(set.polyHaven.id) : null
  const tileMm = info?.dimensions ? textureTileMm(info) : null
  const name = info?.name ?? (set.polyHaven ? polyHavenTitle(set.polyHaven.id) : textureSetName(set.key ?? "", null, 1, "Material nou"))
  const finish = set.color ? withTextureSet({ kind: "color", color: "#808080" }, set, tileMm ?? DEFAULT_SET_TILE_MM) : null
  return { set, name, tileMm, finish }
}
