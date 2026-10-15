import type { HardwareItem, MachiningOp } from "../hardware"

/**
 * **Plaques de muntatge DTC** (catàleg DTC 2026: C81 p. 69–70, C82 Anyway p. 113–114, C82 slide-on p. 147–148, C80
 * p. 179–182, B80 p. 197–198) com a items del motor `plate`: els forats al lateral de les frontisses, a `setback` (37, la
 * filera System 32) del davant i a `offset` per sobre del centre de la cassoleta. Per CNC compten tres geometries:
 *
 * - **Dos forats** (recta o regulable per lleva): 2 cargols a **32** de pas a la filera. Amb cargol euro (Ø6,4 × 11,
 *   forat Ø5 × 12 = el del System 32), cargol de fusta (E-28C / E-98Q3: prebroca Ø2,5) o espiga Ø10,5 × 11 (003E).
 * - **Quatre forats**: els dos de la filera i dos cargols de fusta més a **11** del davant (prebroca Ø2 × 10).
 * - **En línia** (regulable per lleva): 2 cargols al llarg de la fondària, a **20** i **52** del davant (cotes «32 ·
 *   20»), a l'alçada de la cassoleta.
 *
 * Les alçades H (0 · 2 · 4 · 9 · 18) i els acabats (niquelat A01, negre titani A08) només canvien el número: són a
 * `tags`. Les de marc (snap-on per a marc d'alumini) no mecanitzen fusta i no hi són.
 */

type Kind = "two" | "four" | "inline"

interface PlateSpec {
  id: string
  family: string
  kind: Kind
  /** Números per H (0, 2, 4, 9, 18) del tipus de cargol principal, i la resta de tipus. */
  byH: Record<string, string>
  fixing: string
  others?: string[]
  pages: string
}

const euro = (u: number, v = 0): MachiningOp => ({ kind: "drill", face: "A", u, v, d: 5, depth: 12, tag: "plate" })
const pilot = (u: number, v: number): MachiningOp => ({ kind: "drill", face: "A", u, v, d: 2, depth: 10, tag: "plate-screw" })

function ops(kind: Kind): MachiningOp[] {
  switch (kind) {
    case "two":
      return [euro(-16), euro(16)]
    case "four":
      // v cap al darrere (marc de la placa): els dos cargols de fusta, 26 cap al davant de la filera (a 11 del cantell).
      return [euro(-16), euro(16), pilot(-16, -26), pilot(16, -26)]
    case "inline":
      // Al llarg de la fondària, a 20 i 52 del davant: 17 cap al davant i 15 cap al darrere de la filera.
      return [pilot(0, -17), pilot(0, 15)]
  }
}

const KIND_LABEL: Record<Kind, string> = { two: "dos forats a 32 (filera System 32)", four: "quatre forats: dos a la filera i dos a 11 del davant", inline: "en línia: a 20 i 52 del davant" }

function dtcPlate(sp: PlateSpec): HardwareItem {
  const hs = Object.entries(sp.byH)
  return {
    id: sp.id,
    name: `Placa DTC ${sp.family}, ${sp.kind === "two" ? "dos forats" : sp.kind === "four" ? "quatre forats" : "en línia"}`,
    category: "plate",
    engine: "plate",
    maker: "DTC",
    ref: hs[0]?.[1],
    tags: [KIND_LABEL[sp.kind], `${sp.fixing}: ${hs.map(([h, n]) => `H ${h} ${n}`).join(" · ")}`, ...(sp.others ?? []), `Catàleg DTC 2026, pp. ${sp.pages}`],
    params: { setback: 37, offset: 0 },
    targets: [{ key: "side", label: "Lateral de les frontisses", ops: ops(sp.kind) }],
    version: 1,
    builtin: true,
  }
}

