import { AS_MODULE, STRUCTURAL, UI, field, section } from "./optionTypes"
import { applianceFrontFields } from "./moduleOptions"

const FROM_PREFS_GAPS = "Preferències › Folgances per defecte"
const BY_APPLIANCE = "Si l'electrodomèstic que és el mòdul la fixa, no surt (la nota de dalt de la Caixa ho diu)."
const RAW_BACK = "`moduleRows().back` llegeix el fons de l'usuari sense `visibleModule`. Amb un electrodomèstic que fixa «Sense fons» (rentaplats, rentadora, frigorífic sota taulell; microones penjat), la fila Fons diu «Sense fons» però si el fons de l'usuari era en ranura surten igualment «Ranura del fons» i «Joc de la ranura» (o «Retirada del fons» si era encastat), que la construcció no fa servir."
const BELOW_DOORS = "Depèn d'una opció de MÉS AVALL a la mateixa pantalla: Mòdul › Portes (secció posterior a la Caixa) la fa aparèixer. La regla «cada opció depèn només de les de més amunt» no es compleix dins de l'inspector del mòdul."
const HUNG_SIDES = "Surt amb qualsevol caixa penjada, però la construcció només en fa servir amb laterals (`usedHardwareSlots`). Un mòdul nou penjat (sense laterals) ensenya Penjadors i Regleta que no compten; a més depèn de «Laterals», que és més avall a la Caixa."

