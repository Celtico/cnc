import type { HardwareItem, HardwareTarget } from "../hardware"
import type { StepRule } from "../hardwareOps"

/**
 * **Frontisses de cassoleta DTC** (catàleg DTC 2026, secció «Hinge series», pp. 33–200) com a items del motor `cup` de
 * l'app, amb els números del catàleg: PIVOT-STAR **C81** (Anyway snap-on amb lleva espiral, pp. 41–76), STYLISH **C82**
 * (Anyway snap-on regulable per lleva, pp. 87–113, i slide-on, pp. 121–147) i PIVOT-PRO **C80** (snap-on regulable per
 * lleva, pp. 159–181) i **B80 / B85** (pp. 187–197). Cada item és una geometria de cassoleta (Ø × fondària, K) i un
 * angle; els tres recobriments (recobrent C = 0, mig C = 9, encastat C = 18) i les versions amb molla (A8x / B8x…) o sense
 * (unsprung) només canvien el braç: el número de cada un és a `tags` i al `ref`.
 *
 * **Mecanitzats** (d'on surten): la cassoleta a `cupOffset` = K + Ø/2 del cantell (K = 5 per defecte, «factory
 * setting»; 3–6 segons la fitxa) i els **dos cargols** de la cassoleta a 45 de pas, 9,5 cap a dins del centre (tipus
 * «5» del catàleg; el tipus «7» és 52 / 5,5; les espigues Ø8 / Ø10 són una alternativa), com a prebroques Ø2 × 10 del
 * taller. La **placa** (target `side`, com una importada): 2 cargols euro Ø5 × 12 a 32 de pas a la filera System 32
 * (37 del davant, `plateSetback`), la de dues forats amb cargol euro de cada família (81H02AQA, 82H02AQ, 82H02AZ,
 * 89H02AQ, 96H00AQ); les de quatre forats, de lleva, en línia i de marc són a `dtcPlates.ts`. Les frontisses angulars
 * (30°, 45°, 90°, 135°), les de marc d'alumini (sense cassoleta a la fusta) i la de mirall (encolada) no hi són: l'app
 * no fa portes angulars ni marcs.
 */

const HINGE_COUNT: StepRule = { steps: [{ upTo: 900, n: 2 }, { upTo: 1600, n: 3 }, { upTo: 2100, n: 4 }], else: 5 }

interface DtcHingeSpec {
  id: string
  series: string
  /** «C81», «C82 Anyway», «C82 slide-on», «C80», «B80». */
  family: string
  angle: string
  cup: { d: number; depth: number; K?: number }
  /** Cargols de la cassoleta: pas i distància cap a dins del centre (tipus 5: 45 / 9,5; tipus 7: 52 / 5,5). */
  screws?: { pitch: number; inset: number }
  door: string
  /** Números: recobrent · mig · encastat (tancament suau; a `tags`, la resta). */
  soft: [string, string?, string?]
  sprung?: [string, string?, string?]
  unsprung?: [string, string?, string?]
  /** Placa de dos forats amb cargol euro de la família (id de `dtcPlates.ts` i número). */
  plate: { id: string; item: string }
  pages: string
  note?: string
}

const PILOT = { d: 2, depth: 10 }

