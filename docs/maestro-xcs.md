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
    continuousCycle)` (Table 79 p114, exemples p8 i p114): les cinc primeres van tal qual. **Mirall tecnològic i
    conservar la seqüència no tenen paràmetre** a la instrucció (el més semblant és `SetPriority`, §3.5.16 p95,
    però és per operació): es desen i es mostren, no s'escriuen. Sense XilogHeaderParameters, la capçalera per
    defecte és la del projecte (`DEFAULT_HEADER`).
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
- Preferències: una eina invàlida es descarta sola (`repairMachine`), no tota la màquina.
- Desat a `Settings.machines` (preferències **v10**, additiu: les v9 surten amb la llista buida); una
  sola `isDefault`.

## Programes
Un `.xcs` per peça de CNC amb el nom de la ref del taller (`A.1.L.1.xcs`, el mateix `ÍNDICE_3D` del CSV) i,
si té mecanitzats a la cara B, `A.1.L.1Volt.xcs` (com el «2a cara» de TopSolid). Tot en un .zip sense
compressió (`zipStore`, `xcsZip`) amb un `LLEGEIX-ME.txt` (avisos inclosos). CRLF.

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
| Capçalera | `SetMachiningParameters("AD", 1, 10, 16973824, false);` (valors de la màquina, editables) | §3.9.1 p114 (Table 79), p8 |
| Peça | `CreateFinishedWorkpieceBox(ref, L, A, gruix);` `CreateRawWorkpiece(ref, 0, 0, 0, 0, 0, 0);` | §3.2 p16-17 |
| Cara | `SelectWorkplane("Top")` / `"Front"` / `"Back"` / `"Left"` / `"Right"` | §3.3.4 p23 |
| Forat | `CreateDrill(nom, x, y, fondària, Ø, "", TypeOfProcess.Drilling, "-1" o eina, "-1");` | §3.5.1 p36 |
| Ranura amb disc | `CreateSegment(…)` + `CreateSlot(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.1 p25, §3.5.7 p49 |
| Ranura amb fresa | `CreatePolyline` + `AddSegmentToPolyline` + `CreateRoughFinish(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.4 p30-33, §3.5.3 p40-41 |
| Tall / contorn | polilínia tancada (`AddArc2PointRadiusToPolyline(x, y, r, horari, >180°)`; els semicercles `AddArc2PointCenterToPolyline(x, y, cx, cy, horari)` (Table 21 p31); `ClosePolyline("")`) o `CreateCircleCenterRadius(nom, cx, cy, r, false)` + `CreateContour(nom, fondària, 1, costat, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` (costat 0 = dins, 1 = fora) | §3.4.1.3 p28, p31-32, §3.5.9 p53, p79 |

- Capçal sempre `"-1"` (automàtic, p36): Maestro el tria segons on és muntada l'eina.
- Broques horitzontals amb eina `"-1"`: el parell esquerra/dreta (019/020, 021/022) depèn del sentit i
  l'.atrx no diu quin mandrí mira cap a on.
- Sense estratègies, aproximacions, campanes ni ventoses: Maestro hi posa els valors per defecte de
  l'eina (§3.5 p35). Noms únics per programa (§2 p5).
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
- Sense eina → el mecanitzat no surt i hi ha un avís (UI d'Exportar i LLEGEIX-ME). Inglets: avís (serra).

### Tests
- `core/machine/maestro.test.ts`: contra el context real (`docs/maestro/AA10008021.machinecontext`, només
  lectura, `testContext.ts`): 42 eines, versió, capçals, mandrins horitzontals, capçalera, .cfgx, zip.
- `core/machine/pgmx.test.ts`: `Proyecto1.pgmx.xml` (versió, ToolKey, capçalera), .pgmx en zip i XML solt,
  noms per ID (nom tocat a mà respectat), reimportació que conserva els camps tocats, «Eina nova» sense codi.
- `core/export/maestroXcs.test.ts`: golden d'una peça (forats amb `"-1"` i amb eina concreta, cantell, ranura
  amb disc, Volt), ranura amb fresa, talls (rectangle amb la fresa petita i l'avís del radi), contorn amb arcs,
  semicercles amb centre, ranura rodona, punts repetits, forats de cantell en peces amb forma, sense eina, noms
  del .pgmx a l'MSL, cadenes C# i BOM, preferències amb una eina invàlida; propietats sobre 51 mobles del
  catàleg: cada mecanitzat té op o avís, tots els punts dins del pla, eina muntada que arriba a la fondària,
  noms únics, sense caràcters de control.
- Mostres a `docs/maestro/samples/*.xcs` generades amb el context + `Proyecto1.pgmx` (UTF-8 amb BOM).

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
5. **Capçalera**: `MechanicalOptions` 16973824 (del projecte) o 0 (del context)? Què vol dir cada bit? Cal el
   mirall tecnològic i «conservar la seqüència» (no són a l'MSL: es posen a Maestro)? Cal
   `SetWorkpieceSetupPosition` (§3.9.2 p115) o la posa Maestro?
6. **Cara B**: dos programes (`Volt`) o un de sol amb `CreateWorkplan("Volt")` (§3.8 p112) i `CreateMessage`
   (§3.7.5 p111)?
7. **Peces ja tallades o nesting?** La màquina és de barres (8 barres, ventoses): les peces arriben escairades
   (llavors no cal el contorn de les rectangulars) o també fa nesting amb les freses «nesting»?
8. **Ranures**: disc E604 (3,2) en passades o fresa? Les ranures del fons (10 mm) no tenen fresa: falta la de
   10 (o 8) a la biblioteca exportada.
9. **Eines que falten al .tlgx** (la llista del germà): 2, 3, 4, 6, 8, 10, 16, 20, 22, 30 mm, cocodrils… Una
   fresa més petita que la Ø12 deixaria cantonades més vives als talls rectangulars (ara radi 6).
10. **Fixació**: ventoses automàtiques (XConverter `-m 12`, p15) o manuals (`SetSuctionCupPosition`,
    §3.10.2 p126)?
11. **Tecnologies** (`ApplyTechnology`, §3.5.14 p91): en tenen de fetes (p. ex. «Ranura fons») que s'hagin de
    fer servir en lloc de CreateSlot/CreateRoughFinish?
12. **Passants**: 1 mm per sota és prou (o massa) amb les ventoses?