/** Mòdul › Caixa, en l'ordre de l'inspector (`CarcassForm`, opcions en cascada). */
export const CARCASS = section("module.carcass", "Caixa", { icon: "carcass", code: UI.sections, hideable: false, why: STRUCTURAL, note: "Insígnia «Recobrents»/«Encastats» si hi ha fronts. Les parts que fixa l'electrodomèstic que és el mòdul no surten: una nota a dalt ho diu." }, [
  // L'electrodomèstic que és el mòdul (Tipus = Electrodomèstic): una nota amb el que fixa i les opcions del front de moble.
  ...applianceFrontFields("module"),
  section("module.carcass.baseGroup", "Base", { icon: "subsection", code: UI.carcass, note: "Per decisió de l'usuari, 2026-10-16: «a la Caixa fer subgrups: la Base amb les seves opcions, després el Fons, després la Tapa, després el Front»." }, [
  field("module.carcass.support", "Suport", {
    code: UI.carcass,
    control: "text",
    showIf: "Mòdul de terra: què hi ha (el del moble) i el botó «Modificar opció global», que porta al Moble › Suport general. Penjat: text «Penjat a la paret, a H mm del terra», es canvia a Posició. L'electrodomèstic de terra no en té (ho diu la nota).",
    note: "Per decisió de l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per a cada un»; 2026-10-16: «les opcions que siguin globals no repetir-les ni posar un missatge, sinó un botó que digui modificar opció global». Suport, alçada i pota es trien només al Moble › Suport general.",
  }),
  field("module.carcass.hanger", "Penjadors", {
    code: UI.base,
    control: "hardware",
    showIf: "Tipus = Penjat",
    defaultText: AS_MODULE,
    choices: [{ value: "inherit", label: "Com el mòdul o un penjador", reveals: ["module.carcass.wallRail"] }, { value: "none", label: "Cap", hides: ["module.carcass.wallRail"] }],
    issue: HUNG_SIDES,
  }, [
    field("module.carcass.wallRail", "Regleta", { code: UI.base, control: "hardware", showIf: "Penjadors ≠ Cap", defaultText: AS_MODULE, issue: "Mateix problema que Penjadors: sense laterals no compta." }),
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
    field("module.carcass.grooveClearance", "Joc de la ranura", {
      code: UI.carcass,
      control: "number",
      showIf: "Fons = En ranura",
      defaultText: FROM_PREFS_GAPS,
      issue: `Glossari: «Joc» és només el joc paramètric del fabricant; una separació és una «Folgança» (l'ajuda de Preferències en diu folgança). A més, ${RAW_BACK}`,
    }),
    field("module.carcass.backInsetSetback", "Retirada del fons", { code: UI.carcass, control: "number", showIf: "Fons = Encastat", default: 0, issue: RAW_BACK }),
  ]),
  ]),
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
      { value: "grille", label: "Reixeta" },
      { value: "none", label: "Sense tapa" },
    ],
  }, [
    field("module.carcass.ventGap", "Ranura d'aire", { code: UI.carcass, control: "number", showIf: "Tapa = Ranura d'aire", default: 60 }),
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
  ]),
  ]),
  section("module.carcass.sidesGroup", "Laterals", { icon: "subsection", code: UI.carcass, note: "Laterals, Parets i Cantonades (en depenen)." }, [
  field("module.carcass.sides", "Laterals", {
    code: UI.carcass,
    control: "choice",
    showIf: `${BY_APPLIANCE} Abans de Parets i Cantonades (en depenen).`,
    default: "both",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [{ value: "none", label: "Cap" }, { value: "left", label: "Esquerre" }, { value: "right", label: "Dret" }, { value: "both", label: "Els dos" }],
    note: "A l'inspector, dos interruptors: Esquerre · Dret. Al nínxol d'un electrodomèstic de terra, «Laterals de remat»: una peça sola a l'extrem de la cuina.",
  }),
  field("module.carcass.hollow", "Parets", {
    code: UI.carcass,
    control: "switch",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "Buides (gruix aparent)", reveals: ["module.carcass.hollowThickness"], note: "Cantonades passa a text «A inglet»" }],
    showIf: "No és el nínxol d'un electrodomèstic de terra (rentaplats, rentadora, frigorífic sota taulell)",
    issue: "(menor) Surt també sense laterals, base ni tapa, quan no hi ha cap paret a fer buida.",
  }, [field("module.carcass.hollowThickness", "Gruix aparent", { code: UI.carcass, control: "number", showIf: "Parets buides", defaultText: "El més gran de 60 i 2 × gruix + 20" })]),
  field("module.carcass.joint", "Cantonades", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun lateral i tapa, o base sense sòcol (la condició de la construcció, `jointApplies`); amb parets buides, text «A inglet»",
    default: "butt",
    defaultEditable: true,
    choices: [{ value: "butt", label: "Normals" }, { value: "mitre", label: "A inglet" }],
  }),
  ]),
  section("module.carcass.frontsGroup", "Fronts", { icon: "subsection", code: UI.carcass, note: "L'estil i les folgances de tots els fronts del mòdul i el retranqueig dels prestatges." }, [
  field("module.carcass.frontStyle", "Estil dels fronts", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun front que es fa (també front fix, reixeta o front de moble), de qualsevol compartiment o de Mòdul › Portes; no al nínxol d'un electrodomèstic de terra (el front de moble va per davant, recobrent)",
    default: "overlay",
    defaultEditable: true,
    choices: [{ value: "overlay", label: "Recobrents" }, { value: "inset", label: "Encastats" }],
    issue: BELOW_DOORS,
  }),
  field("module.carcass.outerGap", "Folgança front–cos", { code: UI.carcass, control: "number", showIf: "Com l'Estil dels fronts", defaultText: FROM_PREFS_GAPS, issue: "Mateixa dependència de Mòdul › Portes (més avall)." }),
  field("module.carcass.betweenGap", "Folgança entre fronts", { code: UI.carcass, control: "number", showIf: "Dues portes, dos o més calaixos, o un front recobrent que no és a l'arrel", defaultText: FROM_PREFS_GAPS, issue: "Mateixa dependència de Mòdul › Portes «Dues» (més avall)." }),
  field("module.carcass.shelfSetback", "Retranqueig dels prestatges", { code: UI.carcass, control: "number", showIf: "Algun compartiment amb tira LED, o prestatges (sense calaixos) que no van a ras o que un front encastat bloqueja", defaultText: FROM_PREFS_GAPS }),
  ]),
])
