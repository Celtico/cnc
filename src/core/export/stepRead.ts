/**
 * Lector STEP mínim per validar el que escrivim (tests i comprovació a la UI):
 * entitats, sòlids amb la seva caixa i comprovació que el `CLOSED_SHELL` és tancat
 * (cada aresta la fan servir exactament dues cares, en sentits oposats).
 */

interface StepEntity {
  id: number
  type: string
  args: string
  refs: number[]
  nums: number[]
}

const RX_ID = /^\s*#(\d+)\s*=\s*([A-Z_0-9]*)\s*\(([\s\S]*)\)\s*$/

export function readStepEntities(text: string): Map<number, StepEntity> {
  const ds = text.indexOf("DATA;")
  const de = text.indexOf("ENDSEC;", ds)
  const body = text.slice(ds, de)
  const out = new Map<number, StepEntity>()
  for (const rec of body.split(";")) {
    const m = RX_ID.exec(rec)
    if (!m) continue
    const id = Number(m[1])
    const args = m[3]!
    const refs = [...args.matchAll(/#(\d+)/g)].map((r) => Number(r[1]))
    const nums = [...args.replace(/'[^']*'/g, "").matchAll(/-?\d+\.?\d*(?:E[-+]?\d+)?/g)].map((r) => Number(r[0]))
    out.set(id, { id, type: m[2]!, args, refs, nums })
  }
  return out
}

interface StepSolidInfo {
  id: number
  name: string
  min: [number, number, number]
  max: [number, number, number]
  faces: number
  /** Arestes amb un nombre d'usos diferent de 2 o amb els dos usos en el mateix sentit. */
  badEdges: number
  cylinders: number
}

export function stepSolids(text: string): StepSolidInfo[] {
  const ents = readStepEntities(text)
  const names = new Map<number, string>()
  for (const e of ents.values()) {
    if (!e.type.endsWith("SHAPE_REPRESENTATION")) continue
    const nm = /'((?:[^']|'')*)'/.exec(e.args)?.[1] ?? ""
    for (const r of e.refs) if (ents.get(r)?.type === "MANIFOLD_SOLID_BREP") names.set(r, nm)
  }
  const out: StepSolidInfo[] = []
  for (const e of ents.values()) {
    if (e.type !== "MANIFOLD_SOLID_BREP") continue
    const shell = ents.get(e.refs[0]!)
    const faces = shell?.refs ?? []
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    const edgeUse = new Map<number, boolean[]>()
    let cylinders = 0
    for (const f of faces) {
      const face = ents.get(f)!
      const surf = ents.get(face.refs[face.refs.length - 1]!)
      if (surf?.type === "CYLINDRICAL_SURFACE") cylinders += 1
      for (const b of face.refs.slice(0, -1)) {
        const loop = ents.get(ents.get(b)!.refs[0]!)!
        for (const oe of loop.refs) {
          const o = ents.get(oe)!
          const edge = o.refs[0]!
          const flag = o.args.trim().endsWith(".T.")
          const uses = edgeUse.get(edge) ?? []
          uses.push(flag)
          edgeUse.set(edge, uses)
          const ec = ents.get(edge)!
          for (const v of ec.refs.slice(0, 2)) {
            const pt = ents.get(ents.get(v)!.refs[0]!)!
            for (let k = 0; k < 3; k++) {
              min[k] = Math.min(min[k]!, pt.nums[k]!)
              max[k] = Math.max(max[k]!, pt.nums[k]!)
            }
          }
        }
      }
    }
    let badEdges = 0
    for (const uses of edgeUse.values()) if (uses.length !== 2 || uses[0] === uses[1]) badEdges += 1
    out.push({ id: e.id, name: names.get(e.id) ?? "", min, max, faces: faces.length, badEdges, cylinders })
  }
  return out
}
