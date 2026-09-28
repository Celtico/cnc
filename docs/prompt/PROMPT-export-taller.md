# Prompt — Export per al taller: STEP 3D + CSV de nesting (format TopSolid)

Copia-ho a Claude Code dins de `~/Desktop/cnc`.

---

Llegeix el `CLAUDE.md` abans de començar.

## Objectiu
El taller (`~/Desktop/taller-cnc-nest`) ja accepta dos fitxers a la pàgina de pujada
(`POST /api/nesting/process`, multipart `csv` + `step`):

- **STEP 3D**: sòlids del moble
- **CSV de nesting**: peces, mides, posicions i referències

Vull que el configurador exporti **exactament aquests dos fitxers en el mateix format
que TopSolid V6**. Així el taller funciona **sense cap canvi**: visor 3D, mecanitzats,
etiquetes, laminat i escaneigs. Això substitueix el camí de l'endpoint d'importació
de JSON (`PROMPT-taller-import.md` queda obsolet).

**Font de veritat = els parsers del taller.** Llegeix-los sencers abans d'escriure
res (només lectura, **no modifiquis res d'aquell repo**):
- `src/nesting/parsers/csv-nesting.ts`
- `src/nesting/parsers/step-solids.ts`, `step-names.ts`, `step-assembly.ts`
- `src/nesting/assemble.ts` i `src/nesting/types.ts`
- skills `.claude/skills/topsolid-maestro-exports` i `nesting-parsers`
- mostres reals: `samples/ARM02_res.csv` i `samples/A_1_Armari_neteja.step` (18 MB,
  llegeix-ne trossos, no el fitxer sencer)

## 1. Prerequisit: nesting
El CSV porta tauler i posició de cada peça, i per això cal el nesting. Si encara no hi
és, implementa `core/nesting/` (peces rectangulars; guillotina o per franges; veta;
agrupat per material i gruix; kerf 6 mm configurable; taulers 2800×2070 per defecte).
Pantalla **Nesting** amb els taulers dibuixats en SVG.

## 2. CSV de nesting (`core/export/topsolidCsv.ts`)
- Codificació **UTF-16 LE amb BOM** (FF FE), separador `;`, final de línia CRLF, decimals
  amb punt. Mira la mostra `ARM02_res.csv` per a l'ordre exacte de columnes i copia'l:
  `Nombre_tablero_nesting; numero_de_piezas; PÉRDIDA_NESTING; Nombre_pieza;
  Longitud_Pieza; Ancho_Pieza; Grueso_pieza; Referencia; PosX_etiqueta; PosY_etiqueta;
  Angulo_etiqueta; Revestimiento; ORIGINAL_ELEMENT_IDENTIFIER; CANTO_/_LAMINADO_-_EJE_1;
  RUTA_DEL_MODELO; Nombre_trabajo; CANTO_/_LAMINADO_-_EJE_2; ..._EJE_3; ..._EJE_4;
  ÍNDICE_3D; SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO`
- **Fila de tauler** per a cada tauler, abans de les seves peces: `Nombre_pieza` =
  `<material>:<L>x<A>x<gruix>` (amb els dos punts, que és com el parser la detecta i en
  treu el material), `Longitud_Pieza`/`Ancho_Pieza` = mida del tauler.
- Nom de tauler: `<material_amb_guions_baixos>_<gruix>#<nn>` (p. ex.
  `Melamina_blanca_19#01`).
- Fila de peça: nom (vocabulari del taller: `lat d`, `lat e`, `base`, `sostre`,
  `prestatge`, `trassera`, `porta`...), L, W, gruix, `PosX/PosY_etiqueta` = posició de
  l'etiqueta al tauler, `Angulo_etiqueta` (0 o 90), `ÍNDICE_3D` = ref única
  `A.<mòdul>.<tipus>.<n>`, i els 4 cantells amb text literal (p. ex. `canto 1mm`) o
  buit. Ordre d'eixos: 1 dalt · 2 dreta · 3 baix · 4 esquerra.
- **`PosX/PosY_etiqueta` = el punt del tauler on s'enganxa l'etiqueta** (coordenades
  del tauler en mm), i `Angulo_etiqueta` n'és la rotació. No és la posició de la peça.
  Regles per triar-lo:
  - ha de caure **dins de la peça** col·locada al tauler, amb marge perquè hi càpiga
    l'etiqueta sencera (per defecte 99×68 mm, Avery L7165; configurable);
  - **lluny de forats, cassoletes, ranures i cantells a laminar**, perquè l'etiqueta no
    tapi cap mecanitzat ni caigui on es posarà cantell;
  - si la peça és massa petita per a l'etiqueta, al seu centre;
  - per defecte, el centre de la peça si està lliure; si no, el punt lliure més proper.
  Comprova a la mostra que l'origen del tauler i el sentit dels eixos són els mateixos
  que fa servir el nostre nesting. Tingues en compte que el visor del taller
  (`NestingView.tsx`) només fa servir x/y per ordenar les peces i situar la marca de
  l'etiqueta, i no per dibuixar-les a la seva posició real.
- `RUTA_DEL_MODELO` i `Nombre_trabajo`: nom del projecte i `Configurador`.

## 3. STEP AP214 (`core/export/step.ts`)
Escriptor STEP propi, en text i **sense motor CAD**. Ha de complir el que llegeix
`step-solids.ts`:
- Capçalera AP214 (`AUTOMOTIVE_DESIGN`), unitats en **mil·límetres**.
- **Eixos: X = amplada, Y = fondària, Z = amunt.** El taller deriva el rol de l'eix
  prim de cada sòlid (X → lateral, Z → horitzontal, Y → front/fons, gruix ≤ 12 → fons).
  El nostre model 3D és Y-amunt: converteix-ho en exportar.
- Un `MANIFOLD_SOLID_BREP` per peça, amb `CLOSED_SHELL` → `ADVANCED_FACE` (`PLANE`) →
  `FACE_OUTER_BOUND` → `EDGE_LOOP` → `ORIENTED_EDGE` → `EDGE_CURVE` (`LINE`) →
  `VERTEX_POINT` → `CARTESIAN_POINT`, en coordenades globals del moble muntat.
- Cada sòlid dins d'un `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom de peça>', (#brep, ...), #context)`.
  És d'aquí que el taller llegeix el nom (camí 1 de `step-names.ts`).
- **Forats cecs** (System 32, cassoletes, espigues de cara i de cantell): bucle interior
  circular a la cara (`CIRCLE`), cara cilíndrica (`CYLINDRICAL_SURFACE` amb el seu
  `AXIS2_PLACEMENT_3D` i radi) i cara plana de fons. El parser treu `mach`/`edges` dels
  cilindres. Els forats **passants** el parser els descarta a propòsit (els pren per
  radis de cantonada), així que surten només al DXF.
- Ranures de fons i altres buidats: cara plana a fondària intermèdia (és el que el
  parser detecta com a `pockets`).
- Opcional: ferratges (frontisses, etc.) com a sòlids petits amb nom (`frontissa`...),
  perquè `lligaFerratges` digui quin ferratge va a cada forat.
- Validesa: ha d'obrir-se bé a FreeCAD, no només al parser del taller.

## 4. Prova d'anada i tornada (imprescindible)
Test Vitest que **importi els parsers del taller directament del seu codi font**
(`../taller-cnc-nest/src/nesting/assemble.ts`, només lectura) i passi-hi el CSV i el
STEP generats d'un mòdul de 600×720×560 amb 1 prestatge i 1 porta:
- es detecten totes les peces i tots els taulers, amb el material correcte;
- **cada peça queda lligada a un sòlid** (`match` ≠ `none`);
- rols correctes (2 laterals d/e, base i sostre horitzontals, trassera `back`, porta `front`);
- el nombre de forats de cada peça (`mach` + `edges`) coincideix amb el nostre model,
  amb diàmetres i fondàries dins de ±0,1 mm;
- `pockets` per a les ranures del fons.
Si el taller no llegeix bé alguna cosa, **ajusta el nostre exportador**, no el parser.
Si hi ha res que sigui impossible sense canviar el taller, **atura't i pregunta'm**.

## 5. UI
A **Exportar**, una targeta "Per al taller" amb dos botons: **STEP 3D** (sòlids del
moble) i **CSV de nesting** (peces, mides, posicions i referències). Noms de fitxer
`<moble>.step` i `<moble>_res.csv`; el taller en treu el nom del moble traient `_res`.

## Com vull que treballis
Pla curt → nesting (si falta) → CSV amb test → STEP amb test → prova d'anada i tornada
→ UI. `pnpm typecheck && pnpm test && pnpm build` al final de cada pas.
