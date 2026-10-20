import { applianceNodes } from "./moduleOptions"
import { AS_MODULE, STRUCTURAL, UI, field, group, section } from "./optionTypes"

const S32 = "La de tot el mòdul (`module.hardware.system32`): surt on la fan servir, als Prestatges (regulables) o al Front (després de la Frontissa d'una porta de fusta o d'una reixeta amb frontisses), mai a tots dos."

const door = group("zone.front.door", "Porta", { code: UI.frontFields, showIf: "Contingut = Porta (també el Front d'una zona dividida = Una o Dues)" }, [
  field("zone.front.door.mode", "Portes", {
    code: UI.frontFields,
    control: "choice",
    showIf: "No al Front d'una zona dividida (allà es tria a dalt)",
    default: "single",
    defaultEditable: true,
    choices: [
      { value: "single", label: "Una", reveals: ["zone.front.door.hingeSide"] },
      { value: "double", label: "Dues", hides: ["zone.front.door.hingeSide"], note: "si hi ha lateral o divisor als dos costats" },
    ],
  }),
  field("zone.front.door.hingeSide", "Frontisses", {
    code: UI.frontFields,
    control: "choice",
    showIf: "Una porta; només els costats amb lateral o divisor",
    default: "left",
    defaultEditable: true,
    choices: [{ value: "left", label: "Esquerra" }, { value: "right", label: "Dreta" }],
  }),
  field("zone.front.door.glass", "Front", {
    code: UI.frontFields,
    control: "choice",
    default: "wood",
    defaultEditable: true,
    choices: [{ value: "wood", label: "Fusta" }, { value: "glass", label: "Vidre", reveals: ["zone.front.door.frame"], hides: ["zone.system32"], note: "frontissa i tirador, només els de marc d'alumini" }],
    note: "Cas 10 del model únic: la mateixa fila «Front: Fusta · Vidre» que als calaixos i a l'abatible. El vidre de la porta va en un marc d'alumini (s'hi claven les frontisses); el del calaix, en ranura (decisió de l'usuari, 2026-10-20).",
  }),
  field("zone.front.door.frame", "Marc", { code: UI.frontFields, control: "hardware", showIf: "Front: Vidre", defaultText: AS_MODULE }),
  field("zone.front.door.hinge", "Frontissa", { code: UI.frontFields, control: "hardware", defaultText: AS_MODULE }),
  field("zone.front.door.handle", "Tirador", { code: UI.frontFields, control: "hardware", defaultText: AS_MODULE, note: "«Cap (push)»: cap forat." }),
])

