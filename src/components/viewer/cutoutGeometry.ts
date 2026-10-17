import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Matrix4, MeshBasicMaterial, Path, Shape, Vector3, type Material } from "three"
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg"
import { ccw, flatten, pocketSolids, type Panel } from "../../core/model"

const S = 0.001

/**
 * Geometria d'una peça amb talls passants: el contorn extruït amb els forats (ranures amb
 * els extrems rodons, rectangles i cercles). Coordenades en m, origen a la cantonada.
 */
export function cutoutGeometry(p: Panel): ExtrudeGeometry {
  const L = p.length * S
  const W = p.width * S
  const shape = new Shape()
  if (p.outline) {
    // Contorn amb forma (tauler oval, arrodonit…): rectes i arcs aplanats.
    const pts = ccw(flatten(p.outline))
    shape.moveTo(pts[0]![0] * S, pts[0]![1] * S)
    for (const [x, y] of pts.slice(1)) shape.lineTo(x * S, y * S)
  } else {
    shape.moveTo(0, 0)
    shape.lineTo(L, 0)
    shape.lineTo(L, W)
    shape.lineTo(0, W)
  }
  shape.closePath()
  for (const c of p.cutouts ?? []) {
    const hole = new Path()
    if (c.kind === "circle") {
      hole.absarc(c.x * S, c.y * S, (c.diameter / 2) * S, 0, Math.PI * 2, true)
    } else if (c.kind === "polygon") {
      // Els forats de three van en sentit horari.
      const pts = ccw(flatten(c.points)).slice().reverse()
      hole.moveTo(pts[0]![0] * S, pts[0]![1] * S)
      for (const [x, y] of pts.slice(1)) hole.lineTo(x * S, y * S)
      hole.closePath()
    } else if (c.kind === "rect") {
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      hole.moveTo(x0, y0)
      hole.lineTo(x0, y1)
      hole.lineTo(x1, y1)
      hole.lineTo(x1, y0)
      hole.closePath()
    } else {
      // Ranura: dos semicercles units per rectes.
      const rad = (Math.min(c.w, c.h) / 2) * S
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      if (c.w >= c.h) {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI / 2, (Math.PI * 3) / 2, false)
        hole.absarc(x1 - rad, y0 + rad, rad, -Math.PI / 2, Math.PI / 2, false)
      } else {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI, Math.PI * 2, false)
        hole.absarc(x0 + rad, y1 - rad, rad, 0, Math.PI, false)
      }
      hole.closePath()
    }
    shape.holes.push(hole)
  }
  // Cantells corbs (taules rodones, el·lipses, coixins) llisos al visor i al render; les arestes vives, vives.
  return creaseNormals(new ExtrudeGeometry(shape, { depth: p.thickness * S, bevelEnabled: false, curveSegments: 10 }))
}

/**
 * Normals llises d'una geometria no indexada (`ExtrudeGeometry` les fa planes, per cara): a cada
 * vèrtex, la mitjana (ponderada per l'angle de la cantonada) de les cares que hi toquen i es
 * troben a menys de `angle` de la seva; les arestes més vives (cantell i cara, cantonades) no
 * canvien. Modifica i torna la mateixa geometria (si és indexada, la deixa com és).
 */
