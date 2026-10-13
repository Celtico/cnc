import type { HardwareItem } from "../hardware"
import type { LightKit, LightSystem } from "../lightKit"

/**
 * **Häfele Loox, LED de 24 V** (catàleg general Häfele, `docs/blaetterkatalog.pdf`, capítol 2 «LED 24 V» i «Accesorios
 * LED»; les pàgines són les del catàleg, «FF 2.x»): les làmpades que es poden **encastar** amb un mecanitzat de l'app i
 * el sistema per connectar-les a la xarxa.
 *
 * - **Loox LED 3038** (p. 2.69): focus rodó d'acer de 12 × Ø65, 24 LED, **forat Ø55**, 3 W; 3000 K 833.75.120 (plata;
 *   cromat .140, inox .150) i 4000 K 833.75.121; caixa per muntar sota el prestatge 833.72.803 (plata).
 * - **Loox LED 3010** (p. 2.65): focus d'alumini amb vidre mat canviable, **forat Ø60**, 3,25 W (**5 W en encendre**);
 *   3000 K 833.75.040, 4000 K .041, 6000 K .042; caixa rodona Ø65 × 15 833.77.730 (rectilínia 200 × 15,8 833.77.731).
 * - **Loox LED 3001** (p. 2.68): focus IP20 d'alumini, **forat Ø55**, 1,7 W; 3000 K plata 833.75.016 (negre .017),
 *   5000 K .006; caixa 833.77.710 (plata).
 * - **Loox LED 3022 / 3023** (p. 2.66): làmpada rodona plana de 6,2 × Ø185 per encaixar en un **forat Ø180**, 4,8 W;
 *   3000 K 833.75.100, 4000 K .101; la 3023 (Ø180 × 6,2, per cargolar, 833.77.130 / .131) és la de sobreposar.
 * - **Loox LED 3024 / 3025** (p. 2.67): làmpada quadrada plana de 210 × 210 × 6,2, **fresat de 205 × 205**, 5,8 W;
 *   3000 K 833.75.090, 4000 K .091; la 3025 (205 × 205, per cargolar, 833.77.120 / .121) és la de sobreposar.
 * - **LED 1088** (p. 2.70): barra d'alumini per encastar a pressió i encolar, tira tallable cada 50 mm (llargada de la
 *   tira = perfil − 5), un sol cop divisible; 1000 / 1500 / 2000 a 18,3 / 27,9 / 37,4 W; 3200 K 833.03.100 / .101 /
 *   .102, 4200 K 833.03.111 / .112 / .113. Cable de 2 × 2 m i 4 tapes.
 *
 * **Sistema** (pp. 2.103, 2.109–2.110, 2.120–2.123): alimentadors de 24 V de 20 / 40 / 90 W amb el cable de xarxa
 * europeu (833.77.951 / .952 / .953; 6 ranures per a làmpades i una per a l'interruptor; el de 15 W, 833.77.936, no té
 * ranura d'interruptor i no s'hi posa), distribuïdor de 6 vies 833.77.724 (2 m), cables d'extensió 833.77.712 / .713 /
 * .714 (0,5 / 1 / 2 m; màx. 6 m de l'alimentador a la làmpada), interruptor sensor de porta modular 833.89.128
 * (Ø12 × 46; porta oberta = llum encesa), interruptor de proximitat 833.89.136 (40 × 40 × 8,5, per cargolar) i el cable
 * de l'interruptor modular 833.89.142 (2 m).
 *
 * Les fondàries dels rebaixos són **hipòtesis** (el catàleg dona el Ø del forat i l'alçada de la làmpada, no la
 * fondària; els dibuixos de la 3038 i la 3010 mostren la làmpada enrasada amb una vora de 0,8): la 3038 fa 12 d'alt,
 * la 3010 i la 3001 es prenen de 13 i 12; les planes 6,2 → 6,5; la barra, 16 × 11 com el perfil de muntatge Loox de
 * 11 mm (p. 2.127). Cal confirmar-les amb la làmpada a la mà.
 */