const drawers = group("zone.front.drawers", "Calaixos", { code: UI.frontFields, showIf: "Contingut = Calaixos" }, [
  field("zone.front.drawers.count", "Calaixos", { code: UI.frontFields, control: "number", range: { min: 1, max: 10, step: 1, suffix: "u" }, default: 3, defaultEditable: true, hideable: false, why: STRUCTURAL }),
  section("zone.front.drawers.heights", "Alçada dels calaixos", { icon: "subsection", code: UI.frontFields, showIf: "Més d'un calaix" }, [
    field("zone.front.drawers.height", "Alçada 1…n", { code: UI.drawers, control: "number", defaultText: "Auto (l'última, el que sobra)" }),
  ]),
  field("zone.front.drawers.face", "Front", { code: UI.frontFields, control: "choice", default: "wood", choices: [{ value: "wood", label: "Fusta" }, { value: "glass", label: "Vidre" }, { value: "kit", label: "Metàl·lic (del joc)" }], note: "Per decisió de l'usuari, 2026-10-20: el vidre és el front, en ranura als laterals del calaix, sense marc (amb un joc, al lloc del front); el metàl·lic, el del fabricant del joc (2026-10-16). Les combinacions que no es poden fer avisen a sota." }),
  field("zone.front.drawers.setback", "Retirada", { code: UI.frontFields, control: "number", range: { min: 0, max: 300, step: 1, suffix: "mm" }, default: 0, note: "Per decisió de l'usuari, 2026-10-20: una opció de tots els calaixos; no es retiren sols darrere d'una porta (avís a sota)." }),
  field("zone.front.drawers.slide", "Guia de calaix", {
    code: UI.frontFields,
    control: "hardware",
    defaultText: AS_MODULE,
    choices: [
      { value: "slide", label: "Una guia", hides: ["zone.front.drawers.kit", "zone.front.drawers.slides"] },
      { value: "kit", label: "Un joc de calaix (doble paret)", reveals: ["zone.front.drawers.kit", "zone.front.drawers.slides"] },
    ],
  }, [
    field("zone.front.drawers.slides", "Guia del calaix 2…n", { code: UI.drawers, control: "hardware", showIf: "Joc de calaix, més d'un calaix i alguna alçada a mida", defaultText: "Com el calaix de sota" }),
  ]),
  section("zone.front.drawers.kit", "Opcions de la guia de calaix", { icon: "subsection", code: UI.frontFields, showIf: "La guia (pròpia o del mòdul) és un joc" }, [
    field("zone.front.drawers.kit.closing", "Tancament", {
      code: UI.drawers,
      control: "choice",
      defaultText: "El primer que ven el joc",
      issue: "Mateixa dada en dos llocs: el Tancament (aquí) i el «Tirador › Cap (push)» de més avall. Triar el Tirador (opció de sota) canvia el Tancament (opció de dalt): una opció de més avall modifica una de més amunt.",
    }),
    field("zone.front.drawers.kit.back", "Darrere", { code: UI.drawers, control: "choice", defaultText: "Fusta" }),
    field("zone.front.drawers.kit.finish", "Color dels laterals", { code: UI.drawers, control: "choice", showIf: "El joc té més d'un acabat" }),
    field("zone.front.drawers.kit.bottom", "Fons del calaix", { code: UI.drawers, control: "text", note: "Només es llegeix: el gruix el demana el joc." }),
    field("zone.front.drawers.kit.info", "Joc", { code: UI.drawers, control: "text", note: "NL, números d'article i peces de fusta que ha fet la construcció." }),
  ]),
  field("zone.front.drawers.margin", "Marge a les frontisses", { code: UI.frontSection, control: "buttons", showIf: "Tapats per una porta amb frontisses al costat", note: "Per decisió de l'usuari, 2026-10-20: drecera que divideix la zona amb una zona oberta de 50 mm al costat de la frontissa (`addSideMargin`)." }),
  field("zone.front.drawers.handle", "Tirador", { code: UI.frontFields, control: "hardware", defaultText: AS_MODULE }),
  section("zone.front.drawers.handleOptions", "Opcions del tirador", { icon: "subsection", code: UI.frontFields, showIf: "Amb tirador (ni push del joc ni «Cap (push)»)" }, [
    field("zone.front.drawers.handlePosition", "Posició del tirador", {
      code: UI.frontFields,
      control: "choice",
      default: "center",
      choices: [{ value: "center", label: "Centrat", hides: ["zone.front.drawers.handleTop"] }, { value: "top", label: "A dalt", reveals: ["zone.front.drawers.handleTop"] }],
    }),
    field("zone.front.drawers.handleTop", "Des de dalt", { code: UI.frontFields, control: "number", showIf: "Posició = A dalt", default: 40 }),
  ]),
])

