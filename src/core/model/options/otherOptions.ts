import { materialsNodes } from "./moduleOptions"
import { STRUCTURAL, UI, field, group, section } from "./optionTypes"

/** L'arbre de l'esquerra de l'Editor: on s'afegeixen els elements (no són opcions; per orientar-se). */
export const STRUCTURE = group("structure", "Estructura", { icon: "structure", code: UI.tree, note: "L'arbre de l'Editor: cada «+» afegeix un element i en seleccionar-lo surt el seu inspector." }, [
  group("structure.modules", "Mòduls", { icon: "module", code: UI.tree, note: "+ Mòdul nou: un buc estàndard de 600 × 720 × 580 amb els dos laterals, tapa i fons en ranura (com el «Mòdul 2» de l'usuari, 2026-10-15), sobre el suport del moble. Dues files: A terra i Penjats a la paret; grups." }),
  group("structure.parts", "Peces lliures", { icon: "part", code: UI.tree, note: "+ Peça lliure nova (amb els per defecte d'aquí); grups." }),
  group("structure.refs", "Objectes de referència", { icon: "ref", code: UI.tree, note: "+ Objecte (una caixa o un de Preferències › Objectes de referència)." }),
  group("structure.models", "Models 3D", { icon: "items", code: UI.tree, note: "+ Pujar un model 3D (decoratiu)." }),
])

const JOINERY_ISSUE = "Mateixa decisió (joc, fresa, pestanya i dogbones de TOTES les peces, `comp.joinery`) que Moble › Encaixos: és una dada del moble editada des de la peça. I glossari: la primera fila es diu «Joc» quan és una folgança (el text de sota diu «Folgança x mm»)."

