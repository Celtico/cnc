# Exports

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Exports (pàgina Exportar)
- **Per destinació, en aquest ordre**: **Màquina CNC (Maestro, .xcs)** (la primera i principal, destacada, BETA) · STEP de
  TopSolid · CSV de TopSolid · CNC (DXF) · Llista de tall (CSV) · Model 3D (GLB/USDZ); una acció principal per grup. Les
  eines de depuració (JSON `UnifiedData`, `toUnifiedData`) plegades a «Avançat». Els plànols de peça no van a Exportar.
- **Llista de tall (CSV)** (`cutListToCsv`, `core/export/csv.ts`): una fila per grup de peces iguals i, a sota (v45), els
  **ferratges per metres** (`linearCsvRows`: regleta dels penjadors, sòcols d'alumini; quantitat de barres, referència i
  els trossos per tallar; clips, cantoneres i unions lineals), com a Peces › «Ferratges per metres».
- Tots els textos cap al taller passen per `workshopName` / `csvField` (`export/text.ts`: ASCII, sense `;` ni `:`; el parser
  del taller no admet cometes).

#### TopSolid: STEP + CSV per a `taller-cnc-nest` (~/Desktop/taller-cnc-nest)
**Decisió: el configurador exporta els mateixos fitxers que TopSolid V6** i el taller els carrega per la seva pàgina de
pujada de sempre (`POST /api/nesting/process`), sense cap canvi al taller:
```
Configurador ──► <moble>.step       (STEP AP214 · sòlids del moble)
             └─► <moble>_res.csv    (CSV de nesting · peces, mides, posicions, refs)
                      ▼
        taller-cnc-nest: visor 3D, mecanitzats, etiquetes, laminat, escaneigs + DXF per a la CNC
```
- **Font de veritat: els parsers del taller** (`src/nesting/parsers/*`, `assemble.ts`). Si no llegeix bé un fitxer nostre,
  s'arregla el nostre exportador. **No es modifica res de `taller-cnc-nest` des d'aquí.** Allà Chakra v2 + React 18: no es
  comparteix codi d'UI.
- **CSV**: UTF-16 LE amb BOM, `;`, CRLF, mateixes columnes que la mostra `ARM02_res.csv`; fila de tauler
  `<material>:<L>x<A>x<gruix>` abans de les seves peces. Gruix enter si ho és (`19`), si no amb punt (`18.6`), igual al nom
  del tauler, a la fila i a `Grueso_pieza`; els taulers es numeren pel nom imprès. Noms de peça del vocabulari del taller
  (`lat d`, `lat e`, `base`, `sostre`, `prestatge`, `trassera`, `porta`, `frontal`) i refs `A.<mòdul>.<tipus>.<n>` a
  `ÍNDICE_3D`.
- **STEP**: mm, **X = amplada, Y = fondària, Z = amunt** (el 3D és Y-amunt: es converteix); un `MANIFOLD_SOLID_BREP` per peça
  dins `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom>')`. El taller lliga peça ↔ sòlid **per mida**: peces idèntiques surten com a
  `representative` (normal). **Un sol STEP** (`toStepCad` a `export/step.ts`, conjunts de `stepCadGroups`), per obrir el moble
  a TopSolid **i** per al taller: conjunt arrel › un subconjunt per mòdul («1. Baix»), «Taulell i sòcol» i les peces lliures
  (per grup) › una peça per tauler amb el nom, material i mides a la descripció i el color del material (`STYLED_ITEM`,
  `finishRgb`); inglets de debò, booleans 3D (`solidCuts`), talls i forats de les peces amb forma. Noms dels sòlids =
  `workshopName(p.name)` (= `Nombre_pieza` del CSV), l'etiqueta de l'app al `PRODUCT`. Forats de cara cecs com a molt a
  gruix − 1 (avís; el taller descarta els de ≥ T − 0,5). Peces amb base mirall: bucles girats. Si dos mecanitzats es creuen
  per dins, en deixa un fora i avisa. **Ferro, pedra i vidre** (`build.extras`) només amb l'interruptor «només per a CAD»
  (`stepCadGroups(…, { extras })`, `mobles:step-extras`, apagat): al taller donarien unions falses.
