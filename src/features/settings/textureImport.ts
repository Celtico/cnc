import { exrToCanvas, isExrBlob } from "../../components/viewer/exrImage"
import { unzip } from "../../core/file/zip"
import { isJunkPath, polyHavenRefOf, type PolyHavenRef } from "../../core/import"
import type { Finish } from "../../core/model"
import { averageColor, fitSize, flipGreen, isTextureFile, isZipFile, planTextureSet, textureSetKey, toGrayscale, type PbrSlot } from "../../core/photo/pbrMaps"
import { pickedFromList, type PickedFile } from "./machineImport"

/**
 * Fotos i mapes PBR de les textures dels materials (Preferències › Materials): es redueixen a 1024 px com la foto de
 * color. El color passa per la gestió de color del navegador; el normal i la rugositat són **dades**: es llegeixen sense
 * convertir el color (`colorSpaceConversion: "none"`), el normal en JPEG d'alta qualitat i la rugositat en grisos.
 */

export type ImageFinish = Extract<Finish, { kind: "image" }>

/** Imatge reduïda en data URL, la proporció (alt ÷ ample) i, la de color, el color mitjà. */
export interface EncodedMap {
  src: string
  aspect: number
  color?: string
}

const MAX_PX = 1024
const QUALITY: Record<PbrSlot, number> = { color: 0.85, normal: 0.95, rough: 0.9 }

/** Llegeix una imatge; `raw` = sense gestió de color (mapes de dades). Un EXR es descodifica a 8 bits (`exrToCanvas`). */
async function decode(blob: Blob, raw: boolean): Promise<{ img: CanvasImageSource; w: number; h: number; close: () => void }> {
  if (await isExrBlob(blob)) {
    const c = await exrToCanvas(blob, { srgb: !raw })
    return { img: c, w: c.width, h: c.height, close: () => (c.width = c.height = 0) }
  }
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(blob, raw ? { colorSpaceConversion: "none", premultiplyAlpha: "none" } : {})
      return { img: b, w: b.width, h: b.height, close: () => b.close() }
    } catch {
      // Alguns navegadors no accepten les opcions o el format: es prova amb <img>.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error("No és una imatge que es pugui llegir."))
      img.src = url
    })
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Redueix una imatge a 1024 px i la passa a data URL JPEG segons el mapa: color tal qual (amb el color mitjà), normal
 * amb el verd invertit si `flip` (DirectX → OpenGL), rugositat en grisos (`channel: "g"` als ARM/ORM).
 */
export async function encodeMap(blob: Blob, slot: PbrSlot, opts: { flip?: boolean; channel?: "g" } = {}): Promise<EncodedMap> {
  const { img, w, h, close } = await decode(blob, slot !== "color")
  try {
    if (!w || !h) throw new Error("La imatge és buida.")
    const size = fitSize(w, h, MAX_PX)
    const c = document.createElement("canvas")
    c.width = size.w
    c.height = size.h
    const ctx = c.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("El navegador no deixa dibuixar la imatge.")
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, size.w, size.h)
    const data = ctx.getImageData(0, 0, size.w, size.h)
    let color: string | undefined
    if (slot === "color") color = averageColor(data.data)
    else {
      if (slot === "normal") {
        if (opts.flip) flipGreen(data.data)
        for (let i = 3; i < data.data.length; i += 4) data.data[i] = 255
      } else toGrayscale(data.data, opts.channel ?? "luma")
      ctx.putImageData(data, 0, 0)
    }
    const src = c.toDataURL("image/jpeg", QUALITY[slot])
    c.width = c.height = 0
    return { src, aspect: Math.round((size.h / size.w) * 1000) / 1000, ...(color ? { color } : {}) }
  } finally {
    close()
  }
}

/** La imatge d'un `src` d'acabat (data URL o fitxer de l'app). */
export async function srcBlob(src: string): Promise<Blob> {
  const r = await fetch(src.startsWith("data:") ? src : `${import.meta.env.BASE_URL}${src}`)
  if (!r.ok) throw new Error("No s'ha pogut llegir la imatge.")
  return r.blob()
}

/** Obre el selector de fitxers (o de carpeta) i torna el que s'ha triat (buit si es cancel·la). */
export function pickFiles(opts: { multiple?: boolean; folder?: boolean; accept?: string; testId?: string } = {}): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    if (opts.multiple || opts.folder) input.multiple = true
    if (opts.folder) input.setAttribute("webkitdirectory", "")
    if (opts.accept && !opts.folder) input.accept = opts.accept
    input.dataset.testid = opts.testId ?? (opts.folder ? "texture-folder" : opts.multiple ? "texture-files" : "texture-file")
    input.hidden = true
    input.onchange = () => {
      resolve(pickedFromList(input.files ?? []))
      input.remove()
    }
    input.oncancel = () => {
      resolve([])
      input.remove()
    }
    // A la pàgina perquè les proves (Playwright) el trobin; es treu en acabar.
    document.body.appendChild(input)
    input.click()
  })
}

