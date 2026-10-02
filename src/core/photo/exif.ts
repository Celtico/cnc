/**
 * Lector mínim d'EXIF per a JPEG (segment APP1 → TIFF → IFD0 → Exif IFD).
 * Només el que ens cal: focal, focal equivalent a 35 mm i orientació.
 * Si el fitxer no és JPEG o no porta EXIF, retorna un objecte buit.
 */

export interface ExifInfo {
  /** Focal real de l'objectiu en mm (tag 0x920A). */
  focalMm?: number
  /** Focal equivalent a 35 mm (tag 0xA405). */
  focal35?: number
  /** Orientació EXIF 1..8 (tag 0x0112). */
  orientation?: number
  /** Mides declarades (tags 0xA002 / 0xA003), si hi són. */
  pixelWidth?: number
  pixelHeight?: number
}

const TAG_ORIENTATION = 0x0112
const TAG_EXIF_IFD = 0x8769
const TAG_FOCAL = 0x920a
const TAG_FOCAL_35 = 0xa405
const TAG_PIXEL_X = 0xa002
const TAG_PIXEL_Y = 0xa003

export function readExif(buffer: ArrayBuffer): ExifInfo {
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {}

  // Recorre els segments fins a trobar APP1 amb "Exif\0\0".
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === 0xffda || marker === 0xffd9) break // inici de dades / final
    const length = view.getUint16(offset + 2)
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return readTiff(new DataView(buffer, offset + 10, Math.max(0, Math.min(length - 8, view.byteLength - offset - 10))))
    }
    offset += 2 + length
  }
  return {}
}

function readTiff(tiff: DataView): ExifInfo {
  if (tiff.byteLength < 8) return {}
  const byteOrder = tiff.getUint16(0)
  const little = byteOrder === 0x4949 // "II"
  if (!little && byteOrder !== 0x4d4d) return {}
  const u16 = (o: number) => tiff.getUint16(o, little)
  const u32 = (o: number) => tiff.getUint32(o, little)
  if (u16(2) !== 0x2a) return {}

  const info: ExifInfo = {}
  const readIfd = (start: number, depth: number): void => {
    if (depth > 2 || start + 2 > tiff.byteLength) return
    const count = u16(start)
    for (let i = 0; i < count; i++) {
      const e = start + 2 + i * 12
      if (e + 12 > tiff.byteLength) return
      const tag = u16(e)
      const type = u16(e + 2)
      const n = u32(e + 4)
      const valueOffset = e + 8
      const value = (): number | undefined => {
        if (type === 3) return u16(valueOffset) // SHORT
        if (type === 4) return u32(valueOffset) // LONG
        if (type === 5 && n >= 1) {
          const o = u32(valueOffset)
          if (o + 8 > tiff.byteLength) return undefined
          const den = u32(o + 4)
          return den ? u32(o) / den : undefined // RATIONAL
        }
        return undefined
      }
      switch (tag) {
        case TAG_ORIENTATION:
          info.orientation = value()
          break
        case TAG_FOCAL:
          info.focalMm = value()
          break
        case TAG_FOCAL_35: {
          // 0 = desconeguda (norma EXIF): sense focal, no una focal de 0 mm.
          const f = value()
          if (f !== undefined && f > 0) info.focal35 = f
          break
        }
        case TAG_PIXEL_X:
          info.pixelWidth = value()
          break
        case TAG_PIXEL_Y:
          info.pixelHeight = value()
          break
        case TAG_EXIF_IFD: {
          const o = value()
          if (o !== undefined) readIfd(o, depth + 1)
          break
        }
        default:
          break
      }
    }
  }
  readIfd(u32(4), 0)
  return info
}