- **El STEP no serveix per mecanitzar**: TopSolid llegeix els forats com a geometria, no com a mecanitzats. Per això els .xcs.
- Validat amb OpenCascade (sòlids vàlids, volum positiu, sense autointerseccions) i amb els parsers del taller:
  `taller.roundtrip.test.ts` passa els fitxers pels parsers (importats del seu codi font, només lectura) i comprova peces,
  rols, forats, cantells, buidats i la 2a cara, i que `toStepCad` es llegeix igual que el STEP pla `toStep` (`toStep` només
  es fa servir als tests). Detall a `docs/prompt/PROMPT-export-taller.md`.

#### DXF (CNC)
- Una peça per bloc (`P001…`, l'id en un comentari 999), contorn a la capa `CONTOUR`; R12, textos en ASCII.
- Forats en capes per diàmetre i profunditat, sense punt (`DRILL_D5_P12`, `DRILL_D35_P13`, `DRILL_D8_P17_5`) perquè TopSolid/Maestro
  els mapegin a eines; inglets a `MITRE_45`; contorns amb bulge (G2/G3). Coordenades en mm, sense escalar.

#### Maestro .xcs (BETA)
- Exportar › «Màquina CNC (Maestro)» › «Programes .xcs» → `<moble>-maestro.zip` (`zipStore`, sense dependències) amb la
  màquina per defecte i les regles del taller (`machineWithRules`). **Només per tauler** (el Maestro no fa nesting; per
  decisió de l'usuari es va treure «Per peça» de la UI; petició del taller). El per peça (`toMaestroXcs`, un `<ref>.xcs` per
  peça i `<ref>Volt.xcs` per a la cara B, i `panelXcs`, a `core/export/maestroXcs.ts`) **queda al nucli amb tests però no és
  a la UI**; la capçalera `Machine.header.mechanicalOptions` només el fa servir ell. La targeta diu BETA fins que el taller
  els validi i mostra els avisos.
- **Per tauler** (`core/export/maestroNestXcs.ts`: `toMaestroNestXcs`, `cncNestOptions`, `toBoard`, `orderFeats`): un
  `T01_<material>_<gruix>.xcs` per tauler, **una peça de treball = el tauler**, amb el nom del tauler del CSV (`boardName`,
  `Noguera_xapada_19#01`; com el `Proyecto1.pgmx` del taller, no les peces «contemporànies» de §3.11 p129), tot en
  coordenades del tauler. Gir 0/90 (antihorari, sense mirall, = `localToBoard`). Només cara A: forats → ranures (sempre
  fresa) → talls per dins → contorns per fora (gruix + martiri), per eina i veí més proper; les peces petites (`small`) al
  final o al principi (`Machine.nesting.smallParts`, per defecte al final). Forats de cantell, cara B («fer a la perforadora /
  segona passada», sense Volt) i inglets a la ruta «CNC (tauler N) → …». Comentaris amb les peces i les etiquetes (ref +
  centre). Mostra `docs/maestro/samples/nesting_T01.xcs`. Alternativa documentada: el nesting del Maestro (§4 p134, CSV).
- **Instruccions**: només les dels exemples del manual MSL (pàgines als comentaris i a `docs/maestro-xcs.md`):
  `SetMachiningParameters`, `CreateFinishedWorkpieceBox`, `CreateRawWorkpiece`, `SelectWorkplane`, `CreateDrill`,
  `CreateSegment` + `CreateSlot` (disc), `CreatePolyline` + `CreateRoughFinish` (fresa), `CreateContourPocket`,
  `CreateBidirectionalMillingStrategy`, `Set/ResetApproachStrategy`, `Set/ResetRetractStrategy`, polilínia/cercle +
  `CreateContour` (semicercles amb `AddArc2PointCenterToPolyline`). Capçal sempre `"-1"`. Broques verticals amb eina `"-1"`
  per defecte (com el .pgmx; opció «Broques: tria el Maestro / eina concreta», `Machine.verticalDrills`). Noms d'eina sense
  plegar a ASCII, cadenes C# escapades (`cs`); fitxers en **UTF-8 amb BOM** o sense (`Machine.xcsEncoding`, «Codificació»;
  `xcsBytes`/`xcsZip` amb l'`encoding` de l'export; LLEGEIX-ME sempre amb BOM; sense BOM i noms no ASCII → avís).
