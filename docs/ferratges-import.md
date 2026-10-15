# Importar ferratges del fabricant (Hettich i Blum)

> **Estat: adormit (2026-10-08).** Per decisió de l'usuari («lo de Importar del fabricant ho treurem perquè és millor
> que ho anem fent nostres»; «el Generador de mecanitzats no cal… ara ho fiquem nosaltres a partir del catàleg») ja no
> hi ha ni la zona «Importar del fabricant» ni el diàleg ni el «Generador de mecanitzats» (amb «Llegir un DXF…») ni
> «Afegir ferratge» a l'inspector. El camí d'ara són els **jocs llegits dels PDF del catàleg**
> ([`ferratges-jocs.md`](ferratges-jocs.md)). Treure ≠ esborrar: el codi del nucli (`core/import/*`, amb els tests), el
> model (`HardwareItem.imported`, `machining`, `GenOp`, `hardwarePlace.ts`) i els col·locats es queden; els ferratges ja
> importats de la biblioteca i els col·locats dels mobles es llegeixen, es fabriquen igual i es poden confirmar,
> editar o treure. El que segueix descriu com funcionava (i com tornaria a funcionar si es recuperés la UI).

> Objectiu (del germà): «lo important es que després es pugui encaixar al moble per fer el mecanitzat». Un ferratge
> baixat del web del fabricant ha d'acabar fent **els forats bons a les peces bones** del moble. El 3D i els dibuixos
> són per revisar-lo; el que mana és el patró de forats confirmat.

