/**
 * Lector XML mínim (sense dependències ni DOM): prou per als fitxers de Maestro (.tlgx, .atrx,
 * .cfgx), que són XML de DataContract de .NET. Elements, atributs, text, CDATA, comentaris i
 * instruccions de procés; entitats bàsiques i numèriques. Els noms es guarden sense prefix
 * d'espai de noms (`d3p1:ToolBody` → `ToolBody`); `type` és el valor de `i:type` sense prefix.
 */
export interface XmlNode {
  name: string
  attrs: Record<string, string>
  children: XmlNode[]
  text: string
  /** `i:type` (xsi:type) sense prefix: «FlatDrill», «OneSpindleHeadToolEquipment»… */
  type?: string
}

const ENT: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }

function decode(s: string): string {
  if (!s.includes("&")) return s
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ""
    }
    return ENT[e] ?? m
  })
}

const local = (n: string) => {
  const i = n.indexOf(":")
  return i >= 0 ? n.slice(i + 1) : n
}

/** Llegeix un document XML. Llança `Error` si està mal format. */
export function parseXml(src: string): XmlNode {
  const s = src.charCodeAt(0) === 0xfeff ? src.slice(1) : src
  const root: XmlNode = { name: "#document", attrs: {}, children: [], text: "" }
  const stack: XmlNode[] = [root]
  let i = 0
  const n = s.length
  while (i < n) {
    const lt = s.indexOf("<", i)
    const top = stack[stack.length - 1]!
    if (lt < 0) {
      top.text += decode(s.slice(i))
      break
    }
    if (lt > i) top.text += decode(s.slice(i, lt))
    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt + 4)
      if (end < 0) throw new Error("XML: comentari sense tancar")
      i = end + 3
      continue
    }
    if (s.startsWith("<![CDATA[", lt)) {
      const end = s.indexOf("]]>", lt + 9)
      if (end < 0) throw new Error("XML: CDATA sense tancar")
      top.text += s.slice(lt + 9, end)
      i = end + 3
      continue
    }
    if (s[lt + 1] === "?" || s[lt + 1] === "!") {
      const end = s.indexOf(">", lt)
      if (end < 0) throw new Error("XML: declaració sense tancar")
      i = end + 1
      continue
    }
    const gt = s.indexOf(">", lt)
    if (gt < 0) throw new Error("XML: etiqueta sense tancar")
    if (s[lt + 1] === "/") {
      const name = local(s.slice(lt + 2, gt).trim())
      const open = stack.pop()
      if (!open || open === root || open.name !== name) throw new Error(`XML: </${name}> no tanca cap element obert`)
      i = gt + 1
      continue
    }
    // Etiqueta d'obertura: els valors dels atributs poden contenir «>» entre cometes.
    let j = lt + 1
    let end = gt
    let q = ""
    for (j = lt + 1; j < n; j++) {
      const c = s[j]!
      if (q) {
        if (c === q) q = ""
      } else if (c === '"' || c === "'") q = c
      else if (c === ">") {
        end = j
        break
      }
    }
    const body = s.slice(lt + 1, end)
    const self = body.endsWith("/")
    const inner = self ? body.slice(0, -1) : body
    const m = /^([^\s/>]+)/.exec(inner)
    if (!m) throw new Error("XML: etiqueta sense nom")
    const node: XmlNode = { name: local(m[1]!), attrs: {}, children: [], text: "" }
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g
    let a: RegExpExecArray | null
    const rest = inner.slice(m[1]!.length)
    while ((a = re.exec(rest))) node.attrs[a[1]!] = decode(a[3] ?? a[4] ?? "")
    for (const [k, v] of Object.entries(node.attrs)) if (local(k) === "type" && k.includes(":")) node.type = local(v)
    top.children.push(node)
    if (!self) stack.push(node)
    i = end + 1
  }
  if (stack.length !== 1) throw new Error(`XML: <${stack[stack.length - 1]!.name}> sense tancar`)
  const first = root.children[0]
  if (!first) throw new Error("XML: document buit")
  return first
}

/** Primer fill amb aquest nom. */
export const child = (n: XmlNode | undefined, name: string): XmlNode | undefined => n?.children.find((c) => c.name === name)

/** Tots els fills amb aquest nom. */
export const childrenOf = (n: XmlNode | undefined, name: string): XmlNode[] => (n ? n.children.filter((c) => c.name === name) : [])

/** Seguint un camí de noms de fills: `path(tool, "ToolBody", "ToolDimension", "Diameter")`. */
export function path(n: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let cur = n
  for (const name of names) cur = child(cur, name)
  return cur
}

/** Text (sense espais als extrems) d'un fill, o `undefined`. */
export function textOf(n: XmlNode | undefined, ...names: string[]): string | undefined {
  const t = path(n, ...names)?.text.trim()
  return t === undefined || t === "" ? undefined : t
}

/** Número d'un fill (`undefined` si no n'hi ha o no és un número). */
export function numOf(n: XmlNode | undefined, ...names: string[]): number | undefined {
  const t = textOf(n, ...names)
  if (t === undefined) return undefined
  const v = Number(t.replace(",", "."))
  return Number.isFinite(v) ? v : undefined
}

/** Tots els descendents amb aquest nom (en profunditat, en ordre del document). */
export function descendants(n: XmlNode, name: string, out: XmlNode[] = []): XmlNode[] {
  for (const c of n.children) {
    if (c.name === name) out.push(c)
    descendants(c, name, out)
  }
  return out
}