const flap = group("zone.front.flap", "Abatible", { code: UI.frontFields, showIf: "Contingut = Abatible" }, [
  field("zone.front.flap.dir", "Obre cap a", { code: UI.frontFields, control: "choice", default: "down", defaultEditable: true, choices: [{ value: "down", label: "Avall" }, { value: "up", label: "Amunt" }] }),
  field("zone.front.flap.glass", "Front", { code: UI.frontFields, control: "choice", default: "wood", choices: [{ value: "wood", label: "Fusta" }, { value: "glass", label: "Vidre", reveals: ["zone.front.flap.frame"], hides: ["zone.front.flap.handleOptions"] }], note: "Cas 10 del model únic: com la porta (marc d'alumini)." }),
  field("zone.front.flap.frame", "Marc", { code: UI.frontFields, control: "hardware", showIf: "Front: Vidre", defaultText: AS_MODULE }),
  field("zone.front.flap.arm", "Braç d'abatible", { code: UI.frontFields, control: "hardware", defaultText: AS_MODULE }),
  field("zone.front.flap.handle", "Tirador", { code: UI.frontFields, control: "hardware", defaultText: AS_MODULE }),
  section("zone.front.flap.handleOptions", "Opcions del tirador", { icon: "subsection", code: UI.frontFields, showIf: "Sense vidre i amb tirador" }, [
    field("zone.front.flap.handleInset", "Des del cantell", { code: UI.frontFields, control: "number", defaultText: "La del tirador" }),
  ]),
])

const grille = group("zone.front.grille", "Reixeta", { code: UI.frontFields, showIf: "Contingut = Reixeta" }, [
  field("zone.front.grille.pattern", "Patró", {
    code: UI.frontFields,
    control: "choice",
    default: "slotsV",
    defaultEditable: true,
    choices: [
      { value: "slotsV", label: "Ranures verticals", reveals: ["zone.front.grille.slots"] },
      { value: "slotsH", label: "Ranures horitzontals", reveals: ["zone.front.grille.slots"] },
      { value: "holes", label: "Forats al tresbolillo", reveals: ["zone.front.grille.holes"], hides: ["zone.front.grille.slots"] },
    ],
  }),
  field("zone.front.grille.mount", "Muntatge", {
    code: UI.frontFields,
    control: "choice",
    default: "removable",
    defaultEditable: true,
    choices: [
      { value: "removable", label: "Imants", reveals: ["zone.front.grille.magnet"] },
      { value: "hinged", label: "Frontisses", reveals: ["zone.front.grille.hingeSide", "zone.system32"], note: "si hi ha lateral o divisor" },
    ],
  }),
  field("zone.front.grille.hingeSide", "Frontisses", {
    code: UI.frontFields,
    control: "choice",
    showIf: "Muntatge = Frontisses; només els costats amb lateral o divisor",
    default: "left",
    choices: [{ value: "left", label: "Esquerra" }, { value: "right", label: "Dreta" }],
    note: "Com a la porta (2026-10-20; abans no es podia triar i quedava a l'esquerra). La frontissa és la del mòdul.",
  }),
  field("zone.front.grille.holes", "Diàmetre forat · Pas", { code: UI.frontFields, control: "number", showIf: "Patró = Forats", defaultText: "10 · 16 mm" }),
  field("zone.front.grille.slots", "Ranura · Separació", { code: UI.frontFields, control: "number", showIf: "Patró = Ranures", defaultText: "8 · 8 mm" }),
  field("zone.front.grille.margin", "Marge", { code: UI.frontFields, control: "number", default: 60 }),
  field("zone.front.grille.hatch", "Trapa", {
    code: UI.frontFields,
    control: "switch",
    default: false,
    choices: [{ value: "on", label: "Trapa petita (clau del radiador)", reveals: ["zone.front.grille.hatchSize", "zone.front.grille.magnet"] }],
  }, [field("zone.front.grille.hatchSize", "Trapa X · Y · Ample · Alt", { code: UI.frontFields, control: "number", defaultText: "100 · 100 · 150 · 150 mm" })]),
  field("zone.front.grille.magnet", "Imant", { code: UI.frontFields, control: "hardware", showIf: "Muntatge = Imants, o amb Trapa", defaultText: AS_MODULE }),
])

const panel = group("zone.front.panel", "Front fix", { code: UI.frontFields, showIf: "Contingut = Front fix" }, [
  field("zone.front.panel.setback", "Retirada", { code: UI.frontFields, control: "number", range: { min: 0, max: 300, step: 1, suffix: "mm" }, default: 0, note: "Per decisió de l'usuari, 2026-10-20: amb retirada, dins de la llum i retirat del davant (el sòcol fet amb una divisió)." }),
])

