import { roundTo } from "../../lib/format"
import { edgeKey, type MeshCage } from "./meshShape"

/**
 * **Importar un model 3D** (per petició de l'usuari, 2026-10-22: el mural de la cara amb ones fet al Cinema 4D, «ja el
 * pots fer»): un .stl passa a una forma lliure de sempre (`RefObject.shape` "mesh") per tallar-la en llistons o fresar-la.
 * Cap peça nova: la caixa de control és la malla tal com ve (`level` 0, sense suavitzar).
 *
 * - Eixos: l'STL ve amb Z amunt (Cinema 4D, Blender, escàners); a l'app Y és amunt i Z cap endavant: (x, y, z) → (x, z, −y).
 * - Unitats: l'STL no en porta. Si la mida més gran és de menys de 10, metres; de menys de 200, centímetres; si no, mm.
 * - Una malla **oberta** (superfícies soltes, com un pla amb ones i una cara a sobre, o un escaneig) es tanca com a
 *   **relleu**: el que es veu des del davant, en una graella de `RELIEF_CELLS` pel costat llarg, amb el darrere pla.
 * - Una malla tancada de més de `MAX_TRIANGLES`: si és un relleu (el darrere pla, `isRelief`), es fa igual que una oberta
 *   (allà on no hi ha res, el darrere); si no, es redueix agrupant vèrtexs per cel·les, que pot deixar-la mal tancada
 *   (`rough`: l'app avisa que l'exportin amb menys triangles).
 * Pur.
 */

type V3 = [number, number, number]
type Tri = [V3, V3, V3]

/** Triangles com a molt d'una malla tancada importada. */
const MAX_TRIANGLES = 20_000
/** Cel·les del costat llarg del relleu d'una malla oberta. */
const RELIEF_CELLS = 140

/** Els triangles d'un .stl, binari o de text. */
export function parseStl(buf: ArrayBuffer): Tri[] {
  const bytes = new Uint8Array(buf)
  const dv = new DataView(buf)
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0
  // Binari: 80 bytes de capçalera, el nombre de triangles i 50 bytes per triangle (encara que la capçalera digui «solid»).
  if (buf.byteLength >= 84 && 84 + n * 50 === buf.byteLength) {
    const out: Tri[] = []
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12
      const p = (k: number): V3 => [dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)]
      out.push([p(0), p(1), p(2)])
    }
    return out
  }
  const text = new TextDecoder().decode(bytes)
  const vs = [...text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m): V3 => [Number(m[1]), Number(m[2]), Number(m[3])])
  if (!vs.length || vs.some((v) => v.some((x) => !Number.isFinite(x)))) throw new Error("no és un fitxer STL")
  const out: Tri[] = []
  for (let i = 0; i + 2 < vs.length; i += 3) out.push([vs[i]!, vs[i + 1]!, vs[i + 2]!])
  return out
}

/** Vèrtexs units (els iguals, a `tol`) i cares; sense triangles degenerats ni repetits. */
function weld(tris: Tri[], cell: number): { v: V3[]; f: [number, number, number][] } {
  const key = new Map<string, number>()
  const sum: V3[] = [], cnt: number[] = []
  const at = (p: V3): number => {
    const k = `${Math.round(p[0] / cell)},${Math.round(p[1] / cell)},${Math.round(p[2] / cell)}`
    let i = key.get(k)
    if (i === undefined) {
      i = sum.length
      key.set(k, i)
      sum.push([0, 0, 0])
      cnt.push(0)
    }
    sum[i]![0] += p[0]
    sum[i]![1] += p[1]
    sum[i]![2] += p[2]
    cnt[i]!++
    return i
  }
  const seen = new Set<string>()
  const f: [number, number, number][] = []
  for (const t of tris) {
    const a = at(t[0]), b = at(t[1]), c = at(t[2])
    if (a === b || b === c || a === c) continue
    const k = [a, b, c].sort((x, y) => x - y).join(",")
    if (seen.has(k)) continue
    seen.add(k)
    f.push([a, b, c])
  }
  return { v: sum.map((s, i): V3 => [s[0] / cnt[i]!, s[1] / cnt[i]!, s[2] / cnt[i]!]), f }
}

