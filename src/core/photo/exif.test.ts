import { describe, expect, it } from "vitest"
import { readExif } from "./exif"

/** Construeix un JPEG mínim amb un segment APP1/EXIF sintètic. */
function makeJpeg(little: boolean, withExif = true, focal35 = 26): ArrayBuffer {
  const tiff = new ArrayBuffer(200)
  const v = new DataView(tiff)
  const u16 = (o: number, x: number) => v.setUint16(o, x, little)
  const u32 = (o: number, x: number) => v.setUint32(o, x, little)
  u16(0, little ? 0x4949 : 0x4d4d)
  u16(2, 0x2a)
  u32(4, 8) // IFD0 a l'offset 8
  // IFD0: 2 entrades
  u16(8, 2)
  let e = 10
  u16(e, 0x0112) // Orientation
  u16(e + 2, 3)
  u32(e + 4, 1)
  u16(e + 8, 6)
  e += 12
  u16(e, 0x8769) // Exif IFD pointer
  u16(e + 2, 4)
  u32(e + 4, 1)
  u32(e + 8, 40)
  e += 12
  u32(e, 0) // següent IFD
  // Exif IFD a 40: 3 entrades
  u16(40, 3)
  e = 42
  u16(e, 0x920a) // FocalLength RATIONAL → offset 100
  u16(e + 2, 5)
  u32(e + 4, 1)
  u32(e + 8, 100)
  e += 12
  u16(e, 0xa405) // FocalLengthIn35mmFilm SHORT
  u16(e + 2, 3)
  u32(e + 4, 1)
  u16(e + 8, focal35)
  e += 12
  u16(e, 0xa002) // PixelXDimension LONG
  u16(e + 2, 4)
  u32(e + 4, 1)
  u32(e + 8, 4032)
  e += 12
  u32(e, 0)
  u32(100, 5700)
  u32(104, 1000)

  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0])
  const app1Len = 2 + exifHeader.length + tiff.byteLength
  const out = new Uint8Array(2 + (withExif ? 2 + app1Len : 0) + 2)
  let o = 0
  out[o++] = 0xff
  out[o++] = 0xd8
  if (withExif) {
    out[o++] = 0xff
    out[o++] = 0xe1
    out[o++] = app1Len >> 8
    out[o++] = app1Len & 0xff
    out.set(exifHeader, o)
    o += exifHeader.length
    out.set(new Uint8Array(tiff), o)
    o += tiff.byteLength
  }
  out[o++] = 0xff
  out[o++] = 0xd9
  return out.buffer
}

describe("readExif", () => {
  it("llegeix focal, focal 35 mm, orientació i amplada (big-endian)", () => {
    expect(readExif(makeJpeg(false))).toEqual({
      orientation: 6,
      focalMm: 5.7,
      focal35: 26,
      pixelWidth: 4032,
    })
  })

  it("també en little-endian", () => {
    expect(readExif(makeJpeg(true)).focal35).toBe(26)
  })

  it("focal 35 mm = 0 (desconeguda) → sense focal35", () => {
    expect(readExif(makeJpeg(false, true, 0)).focal35).toBeUndefined()
  })
  it("JPEG sense EXIF → objecte buit", () => {
    expect(readExif(makeJpeg(false, false))).toEqual({})
  })

  it("un fitxer que no és JPEG → objecte buit", () => {
    expect(readExif(new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]).buffer)).toEqual({})
    expect(readExif(new ArrayBuffer(0))).toEqual({})
  })
})
