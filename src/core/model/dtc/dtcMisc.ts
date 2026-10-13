import type { HardwareItem } from "../hardware"
import type { GenOp } from "../hardwareOps"

/**
 * La resta del catàleg DTC 2026 com a items de referència («només 3D», motor `model`; alguns amb els **mecanitzats del
 * generador** quan el catàleg els acota): elevables TOP-STAYS, portes corredisses TRACK-PRO i suports de suspensió DM,
 * unions (excèntriques, perns, allotjaments, taps, suports de prestatge, suports de barra, fixacions del fons), la
 * frontissa D i el door opener MS. Els números i les regles de tria són a `tags`; el que la fusta necessita, al
 * `machining` o al `label` del target.
 */

const ref = (id: string, name: string, category: HardwareItem["category"], tags: string[], label: string, extra: Partial<HardwareItem> = {}): HardwareItem => ({
  id,
  name,
  category,
  engine: "model",
  maker: "DTC",
  tags,
  params: {},
  targets: [{ key: "model", label, ops: [] }],
  version: 1,
  builtin: true,
  ...extra,
})

const drill = (id: string, part: GenOp["part"], p: number, q: number, d: number, depth: number, label: string, extra: Partial<GenOp> = {}): GenOp => ({ id, part, kind: "drill", face: "A", p: { from: "ref", at: p }, q: { from: "ref", at: q }, d, depth, label, ...extra })

// --- Elevables TOP-STAYS (pp. 609–678) ---------------------------------------------------------------------------

/**
 * Dels elevables TOP-STAYS només el DQ, que el catàleg acota (cargols euro al lateral i suport del front): SQ, SF, ST, SK
 * i SE no donen les cotes de muntatge en una fitxa llegible i, per decisió de l'usuari (2026-10-13), els items sense
 * mecanitzat no entren a la biblioteca.
 */
export const DTC_LIFTS: HardwareItem[] = [
  {
    ...ref("lift-dtc-dq", "Elevable DTC TOP-STAYS DQ (cable)", "lift", [
      "Porta de fins a 14 kg; moble de 200–480 d'alt; muntatge horitzontal o vertical; tapa blanca (…02A) o grisa (…02B).",
      "Mecanisme per pes (taules per alçada Hp i frontissa euro / plana, p. 676): DQ00AL (lleuger) · DQ00AM (mitjà) · DQ00AH (fort); 1 o 2 mecanismes per porta.",
      "Mecanitzat: mecanisme al lateral amb 4 cargols euro Ø5 × 12 a 38 · 38 (horitzontal: 196 del davant, Yo = 102 / 126 / 136 segons Hp); front: suport amb Ø5 × 13 i Ø10 × 11 a A + 10 del cantell (p. 677).",
      "Catàleg DTC 2026, pp. 673–678",
    ], "Lateral del moble: 4 cargols euro; front: suport del cable (Ø10 × 11)"),
    machining: [
      drill("s1", "side", -196, 38, 5, 12, "Mecanisme: cargol euro (dalt davant)"),
      drill("s2", "side", -234, 38, 5, 12, "Mecanisme: cargol euro (dalt darrere)"),
      drill("s3", "side", -196, 0, 5, 12, "Mecanisme: cargol euro (baix davant)"),
      drill("s4", "side", -234, 0, 5, 12, "Mecanisme: cargol euro (baix darrere)"),
      drill("f1", "front", 0, 0, 10, 11, "Suport del cable: Ø10 × 11"),
      drill("f2", "front", 0, 14, 5, 13, "Suport del cable: Ø5 × 13"),
    ],
  },
]

// --- Unions (pp. 735–744) ------------------------------------------------------------------------------------------

const camOps = (camD: number, camDepth: number, A: number, boltD: number, boltDepth: number, socketD: number, socketDepth: number): GenOp[] => [
  drill("cam", "shelf", 0, A, camD, camDepth, `Excèntrica Ø${camD} × ${camDepth} a la cara, a ${A} del cantell`),
  { id: "bore", part: "shelf", kind: "drill", face: "edge", edge: "qmin", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, d: boltD, depth: boltDepth, label: `Pern: Ø${boltD} × ${boltDepth} al cantell` },
  drill("socket", "side", 0, 0, socketD, socketDepth, `Peça que continua: Ø${socketD} × ${socketDepth} a la cara (pern)`),
]