/** Arestes que només fan servir una cara: la malla no és tancada. */
function openEdges(f: [number, number, number][]): number {
  const n = new Map<string, number>()
  for (const t of f) for (let k = 0; k < 3; k++) {
    const e = edgeKey(t[k]!, t[(k + 1) % 3]!)
    n.set(e, (n.get(e) ?? 0) + 1)
  }
  let open = 0
  for (const c of n.values()) if (c === 1) open++
  return open
}

/**
 * El relleu vist des del davant (+z): a cada node de la graella, el punt més endavant dels triangles; els forats es tapen
 * amb el veí. Caixa de control: la cara del davant en quadrats, el darrere pla (una sola cara) i les parets de la vora,
 * amb la vora viva.
 */
function reliefCage(tris: Tri[], lo: V3, hi: V3, holes: "neighbours" | "back"): MeshCage {
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1])
  const step = span / RELIEF_CELLS
  const nx = Math.max(2, Math.round((hi[0] - lo[0]) / step) + 1), ny = Math.max(2, Math.round((hi[1] - lo[1]) / step) + 1)
  const sx = (hi[0] - lo[0]) / (nx - 1), sy = (hi[1] - lo[1]) / (ny - 1)
  const z = new Float64Array(nx * ny).fill(-Infinity)
  for (const [a, b, c] of tris) {
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if (Math.abs(den) < 1e-12) continue
    const i0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - lo[0]) / sx - 1e-9)), i1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0], c[0]) - lo[0]) / sx + 1e-9))
    const j0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - lo[1]) / sy - 1e-9)), j1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1], c[1]) - lo[1]) / sy + 1e-9))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = lo[0] + i * sx, py = lo[1] + j * sy
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den
        const l3 = 1 - l1 - l2
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue
        const k = j * nx + i
        z[k] = Math.max(z[k]!, l1 * a[2] + l2 * b[2] + l3 * c[2])
      }
  }
  // Forats (on no hi ha superfície): el valor dels veïns, a passades; d'un relleu tancat, el darrere.
  if (holes === "back") for (let k = 0; k < z.length; k++) if (z[k] === -Infinity) z[k] = lo[2]
  for (let pass = 0; pass < nx + ny && z.some((x) => x === -Infinity); pass++) {
    const prev = Float64Array.from(z)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        if (prev[k] !== -Infinity) continue
        let s = 0, c = 0
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ii = i + di, jj = j + dj
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue
          const q = prev[jj * nx + ii]!
          if (q !== -Infinity) {
            s += q
            c++
          }
        }
        if (c) z[k] = s / c
      }
  }
  let zmin = Infinity, zmax = -Infinity
  for (const x of z) {
    zmin = Math.min(zmin, x)
    zmax = Math.max(zmax, x)
  }
  // El darrere: una mica per sota del punt més enfonsat (un 5 % del relleu, com a mínim un 1 % del costat llarg).
  const back = zmin - Math.max((zmax - zmin) * 0.05, span * 0.01)
  const v: V3[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v.push([lo[0] + i * sx, lo[1] + j * sy, z[j * nx + i]!])
  const id = (i: number, j: number) => j * nx + i
  const f: number[][] = []
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) f.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)])
  // La vora, antihorària vista des del davant.
  const ring: number[] = []
  for (let i = 0; i < nx - 1; i++) ring.push(id(i, 0))
  for (let j = 0; j < ny - 1; j++) ring.push(id(nx - 1, j))
  for (let i = nx - 1; i > 0; i--) ring.push(id(i, ny - 1))
  for (let j = ny - 1; j > 0; j--) ring.push(id(0, j))
  const backOf = new Map<number, number>()
  for (const r of ring) {
    backOf.set(r, v.length)
    v.push([v[r]![0], v[r]![1], back])
  }
  const crease: [number, number][] = []
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length]!
    f.push([a, backOf.get(a)!, backOf.get(b)!, b])
    crease.push([a, b], [backOf.get(a)!, backOf.get(b)!])
  })
  f.push([...ring].reverse().map((r) => backOf.get(r)!))
  return { v, f, level: 0, crease }
}

