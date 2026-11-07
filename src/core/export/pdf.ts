/**
 * PDF mínim sense dependències: pàgines de mida qualsevol (en mm), text en Helvetica / Helvetica-Bold (WinAnsi, per als
 * accents del català, «·», «×» i «€») i línies i rectangles. Prou per a etiquetes, plànols i pressupostos.
 * Coordenades en mm amb l'origen a dalt a l'esquerra (com a la pantalla); el PDF les gira per sota.
 */

type PdfFont = "regular" | "bold"

interface TextOp {
  kind: "text"
  x: number
  y: number
  size: number
  text: string
  font: PdfFont
  align: "left" | "center" | "right"
}
interface LineOp {
  kind: "line"
  pts: [number, number][]
  width: number
  close: boolean
  dash?: number
}
interface RectOp {
  kind: "rect"
  x: number
  y: number
  w: number
  h: number
  width: number
  fill: number | null
}
type Op = TextOp | LineOp | RectOp

const PT = 72 / 25.4

/** Amplada mitjana d'un caràcter (en ems): prou per encongir un text que no hi cap. */
const AVG_EM: Record<PdfFont, number> = { regular: 0.52, bold: 0.56 }

/** Amplada aproximada d'un text en mm, amb la mida de lletra en mm. */
function textWidth(text: string, size: number, font: PdfFont = "regular"): number {
  let em = 0
  for (const ch of text) em += /[ .,:;·il1|'!()[\]]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.83 : /[A-Z0-9]/.test(ch) ? 0.66 : AVG_EM[font]
  return em * size
}

/** Mida de lletra (mm) perquè el text càpiga a `maxW`, sense passar de `size`. */
function fitSize(text: string, size: number, maxW: number, font: PdfFont = "regular"): number {
  const w = textWidth(text, size, font)
  return w <= maxW ? size : Math.max(size * 0.4, (size * maxW) / w)
}

export class PdfPage {
  readonly ops: Op[] = []
  readonly w: number
  readonly h: number
  constructor(w: number, h: number) {
    this.w = w
    this.h = h
  }
  text(x: number, y: number, text: string, opts: { size?: number; font?: PdfFont; align?: "left" | "center" | "right"; maxW?: number } = {}): this {
    const font = opts.font ?? "regular"
    const size = opts.maxW ? fitSize(text, opts.size ?? 3.5, opts.maxW, font) : (opts.size ?? 3.5)
    this.ops.push({ kind: "text", x, y, size, text, font, align: opts.align ?? "left" })
    return this
  }
  line(pts: [number, number][], opts: { width?: number; close?: boolean; dash?: number } = {}): this {
    this.ops.push({ kind: "line", pts, width: opts.width ?? 0.2, close: !!opts.close, dash: opts.dash })
    return this
  }
  rect(x: number, y: number, w: number, h: number, opts: { width?: number; fill?: number | null } = {}): this {
    this.ops.push({ kind: "rect", x, y, w, h, width: opts.width ?? 0.2, fill: opts.fill ?? null })
    return this
  }
}

/** Caràcters de WinAnsi fora de Latin-1 (0x80–0x9F). */
const WIN_ANSI: Record<string, number> = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "Œ": 0x8c, "œ": 0x9c }

/** Text → cadena literal del PDF (bytes WinAnsi com a caràcters 0–255). */
function pdfString(text: string): string {
  let out = "("
  for (const ch of text.normalize("NFC")) {
    const c = ch.codePointAt(0)!
    let b: number
    if (WIN_ANSI[ch] !== undefined) b = WIN_ANSI[ch]!
    else if (c === 0x2192) {
      out += "->"
      continue
    } else if (c >= 0x20 && c <= 0x7e) b = c
    else if (c >= 0xa0 && c <= 0xff) b = c
    else if (ch === "ŀ" || ch === "Ŀ") {
      // «ŀ» (l volada): l + punt volat.
      out += ch === "ŀ" ? "l·" : "L·"
      continue
    } else b = 0x3f
    const s = String.fromCharCode(b)
    out += s === "(" || s === ")" || s === "\\" ? "\\" + s : s
  }
  return out + ")"
}

const n = (v: number): string => (Math.round(v * 1000) / 1000).toString()

function pageContent(p: PdfPage): string {
  const Y = (y: number) => n((p.h - y) * PT)
  const X = (x: number) => n(x * PT)
  const out: string[] = []
  for (const op of p.ops) {
    if (op.kind === "text") {
      const w = op.align === "left" ? 0 : textWidth(op.text, op.size, op.font) * (op.align === "center" ? 0.5 : 1)
      out.push(`BT /${op.font === "bold" ? "F2" : "F1"} ${n(op.size * PT)} Tf ${X(op.x - w)} ${Y(op.y)} Td ${pdfString(op.text)} Tj ET`)
    } else if (op.kind === "line") {
      if (op.pts.length < 2) continue
      const path = op.pts.map(([x, y], i) => `${X(x)} ${Y(y)} ${i ? "l" : "m"}`).join(" ")
      out.push(`${n(op.width * PT)} w ${op.dash ? `[${n(op.dash * PT)}] 0 d` : "[] 0 d"} ${path} ${op.close ? "s" : "S"}`)
    } else {
      const r = `${X(op.x)} ${Y(op.y + op.h)} ${n(op.w * PT)} ${n(op.h * PT)} re`
      if (op.fill !== null) out.push(`${n(op.fill)} g ${r} f 0 g`)
      if (op.width > 0) out.push(`${n(op.width * PT)} w [] 0 d ${r} S`)
    }
  }
  return out.join("\n")
}

/** Les pàgines → bytes d'un fitxer PDF 1.4. */
export function pdfBytes(pages: PdfPage[], title = ""): Uint8Array {
  const objs: string[] = []
  // 1 catàleg · 2 pàgines · 3 i 4 lletres · 5 info · després, pàgina i contingut per a cada pàgina.
  const kids = pages.map((_, i) => `${6 + i * 2} 0 R`).join(" ")
  objs.push("<< /Type /Catalog /Pages 2 0 R >>")
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
  objs.push(`<< /Title ${pdfString(title)} /Producer (Mobles CNC) >>`)
  pages.forEach((p, i) => {
    const content = pageContent(p)
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.w * PT)} ${n(p.h * PT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + i * 2} 0 R >>`,
    )
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  let body = "%PDF-1.4\n%âãÏÓ\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const bytes = new Uint8Array(body.length)
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff
  return bytes
}
