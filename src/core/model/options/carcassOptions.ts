import { AS_MODULE, STRUCTURAL, UI, field, section } from "./optionTypes"

const FROM_PREFS_GAPS = "Preferències › Folgances per defecte"
const BY_APPLIANCE = "Si l'electrodomèstic que és el mòdul la fixa, surt com a text (amb el perquè a l'ajuda)."
const RAW_BACK = "`moduleRows().back` llegeix el fons de l'usuari sense `visibleModule`. Amb un electrodomèstic que fixa «Sense fons» (rentaplats, rentadora, frigorífic sota taulell; microones penjat), la fila Fons diu «Sense fons» però si el fons de l'usuari era en ranura surten igualment «Ranura del fons» i «Joc de la ranura» (o «Retirada del fons» si era encastat), que la construcció no fa servir."
const BELOW_DOORS = "Depèn d'una opció de MÉS AVALL a la mateixa pantalla: Mòdul › Portes (secció posterior a la Caixa) la fa aparèixer. La regla «cada opció depèn només de les de més amunt» no es compleix dins de l'inspector del mòdul."
const HUNG_SIDES = "Surt amb qualsevol caixa penjada, però la construcció només en fa servir amb laterals (`usedHardwareSlots`). Un mòdul nou penjat (sense laterals) ensenya Penjadors i Regleta que no compten; a més depèn de «Laterals», que és més avall a la Caixa."

