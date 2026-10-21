import { HARDWARE_SLOTS, slotAccepts, type HardwareEngine } from "../../../core/model"

/** El lloc del moble que fa servir un tipus de ferratge (les plaques importades no en tenen: van amb la frontissa). */
/** El lloc d'un motor; un joc de calaix (`drawerKit`) pot ser el per defecte de «Guia de calaix» (`slotAccepts`). */
export const slotOfEngine = (e: HardwareEngine) => HARDWARE_SLOTS.find((s) => slotAccepts(s.slot, { engine: e }))

/** Els tipus que no tenen lloc al joc del mòdul: què són i on es fan servir. */
export const ENGINE_HELP: Partial<Record<HardwareEngine, { label: string; help: string }>> = {
  plate: { label: "Placa de muntatge", help: "Placa de muntatge: no va sola; la frontissa importada que s'hi aparella en copia els forats (al lateral, a l'alçada de cada cassoleta)." },
  leg: { label: "Pota", help: "Es tria a la base «Potes» del mòdul (Mòdul › Base › Pota): els forats de la placa van a la cara de sota de la base, a cada pota (a «Als cantells» de les vores de fora)." },
  model: { label: "Només 3D", help: "Sense cap regla de mecanitzat: el model i el volum, mai cap forat. No es pot triar a cap lloc del moble; en pots baixar el model (GLB) per posar-lo en un objecte (Models 3D › Triar fitxers)." },
  plinthProfile: { label: "Sòcol d'alumini", help: "Ferratge per metres: es tria al sòcol de la base «Potes» (Mòdul › Tipus de sòcol). Es talla a mida a cada costat, es clipa a les potes (un clip cada «Clips cada», dos per tros com a mínim) i les cantonades porten una cantonera; la comanda surt a Peces › «Ferratges per metres» amb les barres que cal comprar." },
  appliance: { label: "Electrodomèstic", help: "Es tria a Mòdul › Electrodomèstic (o al compartiment, si el mòdul és dividit): el mòdul o el compartiment en fa el nínxol (es comprova amb les mides del catàleg), el front de moble es munta com diu el fabricant (cargolat a la porta de l'aparell, amb frontisses de moble i guia lliscant, o amb les frontisses de l'aparell) i surt a la comanda (Peces › Ferratges) amb la marca i la referència. No es fabrica: es dibuixa amb la foto a la cara vista. Les dades del catàleg són només de lectura (duplica'l per canviar els paràmetres)." },
  drawerKit: { label: "Joc de calaix de doble paret", help: "Es tria al calaix en lloc de la guia (Front › Guia): el joc decideix la llargada nominal per la fondària, els números d'article, el fons i el darrere de fusta (sense laterals de fusta) i les prebroques dels cargols. Les dades del joc són les del catàleg (només lectura; duplica'l per canviar-les)." },
}

export const PLACED_HELP =
  "Sense regla del moble: els seus mecanitzats (d'abans, escrits a mà, d'un DXF del taller o d'un programa Xilog del fabricant) es fan on ja està col·locat (Editor › mòdul o peça lliure › «Ferratges»), un cop confirmat. El model 3D és per veure'l."

export const ONLY_2D_HELP = "Només s'han importat les vistes DXF (i els punts de connexió): cap forat. Quan importis el STEP del mateix article, s'hi afegirà el 3D i, si és una frontissa, placa, tirador o pota, els forats proposats (per revisar i confirmar)."