/** Joc de textures llegit: el que s'ha trobat i el que no s'ha fet servir. */
export interface LoadedTextureSet {
  color?: EncodedMap
  normal?: EncodedMap
  rough?: EncodedMap
  /** Convenció del normal: `true` DirectX (s'ha invertit el verd), `false` OpenGL. */
  normalDx?: boolean
  /** Nom del fitxer de cada mapa. */
  used: Partial<Record<PbrSlot, string>>
  ignored: string[]
  /** Nom del material segons els fitxers (`textureSetKey` del color o d'un altre mapa: «rough plaster brick 04»). */
  key?: string
  /** Si és un joc de Poly Haven (`<id>_<res>.…`): per al nom i la mida real (API). */
  polyHaven?: PolyHavenRef
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

/** Fitxers triats (i el contingut dels `.zip`) en un mapa camí → fitxer; `skipped` = els dels zips que no són textures. */
export async function expandPicked(picked: PickedFile[], keep: (path: string) => boolean = isTextureFile): Promise<{ files: Map<string, Blob>; skipped: string[]; zipNames: string[] }> {
  const files = new Map<string, Blob>()
  const skipped: string[] = []
  const zipNames: string[] = []
  const many = picked.filter((p) => isZipFile(p.path)).length > 1
  for (const p of picked) {
    if (isZipFile(p.path)) {
      zipNames.push(baseName(p.path))
      let entries
      try {
        entries = await unzip(new Uint8Array(await p.file.arrayBuffer()))
      } catch {
        throw new Error(`No s'ha pogut obrir «${baseName(p.path)}»: no és un .zip o està malmès.`)
      }
      for (const e of entries) {
        if (e.name.endsWith("/") || isJunkPath(e.name)) continue
        // Amb un sol zip, els camins són els de dins (com els d'una carpeta); amb més, amb el nom del zip al davant.
        const path = many ? `${p.path}/${e.name}` : e.name
        if (keep(e.name)) files.set(path, new Blob([e.data as Uint8Array<ArrayBuffer>]))
        else skipped.push(baseName(e.name))
      }
    } else if (!isJunkPath(p.path)) files.set(p.path, p.file)
  }
  return { files, skipped, zipNames }
}

/**
 * Llegeix un joc de textures (fitxers, una carpeta o un .zip): tria el color, el normal i la rugositat pel nom
 * (`planTextureSet`) i els codifica. `normalDx` = què fer amb un normal que el nom no diu si és `_gl` o `_dx`.
 */
export async function loadTextureSet(picked: PickedFile[], normalDx: boolean): Promise<LoadedTextureSet> {
  const { files, skipped, zipNames } = await expandPicked(picked)
  const out = await loadTextureFiles(files, normalDx, skipped)
  const ref = polyHavenRefOf([...files.keys(), ...skipped], zipNames[0])
  if (ref) out.polyHaven = ref
  return out
}

/** El mateix amb els fitxers ja llegits (camí → fitxer): els jocs de textures d'un model importat. */
export async function loadTextureFiles(files: Map<string, Blob>, normalDx: boolean, ignored: string[] = []): Promise<LoadedTextureSet> {
  const plan = planTextureSet([...files.keys()].filter((p) => isTextureFile(p)))
  const out: LoadedTextureSet = { used: {}, ignored: [...ignored, ...plan.ignored.map(baseName)] }
  const first = plan.color ?? plan.normal ?? plan.rough
  const key = first ? textureSetKey(first.path) : null
  if (key) out.key = key
  if (plan.color) {
    out.color = await encodeMap(files.get(plan.color.path)!, "color")
    out.used.color = baseName(plan.color.path)
  }
  if (plan.normal) {
    const dx = plan.normal.directX ?? normalDx
    out.normal = await encodeMap(files.get(plan.normal.path)!, "normal", { flip: dx })
    out.normalDx = dx
    out.used.normal = baseName(plan.normal.path)
  }
  if (plan.rough) {
    out.rough = await encodeMap(files.get(plan.rough.path)!, "rough", plan.rough.channel ? { channel: plan.rough.channel } : {})
    out.used.rough = baseName(plan.rough.path)
  }
  return out
}

/**
 * Acabat amb el joc posat. Amb foto de color, el joc substitueix la foto i els mapes (un joc es fa per repetir: sense
 * mirall); sense, només els mapes que porta, sobre una foto que ja hi era. `null` si no hi ha on posar-los.
 */
export function withTextureSet(current: Finish, set: LoadedTextureSet, tileMm = 800): ImageFinish | null {
  const prev = current.kind === "image" ? current : null
  if (set.color) {
    const keep: Partial<ImageFinish> = prev ? { ...prev } : { tileMm }
    delete keep.normalMap
    delete keep.roughMap
    delete keep.normalDx
    return {
      tileMm,
      ...keep,
      kind: "image",
      src: set.color.src,
      aspect: set.color.aspect,
      ...(set.color.color ? { color: set.color.color } : {}),
      seamless: true,
      ...(set.normal ? { normalMap: set.normal.src, ...(set.normalDx ? { normalDx: true } : {}) } : {}),
      ...(set.rough ? { roughMap: set.rough.src } : {}),
    }
  }
  if (!prev || (!set.normal && !set.rough)) return null
  const next: ImageFinish = { ...prev }
  if (set.normal) {
    next.normalMap = set.normal.src
    if (set.normalDx) next.normalDx = true
    else delete next.normalDx
  }
  if (set.rough) next.roughMap = set.rough.src
  return next
}

/** Resum del que s'ha carregat d'un joc (avís). */
export function textureSetSummary(set: LoadedTextureSet): string {
  const parts = [
    set.used.color && `color ${set.used.color}`,
    set.used.normal && `relleu ${set.used.normal}${set.normalDx ? " (DirectX, verd invertit)" : ""}`,
    set.used.rough && `brillantor ${set.used.rough}`,
  ].filter(Boolean)
  const ignored = set.ignored.length ? ` Sense fer servir: ${set.ignored.slice(0, 6).join(", ")}${set.ignored.length > 6 ? "…" : ""}.` : ""
  return `${parts.join(" · ")}.${ignored}`
}