export const HAFELE_LOOX_SYSTEM: LightSystem = {
  maker: "Häfele",
  name: "Häfele Loox 24 V",
  drivers: [
    { watts: 20, article: "833.77.951", name: "Alimentador Loox 24 V, 20 W, amb cable de xarxa EU", slots: 6, size: "140 × 50 × 16" },
    { watts: 40, article: "833.77.952", name: "Alimentador Loox 24 V, 40 W, amb cable de xarxa EU", slots: 6, size: "190 × 60 × 16" },
    { watts: 90, article: "833.77.953", name: "Alimentador Loox 24 V, 90 W, amb cable de xarxa EU", slots: 6, perSlot: 84, size: "316 × 70 × 16" },
  ],
  distributor: { article: "833.77.724", name: "Distribuïdor de 6 vies Loox 24 V (cable de 2 m)", ways: 6 },
  doorSwitch: { article: "833.89.128", name: "Interruptor sensor de porta modular Loox (Ø12 × 46)", bore: 12, depth: 47 },
  touchSwitch: { article: "833.89.136", name: "Interruptor de proximitat modular Loox (40 × 40 × 8,5, per cargolar)", size: "40 × 40 × 8,5" },
  switchCable: { article: "833.89.142", name: "Cable de l'interruptor modular Loox (2 m)" },
  extensions: [
    { length: 500, article: "833.77.712" },
    { length: 1000, article: "833.77.713" },
    { length: 2000, article: "833.77.714" },
  ],
  maxCable: 6000,
  source: "Catàleg Häfele, pp. 2.103 (alimentadors), 2.109–2.110 (cables i distribuïdors), 2.120–2.123 (interruptors)",
  notes: [
    "Abans de connectar a la xarxa, tots els components han d'estar connectats a l'alimentador.",
    "Màxim 6 m de cable entre l'alimentador i una làmpada o l'interruptor; 50 mm lliures al voltant de l'alimentador i un registre per arribar-hi.",
  ],
}

interface LampSpec {
  id: string
  name: string
  kit: LightKit
  /** Paràmetres editables: del davant del prestatge al centre, cada quant una làmpada, fondària del rebaix. */
  setback: number
  spacing: number
}

function lamp(sp: LampSpec): HardwareItem {
  const k = sp.kit
  // Els `targets` només descriuen el mecanitzat (l'editor de Preferències): el fa el joc (`buildLights`), no `applyHardware`.
  const ops = [
    ...(k.recess.shape === "round" ? [{ kind: "drill" as const, face: "B" as const, u: 0, v: 0, d: k.recess.size, depth: "depth", tag: "light" }] : []),
    { kind: "through" as const, u: 0, v: 0, d: k.cableHole, tag: "cable" },
  ]
  return {
    id: sp.id,
    name: sp.name,
    category: "light",
    engine: "ledProfile",
    maker: k.maker,
    ref: k.article,
    tags: [k.source],
    params: { width: k.body.size, height: k.body.height, setback: sp.setback, spacing: sp.spacing, depth: k.recess.depth },
    targets: [{ key: "shelf", label: k.recess.shape === "round" ? "Prestatge o tapa (cara de sota): forat de la làmpada i forat passant del cable" : `Prestatge o tapa (cara de sota): ${k.recess.shape === "square" ? `rebaix de ${k.recess.size} × ${k.recess.size}` : `ranura de ${k.recess.size}`} × ${k.recess.depth} i forat passant del cable`, ops }],
    version: 1,
    builtin: true,
    light: structuredClone(k),
  }
}

const SPOT_HYP = (series: string, depth: number) => [`Fondària del forat de la ${series}: ${depth} mm (el catàleg dona el Ø del forat i l'alçada de la làmpada; el dibuix la mostra enrasada amb una vora de 0,8).`, "Forat del cable Ø8 al mig del forat de la làmpada (el «Ø8» del dibuix de muntatge)."]

