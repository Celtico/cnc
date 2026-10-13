import type { HardwareItem } from "./hardware"
import type { GenOp } from "./hardwareOps"

/**
 * **Obertura per pressió DTC (push latch, sèrie MS)**, catàleg DTC 2026, pp. 205–206 («Push latch», secció Hinge
 * series). Són els «Tip-On» del taller: un èmbol amb imant (per a frontisses sense molla) o amb topall (bumper, per a
 * frontisses amb tancament suau) que empeny la porta en prémer-la, i una contraplaca (disc) a la porta. Tres muntatges
 * (lectura de les cotes dels dibuixos «Technical Information»):
 *
 * - **Encastat** (built-in): forat **Ø10 × 72 (mín.)** al cantell de davant d'una peça del cos (tapa, base, prestatge o
 *   lateral), l'èmbol surt 39 (imant) o 40 (topall), regulable −0 / +5; cos de 72 de llarg; «3» de retirada del cantell.
 * - **Placa en línia** (in-line fixing plate): placa de **79 × 14** (15 d'alçada, 9,5 fins a l'eix) cargolada a la cara
 *   de dins, amb **2 cargols a 32** de pas, el primer a **20** del cantell de davant (cotes «32 · 20»); èmbol 39 / 40.
 * - **Placa en creu** (cross fixing plate): placa de **79 × 48**, **2 cargols a 32** a través (un a cada costat de l'eix,
 *   ±16) a **37** del cantell de davant («32 · 37»); èmbol 39 / 40.
 * - Contraplaca a la porta: disc amb **1 cargol**, a 12,5 de la cara de dins del cos (cota «12.5»).
 *
 * Números: MSB01A00 / MSC01A00 (encastat, imant, mitjà / fort), MSB01F00 / MSC01F00 (encastat, topall), MSB01A01 /
 * MSC01A01 (en línia, imant), MSB01F01 / MSC01F01 (en línia, topall), MSB01A02 / MSC01A02 (en creu, imant), MSB01F02 /
 * MSC01F02 (en creu, topall). Colors gris clar (H10) i gris fosc (H11); 200 per caixa.
 *
 * Al model són ferratges **«només 3D» amb mecanitzats del generador** (motor `model`, `machining`): el mòdul no els
 * col·loca sol (l'avís `push` dels fronts sense tirador continua), però hi són a Preferències › Ferratges amb les cotes
 * del catàleg, com a referència per al taller i per al nesting. Els forats de cargol es dibuixen amb la prebroca Ø2 × 10
 * del taller; el de l'encastat, Ø10 × 72 al cantell.
 */

const PILOT = { d: 2, depth: 10 }

const drill = (id: string, part: GenOp["part"], p: number, q: number, extra: Partial<GenOp> = {}): GenOp => ({
  id,
  part,
  kind: "drill",
  face: "A",
  p: { from: "ref", at: p },
  q: { from: "ref", at: q },
  d: PILOT.d,
  depth: PILOT.depth,
  ...extra,
})

/** La contraplaca (disc) a la cara de dins de la porta: un cargol al punt de referència. */
const STRIKE: GenOp = drill("strike", "front", 0, 0, { label: "Contraplaca (1 cargol)" })

/** Placa en línia: dos cargols a 32 de pas al llarg de la fondària, el primer a 20 del cantell de davant. */
const INLINE: GenOp[] = [drill("s1", "side", -20, 0, { label: "Cargol 1 (a 20 del davant)" }), drill("s2", "side", -52, 0, { label: "Cargol 2 (a 52 del davant)" }), STRIKE]

/** Placa en creu: dos cargols a través, a 37 del cantell de davant i a ±16 de l'eix. */
const CROSS: GenOp[] = [drill("s1", "side", -37, 16, { label: "Cargol 1 (a 37 del davant)" }), drill("s2", "side", -37, -16, { label: "Cargol 2 (a 37 del davant)" }), STRIKE]

/** Encastat: forat Ø10 × 72 al cantell de davant de la peça del cos (P = fondària: el cantell de davant és el màxim). */
const BUILT_IN: GenOp[] = [{ id: "bore", part: "side", kind: "drill", face: "edge", edge: "pmax", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, d: 10, depth: 72, label: "Forat Ø10 × 72 al cantell de davant" }, STRIKE]

interface LatchSpec {
  id: string
  name: string
  mount: "builtIn" | "inline" | "cross"
  /** Imant (frontisses sense molla) o topall (frontisses amb tancament suau). */
  kind: "magnet" | "bumper"
  /** Números del catàleg: força mitjana (MSB) i forta (MSC). */
  medium: string
  strong: string
}

function latch(sp: LatchSpec): HardwareItem {
  const stroke = sp.kind === "magnet" ? 39 : 40
  const ops = sp.mount === "builtIn" ? BUILT_IN : sp.mount === "inline" ? INLINE : CROSS
  const how = sp.mount === "builtIn" ? "encastat (Ø10 × 72 al cantell)" : sp.mount === "inline" ? "placa en línia (2 cargols a 32, a 20 del davant)" : "placa en creu (2 cargols a 32, a 37 del davant)"
  const hinge = sp.kind === "magnet" ? "frontisses sense molla" : "frontisses amb tancament suau"
  return {
    id: sp.id,
    name: sp.name,
    category: "push",
    engine: "model",
    maker: "DTC",
    ref: `${sp.medium} (mitjà) · ${sp.strong} (fort)`,
    tags: [`Èmbol de ${stroke} mm (−0 / +5)`, how, `per a ${hinge}`, "gris clar H10 · gris fosc H11"],
    params: { stroke, length: sp.mount === "builtIn" ? 72 : 79 },
    targets: [{ key: "model", label: "Es col·loca a mà (cotes del catàleg DTC 2026, pp. 205–206)", ops: [] }],
    version: 1,
    builtin: true,
    machining: ops.map((o) => ({ ...o })),
  }
}

/** Els push latch DTC MS: un item per muntatge i tipus (el número mitjà i el fort al `ref`). */
export const DTC_PUSH_LATCHES: HardwareItem[] = [
  latch({ id: "push-dtc-ms-builtin-magnet", name: "Push DTC MS encastat Ø10, imant", mount: "builtIn", kind: "magnet", medium: "MSB01A00", strong: "MSC01A00" }),
  latch({ id: "push-dtc-ms-builtin-bumper", name: "Push DTC MS encastat Ø10, topall", mount: "builtIn", kind: "bumper", medium: "MSB01F00", strong: "MSC01F00" }),
  latch({ id: "push-dtc-ms-inline-magnet", name: "Push DTC MS placa en línia, imant", mount: "inline", kind: "magnet", medium: "MSB01A01", strong: "MSC01A01" }),
  latch({ id: "push-dtc-ms-inline-bumper", name: "Push DTC MS placa en línia, topall", mount: "inline", kind: "bumper", medium: "MSB01F01", strong: "MSC01F01" }),
  latch({ id: "push-dtc-ms-cross-magnet", name: "Push DTC MS placa en creu, imant", mount: "cross", kind: "magnet", medium: "MSB01A02", strong: "MSC01A02" }),
  latch({ id: "push-dtc-ms-cross-bumper", name: "Push DTC MS placa en creu, topall", mount: "cross", kind: "bumper", medium: "MSB01F02", strong: "MSC01F02" }),
]
