import { AS_MODULE, STRUCTURAL, UI, field, group, section } from "./optionTypes"
import { applianceFrontFields } from "./moduleOptions"

const FROM_PREFS_GAPS = "Preferències › Folgances per defecte"
const BY_APPLIANCE = "Surt sempre: un electrodomèstic l'ajusta un cop en triar-lo i després es canvia com sempre (cas 12 del model únic)."
const RAW_BACK = "`moduleRows().back` llegeix el fons de l'usuari sense `visibleModule`. Amb un electrodomèstic que fixa «Sense fons» (rentaplats, rentadora, frigorífic sota taulell; microones penjat), la fila Fons diu «Sense fons» però si el fons de l'usuari era en ranura surten igualment «Ranura del fons» i «Folgança de la ranura» (o «Retirada del fons» si era encastat), que la construcció no fa servir."

/** La caixa del mòdul (Tapa, Laterals, Fons, Base), en l'ordre de l'inspector (`CarcassForm`, opcions en cascada). */
export const CARCASS = group("module.carcass", "Caixa", { icon: "carcass", code: UI.sections, why: STRUCTURAL, note: "Per decisió de l'usuari, 2026-10-21 (el disseny de la seva imatge): sense la secció «Caixa», Tapa · Laterals · Fons · Base són seccions del mòdul, com a la divisió i a l'obertura, i després el Front de l'Interior. Insígnia «Recobrents»/«Encastats» si hi ha fronts. Les parts que fixa l'electrodomèstic que és el mòdul no surten: una nota a dalt ho diu." }, [
  // L'electrodomèstic que és el mòdul (Tipus = Electrodomèstic): una nota amb el que fixa i les opcions del front de moble.
  ...applianceFrontFields("module"),
  section("module.carcass.topGroup", "Tapa", { icon: "subsection", code: UI.carcass }, [
  field("module.carcass.top", "Tapa", {
    code: UI.carcass,
    control: "choice",
    showIf: BY_APPLIANCE,
    default: "full",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [
      { value: "full", label: "Sencera", reveals: ["module.carcass.tableTop"] },
      { value: "ventSlot", label: "Ranura d'aire", reveals: ["module.carcass.ventGap"] },
      { value: "grille", label: "Reixeta", reveals: ["module.carcass.grille.pattern", "module.carcass.grille.holes", "module.carcass.grille.slots", "module.carcass.grille.margin"] },
      { value: "rails", label: "Travessers", reveals: ["module.carcass.railWidth", "module.carcass.railBack"] },
      { value: "none", label: "Sense tapa" },
    ],
  }, [
    field("module.carcass.railWidth", "Amplada dels travessers", { code: UI.carcass, control: "number", showIf: "Tapa = Travessers", default: 100, note: "cel, 2026-11-07: la tapa del «Buc bàsic» del Taulell i dels mobles d'aigüera." }),
    field("module.carcass.railBack", "Travesser de darrere", { code: UI.carcass, control: "switch", showIf: "Tapa = Travessers", default: true, choices: [{ value: "on", label: "Sí" }], note: "Sense, el fons encastat puja fins a dalt." }),
    field("module.carcass.ventGap", "Ranura d'aire", { code: UI.carcass, control: "number", showIf: "Tapa = Ranura d'aire", default: 60 }),
    field("module.carcass.grille.pattern", "Patró", { code: UI.carcass, control: "choice", showIf: "Tapa = Reixeta", default: "slotsV", choices: [{ value: "slotsV", label: "Ranures verticals", reveals: ["module.carcass.grille.slots"] }, { value: "slotsH", label: "Ranures horitzontals", reveals: ["module.carcass.grille.slots"] }, { value: "holes", label: "Forats al tresbolillo", reveals: ["module.carcass.grille.holes"] }], note: "El mateix component que el front reixeta (`GrillePatternFields`); la tapa va fixa: sense muntatge." }),
    field("module.carcass.grille.slots", "Ranura · Separació", { code: UI.carcass, control: "number", showIf: "Patró de ranures", default: 8 }),
    field("module.carcass.grille.holes", "Diàmetre forat · Pas", { code: UI.carcass, control: "number", showIf: "Patró de forats" }),
    field("module.carcass.grille.margin", "Marge", { code: UI.carcass, control: "number", showIf: "Tapa = Reixeta", default: 60 }),
    field("module.carcass.tableTop", "Tauler de taula", {
      code: UI.carcass,
      control: "switch",
      showIf: "Tapa = Sencera",
      default: false,
      defaultEditable: true,
      choices: [{ value: "on", label: "Per sobre dels laterals", reveals: ["module.carcass.tableTopOverhang", "module.carcass.tableTopShape"] }],
      issue: "(plausible) Depèn dels Laterals («per sobre dels laterals», els fa més curts) però surt ABANS de «Laterals» i també sense cap lateral.",
    }, [
      field("module.carcass.tableTopOverhang", "Voladís", { code: UI.carcass, control: "number", default: 30 }),
      field("module.carcass.tableTopShape", "Forma", { code: UI.carcass, control: "choice", default: "rect", choices: [{ value: "rect", label: "Rectangle" }, { value: "round", label: "Arrodonit" }, { value: "ellipse", label: "Oval" }], note: "i «Editar…» (forma a mida)" }),
    ]),
    field("module.carcass.topFiller", "Sòcol de dalt", {
      code: UI.carcass,
      control: "switch",
      showIf: "Amb tapa i sense tauler de taula",
      default: false,
      choices: [{ value: "on", label: "Fins al sostre", reveals: ["module.carcass.topFillerHeight", "module.carcass.topFillerSetback"] }],
      note: "Per decisió de l'usuari, 2026-10-20 («0 casos especials»): una drecera; el mòdul creix, «Sense tapa» i una zona de dalt amb un front fix (`addTopPlinth`).",
    }, [
      field("module.carcass.topFillerHeight", "Alçada", { code: UI.carcass, control: "number", range: { min: 10, max: 600, step: 5, suffix: "mm" }, default: 60 }),
      field("module.carcass.topFillerSetback", "Retirada", { code: UI.carcass, control: "number", range: { min: 0, max: 200, step: 1, suffix: "mm" }, default: 0 }),
    ]),
  ]),
  ]),
  section("module.carcass.leftGroup", "Esquerra", { icon: "subsection", code: UI.carcass, note: "El lateral esquerre, i el Gruix (Parets), les Cantonades i l'Espiga de les unions de la caixa (en depenen), que surten als dos laterals." }, [
  field("module.carcass.sideLeft", "Lateral", {
    code: UI.carcass,
    control: "choice",
    showIf: `${BY_APPLIANCE} Abans de Parets i Cantonades (en depenen).`,
    default: "full",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [{ value: "full", label: "Sencer" }, { value: "none", label: "Sense lateral" }],
    note: "Al nínxol d'un electrodomèstic de terra, «Laterals de remat»: una peça sola a l'extrem de la cuina.",
  }),
  field("module.carcass.hollow", "Gruix", {
    code: UI.carcass,
    control: "switch",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "Gruixuts (buits)", reveals: ["module.carcass.hollowThickness"], note: "Cantonades passa a text «A inglet». El mateix nom que Prestatges › Gruix i Divisió › Gruix (2026-10-20)." }],
    issue: "(menor) Surt també sense laterals, base ni tapa, quan no hi ha cap paret a fer buida.",
  }, [field("module.carcass.hollowThickness", "Gruix aparent", { code: UI.carcass, control: "number", showIf: "Parets buides", defaultText: "Cas 9 del model únic: el mateix a les parets, els prestatges i els divisors (`HollowRows`): el més gran de 50 i 2 × tauler + 12; mínim 2 × tauler + 6" })]),
  field("module.carcass.joint", "Cantonades", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun lateral i tapa, o base sense sòcol (la condició de la construcció, `jointApplies`); amb parets buides, text «A inglet»",
    default: "butt",
    defaultEditable: true,
    choices: [{ value: "butt", label: "Normals" }, { value: "mitre", label: "A inglet" }],
  }),
  field("module.carcass.dowel", "Espiga", {
    code: UI.carcass,
    control: "hardware",
    showIf: "La caixa fa espigues (tapa o base a topar amb els laterals, fons encastat ≥ 15 mm, tapa de reixeta o alguna divisió)",
    defaultText: "La de Preferències › Ferratges",
    note: "Per decisió de l'usuari, 2026-10-20: «unió és una opció dels laterals, no del conjunt» (abans, secció Mòdul › Unió).",
  }),
    field("module.carcass.shelfSetback", "Retirada dels prestatges", { code: UI.carcass, control: "number", showIf: "Algun compartiment amb tira LED, o prestatges (sense calaixos) que no van a ras o que un front encastat bloqueja", defaultText: FROM_PREFS_GAPS }),
    field("module.carcass.breakJoint", "Trencajunt", { code: UI.carcass, control: "number", defaultText: "0 (a ras)", note: "El del Taulell 3D (cel, 2026-11-08): la base, el sostre, els prestatges fixos i les divisions, aquests mm enrere del davant dels laterals." }),
  ]),
  section("module.carcass.rightGroup", "Dreta", { icon: "subsection", code: UI.carcass, note: "Per decisió de l'usuari, 2026-10-21 («separa els laterals: Esquerra, Dreta»): un acordió per lateral. El Gruix, les Cantonades, l'Espiga i la Retirada dels prestatges surten també aquí (són dels dos laterals; al registre, a Esquerra)." }, [
  field("module.carcass.sideRight", "Lateral", {
    code: UI.carcass,
    control: "choice",
    showIf: BY_APPLIANCE,
    default: "full",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [{ value: "full", label: "Sencer" }, { value: "none", label: "Sense lateral" }],
  }),
  ]),
  section("module.carcass.backGroup", "Fons", { icon: "subsection", code: UI.carcass }, [
  field("module.carcass.back", "Fons", {
    code: UI.carcass,
    control: "choice",
    showIf: BY_APPLIANCE,
    default: "groove",
    defaultEditable: true,
    choices: [
      { value: "groove", label: "En ranura", reveals: ["module.carcass.backSetback", "module.carcass.grooveClearance", "module.materials.back"] },
      { value: "screwed", label: "Cargolat darrere", reveals: ["module.materials.back"] },
      { value: "inset", label: "Encastat", reveals: ["module.carcass.backInsetSetback", "module.materials.back"], note: "si el fons fa < 15 mm, passa a «Com el cos»" },
      { value: "none", label: "Sense fons", hides: ["module.carcass.backSetback", "module.carcass.grooveClearance", "module.carcass.backInsetSetback", "module.materials.back"] },
    ],
  }, [
    field("module.carcass.backSetback", "Ranura del fons", { code: UI.carcass, control: "number", showIf: "Fons = En ranura", defaultText: FROM_PREFS_GAPS, issue: RAW_BACK }),
    field("module.carcass.grooveClearance", "Folgança de la ranura", {
      code: UI.carcass,
      control: "number",
      showIf: "Fons = En ranura",
      defaultText: FROM_PREFS_GAPS,
      issue: `Glossari: «Joc» és només el joc paramètric del fabricant; una separació és una «Folgança» (l'ajuda de Preferències en diu folgança). A més, ${RAW_BACK}`,
    }),
    field("module.carcass.backInsetSetback", "Retirada del fons", { code: UI.carcass, control: "number", showIf: "Fons = Encastat", default: 0, issue: RAW_BACK }),
  ]),
  ]),
  section("module.carcass.baseGroup", "Base", { icon: "subsection", code: UI.carcass, note: "Per decisió de l'usuari, 2026-10-16: «a la Caixa fer subgrups: la Base amb les seves opcions, després el Fons, després la Tapa, després el Front»." }, [
  field("module.carcass.support", "Suport", {
    code: UI.carcass,
    control: "choice",
    showIf: "Mòdul de terra. Moble normal: el del mòdul (Directe a terra · Sòcol, una drecera de zones · Potes). Cuina: les mateixes opcions amb el valor de tota la cuina (Moble › Cuina; canviar-les aquí és canviar-les per a tots). Penjat: text «Penjat a la paret, a H mm del terra», es canvia a Posició.",
    note: "Casos 8 i 15 del model únic (2026-10-20): el Suport i la Base (la peça de baix) són dues files, iguals al moble i a la cuina; a la cuina, el Suport és el de tota la cuina, amb les mateixes opcions que a Moble › Cuina.",
    default: "none",
    defaultEditable: true,
    choices: [
      { value: "none", label: "Directe a terra", reveals: ["module.carcass.bottom"] },
      { value: "plinth", label: "Sòcol", reveals: ["module.carcass.bottom", "module.carcass.plinthHeight", "module.carcass.plinthSetback"] },
      { value: "legs", label: "Potes", reveals: ["module.carcass.legHeight", "module.carcass.leg", "module.carcass.legPlinth", "module.carcass.underLight"], hides: ["module.carcass.bottom"] },
    ],
  }, [
    field("module.carcass.plinthHeight", "Alçada sòcol", { code: UI.moduleSupport, control: "number", showIf: "Suport = Sòcol", range: { min: 20, max: 300, step: 5, suffix: "mm" }, default: 60, defaultEditable: true }),
    field("module.carcass.plinthSetback", "Retirada", {
      code: UI.moduleSupport,
      control: "number",
      showIf: "Suport = Sòcol",
      range: { min: 0, max: 200, step: 1, suffix: "mm" },
      default: 30,
      defaultEditable: true,
      note: "Per decisió de l'usuari, 2026-10-20 («0 casos especials»): el Sòcol del moble normal és una drecera; crea «Sense base» i una zona de baix amb un front fix retirat (`addBottomPlinth`). L'Alçada i la Retirada són les d'aquesta zona.",
    }),
    field("module.carcass.legHeight", "Alçada potes", { code: UI.moduleSupport, control: "number", showIf: "Suport = Potes", range: { min: 20, max: 400, step: 5, suffix: "mm" }, default: 100, defaultEditable: true }),
    field("module.carcass.leg", "Pota", { code: UI.moduleSupport, control: "hardware", showIf: "Suport = Potes, i hi ha potes a la biblioteca o el mòdul en porta una", defaultText: "Genèriques" }, [
      field("module.carcass.legInset", "Potes al davant", { code: UI.moduleSupport, control: "number", showIf: "Una pota amb distància pròpia al davant (AXILO 78)" }),
    ]),
    field("module.carcass.legPlinth", "Sòcol", {
      code: UI.moduleSupport,
      control: "switch",
      showIf: "Suport = Potes",
      default: false,
      choices: [{ value: "on", label: "Davant de les potes", reveals: ["module.carcass.legPlinthSetback"] }],
    }, [
      field("module.carcass.legPlinthSetback", "Retirada del sòcol", { code: UI.moduleSupport, control: "number", defaultText: "Calculada: el peu de la pota del davant just darrere del sòcol" }),
    ]),
  ]),
  field("module.carcass.hanger", "Penjadors", {
    code: UI.base,
    control: "hardware",
    showIf: "Fila = Penjat i algun lateral (van un a cada lateral); sense laterals, un text ho diu",
    defaultText: AS_MODULE,
    choices: [{ value: "inherit", label: "Com el mòdul o un penjador", reveals: ["module.carcass.wallRail"] }, { value: "none", label: "Cap", hides: ["module.carcass.wallRail"] }],
  }, [
    field("module.carcass.wallRail", "Regleta", { code: UI.base, control: "hardware", showIf: "Penjadors ≠ Cap", defaultText: AS_MODULE }),
  ]),
  field("module.carcass.bottom", "Base", {
    code: UI.carcass,
    control: "choice",
    showIf: `Sense potes (amb potes no surt: s'hi cargolen, la base hi és sempre). ${BY_APPLIANCE}`,
    default: "full",
    defaultEditable: true,
    choices: [
      { value: "full", label: "Sencera", reveals: ["module.carcass.underLight"] },
      { value: "none", label: "Sense base", hides: ["module.carcass.underLight"] },
    ],
  }),
  field("module.carcass.underLight", "Llum a sota", {
    code: UI.carcass,
    control: "switch",
    showIf: "Penjat, o amb potes vistes (amb sòcol quedaria amagada), i amb base",
    default: false,
    choices: [{ value: "on", label: "Sota la base", reveals: ["module.carcass.underLightHardware"] }],
  }, [field("module.carcass.underLightHardware", "Llum", { code: UI.carcass, control: "hardware", showIf: "Llum a sota", defaultText: AS_MODULE })]),
  ]),
  section("module.carcass.frontsGroup", "Fronts del mòdul", { icon: "subsection", code: UI.carcass, showIf: "Dins del Front de cada compartiment o zona dividida que porta un front", note: "Per decisió de l'usuari, 2026-10-20: abans Caixa › Fronts; ara una subsecció del Front (els mateixos valors, de tot el mòdul, des de qualsevol Front)." }, [
  field("module.carcass.frontStyle", "Estil dels fronts", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun front que es fa (també front fix, reixeta o front de moble), de qualsevol compartiment o del Front d'una zona dividida; no al nínxol d'un electrodomèstic de terra (el front de moble va per davant, recobrent)",
    default: "overlay",
    defaultEditable: true,
    choices: [{ value: "overlay", label: "Recobrents" }, { value: "inset", label: "Encastats" }],
  }),
  field("module.carcass.outerGap", "Folgança front–cos", { code: UI.carcass, control: "number", showIf: "Com l'Estil dels fronts", defaultText: FROM_PREFS_GAPS }),
  field("module.carcass.betweenGap", "Folgança entre fronts", { code: UI.carcass, control: "number", showIf: "Dues portes, dos o més calaixos, o un front recobrent que no és a l'arrel", defaultText: FROM_PREFS_GAPS }),
  ]),
])
