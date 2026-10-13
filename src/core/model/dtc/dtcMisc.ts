import type { HardwareItem } from "../hardware"

/**
 * Els **suports de prestatge DTC** (catàleg 2026, p. 743) com a items del motor `system32` de l'app: el piu Ø5 a la
 * filera. La resta de «referència» del catàleg (elevables, portes corredisses, suports DM, unions, frontissa D, door
 * opener, push latch) **no hi és**: per decisió de l'usuari (2026-10-13, «aquestos on posa només 3D i estan buits,
 * treu-los»), a la biblioteca només hi entren ferratges que un motor de l'app col·loca i mecanitza; els items «només
 * 3D» (motor `model`) ni es veuen al muntatge ni els posa cap regla. Les cotes del push latch són a
 * `docs/ferratges-jocs.md`, per al taller.
 */

export const DTC_SUPPORTS: HardwareItem[] = [
  {
    id: "shelf-dtc-ac02",
    name: "Suport de prestatge DTC AC02 (piu Ø5)",
    category: "shelf-support",
    engine: "system32",
    maker: "DTC",
    ref: "AC02",
    tags: ["Suport de zinc niquelat per a prestatge de fusta: piu Ø5 × 8 a la filera System 32 (Ø5 × 12), pala de 10 × 14 × 1,5 (ala de 5).", "Catàleg DTC 2026, p. 743"],
    params: { edgeOffset: 37, pitch: 32, diameter: 5, depth: 12 },
    targets: [{ key: "side", label: "Lateral", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "depth", tag: "system32" }] }],
    version: 1,
    builtin: true,
  },
  {
    id: "shelf-dtc-ag02",
    name: "Suport de prestatge de vidre DTC AG02 (piu Ø5)",
    category: "shelf-support",
    engine: "system32",
    maker: "DTC",
    ref: "AG02",
    tags: ["Suport de zinc niquelat per a prestatge de vidre (grapa de 12 amb goma, Ø4,95 × 8,5): a la filera System 32 (Ø5 × 12).", "Catàleg DTC 2026, p. 743"],
    params: { edgeOffset: 37, pitch: 32, diameter: 5, depth: 12 },
    targets: [{ key: "side", label: "Lateral", ops: [{ kind: "drill", face: "A", u: 0, v: 0, d: "diameter", depth: "depth", tag: "system32" }] }],
    version: 1,
    builtin: true,
  },
]
