# Mecanitzats CNC i Preferències: preguntes per al germà (millores v1, §1)

Estudi de les set preguntes de `docs/prompt/PROMPT-millore-v1.md` §1 (línies 5-13). Per a cadascuna: d'on surt el valor,
què fa el codi ara, què diu el programa real del taller, la resposta probable i quina preferència l'ha de guardar (amb un
valor inicial que el germà pugui canviar). Al final, **(a)** el missatge per enviar-li i **(b)** els canvis de codi que
podem fer ja, diguin el que diguin les respostes.

Llegenda: **[codi]** = el que fa l'app avui · **[real]** = el que diu `docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs`
(TopSolid → Maestro, s'hi va mecanitzar) o el context de la màquina · **[hipòtesi]** = el que és habitual a SCM Maestro /
Xilog i als talleres de nesting, **per confirmar**. No s'ha tocat cap fitxer de codi.

| # | Tema | Ara (app) | Real (taller) | Proposta inicial |
|---|---|---|---|---|
| 1 | `MechanicalOptions` i `−20` | 16777216 i (0, −20) copiats del real, editables | 16777216 · `SetWorkpieceSetupPosition(0, -20, 0, 0)` | Deixar-ho; mostrar els bits; que ens digui què marca al diàleg |
| 2 | Marge del tauler | 10 mm fix | 12 mm (= Ø12 de la fresa) | «Marge = Ø de la fresa + 0» |
| 3 | Pell als forats gairebé passants | gruix − 1 si passa de gruix − 0,5 | Ø4 × 18,9 en 19 (0,1 mm) | Pell mínima editable (0,1 o 1?) |
| 4 | Sentit dels talls interiors | antihorari (com els de fora) | horari (els de fora, antihoraris) | Mateix tipus de fresat dins i fora |
| 5 | Codificació | UTF-8 **amb** BOM | ASCII sense BOM | Sense BOM (byte a byte com el real) |
| 6 | Ranura del perfil LED | no n'hi ha: perfil de superfície 16 × 8, fora del CNC | — | Ranura 17 × 8 a 30 mm del davant, cara A |
| 7 | Frontisses de porta d'alumini | sense cassoleta; laterals amb filera System 32 | — | Placa estàndard a 37 mm; frontissa de marc al llistat |

---

## 1. `MechanicalOptions` 16777216 i el −20 de la posició de la peça

**D'on surt.** [real] Línies 1-9 del programa del taller:
`SetMachiningParameters ("AD", 1, 10,16777216, false);;` (l. 2) i, després de la peça, `SetWorkpieceSetupPosition (0, -20, 0, 0);`
(l. 8) i `CreateMacro("Pload","PLOAD",1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);` (l. 9). El 16777216 és el 4t paràmetre de
`SetMachiningParameters` = **MechanicalOptions** (manual MSL Table 79 p114; `docs/maestro-xcs.md:41-46`, `:305-315`).

**[codi]** `DEFAULT_NEST_PROGRAM` (`src/core/model/machine.ts:263`) copia tota la capçalera del real; l'escriu
`maestroNestXcs.ts:~615-625` (l. 623 = `SetWorkpieceSetupPosition`). Editable a Preferències › Màquines CNC › «Programes per
tauler» › «Capçalera…» (`src/features/settings/MachinesPane.tsx:351-375`: «Opcions mecàniques» com a número, posició X/Y). Els
programes per peça (fora de la UI) fan servir `DEFAULT_HEADER` amb 16973824 (`machine.ts:246`).

**Què sabem dels números.**
- 16777216 = `0x01000000` = **un sol bit, el 24** (2²⁴). El `Proyecto1.pgmx` (un projecte desat al Maestro del taller) diu
  16973824 = `0x01030000` = bit 24 + bits 16 i 17. El context exportat (`Settings/XilogHeaderParameters.xml`) diu 0.
  Per tant el bit 24 surt en tot el que ha passat per la màquina; els bits 16-17 només al .pgmx d'una peça.
- [hipòtesi] `MechanicalOptions` és una màscara de caselles del diàleg «Paràmetres de mecanitzat / Opzioni meccaniche» del
  Maestro (cada casella, un bit). Als Xilog solen ser opcions de la taula/topalls (quins topalls de referència, exclusió de
  pressors, càrrega…). **No ho endevinarem**: la manera segura és que obri el diàleg amb el programa real carregat i ens enviï
  una foto de les caselles marcades (i una altra marcant/desmarcant una casella per veure com canvia el número).
- `SetWorkpieceSetupPosition(x, y, z, rot)` (§3.9.2 p115) col·loca la cantonada (0,0,0) del tauler a (x, y) de l'origen de la
  taula. [hipòtesi] El −20 en Y vol dir que el tauler queda **20 mm per davant de la línia dels topalls de referència**: o bé
  perquè la macro `PLOAD` (càrrega/empenta del tauler) el deixa així, o bé per no fresar els topalls quan la fresa repassa
  la vora (el marge de 12 mm es fresa sencer, vegeu §2). Pista: el camp de la màquina és 5020 × 1905 («8 BARRE MATIC»,
  `.cfgx`) i el tauler fa 2070 en Y, així que sobresurt igualment. El context té `SideStopPositionY`, `WorkpieceOffsetY` i
  `IsRelatedToOppositeSideStop` a 0 (`XilogHeaderParameters.xml`): el −20 no ve d'aquí, ve del programa.

**Preferència.** Ja existeix (`Machine.nesting.program`). Proposta: deixar 16777216 i (0, −20) com a valors inicials i
**mostrar al costat el número en hex i els bits** («bit 24») perquè el germà ho pugui contrastar amb el diàleg; preguntar si
és igual per a tots els gruixos i materials (si no, caldria per gruix). Els paràmetres de `PLOAD` (avui fixos, només
`loadMacro: true/false`, `machine.ts:219`) també haurien de ser editables com a text.

## 2. Marge del tauler: 12 mm (= Ø de la fresa) o 10 mm?

**[real]** Els contorns van amb el **centre de l'eina a x = 6, y = 6** (l. 153-156: `AddArc2PointRadiusToToolpath (6, 491…)`,
`(12, 6…)`, `AddSegmentToToolpath (2352, 6…)`) i la peça comença a 12: la fresa Ø12 **es menja exactament la tira de 0 a 12
mm** de la vora del tauler. A dalt, fins a 2064 = 2070 − 6 (l. 174-176). Separació entre peces Ø + 2 = 14 (ja la fem igual).

