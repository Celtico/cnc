import { z } from "zod"
import { FinishSchema, GapsPrefSchema } from "../../core/model"
import { STANDARD_SHEETS } from "../../core/nesting/nest"
import type { ToolInputs } from "../../core/assistant/toolset"

/** Entrades de les eines de l'app (`appTools.ts`): l'esquema zod i la descripció de cada una. */

const KIND = z.enum(["moble", "objecte", "ambient"]).describe("moble = moble per fabricar; objecte = decoratiu per als ambients; ambient = habitació")

export const DB_TABLES = ["projects", "ambients", "settings", "photos", "models", "hardwareAssets"] as const
export type DbTable = (typeof DB_TABLES)[number]

export const INPUTS = {
  get_app: z.object({}).describe("On és l'usuari: l'apartat, la pàgina, el document obert (tipus, id i nom) i què hi té seleccionat. Crida-la al començament si no ho saps."),
  list_documents: z
    .object({ kind: KIND, query: z.string().optional().describe("Text per buscar al nom (sense accents ni majúscules)") })
    .describe("Llista els mobles, objectes o ambients desats (id, nom, grup i data), els més recents primer, com a molt 40."),
  open_document: z.object({ kind: KIND, id: z.number().int() }).describe("Obre un moble, objecte o ambient (com tocar-ne la targeta). Les seves eines ja es poden fer servir a la volta següent."),
  create_document: z
    .object({ kind: KIND, name: z.string().optional().describe("Nom (si ja n'hi ha un d'igual, s'hi afegeix un número)") })
    .describe("Crea un moble, objecte o ambient en blanc (com «+ Nou moble») i l'obre."),
  rename_document: z.object({ kind: KIND, id: z.number().int(), name: z.string().min(1) }).describe("Canvia el nom d'un moble, objecte o ambient."),
  duplicate_document: z.object({ kind: KIND, id: z.number().int() }).describe("Duplica un moble, objecte o ambient (la còpia surt a l'Historial; d'un ambient es dupliquen també els seus mobles). No l'obre."),
  move_to_group: z
    .object({ kind: KIND, ids: z.array(z.number().int()).min(1), group: z.string().nullable().describe("Nom del grup (Projectes); null = treure del grup (a l'Historial)") })
    .describe("Mou documents a un grup de Projectes (p. ex. un per client) o els treu del grup."),
  delete_document: z
    .object({ kind: KIND, id: z.number().int(), confirmed: z.boolean().describe("true només si l'usuari ha dit que sí, en aquest xat, a esborrar aquest document concret") })
    .describe("Esborra un moble, objecte o ambient per sempre. ABANS pregunta a l'usuari i espera que digui que sí; crida-la amb confirmed: true només després. Un moble o objecte que és en algun ambient no s'esborra."),
  get_cutlist: z.object({}).describe("Llista de peces del moble obert (com la pàgina Peces): peces iguals agrupades amb quantitat, mides L × A × gruix, material, veta, cantells (1 dalt · 2 dreta · 3 baix · 4 esquerra), post-processos; i els elements sense nesting."),
  get_nesting: z.object({}).describe("Nesting del moble obert (com la pàgina Nesting): taulers per material i gruix, aprofitament, peces que no hi caben, mida de tauler, separació i marge (de la màquina per defecte si n'hi ha)."),
  set_sheet: z
    .object({
      w: z.number().positive().describe("Llarg del tauler (mm)"),
      h: z.number().positive().describe("Ample del tauler (mm)"),
      material: z.string().optional().describe("Només per a aquest material (si no, el de tots)"),
    })
    .describe(`Canvia la mida de tauler del nesting del moble obert (estàndard: ${STANDARD_SHEETS.map((s) => `${s.w} × ${s.h}`).join(", ")}).`),
  export_files: z
    .object({ format: z.enum(["xcs", "step", "csv_topsolid", "dxf", "cutlist_csv", "glb"]).describe("xcs = programes de Maestro per tauler (zip); step i csv_topsolid = per a TopSolid i el taller; dxf = CNC; cutlist_csv = llista de tall; glb = model 3D") })
    .describe("Genera i baixa un fitxer del moble obert (com la pàgina Exportar) i en diu els avisos. El navegador el desa a Baixades."),
  get_settings: z.object({}).describe("Preferències: materials (nom, categoria, gruixos, cantell, massís), tauler i fons per defecte, folgances per defecte i màquines CNC (la per defecte). La clau de l'API no hi surt mai."),
  set_pref_material: z
    .object({
      name: z.string().min(1).describe("Nom del material (exacte, com a get_settings). Si no existeix i create és true, se'n crea un"),
      create: z.boolean().optional().describe("Crear-lo si no existeix (color llis)"),
      rename: z.string().min(1).optional().describe("Nom nou (els mobles, objectes i ambients que el fan servir el segueixen)"),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Color (#rrggbb): el de l'acabat (llis, lacat, pedra, metall, vidre, teixit, rajola); a la fusta i a la foto no"),
      roughness: z.number().min(0).max(1).optional().describe("Rugositat de l'acabat llis, lacat o metall (0 mirall, 1 mat)"),
      finish: FinishSchema.optional().describe("Acabat sencer nou (color, lacquer, wood, stone, metal, glass, fabric, tiles; la foto no: es posa a Preferències). L'anterior es guarda i s'hi pot tornar."),
      finish_kind: z.enum(["color", "lacquer", "wood", "stone", "metal", "glass", "fabric", "tiles", "image"]).optional().describe("Tornar a un acabat que el material ja havia tingut (es recupera tal com era)"),
      coat: z.number().min(0).max(1).optional().describe("Reflex (vernís) al render"),
      sheen: z.number().min(0).max(1).optional().describe("Vellut al render"),
      translucent: z.number().min(0).max(1).optional().describe("Llum que passa (teles, pantalles)"),
      glow: z.number().min(0).max(200).optional().describe("Llum que fa (0 = cap)"),
      category: z.enum(["board", "back", "sim"]).optional().describe("board = tauler de CNC; back = fons; sim = simulació (no es talla)"),
      thicknesses: z.array(z.number().min(3).max(60)).min(1).optional(),
      edge: z.string().optional().describe("Nom del cantell (p. ex. «PVC blanc 1 mm»)"),
      solid: z.boolean().optional().describe("Massís: les seves peces no es cantegen"),
      grain: z.boolean().optional().describe("Té veta"),
    })
    .describe("Canvia, reanomena o crea un material de Preferències › Materials: categoria, gruixos, cantell, veta, massís, color, acabat i com es veu al render. No l'esborra."),
  set_pref_defaults: z
    .object({ material: z.string().optional(), thickness: z.number().optional(), back_material: z.string().optional(), back_thickness: z.number().optional() })
    .describe("Tauler i fons per defecte dels mòduls nous (materials de Preferències)."),
  set_pref_gaps: GapsPrefSchema.partial().describe("Folgances per defecte (mm): outerGap front–cos, betweenGap entre fronts, shelfClearance, shelfSetback, backClearance, backSetback, grooveDepth, grooveClearance (joc de l'ample de la ranura del fons: ranura = gruix del fons + aquest joc), innerClearance (peces de dins)."),
  set_default_machine: z.object({ name: z.string() }).describe("Tria la màquina CNC per defecte (la dels programes .xcs i la separació del nesting)."),
  list_hardware: z
    .object({
      query: z.string().optional().describe("Text per buscar al nom, fabricant, sèrie o número d'article"),
      slot: z.enum(["hinge", "system32", "dowel", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]).optional().describe("Només els que poden anar en aquest lloc (slide inclou els jocs de calaix)"),
    })
    .describe("Ferratges de la biblioteca (Preferències › Ferratges): id, nom, categoria, fabricant, sèrie i els llocs on són per defecte. Com a molt 60."),
  set_hardware_default: z
    .object({ slot: z.enum(["hinge", "system32", "dowel", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]), hardware: z.string().describe("Id o nom del ferratge (list_hardware)") })
    .describe("Ferratge per defecte d'un lloc als mòduls nous (Preferències › Ferratges, «Per defecte als mòduls nous»)."),
  set_front_hardware: z
    .object({
      module: z.string().describe("Id o nom del mòdul del moble obert"),
      zone: z.string().optional().describe("Id del compartiment (sense: l'Interior, l'arrel)"),
      part: z.enum(["hinge", "slide", "flap", "magnet", "handle", "rail", "led", "glassFrame"]).describe("hinge = frontissa de la porta; slide = guia o joc dels calaixos; flap = braç de l'abatible; magnet = imant de la reixeta; handle = tirador; rail = barra de penjar; led = tira LED; glassFrame = marc de la porta de vidre"),
      hardware: z.string().describe("Id o nom del ferratge (list_hardware); «module» = el del mòdul (Com el mòdul); al tirador, «none» = sense tirador (push)"),
    })
    .describe("Tria el ferratge d'un compartiment del moble obert, com el selector del Front o dels Accessoris de l'inspector (es guarda una còpia de l'item)."),
  get_hardware: z.object({ hardware: z.string().describe("Id o nom (list_hardware)") }).describe("Un ferratge de la biblioteca amb tots els seus números (els paràmetres que es poden editar, amb els límits), la quantitat per alçada i la distància entre forats."),
  edit_hardware: z
    .object({
      hardware: z.string().describe("Id o nom (list_hardware)"),
      duplicate: z.boolean().optional().describe("Fer-ne una còpia i editar la còpia (obligat amb els de l'app)"),
      name: z.string().min(1).optional(),
      maker: z.string().optional(),
      ref: z.string().optional().describe("Número d'article"),
      params: z.record(z.string(), z.number()).optional().describe("Paràmetres a canviar (claus de get_hardware)"),
    })
    .describe("Edita (o duplica i edita) un ferratge de la biblioteca: nom, fabricant, número i paràmetres (Preferències › Ferratges). Els mobles fets es queden la seva còpia."),
  db_tables: z.object({}).describe("La base de dades de l'app (IndexedDB, Dexie): cada taula amb quantes files té i els camps. projects = mobles i objectes; ambients; settings = preferències; photos, models i hardwareAssets = fitxers (només lectura)."),
  db_read: z
    .object({
      table: z.enum(DB_TABLES),
      id: z.union([z.number(), z.string()]).optional().describe("Id de la fila (sense: una llista de files resumides)"),
      path: z.string().optional().describe("Camí dins de la fila, amb punts: «composition.modules.0.carcass», «data.walls». Un segment «#id» tria l'element d'una llista pel seu id"),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .describe("Llegeix files de la base de dades tal com estan desades (sense les imatges ni els fitxers, que surten com a «[binari …]», i sense la clau de l'API). Per a coses que les altres eines no diuen."),
  db_write: z
    .object({
      table: z.enum(["projects", "ambients", "settings"]),
      id: z.union([z.number(), z.string()]).describe("Id de la fila (settings: «app»)"),
      path: z.string().min(1).describe("Camí del valor a canviar, com a db_read: projects → «name» o «composition…»; ambients → «name» o «data…»; settings → «data…»"),
      value: z.unknown().describe("El valor nou (JSON); null per treure un camp opcional"),
      confirmed: z.boolean().describe("true només després que l'usuari ho hagi acceptat al xat (sense, torna com quedaria)"),
    })
    .describe("Canvia un valor de la base de dades. Es valida amb el mateix esquema que l'app (un valor dolent no es desa). Al document obert va com un canvi de l'editor (es desfà amb ⌘Z); als altres i a les preferències, no es pot desfer: ensenya-ho i demana-ho abans. Fes servir les eines específiques sempre que n'hi hagi una."),
  go_to: z
    .object({ place: z.enum(["mobles", "ambients", "objectes", "preferencies", "editor", "peces", "nesting", "exportar"]) })
    .describe("Va a un apartat (mobles, ambients, objectes, preferencies) o a una pàgina del moble obert (editor, peces, nesting, exportar)."),
} satisfies ToolInputs

export type AppToolName = keyof typeof INPUTS
