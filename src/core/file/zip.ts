/**
 * ZIP mínim sense dependències.
 *  - `zipStore`: escriu un .zip sense compressió (mètode 0, «store») amb CRC-32. Per als programes
 *    de Maestro (text petit) no cal comprimir.
 *  - `unzip`: llegeix un .zip (directori central); els fitxers comprimits (mètode 8, deflate) es
 *    descomprimeixen amb `DecompressionStream("deflate-raw")` del navegador (i de Node ≥ 18).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Data i hora en format DOS (la del moment, o la que es passi). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear())
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** .zip sense compressió. Els noms van en UTF-8 (bit 11). */
export function zipStore(files: ZipEntry[], when: Date = new Date()): Uint8Array {
  const enc = new TextEncoder()
  const { time, date } = dosDateTime(when)
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const size = f.data.length
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local, f.data)
    centrals.push(central)
    offset += local.length + size
  }
  const centralSize = centrals.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const parts = [...locals, ...centrals, end]
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw")
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Un fitxer del directori d'un .zip (sense llegir): per obrir-ne només els que calen (`readZipEntry`). */
export interface ZipIndexEntry {
  name: string
  method: number
  csize: number
  size: number
  offset: number
}

/** El directori d'un .zip (noms i mides), sense descomprimir res. Llança si no és un .zip. */
export function listZip(bytes: Uint8Array): ZipIndexEntry[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("No és un fitxer .zip")
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out: ZipIndexEntry[] = []
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Directori central del .zip malmès")
    const method = v.getUint16(p + 10, true)
    const csize = v.getUint32(p + 20, true)
    const size = v.getUint32(p + 24, true)
    const nlen = v.getUint16(p + 28, true)
    const xlen = v.getUint16(p + 30, true)
    const clen = v.getUint16(p + 32, true)
    const offset = v.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen))
    p += 46 + nlen + xlen + clen
    if (!name.endsWith("/")) out.push({ name, method, csize, size, offset })
  }
  return out
}

/** Llegeix (i descomprimeix) un fitxer del .zip. */
export async function readZipEntry(bytes: Uint8Array, e: ZipIndexEntry): Promise<Uint8Array> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const lnlen = v.getUint16(e.offset + 26, true)
  const lxlen = v.getUint16(e.offset + 28, true)
  const start = e.offset + 30 + lnlen + lxlen
  const raw = bytes.subarray(start, start + e.csize)
  if (e.method === 0) return raw.slice()
  if (e.method === 8) return inflateRaw(raw)
  throw new Error(`Mètode de compressió ${e.method} no suportat (${e.name})`)
}

/** Llegeix tots els fitxers d'un .zip. Llança si no ho és o si un fitxer fa servir un mètode desconegut. */
export async function unzip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const out: ZipEntry[] = []
  for (const e of listZip(bytes)) out.push({ name: e.name, data: await readZipEntry(bytes, e) })
  return out
}
