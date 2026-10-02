# Programes de Maestro (.xcs) i màquines CNC

Notes de `core/machine/` (lectura del context de màquina) i `core/export/maestroXcs.ts` (programes en
Maestro Scripting Language). **BETA**: fins que el taller no validi els programes a Maestro.

Per què: TopSolid llegeix els forats del nostre STEP com a geometria, no com a mecanitzats, i al taller
s'han de tornar a fer a mà. Maestro (Xilog Maestro 2.00.004, SCM del taller, sèrie AA10008021) té un
llenguatge d'scripts pensat per a postprocessadors de CAD/CAM externs (manual MSL rev. 4, a
`docs/maestro/`, §1 p4): els programes surten de l'app amb mecanitzats de debò i les eines de la màquina.

## Context de màquina (Preferències › Màquines CNC)
- Maestro exporta `<sèrie>.machinecontext/`. Se'n llegeixen:
  - `Tlgx/def.tlgx` (XML DataContract `CoreToolLibrary`): cada `CoreTool` → `MachineTool` amb `code` =
    `Name` (el que va al paràmetre `tool` de l'MSL: «003», «E128»; manual p36, §5 p135), `name` =
    `Description`, tipus pel cos (`ToolBody` `i:type`: FlatDrill → broca, Endmill → fresa,
    UniversalBlade → disc; `AggregateComponent`, `TouchProbingTool`), `Diameter`, `SinkingLength`
    (fondària útil), `BladeThickness`, `HandOfCut`.
  - `Atrx/def.atrx` (`ToolEquipmentProject`): capçals d'un mandrí (3 i 6, electromandrins amb les eines
    disponibles) i la perforadora (capçal 1): mandrins solts = broques **verticals** (1…14), grups de
    dos (`SpindleGroupToolEquipment`, 52…65) = **horitzontals** (un mandrí per sentit). `Version` →
    «2.00.004». Les eines que no hi són surten «no muntades» i no es fan servir.
  - `Cfgx/<sèrie>.cfgx`: un .zip (deflate) amb l'XML de la configuració: descripció («5020*1905 8 BARRE
    MATIC 4 BASI» → camp 5020 × 1905) i àrees A…P. Es descomprimeix amb `DecompressionStream`
    (`core/file/zip.ts`, sense dependències).
  - `Settings/XilogHeaderParameters.xml`: `ExecutionFields` («AD»), `Repetitions`, `TableOptions` (10),
    `MechanicalOptions` (0), `ContinuousCycle` → capçalera del programa (editable a la màquina).
  - Cada `CoreTool` porta també `Key/ID` (p. ex. 2149647431 = E128): es desa a `MachineTool.id` per lligar
    l'eina amb els projectes (.pgmx).