function dtcHinge(sp: DtcHingeSpec): HardwareItem {
  const K = sp.cup.K ?? 5
  const sc = sp.screws ?? { pitch: 45, inset: 9.5 }
  const door: HardwareTarget = {
    key: "door",
    label: "Porta",
    ops: [
      { kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" },
      { kind: "drill", face: "A", u: -sc.pitch / 2, v: `cupOffset+${sc.inset}`, d: PILOT.d, depth: PILOT.depth, tag: "hinge-screw" },
      { kind: "drill", face: "A", u: sc.pitch / 2, v: `cupOffset+${sc.inset}`, d: PILOT.d, depth: PILOT.depth, tag: "hinge-screw" },
    ],
  }
  const side: HardwareTarget = {
    key: "side",
    label: `Lateral (placa ${sp.plate.item}: 2 cargols euro a 32)`,
    ops: [
      { kind: "drill", face: "A", u: -16, v: 0, d: 5, depth: 12, tag: "plate" },
      { kind: "drill", face: "A", u: 16, v: 0, d: 5, depth: 12, tag: "plate" },
    ],
  }
  const nums = (label: string, n?: [string, string?, string?]) => (n ? [`${label}: ${n[0]}${n[1] ? ` · mig ${n[1]}` : ""}${n[2] ? ` · encastat ${n[2]}` : ""}`] : [])
  return {
    id: sp.id,
    name: `Frontissa DTC ${sp.series} ${sp.angle} Ø${sp.cup.d}`,
    category: "hinge",
    engine: "cup",
    maker: "DTC",
    ref: sp.soft[0],
    tags: [
      sp.family,
      `Porta de ${sp.door} mm · K ${K} (3–${Math.max(6, K + 1)})`,
      ...nums("Suau (recobrent)", sp.soft),
      ...nums("Amb molla", sp.sprung),
      ...nums("Sense molla (push)", sp.unsprung),
      `Placa: ${sp.plate.item} (H = 0; altres alçades a la placa)`,
      `Catàleg DTC 2026, pp. ${sp.pages}`,
      ...(sp.note ? [sp.note] : []),
    ],
    params: { cupDiameter: sp.cup.d, cupDepth: sp.cup.depth, cupOffset: K + sp.cup.d / 2, endOffset: 100, gap: 10, margin: 3, plateSetback: 37, plateOffset: 0 },
    count: structuredClone(HINGE_COUNT),
    targets: [door, side],
    plate: { id: sp.plate.id, name: `Placa DTC ${sp.plate.item}` },
    version: 1,
    builtin: true,
  }
}

const P81 = { id: "plate-dtc-81h-2", item: "81H02AQA" }
const P82 = { id: "plate-dtc-82h-2", item: "82H02AQ" }
const P82Z = { id: "plate-dtc-82z-2", item: "82H02AZ" }
const P89 = { id: "plate-dtc-89h-2", item: "89H02AQ" }
const P96 = { id: "plate-dtc-96h-2", item: "96H00AQ" }

export const DTC_HINGES: HardwareItem[] = [
  // PIVOT-STAR C81 (Anyway snap-on, lleva espiral, velocitat regulable)
  dtcHinge({ id: "hinge-dtc-c81-110", series: "C81", family: "PIVOT-STAR C81 Anyway snap-on", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C81A876FAB", "C81B876FAB", "C81C876FAB"], sprung: ["C81A876A", "C81B876A", "C81C876A"], unsprung: ["A81A876A", "A81B876A", "A81C876A"], plate: P81, pages: "41–42" }),
  dtcHinge({ id: "hinge-dtc-c81-95", series: "C81", family: "PIVOT-STAR C81 Anyway snap-on, porta gruixuda", angle: "95°", cup: { d: 35, depth: 11.5 }, door: "19–35", soft: ["C81A816FAB", "C81B816FAB", "C81C816FAB"], sprung: ["C81A816A", "C81B816A", "C81C816A"], unsprung: ["A81A816A", "A81B816A", "A81C816A"], plate: P81, pages: "43–44" }),
  dtcHinge({ id: "hinge-dtc-c81-105", series: "C81", family: "PIVOT-STAR C81 Anyway snap-on, porta prima", angle: "105°", cup: { d: 35, depth: 7.8 }, door: "10–20", soft: ["C81A8Q6FAB", "C81B8Q6FAB", "C81C8Q6FAB"], sprung: ["C81A8Q6A", "C81B8Q6A", "C81C8Q6A"], unsprung: ["A81A8Q6A", "A81B8Q6A", "A81C8Q6A"], plate: P81, pages: "45–46" }),
  dtcHinge({ id: "hinge-dtc-c81-160", series: "C81", family: "PIVOT-STAR C81 Anyway snap-on", angle: "160°", cup: { d: 35, depth: 12.4 }, door: "18–28", soft: ["C81A806FAB"], sprung: ["C81A806A"], unsprung: ["A81A806A"], plate: P81, pages: "61–62" }),
  dtcHinge({ id: "hinge-dtc-c81-110-int2", series: "C81", family: "PIVOT-STAR C81, placa integrada de dos forats", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C81A176F", "C81B176F", "C81C176F"], sprung: ["C81A176", "C81B176", "C81C176"], unsprung: ["A81A176", "A81B176", "A81C176"], plate: P81, pages: "65–66", note: "La placa és part de la frontissa (no es compra a part): els dos cargols al lateral, a la filera System 32." }),
  dtcHinge({ id: "hinge-dtc-c81-110-int4", series: "C81", family: "PIVOT-STAR C81, placa integrada de quatre forats", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C81A376F", "C81B376F", "C81C376F"], sprung: ["C81A376", "C81B376", "C81C376"], unsprung: ["A81A376", "A81B376", "A81C376"], plate: P81, pages: "67–68", note: "Placa integrada de quatre forats: a més dels dos de la filera, dos cargols de fusta a 11 del davant (no es fan a la CNC)." }),
  // STYLISH C82 Anyway snap-on (regulable per lleva)
  dtcHinge({ id: "hinge-dtc-c82-110", series: "C82", family: "STYLISH C82 Anyway snap-on, lleva", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C82A676FA", "C82B676FA", "C82C676FA"], sprung: ["C82A676A", "C82B676A", "C82C676A"], unsprung: ["A82A676A", "A82B676A", "A82C676A"], plate: P82, pages: "87–88" }),
  dtcHinge({ id: "hinge-dtc-c82-95", series: "C82", family: "STYLISH C82 Anyway snap-on, porta gruixuda", angle: "95°", cup: { d: 35, depth: 11.5 }, door: "19–35", soft: ["C82A616FA", "C82B616FA", "C82C616FA"], sprung: ["C82A616A", "C82B616A", "C82C616A"], unsprung: ["A82A616A", "A82B616A", "A82C616A"], plate: P82, pages: "89–90" }),
  dtcHinge({ id: "hinge-dtc-c82-125", series: "C82", family: "STYLISH C82 Anyway snap-on, lleva i velocitat", angle: "125°", cup: { d: 35, depth: 11.5 }, door: "16–39", soft: ["C82A686FAB"], sprung: ["C82A686A"], unsprung: ["A82A686A"], plate: P82, pages: "103–106" }),
  dtcHinge({ id: "hinge-dtc-c82-155", series: "C82", family: "STYLISH C82 Anyway snap-on, lleva i velocitat", angle: "155°", cup: { d: 35, depth: 11.5 }, door: "18–28", soft: ["C82A656FAB"], sprung: ["C82A656A"], unsprung: ["A82A656A"], plate: P82, pages: "107–110" }),
  dtcHinge({ id: "hinge-dtc-c82-170", series: "C82", family: "STYLISH C82 Anyway snap-on, lleva", angle: "170°", cup: { d: 35, depth: 10.5 }, door: "16–21", soft: ["C82A606FA"], sprung: ["C82A606A"], unsprung: ["A82A606A"], plate: P82, pages: "111–112" }),
  // STYLISH C82 slide-on
  dtcHinge({ id: "hinge-dtc-c82s-110", series: "C82", family: "STYLISH C82 slide-on", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C82A276F", "C82B276F", "C82C276F"], sprung: ["C82A276", "C82B276", "C82C276"], unsprung: ["A82A276", "A82B276", "A82C276"], plate: P82Z, pages: "121–122" }),
  dtcHinge({ id: "hinge-dtc-c82s-95", series: "C82", family: "STYLISH C82 slide-on, porta gruixuda", angle: "95°", cup: { d: 35, depth: 11.5 }, door: "19–35", soft: ["C82A216F", "C82B216F", "C82C216F"], sprung: ["C82A216", "C82B216", "C82C216"], unsprung: ["A82A216", "A82B216", "A82C216"], plate: P82Z, pages: "123–124" }),
  dtcHinge({ id: "hinge-dtc-c82s-125", series: "C82", family: "STYLISH C82 slide-on, velocitat regulable", angle: "125°", cup: { d: 35, depth: 11.5 }, door: "16–39", soft: ["C82A386FB"], sprung: ["C82A386"], unsprung: ["A82A386"], plate: P82Z, pages: "137–140" }),
  dtcHinge({ id: "hinge-dtc-c82s-155", series: "C82", family: "STYLISH C82 slide-on, velocitat regulable", angle: "155°", cup: { d: 35, depth: 11.5 }, door: "18–28", soft: ["C82A356FB"], sprung: ["C82A356"], unsprung: ["A82A356"], plate: P82Z, pages: "141–144" }),
  dtcHinge({ id: "hinge-dtc-c82s-170", series: "C82", family: "STYLISH C82 slide-on", angle: "170°", cup: { d: 35, depth: 10.5 }, door: "16–21", soft: ["C82A306F"], sprung: ["C82A306"], unsprung: ["A82A306"], plate: P82Z, pages: "145–146" }),
  // PIVOT-PRO C80
  dtcHinge({ id: "hinge-dtc-c80-110", series: "C80", family: "PIVOT-PRO C80 snap-on, lleva", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["C80A676F", "C80B676F", "C80C676F"], sprung: ["C80A676", "C80B676", "C80C676"], unsprung: ["A80A676", "A80B676", "A80C676"], plate: P89, pages: "159–160" }),
  dtcHinge({ id: "hinge-dtc-c80-95", series: "C80", family: "PIVOT-PRO C80 snap-on, porta gruixuda", angle: "95°", cup: { d: 35, depth: 11.5 }, door: "19–35", soft: ["C80A616F", "C80B616F", "C80C616F"], sprung: ["C80A616", "C80B616", "C80C616"], unsprung: ["A80A616", "A80B616", "A80C616"], plate: P89, pages: "171–172" }),
  dtcHinge({ id: "hinge-dtc-c80-155", series: "C80", family: "PIVOT-PRO C80 snap-on, lleva", angle: "155°", cup: { d: 35, depth: 11.5 }, door: "16–24", soft: ["C80A606F"], sprung: ["C80A606"], unsprung: ["A80A606"], plate: P89, pages: "169–170" }),
  dtcHinge({ id: "hinge-dtc-c80-40-95", series: "C80", family: "PIVOT-PRO C80 snap-on, porta gruixuda Ø40", angle: "95°", cup: { d: 40, depth: 13 }, door: "20–40", soft: ["C80A697F", "C80B697F", "C80C697F"], sprung: ["C80A697", "C80B697", "C80C697"], unsprung: ["A80A697", "A80B697", "A80C697"], plate: P89, pages: "173–174", note: "Encastat C = 24." }),
  dtcHinge({ id: "hinge-dtc-c80-26-100", series: "C80", family: "PIVOT-PRO C80 snap-on, cassoleta petita Ø26", angle: "100°", cup: { d: 26, depth: 10 }, screws: { pitch: 45, inset: 9.5 }, door: "12–22", soft: ["C80A6A3F", "C80B6A3F", "C80C6A3F"], sprung: ["C80A6A3", "C80B6A3", "C80C6A3"], unsprung: ["A80A6A3", "A80B6A3", "A80C6A3"], plate: P89, pages: "175–176", note: "Encastat C = 16; K 3–7." }),
  // PIVOT-PRO B80 / B85
  dtcHinge({ id: "hinge-dtc-b80-110", series: "B80", family: "PIVOT-PRO B80 snap-on, lleva", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["B80A676H", "B80B676H", "B80C676H"], sprung: ["B80A676", "B80B676", "B80C676"], plate: P96, pages: "187–188" }),
  dtcHinge({ id: "hinge-dtc-b80-110-int", series: "B80", family: "PIVOT-PRO B80, placa integrada", angle: "110°", cup: { d: 35, depth: 11.5 }, door: "16–26", soft: ["B80A2764H", "B80B2764H", "B80C2764H"], sprung: ["B80A2764", "B80B2764", "B80C2764"], plate: P96, pages: "189–190", note: "La placa és part de la frontissa: els dos cargols al lateral, a la filera System 32." }),
  dtcHinge({ id: "hinge-dtc-b80-95-int", series: "B80", family: "PIVOT-PRO B80, placa integrada, porta gruixuda", angle: "95°", cup: { d: 35, depth: 11.5 }, door: "19–35", soft: ["B80A2164H", "B80B2164H", "B80C2164H"], sprung: ["B80A2164", "B80B2164", "B80C2164"], plate: P96, pages: "191–192", note: "La placa és part de la frontissa." }),
  dtcHinge({ id: "hinge-dtc-b85-100-int", series: "B85", family: "PIVOT-PRO B85, placa integrada", angle: "100°", cup: { d: 35, depth: 10 }, door: "14–24", soft: ["B85A2A64H", "B85B2A64H", "B85C2A64H"], plate: P96, pages: "195–196", note: "La placa és part de la frontissa; K 3–7." }),
]
