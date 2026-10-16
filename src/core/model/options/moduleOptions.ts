import { AS_MODULE, STRUCTURAL, UI, field, group, section, type OptionNode } from "./optionTypes"

/** Mòdul › Tipus, Mides i Electrodomèstic (dades del registre de les opcions en cascada). */
const type = section("module.type", "Tipus", { icon: "type", code: UI.type, hideable: false, why: STRUCTURAL, note: "Per decisió de l'usuari, 2026-10-16: «primer Tipus, on només es pot triar si és moble o electrodomèstic»; on va (a terra, penjat), a Posició." }, [
  field("module.type.kind", "Tipus", {
    code: UI.type,
    control: "choice",
    default: "moble",
    hideable: false,
    why: STRUCTURAL,
    choices: [
      { value: "moble", label: "Moble" },
      { value: "appliance", label: "Electrodomèstic", reveals: ["module.type.appliance"], note: "no amb l'Interior dividit (es tria a cada compartiment)" },
    ],
  }),
  field("module.type.appliance", "Aparell", {
    code: UI.type,
    control: "hardware",
    showIf: "Tipus = Electrodomèstic",
    defaultText: "Tria l'aparell",
    note: "Per decisió de l'usuari, 2026-10-15: «quan és baix o penjat no poden sortir electrodomèstics»: tots es trien aquí (també la placa i la campana, que conserven l'Interior). Les opcions del front de moble, a la Caixa. Un aparell penjat (microones) penja el mòdul.",
  }),
])

const position = section("module.position", "Posició", { icon: "position", code: UI.type, hideable: false, why: STRUCTURAL, note: "Com abans del 2026-10-15 (per decisió de l'usuari, 2026-10-16). El mòdul de darrere d'una illa no té les opcions (es col·loca sol)." }, [
  field("module.position.mount", "Fila", {
    code: UI.sections,
    control: "choice",
    default: "wall",
    hideable: false,
    why: STRUCTURAL,
    choices: [
      { value: "wall", label: "Arrambat a la paret", reveals: ["module.position.gap"] },
      { value: "hung", label: "Penjat", reveals: ["module.position.height", "module.carcass.hanger", "module.carcass.underLight"], note: "a 1450 mm del terra, amb el fons retirat per al penjador" },
      { value: "floor", label: "Lliure al terra", reveals: ["module.position.wallGap", "module.position.turned", "module.position.x"], hides: ["module.position.gap"] },
    ],
  }),
  field("module.position.height", "Alçada del terra", { code: UI.sections, control: "number", showIf: "Fila = Penjat", range: { min: 0, max: 2800, step: 10, suffix: "mm" }, default: 1450, hideable: false, why: STRUCTURAL }),
  field("module.position.wallGap", "Separació de la paret", { code: UI.sections, control: "number", showIf: "Lloc = Lliure al terra", range: { min: 0, max: 10000, step: 10, suffix: "mm" }, default: 0 }),
  field("module.position.turned", "Girat", { code: UI.sections, control: "switch", showIf: "Lloc = Lliure al terra", default: false }),
  field("module.position.x", "De costat (X)", { code: UI.sections, control: "number", showIf: "Fora de la fila (Lliure al terra, amb X pròpia)", hideable: false, why: STRUCTURAL }),
  field("module.position.gap", "Separació des de l'inici / amb l'anterior", { code: UI.sections, control: "number", showIf: "A la fila (sense X pròpia); l'etiqueta diu si és el primer", range: { min: 0, max: 5000, step: 10, suffix: "mm" }, default: 0 }),
])

const dims = section("module.dims", "Mides", { icon: "dims", code: UI.inspector, hideable: false, why: STRUCTURAL }, [
  field("module.dims.width", "Amplada", { code: UI.carcass, control: "number", range: { min: 100, max: 3000, step: 10, suffix: "mm" }, default: 600, defaultEditable: true, hideable: false, why: STRUCTURAL }),
  field("module.dims.height", "Alçada", { code: UI.carcass, control: "number", range: { min: 100, max: 2800, step: 10, suffix: "mm" }, default: 720, defaultEditable: true, hideable: false, why: STRUCTURAL }),
  field("module.dims.depth", "Fondària", { code: UI.carcass, control: "number", range: { min: 100, max: 1200, step: 10, suffix: "mm" }, default: 580, defaultEditable: true, hideable: false, why: STRUCTURAL }),
])

/**
 * Les opcions del front de moble de l'electrodomèstic (en cascada sota l'aparell): al compartiment, a la seva secció; al
 * mòdul Electrodomèstic, a la Caixa (l'aparell es tria a Tipus).
 */
export function applianceFrontFields(at: "module" | "zone"): OptionNode[] {
  const id = (k: string) => `${at}.appliance.${k}`
  const issueFront = "L'etiqueta de la fila és «Front» però el glossari reserva «Front» per al front del compartiment i diu que el de l'aparell és el «Front de moble». Confusió possible amb la secció Front."
  const issueSide = "Mateixa decisió (costat de les frontisses) amb un altre nom que a la porta («Frontisses: Esquerra · Dreta»). Etiqueta no unificada."
  return [
    field(id("front"), "Front", {
      code: UI.appliance,
      control: "switch",
      showIf: "L'aparell admet front de moble",
      default: true,
      choices: [
        { value: "on", label: "Front de moble", reveals: [id("panelMaterial"), id("hingeSide"), id("plinth"), id("handle")] },
        { value: "off", label: "L'aparell a la vista", hides: [id("panelMaterial"), id("hingeSide"), id("plinth"), id("handle")] },
      ],
      issue: issueFront,
    }),
    field(id("panelMaterial"), "Material del front", { code: UI.appliance, control: "material", showIf: "Amb front de moble", defaultText: "Com els fronts" }),
    field(id("hingeSide"), "Obre", {
      code: UI.appliance,
      control: "choice",
      showIf: "Amb front de moble i una porta que obre de costat (frigorífic, rentadora…)",
      default: "left",
      choices: [{ value: "left", label: "Esquerra" }, { value: "right", label: "Dreta" }],
      issue: issueSide,
    }),
    field(id("plinth"), "Sòcol", { code: UI.appliance, control: "number", showIf: "Amb front de moble, aparell de terra i sense peça a sota", range: { min: 0, max: 400, step: 1, suffix: "mm" }, defaultText: "L'alçada de les potes del moble (sense potes, 100)" }),
    field(id("handle"), "Tirador", { code: UI.appliance, control: "hardware", showIf: "Amb front de moble", defaultText: AS_MODULE }),
  ]
}

