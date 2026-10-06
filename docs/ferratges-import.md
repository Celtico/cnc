# Importar ferratges del fabricant (Hettich)

> Objectiu (del germà): «lo important es que després es pugui encaixar al moble per fer el mecanitzat». Un ferratge
> baixat del web del fabricant ha d'acabar fent **els forats bons a les peces bones** del moble. El 3D i els dibuixos
> són per revisar-lo; el que mana és el patró de forats confirmat.

Preferències › Ferratges › **«Importar del fabricant»**. Primer fabricant: **Hettich** (frontisses, plaques, tiradors,
potes i, com a «només 3D», la resta) (hettich.com › Serveis › Hettich
CAD › [Descàrregues CAD](https://www.hettich.com/es-es/services/hettich-cad/descargas-cad)). Els fitxers del fabricant
**no es copien mai al repo** (llicència d'ús per planificar); l'app els llegeix al navegador i en desa el que cal a
Dexie, com els models 3D de l'usuari.

## 1. Què es baixa de Hettich

Un ZIP per família i format. Dins, carpetes per tipus **en alemany** i un fitxer (o tres vistes) per **número d'article**
(5–7 xifres, el de la referència del catàleg).

| ZIP | Què hi ha | Què en fem |
|---|---|---|
| `STEP_Scharniere.zip` (34 MB, 881 `.stp`) | Un STEP per article (AP203 `CONFIG_CONTROL_DESIGN` o AP214), mm, la majoria d'un sol sòlid; ~150 són conjunts amb transformacions | **Forats** (cilindres) i **3D** (OpenCascade → GLB) |
| `DWG_DXF_Scharniere.zip` (122 MB, ~4400 fitxers), `DWG_DXF_Griffe.zip`, `DWG_DXF_Schiebetuersysteme.zip`… | Per article: `<art>_2D_front_view.dxf`, `_2D_side_view`, `_2D_top_view` (línies, arcs, cercles, polilínies 3D i 3 `POINT` a la capa `CONNECTIONPOINTS`, majúscules o minúscules) i `<art>_3D.dxf`/`.dwg` (un `3DSOLID` ACIS) | Les tres vistes 2D es dibuixen a l'editor; la que mira la cara de la peça es posa sota els forats. El 3D ACIS i els DWG s'ignoren. **Sense el STEP, l'article entra «només 2D»** (§6) |
| `3DS_Scharniere.zip` | `.3ds` | No (el 3D surt del STEP) |
| `dxf_einbau.zip` | Seccions de muntatge acotades (DXF + PDF) per família; les de `Zubehoer/<art>_KB_2d/` nomenen articles al nom (`…_79349_79350_9072231.dxf`) | **Plànols de muntatge**: s'adjunten als articles que nomenen (§6) |
| `Anschlagloesungen_2D_Sensys.zip` | Exemples d'aplicació (seccions) | Igual, si nomenen algun article (la majoria no: no s'adjunten) |
| `STEP_Schubkastensysteme.zip` (271 MB) | Calaixos i guies (conjunts sencers: guies, laterals, fronts, accessoris) | «Calaix o guia», **només 3D** (§8) |
| `STEP_Griffe.zip` (10 MB, 765 `.stp`) | Tiradors i poms per família (`Classic`, `Deluxe`, `Folk`, `Modern`, `Natural`, `New_Modern`, `Organic`, `Touch_In`, `Exclusive_Designgriffe`) i `Zubehoer` | **Tiradors**: la distància entre forats del STEP (§2) |
| `STEP_Tischgestelle_-beine_Moebelfuesse_Tischausziehfuehrungen.zip` (5 MB) | Potes (`Aluminium_Moebelfuesse`, `Stahl_Moebelfuesse`, `Tischbeine_Moebelfuesse`), estructures de taula (`Change`, `LegaDrive`, `LegaMove`, `Steelforce/…`), guies de taula (`Trimanis`), electrònica i accessoris | **Potes**: forats de la placa (§2); la resta, només 3D |
| `STEP_Cadro_Aluminiumrahmensystem.zip` (0,7 MB, 70) | Marc d'alumini per a portes de vidre | Només 3D (§8) |
| `STEP_Schiebetuersysteme.zip` (94 MB, ~940) · `STEP_Falttuersysteme.zip` (22 MB, ~170) | Portes corredisses (perfils, carros, guies) i plegables (WingLine) | Només 3D (§8) |

**Tot es pot importar**: el que no té cap regla de mecanitzat a l'app, o del qual no es troba el patró de forats, entra com
a **«només 3D»** (motor `model`): el model (GLB) i el volum, **mai cap forat**. Sense STEP però amb les vistes DXF, entra
**«només 2D»** (motor `model` sense caixa ni 3D: les vistes i els punts de connexió) fins que s'hi afegeix el STEP (§6).
Només el 3D DWG/DXF o el 3DS sols no es poden importar.

**Carpetes i nom** (`core/import/hettichNames.ts`, sense dependències del model: també el fa servir la lectura de les
preferències). De cada camí només compten les carpetes de l'article (`cleanFolders`): fora la carpeta de l'usuari
(«ferratges», on hi ha els ZIP), la del ZIP o de format (`STEP_…`, `DWG_DXF_…`, `3DS_…`, `dxf_einbau`) i tot el que hi ha
abans de la família; el mateix article des del STEP i des del DWG/DXF dona les mateixes carpetes. Nom
(`hettichLabel`): **«<nom en català> <sèrie> · <article>»** («Porta corredissa SlideLine 55 · 9060402», «Frontissa Sensys
110° · 9071205», «Pota d'acer · 1225», «Tirador Classic · 115001»): com a molt dues paraules de carpeta, sense les que ja
diu el nom ni les etiquetes (recobrent, encastat), la sèrie en alemany com al catàleg. **Sèrie** (`hettichSeries`,
`itemSeries`): la carpeta de després de la família («Sensys», «Classic», «SlideLine 55», «System 8099»; les genèriques
en català: «Acer», «D'angle», «Accessoris»…), per agrupar la biblioteca (§7).

Carpetes → categories de l'app (`classifyHettich`, `core/import/hettichNames.ts`):

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

El 3D: **OpenCascade** (`occt-import-js`, WASM de ~7,6 MB) en un worker (`components/viewer/occtWorker.ts`), només en
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
com venen a l'item (`imported.points`); de moment no fan res (vegeu §8).

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

## 8. Pendent

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
- Altres fabricants (Blum: BXF/CAD), frontisses de vidre i d'alumini (sense forats a la porta) i el `bom`.
- **Ampliar (§6)**: els plànols de muntatge per família que no nomenen cap article (la majoria de `dxf_einbau` i dels
  exemples d'aplicació, p. ex. `Intermat_9936_B125_KB_2d/…`) no s'adjunten (caldria saber quin tipus de frontissa és
  cada article; el STEP no ho diu). Un 3D ja fet no es torna a fer amb un STEP nou (si el fitxer del fabricant canviés la
  forma, caldria esborrar-lo i tornar-lo a importar). Els importats d'abans de `proposedParams` amb el Ø, la fondària o
  la distància editats i confirmats poden mostrar una «proposta nova» que només és la del fitxer (es descarta).
- **Només 2D**: sense el STEP no hi ha caixa ni 3D; la miniatura és la vista frontal del DXF. Un `.3ds` podria donar el
  3D (sense forats), però no es llegeix.