const LOOX_3038 = (colour: string, article: string): LightKit => ({
  maker: "Häfele",
  series: "Loox LED 3038",
  kind: "spot",
  article,
  colour,
  finish: "Color plata",
  watts: 3,
  lumens: colour.includes("3000") ? 215 : 225,
  recess: { shape: "round", size: 55, depth: 12 },
  body: { size: 65, height: 12 },
  cableHole: 8,
  surface: { article: "833.72.803", name: "Caixa per muntar sota el prestatge, rodona, plata (Loox 3038)", height: 13 },
  cableLength: 2000,
  source: "Catàleg Häfele, p. 2.69",
  hypotheses: SPOT_HYP("3038", 12),
})

const LOOX_3010 = (colour: string, article: string): LightKit => ({
  maker: "Häfele",
  series: "Loox LED 3010",
  kind: "spot",
  article,
  colour,
  finish: "Plata anoditzat",
  watts: 3.25,
  peakWatts: 5,
  lumens: colour.includes("3000") ? 250 : 267,
  recess: { shape: "round", size: 60, depth: 13 },
  body: { size: 65, height: 13 },
  cableHole: 8,
  surface: { article: "833.77.730", name: "Caixa per muntar sota el prestatge, rodona Ø65 × 15 (Loox 3010)", height: 15 },
  cableLength: 2000,
  source: "Catàleg Häfele, p. 2.65",
  hypotheses: [...SPOT_HYP("3010", 13), "En encendre, cada 3010 puja a 5 W uns instants: l'alimentador es tria amb 5 W per làmpada (nota del catàleg)."],
})

const LOOX_3001: LightKit = {
  maker: "Häfele",
  series: "Loox LED 3001",
  kind: "spot",
  article: "833.75.016",
  colour: "Blanc càlid 3000 K",
  finish: "Plata anoditzat",
  watts: 1.7,
  lumens: 140,
  recess: { shape: "round", size: 55, depth: 12 },
  body: { size: 65, height: 12 },
  cableHole: 8,
  surface: { article: "833.77.710", name: "Caixa per muntar sota el prestatge, plata (Loox 3001)", height: 13 },
  cableLength: 2500,
  source: "Catàleg Häfele, p. 2.68",
  hypotheses: SPOT_HYP("3001", 12),
}

const LOOX_3022 = (colour: string, article: string, surface: string): LightKit => ({
  maker: "Häfele",
  series: "Loox LED 3022",
  kind: "panel",
  article,
  colour,
  finish: "Color plata",
  watts: 4.8,
  lumens: colour.includes("3000") ? 362 : 408,
  recess: { shape: "round", size: 180, depth: 6.5 },
  body: { size: 185, height: 6.2 },
  cableHole: 8,
  surface: { article: surface, name: "Loox LED 3023, la mateixa làmpada per cargolar sota el prestatge (Ø180 × 6,2)", height: 6.2 },
  cableLength: 2000,
  source: "Catàleg Häfele, p. 2.66",
  hypotheses: ["Fondària del rebaix Ø180: 6,5 mm (la làmpada fa 6,2 d'alt i s'encaixa enrasada).", "Forat del cable Ø8 al mig (no és al catàleg: el mateix dels focus)."],
})

const LOOX_3024 = (colour: string, article: string, surface: string): LightKit => ({
  maker: "Häfele",
  series: "Loox LED 3024",
  kind: "panel",
  article,
  colour,
  finish: "Color plata",
  watts: 5.8,
  lumens: colour.includes("3000") ? 430 : 530,
  recess: { shape: "square", size: 205, depth: 6.5 },
  body: { size: 210, height: 6.2 },
  cableHole: 8,
  surface: { article: surface, name: "Loox LED 3025, la mateixa làmpada per cargolar sota el prestatge (205 × 205 × 6,2)", height: 6.2 },
  cableLength: 2000,
  source: "Catàleg Häfele, p. 2.67",
  hypotheses: ["Fondària del fresat de 205 × 205: 6,5 mm (la làmpada fa 6,2 d'alt i s'encaixa enrasada).", "Forat del cable Ø8 al mig (no és al catàleg: el mateix dels focus)."],
})

