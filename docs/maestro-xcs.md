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
  - `Settings/XilogHeaderParameters.xml`: `ExecutionFields` («AD»), `TableOptions` (10),
    `MechanicalOptions` (0) → capçalera del programa.
- Lector XML propi (`core/machine/xml.ts`): el `core/` no té DOM als tests.
- `auto`: no es fan servir sols els exemples de SCM («Example: …»), els palpadors ni els agregats.
- Les eines que el taller té però no surten a la biblioteca exportada (la llista del germà a
  `docs/maestro/eines.txt` en té moltes més que el `.tlgx`: només hi ha dues freses, Ø12 i Ø14) es poden
  **afegir a mà** amb el codi de Maestro. Tornar a importar la mateixa sèrie conserva les afegides a mà, el
  nom i les opcions.
- Desat a `Settings.machines` (preferències **v10**, additiu: les v9 surten amb la llista buida); una
  sola `isDefault`.

## Programes
Un `.xcs` per peça de CNC amb el nom de la ref del taller (`A.1.L.1.xcs`, el mateix `ÍNDICE_3D` del CSV) i,
si té mecanitzats a la cara B, `A.1.L.1Volt.xcs` (com el «2a cara» de TopSolid). Tot en un .zip sense
compressió (`zipStore`) amb un `LLEGEIX-ME.txt` (avisos inclosos). Text ASCII i CRLF.

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
- X = costat llarg de la peça (u de l'app), Y = curt (v), Z = gruix. Origen a la cantonada de baix a
  l'esquerra de la cara A vista des de dalt: la mateixa convenció u/v de l'app i del DXF. El manual diu que
  cada pla té l'origen «a baix a l'esquerra» (§3.4 p24) i que la peça es posiciona per la cantonada de
  quotes mínimes (§3.9.2 p115).
- Cantells → cares estàndard (§3.3.1 p19): 3 (y = 0) → `Front`, 1 (y = A) → `Back`, 4 (x = 0) → `Left`,
  2 (x = L) → `Right`. Cada cara vista des de fora, X horitzontal i Y = alçada des de la cara B:
  Front X = u · Back X = L − u · Left X = A − v · Right X = v; els forats a Y = gruix / 2.
  (Coincideix amb els exemples del manual: a `Left`/`Right` les X van de 0 a l'ample i les Y de 0 al
  gruix, p23 i p33.) **Pendent de validar** el sentit de X a Back i Left (vegeu `PROVA_ORIENTACIO`).
- Cara B («Volt»): la peça girada sobre l'eix X (el cantell 1 passa a baix): (x, y) → (x, A − y). Els forats
  de cantell, els talls passants i el contorn van al programa de la cara A.

### Instruccions MSL (només les dels exemples del manual)
| Què | MSL | Manual |
|---|---|---|
| Capçalera | `SetMachiningParameters("AD", 1, 10, 0, false);` | §3.9.1 p114, p8 |
| Peça | `CreateFinishedWorkpieceBox(ref, L, A, gruix);` `CreateRawWorkpiece(ref, 0, 0, 0, 0, 0, 0);` | §3.2 p16-17 |
| Cara | `SelectWorkplane("Top")` / `"Front"` / `"Back"` / `"Left"` / `"Right"` | §3.3.4 p23 |
| Forat | `CreateDrill(nom, x, y, fondària, Ø, "", TypeOfProcess.Drilling, eina, "-1");` | §3.5.1 p36 |
| Ranura amb disc | `CreateSegment(…)` + `CreateSlot(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.1 p25, §3.5.7 p49 |
| Ranura amb fresa | `CreatePolyline` + `AddSegmentToPolyline` + `CreateRoughFinish(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` | §3.4.1.4 p30-33, §3.5.3 p40-41 |
| Tall / contorn | polilínia tancada (`AddArc2PointRadiusToPolyline(x, y, r, horari, >180°)`, `ClosePolyline("")`) o `CreateCircleCenterRadius(nom, cx, cy, r, false)` + `CreateContour(nom, fondària, 1, costat, desc, TypeOfProcess.GeneralRouting, eina, "-1", 0, -1, -1, -1, 0);` (costat 0 = dins, 1 = fora) | §3.4.1.3 p28, p31-32, §3.5.9 p53, p79 |

- Capçal sempre `"-1"` (automàtic, p36): Maestro el tria segons on és muntada l'eina.
- Broques horitzontals amb eina `"-1"`: el parell esquerra/dreta (019/020, 021/022) depèn del sentit i
  l'.atrx no diu quin mandrí mira cap a on.
- Sense estratègies, aproximacions, campanes ni ventoses: Maestro hi posa els valors per defecte de
  l'eina (§3.5 p35). Noms únics per programa (§2 p5).
- Els arcs (bulge) es passen amb radi, sentit (bulge < 0 = horari) i «més de 180°» (|bulge| > 1). Si la
  polilínia té algun costat recte, el de tancar és `ClosePolyline`; si són tot arcs, l'últim arc acaba al
  punt d'inici.

### Tria d'eines (`core/machine/tools.ts`)
Només eines automàtiques i muntades.
- **Forats de cara**: broca vertical del Ø exacte (± 0,1) que arribi a la fondària (SinkingLength); si
  n'hi ha dues (ESQ/DRE), la de codi més baix. Més fondo que gruix − 0,5 → gruix − 1 i avís (com al STEP).
- **Forats de cantell**: n'hi ha d'haver una d'horitzontal del Ø que hi arribi (es comprova), però el
  programa diu `"-1"`.
- **Ranures**: amb **disc** si va de cantell a cantell, el disc és prou prim i hi arriba (passades del gruix
  del disc, centres repartits a l'ample); si no, amb **fresa** de Ø ≤ ample (la més grossa), recorregut en
  zig-zag si cal més d'una passada; els extrems oberts amb el centre al cantell, els tancats a r de la vora.
  Opció de la màquina: «Disc si es pot» · «Sempre fresa» · «Preferir disc».
- **Talls passants** (gruix + `throughExtra`, 1 mm per defecte): un cercle amb broca del Ø si n'hi ha
  (tiradors Ø5 → 003); si no, contorn per dins amb fresa. **Contorn** de les peces amb forma, per fora, al
  final. La fresa: la més grossa amb Ø < l'amplada més petita − 0,5 (per dins) i radi ≤ el dels arcs que
  recorre per la banda còncava (extrems de ranura, osques, **dogbones** de les mortalles, també si ja són
  segments: `maxToolDiameter`).
- Sense eina → el mecanitzat no surt i hi ha un avís (UI d'Exportar i LLEGEIX-ME). Inglets: avís (serra).

### Tests
- `core/machine/maestro.test.ts`: contra el context real (`docs/maestro/AA10008021.machinecontext`, només
  lectura, `testContext.ts`): 42 eines, versió, capçals, mandrins horitzontals, capçalera, .cfgx, zip.
- `core/export/maestroXcs.test.ts`: golden d'una peça (forats, cantell, ranura amb disc, Volt), ranura amb
  fresa, talls, contorn amb arcs, sense eina; propietats sobre 51 mobles del catàleg: cada mecanitzat té op o
  avís, tots els punts dins del pla, eina muntada que arriba a la fondària, noms únics, text ASCII.

## Preguntes obertes per al taller
1. **Origen i cares laterals**: és la cantonada de baix a l'esquerra de la cara A? A `Back` i `Left`, la X
   va com hem suposat (vista des de fora)? → passar `PROVA_ORIENTACIO.xcs` (forats a 100 mm de l'«esquerra»
   de cada cara).
2. **Cara B**: es gira sobre l'eix llarg (X) com hem suposat, o sobre l'Y? O millor un sol programa amb
   `CreateWorkplan("Volt")` (§3.8 p112) i `CreateMessage` (§3.7.5 p111)?
3. **Peces ja tallades o nesting?** La màquina és de barres (8 barres, ventoses): les peces arriben
   escairades (llavors no cal el contorn de les rectangulars) o també fa nesting amb les freses «nesting»?
4. **Ranures**: disc E604 (3,2) en passades o fresa? Les ranures del fons (10 mm) no tenen fresa: falta la
   de 10 (o 8) a la biblioteca exportada.
5. **Eines que falten al .tlgx** (la llista del germà): 2, 3, 4, 6, 8, 10, 16, 20, 22, 30 mm, cocodrils…
   Cal exportar-les de Maestro o afegir-les a mà amb el codi.
6. **Broques horitzontals**: Maestro tria bé el mandrí amb `tool = "-1"`? O cal dir 019/020 segons la cara?
7. **Capçalera**: `SetMachiningParameters("AD", 1, 10, 0, false)` (de XilogHeaderParameters) és la bona per a
   aquestes peces? Cal `SetWorkpieceSetupPosition` (§3.9.2 p115) o la posa Maestro?
8. **Fixació**: ventoses automàtiques (XConverter `-m 12`, p15) o manuals (`SetSuctionCupPosition`,
   §3.10.2 p126)?
9. **Tecnologies** (`ApplyTechnology`, §3.5.14 p91): en tenen de fetes (p. ex. «Ranura fons») que s'hagin
   de fer servir en lloc de CreateSlot/CreateRoughFinish?
10. **Passants**: 1 mm per sota és prou (o massa) amb les ventoses?