- **Eixos**: X = u (`length`), Y = v, origen a baix a l'esquerra de la cara A; forats de cantell a les cares estàndard
  (3 Front · 1 Back · 4 Left · 2 Right, vistes des de fora, a mig gruix, broca horitzontal `"-1"`; a les peces amb forma només
  si el contorn toca la cara); cara B girada sobre X: (x, A − y). **Orígens verificats** (taula a `docs/maestro-xcs.md`).
- **Eines** (`core/machine/tools.ts`, només `auto` i muntades): broques pel Ø exacte i la fondària útil; ranures amb disc si
  van de cantell a cantell (opció «Ranures» de la màquina), si no fresa Ø ≤ ample; talls amb broca si n'hi ha del Ø, si no
  fresa limitada pels arcs i dogbones (`maxToolDiameter`); amb cantonades vives (`sharpCorners`), la fresa més petita i avís
  si el radi passa de 0,5 mm. Punts repetits fora (`dedupePolyline`), `num()` llança si no és finit. Sense eina → no surt i
  avisa. Les **regles de mecanitzat** del taller manen (vegeu Màquines).
- **Separació i marge**: `nest()` amb separació = Ø de la fresa de contorn més grossa dels gruixos del moble (`boardRouter`
  per gruix: la de la regla de perfilar o la de nesting; 19 + 30 → 14 + 2 = 16) + `spacingExtra`, i marge `edgeTrim`
  (`Machine.nesting`, `machineNesting`: 10 mm, Ø + 2, martiri 0,3 mm; o, amb `edgeTrimMode: "tool"`, Ø de la mateixa fresa +
  `edgeTrimExtra`, `boardMargin`; `cncNestOptions` torna el `margin`). La mateixa xifra al LLEGEIX-ME, la capçalera i la
  targeta d'Exportar. **El mateix nesting a tot arreu** (`core/nesting/machineNest.ts`, `nestPlan`, a `useNesting`): amb una
  màquina per defecte, la pàgina Nesting, el CSV de TopSolid, el JSON i els .xcs fan servir aquesta separació i marge; sense
  màquina, el `kerf`/`margin` del projecte (que de nou surten de `Settings.boards`, sense UI a Preferències: es queden a
  l'esquema com a valors inicials). Taulers, taulers per material i veta són sempre els del projecte (`project.nesting`).
- **Avisos ≠ post-processos** (per decisió de l'usuari): `warnings` només amb problemes de debò (eina, forat que no es pot
  fer…); el que toca després (`postProcesses`: inglets a la serra, cantejar, forats de cantell que no fa la CNC, encolar,
  push; al per peça també «Programa cara B: <ref>Volt.xcs») i la ruta («CNC: … → serra (inglets) → cantejadora») van al
  LLEGEIX-ME, al plegable «Després de la CNC» d'Exportar i com a comentaris ASCII a la capçalera (mai missatges a
  l'operari). Cantells amb la numeració de l'app (pendent de confirmar amb el taller).
- **Avís de calor de la reixeta** (`material-heat`): una reixeta pot ser cobreradiador o decorativa (acanalats), així que
  diu «si va davant d'un radiador…», un sol cop per mòdul i cap si la reixeta ja és d'un material lacat.
- **Programa real del taller** (`docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs`, TopSolid → Maestro, s'hi va
  mecanitzar; comparació línia a línia a `docs/maestro-xcs.md`). Ja hi som iguals: capçalera (`MachineParameters
  mp=GetMachiningParameters();`, 16777216, `SetPreserveWorkingSequence`, `SetWorkPieceFallPrevention`,
  `SetWorkpieceSetupPosition`, `Pload`), campanes (`SetPneumaticHoodPosition(1); ResetAuxiliaryHood(); ResetDustpan();` després
  de `SelectWorkplane("Top")`), comentari `//BROCA PLANA <eina>` / `//FRESA PLANA <eina>` abans de cada grup d'eina (el parser
  del taller hi atribueix els forats; cap altre comentari nostre diu BROCA/FRESA), `CreateDrill(…, "-1", "-1", 0, -1, -1, "P",
  0, 2)` i el nom de la peça. **Diferència deliberada**: TopSolid envia el **recorregut del centre de l'eina**
  (`CreateToolpath` + `AddSegmentToToolpath`/`AddArc2PointRadiusToToolpath`, rampa a 30°); nosaltres la geometria
  (`CreateContour`/`CreateContourPocket`/`CreateRoughFinish`) i el Maestro calcula el recorregut. El parser del taller només
  veu els `CreateRoughFinish`. Test: `core/export/tallerXcs.roundtrip.test.ts`
  (`TALLER_DIR=/tmp/claude-0/taller pnpm exec vitest run src/core/export/tallerXcs.roundtrip.test.ts`; se salta sense el repo).