**[codi]** `edgeTrim` fix de 10 mm: `DEFAULT_MACHINE_NESTING` (`machine.ts:251`), esquema `machine.ts:201`, s'aplica a
`cncNestOptions` (`src/core/export/maestroNestXcs.ts:116-130`, `margin: n.edgeTrim`), surt a la capçalera (l. 602) i al
LLEGEIX-ME (l. 696); UI `MachinesPane.tsx:332` («Vora del tauler que no s'aprofita»). Amb Ø12 i marge 10, la fresa passa
**2 mm per l'aire** fora del tauler; amb Ø14 (taulers de 23-41 mm) en passaria 4.

**[hipòtesi]** El taller fa **marge = Ø** a propòsit: la vora de fàbrica del tauler sol venir picada, bruta o no del tot a
escaire; amb marge = Ø la mateixa passada del contorn **neteja i escuadra la vora** sense fresar aire i sense deixar una tira
prima (que vibraria o sortiria volant). Per a taulers de 30 mm (Ø14) seria 14.

**Preferència.** `Machine.nesting.edgeTrim` passa a tenir un **mode**: «Igual al Ø de la fresa + _n_ mm» (proposta: + 0) o
«Fix _n_ mm» (el d'ara, 10). Valor inicial proposat: **Ø + 0** (= 12 amb la fresa del real). Fins que ho confirmi, es pot
deixar el 10 com a inicial i oferir el mode.

## 3. Pell als forats gairebé passants (Ø4 × 18,9 en 19)

**[real]** Quatre `CreateDrill` de Ø4 a fondària **18,9** en el tauler de 19 (l. 32-35, `//BROCA PLANA FO-FPL-4`), a
(22, 93), (22, 411), (2342, 93), (2342, 411). Són de la peça OP7 (12…2352 × 12…491): **a 10 mm de cada extrem** i a ~80 mm
dels cantells llargs. 10 mm ≈ mig gruix d'un lateral de 19-20 → [hipòtesi] **forats de pilot / marcatge per a cargols** que
uneixen aquesta peça (tapa o base de 2340 × 479) amb el cantell dels laterals.

**[codi]** Tot forat de cara amb fondària ≥ gruix − 0,5 s'escurça a **gruix − 1** i avisa: per tauler
`maestroNestXcs.ts:376-378` (forats) i `:402-404` (ranures); per peça `src/core/export/maestroXcs.ts:573-575` i `:642-644`.
El valor ve del STEP (`src/core/export/step.ts:519-530`, `FACE_HOLE_FLOOR = 1`): el **parser del taller** descarta els
cilindres ≥ gruix − 0,5 (els pren per radis), però això **només afecta el STEP**, no el Maestro. El 18,9 del real el
convertiríem en 18. Els talls passants amb broca (tiradors Ø5) ja van a gruix + martiri (0,3).

**[hipòtesi]** Deixar 0,1 mm de pell té tres motius habituals: (1) **no foradar el martiri** amb la broca (molts forats
passants el destrossen més que la fresa); (2) **no fer estella a la cara de sota** (la broca, en sortir, arrenca melamina;
el cargol ja trencarà la pell); (3) el punt queda **marcat** a l'altra cara per qui munta. Amb taulers reals de 18,8-19,2,
de vegades passa: no importa, és un pilot. Per a forats que s'han de veure des de fora (cargol vist), en canvi, 1 mm de pell
seria massa.

**Preferència.** «**Pell mínima dels forats i ranures cecs (CNC)**», a Regles de mecanitzat (és del taller): valor inicial
**1 mm** (l'actual), i el germà decideix si el baixa a 0,1 (o 0,2). Opcional: «a partir de quina fondària s'escurça»
(avui gruix − 0,5). El STEP continua amb el seu 1 mm (és per al parser del taller, no per a la màquina).

## 4. Els talls interiors en sentit horari: expressament?

**[real]** Contorns de peça **antihoraris** (OP7, l. 149-162: (1182, 497) → (12, 497) → (6, 12)… la peça queda a l'esquerra del
recorregut, l'eina a la dreta). Tall interior OP6 (forat allargat 68 × 208, l. 131-142) **horari**: l'eina, també a la dreta
del sentit de la marxa. Les freses són de tall a dretes: `HandOfCut Right` a la D12 i la D14 del `def.tlgx` (gir horari vist
des de dalt).

**Què vol dir.** Amb el capçal girant a dretes, eina a la **dreta** del recorregut (G42) = fresat **en oposició**
(convencional, «contra-avanç»); a l'**esquerra** (G41) = **en concordança** (climb). El real fa **el mateix tipus de fresat
dins i fora** (oposició a tots dos): per mantenir-lo, el sentit s'ha de girar als forats. **Sí, és expressament** (és el que
fa qualsevol CAM: el sentit es tria pel tipus de fresat, no per la forma).

**[codi]** Contorns de fora antihoraris (igual que el real) **i talls interiors també antihoraris**: `rectPts`/`slotPts`
(`maestroXcs.ts:233-250`), polilínies a `maestroNestXcs.ts:487-502` amb `contourLine(…, 0, …)` (costat 0 = dins,
`maestroXcs.ts:457-458`) i cercles `CreateCircleCenterRadius(…, false)` (`maestroNestXcs.ts:480`). Si el Maestro segueix el
sentit de la geometria (al `.pgmx`: `IsGeomSameDirection = true`), **els nostres interiors es fresen en concordança i els de
fora en oposició**: barrejat. El `.pgmx` del taller té `Cutmode = Climb` a l'estratègia de la caixera: el Maestro sap de
modes, però amb `CreateContour` no li en passem cap.

**[hipòtesi]** En nesting amb freses de diamant (compressió), l'oposició empeny menys la peça cap a fora i és la que
TopSolid tenia configurada; la concordança dona millor acabat però estira la peça (peces petites que es mouen). La pregunta
real és **quin mode volen**, no el sentit: el sentit en surt sol.

**Preferència.** Regles de mecanitzat › «**Fresat dels contorns i talls**»: «En oposició (com TopSolid)» · «En concordança».
Inicial proposat: **oposició** (= real): contorns de fora antihoraris i interiors horaris. Es veu a la Vista CAM (cal una
fletxa de sentit per tall, `features/export/camDrawing.ts`).

## 5. UTF-8 amb BOM?

**[real]** `file` diu: «ASCII text, with CRLF line terminators» (sense BOM). **[codi]** Tots els .xcs i el LLEGEIX-ME en UTF-8
**amb** BOM: `xcsBytes` (`maestroXcs.ts:880-886`), `xcsZip` (l. 890-891), text del LLEGEIX-ME a `maestroNestXcs.ts:704`.
A la nostra mostra `nesting_T01.xcs` **l'únic byte no ASCII és el BOM**, a la línia 1, que és un comentari `//`: si el
Maestro no l'entengués, el BOM cauria dins del comentari i probablement no passaria res; però si mai la primera línia fos
codi, un lector ANSI hi veuria `ï»¿` i fallaria la compilació.

**[hipòtesi]** El Maestro és .NET (l'MSL és C#): el `StreamReader` detecta el BOM i, sense BOM, llegeix UTF-8 per defecte;
tots dos haurien d'anar bé. Però **només l'ASCII sense BOM està provat a la màquina**. Els noms d'eina del taller
(`eines.txt`: «3mm helicoidal», «11mm cocodrilo»…) són ASCII, així que **sense BOM el fitxer seria idèntic byte a byte al
format provat**.

**Preferència.** Màquines CNC › «Programes .xcs» › «Codificació»: «ASCII / UTF-8 sense BOM (com TopSolid)» · «UTF-8 amb BOM».
Inicial proposat: **sense BOM**; si algun nom d'eina porta un caràcter no ASCII, avís a Exportar. El LLEGEIX-ME (amb accents)
pot continuar amb BOM. Prova pel germà: obrir el `nesting_T01.xcs` actual al Maestro (amb BOM) i dir si dona error.

## 6. Ranura per al perfil LED d'alumini al prestatge

**[codi]** `Zone.led` (`src/core/model/composition.ts:176-177`) fa `buildLed` (`src/core/build/buildModule.ts:983-1011`): un
**perfil de superfície 16 × 8** sota el sostre i sota cada prestatge, llarg = llum − 20, a **20 mm del davant** (`zFront = D −
shelfSetback − 20`), a `extras` (fora del nesting). **No hi ha cap ranura al tauler.** Test `src/core/build/led.test.ts:8-24`.
Important: el prestatge es col·loca amb la **cara A amunt** (`buildModule.ts:~1068`, normal +Y) i la ranura aniria a sota =
**cara B**, que al nesting no es fa («segona passada», `docs/maestro-xcs.md:261-262`).

**[hipòtesi] Mides habituals** dels perfils encastables per a tira de 8-10 mm:
- Encastat sense ala: ranura **17-18 × 7-9 mm** (perfils de 17 × 7, 17 × 8, 18 × 8 amb difusor). En 19 mm, **8 mm** de fons
  deixa 11 de tauler.
- Amb ala (solapa que tapa la vora): ranura més estreta, **12-13 × 7-8**, i l'ala de 18-23 mm queda vista.
- Distància al davant: **20-50 mm** fins a l'eix (30-40 és el més comú). Prou endavant per il·luminar el que hi ha a
  sota/darrere sense veure el punt de llum des de davant; amb portes de vidre, més a prop del davant.
- Extrems: **passant** de lateral a lateral si el prestatge és fix i amagat; **aturada a 10-20 mm** de cada extrem si el
  cantell es veu (prestatge regulable o moble obert). Falta la **sortida del cable**: un forat Ø8-10 passant a un extrem o
  una ranura de 8 × 8 fins al darrere (cap al fons/lateral).

**Com es mecanitza.** Ranura oberta (de cantell a cantell) → la regla «Ranures» que ja tenim («8mm diamant», 6 mm per
passada, `defaultMachineRules`, `machine.ts:98-112`): 17 mm d'ample amb fresa de 8 = 2-3 passades a l'ample. Aturada pels
dos extrems → «Caixeres» («12mm diamant nesting», `CreateContourPocket`). Amb la «16mm diamant xop» (és a `eines.txt`)
sortiria d'una passada si la ranura fos de 16. A la cara A (girant el prestatge) es fa al mateix programa del tauler.

**Preferència proposada** (Preferències › Ferratges › «**Perfil LED**», `HardwareSchema`, `composition.ts:19-41`):
`mode` encastat/superfície (inicial: encastat) · `width` 17 · `depth` 8 · `frontOffset` 30 (a l'eix de la ranura, des del
davant del prestatge) · `endMargin` 0 = passant (o 15 = aturada) · `cable` forat Ø10 / ranura al darrere / res. El que diu
el germà ho canvia; les regles de mecanitzat (Ranures / Caixeres) ja decideixen l'eina.

## 7. Frontisses per a les portes de vidre amb marc d'alumini

**[codi]** `front.glass` (`composition.ts:153-154`) fa `glassDoor` (`buildModule.ts:1208-1250`): marc d'alumini negre de 20 mm,
vidre de 5, tot a `extras`. **No fa cassoletes** (és perfil) i els **laterals conserven la filera System 32** (on va la
placa; `buildParentFront`, l. 894-915; `Hardware.system32`, `src/core/model/cabinet.ts:43-48`). Les frontisses del perfil no
surten enlloc (ni al llistat ni a la llista de compra).

**[hipòtesi] Què es fa normalment.**
- **Al marc** (no és cosa del nostre CNC): els fabricants de frontisses tenen sèries per a **marc d'alumini estret** (Blum
  CLIP top per a marc d'alumini, Hettich Sensys per a perfils d'alumini, Salice per a alumini/vidre): el braç s'**enganxa o
  es cargola al canal del perfil** amb una placa-adaptador, sense cassoleta Ø35. Els perfils amples (≥ 45 mm) accepten
  cassoleta normal punxonada pel proveïdor del perfil. Sovint és el proveïdor del marc qui el dona **ja mecanitzat** per a la
  frontissa que tria el taller.
- **Al cos** (sí que és nostre): la **placa de muntatge estàndard** de la mateixa marca, a **37 mm del davant** i dos forats
  **Ø5 a 32 mm** (System 32), o Ø5 × 10-12 per a cargol euro / Ø8-10 per a placa amb tac a pressió. És el que ja fa la filera
  System 32. L'**alçada de la placa** (0 / 3 / 9 mm) canvia el solapament: el marc de 20 mm sol voler el mateix que una
  porta de tauler de 19-20.
- Alternativa sense frontissa de cassoleta: **pius/pivots** a dalt i a baix (forat Ø8-10 × 12 al sostre i a la base, a
  ~20 mm del davant i del lateral). Aquí sí que hi hauria forats nostres al sostre/base.

**Preferència proposada** (Ferratges › «**Frontissa de porta de vidre**»): `kind` «placa System 32» (inicial) / «pivots» ·
`setback` 37 · `plateHoles` Ø5 × 12 a 32 · distància de la primera/última frontissa a la vora de la porta (inicial 100) ·
model/referència (text lliure, per a la llista de compra). Quantitat amb el mateix `hingeCount` de les portes de tauler.

---

## (a) Missatge per al germà (WhatsApp)

> Hola! Unes preguntes de la CNC per deixar bé les preferències de l'app. A cada una et poso **el que fa ara** i **el que
> proposo**: només cal que diguis OK o el número bo.
>
> **1. Capçalera del programa.** Copio la del teu programa de TopSolid: opcions mecàniques **16777216** i posició del tauler
> **(0, −20)**. Em pots enviar una foto del diàleg de *Paràmetres / Opcions mecàniques* del Maestro amb aquest programa
> obert, per saber quina casella és? I el −20, què és: els topalls? la càrrega (PLOAD)? És igual per a tots els gruixos?
>
> **2. Marge del tauler.** Ara: **10 mm**. Al teu programa les peces van a **12 mm de la vora** (= la fresa de 12, que es menja
> tota la vora). Proposo: **marge = Ø de la fresa** (12; 14 amb la de 14). OK?
>
> **3. Forats gairebé passants.** Al teu programa: Ø4 × **18,9** en tauler de 19 (0,1 de pell). Són pilots per a cargols?
> Ara, si un forat passa de gruix − 0,5, el deixo a **gruix − 1** (1 mm de pell). Proposo: **pell mínima 0,1 mm** com tu. OK,
> o prefereixes una altra xifra?
>
> **4. Sentit dels talls.** TopSolid fa els contorns de fora antihoraris i els forats de dins **horaris** (així tot és fresat
> *en oposició*). Ara jo faig els de dins antihoraris (quedarien *en concordança*). Proposo: **tot en oposició, com TopSolid**.
> OK, o vols concordança?
>
> **5. Fitxer .xcs.** Ara surt en UTF-8 **amb BOM**; el teu és ASCII pur. Proposo: **sense BOM**, igual que el teu. Si
> pots, obre el `nesting_T01.xcs` que et vaig passar i digues si el Maestro dona algun error a la primera línia.
>
> **6. Perfil LED encastat al prestatge.** Ara el poso per sota, sense ranura. Proposo: ranura de **17 × 8 mm**, eix a **30
> mm del davant**, passant de lateral a lateral, feta a la teva màquina girant el prestatge (cara de sota amunt), amb un
> forat **Ø10** a un extrem per al cable. Quin perfil fas servir (mides)? Ranura passant o aturada? Fresa de 8 en passades
> o la de 16?
>
> **7. Portes de vidre amb marc d'alumini.** Ara: al cos només la filera de forats de 32 (placa a **37 mm** del davant), i al
> marc res. Quina frontissa fas servir (marca/model)? El marc ja ve mecanitzat del proveïdor? La placa del cos és la normal
> (Ø5 a 32) o una altra? O prefereixes pius a dalt i a baix?
>
> Gràcies!!

## (b) Canvis de codi que podem fer ja (sigui quina sigui la resposta)

Tots additius a les preferències (`SETTINGS_VERSION` és 18 a `src/core/model/settings.ts:20`; pujar a 19 si cal migrar), amb
**el valor d'avui com a inicial** (cap diff del golden fins que el germà no confirmi i es canviï l'inicial a propòsit amb
`UPDATE_GOLDEN=1`). Mida: S < 1 h · M mig dia · L un dia o més.

| # | Canvi | Fitxers | Mida |
|---|---|---|---|
| 1 | «Opcions mecàniques»: mostrar hex i bits al costat del número (`0x01000000 · bit 24`); paràmetres de `PLOAD` editables (text dels 11 valors, inicial el del real) en lloc de només `loadMacro` | `machine.ts:211-223` (esquema `program`), `maestroNestXcs.ts:~620-625`, `MachinesPane.tsx:351-375` | S |
| 2 | Marge del tauler amb mode «Ø de la fresa + n» / «fix»: `edgeTrimMode: "fixed" \| "tool"` (inicial `fixed`, 10). Atenció: `fits` (l. 120-125) fa servir el marge abans de saber la fresa → amb mode `tool`, calcular abans `boardRouter` per gruix | `machine.ts:201, 251`, `maestroNestXcs.ts:116-130, 602, 696`, `src/core/nesting/machineNest.ts`, `MachinesPane.tsx:319, 332`, `CamPreview.tsx:123, 152` (ja llegeix el marge), test a `maestroNestXcs.test.ts` | M |
| 3 | Pell mínima dels forats/ranures cecs al CNC: `MachineRules.minSkin` (inicial 1) i llindar (inicial 0,5); una funció `cncBlindDepth(T, depth, rules)` que substitueixi els quatre blocs repetits. El STEP es queda amb `FACE_HOLE_FLOOR` | `machine.ts:72-112`, `maestroNestXcs.ts:376-378, 402-404`, `maestroXcs.ts:573-575, 642-644`, `MachineRules.tsx`, `machineRules.test.ts` | S |
| 4 | Tipus de fresat: `MachineRules.cutMode: "asIs" \| "conventional" \| "climb"` (inicial `asIs` = avui). `reversePolyline` (ordre i signe dels bulges; vigilar `rampStart` i `dedupePolyline`) per als talls interiors i, amb `climb`, també els contorns; `CreateCircleCenterRadius(…, isClockwise)`. Fletxa de sentit a la Vista CAM | `maestroNestXcs.ts:470-535`, `maestroXcs.ts:233-250, 457-500` (per peça), `xcsPreview.ts` (ja llegeix el sentit), `features/export/camDrawing.ts`, tests de sentit a `maestroNestXcs.test.ts` | M |
| 5 | Codificació dels .xcs: `Machine.xcsEncoding: "utf8-bom" \| "ascii"` (inicial `utf8-bom`); `xcsBytes(text, bom)` i el LLEGEIX-ME sempre amb BOM; avís si `ascii` i algun nom d'eina no és ASCII. Treure el «UTF-8 amb BOM» fix dels textos | `maestroXcs.ts:880-891, 943`, `maestroNestXcs.ts:704`, `machine.ts` (esquema), `MachinesPane.tsx` («Programes .xcs»), `maestroXcs.test.ts` (test del BOM) | S |
| 6 | Perfil LED encastat: `Hardware.led { mode, width 17, depth 8, frontOffset 30, endMargin 0, cable }` amb `mode: "surface"` com a inicial (= avui). En mode encastat: ranura al prestatge i al sostre (a la cara que quedi a sota) i el perfil dins la ranura a `extras`; **prestatges amb LED amb la cara A cap avall** perquè es faci al nesting (revisar cantells i veta, `edges("bottom")`); forat/ranura de cable; `resolveHoleClashes` amb les espigues dels prestatges fixos; entrar a `visibleModule` (opció que amaga camps) i a `hiddenState.test.ts` | `composition.ts:19-56, 176-177`, `buildModule.ts:882, 983-1011, 1015-1075`, `SettingsScreen.tsx:705+` (`HardwareForm`), `led.test.ts`, `src/core/build/holeClash.ts`, golden | L |
| 7 | Frontissa de porta de vidre: `Hardware.glassHinge { kind: "plate" \| "pivot", setback 37, endOffset 100, model }`; amb `plate`, comprovar que la filera System 32 cobreix les alçades de les frontisses (`hingeCount`) i avisar si no; afegir les frontisses de marc a `extras`/llista de compra; amb `pivot`, forats al sostre i a la base | `composition.ts:19-56, 153-154`, `buildModule.ts:1140, 1185-1250`, `SettingsScreen.tsx:705+`, `led.test.ts:27-41` | M |
| 8 | Documentar: aquest fitxer enllaçat des de `docs/maestro-xcs.md` §«Preguntes obertes» (punts 2, 5, 18, 20, 21 → «en curs, preferència X») i `CLAUDE.md:369-372` | docs | S |

Ordre suggerit: 5 → 3 → 1 → 2 → 4 (els que canvien bytes o geometria del .xcs, amb tests de propietats) i després 7 i 6
(construcció del moble, golden). Quan el germà respongui, només cal canviar els inicials (i `UPDATE_GOLDEN=1` + revisar el diff).