const front = section("zone.front", "Front", {
  icon: "front",
  code: UI.frontSection,
  hideable: false,
  why: STRUCTURAL,
  showIf: "Qualsevol zona sense un aparell que l'ocupi (regla 1 del model únic). Dividida: només els fronts que la poden tapar (Porta, Abatible, Reixeta, Front fix). Tapada per un front de més amunt: es tria igual i es fa per dins.",
}, [
  field("zone.front.kind", "Contingut", {
    code: UI.frontSection,
    control: "choice",
    default: "none",
    defaultEditable: true,
    hideable: false,
    why: STRUCTURAL,
    choices: [
      { value: "none", label: "Obert" },
      { value: "door", label: "Porta", reveals: ["zone.front.door"], note: "aguantat pels quatre costats i amb lateral o divisor a un costat" },
      { value: "drawers", label: "Calaixos", reveals: ["zone.front.drawers"], hides: ["zone.shelves", "module.carcass.shelfSetback"], note: "lateral o divisor als dos costats" },
      { value: "flap", label: "Abatible", reveals: ["zone.front.flap"] },
      { value: "grille", label: "Reixeta", reveals: ["zone.front.grille"] },
      { value: "panel", label: "Front fix", reveals: ["zone.front.panel"], hides: ["zone.shelves", "zone.divide"] },
      { value: "appliance", label: "Electrodomèstic", reveals: ["zone.appliance"], note: "compartiment d'un mòdul dividit (per decisió de l'usuari, 2026-10-20)" },
    ],
    note: "Només els fronts que s'hi poden fixar (el triat surt sempre).",
  }),
  door,
  drawers,
  flap,
  grille,
  panel,
])

const shelves = group("zone.shelves", "Opcions de l'interior", {
  icon: "shelves",
  code: UI.shelves,
  showIf: "Dins del Front, a sota del «Contingut» (canvien amb el contingut triat). Compartiment sense dividir, sense aparell que l'ocupi, amb lateral o divisor als dos costats; ni amb Calaixos ni Front fix",
  note: "Per decisió de l'usuari, 2026-10-20: sense secció pròpia, a sota de la tria del contingut.",
}, [
  section("zone.shelves.shelvesGroup", "Prestatges", { icon: "subsection", code: UI.shelves, showIf: "Amb lateral o divisor als dos costats" }, [
  field("zone.shelves.count", "Prestatges", {
    code: UI.shelves,
    control: "number",
    range: { min: 0, max: 20, step: 1, suffix: "u" },
    default: 0,
    defaultEditable: true,
    choices: [{ value: ">0", label: "1 o més", reveals: ["zone.shelves.flush", "zone.shelves.thick"] }],
  }),
  field("zone.shelves.adjustable", "Regulació", {
    code: UI.shelves,
    control: "switch",
    default: true,
    defaultEditable: true,
    choices: [{ value: "on", label: "Regulables", reveals: ["zone.system32"] }],
  }),
  field("zone.shelves.flush", "Davant", {
    code: UI.shelves,
    control: "switch",
    showIf: "Prestatges > 0",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "A ras del davant (a sang)", hides: ["zone.shelves.setback"] }],
    issue: "(menor) Surt també quan no compta: amb fronts Encastats (Mòdul › Caixa) i el compartiment amb front o tapat, la construcció retira igualment els prestatges i el «a ras» no fa res (només un avís).",
  }),
  field("zone.shelves.setback", "Retirada", {
    code: UI.shelves,
    control: "number",
    showIf: "Prestatges > 0 i no a ras del davant",
    range: { min: 0, max: 300, step: 1, suffix: "mm" },
    defaultText: "Com el mòdul (Caixa › Retirada dels prestatges)",
  }),
  field("zone.shelves.thick", "Gruix", {
    code: UI.shelves,
    control: "switch",
    showIf: "Prestatges > 0",
    default: false,
    choices: [{ value: "on", label: "Gruixuts (buits)", reveals: ["zone.shelves.thickness"] }],
  }, [field("zone.shelves.thickness", "Gruix aparent", { code: UI.shelves, control: "number", defaultText: "Cas 9 del model únic: el mateix a les parets, els prestatges i els divisors (`HollowRows`): el més gran de 50 i 2 × tauler + 12; mínim 2 × tauler + 6" })]),
  ]),
  section("zone.shelves.accessoriesGroup", "Accessoris", { icon: "subsection", code: UI.shelves }, [
  field("zone.shelves.rail", "Penjar", {
    code: UI.shelves,
    control: "switch",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "Barra de penjar", reveals: ["zone.shelves.railHardware"] }],
  }, [field("zone.shelves.railHardware", "Ferratge", { code: UI.shelves, control: "hardware", defaultText: AS_MODULE })]),
  field("zone.shelves.led", "Llum", {
    code: UI.shelves,
    control: "switch",
    default: false,
    defaultEditable: true,
    choices: [{ value: "on", label: "Tira LED", reveals: ["zone.shelves.ledHardware"] }],
  }, [field("zone.shelves.ledHardware", "Ferratge", { code: UI.shelves, control: "hardware", defaultText: AS_MODULE })]),
  ]),
])

