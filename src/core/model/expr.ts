/**
 * Avaluador d'expressions curtes dels ferratges (`"cupOffset"`, `"T/2"`, `"H-100"`, `"min(22.5, W/4)"`), **sense
 * `eval`**: un analitzador descendent propi. Admet números (punt decimal), variables (lletres, xifres i `_`), `+ - * /`,
 * menys unari, parèntesis i les funcions `min`, `max`, `abs`, `floor`, `ceil` i `round`. Res més: ni accés a objectes ni
 * crides arbitràries.
 */

export type Expr = number | string

export class ExprError extends Error {}

const FUNCS: Record<string, (...xs: number[]) => number> = {
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
  abs: (x) => Math.abs(x!),
  floor: (x) => Math.floor(x!),
  ceil: (x) => Math.ceil(x!),
  round: (x) => Math.round(x!),
}
const ARITY: Record<string, [number, number]> = { min: [1, 16], max: [1, 16], abs: [1, 1], floor: [1, 1], ceil: [1, 1], round: [1, 1] }

type Tok = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === " " || c === "\t") {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++
      const text = src.slice(i, j)
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new ExprError(`Número mal escrit: «${text}»`)
      out.push({ k: "num", v: Number(text) })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j++
      out.push({ k: "id", v: src.slice(i, j) })
      i = j
      continue
    }
    if ("+-*/(),".includes(c)) {
      out.push({ k: "op", v: c })
      i++
      continue
    }
    throw new ExprError(`Caràcter no admès: «${c}»`)
  }
  return out
}

/** Avalua `e` amb les variables `vars`. Llança `ExprError` si està mal escrita o hi falta una variable. */
export function evalExpr(e: Expr, vars: Readonly<Record<string, number>>): number {
  if (typeof e === "number") return e
  if (e.length > 200) throw new ExprError("Expressió massa llarga")
  const toks = tokenize(e)
  let pos = 0
  const peek = () => toks[pos]
  const isOp = (v: string) => peek()?.k === "op" && peek()!.v === v
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(`Falta «${v}»`)
    pos++
  }
  // expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ; unary := '-' unary | primary
  const expr = (): number => {
    let v = term()
    while (isOp("+") || isOp("-")) {
      const op = toks[pos++]!.v
      const w = term()
      v = op === "+" ? v + w : v - w
    }
    return v
  }
  const term = (): number => {
    let v = unary()
    while (isOp("*") || isOp("/")) {
      const op = toks[pos++]!.v
      const w = unary()
      v = op === "*" ? v * w : v / w
    }
    return v
  }
  const unary = (): number => {
    if (isOp("-")) {
      pos++
      return -unary()
    }
    if (isOp("+")) {
      pos++
      return unary()
    }
    return primary()
  }
  const primary = (): number => {
    const t = peek()
    if (!t) throw new ExprError("Expressió incompleta")
    if (t.k === "num") {
      pos++
      return t.v
    }
    if (t.k === "id") {
      pos++
      if (isOp("(")) {
        const fn = Object.hasOwn(FUNCS, t.v) ? FUNCS[t.v] : undefined
        if (!fn) throw new ExprError(`Funció desconeguda: «${t.v}»`)
        pos++
        const args = [expr()]
        while (isOp(",")) {
          pos++
          args.push(expr())
        }
        expect(")")
        const [lo, hi] = ARITY[t.v]!
        if (args.length < lo || args.length > hi) throw new ExprError(`«${t.v}» amb ${args.length} arguments`)
        return fn(...args)
      }
      if (!Object.hasOwn(vars, t.v)) throw new ExprError(`Variable desconeguda: «${t.v}»`)
      return vars[t.v]!
    }
    if (t.v === "(") {
      pos++
      const v = expr()
      expect(")")
      return v
    }
    throw new ExprError(`No s'esperava «${t.v}»`)
  }
  const v = expr()
  if (pos < toks.length) throw new ExprError(`Sobra «${toks[pos]!.v}»`)
  if (!Number.isFinite(v)) throw new ExprError("El resultat no és un número")
  return v
}

/** Com `evalExpr` però sense llançar: `NaN` si no es pot avaluar. */
export function tryExpr(e: Expr, vars: Readonly<Record<string, number>>): number {
  try {
    return evalExpr(e, vars)
  } catch {
    return Number.NaN
  }
}

/** Error d'una expressió (null si és bona) amb aquestes variables. */
export function exprError(e: Expr, vars: Readonly<Record<string, number>>): string | null {
  try {
    evalExpr(e, vars)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
