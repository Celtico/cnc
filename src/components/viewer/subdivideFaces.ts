import { BufferGeometry, Float32BufferAttribute } from "three"

/**
 * La geometria amb els triangles del grup `group` (les cares grans de la peça) partits fins que cap costat passi de
 * `maxLen` (bisecció pel costat més llarg). El booleà (three-bvh-csg) retalla cada triangle contra tots els forats que el
 * toquen, i amb la cara en dos triangles gegants un lateral amb dues fileres System 32 trigava 1,6 s; partida, ~0,4 s. Sense índex.
 */
export function subdivideFaces(g0: BufferGeometry, group: number, maxLen: number): BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0
  const names = Object.keys(g.attributes)
  const src = names.map((n) => g.getAttribute(n))
  const out = names.map(() => [] as number[])
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.getAttribute("position").count, materialIndex: 0 }]
  const res = new BufferGeometry()
  const max2 = maxLen * maxLen
  /** Un vèrtex: els valors de tots els atributs. */
  type V = number[][]
  const vert = (i: number): V => src.map((a) => Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k]!))
  const mid = (a: V, b: V): V => a.map((x, j) => x.map((v, k) => (v + b[j]![k]!) / 2))
  const d2 = (a: V, b: V) => (a[0]![0]! - b[0]![0]!) ** 2 + (a[0]![1]! - b[0]![1]!) ** 2 + (a[0]![2]! - b[0]![2]!) ** 2
  const push = (t: V[]) => t.forEach((v) => v.forEach((x, j) => out[j]!.push(...x)))
  let start = 0
  for (const gr of groups) {
    const before = out[0]!.length / 3
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const stack: V[][] = [[vert(i), vert(i + 1), vert(i + 2)]]
      while (stack.length) {
        const t = stack.pop()!
        const l = [d2(t[0]!, t[1]!), d2(t[1]!, t[2]!), d2(t[2]!, t[0]!)]
        const k = l.indexOf(Math.max(...l))
        if ((gr.materialIndex ?? 0) !== group || l[k]! <= max2 || stack.length > 4000) {
          push(t)
          continue
        }
        const [a, b, c] = [t[k]!, t[(k + 1) % 3]!, t[(k + 2) % 3]!]
        const m = mid(a, b)
        stack.push([a, m, c], [m, b, c])
      }
    }
    const count = out[0]!.length / 3 - before
    res.addGroup(start, count, gr.materialIndex ?? 0)
    start += count
  }
  names.forEach((n, j) => res.setAttribute(n, new Float32BufferAttribute(out[j]!, src[j]!.itemSize)))
  if (g !== g0) g.dispose()
  return res
}