/** Compartiment (l'«Interior» o una zona d'una divisió). */
export const ZONE = group("zone", "Compartiment", { icon: "zone", code: UI.sections, showIf: "Un compartiment seleccionat (l'«Interior» o una zona)" }, [
  applianceNodes(),
  front,
  shelves,
  field("zone.system32", "Filera System 32", { code: UI.pick, control: "hardware", showIf: S32, defaultText: "La de Preferències › Ferratges" }),
  section("zone.divide", "Dividir", {
    icon: "divide",
    code: UI.zonePanel,
    showIf: "Compartiment sense dividir, amb on unir el divisor (vertical: peça a sota i a sobre; horitzontal: lateral o divisor als dos costats), no darrere d'un front fix ni amb un aparell que l'ocupi",
    control: "buttons",
    choices: [{ value: "v", label: "En vertical" }, { value: "h", label: "En horitzontal" }],
    issue: "(dades) Dividir passa al primer fill els prestatges, el front, la barra i l'aparell però no la llum (`led`): dividir un compartiment amb Llum la perd.",
    why: "Amagada, no es pot dividir cap compartiment (els dividits continuen igual).",
  }),
  section("zone.split", "Divisió vertical / horitzontal", { icon: "split", code: UI.zonePanel, showIf: "Compartiment dividit (és l'única secció)", hideable: false, why: STRUCTURAL }, [
    field("zone.split.sizes", "Amplada / Alçada 1…n", { code: UI.split, control: "number", defaultText: "Totes «Auto» (l'última, el que sobra)", hideable: false, why: STRUCTURAL }),
    field("zone.split.thick", "Gruix", {
      code: UI.split,
      control: "switch",
      default: false,
      choices: [{ value: "on", label: "Gruixuts (buits)", reveals: ["zone.split.thickness"] }],
      note: "Per petició de l'usuari, 2026-10-20: «al fer divisions ficar l'opció de gruixuts (buits)». Els divisors (o prestatges fixos) de la divisió, fets com els prestatges gruixuts: dues pells, llistons i una tira al davant (`Zone.split.thickness`).",
    }, [field("zone.split.thickness", "Gruix aparent", { code: UI.split, control: "number", defaultText: "Cas 9 del model únic: el mateix a les parets, els prestatges i els divisors (`HollowRows`): el més gran de 50 i 2 × tauler + 12; mínim 2 × tauler + 6" })]),
    field("zone.split.innerClearance", "Peces de dins", { code: UI.carcass, control: "number", showIf: "L'«Interior» dividit", defaultText: "Preferències › Folgances per defecte" }),
  ]),
])