/** Mòdul › Caixa, en l'ordre de l'inspector (`CarcassForm`, opcions en cascada). */
export const CARCASS = section("module.carcass", "Caixa", { icon: "carcass", code: UI.sections, hideable: false, why: STRUCTURAL, note: "Insígnia «Recobrents»/«Encastats» si hi ha fronts. Les parts que fixa l'electrodomèstic que és el mòdul surten com a text." }, [
  field("module.carcass.support", "Suport", {
    code: UI.carcass,
    control: "choice",
    showIf: `No penjat (penjat: text «Penjat a la paret, a H mm del terra», es canvia a Posició). ${BY_APPLIANCE}`,
    default: "none",
    defaultEditable: true,
    choices: [
      { value: "none", label: "Directe a terra", reveals: ["module.carcass.bottom"] },
      { value: "plinth", label: "Sòcol", reveals: ["module.carcass.bottom", "module.carcass.plinthHeight", "module.carcass.plinthSetback"] },
      { value: "legs", label: "Potes", reveals: ["module.carcass.legHeight", "module.carcass.leg", "module.carcass.legPlinth", "module.carcass.underLight"], hides: ["module.carcass.bottom"], note: "la base passa a text «Sencera»" },
    ],
  }, [
    field("module.carcass.plinthHeight", "Alçada sòcol", { code: UI.carcass, control: "number", showIf: "Suport = Sòcol", range: { min: 20, max: 300, step: 5, suffix: "mm" }, default: 60, defaultEditable: true }),
    field("module.carcass.plinthSetback", "Retranqueig", {
      code: UI.carcass,
      control: "number",
      showIf: "Suport = Sòcol",
      range: { min: 0, max: 100, step: 5, suffix: "mm" },
      default: 30,
      defaultEditable: true,
      issue: "Glossari/etiquetes: el mateix concepte (retirada del sòcol respecte del davant) es diu «Retranqueig» amb Suport Sòcol i «Retirada del sòcol» amb Potes; «Retranqueig» també és el dels prestatges.",
    }),
    field("module.carcass.legHeight", "Alçada potes", { code: UI.carcass, control: "number", showIf: "Suport = Potes", range: { min: 20, max: 400, step: 5, suffix: "mm" }, default: 100, defaultEditable: true }),
    field("module.carcass.leg", "Pota", { code: UI.carcass, control: "hardware", showIf: "Suport = Potes, i hi ha potes a la biblioteca o el mòdul en porta una", defaultText: "Genèriques" }, [
      field("module.carcass.legInset", "Potes al davant", { code: UI.carcass, control: "number", showIf: "Una pota amb distància pròpia al davant (AXILO 78)" }),
    ]),
    field("module.carcass.legPlinth", "Sòcol", {
      code: UI.carcass,
      control: "switch",
      showIf: "Suport = Potes",
      default: false,
      choices: [{ value: "on", label: "Davant de les potes", reveals: ["module.carcass.legPlinthSetback", "module.carcass.legPlinthType", "module.carcass.legPlinthSides"] }],
    }, [
      field("module.carcass.legPlinthSetback", "Retirada del sòcol", { code: UI.carcass, control: "number", defaultText: "Calculada: el peu de la pota del davant just darrere del sòcol" }),
      field("module.carcass.legPlinthType", "Tipus de sòcol", {
        code: UI.base,
        control: "hardware",
        defaultText: "Fusta (el tauler del cos)",
        choices: [
          { value: "wood", label: "Fusta (el tauler del cos)", reveals: ["module.carcass.legPlinthCorners"] },
          { value: "alu", label: "Un sòcol d'alumini de la biblioteca", hides: ["module.carcass.legPlinthCorners"] },
        ],
      }),
      field("module.carcass.legPlinthSides", "Costats", {
        code: UI.base,
        control: "choice",
        default: "front",
        choices: [
          { value: "front", label: "Davant", hides: ["module.carcass.legPlinthSideSetback", "module.carcass.legPlinthCorners"] },
          { value: "left", label: "+ esquerre", reveals: ["module.carcass.legPlinthSideSetback", "module.carcass.legPlinthCorners"] },
          { value: "right", label: "+ dret", reveals: ["module.carcass.legPlinthSideSetback", "module.carcass.legPlinthCorners"] },
          { value: "sides", label: "+ laterals", reveals: ["module.carcass.legPlinthSideSetback", "module.carcass.legPlinthCorners"] },
          { value: "all", label: "Tot el voltant", reveals: ["module.carcass.legPlinthSideSetback", "module.carcass.legPlinthCorners"] },
        ],
      }, [
        field("module.carcass.legPlinthSideSetback", "Retirada dels costats", { code: UI.base, control: "number", showIf: "Costats ≠ Davant", defaultText: "La retirada del sòcol" }),
        field("module.carcass.legPlinthCorners", "Cantonades", {
          code: UI.base,
          control: "choice",
          showIf: "Costats ≠ Davant i sòcol de fusta",
          default: "butt",
          choices: [{ value: "butt", label: "A tope" }, { value: "mitre", label: "A inglet" }],
          issue: "Dues files amb la mateixa etiqueta «Cantonades» a la mateixa secció Caixa per a dues decisions diferents (la del sòcol i la de la caixa). Una paraula, una cosa.",
        }),
      ]),
    ]),
  ]),
  field("module.carcass.hanger", "Penjadors", {
    code: UI.base,
    control: "hardware",
    showIf: "Fila = Penjat",
    defaultText: AS_MODULE,
    choices: [{ value: "inherit", label: "Com el mòdul o un penjador", reveals: ["module.carcass.wallRail"] }, { value: "none", label: "Cap", hides: ["module.carcass.wallRail"] }],
    issue: HUNG_SIDES,
  }, [
    field("module.carcass.wallRail", "Regleta", { code: UI.base, control: "hardware", showIf: "Penjadors ≠ Cap", defaultText: AS_MODULE, issue: "Mateix problema que Penjadors: sense laterals no compta." }),
  ]),
  field("module.carcass.bottom", "Base", {
    code: UI.carcass,
    control: "choice",
    showIf: `Suport ≠ Potes (amb potes, text «Sencera»). ${BY_APPLIANCE}`,
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
    showIf: "Penjat o amb potes, i amb base",
    default: false,
    choices: [{ value: "on", label: "Sota la base", reveals: ["module.carcass.underLightHardware"] }],
  }, [field("module.carcass.underLightHardware", "Llum", { code: UI.carcass, control: "hardware", showIf: "Llum a sota", defaultText: AS_MODULE })]),
  field("module.carcass.back", "Fons", {
    code: UI.carcass,
    control: "choice",
    showIf: BY_APPLIANCE,
    default: "none",
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
  field("module.carcass.top", "Tapa", {
    code: UI.carcass,
    control: "choice",
    showIf: BY_APPLIANCE,
    default: "none",
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
  field("module.carcass.sides", "Laterals", {
    code: UI.carcass,
    control: "choice",
    showIf: `${BY_APPLIANCE} Abans de Parets i Cantonades (en depenen).`,
    default: "none",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [{ value: "none", label: "Cap" }, { value: "left", label: "Esquerre" }, { value: "right", label: "Dret" }, { value: "both", label: "Els dos" }],
    note: "A l'inspector, dos interruptors: Esquerre · Dret.",
  }),
  field("module.carcass.hollow", "Parets", {
    code: UI.carcass,
    control: "switch",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "Buides (gruix aparent)", reveals: ["module.carcass.hollowThickness"], note: "Cantonades passa a text «A inglet»" }],
    issue: "(menor) Surt sempre, també sense laterals, base ni tapa (p. ex. un nínxol d'electrodomèstic), quan no hi ha cap paret a fer buida.",
  }, [field("module.carcass.hollowThickness", "Gruix aparent", { code: UI.carcass, control: "number", showIf: "Parets buides", defaultText: "El més gran de 60 i 2 × gruix + 20" })]),
  field("module.carcass.joint", "Cantonades", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun lateral i tapa, o base sense sòcol (la condició de la construcció, `jointApplies`); amb parets buides, text «A inglet»",
    default: "butt",
    defaultEditable: true,
    choices: [{ value: "butt", label: "Normals" }, { value: "mitre", label: "A inglet" }],
  }),
  field("module.carcass.frontStyle", "Estil dels fronts", {
    code: UI.carcass,
    control: "choice",
    showIf: "Algun front que es fa (també front fix, reixeta o front de moble), de qualsevol compartiment o de Mòdul › Portes",
    default: "overlay",
    defaultEditable: true,
    choices: [{ value: "overlay", label: "Recobrents" }, { value: "inset", label: "Encastats" }],
    issue: BELOW_DOORS,
  }),
  field("module.carcass.outerGap", "Folgança front–cos", { code: UI.carcass, control: "number", showIf: "Com l'Estil dels fronts", defaultText: FROM_PREFS_GAPS, issue: "Mateixa dependència de Mòdul › Portes (més avall)." }),
  field("module.carcass.betweenGap", "Folgança entre fronts", { code: UI.carcass, control: "number", showIf: "Dues portes, dos o més calaixos, o un front recobrent que no és a l'arrel", defaultText: FROM_PREFS_GAPS, issue: "Mateixa dependència de Mòdul › Portes «Dues» (més avall)." }),
  field("module.carcass.shelfSetback", "Retranqueig dels prestatges", { code: UI.carcass, control: "number", showIf: "Algun compartiment amb tira LED, o prestatges (sense calaixos) que no van a ras o que un front encastat bloqueja", defaultText: FROM_PREFS_GAPS }),
])
