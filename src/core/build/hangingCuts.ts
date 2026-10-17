import type { Panel, RefObject } from "../model"
import { toLocal, toWorld } from "./geometry"
import type { LinearPiece } from "./linearOrders"
import { refTouchesBox } from "./refCuts"
import type { BuildWarning } from "./buildModule"

/** Un avís d'un penjador, amb el número del mòdul (la composició hi posa el seu id). */
type HangingWarning = BuildWarning & { moduleIndex: number }

type Box = { min: [number, number, number]; max: [number, number, number] }

/** Trossos de regleta més curts que això no es posen (no hi caben dos clips). */
const MIN_RAIL = 80

/**
 * Els **penjadors i la regleta de paret** d'un mòdul penjat davant d'un objecte que talla (una columna de la casa; per
 * decisió de l'usuari, 2026-10-17: «no detecta el tall de la columna»). Els talls (`applyRefCuts`) només fan les peces de
 * fusta; el ferratge, després:
 * - la **regleta** es parteix i deixa lliure el tros de la columna (amb la seva comanda per metres: un tros per banda; un
 *   tros de menys de 80 mm no es posa);
 * - un **penjador** que hi topa no es dibuixa i s'avisa (la cantonada on va és retallada: s'ha de penjar d'una altra
 *   manera). Els seus forats ja els treu el tall del lateral.
 * Modifica `extras` i `linear` (els de la composició, ja col·locats) i torna els avisos i els penjadors que no es fan (per
 * treure'ls de la comanda).
 */
export function clipHangingToRefs(extras: Panel[], linear: LinearPiece[], refs: RefObject[], boxOf: (p: Panel) => Box): { warnings: HangingWarning[]; removed: { module: number; name: string }[] } {
  const cuts = refs.filter((o) => o.effect === "cut")
  const warnings: HangingWarning[] = []
  const removed: { module: number; name: string }[] = []
  if (!cuts.length) return { warnings, removed }
  for (let i = extras.length - 1; i >= 0; i--) {
    const p = extras[i]!
    if (p.role !== "hardware") continue
    const local = p.id.slice(p.id.indexOf(":") + 1)
    const hits = cuts.filter((o) => refTouchesBox(o, boxOf(p)))
    if (!hits.length) continue
    if (local === "wall-rail") {
      const pieces = splitRail(p, hits)
      extras.splice(i, 1, ...pieces)
      relinear(linear, p, pieces)
      continue
    }
    const hanger = /^hanger-(left|right)$/.exec(local)
    if (hanger) {
      extras.splice(i, 1)
      removed.push({ module: p.module ?? 0, name: p.label.replace(/ \((esquerre|dret)\)$/, "") })
      const hook = extras.findIndex((x) => x.id === `${p.id}-hook`)
      if (hook >= 0) extras.splice(hook, 1)
      const side = hanger[1] === "left" ? "esquerre" : "dret"
      warnings.push({
        code: "hanging",
        moduleIndex: p.module ?? 0,
        panelId: `side-${hanger[1]}`,
        message: `«${hits[0]!.name}» ocupa la cantonada del darrere ${hanger[1] === "left" ? "esquerra" : "dreta"} del mòdul, on va el penjador ${side}: el lateral hi queda retallat i el penjador no hi cap. Aquell penjador no es fa ni es demana.`,
        options: [
          { text: `Penjar el costat ${side} amb un escaire de penjar (o una placa) collat a la cara de la columna, sota la tapa: es posa a mà.` },
          { text: "Moure el mòdul perquè la columna no arribi al lateral.", where: "position" },
          { text: "Fer el mòdul més estret, fins a la columna: el lateral queda davant de la columna i el penjador hi torna a cabre.", where: "dims" },
        ],
      })
    }
  }
  // El ganxo d'un penjador que es queda pot topar sol amb la columna (és més llarg): també fora.
  for (let i = extras.length - 1; i >= 0; i--) {
    const p = extras[i]!
    if (p.role === "hardware" && /:hanger-(left|right)-hook$/.test(p.id) && cuts.some((o) => refTouchesBox(o, boxOf(p)))) extras.splice(i, 1)
  }
  return { warnings, removed }
}

/** La regleta (una caixa al llarg del seu eix local u) partida pels objectes: els trossos que queden fora. */
function splitRail(p: Panel, hits: RefObject[]): Panel[] {
  const blocked: [number, number][] = hits.map((o) => {
    const us = [o.x, o.x + o.w].flatMap((x) => [o.y, o.y + o.h].flatMap((y) => [o.z, o.z + o.d].map((z) => toLocal(p, [x, y, z])[0])))
    return [Math.max(0, Math.min(...us)), Math.min(p.length, Math.max(...us))]
  })
  blocked.sort((a, b) => a[0] - b[0])
  const out: Panel[] = []
  let u = 0
  const push = (u0: number, u1: number) => {
    if (u1 - u0 < MIN_RAIL) return
    out.push({ ...p, id: `${p.id}-${out.length + 1}`, length: Math.round((u1 - u0) * 10) / 10, placement: { ...p.placement, origin: toWorld(p, [u0, 0, 0]) } })
  }
  for (const [a, b] of blocked) {
    if (a > u) push(u, a)
    u = Math.max(u, b)
  }
  if (u < p.length) push(u, p.length)
  return out
}

/** La comanda per metres de la regleta d'aquell mòdul: els trossos que queden (a la composició, al llarg de X). */
function relinear(linear: LinearPiece[], rail: Panel, pieces: Panel[]): void {
  const k = linear.findIndex((l) => l.module === rail.module && !!l.run && Math.abs(l.length - rail.length) < 0.5)
  if (k < 0) return
  const old = linear[k]!
  const alongX = Math.abs(rail.placement.xAxis[0]) > 0.99
  linear.splice(
    k,
    1,
    ...pieces.map((q) => {
      const x0 = Math.min(q.placement.origin[0], q.placement.origin[0] + q.length * q.placement.xAxis[0])
      const { run: _run, ...rest } = old
      return alongX ? { ...rest, length: q.length, run: { ...old.run!, x0, x1: x0 + q.length } } : { ...rest, length: q.length }
    }),
  )
}