- **Pendent de validar amb el taller** (llista a `docs/maestro-xcs.md`): pontets/pell de les peces petites, martiri, zones de
  buit, etiquetes, prova a la màquina (`PROVA_ORIENTACIO.xcs`), UTF-8 amb BOM (el real és ASCII sense BOM), noms de totes les
  eines al Maestro 2.0.5, bits de `MechanicalOptions` i el −20, disc o fresa per a les ranures, fixació, eines que falten al
  `.tlgx`, recorreguts explícits o calculats, sentit dels talls interiors, marge (el real: 12 = Ø), forats gairebé passants.
- **Opcions pendents del taller** (millores v1, `docs/millores-v1/preguntes-germa.md`, el missatge per al germà): codificació,
  marge, pell dels forats gairebé passants, sentit del fresat i capçalera ja són preferències **amb el valor d'abans com a
  inicial** (cap diff del golden; tests a `export/xcsShopOptions.test.ts`). Quan respongui, es canvia l'inicial i
  `UPDATE_GOLDEN=1`. Pendents de construir: ranura del perfil LED i frontisses de porta de vidre.

#### Vista CAM
- Exportar › Màquina CNC (Maestro) › «Vista CAM» (`LuMonitorCog`): perquè el taller revisi cada programa a l'app abans
  d'enviar-lo, sense TopSolid. Diàleg a pantalla completa (zona segura com el Render) amb `export/CamPreview.tsx` sobre **el
  mateix text dels .xcs que va al zip** (`xcs.sheetList`).
- El dibuix surt de **llegir l'MSL**, no del model: `core/export/xcsPreview.ts` (`parseXcsPreview`, pur i testejat) llegeix
  peça de treball, peces i etiquetes dels comentaris, forats, polilínies (rectes, `AddArc2PointRadius/Center/3Points…`),
  cercles, segments, recorreguts (`CreateToolpath`) i operacions (`CreateContour` dins/fora, `CreateContourPocket`,
  `CreateRoughFinish`/`CreateSlot` amb la correcció, eina —amb `"-1"`, la del comentari `//BROCA PLANA …`—, fondària, sobrant,
  passada `_Pn` de les peces petites, rampa i passades) en l'ordre del fitxer. Una polilínia que acaba on comença (≤ 1e-3) és
  tancada encara que no porti `ClosePolyline` (`closedLoop`). Les línies que no entén **no llancen**: es compten (`unknown`).
- `camDraw`: el centre de l'eina a mig Ø al costat que toca (`offsetPolyline`) i la franja Ø (Ø de l'eina de la màquina pel
  nom, `findTool`); aproximat, només per dibuixar. SVG (`features/export/camDrawing.ts`): tauler i marge, peces (petites en
  groc discontinu) amb la ref, forats i fresats d'un color per eina amb la llegenda, «Amplada de l'eina», fletxa de rampa,
  números d'«Ordre» («289·302·318» si coincideixen), zoom 1×/2×/4×, `ChoiceChips` per tauler i la llista compacta
  d'operacions (tocar-ne una la marca).
- Tests (`xcsPreview.test.ts`): mobles del catàleg amb el context real (el que es llegeix = el que s'ha escrit),
  `nesting_T01.xcs`, el programa real del taller i els per peça.

#### Model 3D i AR
- GLB/USDZ (`components/viewer/exportGlb.ts`, `exportUsdz.ts`) amb textures, models 3D i peces que tallen.
- **AR («Veure a casa»)**: botó del visor (`LuView`), no una exportació: USDZ + `<model-viewer>` amb AR Quick Look a
  l'iPhone. Res de WebXR.
