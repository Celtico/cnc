import type { HardwareEngine, HardwareItem } from "./hardwareSchema"

/** Paràmetres editables de cada motor (Preferències › Ferratges): etiquetes, límits i ajudes. */

/** Paràmetres de cada motor (etiqueta i límits per a l'editor, `NumRow`). */
interface HardwareParamSpec {
  key: string
  label: string
  min: number
  max: number
  step: number
  help?: string
  /** Només als items amb joc de llum (`HardwareItem.light`). */
  light?: boolean
  /** Només si l'item el porta als `params` (les distàncies de davant i de darrere d'una pota). */
  optional?: boolean
}
const P = (key: string, label: string, min: number, max: number, step = 0.5, help?: string): HardwareParamSpec => ({ key, label, min, max, step, ...(help ? { help } : {}) })
/** Els paràmetres que s'editen d'un item: els del motor, menys els d'un joc de llum si no en porta i els opcionals que no té. */
export const hardwareParams = (item: Pick<HardwareItem, "engine" | "light"> & { params?: HardwareItem["params"] }): HardwareParamSpec[] =>
  HARDWARE_PARAMS[item.engine].filter((p) => (!p.light || item.light) && (!p.optional || (item.params && p.key in item.params)) && !(p.key === "inset" && legHasOwnSides(item)))
/** Una pota amb una distància per a cada costat (la AXILO 78): «Als cantells» no surt (no es fa servir). */
function legHasOwnSides(item: Pick<HardwareItem, "engine"> & { params?: HardwareItem["params"] }): boolean {
  return item.engine === "leg" && !!item.params && ["insetLeft", "insetRight", "insetBack", "insetFront"].every((k) => k in item.params!)
}
/** El nom d'un paramètre per a aquest item (de moment, el del motor). */
export const hardwareParamLabel = (_item: Pick<HardwareItem, "engine"> & { params?: HardwareItem["params"] }, p: HardwareParamSpec): string => p.label

/** Els ferratges per metres (regleta, sòcol d'alumini): secció, barra i clips. */
const LINEAR_PARAMS: HardwareParamSpec[] = [
  P("height", "Alçada", 5, 300, 0.5, "Del perfil (el sòcol d'alumini: l'alçada vista)."),
  P("depth", "Gruix", 1, 60, 0.5, "Del perfil, de la cara al darrere."),
  P("stock", "Barra", 0, 6000, 1, "Llargada de la barra que es compra (0 = es ven per metres, tallat a mida)."),
  P("clipSpacing", "Clips cada", 0, 2000, 10, "Un clip (o un cargol) cada tants mm; dos per tros com a mínim (0 = cap)."),
  P("clipEnd", "Clips als extrems", 0, 500, 5, "Del primer i l'últim clip als extrems del tros."),
]

/** El sòcol d'alumini: com la regleta, però amb els clips a les potes (0 = un a cada pota de cada tram, l'estàndard). */
const PLINTH_PARAMS: HardwareParamSpec[] = LINEAR_PARAMS.map((p) => (p.key === "clipSpacing" ? { ...p, help: "0 = un clip a cada pota de cada tram (l'estàndard: el clip es fixa a la pota); si no, un cada tants mm, dos per tros com a mínim." } : p))