export const DTC_FITTINGS: HardwareItem[] = [
  { ...ref("cam-dtc-15", "Excèntrica DTC Ø15 + pern M6", "connector", ["Tauler de 15 o més: DT1504 / DT1502 (11,5 de fondària); de 18: 1551 (13,5). Zincat B01 / niquelat A02.", "Perns M6 per distància A (24 · 26 · 29 · 32 · 34): en plàstic 11225–11234 (Ø7 × 10,5) · plàstic autoroscant 11025–11034 · 11125–11134 · acer 4224–4234 · acer autoroscant 4024–4034 · 4124–4134; M10 9224 / 9234; de dos caps 5224 / 5230 / 5234; angular 5424 / 5444; doble angular 5524 / 5544.", "Taps de plàstic SP-01/02/03 (17 × 4,6) i DT-01/02/03 (Ø17 × 1,5).", "Catàleg DTC 2026, pp. 737–739"], "Prestatge: excèntrica a la cara i pern al cantell; peça que continua: forat del pern"), machining: camOps(15, 12.5, 34, 8, 36, 5, 12) },
  { ...ref("cam-dtc-12", "Excèntrica DTC Ø12 + pern M6", "connector", ["Tauler d'11 o més: DT1201 (9,5 de fondària); pern autoroscant 1320 (A = 20) o roscat 1620.", "Catàleg DTC 2026, p. 737"], "Prestatge: excèntrica a la cara i pern al cantell; peça que continua: forat del pern"), machining: camOps(12, 9.5, 20, 8, 25, 5, 11) },
  { ...ref("cam-dtc-10", "Excèntrica DTC Ø10 + pern M6", "connector", ["Tauler de 12 o més: LT1001 (9,5 de fondària); pern 1116 (A = 16).", "Catàleg DTC 2026, p. 737"], "Prestatge: excèntrica a la cara i pern al cantell; peça que continua: forat del pern"), machining: camOps(10, 9.5, 16, 8, 20, 5, 11) },
  { ...ref("cam-dtc-35", "Excèntrica DTC Ø35 (pesant)", "connector", ["Unió pesant: 3531+00135 (zincat) / 3532+00135 (niquelat); excèntrica Ø35 × 17 (9,5 fins a l'eix) i pern M8 amb allotjament Ø8,6.", "Catàleg DTC 2026, p. 741"], "Peça: excèntrica Ø35 × 17 a la cara (centre a 20 del cantell) i pern al cantell"), machining: [drill("cam", "shelf", 0, 20, 35, 17, "Excèntrica Ø35 × 17"), { id: "bore", part: "shelf", kind: "drill", face: "edge", edge: "qmin", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, d: 9, depth: 42, label: "Pern M8: Ø9 al cantell" }, drill("socket", "side", 0, 0, 8, 12, "Allotjament Ø8 × 12 a la cara")] },
  { ...ref("conn-dtc-vb35", "Unió DTC VB35 (Ø20)", "connector", ["Tauler de 15 o més: plàstic VB3500 (blanc) / VB3501 (marró) / VB3502 (marró fosc) o zincat VB3511; cos Ø20 × 12,5 a 9,5 del cantell; pern VB21 (M6 autoroscant, 7,8) o VB02 (11).", "Catàleg DTC 2026, p. 740"], "Prestatge: forat Ø20 × 12,5 a la cara, a 9,5 del cantell; peça que continua: pern Ø5"), machining: [drill("body", "shelf", 0, 9.5, 20, 12.5, "Cos Ø20 × 12,5"), drill("bolt", "side", 0, 0, 5, 12, "Pern autoroscant: Ø5 × 12")] },
  { ...ref("conn-dtc-vb36", "Unió DTC VB36 (Ø20, dos pius)", "connector", ["Tauler de 15 o més: plàstic VB3600 / VB3601 / VB3602 o zincat VB3611; cos Ø20 × 12,5 i dos pius Ø10 a 32 (a 9,5 del cantell); pern M6 VB21 / VB02; allotjaments M6 003 (niló) / H003 (plàstic) / 0110 (niló Ø10 × 10,5); allotjament expansible 001A (llautó) / LT001A (zinc) Ø8 × 12,2.", "Catàleg DTC 2026, pp. 740–742"], "Prestatge: Ø20 × 12,5 i dos Ø10 × 10 a 32; peça que continua: pern"), machining: [drill("body", "shelf", 0, 9.5, 20, 12.5, "Cos Ø20 × 12,5"), drill("pin1", "shelf", -16, 9.5, 10, 10, "Piu Ø10 × 10"), drill("pin2", "shelf", 16, 9.5, 10, 10, "Piu Ø10 × 10"), drill("bolt", "side", 0, 0, 5, 12, "Pern autoroscant: Ø5 × 12")] },
  { ...ref("conn-dtc-2501", "Unió pesant DTC 25 (Ø25)", "connector", ["Unió de zinc Ø25 × 15 amb pern Ø9 × 34 (allotjament Ø9,5 × 13 a la cara de l'altra peça): 2501.", "Catàleg DTC 2026, p. 742"], "Peça: Ø25 × 15 a la cara a 16 del cantell; pern al cantell; peça que continua: Ø9,5 × 13"), machining: [drill("body", "shelf", 0, 16, 25, 15, "Cos Ø25 × 15"), { id: "bore", part: "shelf", kind: "drill", face: "edge", edge: "qmin", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, d: 9, depth: 36, label: "Pern: Ø9 al cantell" }, drill("socket", "side", 0, 0, 9.5, 13, "Allotjament Ø9,5 × 13")] },
  { ...ref("back-dtc-vb10", "Fixació del fons DTC (12 / 20 mm)", "connector", ["Suport del fons al lateral: VB10 (Ø12 × 10, fons a 2,4 de la cara) · VB11 (Ø19,8 / 20,8 × 10, fons de 6) · VB202 (placa 30 × 15 amb cargol, forat Ø10 màx. 5).", "Catàleg DTC 2026, pp. 742–743"], "Lateral: forat Ø12 × 10 (VB10) o Ø20 × 10 (VB11) a la cara de dins, al darrere"), machining: [drill("hole", "side", 0, 0, 12, 10, "VB10: Ø12 × 10")] },
  { ...ref("shelf-dtc-vb3550", "Suport de prestatge DTC VB3550 (Ø20)", "shelf-support", ["Tauler de 16 o més: plàstic VB3550 (blanc) / VB3551 (marró) / VB3552 (negre); cos Ø20 × 12,5 a 9,5 del cantell del prestatge i pern Ø5 al lateral. També VB3560 + VC02 (zincat, Ø18 × 13 a 8 del cantell).", "Catàleg DTC 2026, p. 743"], "Prestatge: Ø20 × 12,5 a 9,5 del cantell (cara de sota); lateral: Ø5 × 12 (filera System 32)"), machining: [drill("body", "shelf", 0, 9.5, 20, 12.5, "Cos Ø20 × 12,5", { face: "B" }), drill("pin", "side", 0, 0, 5, 12, "Pern Ø5 × 12 (filera)")] },
]