/** L'electrodomèstic del compartiment (d'un mòdul dividit; el del mòdul es tria a Tipus). */
export function applianceNodes(): OptionNode {
  const id = (k: string) => `zone.appliance.${k}`
  return section("zone.appliance", "Electrodomèstic", {
    icon: "appliance",
    code: UI.appliance,
    showIf: "Compartiment d'un mòdul dividit, sense dividir i no tapat per les portes del mòdul",
    note: "Si l'aparell ocupa el compartiment (no placa ni campana), no surten Front, Prestatges i accessoris ni Dividir.",
  }, [
    field(id("hardware"), "Aparell", {
      code: UI.appliance,
      control: "hardware",
      defaultText: "Cap",
      choices: [
        { value: "none", label: "Cap", hides: [id("front")] },
        { value: "item", label: "Un aparell de Preferències › Ferratges › Electrodomèstics", reveals: [id("front")] },
      ],
      why: "Amagada, no es pot posar cap electrodomèstic (els que ja hi són es conserven).",
    }),
    ...applianceFrontFields("zone"),
  ])
}

const MODULE_POSITION = [type, position, dims]

/** Mòdul › Portes, Unió i Materials. */
const MODULE_TAIL: OptionNode[] = [
  section("module.doors", "Portes", { icon: "doors", code: UI.zonePanel, showIf: "Interior dividit (sense dividir, el Front és el del compartiment)", note: "Les opcions de la porta són les mateixes que Compartiment › Front › Porta (els mateixos ids: amagar-ne una l'amaga als dos llocs)." }, [
    field("module.doors.mode", "Portes", {
      code: UI.zonePanel,
      control: "choice",
      default: "none",
      choices: [
        { value: "none", label: "Cap" },
        { value: "single", label: "Una", note: "si l'arrel es pot tapar pels quatre costats" },
        { value: "double", label: "Dues", note: "a més, lateral als dos costats" },
      ],
    }),
  ]),
  section("module.joint", "Unió", { icon: "joint", code: UI.sections, showIf: "La caixa fa espigues (tapa o base a topar amb els laterals, fons encastat ≥ 15 mm, tapa de reixeta o alguna divisió)" }, [
    field("module.joint.dowel", "Espiga", { code: UI.carcass, control: "hardware", defaultText: "La de Preferències › Ferratges" }),
  ]),
  materialsNodes("module"),
]

/** Els materials: els mateixos camps al mòdul (Mòdul › Materials) i al moble (Materials de tot el moble). */
export function materialsNodes(at: "module" | "moble"): OptionNode {
  const id = (k: string) => `${at}.materials.${k}`
  const prefs = "Preferències › Materials (per defecte als mòduls nous)"
  const moble = at === "moble"
  return section(`${at}.materials`, moble ? "Materials de tot el moble" : "Materials", {
    icon: "materials",
    code: moble ? UI.inspector : UI.sections,
    showIf: moble ? "Moble amb mòduls (el que es tria va a tots)" : undefined,
  }, [
    field(id("body"), "Cos", { code: UI.carcass, control: "material", defaultText: prefs }),
    field(id("thickness"), "Gruix", { code: UI.carcass, control: "choice", defaultText: prefs, note: "Els gruixos del material (o un número si el material no és a Preferències)." }),
    field(id("fronts"), "Fronts", {
      code: UI.carcass,
      control: "material",
      defaultText: "Com el cos",
      showIf: moble ? "Sempre" : "Algun front que es fa i fa servir el material dels fronts",
      issue: moble ? "Al moble, «Fronts» surt sempre, encara que cap mòdul tingui cap front; a Mòdul › Materials només surt si algun front el fa servir. Opció que no compta i regla diferent per a la mateixa fila." : undefined,
    }),
    field(id("back"), "Fons", {
      code: UI.carcass,
      control: "material",
      defaultText: prefs,
      showIf: moble ? "Algun mòdul amb fons" : "Caixa › Fons ≠ Sense fons",
      issue: moble ? undefined : "Es passa la caixa crua: amb un electrodomèstic que fixa «Sense fons» (Caixa › Fons surt com a text «Sense fons») encara surten «Fons» i «Gruix del fons» si l'usuari en tenia; la construcció no en fa.",
    }, [field(id("backThickness"), "Gruix del fons", { code: UI.carcass, control: "choice", defaultText: prefs })]),
    field(id("drawerBottom"), "Fons del calaix", { code: UI.carcass, control: "material", showIf: "Algun compartiment amb calaixos que es fan", defaultText: "Com el fons (o com el cos, sense fons)" }),
  ])
}

export const MODULE_GROUP = (carcass: OptionNode): OptionNode =>
  group("module", "Mòdul", { icon: "module", code: UI.inspector, showIf: "Un mòdul seleccionat", note: "Ordre: Tipus · Mides · Caixa · Portes · Unió · Materials." }, [...MODULE_POSITION, carcass, ...MODULE_TAIL])