function creaseNormals<T extends BufferGeometry>(g: T, angle = Math.PI / 6): T {
  const pa = g.getAttribute("position")
  if (g.index || !pa || pa.count < 3) return g
  const n = pa.count - (pa.count % 3)
  const P = new Float64Array(n * 3)
  for (let i = 0; i < n; i++) {
    P[i * 3] = pa.getX(i)
    P[i * 3 + 1] = pa.getY(i)
    P[i * 3 + 2] = pa.getZ(i)
  }
  // Normal de cada cara i angle de cada cantonada.
  const fn = new Float64Array(n)
  const corner = new Float64Array(n)
  for (let f = 0; f < n; f += 3) {
    const b = f * 3
    const e1x = P[b + 3]! - P[b]!, e1y = P[b + 4]! - P[b + 1]!, e1z = P[b + 5]! - P[b + 2]!
    const e2x = P[b + 6]! - P[b]!, e2y = P[b + 7]! - P[b + 1]!, e2z = P[b + 8]! - P[b + 2]!
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x
    const l = Math.hypot(cx, cy, cz)
    if (l > 0) {
      fn[f] = cx / l
      fn[f + 1] = cy / l
      fn[f + 2] = cz / l
    }
    for (let k = 0; k < 3; k++) {
      const o = b + k * 3, a = b + ((k + 1) % 3) * 3, c = b + ((k + 2) % 3) * 3
      const ux = P[a]! - P[o]!, uy = P[a + 1]! - P[o + 1]!, uz = P[a + 2]! - P[o + 2]!
      const vx = P[c]! - P[o]!, vy = P[c + 1]! - P[o + 1]!, vz = P[c + 2]! - P[o + 2]!
      const d = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz)
      corner[f + k] = d > 0 ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / d))) : 0
    }
  }
  // Vèrtexs al mateix punt (a la micra).
  const at = new Map<string, number[]>()
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[i * 3]! * 1e6)},${Math.round(P[i * 3 + 1]! * 1e6)},${Math.round(P[i * 3 + 2]! * 1e6)}`
    const list = at.get(k)
    if (list) list.push(i)
    else at.set(k, [i])
  }
  const cos = Math.cos(angle)
  const out = new Float32Array(pa.count * 3)
  for (const list of at.values())
    for (const i of list) {
      const fi = i - (i % 3)
      const ax = fn[fi]!, ay = fn[fi + 1]!, az = fn[fi + 2]!
      let sx = 0, sy = 0, sz = 0
      for (const j of list) {
        const fj = j - (j % 3)
        const bx = fn[fj]!, by = fn[fj + 1]!, bz = fn[fj + 2]!
        if (fj !== fi && ax * bx + ay * by + az * bz <= cos) continue
        const w = fj === fi ? Math.max(corner[i]!, 1e-6) : corner[j]!
        sx += bx * w
        sy += by * w
        sz += bz * w
      }
      const l = Math.hypot(sx, sy, sz)
      out[i * 3] = l > 0 ? sx / l : ax
      out[i * 3 + 1] = l > 0 ? sy / l : ay
      out[i * 3 + 2] = l > 0 ? sz / l : az
    }
  g.setAttribute("normal", new Float32BufferAttribute(out, 3))
  return g
}

/**
 * Peça amb els extrems (cantells esquerre/dret) a inglet: la secció (llarg × gruix) és un
 * trapezi, amb la cara de fora (z = 0) llarga, extruït al llarg de l'amplada. Materials:
 * [0] les dues puntes (cantells de l'amplada), [1] les cares i els bisells.
 */
export function mitreGeometry(p: Panel): BufferGeometry {
  // Prisma amb la cara de fora (z = 0) sencera i la de dins (z = T) retallada T a cada costat
  // a inglet: els 4 cantells poden anar a 45° (tapa, base i front dels laterals alhora).
  const L = p.length * S
  const W = p.width * S
  const T = p.thickness * S
  const m = new Set(p.mitres ?? [])
  const il = m.has("left") ? T : 0
  const ir = m.has("right") ? T : 0
  const ib = m.has("bottom") ? T : 0
  const it = m.has("top") ? T : 0
  const o = [[0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0]] as const
  const i = [[il, ib, T], [L - ir, ib, T], [L - ir, W - it, T], [il, W - it, T]] as const
  const pos: number[] = []
  const uv: number[] = []
  const cx = L / 2, cy = W / 2, cz = T / 2
  // Orienta cada cara cap enfora (normal en el sentit del centre de la cara menys el del prisma).
  const quad = (a0: readonly number[], b0: readonly number[], c0: readonly number[], d0: readonly number[], uv0: number[][]) => {
    let [a, b, c, d, uvq] = [a0, b0, c0, d0, uv0]
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
    const f = [(a[0]! + c[0]!) / 2 - cx, (a[1]! + c[1]!) / 2 - cy, (a[2]! + c[2]!) / 2 - cz]
    if (n[0]! * f[0]! + n[1]! * f[1]! + n[2]! * f[2]! < 0) {
      ;[b, d] = [d, b]
      uvq = [uv0[0]!, uv0[3]!, uv0[2]!, uv0[1]!]
    }
    for (const [v, t] of [[a, uvq[0]], [b, uvq[1]], [c, uvq[2]], [a, uvq[0]], [c, uvq[2]], [d, uvq[3]]] as const) {
      pos.push(v[0]!, v[1]!, v[2]!)
      uv.push(t![0]!, t![1]!)
    }
  }
  const fuv = (v: readonly number[]) => [v[0]! / L, v[1]! / W]
  // Grup 0: cantells (també els de 45°). Grup 1: cares.
  quad(o[0], o[3], i[3], i[0], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[1], o[0], i[0], i[1], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[2], o[1], i[1], i[2], [[0, 0], [1, 0], [1, 1], [0, 1]])
  quad(o[3], o[2], i[2], i[3], [[0, 0], [1, 0], [1, 1], [0, 1]])
  const edges = pos.length / 3
  quad(o[0], o[1], o[2], o[3], [fuv(o[0]), fuv(o[1]), fuv(o[2]), fuv(o[3])].map((q) => [q[0]!, q[1]!]))
  quad(i[1], i[0], i[3], i[2], [fuv(i[1]), fuv(i[0]), fuv(i[3]), fuv(i[2])].map((q) => [q[0]!, q[1]!]))
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2))
  g.addGroup(0, edges, 0)
  g.addGroup(edges, pos.length / 3 - edges, 1)
  g.computeVertexNormals()
  return g
}

/** La peça té forma (contorn, talls o booleans 3D): es dibuixa extruïda, amb [cares, cantells]. */
export function isShaped(p: Panel): boolean {
  return !!p.cutouts?.length || !!p.outline || !!p.solidCuts?.length || !!p.pockets?.length
}

/**
 * Geometria extruïda de la peça i, si en té, els booleans 3D restats. Grups: [0] cares, [1] cantells amb cantell (els
 * trossos del contorn sobre un costat de la peça que es canteja) i [2] cantells sense (els talls: l'osca d'una columna,
 * les parets dels forats), com els costats de la caixa a `panelMaterials`.
 */
export function shapedGeometry(p: Panel): BufferGeometry {
  if (!(p.solidCuts?.length || p.pockets?.length)) return splitEdgeGroups(cutoutGeometry(p), p)
  // Els booleans 3D són lents (un relleu gran, ~1 s): la mateixa peça (cada cop que es reconstrueix el moble en surt un
  // objecte nou) es treu de la memòria. Es torna una còpia: qui la rep la pot alliberar.
  const key = JSON.stringify(p)
  const hit = CSG_CACHE.get(key)
  if (hit) {
    CSG_CACHE.delete(key)
    CSG_CACHE.set(key, hit)
    return hit.clone()
  }
  const g = splitEdgeGroups(solidCutGeometry(p), p)
  CSG_CACHE.set(key, g)
  while (CSG_CACHE.size > 32) {
    const old = CSG_CACHE.keys().next().value!
    CSG_CACHE.get(old)?.dispose()
    CSG_CACHE.delete(old)
  }
  return g.clone()
}

/** Les últimes peces amb booleans 3D (clau: la peça en JSON). */
const CSG_CACHE = new Map<string, BufferGeometry>()

/**
 * La geometria per dibuixar les arestes d'una peça amb booleans 3D o buidats: la peça sense restar (el booleà deixa
 * triangles prims i arestes en T que es veurien com a ratlles a la cara). `null` si no cal (la mateixa de la peça).
 */
export function edgeSourceGeometry(p: Panel): BufferGeometry | null {
  return p.solidCuts?.length || p.pockets?.length ? cutoutGeometry(p) : null
}

/** Reparteix els triangles dels cantells (grup 1) entre «amb cantell» (1) i «sense» (2) segons `Panel.edges`. */
function splitEdgeGroups(g0: BufferGeometry, p: Panel): BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0
  if (g !== g0) g0.dispose()
  const pos = g.getAttribute("position")
  const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]
  const L = p.length * S, W = p.width * S, eps = 0.0005
  const raw = (p.rawSides ?? []).map(([x0, y0, x1, y1]) => [x0 * S, y0 * S, x1 * S, y1 * S] as const)
  const onSeg = (x: number, y: number, [x0, y0, x1, y1]: readonly [number, number, number, number]) => {
    const dx = x1 - x0, dy = y1 - y0
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)) : 0
    return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) < eps
  }
  // Com abans: amb cantell, llevat dels costats rectes que no es cantegen (`edges`) i dels trams d'un tall (`rawSides`).
  const banded = (a: number, b: number, c: number): boolean => {
    const xs = [pos.getX(a), pos.getX(b), pos.getX(c)], ys = [pos.getY(a), pos.getY(b), pos.getY(c)]
    if (raw.some((sg) => [0, 1, 2].every((k) => onSeg(xs[k]!, ys[k]!, sg)))) return false
    const all = (v: number[], t: number) => v.every((x) => Math.abs(x - t) < eps)
    if (all(xs, 0)) return p.edges.left
    if (all(xs, L)) return p.edges.right
    if (all(ys, 0)) return p.edges.bottom
    if (all(ys, W)) return p.edges.top
    return true
  }
  // Triangles per material: 0 (cares), 1 (amb cantell), 2 (sense).
  const tris: number[][] = [[], [], []]
  for (const gr of groups) {
    const mi = gr.materialIndex ?? 0
    for (let i = gr.start; i < gr.start + gr.count; i += 3) tris[mi === 0 ? 0 : banded(i, i + 1, i + 2) ? 1 : 2]!.push(i)
  }
  const out = new BufferGeometry()
  for (const name of Object.keys(g.attributes)) {
    const src = g.getAttribute(name)
    const arr = new Float32Array(src.count * src.itemSize)
    let k = 0
    for (const list of tris)
      for (const t of list)
        for (let j = 0; j < 3; j++) {
          for (let c = 0; c < src.itemSize; c++) arr[k++] = src.getComponent(t + j, c)
        }
    out.setAttribute(name, new Float32BufferAttribute(arr, src.itemSize))
  }
  let start = 0
  tris.forEach((list, mi) => {
    if (list.length) out.addGroup(start, list.length * 3, mi)
    start += list.length * 3
  })
  g.dispose()
  return out
}

/** Prisma d'un tall 3D (`Panel.solidCuts`), en m i coordenades locals de la peça. */
function prismGeometry(sc: NonNullable<Panel["solidCuts"]>[number]): BufferGeometry {
  const d = new Vector3(...sc.dir)
  const len = d.length()
  d.normalize()
  // Base dextrogira (U, V, D): U i V són els altres dos eixos (els talls són alineats als eixos).
  const ax = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
  const di = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)].indexOf(Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)))
  const others = ax.filter((_, i) => i !== di)
  let U = others[0]!, V = others[1]!
  if (new Vector3().crossVectors(U, V).dot(d) < 0) [U, V] = [V, U]
  const pts = sc.points.map((q) => new Vector3(...q))
  const shape = new Shape()
  pts.forEach((q, i) => (i ? shape.lineTo(q.dot(U) * S, q.dot(V) * S) : shape.moveTo(q.dot(U) * S, q.dot(V) * S)))
  shape.closePath()
  // Una mica més llarg pels dos costats: així no queden cares coplanàries amb la peça.
  const g = new ExtrudeGeometry(shape, { depth: (len + 2) * S, bevelEnabled: false, curveSegments: 1 })
  const m = new Matrix4().makeBasis(U, V, d)
  m.setPosition(d.clone().multiplyScalar((pts[0]!.dot(d) - 1) * S))
  g.applyMatrix4(m)
  return g
}

/**
 * Booleans en 3D (three-bvh-csg): la peça extruïda menys els prismes dels talls que no són
 * passants de cara a cara (un tub pel cantell d'un bloc de pedra). Grups: [0] cares, [1]
 * cantells i parets dels talls, com `cutoutGeometry`.
 */
function solidCutGeometry(p: Panel): BufferGeometry {
  const base = cutoutGeometry(p)
  const face = new MeshBasicMaterial()
  const edge = new MeshBasicMaterial()
  const ev = new Evaluator()
  ev.useGroups = true
  ev.attributes = ["position", "uv", "normal"]
  let a = new Brush(base, [face, edge])
  a.updateMatrixWorld()
  // Els buidats (`pockets`): el prisma de la paret recta i, si el fons no és pla, el sòlid del mapa d'alçades.
  const cutters: BufferGeometry[] = (p.solidCuts ?? []).map(prismGeometry)
  for (const pk of p.pockets ?? []) {
    const sol = pocketSolids(pk, p.thickness)
    if (sol.wall) cutters.push(prismGeometry(sol.wall))
    if (sol.field) {
      const g = new BufferGeometry()
      g.setAttribute("position", new Float32BufferAttribute(sol.field.positions.map((v) => v * S), 3))
      g.setIndex(sol.field.index)
      // Normals suaus (amb els vèrtexs compartits): el fons corbat no es veu a facetes.
      g.computeVertexNormals()
      const flat = g.toNonIndexed()
      g.dispose()
      flat.setAttribute("uv", new Float32BufferAttribute(new Float32Array((flat.getAttribute("position").count) * 2), 2))
      cutters.push(flat)
    }
  }
  for (const cg of cutters) {
    const b = new Brush(cg, edge)
    b.updateMatrixWorld()
    const next = ev.evaluate(a, b, SUBTRACTION)
    b.geometry.dispose()
    if (a.geometry !== base) a.geometry.dispose()
    a = next
  }
  base.dispose()
  const out = a.geometry
  const mats = (Array.isArray(a.material) ? a.material : [a.material]) as Material[]
  for (const gr of out.groups) gr.materialIndex = mats[gr.materialIndex ?? 0] === face ? 0 : 1
  face.dispose()
  edge.dispose()
  return out
}