/** Una malla tancada que és un relleu: el darrere pla (cap enrere, a la z mínima) tapa almenys el 80 % del que es veu des del davant. */
function isRelief(tris: Tri[], lo: V3): boolean {
  let back = 0, front = 0
  for (const [a, b, c] of tris) {
    const nz = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
    if (nz > 0) front += nz
    else if (nz < 0 && Math.max(a[2], b[2], c[2]) - lo[2] < 1e-3 * Math.max(1, Math.abs(lo[2]))) back -= nz
  }
  return front > 0 && back >= 0.8 * front
}

/**
 * Els triangles d'un model (coordenades del fitxer) com a forma lliure: la caixa de control de 0 a 1 i les mides en mm
 * (`w` × `h` × `d`). `relief`: si s'ha fet com a relleu; `rough`: reduïda agrupant vèrtexs (pot quedar mal tancada).
 */
export function importedMesh(tris: Tri[]): { mesh: MeshCage; w: number; h: number; d: number; relief: boolean; rough: boolean } {
  if (!tris.length) throw new Error("el fitxer no té cap triangle")
  // Z amunt → Y amunt, i el davant cap a +z.
  let pts: Tri[] = tris.map((t) => t.map(([x, y, z]): V3 => [x, z, -y]) as Tri)
  const box = (ts: Tri[]) => {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
    for (const t of ts) for (const p of t) for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, p[k]!)
      hi[k] = Math.max(hi[k]!, p[k]!)
    }
    return { lo, hi }
  }
  let { lo, hi } = box(pts)
  const big = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
  if (!(big > 0)) throw new Error("el model no té mida")
  const unit = big < 10 ? 1000 : big < 200 ? 10 : 1
  if (unit !== 1) {
    pts = pts.map((t) => t.map((p) => p.map((x) => x * unit)) as Tri)
    ;({ lo, hi } = box(pts))
  }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
  let m = weld(pts, diag * 1e-6)
  const open = openEdges(m.f) > 0
  const relief = open || (m.f.length > MAX_TRIANGLES && isRelief(pts, lo))
  let rough = false
  let cage: MeshCage
  if (relief) cage = reliefCage(pts, lo, hi, open ? "neighbours" : "back")
  else {
    // Massa triangles: s'agrupen els vèrtexs per cel·les (la mida, d'entrada, pels triangles que hi ha).
    if (m.f.length > MAX_TRIANGLES) {
      rough = true
      let cells = Math.round(Math.sqrt(MAX_TRIANGLES / 2) * 1.6)
      for (m = weld(pts, diag / cells); m.f.length > MAX_TRIANGLES && cells > 10; m = weld(pts, diag / cells)) cells = Math.floor(cells * 0.85)
    }
    cage = { v: m.v, f: m.f, level: 0 }
  }
  const b = (() => {
    const l: V3 = [Infinity, Infinity, Infinity], h: V3 = [-Infinity, -Infinity, -Infinity]
    for (const p of cage.v) for (let k = 0; k < 3; k++) {
      l[k] = Math.min(l[k]!, p[k]!)
      h[k] = Math.max(h[k]!, p[k]!)
    }
    return { l, h }
  })()
  const size = [0, 1, 2].map((k) => Math.max(1e-6, b.h[k]! - b.l[k]!))
  const v = cage.v.map((p) => p.map((x, k) => roundTo((x - b.l[k]!) / size[k]!, 5)) as V3)
  return { mesh: { ...cage, v }, w: roundTo(size[0]!, 1), h: roundTo(size[1]!, 1), d: roundTo(size[2]!, 1), relief, rough }
}
