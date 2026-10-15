import type { LightKit } from "../model"
import type { KitOrderLine } from "./drawerKit"

/**
 * **Pla d'un joc de llum** en una peça (la tapa o un prestatge, per la cara de sota): quantes làmpades, on, si s'hi
 * poden encastar i què cal comprar. Pur: el constructor (`buildModule.buildLights`) fa els forats i les peces visuals
 * amb el que surt d'aquí; la previsualització de Preferències («Com va muntat», peça d'exemple) fa servir el mateix pla.
 *
 * Regles:
 * - **Focus i làmpades planes**: una làmpada cada `spacing` mm al llarg del compartiment (com a mínim una), centrades;
 *   el centre a `setback` del cantell de davant. S'encasten si la peça té prou gruix (`depth` + 5 mm de tauler) i prou
 *   mida (el rebaix + 10 mm a cada costat); si no, **la caixa o la versió de sobreposar** (`surface`) i només el forat
 *   del cable. Si ni el cos de la làmpada no hi cap, cap làmpada i avís.
 * - **Barra**: una sola barra per peça, tallada a la llargada del compartiment menys 10 mm per costat (la tira LED,
 *   al múltiple de `barStep` que hi cap dins del perfil − 5), en una ranura `recess.size` × `depth`; la barra que es
 *   compra és la més curta que hi arriba (si cap no hi arriba, la més llarga i avís). Potència proporcional a la tira.
 */

interface LightParams {
  /** Del cantell de davant de la peça al centre de la làmpada (o al davant de la ranura de la barra). */
  setback: number
  /** Cada quants mm una làmpada. */
  spacing: number
  /** Fondària del rebaix (sense, la del joc). */
  depth: number
}

interface LightPlan {
  /** Centres de les làmpades al llarg del compartiment, des de l'inici de la llum (`span.length` = la llum). */
  xs: number[]
  /** Centre en fondària des del cantell de davant (o el mig de la ranura). */
  z: number
  /** Es fa el rebaix (si no, la làmpada es munta a sobre amb `surface`). */
  recessed: boolean
  depth: number
  /** Per què no s'encasta. */
  reason?: string
  /** Barra: perfil tallat a `cut`, tira a `strip`; l'article que es compra. */
  bar?: { length: number; article: string; cut: number; strip: number; watts: number; short?: boolean }
  /** Potència de totes les làmpades d'aquesta peça (i el pic en encendre). */
  watts: number
  peakWatts: number
  lines: KitOrderLine[]
  warnings: string[]
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function planLights(k: LightKit, p: LightParams, span: { length: number; depth: number }, thickness: number): LightPlan {
  const depth = p.depth > 0 ? p.depth : k.recess.depth
  const warnings: string[] = []
  const lines: KitOrderLine[] = []
  const name = `${k.maker} ${k.series} ${k.colour}`
  if (k.kind === "bar") {
    const cut = Math.floor(span.length - 20)
    const bars = (k.bars ?? []).slice().sort((a, b) => a.length - b.length)
    const fit = bars.find((b) => b.length >= cut) ?? bars[bars.length - 1]
    if (!fit || cut < 100) {
      warnings.push(`${k.series}: el compartiment fa ${r1(span.length)} mm, massa estret per a una barra.`)
      return { xs: [], z: 0, recessed: false, depth, watts: 0, peakWatts: 0, lines, warnings }
    }
    const short = fit.length < cut
    const profile = short ? fit.length : cut
    const step = k.barStep ?? 50
    const strip = Math.max(step, Math.floor((profile - 5) / step) * step)
    const watts = r1((fit.watts * strip) / fit.length)
    if (short) warnings.push(`${k.series}: el compartiment fa ${r1(span.length)} mm i la barra més llarga ${fit.length}: se'n posa una de ${fit.length} centrada.`)
    const canRecess = thickness >= depth + 5
    if (!canRecess) warnings.push(`${k.series}: la peça fa ${r1(thickness)} mm i la ranura ${r1(depth)} de fondària (calen ${r1(depth + 5)}): es munta a sobre, sense ranura.`)
    lines.push({ component: `bar:${fit.article}`, name: `Barra ${name} (${fit.length} mm)`, qty: 1, item: fit.article, cutLength: profile, note: `tira LED a ${strip} mm (cada ${step}); ${watts} W` })
    return { xs: [span.length / 2], z: p.setback + k.recess.size / 2, recessed: canRecess, depth, ...(canRecess ? {} : { reason: "gruix" }), bar: { length: fit.length, article: fit.article, cut: profile, strip, watts, ...(short ? { short: true } : {}) }, watts, peakWatts: watts, lines, warnings }
  }
  const body = k.body.size
  const spacing = p.spacing > 0 ? p.spacing : 400
  const n = Math.max(1, Math.round(span.length / spacing))
  if (span.length < body + 20 || span.depth < body + 20) {
    warnings.push(`${k.series}: la làmpada (Ø${r1(body)}) no cap al compartiment de ${r1(span.length)} × ${r1(span.depth)} mm.`)
    return { xs: [], z: 0, recessed: false, depth, watts: 0, peakWatts: 0, lines, warnings }
  }
  const xs = Array.from({ length: n }, (_, i) => r1((span.length * (i + 0.5)) / n))
  const z = Math.min(Math.max(p.setback, k.recess.size / 2 + 10), span.depth - k.recess.size / 2 - 10)
  let recessed = thickness >= depth + 5 && span.length / n >= k.recess.size + 20
  let reason: string | undefined
  if (!recessed) {
    reason = thickness < depth + 5 ? `la peça fa ${r1(thickness)} mm i el rebaix ${r1(depth)} de fondària (calen ${r1(depth + 5)})` : `no hi cap el rebaix de ${r1(k.recess.size)} amb ${n} làmpades`
    if (k.surface) warnings.push(`${k.series}: ${reason}: es munta a sobre (${k.surface.name}), sense rebaix.`)
    else {
      warnings.push(`${k.series}: ${reason} i no es pot muntar a sobre: cap làmpada.`)
      return { xs: [], z, recessed: false, depth, reason, watts: 0, peakWatts: 0, lines, warnings }
    }
  }
  lines.push({ component: `lamp:${k.article}`, name, qty: n, item: k.article, note: `${r1(k.watts)} W cada una${k.finish ? ` · ${k.finish}` : ""}` })
  if (!recessed && k.surface) lines.push({ component: `box:${k.surface.article}`, name: k.surface.name, qty: n, item: k.surface.article })
  return { xs, z, recessed, depth, ...(reason ? { reason } : {}), watts: r1(n * k.watts), peakWatts: r1(n * Math.max(k.watts, k.peakWatts ?? 0)), lines, warnings }
}

/** Mig cercle per costat: el contorn rodó d'una làmpada (coordenades locals, Ø `d`, centre a (d/2, d/2)). */
export const discOutline = (d: number): [number, number, number][] => [
  [0, d / 2, 1],
  [d, d / 2, 1],
]