export const DTC_PLATES: HardwareItem[] = [
  dtcPlate({ id: "plate-dtc-81h-2", family: "C81 Anyway", kind: "two", fixing: "Cargol euro", byH: { 0: "81H02AQA", 2: "81H22AQA", 4: "81H42AQA", 9: "81H92AQA", 18: "81H182AQA" }, others: ["Cargol de fusta E-28C: 81H00AQA · 81H20AQA · 81H40AQA · 81H90AQA · 81H180AQA", "Cargol E-98Q3: 81H01AQA · 81H21AQA · 81H41AQA", "Euro premuntat E983: 81H04AQA · 81H24AQA · 81H44AQA", "Regulable per lleva: 81T02TQA · 81T22TQA · 81T42TQA (euro), 81T00TQA… (fusta), 81T0PTQA… (E-28A)"], pages: "69–70" }),
  dtcPlate({ id: "plate-dtc-81h-4", family: "C81 Anyway", kind: "four", fixing: "Cargol de fusta", byH: { 0: "81H00EQA", 2: "81H20EQA", 4: "81H40EQA", 9: "81H90EQA", 18: "81H180EQA" }, pages: "69–70" }),
  dtcPlate({ id: "plate-dtc-81h-inline", family: "C81 Anyway", kind: "inline", fixing: "Cargol de fusta", byH: { 0: "81H00YQA", 2: "81H20YQA", 4: "81H40YQA" }, others: ["Euro: 81H02YQA105 · 81H22YQA105 · 81H42YQA105; espiga: 81H0MYQA · 81H2MYQA · 81H4MYQA"], pages: "69–70" }),
  dtcPlate({ id: "plate-dtc-82h-2", family: "C82 Anyway", kind: "two", fixing: "Cargol euro", byH: { 0: "82H02AQ", 2: "82H22AQ", 4: "82H42AQ", 9: "82H92AQ", 18: "82H182AQ" }, others: ["Cargol de fusta: 82H00AQ · 82H20AQ · 82H40AQ · 82H90AQ · 82H180AQ", "Regulable per lleva: 82T02TQ · 82T22TQ · 82T42TQ (euro), 82T00TQ… (fusta)"], pages: "113–114" }),
  dtcPlate({ id: "plate-dtc-82h-4", family: "C82 Anyway", kind: "four", fixing: "Cargol de fusta", byH: { 0: "82H00EQ", 2: "82H20EQ", 4: "82H40EQ", 9: "82H90EQ", 18: "82H180EQ" }, pages: "113–114" }),
  dtcPlate({ id: "plate-dtc-82h-inline", family: "C82 Anyway", kind: "inline", fixing: "Cargol de fusta", byH: { 0: "82H00YQ", 2: "82H20YQ", 4: "82H40YQ" }, others: ["Euro: 82H02YQ105 · 82H22YQ105 · 82H42YQ105; espiga: 82H0MYQ · 82H2MYQ · 82H4MYQ"], pages: "113–114" }),
  dtcPlate({ id: "plate-dtc-82z-2", family: "C82 slide-on", kind: "two", fixing: "Cargol euro", byH: { 0: "82H02AZ", 2: "82H22AZ", 4: "82H42AZ", 9: "82H92AZ", 18: "82H182AZ" }, others: ["Cargol de fusta: 82H00AZ · 82H20AZ · 82H40AZ · 82H90AZ · 82H180AZ; E-98Q3: 82H01AZ…; euro premuntat: 82H04AZ…; espiga: 82H0MAZ…; E-28A: 82H0PAZ…"], pages: "147–148" }),
  dtcPlate({ id: "plate-dtc-82z-4", family: "C82 slide-on", kind: "four", fixing: "Cargol de fusta", byH: { 0: "82H00EZ", 2: "82H20EZ", 4: "82H40EZ", 9: "82H90EZ", 18: "82H180EZ" }, others: ["E-98Q3: 82H01EZ · 82H21EZ · 82H41EZ"], pages: "147–148" }),
  dtcPlate({ id: "plate-dtc-89h-2", family: "C80", kind: "two", fixing: "Cargol euro", byH: { 0: "89H02AQ", 2: "89H22AQ", 4: "89H42AQ", 9: "89H92AQ", 18: "89H182AQ" }, others: ["Cargol de fusta: 89H00AQ · 89H20AQ · 89H40AQ · 89H90AQ · 89H180AQ; E-98Q3: 89H01AQ…", "Regulable per lleva: 89T02TQ · 89T22TQ · 89T42TQ · 89T92TQ · 89T182TQ (euro), 89T00TQ… (fusta)"], pages: "179–180" }),
  dtcPlate({ id: "plate-dtc-89h-4", family: "C80", kind: "four", fixing: "Cargol de fusta", byH: { 0: "89H00EQ", 2: "89H20EQ", 4: "89H40EQ", 9: "89H90EQ", 18: "89H180EQ" }, pages: "179–180" }),
  dtcPlate({ id: "plate-dtc-89h-inline", family: "C80", kind: "inline", fixing: "Regulable per lleva", byH: { 2: "80T20YQ", 4: "80T40YQ" }, pages: "179–180" }),
  dtcPlate({ id: "plate-dtc-96h-2", family: "B80", kind: "two", fixing: "Cargol de fusta", byH: { 0: "96H00AQ", 2: "96H20AQ", 4: "96H40AQ" }, others: ["Regulable per lleva: 89T00TQ · 89T20TQ · 89T40TQ · 89T90TQ · 89T180TQ"], pages: "197–198" }),
  dtcPlate({ id: "plate-dtc-96h-4", family: "B80", kind: "four", fixing: "Cargol de fusta", byH: { 0: "96H00EQ", 2: "96H20EQ", 4: "96H40EQ" }, pages: "197–198" }),
]
