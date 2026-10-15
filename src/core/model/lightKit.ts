import { z } from "zod"

/**
 * **Joc de llum** (`LightKit`, `docs/ferratges-jocs.md` §Llums): una làmpada LED de 24 V del catàleg del fabricant (la
 * primera família, les Häfele Loox) amb el **mecanitzat per encastar-la** a la peça de sobre del compartiment (la tapa o
 * el prestatge: forat rodó Ø55/Ø60, rebaix Ø180 o 205 × 205, ranura del perfil de la barra) i el **forat passant del
 * cable**, més el que cal per **connectar-la a la xarxa**: l'alimentador de 24 V per la potència, el distribuïdor si hi ha
 * més de sis làmpades, l'interruptor (sensor de porta, amb el seu forat, o de proximitat) i el cable. Tot llegit del
 * catàleg en PDF (`docs/blaetterkatalog.pdf`, capítol 2, pàgines «FF 2.x»), no d'un STEP.
 *
 * El joc viu dins d'un `HardwareItem` amb motor `ledProfile` (`HardwareItem.light`): es tria a l'accessori **Llum** del
 * compartiment (o com a llum del mòdul, «Com el mòdul») pel mateix `HardwarePick` que el perfil de tira LED de l'app, i
 * entra a la biblioteca, a les còpies dels mobles i al `.moble` sense cap camí nou. Pur: sense React ni three.
 */

const mm = z.number().finite()

export const LIGHT_KINDS = [
  { id: "spot", label: "Focus rodó per encastar" },
  { id: "panel", label: "Làmpada plana per encastar" },
  { id: "bar", label: "Barra LED per encastar" },
] as const
type LightKind = (typeof LIGHT_KINDS)[number]["id"]
const KIND_IDS = LIGHT_KINDS.map((k) => k.id) as [LightKind, ...LightKind[]]

/** Una llargada de barra que es ven (es talla cada `barStep`). */
const LightBarSchema = z.object({ length: mm.positive(), article: z.string().min(1), watts: mm.positive() })

export const LightKitSchema = z.object({
  maker: z.string().min(1),
  /** «Loox LED 3038». */
  series: z.string().min(1),
  kind: z.enum(KIND_IDS),
  /** Número d'article de la làmpada (el color de llum i l'acabat triats); a la barra, el de cada llargada (`bars`). */
  article: z.string().min(1),
  colour: z.string().min(1),
  finish: z.string().optional(),
  /** Potència (W) d'una làmpada; a la barra, de cada llargada (`bars`). */
  watts: mm.positive(),
  /** Pic en encendre (la 3010 puja a 5 W uns instants): compta per triar l'alimentador. */
  peakWatts: mm.positive().optional(),
  lumens: mm.positive().optional(),
  /**
   * El que es mecanitza a la peça de sobre: `round` = forat Ø `size` × `depth` (amb fresa si no hi ha broca del Ø),
   * `square` = rebaix de `size` × `size` × `depth`, `groove` = ranura de `size` d'ample × `depth` al llarg del compartiment.
   */
  recess: z.object({ shape: z.enum(["round", "square", "groove"]), size: mm.positive(), depth: mm.positive() }),
  /** El cos de la làmpada que es veu (Ø o costat; a la barra, l'amplada del perfil) i la seva alçada. */
  body: z.object({ size: mm.positive(), height: mm.positive() }),
  /** Forat passant Ø per al cable, al mig (a la barra, a un extrem). */
  cableHole: mm.positive(),
  /** Si no s'hi pot encastar (tauler massa prim, no hi cap): la caixa o la versió de sobreposar, sense rebaix. */
  surface: z.object({ article: z.string().min(1), name: z.string().min(1), height: mm.positive() }).optional(),
  /** Barra: les llargades que es venen i cada quant es pot tallar. */
  bars: z.array(LightBarSchema).min(1).optional(),
  barStep: mm.positive().optional(),
  /** Cable de la làmpada (mm): per saber si arriba a l'alimentador. */
  cableLength: mm.positive().optional(),
  source: z.string(),
  hypotheses: z.array(z.string()),
})
export type LightKit = z.infer<typeof LightKitSchema>

/** El sistema elèctric d'un fabricant (alimentadors, distribuïdor, interruptors, cables): el mateix per a totes les seves làmpades. */
export interface LightSystem {
  maker: string
  name: string
  /** Alimentadors amb el cable de xarxa del país: el més petit que arriba a la potència de totes les làmpades del mòdul. */
  drivers: { watts: number; article: string; name: string; /** Ranures per a làmpades (l'interruptor en té una a part). */ slots: number; /** Potència màxima per ranura (sense, `watts`). */ perSlot?: number; size: string }[]
  /** Distribuïdor: ocupa una ranura de l'alimentador i en dona `ways`. */
  distributor: { article: string; name: string; ways: number }
  /** Interruptor sensor de porta: forat Ø `bore` × `depth` al cantell de davant d'un lateral (porta tancada = llum apagada). */
  doorSwitch: { article: string; name: string; bore: number; depth: number }
  /** Interruptor de proximitat per cargolar (sense mecanitzat). */
  touchSwitch: { article: string; name: string; size: string }
  /** El cable de l'interruptor modular (2 m). */
  switchCable: { article: string; name: string }
  /** Cables d'extensió de 24 V, per si l'alimentador és lluny. */
  extensions: { length: number; article: string }[]
  /** Per amagar el cable que queda a la vista dins del moble (es tallen a mida, sense mecanitzat). */
  cableCover?: { article: string; name: string; length: number }
  /** Màxim de cable entre l'alimentador i una làmpada o l'interruptor (mm). */
  maxCable: number
  source: string
  notes: string[]
}