export const MOBLE = group("moble", "Moble", { icon: "moble", code: UI.inspector, showIf: "Res seleccionat (el moble sencer), fora de la pestanya Foto" }, [
  section("moble.summary", "Resum", { icon: "summary", code: UI.inspector, note: "Mòduls i mides, peces, forats, objectes i models 3D." }),
  section("moble.support", "Cuina", { icon: "support", code: UI.inspector, showIf: "Cuina amb algun mòdul de terra", note: "Per decisió de l'usuari, 2026-10-20: només la cuina (el moble normal té el suport a cada mòdul, Caixa › Base) i la secció es diu «Cuina» (abans, «Suport general»). Per decisió de l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per a cada un»; «el sòcol no pot anar per cada mòdul, és una peça global». Un sol suport per a tots els mòduls de terra; el sòcol, una peça per tram (els mòduls de terra que es toquen)." }, [
    field("moble.support.kind", "Suport", {
      code: UI.support,
      control: "choice",
      default: "floor",
      choices: [
        { value: "floor", label: "Directe a terra", hides: ["moble.support.height", "moble.support.leg", "moble.support.setback"] },
        { value: "plinth", label: "Sòcol", reveals: ["moble.support.height", "moble.support.leg", "moble.support.setback", "moble.support.type", "moble.support.trams"], note: "sobre potes, amb un sòcol continu per tram" },
        { value: "legs", label: "Potes vistes", reveals: ["moble.support.height", "moble.support.leg"], hides: ["moble.support.setback"] },
      ],
    }),
    field("moble.support.height", "Alçada", { code: UI.support, control: "number", showIf: "Suport ≠ Directe a terra", range: { min: 20, max: 400, step: 5, suffix: "mm" }, default: 100 }),
    field("moble.support.leg", "Pota", { code: UI.support, control: "hardware", showIf: "Suport ≠ Directe a terra, i hi ha potes a la biblioteca o el moble en porta una", defaultText: "Genèriques" }, [
      field("moble.support.legInset", "Potes al davant", { code: UI.support, control: "number", showIf: "Una pota amb distància pròpia al davant (AXILO 78)" }),
    ]),
    field("moble.support.setback", "Retirada", { code: UI.support, control: "number", showIf: "Suport = Sòcol", defaultText: "Calculada: el peu de la pota del davant just darrere del sòcol" }),
    field("moble.support.type", "Sòcol", {
      code: UI.support,
      control: "hardware",
      showIf: "Suport = Sòcol",
      defaultText: "Fusta",
      choices: [
        { value: "wood", label: "Fusta", reveals: ["moble.support.material", "moble.support.corners"] },
        { value: "alu", label: "Un sòcol d'alumini de la biblioteca", hides: ["moble.support.material", "moble.support.corners"] },
      ],
    }),
    field("moble.support.material", "Material", { code: UI.support, control: "material", showIf: "Sòcol de fusta", defaultText: "Com el cos" }),
    field("moble.support.trams", "Trams", {
      code: UI.support,
      control: "choice",
      showIf: "Suport = Sòcol: una fila per tram",
      default: "front",
      choices: [
        { value: "front", label: "Davant", hides: ["moble.support.sideSetback", "moble.support.corners"] },
        { value: "left", label: "+ esquerre", reveals: ["moble.support.sideSetback", "moble.support.corners"] },
        { value: "right", label: "+ dret", reveals: ["moble.support.sideSetback", "moble.support.corners"] },
        { value: "sides", label: "+ laterals", reveals: ["moble.support.sideSetback", "moble.support.corners"] },
        { value: "all", label: "Tot el voltant", reveals: ["moble.support.sideSetback", "moble.support.corners"] },
      ],
      note: "Per defecte, només el davant; un tram lliure al terra (una illa), tot el voltant.",
    }, [
      field("moble.support.sideSetback", "Retirada dels costats", { code: UI.support, control: "number", showIf: "Algun tram amb costats", defaultText: "La retirada del sòcol" }),
      field("moble.support.corners", "Cantonades", { code: UI.support, control: "choice", showIf: "Algun tram amb costats i sòcol de fusta", default: "butt", choices: [{ value: "butt", label: "A tope" }, { value: "mitre", label: "A inglet" }] }),
    ]),
  ]),
  section("moble.joinery", "Encaixos", { icon: "joinery", code: UI.inspector, showIf: "Alguna peça lliure fa encaixos" }, [
    field("moble.joinery.clearance", "Folgança", { code: UI.part, control: "number", default: 0.2 }),
    field("moble.joinery.tool", "Diàmetre fresa (Ø)", { code: UI.part, control: "number", default: 6 }),
    field("moble.joinery.tabWidth", "Pestanya", { code: UI.part, control: "number", default: 50 }),
    field("moble.joinery.dogbones", "Dogbones", { code: UI.part, control: "switch", default: true, choices: [{ value: "on", label: "A les cantonades interiors" }] }),
  ]),
  section("moble.scene", "Acabats de l'escena", { icon: "scene", code: UI.inspector }, [
    field("moble.scene.floor", "Terra", { code: UI.sections, control: "material", defaultText: "Com a Preferències › Visor 3D" }),
    field("moble.scene.wall", "Paret", { code: UI.sections, control: "material", defaultText: "Com a Preferències › Visor 3D" }),
    field("moble.scene.leftWall", "Paret esquerra", { code: UI.sections, control: "switch", default: false, choices: [{ value: "on", label: "Paret al costat esquerre del moble" }], note: "Per decisió de l'usuari, 2026-10-21: parets laterals a l'escena de Presentació, a ras del moble (com la del darrere, del mateix acabat). Només es veuen: no tallen ni mouen res." }),
    field("moble.scene.rightWall", "Paret dreta", { code: UI.sections, control: "switch", default: false, choices: [{ value: "on", label: "Paret al costat dret del moble" }] }),
  ]),
  materialsNodes("moble"),
])