- **Projecte del taller (.pgmx)** — «Importar noms d'eines d'un .pgmx» al detall de la màquina
  (`core/machine/pgmx.ts`): un .pgmx és un .zip amb l'XML del projecte (`Project`); s'accepta el .pgmx o l'XML
  ja extret. Mostra: `docs/maestro/samples/Proyecto1.pgmx.xml` (Maestro **2.0.5 rev 1005**, del taller).
  - **Noms de les eines**: el paràmetre `tool` de l'MSL és el **nom** de l'eina (manual p36, «Tool name»).
    Al .tlgx exportat (2.00.004) l'ID 2149647431 es diu `E128` (descripció «Diamant D12»); al .pgmx real, el
    `ToolKey` amb el mateix ID es diu **«12mm diamant nesting»**: el Maestro del taller l'ha rebatejada. Per
    això es llegeixen els parells `ToolKey` (ID, Name) i, per ID, es posa `mslName` (el que surt a l'MSL) i el
    `name` (si no s'ha tocat a mà); el `code` no canvia. Sense `mslName`, l'MSL fa servir el codi del .tlgx.
    Resum: eines rebatejades, les que ja hi eren i les del projecte que no són a la màquina.
  - **Capçalera**: `MachiningParameters` (un XilogHeaderParameters) → `Machine.header`. Al projecte:
    `ExecutionFields` AD, `Repetitions` 1, `TableOptions` 10, **`MechanicalOptions` 16973824** (0x01030000; el
    context diu 0), `ContinuousCycle` false, `IsTechnologicalMirror` true, `PreserveWorkingSequence` true.
    Correspondència amb `SetMachiningParameters(executionFields, repetitions, tableOptions, mechanicalOptions,
    continuousCycle)` (Table 79 p114, exemples p8 i p114): les cinc primeres van tal qual. El **mirall tecnològic** no
    té instrucció (es desa i es mostra). **Conservar la seqüència** no és al manual R4, però el programa real del taller
    porta `SetPreserveWorkingSequence(true)`: surt als programes per tauler (vegeu «Comparació amb un programa real del
    taller»). Sense XilogHeaderParameters, la capçalera per defecte és la del projecte (`DEFAULT_HEADER`). Els programes
    per tauler fan servir una altra `MechanicalOptions` (16777216, la del programa real; `Machine.nesting.program`).
  - Les operacions de broca del projecte (`DrillingOperation`) **no porten eina** (ToolKey buit, ID 0): el taller
    deixa triar la broca al Maestro. Per això les broques verticals surten amb `tool = "-1"` per defecte
    (opció de la màquina «Broques: tria el Maestro / eina concreta», `Machine.verticalDrills`).
- Lector XML propi (`core/machine/xml.ts`): el `core/` no té DOM als tests.
- `auto`: no es fan servir sols els exemples de SCM («Example: …»), els palpadors ni els agregats.
- Les eines que el taller té però no surten a la biblioteca exportada (la llista del germà a
  `docs/maestro/eines.txt` en té moltes més que el `.tlgx`: només hi ha dues freses, Ø12 i Ø14) es poden
  **afegir a mà** amb el codi de Maestro. Una «Eina nova» surt amb el codi provisional `NOVA1` i **no es tria**
  (`auto: false`, `isPlaceholderTool`) fins que se li posa el codi de debò.
- **Tornar a importar** la mateixa sèrie (`mergeReimport`): eines noves del context, però per a cada eina
  (per ID, o pel codi si no en té) es conserven els camps tocats a mà (`MachineTool.edited`: nom, automàtica,
  muntada, fondària útil, orientació), el `mslName` del .pgmx i les afegides a mà; també el nom, el per
  defecte, les opcions i, si s'havia importat un .pgmx, la seva capçalera.
- Preferències: una eina invàlida es descarta sola (`repairMachine`), no tota la màquina; si encara no és vàlida, es torna
  a provar sense les regles (les d'abans de la v11) i/o sense les opcions de nesting (es restauren les per defecte, amb un avís).
- Desat a `Settings.machines` (preferències **v10**, additiu: les v9 surten amb la llista buida); una
  sola `isDefault`.

## Programes
A la UI només hi ha **els programes per tauler** (vegeu «Programes per tauler (nesting)»; per decisió de l'usuari es va
treure l'opció «Per peça»). `toMaestroXcs` queda al nucli (tests i `panelXcs`): un `.xcs` per peça de CNC amb el nom de
la ref del taller (`A.1.L.1.xcs`, el mateix `ÍNDICE_3D` del CSV) i, si té mecanitzats a la cara B, `A.1.L.1Volt.xcs`
(com el «2a cara» de TopSolid). Tot en un .zip sense compressió (`zipStore`, `xcsZip`) amb un `LLEGEIX-ME.txt` (avisos
inclosos). CRLF.

**Codificació (pendent de validar):** els noms d'eina del taller poden dur accents o caràcters no ASCII
(«12mm diamant nesting» no en porta, però n'hi pot haver), i **no es pleguen a ASCII**: canviar-los faria
que Maestro no trobés l'eina. Els fitxers s'escriuen en **UTF-8 amb BOM** (`xcsBytes`), que és el que .NET
(MSL és C#) detecta sol. Les cadenes són literals C#: `\` i `"` s'escapen amb `\`; salts de línia i controls →
espai (`cs`). Els comentaris i els textos lliures (noms de peça, descripcions) es queden en ASCII.

### Orientació i origen
```
          cantell 1 (Back)                 Y
   +--------------------------------+      ^
   |                                |      |
 4 |        cara A (Top)            | 2    |
(Left)                            (Right)  +-----> X
   |                                |
   +--------------------------------+
 (0,0)    cantell 3 (Front)        (L, 0)
```
- X = u (la llargada de la peça a l'app, `length`; normalment el costat llarg, però no sempre), Y = v
  (`width`), Z = gruix. Origen a la cantonada de baix a l'esquerra de la cara A vista des de dalt: la mateixa
  convenció u/v de l'app i del DXF. El manual diu que cada pla té l'origen «a baix a l'esquerra» (§3.4 p24)
  i que la peça es posiciona per la cantonada de quotes mínimes (§3.9.2 p115).
- **Cares i orígens verificats** (revisió amb el manual MSL i el .pgmx real; caixa L × A × T, coordenades de
  la peça):

  | Pla | Cantell | Origen del pla | X del pla | Y del pla | Punt d'un forat |
  |---|---|---|---|---|---|
  | `Top` | cara A | (0, 0, T) | +x | +y | (u, v) |
  | `Front` | 3 (y = 0) | (0, 0, 0) | +x | +z | (u, T/2) |
  | `Back` | 1 (y = A) | (L, A, 0) | −x | +z | (L − u, T/2) |
  | `Left` | 4 (x = 0) | (0, A, 0) | −y | +z | (A − v, T/2) |
  | `Right` | 2 (x = L) | (L, 0, 0) | +y | +z | (v, T/2) |
  | `Top` del «Volt» | cara B | peça girada sobre X | +x | | (u, A − v) |

  Cada cara vista des de fora (X horitzontal, Y = alçada des de la cara B). `PROVA_ORIENTACIO.xcs` (forats
  a 100 mm de l'«esquerra» de cada cara) serveix per confirmar-ho a la màquina.
- Cara B («Volt»): la peça girada sobre l'eix X (el cantell 1 passa a baix): (x, y) → (x, A − y). Els forats
  de cantell, els talls passants i el contorn van al programa de la cara A.
- **Forats de cantell de peces amb forma**: només si el contorn toca la cara de la caixa en aquell punt (tot
  el diàmetre, `edgeHoleOnFace`); si no (un cantell corbat o retallat), no surt i avisa.

### Instruccions MSL (només les dels exemples del manual)
| Què | MSL | Manual |
|---|---|---|
| Capçalera | `SetMachiningParameters("AD", 1, 10, 16973824, false);` (valors de la màquina, editables). Per tauler, la del programa real del taller (`GetMachiningParameters`, 16777216, `SetPreserveWorkingSequence`, `SetWorkPieceFallPrevention`, `SetWorkpieceSetupPosition`, `Pload`, campanes) | §3.9.1 p114 (Table 79), p8; §3.9.2 p115; §3.6.2 p103; Table 50 p79 |
| Peça | `CreateFinishedWorkpieceBox(ref, L, A, gruix);` `CreateRawWorkpiece(ref, 0, 0, 0, 0, 0, 0);` | §3.2 p16-17 |
| Cara | `SelectWorkplane("Top")` / `"Front"` / `"Back"` / `"Left"` / `"Right"` | §3.3.4 p23 |
| Forat | `CreateDrill(nom, x, y, fondària, Ø, "", TypeOfProcess.Drilling, "-1" o eina, "-1");` (per tauler, + `0, -1, -1, "P", 0, 2` com el real) | §3.5.1 p36 (Table 28) |
| Ranura amb disc | `CreateSegment(…)` + `CreateSlot(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.1 p25, §3.5.7 p49 |
| Ranura amb fresa | `CreatePolyline` + `AddSegmentToPolyline` + `CreateRoughFinish(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.4 p30-33, §3.5.3 p40-41 |
| Tall / contorn | polilínia tancada (`AddArc2PointRadiusToPolyline(x, y, r, horari, >180°)`; els semicercles `AddArc2PointCenterToPolyline(x, y, cx, cy, horari)` (Table 21 p31); `ClosePolyline("")`) o `CreateCircleCenterRadius(nom, cx, cy, r, false)` + `CreateContour(nom, fondària, 1, costat, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` (costat 0 = dins, 1 = fora) | §3.4.1.3 p28, p31-32, §3.5.9 p53, p79 |

- Capçal sempre `"-1"` (automàtic, p36): Maestro el tria segons on és muntada l'eina.
- Broques horitzontals amb eina `"-1"`: el parell esquerra/dreta (019/020, 021/022) depèn del sentit i
  l'.atrx no diu quin mandrí mira cap a on.
- Sense estratègies, aproximacions, campanes ni ventoses (per peça): Maestro hi posa els valors per defecte de
  l'eina (§3.5 p35). Els programes per tauler porten les campanes i la rampa (regles). Noms únics per programa (§2 p5).
- Els arcs (bulge) es passen amb radi, sentit (bulge < 0 = horari) i «més de 180°» (|bulge| > 1). Els
  **semicercles** (|bulge| ≈ 1, ± 0,01) van amb el **centre** (`AddArc2PointCenterToPolyline`, Table 21 p31): amb
  el radi arrodonit a 0,001 podria quedar per sota de mitja corda i l'arc no existiria. És l'opció del manual (no
  s'arrodoneix el radi cap amunt). Si la polilínia té algun costat recte, el de tancar és `ClosePolyline`; si són
  tot arcs, l'últim arc acaba al punt d'inici.
- **Geometria degenerada**: `num()` llança si un número no és finit; els punts repetits seguits (a 0,001 mm, el
  que s'escriu) i els trams de menys de 0,001 mm es treuen (`dedupePolyline`, es queda el bulge del segon); una
  ranura tan ampla com llarga (`slot` amb w ≈ h) és un cercle.

### Tria d'eines (`core/machine/tools.ts`)
Només eines automàtiques i muntades.
- **Forats de cara**: n'hi ha d'haver una broca vertical del Ø exacte (± 0,1) que arribi a la fondària
  (SinkingLength), però per defecte el programa diu `"-1"` (com els .pgmx del taller) i la broca va al
  comentari; amb «Eina concreta», el nom de la broca (si n'hi ha dues, ESQ/DRE, la de codi més baix). Més fondo
  que gruix − 0,5 → gruix − 1 i avís (com al STEP).
- **Forats de cantell**: n'hi ha d'haver una d'horitzontal del Ø que hi arribi (es comprova), però el
  programa diu `"-1"`.
- **Ranures**: amb **disc** si va de cantell a cantell, el disc és prou prim i hi arriba (passades del gruix
  del disc, centres repartits a l'ample); si no, amb **fresa** de Ø ≤ ample (la més grossa), recorregut en
  zig-zag si cal més d'una passada; els extrems oberts amb el centre al cantell, els tancats a r de la vora.
  Opció de la màquina: «Disc si es pot» · «Sempre fresa» · «Preferir disc».
- **Talls passants** (gruix + `throughExtra`, 1 mm per defecte): un cercle amb broca del Ø si n'hi ha
  (tiradors Ø5 → 003, eina `"-1"` com les altres broques); si no, contorn per dins amb fresa. **Contorn** de
  les peces amb forma, per fora, al final. La fresa: Ø < l'amplada més petita − 0,5 (per dins) i radi ≤ el dels
  arcs que recorre per la banda còncava (extrems de ranura, osques, **dogbones** de les mortalles, també si ja
  són segments: `maxToolDiameter`). Si el contorn té **cantonades vives** (`sharpCorners`: per dins, les del
  forat —un rectangle en té 4—; per fora, les entrants), la **més petita** (`pickSmallRouter`) i, si el radi que
  hi deixa passa de 0,5 mm, avís amb el radi («4 cantonades vives queden amb radi 6 mm (fresa E128 Ø12)»); si no,
  la més grossa.
- **Nom de l'eina a l'MSL**: `toolMslName` = el del .pgmx (`mslName`) o el codi.
- Sense eina → el mecanitzat no surt i hi ha un avís (UI d'Exportar i LLEGEIX-ME; `missingTool` compta els que són per
  una eina, i només llavors surt la pista «afegeix-la a Preferències»).

### Avisos i «Després de la CNC»
- **Avisos** (`warnings`) = només problemes de debò: eina que falta o no hi arriba, forat de cantell que el contorn no
  toca, forat escurçat, cantonades vives amb radi, cara B sense cap mecanitzat possible…
- **Post-processos** (`postProcesses`, `postProcessesOf`) = el que toca a la peça després de la CNC, en l'ordre de
  `panelProcesses` (`core/process/processes.ts`), **sense el que ja fa el programa**: els forats de cantell que surten
  al programa A no hi són (només els que no fa la CNC, «perforadora horitzontal») i la 2a cara és el programa «Volt»
  («Programa cara B: <ref>Volt.xcs»). Els inglets **no són avisos**: són un segon procés a la serra («Inglet a 45° ·
  cantells 2+4 (serra)»); després «Cantejar cantells 1+3 (cantejadora)», «Encolar · …», «Push (Tip-On) · …».
- **Ruta** (`route`): «CNC: <ref>.xcs + <ref>Volt.xcs → serra (inglets) → cantejadora → …».
- On surt: LLEGEIX-ME.txt (per a cada peça: «Ordre de treball» i «Després de la CNC»; «Avisos» a part, només si n'hi ha),
  targeta de Maestro a Exportar (plegable «Després de la CNC (n peces)») i a la capçalera de cada .xcs com a
  **comentaris** en ASCII («->», «graus»): viatja amb el programa sense cap missatge a l'operari que aturi la màquina.
- **Numeració dels cantells**: la de l'app i de la llista de peces (`EDGE_NUMBER`: 1 dalt · 2 dreta · 3 baix ·
  4 esquerra, a la peça vista amb la cara A amunt com al programa). **Pendent de confirmar amb el taller**: el seu
  visor numera pel sòlid (`tallerEdgeNumbers`, vegeu `docs/export-taller.md`) i pot no coincidir.

### Tests
- `core/machine/maestro.test.ts`: contra el context real (`docs/maestro/AA10008021.machinecontext`, només
  lectura, `testContext.ts`): 42 eines, versió, capçals, mandrins horitzontals, capçalera, .cfgx, zip.
- `core/machine/pgmx.test.ts`: `Proyecto1.pgmx.xml` (versió, ToolKey, capçalera), .pgmx en zip i XML solt,
  noms per ID (nom tocat a mà respectat), reimportació que conserva els camps tocats, «Eina nova» sense codi.
- `core/export/maestroXcs.test.ts`: golden d'una peça (forats amb `"-1"` i amb eina concreta, cantell, ranura
  amb disc, Volt), ranura amb fresa, talls (rectangle amb la fresa petita i l'avís del radi), contorn amb arcs,
  semicercles amb centre, ranura rodona, punts repetits, forats de cantell en peces amb forma, sense eina (avís i
  `missingTool`), inglets i cantells com a post-processos (sense avís, ruta, comentari ASCII, LLEGEIX-ME), noms
  del .pgmx a l'MSL, cadenes C# i BOM, preferències amb una eina invàlida; propietats sobre 51 mobles del
  catàleg: cada mecanitzat té op o avís, tots els punts dins del pla, eina muntada que arriba a la fondària,
  noms únics, sense caràcters de control.
- `core/export/maestroNestXcs.test.ts`: gir de les peces (un forat a (u, v) per a 0/90/180/270, petjada i sentit dels
  contorns), la peça amb veta en Y a 90° amb els forats al seu lloc, talls per dins i contorn per fora antihoraris amb
  la fresa de nesting i el martiri, separació ≥ Ø i marge, ordre de les etapes i de les peces petites, estructura d'un
  tauler del catàleg (capçalera, peça `T01`, etiquetes, noms únics, tot dins del tauler, rutes) i 36 mobles del
  catàleg (cada peça amb contorn o avís, tot dins de la seva petjada).
- `core/export/xcsPreview.test.ts`: la **Vista CAM** d'Exportar llegeix el text dels .xcs (`parseXcsPreview`): mobles del catàleg amb el
  context real (peces, ordre, tipus, eina, fondària, posicions, rampa i passades iguals que els mecanitzats escrits; cap línia
  desconeguda), `nesting_T01.xcs`, el programa real del taller (recorreguts `CreateToolpath`, fondària de debò −19,3) i els per peça;
  òfset del centre de l'eina (rectangles exactes per fora i per dins, forma en L, cercles).
- `core/export/machineRules.test.ts`: regles del taller (valors per defecte i migració, eina per gruix, ranures en
  passades, caixeres, peces petites en 3 passades i l'ordre, rampa, eina que falta amb un sol avís).
- Mostres a `docs/maestro/samples/*.xcs` generades amb el context + `Proyecto1.pgmx` i les regles per defecte (UTF-8 amb BOM): `lateral_A.1.L.1` i `porta_A.1.F.9`
  de l'«Aparador sobre ferro», `peca-amb-forma_A.1.H.1` de la «Taula de centre «Nube»» (amb la capçalera de post-processos).

## Programes per tauler (nesting) — l'única opció
Petició del taller: els .xcs han de ser **els taulers del nesting**, un programa per tauler, no per peça.
`core/export/maestroNestXcs.ts` (`toMaestroNestXcs`, `cncNestOptions`, `boardRouter`, `toBoard`, `orderFeats`), pur i
testejat (`maestroNestXcs.test.ts`). A Exportar › Màquina CNC (Maestro) › «Programes .xcs»: **només per tauler** (l'opció
«Per peça» ja no surt a la UI; `toMaestroXcs` queda al nucli).

### Modelatge: una peça de treball = el tauler
- **Triat**: `CreateFinishedWorkpieceBox("T01", L, A, gruix)` + `CreateRawWorkpiece("T01", 0, 0, 0, 0, 0, 0)`
  (§3.2 p16-17) i tots els mecanitzats en **coordenades del tauler** (cara de dalt, origen a baix a l'esquerra).
  És com el projecte de nesting del taller (`samples/Proyecto1.pgmx.xml`: una peça 1200 × 800 × 18 amb un forat, un
  `ClosedPocket` i un contorn amb la «12mm diamant nesting», `SideOfFeature` Left = per fora).
- **Descartat**: diverses peces de treball a la taula (§3.11 p129-130, «workpieces machined contemporaneously»): cada
  peça té la seva bruta i `SetWorkpieceSetupPosition`, col·locades perquè no xoquin; és per a peces ja tallades sobre
  ventoses/barres (i la §3.12 p131 només hi afegeix l'optimització de canvis d'eina amb XConverter, §3.1.2.3). Un
  tauler sencer que es talla és una sola peça física.
- **Alternativa (no implementada): el mòdul de nesting del Maestro** (§4 p134): un .pgmx per peça (una peça i una
  fase) i un CSV amb `nom;tipus;descripció;quantitat;quantitat extra;L;A;gruix;material;veta (1 horitzontal, 2
  vertical);fitxer.pgmx` (`;` o `,`). Es podria generar a partir dels programes «Per peça» (convertits a .pgmx amb
  XConverter `-m 0`) si el taller prefereix niar al Maestro.

### Nesting per a la CNC
- `cncNestOptions(panels, màquina, opcions del moble)`: el mateix `nest()` (taulers per material, veta) amb
  **separació = Ø de la fresa de contorn + `spacingExtra`** (en lloc del gruix de la serra) i **marge = `edgeTrim`** de la
  màquina. La separació és una per a tot el moble: per a cada gruix es mira la fresa de contorn que farà servir el seu
  tauler (`boardRouter`: la de la regla de perfilar del gruix o, si no, la de nesting que travessa) i mana **la de Ø més
  gros** (19 + 30 mm amb el context real: la de 12 i la de 14 → 14 + 2 = 16). Aquesta fresa (`tool`) és la que diuen el
  LLEGEIX-ME, la capçalera de cada .xcs («separacio 16 mm (… D14 + 2)») i la targeta d'Exportar («Separació entre peces 16
  mm (Ø14 + 2)»). La pantalla Nesting (serra) no canvia.
- Opcions per màquina (`Machine.nesting`, opcional; `machineNesting` amb `DEFAULT_MACHINE_NESTING`; Preferències ›
  Màquines CNC › «Programes per tauler (nesting)»): fresa del contorn (automàtica: la que diu «nesting» al nom —la
  «12mm diamant nesting» del .pgmx—, si no la més petita que travessa), marge del tauler **10 mm**, separació **Ø + 2** (del taller: 14 mm amb la de 12, 16 amb la de 14),
  **martiri 0,3 mm** (contorns i talls passants fins a gruix + 0,3), peces petites **al final** (o al principi). Una
  reimportació les conserva.
- El marge és la vora que no s'aprofita: la fresa del contorn d'una peça arrambada al marge hi entra (fins a Ø).

### Programa d'un tauler
- Fitxer `T01_<material>_<gruix>.xcs` (UTF-8 amb BOM, com tots els .xcs; comentaris en ASCII), peça de treball amb el **nom
  del tauler del CSV** (`boardName`: `Noguera_xapada_19#01`, numerat per material i gruix, com el real
  `U767_Gris_cubanita_19#01`). Capçalera com el programa real del taller (`MachineParameters mp=GetMachiningParameters();`,
  `SetMachiningParameters` amb `MechanicalOptions` 16777216, `SetPreserveWorkingSequence`, `SetWorkPieceFallPrevention`,
  `SetWorkpieceSetupPosition(0, -20, 0, 0)`, macro `Pload`; després de `SelectWorkplane("Top")`, campana 1 i
  `ResetAuxiliaryHood`/`ResetDustpan`), editable a Preferències › Màquines CNC › «Programes per tauler» (`Machine.nesting.program`,
  `nestProgram`, `DEFAULT_NEST_PROGRAM`). Abans de cada grup d'eina, `//BROCA PLANA <eina>` o `//FRESA PLANA <eina>` (el parser
  del taller hi atribueix els forats) i els `CreateDrill` amb els paràmetres opcionals del real (`0, -1, -1, "P", 0, 2`).
  Capçalera de comentaris: tauler, material,
  mida, peces i aprofitament, marge/separació/fresa/martiri, i la llista de peces (ref, nom, mida, cantonada, gir) i
  les **etiquetes** (ref + centre). Abans del contorn de cada peça, `// Peca <ref> (...) - etiqueta al centre (x, y)`.
- **Gir** (`toBoard`): el nesting col·loca a 0° o 90° (antihorari, sense mirall; el mateix que `localToBoard` del CSV):
  90° → (u, v) ↦ (x + A − v, y + u); també 180° i 270° per si de cas. Un gir conserva el sentit dels contorns i dels
  arcs (bulge).
- Només la **cara A**: forats de cara (regles de sempre, `"-1"`), **ranures sempre amb fresa** (un disc de cantell a
  cantell tallaria les peces del costat), talls passants per dins (costat 0) i el **contorn de cada peça per fora**
  (costat 1) amb la fresa de nesting (o una de més petita si la forma té arcs o cantonades entrants més tancats), tot
  passant fins a gruix + martiri.
- **Ordre** (`orderFeats`): forats (per Ø) → ranures (per eina) → talls (per eina) → contorns; dins de cada grup, pel
  **veí més proper**; els contorns per mida (classes de ×2 d'àrea, les petites al final o al principi) i veí més proper.
- Noms únics: `<ref>_Forat_1`, `<ref>_Ranura_1`, `<ref>_Tall_1`, `<ref>_Contorn_1` (+ `_G` per a la geometria).
- **El que no es fa al nesting** va a la ruta de la peça (LLEGEIX-ME, plegable «Després de la CNC» d'Exportar):
  «CNC (tauler N) → …»: forats de cantell («perforadora horitzontal»), **cara B** («Mecanitzats cara B (n forats): fer a
  la perforadora / segona passada»; sense programes «Volt») i inglets (serra), cantells, encolar, push.
- LLEGEIX-ME: taulers (fitxer, material, mida, peces, aprofitament), peces que no hi caben, ruta de cada peça i avisos.
- Mostra: `docs/maestro/samples/nesting_T01.xcs` (tauler 1 de l'«Aparador sobre ferro», amb el context + `Proyecto1.pgmx`).
- Test amb el parser del taller: `core/export/tallerXcs.roundtrip.test.ts` (`TALLER_DIR=… pnpm exec vitest run …`; se salta si no
  hi és el repo del taller): llegeix el programa real i els nostres (22 mobles × 2 màquines): tauler, forats (posició, fondària, Ø,
  eina del comentari) i fresats `CreateRoughFinish` (eina, fondària).

## Comparació amb un programa real del taller (U767…)
Mostra: `docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs`. Programa de nesting **de producció** del taller, fet amb el seu
flux actual TopSolid → Maestro, per a aquesta mateixa màquina; **s'hi va mecanitzar**. ASCII sense BOM, CRLF, 200 línies. Tauler
`U767_Gris_cubanita_19#01` de 2800 × 2070 × 19 amb 84 forats, 1 fresat obert, 1 tall interior i 3 contorns.

Llegenda: **[real]** = el que diu el fitxer; **[suposició]** = interpretació nostra, per confirmar.

### Coincideix (ja ho fèiem igual)
- **[real]** Una peça de treball = el tauler (`CreateFinishedWorkpieceBox` 2800 × 2070 × 19 + `CreateRawWorkpiece(…, 0, 0, 0, 0, 0,
  0)`) i tot en coordenades del tauler, cara `Top`, origen a una cantonada del tauler, X pel costat de 2800 i Y pel de 2070 (les
  peces van de x = 6 a 2418, y = 6 a 2064, en centre d'eina).
- **[real]** Broques amb eina `"-1"` i capçal `"-1"` (la tria el Maestro); el nom de la broca només va al comentari.
- **[real]** Ordre: forats (per eina) → fresat obert → tall interior → contorns de les peces. És el nostre `orderFeats`.
- **[real]** Fresa «12mm diamant nesting» (el nom del .pgmx, no `E128`) per a tot el fresat.
- **[real]** Passants a −19,3 = gruix + 0,3: el nostre martiri de 0,3 mm.
- **[real]** Separació entre peces veïnes 14 mm = Ø12 + 2 (OP9 acaba a y = 1439 i OP8 comença a 1453): la nostra `spacingExtra` 2.
- **[real]** Cada contorn comença **al mig del costat recte més llarg** (OP7: x = 1182 = (12 + 2352) / 2; OP8: 1209,25; OP9: 1110,5) i
  hi torna al final: el nostre `rampStart`.
- **[real]** Contorns de les peces en sentit **antihorari** (arcs `isClockwise = false`), com els nostres.
- **[real]** Contorns d'una sola passada a tota la fondària en peces grans (1,1–2,0 m²): com la regla «grans, d'una passada».

### Diferent, i què vol dir (de més a menys important)
1. **Recorreguts explícits.** **[real]** Cada fresat és `CreatePolyline` d'**un sol punt** + `AddSegmentToPolyline` al mateix punt +
   `SetAttribute("DEPTH", −x,01)` + `CreateRoughFinish(nom, −x, …, "12mm diamant nesting", "-1", 0, -1, -1, -1, 0)` i després el
   recorregut del **centre de l'eina** amb `CreateToolpath` / `AddSegmentToToolpath` / `AddArc2PointRadiusToToolpath` (X, Y, Z;
   Z = 0 a la cara de dalt, negativa cap avall, +2 o +10 d'alçada de seguretat). El manual (§3.5.13 p88) diu que amb recorregut
   «el mecanitzat es fa només com l'ha especificat l'usuari i no es tenen en compte estratègies». La geometria i la fondària del
   `CreateRoughFinish` hi són de farciment (−2 per a un passant de −19,3). **Nosaltres** donem la geometria de la peça
   (`CreateContour` costat 1/0, `CreateContourPocket`, `CreateRoughFinish` sobre la ranura) i deixem que el Maestro calculi el
   recorregut i l'entrada (`SetApproachStrategy`). **[suposició]** Totes dues coses són vàlides a l'MSL; la nostra depèn que el
   Maestro compensi bé el radi (`CreateContour` amb `correction` 0 = «central» i `sideOfContour` 1 = fora, com l'exemple del manual
   p53): **cal mirar-ho a la vista CAM** (que el contorn quedi 6 mm per fora de la peça). **No ho hem canviat**: fer els
   recorreguts nosaltres vol dir calcular l'òfset de qualsevol forma (arcs, cantonades entrants), les passades i les entrades; per
   a rectangles seria trivial (vegeu el punt 3). Conseqüència: el **parser del taller** (`parseXcs`) només veu com a fresat el
   `CreateRoughFinish` i només en treu punts dels `…Toolpath`: dels nostres programes hi veu els forats i les ranures (sense punts),
   **no** els contorns, els talls ni les caixeres.
2. **Capçalera.** **[real]** `MachineParameters mp=GetMachiningParameters();` (C#: llegeix els paràmetres; la variable no es fa
   servir), `SetMachiningParameters("AD", 1, 10, 16777216, false);` (amb `;;`), `SetPreserveWorkingSequence(true);`,
   `SetWorkPieceFallPrevention(true);`, i després de la peça `SetWorkpieceSetupPosition(0, -20, 0, 0);` (§3.9.2 p115: la cantonada
   0,0,0 del tauler a X 0, Y −20 de la taula) i `CreateMacro("Pload","PLOAD",1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);` (§3.6.2 p103:
   aplica la macro .xsp `PLOAD` que ja és al Maestro del taller). Les dues `Set…Prevention/Sequence` no són al manual R4.
   `MechanicalOptions` **16777216** = 0x01000000; el `Proyecto1.pgmx` (un projecte desat al Maestro) diu 16973824 = 0x01030000
   (dos bits més, 0x00020000 i 0x00010000) i el context exportat, 0. **Fet**: els programes per tauler escriuen tota aquesta
   capçalera (abans només `SetMachiningParameters` amb 16973824). **Decisió**: la `MechanicalOptions` dels programes per tauler és
   la del programa real (és el mateix flux, nesting, i va funcionar), a part de la capçalera de la màquina (que continua sent la del
   .pgmx per als programes per peça); tot és editable a Preferències › Màquines CNC › «Programes per tauler» (`Machine.nesting.program`).
   **[suposició]** El significat dels bits, de `-20` (topalls / referència de càrrega?) i dels paràmetres de `PLOAD`.
3. **Entrada i sortida.** **[real]** Contorns: entrada en **rampa a 30°** (de Z +2 a −19,3 en 36,89 mm: 21,3 / tan 30°) per una línia
   paral·lela al costat **1 mm cap enfora** (cap al buit entre peces: amb la separació Ø + 2 no toca la del costat), acabant al
   punt mig; pas d'1 mm cap al contorn; volta sencera; **sortida vertical** a +2. Tall interior (OP6): igual però la rampa va
   **3 mm cap a dins** del forat (al retall). Fresat obert (OP5): baixa de +10 a −14 en 9,7 mm. **Nosaltres**:
   `SetApproachStrategy(true, false, k)` / `SetRetractStrategy(true, false, k, 0)` amb k = 40 / radi (el Maestro fa l'entrada lineal
   «en baixada»; angle i costat, els seus). **[suposició]** Equivalent si la vista CAM ho confirma; si no, la rampa explícita per a
   rectangles és trivial de copiar.
4. **Comentaris d'eina.** **[real]** `//BROCA PLANA FO-FPL-8`, `//FRESA PLANA 12mm diamant nesting` abans de cada grup (el parser del
   taller atribueix els forats a l'últim comentari d'eina). **Fet**: ara els escrivim igual (`//BROCA PLANA 006`, amb el nom de la
   broca que l'app ha comprovat; `//FRESA PLANA <eina>`); la resta dels nostres comentaris no diuen BROCA/FRESA.
5. **`CreateDrill`.** **[real]** `CreateDrill("OP1_1", x, y, fondària, Ø, "", TypeOfProcess.Drilling, "-1", "-1", 0, -1, -1, "P",
   0, 2)`: descàrregues 0, velocitats −1, forat pla `"P"`, con 0, **cota de seguretat 2** (Table 28 p36). **Fet**: els nostres
   igual (abans acabaven al capçal).
6. **Nom de la peça de treball.** **[real]** `<material>_<gruix>#NN`. **Fet**: el nom del tauler del CSV (`boardName`); abans `T01`.
   El nom del fitxer continua sent `T01_<material>_<gruix>.xcs` (el real seria `U767_Gris_cubanita_19_01.xcs`).
7. **Campanes.** **[real]** `SetPneumaticHoodPosition(1); ResetAuxiliaryHood(); ResetDustpan();` un cop, després de
   `SelectWorkplane("Top")` (Table 50 p79: 1 = campana baixa a la posició 1). **Fet**: igual (editable).
8. **Marge del tauler.** **[real]** Les peces comencen a **12 mm** de la vora (x = 12, y = 12, fins a 2070 − 12): el centre de la fresa
   Ø12 a 6, el tall arriba just a la vora (0..12). **Nosaltres**: `edgeTrim` 10 (la fresa surt 2 mm fora del tauler). **No ho hem
   canviat**: és una opció de la màquina; **[suposició]** el taller fa marge = Ø.
9. **Fondàries dels forats.** **[real]** Ø2 × 5,15 (parells a 32 mm, a 37 mm del cantell: **[suposició]** pilots de base de frontissa),
   Ø3 × 9 (dues files a pas de 64), Ø8 × 11 (espigues a 10 mm dels extrems), **Ø4 × 18,9 en un tauler de 19** (0,1 mm de pell). Les
   nostres surten de les ferramentes del moble (Ø8 × 12, Ø5 × 12…). La nostra regla «més fondo que gruix − 0,5 → gruix − 1»
   escurçaria aquest 18,9 a 18. **No ho hem canviat** (pregunta).
10. **Nom «Tercera passada».** **[real]** Els tres contorns de peça es diuen `OPn_1 - Tercera passada` (descripció «Tercera passada») i
    són l'única passada, a tota la fondària, en peces de 1,1–2,0 m². **[suposició]** És el nom del procés de TopSolid; no vol dir que
    hi hagi primera i segona passada en aquest programa. Nosaltres: `contorn` (i `_P1…_P3` a les peces petites, < 0,8 m²).
11. **Sentit dels talls interiors.** **[real]** OP6 (forat allargat de 68 × 208, R34) va en sentit **horari**: l'eina sempre a la dreta
    del sentit de la marxa, com als contorns antihoraris de fora. **Nosaltres**: polilínia antihorària i `CreateContour` costat 0.
    **[suposició]** Si el Maestro segueix el sentit de la geometria, els nostres talls interiors es fresarien a l'inrevés
    (concordança/oposició) que els del taller. **No ho hem canviat** (pregunta; a la vista CAM es veu).
12. **Ordre dels contorns.** **[real]** OP7 (1,12 m²), OP8 (1,45 m²), OP9 (2,0 m²): ni per mida ni per proximitat evident.
    Nosaltres: per mida (les grans primer, les petites al final) i veí més proper.
13. **Fitxer.** **[real]** ASCII sense BOM. Nosaltres: UTF-8 **amb** BOM. El real prova que el Maestro llegeix un fitxer sense BOM, no
    que el BOM falli. Sense canvis (si els noms d'eina són ASCII, tots dos són iguals byte a byte excepte el BOM).
14. **El parser del taller** (no el toquem, només per informar el germà): als contorns del real llegeix la fondària del
    `CreateRoughFinish` (2 mm), no la de debò (−19,3 de la Z del recorregut).

## Regles de mecanitzat del taller (`Settings.machiningRules`)
Les va donar el germà (octubre 2026). **Del taller, les mateixes per a totes les màquines** (per decisió de l'usuari: «en un
taller les regles són les mateixes per a les dues CNC»; abans eren per màquina, `Machine.rules`), editables a Preferències ›
Regles de mecanitzat (`settings/MachineRules.tsx`, amb una línia per màquina: ✓ o «falta «X»», `missingRuleTools`). A
l'export arriben a `Machine.rules` amb `machineWithRules(settings)` / `withWorkshopRules`; model a `core/model/machine.ts` (`MachineRulesSchema`, `defaultMachineRules`,
`machineRules`, `isSmallPart`), tria a `core/machine/rules.ts` (`findRuleTool`, `profileRuleFor`, `RulePicker`) i
emissió compartida a `core/export/maestroXcs.ts` (`passDepths`, `grooveStrategy`, `contourPasses`, `contourLine`,
`pocketLines`, `rampStart`, `rampLines`). Tests: `core/export/machineRules.test.ts`.

| Regla | Per defecte | Com surt a l'MSL |
|---|---|---|
| Ranures (obertes per algun extrem) | «8mm diamant», 6 mm per passada | `CreateBidirectionalMillingStrategy(true, 6, 0)` just abans del `CreateRoughFinish` si la ranura és més fonda (§3.5.11.2 p60, Table 39; exemple p63; les estratègies són «no modals», p58). `XcsOp.passes` = fondària de cada capa |
| Caixeres (rebaix cec tancat pels dos extrems, i la fresa hi cap: Ø ≤ ample − 0,5, p56) | «12mm diamant nesting» | polilínia tancada + `CreateContourPocket(nom, fondària, "caixera", TypeOfProcess.ConcentricalPocket, eina, "-1", -1, -1, -1, 50)` (§3.5.10 p55, Table 37; exemples p55/p57; com la `ClosedPocket` del .pgmx, Overlap 0,5) |
| Perfilar per gruix (contorns per fora i talls passants per dins) | 8–22 mm «12mm diamant nesting» · 23–41 mm «14mm diamant nesting» (llista editable) | la fresa al `CreateContour` (p53). Amb cantonades vives o arcs més tancats que la fresa, la tria de sempre (la més petita / la que hi cap) |
| Rampa (només al nesting, perfilats) | sí, 40 mm | `ResetApproachStrategy(); ResetRetractStrategy(); SetApproachStrategy(true, false, k); SetRetractStrategy(true, false, k, 0);` abans del `CreateContour` i els dos `Reset…` després (§3.5.11.6 p71, Tables 45-46; exemple p72). k = llargada / radi (Ø12 → 6,667) |
| Peces petites (menys de 0,8 m²; les grans, d'una passada) | desbast Z 1 / XY 1, desbast Z 0,5 / XY 0, final | un `CreateContour` per passada: fondària = gruix − Z i `overMaterial` = XY (darrer paràmetre, Table 36 p53); la final fins al martiri (nesting, `nesting.overcut`, 0,3) o als passants (per peça, `throughExtra`). Peces normals: una passada |

- **Eina pel nom**: `findRuleTool` mira el nom de l'MSL (`mslName`, del .pgmx), el nom i el codi, sense majúscules ni
  espais de més; només freses que es poden fer servir (`usableTool`: muntades, automàtiques i amb codi de Maestro; el
  selector de la regla només ofereix aquestes, amb el nom). Si **no hi és**, no es pot fer servir o no arriba a la
  fondària: la tria automàtica de sempre i **un sol avís per regla i eina** («regla «Ranures»: l'eina «8mm diamant» no és
  a la màquina…», una sola eina a `missingTool`). Al selector de la regla surt «· falta». El context exportat (Maestro 2.00.004) només té la «12mm diamant
  nesting» (E128, pel .pgmx); la «8mm diamant» i la «14mm diamant nesting» s'han d'afegir a «Eines» (amb el codi de
  Maestro) o importar un .pgmx que les faci servir.
- **Ranures i disc**: amb la fresa de la regla a la màquina, les ranures de cantell a cantell van amb fresa (la regla
  mana sobre «Disc si es pot»); amb «Preferir disc», disc com abans.
- **Martiri unificat**: la passada final de les peces petites no té valor propi: és el martiri del nesting (o els
  passants de més per peça). Les de desbast es defineixen per l'altura que deixen (Z) i el sobrant al costat (XY).
- **Ordre al nesting** (`orderFeats`): els desbastos de les peces petites primer (la passada 1 de totes, després la
  2…, amb el tauler encara sencer), després les peces normals (per mida) i les passades finals de les petites al
  final (o al principi amb «Peces petites: al principi»). Les petites van marcades (`small`, `isSmallPart`), així l'ordre
  es manté encara que no tinguin cap passada de desbast.
- **Rampa**: el contorn comença al **mig del costat recte més llarg** (`rampStart`, s'hi afegeix un punt) i tanca amb
  aquell costat (`ClosePolyline`): l'entrada lineal tangent cau sobre el mateix tall i no surt cap a les peces del
  costat (la separació és Ø + 2). Llargada = la de la regla, com a molt la meitat d'aquell costat; sense cap costat
  recte de 2 × Ø (cercles), sense rampa. Per peça, sense rampa.
- **Migració (preferències v11, additiva i idempotent)**: sense `machiningRules`, les de la màquina per defecte (o la primera
  que en tingui; si cap, les per defecte; `rulesFromMachines`) i les `rules` de les màquines es treuen (l'esquema les continua
  llegint per compatibilitat; importar un fitxer d'abans també les passa). Una reimportació (`mergeReimport`) no en porta.
  «Restaurar valors inicials» torna `defaultMachineRules()`. Els valors provisionals d'abans (separació Ø + 1, peça petita
  «costat < 300 mm o < 0,1 m²») es migren **un sol cop** (`Machine.rulesVersion`, `MACHINE_RULES_VERSION`, `migrateMachine`,
  abans de passar les regles al taller) i la migració es desa: si després l'usuari els torna a triar, es queden. Les màquines
  noves ja porten la marca.

### Dubtes de les regles (per confirmar amb el taller)
- **Llindar de «peça petita»**: menys de 0,8 m² (del taller, octubre 2026). Les grans, d'una passada.
  Amb aquest llindar gairebé totes les peces d'un moble de cos són petites (un lateral de 720 × 560 fa 0,40 m²); si el
  taller vol també els llistons llargs, «Costat menor que» (0 = no compta).
- **Rampa**: l'MSL no té «rampa» com a tal. S'ha fet amb `SetApproachStrategy(isLinear = true, isQuote = false)`
  (p71: «in downstroke, from security height along Z»), entenent que «en baixada» és entrar baixant al llarg del segment
  d'aproximació. Cal veure-ho a la vista CAM. Alternativa del manual: `CreateHelicMillingStrategy(cuttingDepth, true, 0)`
  (p61, Table 41; baixa en hèlix pel mateix perfil), si el taller ho prefereix.
- **`overMaterial`** de `CreateContour` (Table 36: «Overmaterial») s'ha fet servir com el sobrant al costat (XY); el Z
  es deixa amb la fondària. Al .pgmx hi ha `AllowanceSide` i `AllowanceBottom`: confirmar que l'`overMaterial` va a
  l'`AllowanceSide`.
- **Caixeres**: `TypeOfProcess.ConcentricalPocket` (com els exemples p55/p57/p69; la taula diu GeneralRouting) i una
  sola passada (el .pgmx del taller: `AllowMultiplePasses` false). Si n'hi ha de molt fondes, `CreateContourParallelStrategy`
  (p69) permetria passades.
- Gruixos entre files (22,5 mm) o fora (> 41 mm): tria automàtica, sense avís.

## Preguntes obertes per al taller
Ja resolt (revisió amb el manual i el .pgmx real): orígens i sentit de X de les cinc cares i el gir de la cara
B (taula de dalt); el paràmetre `tool` és el nom de l'eina; les broques del taller van sense eina.

1. **Prova a la màquina**: passar `PROVA_ORIENTACIO.xcs` i `PROVA_ORIENTACIOVolt.xcs` (forats a 100 mm de
   l'«esquerra» de cada cara) i confirmar-ho de debò.
2. **Codificació**: Maestro llegeix bé un .xcs en UTF-8 amb BOM? (Si no: UTF-16 LE amb BOM o ANSI.) Provar amb
   una eina amb accent.
3. **Noms d'eina**: tots els de la biblioteca del Maestro 2.0.5 han canviat com l'E128? Desar un projecte amb
   **totes** les eines (una operació per eina) i importar-lo, o exportar de nou el context (`def.tlgx`) del
   Maestro actual.
4. **Broques amb `"-1"`**: el Maestro tria bé la broca vertical (i el mandrí horitzontal) pel Ø? Si no, «Eina
   concreta» a la màquina.
5. **Capçalera**: ~~quina `MechanicalOptions` i cal `SetWorkpieceSetupPosition`?~~ El programa real del taller ho diu
   (16777216, `SetPreserveWorkingSequence`, `SetWorkPieceFallPrevention`, `SetWorkpieceSetupPosition(0, -20, 0, 0)`, `Pload`): ja
   surt així als programes per tauler. Queda: què vol dir cada bit, el −20 i els paràmetres de `PLOAD`; i si és igual per a tots
   els gruixos i materials.
6. **Cara B**: dos programes (`Volt`) o un de sol amb `CreateWorkplan("Volt")` (§3.8 p112) i `CreateMessage`
   (§3.7.5 p111)?
7. ~~Peces ja tallades o nesting?~~ **Nesting** (resposta del taller): un programa per tauler (vegeu a dalt).
8. **Ranures**: disc E604 (3,2) en passades o fresa? Les ranures del fons (10 mm) no tenen fresa: falta la de
   10 (o 8) a la biblioteca exportada.
9. **Eines que falten al .tlgx** (la llista del germà): 2, 3, 4, 6, 8, 10, 16, 20, 22, 30 mm, cocodrils… Una
   fresa més petita que la Ø12 deixaria cantonades més vives als talls rectangulars (ara radi 6).
10. **Fixació**: ventoses automàtiques (XConverter `-m 12`, p15) o manuals (`SetSuctionCupPosition`,
    §3.10.2 p126)?
11. **Tecnologies** (`ApplyTechnology`, §3.5.14 p91): en tenen de fetes (p. ex. «Ranura fons») que s'hagin de
    fer servir en lloc de CreateSlot/CreateRoughFinish?
12. **Passants**: 1 mm per sota és prou (o massa) amb les ventoses?
13. **Numeració dels cantells** a l'etiqueta i la ruta («Inglet a 45° · cantells 2+4», «Cantejar cantells 1+3»): la de
    l'app (1 dalt · 2 dreta · 3 baix · 4 esquerra) és la que fan servir al taller, o la del seu visor?
14. **Nesting — peces petites**: cal deixar **pontets (tabs)** o una **pell (onion-skin)** a les peces petites (els
    llistons de 12 mm d'ample, els fronts petits) perquè no es moguin quan el buit ja no les aguanta? Ordre dels
    contorns: les petites **al final** (com ara) o **al principi** (molts CAM ho fan així perquè el tauler encara
    tanca el buit)? Hi ha opció a la màquina.
15. **Martiri**: 0,3 mm per sota del tauler és el valor que fan servir? (Passades: ja les van dir —regles—; peces
    normals en una, petites en tres.)
16. **Zones de buit**: el tauler va sobre el martiri amb el buit de tota la taula (camp «AD»)? Cal triar zones
    (`SetSuctionCupPosition` §3.10 p117-128 no s'aplica a una taula de martiri) o un altre `TableOptions`?
17. **Etiquetes**: imprimeixen etiquetes al taller abans de descarregar? Amb quin format (ref + centre ja surten
    com a comentaris)?
18. **Marge i separació**: 10 mm de marge els van bé? (Al programa real les peces van a 12 = Ø de la fresa.) (La separació ja és la del taller: Ø + 2.) Prefereixen el mòdul de nesting del Maestro
    (§4 p134, CSV + .pgmx per peça)?
19. **Recorreguts explícits o calculats pel Maestro** (comparació amb el programa real, punt 1): els nostres contorns són
    `CreateContour` sobre la forma de la peça i el Maestro hi fa el recorregut; TopSolid envia el recorregut del centre de l'eina.
    A la vista CAM, el contorn queda per fora de la peça (6 mm amb la Ø12) i l'entrada és acceptable? Si prefereixen recorreguts
    explícits (i que el seu parser vegi els contorns), per a peces rectangulars és fàcil de fer igual que TopSolid.
20. **Sentit dels talls interiors**: TopSolid els fa horaris (els contorns de fora, antihoraris); els nostres són antihoraris amb
    `CreateContour` costat 0. Importa?
21. **Forats gairebé passants**: el real fa Ø4 × 18,9 en un tauler de 19. Nosaltres escurcem a gruix − 1 tot el que passa de gruix
    − 0,5. Quina pell mínima volen?