const HARDWARE_PARAMS: Record<HardwareEngine, HardwareParamSpec[]> = {
  cup: [
    P("cupDiameter", "Cassoleta (Ø)", 10, 60, 0.5),
    P("cupDepth", "Fondària", 5, 20, 0.5),
    P("cupOffset", "Al cantell", 5, 40, 0.5, "Del cantell de la porta al centre de la cassoleta."),
    P("endOffset", "Als extrems", 30, 300, 5, "Primera i última frontissa, des de dalt i des de baix (després s'ajusten a la filera System 32)."),
    P("gap", "Separació mínima", 0, 50, 1, "Entre cassoletes, a més del Ø (si no hi caben, se'n posen menys i s'avisa)."),
    P("margin", "Marge", 0, 20, 0.5, "Matèria al voltant de la cassoleta fins a la vora de la porta."),
  ],
  system32: [
    P("edgeOffset", "Al cantell", 10, 100, 0.5, "Fileres de davant i de darrere, des dels cantells del lateral."),
    P("pitch", "Pas", 16, 64, 1),
    P("diameter", "Diàmetre", 3, 10, 0.5),
    P("depth", "Fondària", 5, 20, 0.5),
  ],
  dowel: [
    P("diameter", "Diàmetre", 4, 12, 0.5),
    P("faceDepth", "A la cara", 5, 30, 0.5, "Fondària del forat a la cara de la peça que continua."),
    P("edgeDepth", "Al cantell", 5, 40, 0.5, "Fondària del forat al cantell de la peça que hi topa."),
    P("endOffset", "Als extrems", 20, 200, 1, "Primera i última espiga, des dels extrems de la unió."),
  ],
  cabineo: [
    P("pocketD", "Buidat (Ø)", 8, 30, 0.5, "Dels tres forats encavalcats de la peça que porta el connector."),
    P("pocketDepth", "Fondària", 5, 20, 0.5),
    P("first", "1r forat", 0, 30, 0.1, "Del cantell que toca l'altra peça al centre del primer forat."),
    P("step", "Pas", 2, 30, 0.1, "Entre els centres dels tres forats."),
    P("axis", "Eix del cargol", 2, 15, 0.5, "De la cara on va el connector a l'eix del cargol, a l'altra peça."),
    P("screwD", "Cargol (Ø)", 2, 10, 0.5),
    P("screwDepth", "Fondària del cargol", 5, 40, 0.5),
    P("margin", "Als extrems", 20, 300, 1, "Primer i últim connector, des dels extrems de la unió."),
    P("pitch", "Pas màxim", 50, 1000, 10, "Si la separació passa d'aquí, se'n posen més al mig."),
  ],
  screw: [
    P("d", "Forat (Ø)", 2, 10, 0.5, "Forat passant a la peça que continua."),
    P("margin", "Als extrems", 20, 300, 1, "Primer i últim cargol, des dels extrems de la unió."),
    P("pitch", "Pas màxim", 50, 1000, 10, "Si la separació passa d'aquí, se'n posen més al mig."),
  ],
  slide: [
    P("sideClearance", "Folgança lateral", 0, 30, 0.5, "Per costat, entre la caixa i el lateral del moble."),
    P("boxThickness", "Gruix de la caixa", 8, 25, 1),
    P("bottomThickness", "Fons del calaix (gruix)", 3, 19, 1),
    P("boxDrop", "Front − caixa", 0, 100, 1, "Alçada del front menys alçada de la caixa."),
    P("bottomOffset", "Fons del calaix a", 0, 40, 1, "Del cantell de baix de la caixa a la ranura del fons del calaix."),
    P("backClearance", "Folgança darrere", 0, 50, 1),
    P("frontOffset", "1r forat", 10, 200, 0.5, "Des del darrere del front."),
    P("secondOffset", "2n forat", 32, 600, 1, "Després del primer."),
    P("holeHeight", "Alçada", 5, 100, 0.5, "Dels forats, des de baix de la caixa."),
  ],
  flapArm: [
    P("offset", "Al cantell", 5, 60, 0.5, "Del cantell de gir als forats."),
    P("diameter", "Diàmetre", 3, 20, 0.5),
    P("depth", "Fondària", 3, 20, 0.5),
    P("endOffset", "Als costats", 20, 300, 5, "Dels costats de l'abatible (si és estret, a ¼ i ¾)."),
    { ...P("strutG", "Bracket al lateral", 50, 600, 1, "Pistó de gas: del cantell de gir al bracket d'armari (G)."), optional: true },
    { ...P("strutLength", "Llarg del pistó", 100, 600, 1), optional: true },
    { ...P("sideSetback", "Del davant", 20, 100, 0.5, "Pistó de gas: del davant del lateral als forats del bracket."), optional: true },
  ],
  magnet: [
    P("diameter", "Diàmetre", 3, 30, 0.5),
    P("depth", "Fondària", 2, 15, 0.5),
    P("cornerOffset", "A les cantonades", 10, 300, 5, "Des de dalt i des de baix."),
  ],
  barHandle: [
    P("diameter", "Diàmetre", 2, 12, 0.5),
    P("margin", "Marge", 0, 20, 0.5, "Matèria al voltant dels forats (vores i altres forats)."),
    P("inset", "Al cantell", 10, 200, 1, "A les portes i abatibles, del cantell que obre al tirador."),
  ],
  leg: [
    P("inset", "Als cantells", 20, 300, 1, "De la vora de fora del mòdul a l'eix de cada pota (de costat i de davant/darrere)."),
    { ...P("insetLeft", "Lateral esquerre", 20, 300, 1, "Del cantell de fora del lateral esquerre a l'eix de les potes de l'esquerra."), optional: true },
    { ...P("insetRight", "Lateral dret", 20, 300, 1, "Del cantell de fora del lateral dret a l'eix de les potes de la dreta."), optional: true },
    { ...P("insetBack", "Darrere", 20, 300, 1, "Del cantell de darrere de la base a l'eix de les potes del darrere."), optional: true },
    { ...P("insetFront", "Davant", 20, 300, 1, "Del cantell de davant de la base a l'eix de les potes del davant (deixa lloc al sòcol)."), optional: true },
  ],

  model: [],
  // La prebroca dels cargols és una regla del taller (Preferències › Regles de mecanitzat › «Prebroca dels cargols», `Settings.kitPilot`),
  // no un número de cada joc: res a editar aquí (els `params` es queden per compatibilitat i els omple `setKitPilot`).
  drawerKit: [],
  plate: [
    P("setback", "Del davant", 0, 200, 0.5, "Del cantell de davant del lateral a la referència de la placa (la filera System 32: 37)."),
    P("offset", "Alçada", -100, 100, 0.5, "Del centre de la cassoleta a la referència de la placa (amunt, positiu)."),
  ],
  rail: [
    P("diameter", "Diàmetre", 10, 40, 1, "Del tub."),
    P("drop", "Del sostre", 20, 200, 5, "Del sostre del compartiment a l'eix de la barra."),
  ],
  ledProfile: [
    P("width", "Amplada", 6, 250, 1, "Del perfil (de costat a costat); d'una làmpada, el Ø o el costat del cos."),
    P("height", "Alçada", 4, 30, 1, "Del perfil (el que baixa del prestatge); d'una làmpada, la seva alçada."),
    P("setback", "Del davant", 0, 400, 5, "Del cantell de davant del prestatge al perfil (o al centre de la làmpada)."),
    { ...P("spacing", "Entre llums", 150, 1500, 50, "Cada quants mm una làmpada al llarg del compartiment (com a mínim una)."), light: true },
    { ...P("depth", "Rebaix", 3, 30, 0.5, "Fondària del forat o del rebaix de la làmpada a la peça de sobre (cal deixar-hi 5 mm de tauler)."), light: true },
  ],
  glassFrame: [
    P("frame", "Perfil", 10, 60, 1, "Amplada vista del perfil d'alumini del marc."),
    P("glass", "Vidre", 3, 10, 0.5, "Gruix del vidre (entra 5 mm al perfil)."),
  ],
  hanger: [
    { ...P("underTop", "Des de sota la tapa", 0, 1, 1, "1 = les mides de dalt es prenen des de sota la tapa (el penjador estàndard, «sota la tapa»); 0 = des de dalt del moble."), optional: true },
    P("fromTop", "De dalt", 10, 300, 0.5, "De sota la tapa (o de dalt del lateral) al primer forat (cara de dins)."),
    { ...P("behindBack", "Darrere del fons", 0, 30, 0.5, "Penjador estàndard (darrere del fons): de la cara de darrere del fons a l'eix dels forats."), optional: true },
    { ...P("fromBack", "Del darrere", 10, 200, 0.5, "Penjador d'abans (davant del fons): del cantell de darrere del lateral a la primera columna de forats."), optional: true },
    P("pitch", "Entre forats", 8, 64, 0.5, "Distància entre els forats."),
    P("holeDiameter", "Diàmetre", 3, 20, 0.5),
    P("holeDepth", "Fondària", 3, 20, 0.5, "Dels forats al lateral (com a molt, el gruix − 1)."),
    P("gap", "Espai darrere el fons", 0, 60, 1, "El que cal entre la paret i el fons perquè hi càpiguen el penjador i la regleta (fons en ranura o encastat retirat)."),
    P("railTop", "Regleta", 0, 300, 1, "De sota la tapa (o de dalt del moble) al cantell de dalt de la regleta (on s'enganxa el penjador)."),
    { ...P("slotWidth", "Ranura del fons (ample)", 0, 40, 0.5, "Penjador estàndard: la ranura del fons per regular-lo des de dins (0 = cap)."), optional: true },
    { ...P("slotLength", "Ranura del fons (llarg)", 0, 120, 0.5), optional: true },
    { ...P("slotTop", "Ranura: de dalt", 0, 200, 0.5, "De sota la tapa al començament de la ranura."), optional: true },
    { ...P("slotSide", "Ranura: del lateral", 0, 100, 0.5, "De la cara de dins del lateral a l'eix de la ranura."), optional: true },
    { ...P("notchWidth", "Osca del fons (ample)", 0, 100, 1, "Penjador d'abans: tall del fons a les cantonades de dalt perquè hi passi el ganxo, des del lateral (0 = cap)."), optional: true },
    { ...P("notchHeight", "Osca del fons (alt)", 0, 400, 1, "Des de dalt del moble (0 = cap)."), optional: true },
    P("bodyWidth", "Cos: ample", 5, 80, 0.5, "Del penjador, des de la cara del lateral (per dibuixar-lo)."),
    P("bodyHeight", "Cos: alçada", 20, 200, 0.5),
    P("bodyDepth", "Cos: fondària", 5, 200, 0.5),
  ],
  wallRail: LINEAR_PARAMS,
  plinthProfile: PLINTH_PARAMS,
  // Electrodomèstic: el que l'app mecanitza al front de moble (les dades del catàleg no s'editen). Cada item porta els seus.
  appliance: [
    { ...P("pilotHoles", "Prebroques", 0, 1, 1, "0 (l'estàndard) = cap: el front es forada amb la plantilla que porta l'aparell; 1 = l'app hi fa les prebroques d'aquests números."), optional: true },
    { ...P("pilotDiameter", "Prebroca: Ø", 1, 6, 0.5, "Dels cargols de la fixació o de la guia al darrere del front."), optional: true },
    { ...P("pilotDepth", "Prebroca: fondària", 3, 20, 0.5), optional: true },
    { ...P("fixInset", "Fixació: dels costats", 10, 200, 1, "Amb prebroques: dels costats de l'aparell a les prebroques de la fixació a la seva porta (comprova-ho amb la plantilla)."), optional: true },
    { ...P("fixTop", "Fixació: de dalt", 10, 300, 1, "Amb prebroques: del cantell de dalt del front a la filera de dalt."), optional: true },
    { ...P("fixBottom", "Fixació: de baix", 10, 300, 1, "Amb prebroques: del cantell de baix del front a la filera de baix."), optional: true },
    { ...P("guideEdge", "Guia: del cantell", 10, 200, 1, "Amb prebroques (frigorífic de porta lliscant): del cantell que obre a la guia lliscant."), optional: true },
    { ...P("guidePitch", "Guia: entre forats", 8, 200, 1, "Amb prebroques: entre les prebroques de la guia."), optional: true },
    { ...P("cupDiameter", "Cassoleta: Ø", 20, 40, 0.5, "Rentadora: les frontisses de l'aparell (catàleg)."), optional: true },
    { ...P("cupDepth", "Cassoleta: fondària", 8, 16, 0.5), optional: true },
    { ...P("cupOffset", "Cassoleta: del cantell", 3, 40, 0.5, "Del cantell del panell frontal de l'aparell (o del front, sense «Panell de l'aparell») al centre de la cassoleta."), optional: true },
    { ...P("panelWidth", "Panell de l'aparell", 400, 700, 0.5, "Ample del panell frontal de l'aparell (centrat): la cassoleta es mesura des del seu cantell."), optional: true },
    { ...P("firstHinge", "Primera frontissa", 50, 600, 0.5, "Del cantell de dalt de l'aparell a la primera frontissa."), optional: true },
    { ...P("hingePitch", "Entre frontisses", 100, 800, 0.1, "De la primera a la segona frontissa."), optional: true },
  ],
}

/** Col·locació de la placa d'una frontissa importada (paràmetres de la frontissa, copiats de la placa en aparellar-la). */
export const HINGE_PLATE_PARAMS: HardwareParamSpec[] = [
  P("plateSetback", "Placa: del davant", 0, 200, 0.5, "De la cara de darrere de la porta a la referència de la placa (la filera System 32: 37). Amb fronts encastats el gruix del front ja s'hi suma sol."),
  P("plateOffset", "Placa: alçada", -100, 100, 0.5, "Del centre de la cassoleta a la referència de la placa (amunt, positiu)."),
]