export const PART = group("part", "Peça lliure", { icon: "part", code: UI.inspector, showIf: "Una peça lliure seleccionada" }, [
  section("part.effect", "Efecte", {
    icon: "effect",
    code: UI.part,
    control: "choice",
    default: "part",
    defaultEditable: true,
    choices: [{ value: "part", label: "Peça" }, { value: "cut", label: "Talla", hides: ["part.material", "part.cnc", "part.joints"], reveals: ["part.effect.round"] }],
  }, [
    field("part.effect.round", "Fons arrodonit", { code: UI.part, control: "number", showIf: "Talla", default: 0, defaultEditable: true, note: "Si no travessa: un buidat amb el fons arrodonit (una pica), amb recorreguts 3D al programa." }),
  ]),
  section("part.orient", "Orientació", {
    icon: "orient",
    code: UI.part,
    control: "choice",
    default: "front",
    defaultEditable: true,
    choices: [{ value: "front", label: "De cara" }, { value: "side", label: "De costat" }, { value: "flat", label: "Estirada" }],
  }),
  section("part.size", "Mides", {
    icon: "dims",
    code: UI.part,
    control: "number",
    defaultText: "600 × 400 × el gruix del tauler",
    hideable: false,
    why: STRUCTURAL,
    issue: "El control del gruix (xips del tauler o lliure) i el text «No és de CNC…» depenen de l'interruptor «CNC», que és en una secció de MÉS AVALL.",
  }),
  section("part.material", "Material", { icon: "materials", code: UI.part, control: "material", showIf: "No talla", defaultText: "El de l'última peça (o del primer mòdul)" }, [
    field("part.material.grain", "Veta", {
      code: UI.part,
      control: "choice",
      showIf: "De CNC",
      default: "u",
      defaultEditable: true,
      choices: [{ value: "u", label: "Al llarg de l'ample" }, { value: "v", label: "Al llarg de l'alt" }, { value: "none", label: "Sense veta" }],
      issue: "Depèn de «CNC» (secció de més avall): una opció que depèn d'una de sota.",
    }),
  ]),
  section("part.shape", "Forma", { icon: "shape", code: UI.part, control: "buttons", defaultText: "Rectangle", choices: [{ value: "rect", label: "Rectangle" }, { value: "custom", label: "Forma a mida…" }] }),
  section("part.cnc", "CNC", {
    icon: "cnc",
    code: UI.part,
    control: "switch",
    showIf: "No talla",
    default: true,
    choices: [{ value: "on", label: "Es talla a la CNC (va al nesting)", reveals: ["part.cnc.edge", "part.material.grain", "part.joints"] }],
    note: "Un material que no és de CNC (ferro, pedra, vidre) la treu del nesting.",
  }, [
    field("part.cnc.edge", "Cantell", { code: UI.part, control: "switch", showIf: "De CNC", default: false, defaultEditable: true, choices: [{ value: "on", label: "Als quatre costats" }] }),
  ]),
  section("part.joints", "Encaixos", {
    icon: "joinery",
    code: UI.part,
    control: "switch",
    showIf: "De CNC i el moble no és un Objecte",
    default: false,
    choices: [{ value: "on", label: "Amb les altres peces", reveals: ["part.joinery"] }],
  }),
  section("part.group", "Grup", { icon: "group", code: UI.part, control: "choice", defaultText: "Sense grup" }),
  section("part.attach", "Enganxada", { icon: "attach", code: UI.part, control: "choice", showIf: "Moble amb mòduls", defaultText: "Res" }),
  section("part.position", "Posició", { icon: "position", code: UI.part, control: "number", hideable: false, why: STRUCTURAL }),
  section("part.joinery", "Encaixos (tot el moble)", { icon: "joinery", code: UI.part, showIf: "De CNC i amb Encaixos", note: "Les mateixes files que Moble › Encaixos (mateixos ids: amagar-les allà les amaga aquí).", issue: JOINERY_ISSUE }),
  section("part.hardware", "Ferratges", { icon: "hardware", code: UI.inspector, showIf: "La peça ja porta ferratges col·locats a mà (no se n'afegeixen)" }),
])

