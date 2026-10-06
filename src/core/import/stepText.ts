/**
 * Lector de text STEP (ISO 10303-21) per als fitxers CAD dels fabricants de ferratges: només la part de dades, sense
 * esquema. Pur i sense dependències (el 3D per veure'l el fa OpenCascade a `features/`; aquí només es llegeixen les
 * entitats per trobar-hi els cilindres dels forats, `stepGeometry.ts`).
 */

/** Paràmetre d'una entitat: número, text, referència (`#12`), enumeració (`.T.`), llista, tipus amb valor o buit. */
export type StepArg = number | string | StepRef | StepEnum | StepArg[] | StepTyped | null

export interface StepRef {
  ref: number
}
export interface StepEnum {
  enum: string
}
export interface StepTyped {
  type: string
  args: StepArg[]
}

export interface StepEntity {
  id: number
  /** Tipus (en majúscules). Una entitat complexa (`(A() B())`) porta el primer i totes les parts a `parts`. */
  type: string
  args: StepArg[]
  parts?: StepTyped[]
}

export interface StepFile {
  schema: string
  entities: Map<number, StepEntity>
}

export const isRef = (a: StepArg | undefined): a is StepRef => typeof a === "object" && a !== null && "ref" in a
export const isEnum = (a: StepArg | undefined): a is StepEnum => typeof a === "object" && a !== null && "enum" in a

class Reader {
  i = 0
  readonly s: string
  constructor(s: string) {
    this.s = s
  }

  ws(): void {
    const s = this.s
    for (;;) {
      const c = s.charCodeAt(this.i)
      if (c === 32 || c === 9 || c === 10 || c === 13) this.i++
      else if (c === 47 && s.charCodeAt(this.i + 1) === 42) {
        const end = s.indexOf("*/", this.i + 2)
        this.i = end < 0 ? s.length : end + 2
      } else return
    }
  }

  /** Una llista entre parèntesis (el `(` ja és el següent caràcter). */
  list(): StepArg[] {
    this.ws()
    if (this.s[this.i] !== "(") throw new Error(`STEP: s'esperava «(» a ${this.i}`)
    this.i++
    const out: StepArg[] = []
    this.ws()
    if (this.s[this.i] === ")") {
      this.i++
      return out
    }
    for (;;) {
      out.push(this.arg())
      this.ws()
      const c = this.s[this.i]
      if (c === ",") {
        this.i++
        continue
      }
      if (c === ")") {
        this.i++
        return out
      }
      throw new Error(`STEP: caràcter inesperat «${c ?? "fi"}» a ${this.i}`)
    }
  }

  arg(): StepArg {
    this.ws()
    const s = this.s
    const c = s[this.i]
    if (c === "(") return this.list()
    if (c === "'") {
      let out = ""
      this.i++
      for (;;) {
        const j = s.indexOf("'", this.i)
        if (j < 0) throw new Error("STEP: text sense tancar")
        out += s.slice(this.i, j)
        if (s[j + 1] === "'") {
          out += "'"
          this.i = j + 2
          continue
        }
        this.i = j + 1
        return out
      }
    }
    if (c === "#") {
      const m = /^#(\d+)/.exec(s.slice(this.i, this.i + 24))
      if (!m) throw new Error(`STEP: referència dolenta a ${this.i}`)
      this.i += m[0].length
      return { ref: Number(m[1]) }
    }
    if (c === "$" || c === "*") {
      this.i++
      return null
    }
    if (c === ".") {
      const j = s.indexOf(".", this.i + 1)
      const v = s.slice(this.i + 1, j)
      this.i = j + 1
      return { enum: v.toUpperCase() }
    }
    if (c === '"') {
      // Binari (rar): es llegeix com a text.
      const j = s.indexOf('"', this.i + 1)
      const v = s.slice(this.i + 1, j)
      this.i = j + 1
      return v
    }
    const num = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(s.slice(this.i, this.i + 40))
    if (num) {
      this.i += num[0].length
      return Number(num[0])
    }
    const kw = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(this.i, this.i + 120))
    if (kw) {
      this.i += kw[0].length
      return { type: kw[0].toUpperCase(), args: this.list() }
    }
    throw new Error(`STEP: paràmetre inesperat a ${this.i}`)
  }
}

/**
 * Llegeix les entitats de la secció `DATA` (`#12 = TIPUS(…);` i les complexes `#12 = (A(…) B(…));`). Una entitat que
 * no es pot llegir es salta (un fitxer amb una línia rara es llegeix igual). Llança si no és un STEP.
 */
export function parseStep(text: string): StepFile {
  const head = text.slice(0, 4096)
  if (!/ISO-10303-21/.test(head)) throw new Error("No és un fitxer STEP (ISO-10303-21).")
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(head)?.[1] ?? ""
  const start = text.search(/\bDATA\s*;/)
  if (start < 0) throw new Error("El fitxer STEP no té secció DATA.")
  const entities = new Map<number, StepEntity>()
  const re = /#(\d+)\s*=\s*/g
  re.lastIndex = start
  const rd = new Reader(text)
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const id = Number(m[1])
    rd.i = re.lastIndex
    try {
      rd.ws()
      if (text[rd.i] === "(") {
        // Complexa: una llista de tipus sense comes.
        rd.i++
        const parts: StepTyped[] = []
        for (;;) {
          rd.ws()
          if (text[rd.i] === ")") {
            rd.i++
            break
          }
          const t = rd.arg()
          if (typeof t !== "object" || t === null || !("type" in t)) throw new Error("STEP: entitat complexa dolenta")
          parts.push(t)
        }
        if (parts.length) entities.set(id, { id, type: parts[0]!.type, args: parts[0]!.args, parts })
      } else {
        const t = rd.arg()
        if (typeof t === "object" && t !== null && "type" in t) entities.set(id, { id, type: t.type, args: t.args })
      }
      re.lastIndex = Math.max(re.lastIndex, rd.i)
    } catch {
      // Es busca la següent entitat.
      const next = text.indexOf(";", re.lastIndex)
      if (next < 0) break
      re.lastIndex = next + 1
    }
  }
  return { schema, entities }
}

/** La part d'una entitat complexa amb aquest tipus (o la mateixa entitat si és simple i del tipus). */
export function partOf(e: StepEntity | undefined, type: string): StepTyped | undefined {
  if (!e) return undefined
  if (e.parts) return e.parts.find((p) => p.type === type)
  return e.type === type ? { type: e.type, args: e.args } : undefined
}