/** Suports de prestatge de piu (a la filera System 32) com a items del motor `system32` de l'app. */
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

// --- Frontissa D i door opener (pp. 207–220) ---------------------------------------------------------------------------

export const DTC_D_HINGE: HardwareItem[] = [
  {
    ...ref("hinge-dtc-d", "Frontissa oculta DTC D HINGE (103°)", "hinge", [
      "Frontissa de pivot oculta a la tapa i a la base; porta de 18–32 (pesant: 20–40), fins a 600 d'ample, 2100 d'alt i 25 kg; K 3–6; regulació de costat ±1,8, alçada ±1 i fondària +2 / −0,5.",
      "Lleugera (< 15 kg) TD0ARL · forta (15–25 kg) TD00RL; negre titani A08; suport LK14-RL; tapa de plàstic LK13.",
      "Mecanitzat (p. 215): a la tapa i la base, caixera de 57,5 × 10 R5 a (17 + K) − D del davant i 10 del cantell, 42 de fondària útil (39 + 3); a la porta, caixera en L de 56 × 12,5 i 12 × 35,5 R4, 15,5 de fondària, i un forat Ø4 de 6 a 46 del cantell de dalt.",
      "Catàleg DTC 2026, pp. 211–220",
    ], "Tapa i base: caixera 57,5 × 10 R5; porta: caixera en L 15,5 de fondària (cotes de la fitxa, p. 215–216)"),
    machining: [
      { id: "top", part: "top", kind: "pocket", face: "B", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, w: 57.5, h: 10, r: 5, depth: 42, label: "Caixera 57,5 × 10 R5 a la cara de dins (centre a 10 del cantell)" },
      { id: "door1", part: "front", kind: "pocket", face: "B", p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 }, w: 12.5, h: 56, r: 4, depth: 15.5, label: "Porta: caixera 12,5 × 56 R4 (braç vertical de la L)" },
      { id: "door2", part: "front", kind: "pocket", face: "B", p: { from: "ref", at: 22 }, q: { from: "ref", at: -22 }, w: 35.5, h: 12, r: 4, depth: 15.5, label: "Porta: caixera 35,5 × 12 R4 (braç horitzontal de la L)" },
    ],
  },
  {
    ...ref("push-dtc-door-opener", "Door opener DTC MS (obre la porta sense tirador)", "push", [
      "Braç a la tapa que empeny la porta en prémer-la; moble de fins a 2700 d'alt i 300–600 d'ample; amb frontisses de tancament suau.",
      "MS00AL (2 frontisses) · MS00AM (2–4) · MS00AH (4–6); gris fosc H11; tapa decorativa MSJS01 (gris H30 / blanc H29).",
      "Mecanitzat (p. 207): 2 cargols a la cara de sota de la tapa, a 96 de pas, el primer a 48 (recobrent) / 57 (mig) / 66 (encastat) de la cara de dins del lateral i 10 del davant; a la porta, res (prem contra el cantell).",
      "Catàleg DTC 2026, pp. 207–210",
    ], "Tapa: 2 prebroques Ø2 × 10 a 96 de pas (a 48 del lateral, 10 del davant, recobrent)"),
    machining: [
      { id: "s1", part: "top", kind: "drill", face: "B", p: { from: "ref", at: 48 }, q: { from: "max", at: 10 }, d: 2, depth: 10, label: "Cargol 1 (a 48 del lateral, 10 del davant)" },
      { id: "s2", part: "top", kind: "drill", face: "B", p: { from: "ref", at: 144 }, q: { from: "max", at: 10 }, d: 2, depth: 10, label: "Cargol 2 (a 144 del lateral)" },
    ],
  },
]