export const REF = group("ref", "Objecte de referència", { icon: "ref", code: UI.inspector, showIf: "Un objecte de referència seleccionat" }, [
  section("ref.effect", "Efecte", {
    icon: "effect",
    code: UI.ref,
    control: "choice",
    default: "obstacle",
    defaultEditable: true,
    choices: [{ value: "obstacle", label: "Obstacle" }, { value: "cut", label: "Talla", reveals: ["ref.orient", "ref.effect.round"], hides: ["ref.material"] }],
  }, [
    field("ref.effect.round", "Fons arrodonit", { code: UI.ref, control: "number", showIf: "Talla", default: 0, defaultEditable: true, note: "Si no travessa: un buidat amb el fons arrodonit (una pica), amb recorreguts 3D al programa." }),
  ]),
  section("ref.shape", "Forma", {
    icon: "shape",
    code: UI.ref,
    control: "choice",
    default: "box",
    choices: [{ value: "box", label: "Caixa" }, { value: "cylinder", label: "Cilindre", reveals: ["ref.orient"] }, { value: "profile", label: "Perfil", reveals: ["ref.orient"] }, { value: "mesh", label: "Forma lliure", hides: ["ref.orient"] }, { value: "image", label: "Relleu d'imatge", hides: ["ref.orient"] }],
  }),
  section("ref.slices", "Llistons", { icon: "cnc", code: UI.ref, control: "buttons", showIf: "Forma lliure", choices: [{ value: "slice", label: "Tallar en llistons" }], note: "Drecera: crea peces lliures normals (llistons), peces que tallen (forats) i barres que tallen, al grup de la forma." }, [
    field("ref.slices.axis", "Apilats", { code: UI.ref, control: "choice", default: "x", choices: [{ value: "x", label: "De costat" }, { value: "z", label: "Cap a la paret" }, { value: "y", label: "Vertical" }] }),
    field("ref.slices.thickness", "Gruix", { code: UI.ref, control: "number", default: 19, defaultEditable: true }),
    field("ref.slices.gap", "Separació", { code: UI.ref, control: "number", default: 15, defaultEditable: true }),
    field("ref.slices.material", "Material", { code: UI.ref, control: "material", defaultText: "Roure massís / xapat" }),
    field("ref.slices.rods", "Barres", { code: UI.ref, control: "choice", default: "2", choices: ["0", "1", "2", "3", "4"].map((value) => ({ value, label: value })) }, [
      field("ref.slices.rodDiameter", "Ø barra", { code: UI.ref, control: "number", showIf: "Barres > 0", default: 10, defaultEditable: true }),
    ]),
  ]),
  section("ref.orient", "Orientació", { icon: "orient", code: UI.ref, control: "choice", showIf: "Forma ≠ Caixa, o Talla (no la forma lliure)", default: "z", choices: [{ value: "z", label: "Cap a la paret" }, { value: "y", label: "Vertical" }, { value: "x", label: "De costat" }] }),
  section("ref.size", "Mides", { icon: "dims", code: UI.ref, control: "number", defaultText: "600 × 600 × 100", hideable: false, why: STRUCTURAL }),
  section("ref.material", "Material", { icon: "materials", code: UI.ref, control: "material", showIf: "No talla", defaultText: "Cap (fantasma)" }),
  section("ref.attach", "Enganxada", { icon: "attach", code: UI.ref, control: "buttons", defaultText: "Res", choices: [{ value: "floor", label: "Al terra" }, { value: "wall", label: "A la paret" }] }),
  section("ref.position", "Posició", { icon: "position", code: UI.ref, control: "number", hideable: false, why: STRUCTURAL }, [
    field("ref.position.makeRoom", "Entre els mòduls", { code: UI.ref, control: "buttons", showIf: "Trepitja els mòduls d'una fila", choices: [{ value: "room", label: "Fer-li lloc" }] }),
  ]),
])

export const MULTI = group("multi", "Selecció múltiple o grup", { icon: "multi", code: UI.inspector, showIf: "Diversos elements seleccionats, o un grup" }, [
  section("multi.position", "Posició", { icon: "position", code: UI.multi, control: "number", hideable: false, why: STRUCTURAL }),
  section("multi.align", "Alineació", { icon: "align", code: UI.multi, control: "buttons" }),
  section("multi.material", "Material", { icon: "materials", code: UI.multi, control: "material" }),
  section("multi.size", "Mides", { icon: "dims", code: UI.multi, control: "number", showIf: "Tots del mateix tipus (peces o models)", hideable: false, why: STRUCTURAL }),
  section("multi.group", "Grup", { icon: "group", code: UI.multi, control: "choice" }),
  section("multi.items", "Triats", { icon: "group", code: UI.multi, note: "La llista, Duplicar i Eliminar.", hideable: false, why: "No es pot amagar: és on es veu què hi ha triat i es duplica o s'elimina." }),
])