Preferències › Ferratges › **«Importar del fabricant»**. Primer fabricant: **Hettich** (frontisses, plaques, tiradors,
potes i, com a «només 3D», la resta) (hettich.com › Serveis › Hettich
CAD › [Descàrregues CAD](https://www.hettich.com/es-es/services/hettich-cad/descargas-cad)). Els fitxers del fabricant
**no es copien mai al repo** (llicència d'ús per planificar); l'app els llegeix al navegador i en desa el que cal a
Dexie, com els models 3D de l'usuari. Segon fabricant: **Blum** (E-SERVICES; §10), amb els mecanitzats **exactes** dels
programes Xilog (`*.pgm`). **Un sol camí** per als dos (`core/import/makers.ts`): el fabricant es reconeix pel nom dels
fitxers (`detectMaker`), cadascun agrupa per article a la seva manera i la resta (proposta, 3D, mecanitzats, ampliar el
que ja hi és amb la clau fabricant + article) és comuna. **Cada importat té un lloc** («Què és»: frontissa, placa,
tirador, pota… o «només 3D») que posen les regles del mòdul, i el 3D entra pel seu **marc de muntatge** (§11; la
col·locació a mà queda per als «només 3D», mínima).

## 1. Què es baixa de Hettich

Un ZIP per família i format. Dins, carpetes per tipus **en alemany** i un fitxer (o tres vistes) per **número d'article**
(5–7 xifres, el de la referència del catàleg).

| ZIP | Què hi ha | Què en fem |
|---|---|---|
| `STEP_Scharniere.zip` (34 MB, 881 `.stp`) | Un STEP per article (AP203 `CONFIG_CONTROL_DESIGN` o AP214), mm, la majoria d'un sol sòlid; ~150 són conjunts amb transformacions | **Forats** (cilindres) i **3D** (OpenCascade → GLB) |
| `DWG_DXF_Scharniere.zip` (122 MB, ~4400 fitxers), `DWG_DXF_Griffe.zip`, `DWG_DXF_Schiebetuersysteme.zip`… | Per article: `<art>_2D_front_view.dxf`, `_2D_side_view`, `_2D_top_view` (línies, arcs, cercles, polilínies 3D i 3 `POINT` a la capa `CONNECTIONPOINTS`, majúscules o minúscules) i `<art>_3D.dxf`/`.dwg` (un `3DSOLID` ACIS) | Les tres vistes 2D es dibuixen a l'editor; la que mira la cara de la peça es posa sota els forats. El 3D ACIS i els DWG s'ignoren. **Sense el STEP, l'article entra «només 2D»** (§6) |
| `3DS_Scharniere.zip`, `3DS_Griffe.zip`… | `<art>_3d.3ds` (mm, a les coordenades del STEP) | El **3D** si no hi ha STEP ni IGES (`TDSLoader` de three): «només 3D», sense forats |
| `IGES_Griffe.zip`, `IGES_Scharniere.zip`, `IGES_Tischgestelle_….zip` (`Planning/CAD-Files/` o `Planning/CAD/`) | `<art>.igs` | El **3D** si no hi ha STEP (OpenCascade, `ReadIgesFile`, el mateix worker): «només 3D», sense forats (la proposta de forats només surt del STEP) |
| `SAT_*.zip`, `MAX_*.zip` | ACIS i 3ds Max | No es llegeixen (l'article ho diu a les notes) |
| PDF (`Overview_Uebersicht.pdf`, `Planungshandbuch…`, `2D_Konfiguration_*`, `Anschlagloesungen_*`, el contingut de `Planungshilfen_*.zip`) | Manuals i plànols | S'adjunten als articles que nomenen (número) o, si nomenen una **sèrie** («Sensys»), als articles d'aquella sèrie del lot (com a molt 12, `MAX_SERIES_DOCS`); la resta, el diàleg els diu **«sense article»** i no s'importen |
| `dxf_einbau.zip` | Seccions de muntatge acotades (DXF + PDF) per família; les de `Zubehoer/<art>_KB_2d/` nomenen articles al nom (`…_79349_79350_9072231.dxf`) | **Plànols de muntatge**: s'adjunten als articles que nomenen (§6) |
| `Anschlagloesungen_2D_Sensys.zip` | Exemples d'aplicació (seccions) | Igual, si nomenen algun article (la majoria no: no s'adjunten) |
| `STEP_Schubkastensysteme.zip` (271 MB) | Calaixos i guies (conjunts sencers: guies, laterals, fronts, accessoris) | «Calaix o guia», **només 3D** (§9) |
| `STEP_Griffe.zip` (10 MB, 765 `.stp`) | Tiradors i poms per família (`Classic`, `Deluxe`, `Folk`, `Modern`, `Natural`, `New_Modern`, `Organic`, `Touch_In`, `Exclusive_Designgriffe`) i `Zubehoer` | **Tiradors**: la distància entre forats del STEP (§2) |
| `STEP_Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen.zip` (5 MB) | Potes (`Aluminium_Moebelfuesse`, `Stahl_Moebelfuesse`, `Tischbeine_Moebelfuesse`), estructures de taula (`Change`, `LegaDrive`, `LegaMove`, `Steelforce/…`), guies de taula (`Trimanis`), electrònica i accessoris | **Potes**: forats de la placa (§2); la resta, només 3D |
| `STEP_Cadro_Aluminiumrahmensystem.zip` (0,7 MB, 70) | Marc d'alumini per a portes de vidre | Només 3D (§9) |
| `STEP_Schiebetuersysteme.zip` (94 MB, ~940) · `STEP_Falttuersysteme.zip` (22 MB, ~170) | Portes corredisses (perfils, carros, guies) i plegables (WingLine) | Només 3D (§9) |

**Tot es pot importar**: el que no té cap regla de mecanitzat a l'app, o del qual no es troba el patró de forats, entra com
a **«només 3D»** (motor `model`): el model (GLB) i el volum, **mai cap forat**. Sense STEP però amb les vistes DXF, entra
**«només 2D»** (motor `model` sense caixa ni 3D: les vistes i els punts de connexió) fins que s'hi afegeix el STEP (§6).
Sense STEP però amb IGES o 3DS, entra «només 3D» amb aquest 3D (la caixa surt de la malla). Només el 3D DWG/DXF, el SAT
o el MAX sols no es poden importar.

**Carpetes i nom** (`core/model/makers/hettichNames.ts`, sense dependències del model: també el fa servir la lectura de les
preferències). De cada camí només compten les carpetes de l'article (`cleanFolders`): fora la carpeta de l'usuari
(«ferratges», on hi ha els ZIP), la del ZIP o de format (`STEP_…`, `DWG_DXF_…`, `3DS_…`, `dxf_einbau`) i tot el que hi ha
abans de la família; el mateix article des del STEP i des del DWG/DXF dona les mateixes carpetes. Nom
(`hettichLabel`): **«<nom en català> <sèrie> · <article>»** («Porta corredissa SlideLine 55 · 9060402», «Frontissa Sensys
110° · 9071205», «Pota d'acer · 1225», «Tirador Classic · 115001»): com a molt dues paraules de carpeta, sense les que ja
diu el nom ni les etiquetes (recobrent, encastat), la sèrie en alemany com al catàleg. **Sèrie** (`hettichSeries`,
`itemSeries`): la carpeta de després de la família («Sensys», «Classic», «SlideLine 55», «System 8099»; les genèriques
en català: «Acer», «D'angle», «Accessoris»…), per agrupar la biblioteca (§7).

Carpetes → categories de l'app (`classifyHettich`, `core/model/makers/hettichNames.ts`):

| Carpeta | Categoria | Etiquetes / nom |
|---|---|---|
| `Scharniere/Sensys`, `Intermat`, `Eingelenkscharniere/Scharniere`, `Winkelscharniere`, `Novisys`, `Veosys`… | **Frontisses** (`hinge`) | `aufliegend` → recobrent · `aufliegend-Mittelseiten` / `halb_vorliegend` → mig recobrent · `einliegend` → encastat · `Oeffnungswinkel_110` → 110° · `Innenwinkel_120_W30` → angle 30° |
| `…_Glas`, `Glastuerscharniere` | Frontisses, etiqueta `vidre` | «Frontissa de vidre» |
| `Alurahmen-Scharniere` | Frontisses, etiqueta `alumini` | «Frontissa per a marc d'alumini» |
| `Montageplatten/System_8099/…` | **Plaques de frontissa** (`plate`) | `Mit_vor_Euroschrauben` → amb cargols euro · `Zum_Einpressen` → per pressió (espigues) · `Zum_Anschrauben` → per cargolar… |
| `Zubehoer`, `Scharniertoepfe` (cassoletes soltes), `Moebelbaender` | Altres (`misc`) | «Accessori», «Cassoleta solta», «Frontissa de pala»: només 3D |
| `Push_to_open…` | Push | només 3D |
| `Schubkastensysteme/…` | Guies (`slide`) | «Calaix o guia»: només 3D |
| `Griffe/<família>` | **Tiradors** (`handle`) | «Tirador Classic · 115001», «Tirador Touch-in · …»; `Griffe/Zubehoer` → «Accessori de tirador», només 3D |
| `Tischgestelle_…/Aluminium_Moebelfuesse`, `Stahl_Moebelfuesse` | **Potes i sòcols** (`leg`) | «Pota d'alumini · …», «Pota d'acer · 1225» |
| `Tischgestelle_…/Tischbeine_Moebelfuesse` | Potes (`leg`) | «Pota de taula …» |
| `Tischgestelle_…/Change`, `LegaDrive`, `LegaMove`, `Steelforce/…_Line` | **Taules** (`table`) | «Estructura de taula»: només 3D |
| `Tischgestelle_…/Trimanis` | Taules (`table`) | «Guia de taula»: només 3D |
| `…/Steelforce_Elektronik/…`, `…/Steelforce/Zubehoer/…` (passacables, pantalles, calaixos) | Altres (`misc`) | «Accessori»: només 3D |
| `Cadro_Aluminiumrahmensystem` | **Perfils i marcs** (`profile`) | «Marc d'alumini (Cadro)»: només 3D |
| `Schiebetuersysteme/…` · `Falttuersysteme/…` | **Portes corredisses i plegables** (`door-system`) | «Porta corredissa», «Porta plegable»: només 3D |
| qualsevol altra | Altres (`misc`) | «Ferratge»: només 3D (mai «Carpeta desconeguda») |

La carpeta de la família (la de dalt: `Griffe`, `Tischgestelle_-beine_Moebelfuesse_…`) **no compta** per a les
subfamílies: el nom del ZIP de taules diu «Moebelfuesse» però una `LegaDrive` no és una pota (`FAMILY_DIRS`). Al nom,
només les paraules de la carpeta que no diu ja el nom («Pota de taula 46048», no «Pota de taula de taula»).

**El diàleg d'importar** (`HardwareImportDialog`): el resum per tipus («742 tiradors, 71 potes i 111 només 3D es poden
importar · N no es poden importar (sense STEP ni vistes DXF) · M ja són a la biblioteca»), un filtre per tipus amb els que hi són (Frontisses · Plaques · Tiradors
· Potes · Només 3D · No es poden importar; cap «Altres» que amagui res que es pugui importar) i a cada fila **què se'n
farà** (`HettichArticle.plan`, `importPlan`): «Frontissa · cassoleta i forats del STEP», «Placa · forats del STEP»,
«Només 3D: sense forats (…per què)». La dels tiradors i les potes es calcula llegint el STEP de les files que es veuen,
de mica en mica (`analyseArticle` → `proposalPlan`): «Tirador · 128 mm», «Pom · 1 forat», «Pota · 4 forats a cada pota»
o «Només 3D: …» si no s'hi troba el patró (un ZIP de 750 tiradors es llegeix sencer en ~4 s).

## 2. D'on surten els forats: el STEP

Lector propi, pur (`core/import/stepText.ts` + `stepGeometry.ts`): entitats de la secció `DATA` (també les complexes),
unitats (`SI_UNIT(.MILLI.,.METRE.)`, metres, polzades) i conjunts (`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION` +
`ITEM_DEFINED_TRANSFORMATION`: fill → pare = `P(item2) · P(item1)⁻¹`). De cada sòlid, les cares
`CYLINDRICAL_SURFACE` (eix de l'`AXIS2_PLACEMENT_3D`, radi) amb:
- el **tram al llarg de l'eix** (els vèrtexs de les arestes i els centres dels arcs projectats a l'eix);
- **quanta volta fan** (els `CIRCLE` de les arestes amb el sentit de l'`EDGE_CURVE`): un forat o un tetó és sencer
  (≥ 300°); un arrodoniment o el contorn d'una ala, no. Les cares d'un mateix cilindre (mig cilindre + mig cilindre)
  s'ajunten;
- forat (material a fora, `ADVANCED_FACE … .F.`) o tetó (material a dins: la cassoleta per fora, una espiga).

**Proposta** (`core/import/proposal.ts`), en el **marc del ferratge**:

- **Frontissa** (`proposeHinge`): la cassoleta és el cilindre sencer més gros de Ø20–Ø40. La cara de la porta és
  l'extrem del tram de la cassoleta del costat del cos de la frontissa (el braç); als models de Hettich és l'**origen**
  del fitxer. `n` = fora de la cara, `v` = cap a dins de la porta (lluny del cantell), `u = v × n` = al llarg del cantell.
  Forats: cilindres sencers de Ø2–Ø12 paral·lels a la cassoleta, a ≤ 45 mm del centre i a l'altura de la cara: els
  de l'**ala** (no entren a la porta: cargol, fondària per defecte 10) o **espigues** (entren a la porta: fondària del
  model). Concèntrics → un. La línia del parell simètric dona l'eix `u`; els cargols van més lluny del cantell que el
  centre (Sensys: 52 / 5,5 mm), d'aquí el sentit de `v`. Cassoletes inclinades (frontisses d'angle, W30): es giren al
  pla de la porta.
- **Placa** (`proposePlate`): **només els forats de muntatge de la cara que toca el lateral** (el pla per l'origen del
  fitxer, la referència de Hettich: a la filera, al mig de la placa): **espigues** (tetons que neixen en aquest pla i
  entren al lateral; fondària del model) i **forats de cargol** que travessen el cos de la placa des d'aquest pla
  (fondària del cargol euro, 12), de Ø2,5 a Ø12. De quin costat és el cos: els forats que neixen al pla hi van, les
  espigues a l'altre costat (si no, el centre dels vèrtexs). Els **traus** (forats allargats fets de dos semicercles i
  un tros, com els de les plaques amb cargols euro) es tornen un forat al centre **només si són d'un sol radi i en
  línia** (un trau en forma de clau o un rectangle arrodonit no és un forat de broca). La resta (traus d'ajust, el clip
  del braç, tetons de l'altra cara) no es proposa. Els forats van per **parells simètrics** (u ↔ −u); si en queda algun
  sense parell, la placa és **ambigua: cap forat** i la nota ho diu (s'entren a mà a l'editor; no es pot confirmar una
  placa sense forats). `n` = fora del lateral, `u` = la línia dels forats (amunt/avall), `v` = fondària (cap al darrere).
- **Tirador** (`proposeHandle`): els forats roscats que **neixen al pla per l'origen** del fitxer (la cara de muntatge:
  als models de Hettich l'origen és al primer forat, el tirador cap a un costat), cilindres sencers (forats, no tetons)
  de Ø2,8–Ø9; s'admeten forats que comencen fins a 3,5 mm endins (alguns `Folk`/`Deluxe`). Concèntrics → el més estret
  (el cargol). **Dos forats** → la distància entre centres, a la de catàleg (múltiple de 32: 64, 96, 128, 160, 192…) si
  hi és a ≤ 0,5 mm (`snapHandleDistance`; si no, a la dècima: 50, 260, 310…). **Un** → pom (un forat al centre). **Tres o
  quatre** (tiradors que es poden muntar a dues distàncies) → el parell **centrat al tirador** (el mig del parell al mig de
  la caixa del model, ±1 mm, al llarg dels forats) que passa per l'origen, si no el més llarg; les altres surten a la nota
  («també es pot muntar a 128 mm»). **Més de quatre** (perfils de tirador amb una filera de cargols) o cap parell
  centrat → cap proposta: **només 3D**. El forat del front és **passant** (`handleThroughDiameter`): el Ø del tirador
  per defecte de l'app (5) si el cargol hi passa (cargol + 0,5 ≤ 5: M3, M4), si no 1 mm més ample arrodonit amunt (M5 → 6,
  Ø6,4 → 8). Marc: origen al mig dels forats a la cara del front, `u` al llarg dels forats, `n` cap al tirador (fora del
  front), `v = n × u`.
- **Pota** (`proposeLeg`): els forats que neixen al pla per l'origen (la cara de la placa que toca la base; l'eix de la
  pota és a l'origen), de Ø2–Ø10, al voltant de l'eix: forats de **pilot** per al cargol de fusta (`legPilot`: Ø de la
  placa × 0,65 a la broca habitual: Ø4 → 2,5, Ø6,5 → 4) de 12 mm. `n` cap a la pota, `u` = X del fitxer, `v = n × u`.
  Més de 12 forats o més lluny de 200 mm de l'eix → no és una pota (una estructura): només 3D. Si els forats no són
  centrats a l'eix (potes de cantonada), la nota ho diu: totes les potes es posen girades igual.
- **Només 3D** (`modelProposal`): el marc del fitxer, la caixa i el perquè a les notes; cap forat.
- Totes passen per `proposeArticle` (`importItem.ts`), que tria segons el tipus de l'article i, si la proposta falla, en
  fa una de només 3D amb el motiu (abans, una frontissa sense cassoleta no s'importava). `articleItem` en fa l'item.
- **Broques** (`snapDrill`): a la més propera de 35, 26, 20, 15, 10, 8, 5, 4, 3, 2,5 (±12 %); un forat de pas una mica
  més ample (Ø5,25 o Ø5,7 d'un cargol de 5) va a la de sota. **Fondàries**: del tram dins de la peça arrodonit amunt al
  mig mil·límetre (cassoleta 12,8 → 13); si no n'hi ha, la de la categoria (cargol d'ala 10, cargol de placa 12).

Resultats amb les descàrregues reals (`hettich.roundtrip.test.ts`): Sensys 110° recobrent 9071205 → cassoleta Ø35 × 13
i cargols Ø5 a ±26 / 5,5; Sensys d'angle W30 9085166 → igual al pla de la porta; placa 8099 per pressió 9071615 →
espigues Ø10 × 11,5 a ±16; placa amb cargols euro 9071620 → Ø5 × 12 a ±16; 9071680 → les dues espigues (abans, també
un trau d'ajust); Hettich Direkt 9071650 → els dos forats a ±16,19 (abans, quatre). De tot el ZIP: 472 de 554
frontisses donen una proposta (les que no: sense cassoleta reconeixible, de vidre o d'alumini de pinça…); de 219
plaques, 123 en donen 2 forats i 16 en donen 4 (System 4899: espiga o cargol a la filera i cargol a 13), 71 són
ambigües (plaques lineals amb els forats en fondària, adaptadors, System 4899 amb cargols en creu…) i 9 no tenen cap
forat reconeixible.

Amb els ZIP de tiradors i potes (`hettich2.roundtrip.test.ts`, `HETTICH2_DIR`): de 742 tiradors, **585 donen la
distància** (Classic 115001 → 160; 9070102 → 96; Modern 115147 → 128 amb cargols M5 → Ø6; Deluxe 9113674, 4 forats → 96 i
la nota «també a 128»; New Modern 9064670, 3 forats → 360; Folk 9132268, forats 2,8 mm endins → 128), 74 són poms i ~83
queden només 3D (perfils de 5–20 cargols, perfils de 3,5 m, fitxers que el lector no entén); cap distància fora de
16–2000. De 71 potes, 70 donen forats (pota d'acer 1225: 4 forats Ø4 a ±22,5 → pilots Ø2,5 × 12; alumini 45084: 7) i les
estructures de 32 forats (70147, 70202) queden només 3D. Cadro (70), portes corredisses (~940) i plegables (~170): tot
només 3D.

El 3D: **OpenCascade** (`occt-import-js`, WASM de ~7,6 MB) en un worker (`components/viewer/occtWorker.ts`, **tret el 2026-10-15** amb la neteja: la importació és adormida), només en
importar; `stepMesh.ts` passa la malla al marc del ferratge (m) i en fa un GLB (`GLTFExporter`, normals de les cares).
Una frontissa Sensys són ~1.800 triangles (~70 kB de GLB).

## 3. Les vistes 2D (DXF)

Lector propi (`core/import/dxf.ts`): `LINE`, `ARC`, `CIRCLE`, `LWPOLYLINE` i `POLYLINE` (2D amb bulge, 3D), `ELLIPSE`,
`SPLINE` (de Boor), `POINT`, `INSERT` (escala, gir, blocs niats, la capa «0» hereta la de l'INSERT), extrusió (eix
arbitrari) i `$INSUNITS` (0 = mm, com els de Hettich). Cotes, textos, ombrejats i sòlids s'ignoren. **Límits**
(`DXF_LIMITS`; un fitxer malmès no penja la pàgina): angles d'arc i paràmetres d'el·lipse normalitzats a una volta,
splines de grau absurd → punts de control, i com a molt 200.000 entitats (comptant les còpies dels INSERT), 2 milions
de punts i 10.000 còpies per INSERT; si no, error «El DXF és massa gran o està malmès» (la vista no s'importa). Es desen
simplificades (Douglas–Peucker 0,02 mm, centèsimes: unes desenes de kB per vista). Cada vista es **registra**
(`registerView`): de les 8 orientacions d'eixos, la que fa caure els seus cercles sobre els forats proposats (error mitjà
< 0,5 mm). A les frontisses, la frontal hi encaixa i l'editor la posa de fons sota els forats; a les plaques sovint no
(els forats hi són traus). Els `CONNECTIONPOINTS` (tres punts per vista, els mateixos girats a cada vista) es desen tal
com venen a l'item (`imported.points`); de moment no fan res (vegeu §9).

## 4. Model de dades (preferències v20 i v21, additiu)

`HardwareItem` (`core/model/hardware.ts`):
- `imported`: `maker`, `article`, `folders` (alemany, com venen), `files`, `asset` (id `hwa-…` de la taula Dexie
  `hardwareAssets`, **v6**: el GLB i les vistes; no viatja amb les còpies dels mòduls ni al `.moble`), `bbox` (marc del
  ferratge), `points`, `proposed` (els mecanitzats tal com es van llegir), `notes`, **`confirmed`** i `damaged`. Opcionals
  (additius, sense canviar la versió): `proposedParams` (els números de la proposta que no són als mecanitzats: Ø i
  fondària de la cassoleta, Ø i distància `pitch` del tirador) i **`update`** (una proposta nova pendent de revisar: forats,
  números, notes i caixa; §6). Un «només 2D» no porta `bbox`. L'asset (`HardwareAsset`) porta també els plànols de
  muntatge (`docs`: nom i fitxer) i les vistes sense registrar, els seus cercles (`circles`).
- **Importat malmès** (`sanitizeImportedHardware`, a `HardwareItemSchema`: preferències, mòduls, fronts i `.moble`): un
  item amb `imported` que no passa l'esquema (un camp dolent a `imported`, un mecanitzat dolent…) **no es repara camp a
  camp** (sense `imported` seria una frontissa que forada; amb mitges dades, mig ferratge): es llegeix **inert**, amb la
  marca `imported.damaged`, sense mecanitzats ni confirmació, amb l'id, el nom i el motor. No fa cap forat i el moble
  avisa «… ferratge importat malmès: no es mecanitza»; no es pot confirmar (cal tornar-lo a importar).
- Frontisses: el motor de sempre (`cup`). Target `door`: la cassoleta (`v = cupOffset`, Ø i fondària = `cupDiameter`,
  `cupDepth`) i els cargols o espigues amb `v = "cupOffset±x"` (relatius al centre de la cassoleta, tags `hinge-screw` /
  `hinge-dowel`). La quantitat per alçada, els extrems, la separació i `cupOffset` («distància de la cassoleta», «Al
  cantell» a Mides) es copien de la frontissa per defecte.
- Placa aparellada **per referència**: `plate` (`id`, nom, model) i el target `side` amb una **instantània** dels forats
  de la placa (com les còpies dels mòduls), i `params.plateSetback` (de la cara de darrere de la porta a la referència
  de la placa, 37 = filera System 32 amb fronts recobrents) i `plateOffset` (alçada de la referència respecte al centre
  de la cassoleta, 0). Cada canvi de la biblioteca passa per `syncPairedPlates`: les frontisses agafen els forats i el
  model de la placa d'ara i, si els forats han canviat, tornen a quedar sense confirmar. Una placa eliminada deixa la
  instantània. En importar, les frontisses s'aparellen amb la placa del lot **només si n'hi ha una** (`pairImportedBatch`;
  amb més, s'aparellen a l'editor).
- Plaques: motor nou `plate` (sense lloc del mòdul: només s'aparellen), `params.setback` i `offset`, target `side`.
- **Tiradors** (`handleItem`): el motor del tirador de sempre (`barHandle`, lloc «Tirador») amb la **distància del fitxer**
  com a regla sense graons (`pitch: { steps: [], else: 160 }`: la mateixa a tots els fronts, no la de l'espai), els
  forats passants `±pitch/2` (o un a 0, pom, `pitch` 0) de Ø `diameter`, i el marge i el cantell (`inset`) del tirador per
  defecte. Canviar la distància (`setHandleDistance`) o el Ø el deixa sense confirmar (`IMPORTED_HOLE_PARAMS_BY_ENGINE`).
- **Potes** (`legItem`): motor nou `leg` (sense lloc del joc del mòdul: es tria a la base «Potes», `Base.hardware`),
  `params.inset` (50, dels cantells de fora del mòdul a l'eix de la pota), target `base` (forats al marc de la pota).
- **Només 3D** (`modelItem`): motor nou `model`, la categoria de la família (`table`, `door-system`, `profile`, `misc`…),
  target `model` sense cap mecanitzat; no es confirma mai (`confirmProblem`: «És només 3D») ni es pot triar enlloc.
- Categories noves (preferències **v21**, additiu): **Taules** (`table`, `LuTable`) i **Portes corredisses i plegables**
  (`door-system`, `LuDoorOpen`); «Perfils» passa a «Perfils i marcs» (Cadro).
- `sameHardware` no compara el model, les vistes ni les notes, però **sí** `confirmed`.

## 5. Al moble (la regla i el mecanitzat)

`buildModule.addCups` (les regles de sempre: quantitat per alçada, al mig de dos forats de la filera System 32, sense
trepitjar-se, a `cupOffset` del cantell, cara A = la de dins de la porta) fa ara **tots** els forats del target `door`
(cassoleta + cargols) i, si la frontissa té placa, `addPlate`: al **lateral del costat de les frontisses**, cara de dins,
a `zFront − plateSetback` i a l'alçada de cada cassoleta + `plateOffset`, amb el marc de la placa (v cap al darrere, n
cap a dins del moble, `u = v × n`). Un forat de la placa que cau sobre un de la filera System 32 el substitueix si és
més gros (espiga Ø10) o hi coincideix (cargol euro Ø5 × 12: el mateix forat). Un forat fora del lateral no es fa i avisa.
Tot acaba en `Hole` normals: **DXF, .xcs, STEP i CSV sense cap canvi**.

**Sense confirmar, cap forat**: es pot triar a la porta o com a frontissa del mòdul, però la porta queda sense
cassoletes ni forats (ni la placa) i el moble avisa (`hardware`): «… és importada i encara no està confirmada…». Millor
cap forat que un de dolent al taller. Confirmar (o treure la confirmació) **actualitza els mobles desats** que en porten
la còpia d'abans (`replaceHardwareEverywhere`). Editar els forats d'un importat, o el Ø o la fondària de la cassoleta o
on va la placa (`setHardwareParam`, `IMPORTED_HOLE_PARAMS`), el torna a deixar sense confirmar. **No es confirma**
(`confirmProblem`) un malmès, una placa sense forats, ni una frontissa amb la placa aparellada sense confirmar.

**Un importat que no serveix mai torna a la frontissa d'inici** (`slotSpec`, `inertHinge`): si el motor falla (un Ø 0,
una fórmula dolenta, un paràmetre que falta), la porta queda sense cassoletes ni forats i l'avís `hardware` diu el nom
de l'item; ni al front torna a la del mòdul. Els ferratges que no són importats continuen tornant al d'inici (al
mòdul) o al del mòdul (al front), com sempre.

**Tota la frontissa o res** (`addCups` i `plateHoles`): el patró sencer (cassoleta i cargols o espigues, amb el seu Ø)
ha de cabre a la porta amb el marge, i la placa sencera al lateral, fora de la unió amb la base, la tapa o un
prestatge fix (espigues i cantell). Una alçada on no hi cap no fa ni la cassoleta ni la placa; si en queden menys de
les que toquen, l'avís `hinge` de sempre (amb el perquè de la placa). Un forat de la placa més fondo que el lateral es
fa a gruix − 1 (1 mm de pell, com els forats cecs del STEP) i avisa. Sense lateral al costat de les frontisses
(`sides.left: false`), la porta fa les cassoletes i un avís diu que els forats de la placa no es fan. **Fronts
encastats**: la referència de la placa es mesura des de la cara de darrere de la porta (un gruix de front més endins),
sola. **Plaques a banda i banda d'un divisor** (o sobre la filera de l'altra cara): `resolveHoleClashes` /
`shortenFitting` escurça primer el forat que no és del ferratge i, si no n'hi ha prou, tots dos a (T − 1)/2, sempre amb
avís `hole-clash` i mai per sota de 8 mm (`MIN_FITTING_DEPTH`): si no es pot, no es toca i l'avís ho diu clar.

**Tiradors importats** (`buildModule.handle`, `frontHandle`): cada porta, calaix o abatible pot triar el seu tirador
(`front.handle`, una còpia, com `front.hardware`; a l'inspector, «Tirador» al Front, sota la frontissa/guia/braç, amb el
del mòdul per defecte = el comportament d'abans; no surt a la porta de vidre ni amb fronts push, `visibleModule`). La
regla és la de sempre (porta: a `inset` del cantell que obre, a mitja alçada; calaix: centrat; abatible: a `inset` del
cantell que obre), però amb la distància del fitxer; si no hi cap, l'avís `handle` de sempre i cap forat. Confirmat, el
model del tirador va a la cara de fora del front (`Panel.fittings` amb `kind: "handle"`) i el 3D no hi posa la barra
genèrica. **Sense confirmar, cap forat** (ni el del tirador de l'app) i avís `hardware`; malmès o que fa fallar el motor:
inert (`inertHandle`), mai el del mòdul. També com a tirador de tot el mòdul (Fusteria).

**Potes importades** (`buildModule.buildLegs`): amb una pota triada a la base «Potes» (Caixa › Base › «Pota»: Genèriques
o les de la biblioteca), una a cada cantonada a `inset` de les vores de fora del mòdul (on les dibuixa el 3D), els forats
de la placa a la **cara de sota de la base** (u = X del mòdul, v = cap al davant: totes girades igual). **Totes o cap**:
si una placa no hi cap sencera (3 mm de marge, sense trepitjar cap forat; p. ex. sota un lateral) no se'n fa cap i avisa;
més fonda que la base → gruix − 1. Si la pota fa una altra alçada que la base «Potes», avís. Confirmada, el model de la
pota a cada cantonada (`fittings` `kind: "leg"`) en lloc de les potes genèriques. Sense confirmar, cap forat i avís.

**Només 3D**: mai cap forat: no tenen lloc al joc del mòdul ni als fronts (un que s'hi forcés queda inert: ni frontissa
ni tirador ni pota). A l'editor del ferratge es veuen en 3D (el model sol, amb la caixa) i se'n pot **baixar el GLB**
(«Model 3D › Baixar el model 3D (.glb)», també per als altres importats) per posar-lo en un objecte (Models 3D › Triar
fitxers): per decisió de l'usuari els models 3D només van als objectes, no als mobles.

**«Com va muntat»**: els tiradors, en un calaix d'exemple (3D mirat des de fora, amb el model del tirador; Pla amb la cota
entre centres); les potes, en un mòdul baix sobre potes (la base amb les quatre plaques, mirat des de sota).

**`.moble` v2** (`MOBLE_VERSION`): un moble amb algun ferratge importat es desa com a **v2**; una app d'abans (que només
llegeix la v1) el rebutja («Fitxer d'una versió més nova») en lloc de treure'n `imported` en silenci i foradar la
frontissa pendent. Els que no en porten es continuen desant com a v1 (`MOBLE_BASE_VERSION`).

El visor 3D (Opcions de vista › Ferratges) posa el GLB de la frontissa a cada cassoleta i el de la placa al lateral
(`Panel.fittings`, que segueixen la peça: porta oberta, explosionat, peces girades per `normalizePanel`); mentre no hi
és (un altre ordinador, sense el model), la caixa. No surten al render, a l'AR ni a les exportacions (decoratiu).

**Per revisar-lo abans de confirmar**: a l'editor del ferratge, «Com va muntat» (`core/build/hardwareMount.ts`) el
munta en un mòdul petit fet per `buildModule` (porta de 450 d'alt amb la frontissa a l'esquerra, lateral amb la placa,
el gruix del tauler per defecte): **3D** (el GLB de la frontissa a la cassoleta i el de la placa al lateral, la porta
es pot obrir) i **Pla** (vista de dalt tallada a la cassoleta de baix, amb el joc, el recobriment, el cantell → centre
de la cassoleta, C, la fondària i la filera de la placa des del davant). Sense confirmar, es construeix amb una còpia
confirmada i els forats del ferratge surten en taronja (proposats): és el que faria el moble un cop confirmat.

Proves: `core/build/importedHardware.test.ts` (porta esquerra i dreta: cassoletes iguals que les d'inici, cargols a ±26
i 5,5 cap a dins, placa a ±16 de cada cassoleta a 37 del davant a la cara de dins del lateral de les frontisses; sense
confirmar, res; placa euro = forats del System 32; porta girada), `core/build/importedHardwareSafety.test.ts` (malmesos,
errors del motor, divisor, plaques fondes, portes baixes, encastats, sense lateral, placa per referència),
`core/file/mobleFile.test.ts` (v1/v2), `core/import/*.test.ts` (fitxers sintètics, DXF malmesos) i
`hettich.roundtrip.test.ts` (`HETTICH_DIR=<carpeta amb els ZIP> pnpm exec vitest run src/core/import/hettich.roundtrip.test.ts`;
se salta sense la carpeta). Tiradors, potes i només 3D: `core/build/importedHandleLeg.test.ts` (tirador confirmat a porta,
calaix i abatible a la seva distància; pom; sense confirmar, malmès o d'error: cap forat; porta de vidre i push; `.moble`
v2; potes a la cara de sota de la base, totes o cap, alçada; un només 3D forçat a qualsevol lloc no forada) i
`core/import/hettich2.roundtrip.test.ts` (`HETTICH2_DIR=<carpeta amb STEP_Griffe.zip, STEP_Tischgestelle_….zip,
STEP_Cadro_….zip i, si hi són, STEP_Schiebetuersysteme.zip i STEP_Falttuersysteme.zip>`: classificació de tots els
articles, distàncies de tiradors reals, potes, i un tirador real confirmat fent els forats a 96 en una porta i un calaix).
**Proves d'or idèntiques.**

## 6. Tornar a importar: s'amplia (no es repeteix)

«Al importar, mira si ja existeix la referència i si el document importat porta nova informació, la col·loques» (de
l'usuari). La clau és **(fabricant, article)** (`importedMatches`; també les còpies que n'hagi fet l'usuari). Un article
que ja és a la biblioteca **s'amplia** (`core/import/merge.ts`, `mergeImported`; Dexie a `hardwareImport.ts`):

- **STEP**: el 3D (GLB, només si encara no en té: OpenCascade no es torna a fer), la caixa i, si no en tenia (un «només
  2D» o un «només 3D» que ara troba el patró), la proposta sencera (motor, categoria, forats, números), sense confirmar,
  amb el mateix id i nom. Les vistes desades abans del STEP (sense registrar) porten els seus cercles (`HardwareView.circles`)
  i es registren ara sobre els forats (`registerStoredView`).
- **DWG/DXF**: les vistes que falten (una de registrada guanya a una que no) i els punts de connexió.
- **Plànols de muntatge** (`dxf_einbau`, exemples d'aplicació, PDF; tipus de fitxer `ref`, `refArticles`): s'adjunten tal
  com venen a l'asset (`HardwareAsset.docs`) dels articles que nomenen (si són al lot o a la biblioteca: un ZIP de plànols
  sol amplia els que ja tens, `groupHettich(files, known)`); a l'editor, «Plànols» per baixar-los. El 3DS no s'importa.
- **Mai es toca un mecanitzat confirmat**: si els fitxers nous donen una altra proposta (els forats `proposed` o els números
  que en surten, `imported.proposedParams`: Ø i fondària de la cassoleta, Ø i distància del tirador), es desa a part,
  **`imported.update`**, i l'editor ho diu: «Hi ha una proposta nova: revisar», amb la d'ara i la nova costat per costat,
  «Aplicar la nova (sense confirmar)» (`applyImportUpdate`: els forats nous, sense confirmar; els mobles que el fan servir
  passen a la còpia sense confirmar, com «Treure la confirmació») i «Descartar-la» (`dismissImportUpdate`). La targeta
  porta «Proposta nova». El mateix si l'item no està confirmat però se n'han editat els forats (`isUnedited`); si no
  s'ha editat, els forats nous directament (sense confirmar). La placa aparellada es queda. Una proposta nova que no troba
  el patró (només 3D) no treu els forats d'un que en té.
- **Mecanitzats del generador** (`machining`, §8): un **DXF del taller per peça** (`<art>_porta.dxf` amb capes de
  mecanitzat) és informació nova (el diàleg diu «mecanitzats del DXF del taller»). Un item sense confirmar i sense
  mecanitzats els rep (sense confirmar); si ja en té uns altres, o està confirmat, **no es toquen**: van a
  `imported.update.machining` i l'avís «Hi ha una proposta nova» els compara; aplicar-los el deixa sense confirmar (si
  només canvien els mecanitzats, els forats d'ara es queden). Un import sense mecanitzats nous conserva els que hi havia
  (també quan un «només 2D» passa a tenir el STEP). Un «només 3D» confirmat (amb mecanitzats) no es reemplaça.
- Un importat **malmès** es torna a fer amb el nou (mateix id i nom, sense confirmar).
- **Dins d'un mateix lot**, els fitxers del mateix article de diversos ZIP (STEP + DWG/DXF deixats alhora) ja van junts
  (`groupHettich`). El diàleg diu a cada fila si és **«Nou»** o «Ja existeix · s'hi afegeix: 3D i forats proposats, vistes
  2D i plànols de muntatge» (o «res de nou», `mergePreview` / `mergeText`), i a dalt quants ja hi són.

Els noms automàtics d'abans («Porta corredissa ferratges DWG DXF Schiebetuersysteme SlideLine 55 9060402»: la carpeta de
l'usuari i la del ZIP es colaven al nom) passen al d'ara **en llegir les preferències** (`migrateImportedNames`, a
`parseSettings`), només si encara són el que posava l'app (`legacyHettichLabel`, també amb « 2» de repetit); un nom
canviat per l'usuari es queda. Les carpetes desades es netegen igual. Idempotent, sense canviar la versió.

Proves: `core/import/merge.test.ts` (només 2D → frontissa; confirmada: res tocat i els mateixos forats al moble, pendent,
aplicar → sense confirmar; mateixa proposta; editada; placa; tirador; DXF sobre STEP; malmès; noms d'abans i lectura de
les preferències) i `core/import/hettichMerge.roundtrip.test.ts` (amb els ZIP reals a `HETTICH_DIR`, `HETTICH2_DIR` o
`HETTICH_DXF_DIR`: el `DWG_DXF_Griffe.zip` sol —769 articles, 21 només al DWG/DXF— i amb el STEP; DXF primer i STEP
després → tirador de 96 mm amb el mateix id; la vista frontal del Sensys 9071205 desada abans del STEP es registra; el
perfil SlideLine 55 9060402 fa 1560 × 12,5 × 6,5).

## 7. La biblioteca: categoria › sèrie, i el 3D dels «només 3D»

- **Graella per categoria i sèrie** (Preferències › Ferratges): dins de cada categoria, els que no tenen sèrie (els de
  l'app, fitxers solts, Cadro) a dalt i un plegable per sèrie (`FoldGroup` `nested`, amb el nombre; ordenades pel nom; les
  obertes es recorden a la sessió, `mobles:md-open:hardware-series`; el contingut es munta en obrir-les). La cerca (també
  pel número d'article i la sèrie) obre les que hi coincideixen.
- **Enquadrar un «només 3D»** (`modelCamera`, a `mountCamera` amb l'aspecte del visor; el 3D de l'editor i la miniatura):
  la càmera més a prop que veu tota la caixa (els vuit vèrtexs, perspectiva exacta). Un objecte **llarg i prim** (el costat
  llarg ≥ 5 × el del mig, horitzontal: un perfil de 1560 × 12,5 × 6,5) es mira **al llarg** des d'un extrem, de costat una
  mica més que la meitat del camp horitzontal i de dalt ~10°: la secció de l'extrem de davant es veu (~30–45 % de l'alçada)
  i el llarg travessa la imatge en perspectiva (de costat, sortia una ratlla). La resta, de 3/4.
- **Cotes** al 3D de l'editor: les tres arestes de la caixa que surten del vèrtex del costat de la càmera, amb la mida en
  mm (sprites de mida constant, no `Html`), i la resta de la caixa fina. Al resum de la targeta, «1560 × 12,5 × 6,5 mm».
- **Només 2D** (sense STEP): la targeta mostra la vista frontal del DXF (no hi ha 3D) i l'editor ho explica.

## 8. Generador de mecanitzats i ferratges col·locats a mà

> Petició de l'usuari: «No podem saber les mides del 3D? Es podria fer un generador de mecanitzat: selecciones l'eina i
> el que li ha de fer a la fusta per mecanitzar la peça i que es pugui posar». Per als «només 3D» (i qualsevol altre
> ferratge) que no tenen cap regla de l'app: les mides les diu l'usuari (o un DXF del taller) i el ferratge es col·loca
> a mà a la peça del moble.

**Generador** (Preferències › Ferratges › editor del ferratge, secció «Generador de mecanitzats»; preferències **v22**,
additiu: `HardwareItem.machining`, `core/model/hardwareOps.ts`). Per a cada **peça** (`PART_KINDS`: porta / front ·
lateral · base · tapa / tauler de taula · prestatge · fons · caixa del calaix · peça lliure), una llista d'operacions
(`GenOp`):

- **Forat** (Ø, fondària, passant) a la cara A o B, o **de cantell** (cantell de davant, de dalt…; a mig gruix).
- **Ranura** (amplada, fondària, al llarg de quin eix, llargada o **de cantell a cantell**, passant).
- **Caixera** (rectangle al llarg × a través, fondària, radi de les cantonades: el fa la fresa, ha de ser ≥ Ø/2).
- **Contorn** (punts, tancat): passant (un tall amb forma) o, si no ho és, un rectangle (la peça no té fresats cecs en
  corba).
- **On**: el centre, en el pla de la peça amb els **eixos del moble** (`partAxes`: de cara X·Y, de costat Z·Y, estirada
  X·Z), des del **punt de referència** del ferratge (on es col·loca) o des d'un **cantell** (de l'esquerra, de davant,
  de dalt…) o del mig.
- **Eina**: les broques i freses muntades de la màquina per defecte (`toolLabel` «codi · nom · Ø»): la broca dona el Ø, la
  fresa l'amplada de la ranura (o el radi de la caixera); es comprova que hi cap i que arriba a la fondària (fondària útil).
- **Validació** pura (`machiningProblems`): mides, cantell, contorn, eina; amb algun problema el ferratge no fa res i no es
  pot confirmar. En llegir les preferències o un moble, una llista d'operacions dolenta es treu **sencera**
  (`repairAtomically`): mai mig ferratge.
- A l'esquerra, sota el 3D (amb les mides de la caixa del model u · v · n): el **dibuix** d'una peça d'exemple amb la creu
  del punt de referència, les operacions (cara B discontínua) i de fons la vista 2D del fitxer (girada i en mirall si
  cal). **Un clic al dibuix posa el mecanitzat triat** en aquell punt (s'enganxa als vèrtexs de la vista i als centres dels
  cercles); el punter diu la distància a la referència.
- **Importats**: tocar-ne els mecanitzats els deixa **sense confirmar**; fins que es confirmen no fan cap forat. Un
  «només 3D» amb mecanitzats es pot confirmar (sense, continua sense cap forat i no cal confirmar-lo).

**Col·locar-lo al moble** (Editor › mòdul › «Ferratges», o peça lliure › «Ferratges»; `Composition.hardwarePlacements`,
`core/build/hardwarePlace.ts`): «Afegir ferratge» → el ferratge (els de la biblioteca amb mecanitzats o «només 3D») → la
peça del mòdul (Lateral esquerre, Sostre, Base, Fons, Prestatge…) i quin grup de mecanitzats de l'item li toca → on va
el punt de referència (des d'un cantell o del mig, amb els eixos de la peça) → repetició opcional (n còpies cada x mm al
llarg d'un eix) → el gir del model 3D. Els altres grups de l'item (p. ex. la ranura de la base d'una porta corredissa)
**només es fan si es tria expressament** la peça («També: Base»). Es guarda una **còpia** de l'item, com els mòduls
(confirmar o eliminar a Preferències hi passa, `replaceHardwareEverywhere`).

- **Tot o res** per ferratge col·locat: si una operació no cap sencera a la peça (fora del rectangle o del contorn, més
  fonda que el gruix, un forat de cantell fora del cantell), **cap** de les seves operacions a cap peça, i avís
  `hardware` a «Avisos de fusteria» i a la fila del ferratge. També sense cap forat (i avís): importat sense confirmar,
  malmès, «només 3D» sense operacions, una operació dolenta, o la peça que ja no hi és (res amagat compta: un fons
  apagat, un mòdul esborrat) o que no és de CNC.
- Acaba en `Hole` (cara A/B o de cantell), `Groove` (ranures i caixeres cegues) i `Cutout` (passants: cercle, rectangle,
  polígon) amb l'etiqueta `fitting`: **DXF, .xcs, STEP i CSV sense cap canvi** (els forats de la cara B fan la 2a cara;
  `hardwarePlaceExports.test.ts`). Sense ferratges col·locats, el moble és idèntic (**proves d'or sense canvis**).
- **3D** (Opcions de vista › Ferratges): el model (GLB de l'importat) o, sense, un volum de l'extensió de les operacions,
  al punt de referència de cada còpia (`Panel.fittings`, `kind: "item"` amb `placement` = l'id del col·locat), amb l'eix
  v al llarg del segon eix de la peça (girat amb «Gir del model»). El model es veu **també quan no fa cap forat**
  (importat sense confirmar, mecanitzat dolent o que no hi cap): és només visual, i així es troba i es tria al 3D.
- **A l'editor, com un configurador de fabricant**: «Ferratges» del mòdul (i de la peça lliure) llista **els col·locats**
  (Editar · Duplicar · Eliminar; tocar-ne un el tria) i, a sota, **els de les regles** del mòdul comptats
  (`core/build/hardwareSummary.ts`, `ruleHardwareCounts`: frontisses, tiradors, guies, braços d'abatible, potes, push,
  imants, espigues). Un col·locat **es tria clicant-lo al 3D** (selecció `hardware`): contorn en passar-hi per sobre i,
  triat, contorn gruixut i una **barra flotant** Duplicar · Editar · Eliminar (`viewer/FittingToolbar.tsx`: malles de
  mida constant amb les icones del catàleg, `iconTexture.ts`); l'inspector passa a «Col·locació» del ferratge (amb Pare,
  anterior/següent). Supr l'elimina, Ctrl/⌘ D el duplica (50 mm més cap a dins al llarg de P, `duplicatePlacement`),
  i tot va al desfer comú. Segueix la seva peça a l'explosió i en obrir portes.
- **Col·locació paramètrica** (per decisió de l'usuari: «la col·locació al moble no hauria de ser paramètrica?»): cada
  eix del punt de referència és un **ancoratge** (des de l'inici, des del final, el mig o un % de la peça) més un
  desplaçament o una **fórmula** amb les mides de la peça (L llarg, A ample, G gruix, M la mida al llarg de l'eix; el
  mateix avaluador sense `eval` dels ferratges). La **repetició** pot anar des del punt, centrada al punt, repartida entre
  marges o cada tants mm entre marges, amb la quantitat fixa o **per mida** (una regla com la de les frontisses: 2 fins a
  900, 3 fins a 1600…). **Mirall esquerra/dreta**: també al lateral de l'altre costat, o reflectit a la mateixa peça si va
  de costat a costat. Tot es recalcula a cada construcció: si el mòdul canvia d'amplada o d'alçada, els ferratges el
  segueixen (tot o res, també amb les còpies). Les col·locacions d'abans («des de la referència» = des de l'inici) es
  llegeixen igual. L'inspector en mostra una **previsualització en viu** amb les cotes.
- **Selector amb calaix**: «Afegir ferratge» (i el Ferratge d'un col·locat, la frontissa, la guia, el tirador, la pota…)
  obren el mateix calaix que els materials, amb el cercador, les categories › sèries i les miniatures 3D; només els
  compatibles, els «Sense confirmar» amb la insígnia i les còpies «Del moble» a part.
- **`.moble` v3** (`MOBLE_PLACEMENTS_VERSION`): un moble amb ferratges col·locats es desa com a v3 (una app d'abans els
  trauria en silenci); amb importats i sense col·locats, v2; si no, v1.

Proves: `core/model` i `core/import/dxfMachining.test.ts` (validació, capes, noms de fitxer), `core/build/hardwarePlace.test.ts`
(cara A/B, cantell, ranura de cantell a cantell, passant, repetició, fora de la peça → cap, importat sense confirmar,
«només 3D» sense operacions, peça que no hi és, peça lliure, grups de l'item només si es trien, gir del model, lectura
atòmica, migració idempotent, `.moble` v3) i `hardwarePlaceExports.test.ts` (DXF, .xcs, STEP, CSV).

### Mecanitzats exactes d'un DXF per peça (capes del taller)

Un DXF d'una peça amb les **capes del nostre export DXF** (`core/import/dxfMachining.ts`) dona les operacions exactes,
sense endevinar res. En importar (al costat del STEP, mateix número: `70147.stp` + `70147_tapa.dxf`) **manen sobre els
forats que s'endevinen del STEP** (l'item passa a «només 3D» amb aquests mecanitzats, sense confirmar); a l'editor,
«Llegir un DXF…» els posa a la peça del nom del fitxer o, si no en diu cap, a la peça triada (substitueix les seves).

| Capa | Entitats | Operació |
|---|---|---|
| `DRILL_D<Ø>_P<fondària>` (cara A) · `DRILL_B_D…_P…` (cara B) | cercles | forat cec amb el Ø de la capa |
| `GROOVE_W<amplada>_P<fondària>` · `GROOVE_B_…` | rectangle tancat, o línia central (fa la llargada + l'amplada) | ranura |
| `POCKET_P<fondària>` · `POCKET_B_P…` | rectangle tancat | caixera |
| `CUT_THROUGH` | cercles (forat passant) i polilínies tancades | tall passant |
| `CONTOUR` | polilínies tancades | tall passant; la més gran, si ho envolta tot, és el contorn de la peça i no es talla |

Decimals amb `_` (`P17_5` = 17,5 mm). No es llegeixen (i es diu): forats de cantell (`DRILL_H_…`), ranures en diagonal,
caixeres que no són rectangles.

### Com exportar des de TopSolid

*(Per passar-ho al germà.)* Per a cada ferratge que no té regla a l'app (perfil de porta corredissa, estructura de taula,
accessori…), dos tipus de fitxers amb el **mateix número de referència** al davant del nom (només xifres, p. ex.
`70147`):

1. **El 3D: `70147.stp`** — STEP **AP214**, en **mil·límetres**, del ferratge sol. L'**origen** (0, 0, 0) al **punt de
   referència de muntatge** (el punt que es col·locarà a la peça: el centre del forat principal, l'extrem del perfil, el
   centre de la placa…). Eixos: **Z cap enfora** de la cara de la peça on va muntat, **Y** al llarg del segon eix de la
   peça (amunt en una porta o un lateral, cap al davant en una tapa, una base o un prestatge), **X** el que queda
   (regla de la mà dreta). Si no quadra, a l'app es pot girar el model (només el 3D).
2. **Els mecanitzats: un DXF per peça que es mecanitza**, `70147_<peça>.dxf` amb `<peça>` = `porta`, `lateral`, `base`,
   `tapa`, `prestatge`, `fons`, `calaix` o `peca` (peça lliure). Dins:
   - Vista de la peça **amb els eixos del moble**: X cap a la dreta (en un lateral, cap al davant) i Y cap amunt (en una
     tapa, base o prestatge, cap al davant). **Origen al mateix punt de referència** que el STEP. Mil·límetres.
   - Cada mecanitzat a la capa que diu què és, com les capes del DXF que treu l'app:
     - forats: cercles a `DRILL_D5_P12` (Ø 5, fondària 12) a la cara A, `DRILL_B_D5_P12` a la cara B; un forat que
       travessa, cercle a `CUT_THROUGH`;
     - ranures: el rectangle de la ranura (o la línia del centre) a `GROOVE_W8_P10` (amplada 8, fondària 10);
     - caixeres (buidats rectangulars): el rectangle a `POCKET_P12`;
     - talls que travessen: el contorn tancat a `CUT_THROUGH`;
     - els decimals amb guió baix: `DRILL_D8_P17_5`.
   - **Cara A** = la cara de dins del moble (la que mecanitza la CNC: sota a la tapa, dalt a la base, dins als laterals i
     a les portes, davant al fons). Els forats de cantell no es llegeixen del DXF: s'entren a mà a l'app.
   - El contorn de la peça a la capa `CONTOUR` és opcional (si envolta tot el dibuix, no es talla).
3. Passar-ho junt (els fitxers o un ZIP) a Preferències › Ferratges › «Importar del fabricant». Entren **sense
   confirmar**: es revisen al dibuix del generador i es confirmen; després, al moble: mòdul › «Ferratges» › «Afegir
   ferratge».

## 9. Pendent

Plans per als «només 3D» d'ara (cap regla encara; el que caldria per fer-ne els forats):

- **Cadro (marc d'alumini per a portes de vidre)** ↔ `front.glass` (la porta de vidre, que avui fa un marc genèric de 20
  mm a `extras`): triar el perfil Cadro com a «marc» de la porta de vidre (mides del perfil i del vidre del fitxer, en
  lloc dels 20 / 5 fixos) i les **frontisses per a marc d'alumini** (`Alurahmen-Scharniere`, ja classificades com a
  frontisses amb l'etiqueta `alumini`): els seus forats van al **lateral** (placa) però no a la porta (el marc no és de
  CNC). Cal: llegir el perfil (secció i ranura del vidre) del STEP, la regla «frontissa sense cassoleta» (només placa) i
  el pendent del taller «frontisses de porta de vidre».
- **Portes corredisses** (`Schiebetuersysteme`: TopLine, SlideLine, InLine…): **ranures** (o perfils encastats) a la tapa
  i la base al llarg de tota l'amplada per als carrils de dalt i de baix (amplada, fondària i distància al davant de
  cada sistema, del fitxer del perfil o de la taula de muntatge `dxf_einbau`), i els forats dels carros a les portes
  (a `x` del cantell de dalt/baix). Cal un front nou «porta corredissa» (dues o més fulles encavalcades) i triar quin
  sòlid del conjunt és el perfil.
- **Portes plegables** (`Falttuersysteme`, WingLine): **frontisses entre fulles** (cassoletes a les dues fulles al seu
  cantell comú) i el carril de dalt com les corredisses (ranura o perfil a la tapa) amb el pern de la primera fulla. Cal
  un front «plegable» (n fulles) i la regla de les cassoletes entre fulles.
- **Estructures i guies de taula** (`Change`, `LegaDrive`, `LegaMove`, `Steelforce`, `Trimanis`): forats al **tauler de
  taula** (cara de sota) on es cargola el bastidor; cal la posició del bastidor respecte al tauler (centrat, voladissos)
  i triar del conjunt les plaques de muntatge.
- **Potes de cantonada** (`Tischbeine_Moebelfuesse`, forats no centrats a l'eix): girar o fer mirall del patró a cada
  cantonada (avui totes van girades igual: els forats són bons però una pota de cantonada pot quedar mirant enfora; si
  no hi cap, cap forat i avís). **Potes regulables de sòcol** (clips): sense descàrrega STEP encara.
- **Perfils de tirador** (tiradors amb 5–20 cargols, `Griffe/New_Modern` de 1–3,5 m): una regla de N forats a pas fix
  al llarg del front.

- **Guies i calaixos** (`Schubkastensysteme`): són conjunts sencers (guia, laterals de calaix, fronts) i els forats de la
  guia al lateral depenen de la llargada i del sistema (InnoTech, ArciTech, AvanTech): cal la regla (la del motor
  `slide`: 1r forat a `frontOffset`, 2n a `secondOffset`) i triar del conjunt quin sòlid és la guia. Ara s'importen com
  a només 3D.
- **Punts de connexió**: només es desen. Podrien dir la posició de la frontissa respecte a la placa i el lateral (el
  «Mittelseiten» mou un punt 9,5 mm): serviria per comprovar l'encavalcament i el «Topfabstand» del fabricant.
- **Taules de muntatge** (`dxf_einbau`, PDF): «Topfabstand», gruixos i encavalcament per a cada combinació; ara la
  distància de la cassoleta (`cupOffset`) i la placa són les de l'usuari.
- Frontisses de vidre i d'alumini (sense forats a la porta) i el `bom`. Blum: vegeu §10 (pendents).
- **Ampliar (§6)**: els plànols de muntatge per família que no nomenen cap article (la majoria de `dxf_einbau` i dels
  exemples d'aplicació, p. ex. `Intermat_9936_B125_KB_2d/…`) no s'adjunten (caldria saber quin tipus de frontissa és
  cada article; el STEP no ho diu). Un 3D ja fet no es torna a fer amb un STEP nou (si el fitxer del fabricant canviés la
  forma, caldria esborrar-lo i tornar-lo a importar). Els importats d'abans de `proposedParams` amb el Ø, la fondària o
  la distància editats i confirmats poden mostrar una «proposta nova» que només és la del fitxer (es descarta).
- **Només 2D**: sense el STEP (ni IGES ni 3DS) no hi ha caixa ni 3D; la miniatura és la vista frontal del DXF.

## 10. Blum (E-SERVICES): STEP + «Esquemas de taladrado» en Xilog

> Les dades CAM de Blum són **per producte** («la posició correcta sobre les peces de fusta s'ha de fer manualment»,
> diu E-SERVICES): el programa diu els forats des del punt de referència del producte, no on va a la peça. Per això un
> article de Blum entra com un ferratge **que es col·loca a mà** (§8) amb els mecanitzats **exactes** del programa.

### Què es baixa

[E-SERVICES](https://e-services.blum.com) › Catàleg de productes › **Búsqueda individual de producte** › el producte ›
«Detalles de producto»:
- **Producte individual (3D)**: el **STEP** (i, si es vol, el `.dae`; el `.dxf` de Blum és un sòlid 3D ACIS que no es
  llegeix).
- **Esquemas de taladrado**: tria **`*.pgm` Xilog (SCM)** (el format de la màquina del taller) i «Descarga». Els altres
  (`*.fmc` IMA, `*.hop` Biesse, `*.mpr` woodWOP, `*.tcn` Felder) no es llegeixen.

Es baixen com a fitxers solts `<article>_<id del document de 8 xifres>[_R|_L].<ext>` (`71T453T_46020103.step`,
`48N0510.02_41302774_R.pgm`) o en un **ZIP amb el nom del producte** en castellà («Placa soporte TIP-ON para puertas,
Versión corta, recto, Tornillos.zip», amb els fitxers a dins amb un espai al davant). Es deixen anar tal qual (fitxers,
carpeta o ZIP, també barrejats amb els de Hettich) a «Importar del fabricant».

### Com es fa servir (`core/model/makers/blum.ts`, `makers.ts`, `xilogPgm.ts`)

- **Fabricant** (`detectMaker`): un nom `<article>_<8 xifres>` amb alguna lletra o punt a l'article és de Blum (els de
  Hettich són només xifres). **Article** (`blumFileInfo`): sense l'id del document ni la mà; el ZIP repetit del
  navegador (« (1)») i el mateix fitxer dues vegades compten un sol cop. **Producte**: la carpeta (el ZIP) que en sembla
  un (`blumProduct`: paraules de Blum —AVENTOS, CLIP, MOVENTO, TANDEM, LEGRABOX, TIP-ON…— o un nom de tres paraules o
  més), en NFC (els noms del Mac arriben descompostos).
- **Mans** (`_R`/`_L`): **un item per article**. Dues mans amb articles diferents (`48N0510.02_…_R`, `48N0510.03_…_L`)
  són dos items amb la mà al nom («· dreta», «· esquerra»). Si un mateix article porta tots dos programes, es fa servir
  el dret i l'altre es diu a les notes (l'altra mà és el mirall; pendent).
- **Què és** (`classifyBlum`): pel **nom del producte** (castellà, anglès o alemany) i, si no n'hi ha, pel **prefix de
  l'article**:

  | Producte / prefix | Categoria · sèrie | Peça dels forats |
  |---|---|---|
  | «bisagra», «CLIP top», INSERTA · `70T`–`79T` | Frontisses · CLIP top | porta |
  | «Placa…», «plate», «Montageplatte» · `173L`/`174L`/`175L`/`175H` | Plaques · CLIP (TIP-ON → Obertura per pressió) | lateral |
  | AVENTOS, «compás abatible» · `2` + generació + família: `20K1` HK-XS, `20K2` HK-S, `22K`/`24K` HK top, `20F`/`21F` HF, `22F` HF top, `20S` HS, `22S` HS top, `20L`/`21L` HL, `22L` HL top | Elevables i abatibles · AVENTOS HK-XS, HF top… | lateral (la fixació frontal, porta) |
  | «guía», MOVENTO, TANDEM(BOX), LEGRABOX, METABOX, SPACE STEP · `55x`/`56x` TANDEM, `75x` LEGRABOX, `76x` MOVENTO, `32x` METABOX, `35x`–`37x` TANDEMBOX | Guies · la marca | lateral |
  | TIP-ON, SERVO-DRIVE · `956` | Obertura per pressió · TIP-ON | lateral (placa) o per triar |
  | CABLOXX, REVEGO, accessoris · `800…` REVEGO, `Z…` | Altres · la marca o «Accessoris» | **per triar** |
  | cap | Altres · «Ferratge» | **per triar** |

  Prefixos (`BLUM_PREFIXES`): els confirmats per un nom de producte de les descàrregues són 22F (HF top), 21F (HF),
  750/753 (LEGRABOX), 760 (MOVENTO), 320K (METABOX), 956 (TIP-ON) i 800A (REVEGO); la resta (20K1 HK-XS, 20K2 HK-S,
  22K/24K HK top, HS, HL, TANDEM, TANDEMBOX) són **hipòtesis** del coneixement de Blum. Si el producte només diu
  «AVENTOS» (sense família) o no es reconeix, mana el prefix. Una carpeta que només diu la marca («blum», «Descàrregues
  de Blum») **no és un producte** (abans feia «Accessori Accessoris · 20K1101T» a «Altres»).

  Nom «<nom> <sèrie> · <article>» (la sèrie no es posa si repeteix el nom: «Accessori · ZF7N70T2», mai «Accessori
  Accessoris»; els noms automàtics d'abans es corregeixen en llegir les preferències, `migrateBlumItem`, i si eren a
  «Altres» passen a la seva categoria; un nom canviat per l'usuari es queda) («Frontissa CLIP top · 71T453T», «Placa TIP-ON · 956.1201», «Guia LEGRABOX ·
  750.4501T»); la sèrie fa el subgrup de la biblioteca (`blumSeries`, `itemSeries`).
- **El programa Xilog** (`readXilog`, pur, mai llança): el `.pgm` és un contenidor binari (`BMB`, «Xilog3-9.0», taules)
  amb els **registres en ASCII** acabats en NUL (`H DX=200 DY=100 DZ=19 …`, `XBO X=0 Y=-16 Z=-6 x=0 y=0 D=10 R=1# F=1 …`,
  `N X=0 Y=0`); també es llegeix un programa en text. **Hipòtesis** (cap manual del Xilog3 a mà; contrastades amb els
  programes de Blum i el manual de Xilog Plus): `H` = peça de treball (Blum hi posa una de mostra de 200 × 100 × 19);
  `XBO` = forat a (X, Y) des del **punt de referència del producte**, `Z` negatiu = fondària (`Z ≤ −DZ` → passant),
  `D` = Ø, `F` = cara (1 = **cara A**; 2 dreta, 3 esquerra, 4 davant, 5 darrere = **cantells**, la fondària `|Z|`;
  6 = cara B), `R` = nombre total de forats amb el pas `x`, `y`. Els fresats (`XG0`, `XL2P`, `XA2P`…) i els registres
  desconeguts no es llegeixen: es compten i surten a les notes («entra'ls a mà»).
- **Mecanitzats exactes** (`machiningFromXilog`): cada forat és una operació del generador (§8) de la peça de la taula,
  **X → eix P, Y → eix Q** de la peça, des del punt de referència. Com les capes d'un DXF del taller, **manen**: un
  article de Blum mai fa servir les regles automàtiques de Hettich (cassoleta, placa aparellada): entra com a motor
  `model` amb aquests mecanitzats i **es col·loca a mà** (Editor › mòdul › «Ferratges»; «Mecanitzats de» tria el grup:
  els de la «porta» d'una CLIP es poden posar al lateral si cal). **Sense confirmar, cap forat.**
- **Peça per triar** (`part: "any"`, «Sense assignar»): quan no se sap a quina peça va, els mecanitzats van al grup
  «Sense assignar» del generador; s'hi poden col·locar, però **no es confirma** fins que s'assignen a una peça
  («Assignar a», `reassignMachining`; `confirmProblem`).
- **Caixa = model** (`meshesFrameBox`, `meshToFrame`; Blum i Hettich): la caixa (cotes de l'editor, contorn de
  selecció, zona per clicar, càmera de la miniatura) es fa de **la mateixa malla d'OpenCascade passada al mateix marc
  que el GLB**. Abans sortia dels punts del STEP (`CARTESIAN_POINT`): als conjunts (20K1101T, 71T453T) són a les
  coordenades de cada peça, sense la seva posició al conjunt (que OpenCascade sí que aplica a la malla), i hi ha punts de
  construcció fora del sòlid: la caixa de 20K1101T era 20 × 183 × 153 mm i el model fa 20 × 174 × 110, desplaçat. Els
  importats d'abans (`imported.boxVersion` < `IMPORT_BOX_VERSION`) refan la caixa **del GLB desat** en obrir l'app
  (`hardwareBoxes.ts`; el GLB ja era bo). Test: `meshBox.roundtrip.test.ts` (`HETTICH_DIR`, `BLUM_DIR`).
- **3D**: el STEP (tots els d'un joc, un sol GLB); si no n'hi ha, el `.dae` (`ColladaLoader`, la unitat del fitxer a mm,
  sense el gir de Z amunt) i, si tampoc, un `.glb`/`.gltf` (`GLTFLoader`, metres a mm). Sense 3D, només els mecanitzats
  («sense 3D»).
- **Fitxers solts barrejats**: Blum els baixa d'un en un; «Triar fitxers…» n'accepta molts alhora de qualsevol tipus que
  llegeixi l'importador. **Una sola taula de formats** (`core/import/formats.ts`, `IMPORT_FORMATS`) fa el classificador
  (`hettichFileKind`, `importFileKind`) i l'`accept` del selector (`IMPORT_ACCEPT`, amb els tipus MIME: el diàleg del Mac
  deixava el `.dae` en gris), així no poden divergir; els que es llisten però no es llegeixen (DWG, SAT, MAX, `*.mpr`,
  `*.fmc`/`*.hop`/`*.tcn`) també hi són i surten amb la nota. Test `formats.test.ts`.
- **Tornar a importar**: com Hettich (§6), clau **Blum + article**: un `.pgm` nou és «mecanitzats exactes (Xilog)»; un
  item confirmat no es toca (va a `imported.update.machining`).
- **El diàleg**: el fabricant a cada fila i a dalt («Blum · 51 articles en 198 fitxers · 8 amb mecanitzats exactes
  (Xilog) i 43 només 3D…»), les fonts (STEP · PGM (Xilog) · DAE · DXF 3D, les que no es llegeixen més clares), el filtre
  «Mecanitzats exactes» i què se'n farà («Mecanitzats exactes (Xilog) · porta / front», «… · peça per triar · sense 3D»).

Resultats amb les descàrregues reals (`blum.roundtrip.test.ts`, `BLUM_DIR`): els 9 `.pgm` es llegeixen sencers (Xilog3-9.0,
200 × 100 × 19, cap registre desconegut); 51 articles dels fitxers solts i els 28 ZIP; 71T453T → dues espigues **Ø10 × 6 a
±16** a la porta; confirmat i col·locat al lateral esquerre, el DXF del moble porta els dos cercles a `DRILL_D10_P6` a 32 mm;
48N0510.02 (_R) i 48N0510.03 (_L) → dos forats Ø2,5 × 3 a 0 i −32, sense assignar. Proves sintètiques: `xilogPgm.test.ts`
(binari com el de Blum, text, passants, repeticions, cantells, cara B, fresats, brossa) i `blum.test.ts` (noms, producte,
classificació, agrupar, Hettich + Blum al mateix lot, PDF per sèrie, IGES i 3DS). IGES i 3DS de Hettich:
`hettich3.roundtrip.test.ts` (`HETTICH3_DIR` amb `IGES_Griffe.zip` i `3DS_Griffe.zip`).

**Pendent (Blum)**: `*.mpr` woodWOP (macros `BO` de forat; no fet, cap mostra), les regles automàtiques per a les CLIP top
(cassoleta a la filera, placa aparellada) amb els forats del programa, el mirall automàtic de l'altra mà, els fresats del
Xilog (`XG0`/`XL2P`/`XA2P` → ranures i contorns), confirmar la numeració de cares dels forats de cantell amb un programa
real, i els PDF de Blum («Explicación de los nombres de los ficheros»).

## 11. El lloc de cada ferratge («Què és»), el marc de muntatge i la col·locació a mà mínima

> Decisió de l'usuari: la col·locació a mà era massa complicada; el 3D d'un col·locat no era on tocava i no es podia
> orientar; una frontissa importada «s'hauria de substituir pel paramètric que ja tenim»; «el 3D hauria d'entrar tal com
> es veuria col·locat a la realitat»; fora la barra flotant del 3D; la configuració del ferratge va al ferratge.

**Un ferratge importat té un lloc** (`HardwareItem.engine`, «Què és» a l'editor; `HARDWARE_ROLES` a
`core/model/hardware.ts`): frontissa (`cup`), placa de frontissa (`plate`), tirador (`barHandle`), guia de calaix
(`slide`), braç d'abatible (`flapArm`), pota (`leg`), imant (`magnet`), espiga (`dowel`), filera System 32 (`system32`)
o **«només 3D»** (`model`, cap regla). El lloc el posen les **regles de sempre** del mòdul (`buildModule`: cassoletes a
la filera, placa al lateral, tirador al front, potes a la base…): **cap col·locació a mà** per als ferratges d'un lloc.
Els números del lloc (Ø i fondària de la cassoleta, distància al cantell, cargols, placa aparellada; `setback` i forats
de la placa; distància i Ø del tirador; patró de la pota) són **a l'item** (`params`, `targets`, `pitch`, `count`),
prefilats de la proposta del STEP quan n'hi ha, editables a l'editor, i es confirmen com fins ara.

- **Importar** (`proposeArticle`, `importItem.ts`): la carpeta del fabricant diu què és; si el STEP no en dona el patró
  (`proposeHinge` sense cassoleta, placa sense parell…), la proposta és **parcial** (`partialProposal`: el tipus, cap
  forat, el marc per defecte) i l'item surt **del tipus que toca amb els números per defecte** (la frontissa d'inici, el
  tirador d'inici, placa i pota sense forats), sense confirmar, «mides per omplir»: mai «només 3D» per un patró que no
  s'ha trobat. (La cassoleta Ø26 —r 13— sempre s'havia acceptat als cilindres del STEP: Ø25–41; els 72966/72965/72959/77725
  surten frontisses Ø26 × 11–12 amb els cargols Ø4 o les espigues Ø8 a ±19 / 8.)
- **Blum** (`groupBlum`): una frontissa, placa, tirador o pota amb 3D va al seu lloc (`kind` hinge/plate/handle/leg); el
  programa Xilog es queda com a mecanitzats del generador, de referència. La resta, «només 3D» (col·locats a mà).
- **Canviar «què és»** a l'editor (`retargetImported`, pur; `features/settings/hardwareReframe.ts`): l'item passa al
  motor triat amb els números i mecanitzats per defecte d'aquell tipus (`proposed` = aquests, sense confirmar); es
  queden la identitat, el model, els fitxers, la caixa i els mecanitzats del generador. Si el tipus té marc (frontissa,
  placa, tirador, pota), el marc i els forats s'**estimen de la malla del GLB desat** i el GLB es refà en aquest marc
  (`applyProposal`).

**Marc de muntatge** (`imported.mountFrame`, `frameFrom`: `step` | `mesh` | `file`; coordenades del fitxer, mm): origen
i eixos `u` (al llarg del cantell), `v` (cap a dins de la peça) i `n` (fora de la cara, cap al cos) amb què es passa el
model al seu lloc (`meshesToGlb`: el GLB desat ja hi és). Frontissa: eix de la cassoleta = `n`, centre a la cara de la
porta = origen, `v` cap als cargols de l'ala (lluny del cantell); placa: cara del lateral, referència, `v` cap al
darrere; tirador: cara de muntatge, origen al mig dels forats, `u` al llarg; pota: la placa. El visor (`fittingMatrix`,
`Panel.fittings`: `x`, `y`, `face`, `v`) posa el GLB amb **la mateixa transformació que el motor fa servir per al lloc**
(cassoleta a `cupOffset` del cantell i a la filera; placa a `plateSetback` del davant del lateral; tirador al front; pota
a la base): el 3D entra tal com es veuria col·locat (tancat; el model no s'articula: amb la porta oberta gira amb ella).
Mirall per a frontisses dreta/esquerra (`v` = ±1 al pla de la porta).

- **Del STEP** (`proposal.ts`): els cilindres (`CYLINDRICAL_SURFACE`) donen la cassoleta, els forats i el marc, com fins
  ara.
- **De la malla** (`core/import/meshFrame.ts`), quan no hi ha el patró als cilindres (conjunts de Blum: la cassoleta no és
  cap cilindre; un item que canvia de «què és» i només té el GLB): tot són **cercles**. Els vèrtexs d'una malla de CAD
  que són en un cilindre cauen exactament en un cercle del pla perpendicular al seu eix, i els de la mateixa alçada formen
  un **anell**: per cada eix del fitxer (els models són alineats als eixos), RANSAC dins de cada anell (tres punts del
  mateix cercle), confirmat amb tota la volta, i cada cercle trobat es busca a la resta d'anells (el tram del cilindre).
  Frontissa: el cercle més gros de Ø25–41 amb ≥ 2 anells (fondària ≥ 5) és la cassoleta (eix, centre, fondària; la cara
  és l'extrem del costat del cos); els cercles Ø3–7 a ≤ 45 mm, els cargols o espigues (`v` cap a ells). **Sense cassoleta
  rodona** (CLIP top EXPANDO T 71T453T: cònica), el parell de fixacions iguals a 28–50 mm (els patrons de 32 i de 45) dona
  la cara i el cantell, i la cassoleta es proposa al mig amb Ø35 × 13 per revisar. Placa, tirador, pota: la cara d'on
  neixen els forats petits (l'extrem del seu tram, el pla amb més vèrtexs), `n` cap al cos, origen al mig del parell o al
  centre dels forats. Les notes diuen «marc estimat: comprova'l al 3D». Amb els fitxers reals dona **el mateix marc i els
  mateixos forats** que els cilindres del STEP (Sensys 9071205, Ø26 72966, placa 9071615;
  `meshFrame.roundtrip.test.ts`, `HETTICH_DIR`/`BLUM_DIR`, tessel·lat amb `occt-import-js` al Node).

**Col·locació a mà, mínima** (`HardwarePlacements.tsx`): només els **«només 3D»** (`isPlaceable` = motor `model`), i
només la **peça** i la **posició** per eix (des d'un cantell o del mig + mm). Fora de la UI: repeticions, fórmules,
percentatge, mirall i «Gir del model». El model de dades es queda tolerant (`HardwarePlacementSchema` llegeix i
`hardwarePlace.ts` fabrica igual els d'abans); un col·locat que en fa servir surt a l'inspector com a **«Avançat»**
(`placementAdvanced`), de només lectura, amb **«Simplificar»** (`simplifyPlacement`: una sola posició, la de la primera
còpia d'ara, des de l'inici de l'eix). Al 3D: clicar un col·locat el tria (contorn), **sense barra flotant**
(`FittingToolbar` eliminat); editar, duplicar i eliminar són a la llista de l'inspector. Un ferratge triat o amb el
ratolí a sobre es dibuixa **opac** (només el contorn; la caixa sense model també és opaca) i el triat es veu sencer
encara que «Ferratges» estigui amagat.

Tests: `core/import/slot.test.ts` (proposta parcial, `retargetImported`, `applyProposal`, les regles posen la frontissa
retargetada), `core/import/meshFrame.test.ts` (malles sintètiques) i `meshFrame.roundtrip.test.ts` (fitxers reals),
`features/composition/placements.test.ts` (avançat → simplificar). **Proves d'or idèntiques.**