const LOOX_1088 = (colour: string, articles: [string, string, string]): LightKit => ({
  maker: "Häfele",
  series: "LED 1088",
  kind: "bar",
  article: articles[0],
  colour,
  finish: "Color plata",
  watts: 18.3,
  recess: { shape: "groove", size: 16, depth: 11 },
  body: { size: 16, height: 11 },
  cableHole: 8,
  bars: [
    { length: 1000, article: articles[0], watts: 18.3 },
    { length: 1500, article: articles[1], watts: 27.9 },
    { length: 2000, article: articles[2], watts: 37.4 },
  ],
  barStep: 50,
  cableLength: 2000,
  source: "Catàleg Häfele, p. 2.70 (barra), 2.127 (perfil de muntatge d'11 mm)",
  hypotheses: [
    "Secció de la ranura de la barra 1088: 16 d'ample × 11 de fondària (la del perfil de muntatge Loox d'11 mm, p. 2.127; el catàleg no acota la 1088).",
    "La potència d'una barra tallada és proporcional a la llargada (18,3 W per metre).",
    "Forat del cable Ø8 a un extrem de la ranura (la barra porta un cable a cada costat).",
  ],
})

/** Els jocs de llum Häfele Loox de la biblioteca (preferències v31). */
export const HAFELE_LOOX_ITEMS: HardwareItem[] = [
  lamp({ id: "light-loox-3038-ww", name: "Focus Loox LED 3038 Ø55, 3000 K", kit: LOOX_3038("Blanc càlid 3000 K", "833.75.120"), setback: 60, spacing: 400 }),
  lamp({ id: "light-loox-3038-cw", name: "Focus Loox LED 3038 Ø55, 4000 K", kit: LOOX_3038("Blanc fred 4000 K", "833.75.121"), setback: 60, spacing: 400 }),
  lamp({ id: "light-loox-3010-ww", name: "Focus Loox LED 3010 Ø60, 3000 K", kit: LOOX_3010("Blanc càlid 3000 K", "833.75.040"), setback: 60, spacing: 400 }),
  lamp({ id: "light-loox-3010-cw", name: "Focus Loox LED 3010 Ø60, 4000 K", kit: LOOX_3010("Blanc fred 4000 K", "833.75.041"), setback: 60, spacing: 400 }),
  lamp({ id: "light-loox-3001-ww", name: "Focus Loox LED 3001 Ø55, 3000 K", kit: LOOX_3001, setback: 60, spacing: 400 }),
  lamp({ id: "light-loox-3022-ww", name: "Làmpada plana Loox LED 3022 Ø180, 3000 K", kit: LOOX_3022("Blanc càlid 3000 K", "833.75.100", "833.77.130"), setback: 150, spacing: 600 }),
  lamp({ id: "light-loox-3022-cw", name: "Làmpada plana Loox LED 3022 Ø180, 4000 K", kit: LOOX_3022("Blanc fred 4000 K", "833.75.101", "833.77.131"), setback: 150, spacing: 600 }),
  lamp({ id: "light-loox-3024-ww", name: "Làmpada plana Loox LED 3024 205 × 205, 3000 K", kit: LOOX_3024("Blanc càlid 3000 K", "833.75.090", "833.77.120"), setback: 150, spacing: 600 }),
  lamp({ id: "light-loox-3024-cw", name: "Làmpada plana Loox LED 3024 205 × 205, 4000 K", kit: LOOX_3024("Blanc fred 4000 K", "833.75.091", "833.77.121"), setback: 150, spacing: 600 }),
  lamp({ id: "light-loox-1088-ww", name: "Barra Loox LED 1088 per encastar, 3200 K", kit: LOOX_1088("Blanc càlid 3200 K", ["833.03.100", "833.03.101", "833.03.102"]), setback: 30, spacing: 0 }),
  lamp({ id: "light-loox-1088-cw", name: "Barra Loox LED 1088 per encastar, 4200 K", kit: LOOX_1088("Blanc fred 4200 K", ["833.03.111", "833.03.112", "833.03.113"]), setback: 30, spacing: 0 }),
]

/** Els sistemes elèctrics que coneix l'app, pel fabricant del joc de llum. */
export const LIGHT_SYSTEMS: readonly LightSystem[] = [HAFELE_LOOX_SYSTEM]
export const lightSystemOf = (maker: string): LightSystem | undefined => LIGHT_SYSTEMS.find((s) => s.maker === maker)
