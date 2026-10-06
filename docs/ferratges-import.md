# Importar ferratges del fabricant (Hettich)

> Objectiu (del germà): «lo important es que després es pugui encaixar al moble per fer el mecanitzat». Un ferratge
> baixat del web del fabricant ha d'acabar fent **els forats bons a les peces bones** del moble. El 3D i els dibuixos
> són per revisar-lo; el que mana és el patró de forats confirmat.

Preferències › Ferratges › **«Importar del fabricant»**. Primer fabricant: **Hettich** (hettich.com › Serveis › Hettich
CAD › [Descàrregues CAD](https://www.hettich.com/es-es/services/hettich-cad/descargas-cad)). Els fitxers del fabricant
**no es copien mai al repo** (llicència d'ús per planificar); l'app els llegeix al navegador i en desa el que cal a
Dexie, com els models 3D de l'usuari.

## 1. Què es baixa de Hettich

Un ZIP per família i format. Dins, carpetes per tipus **en alemany** i un fitxer (o tres vistes) per **número d'article**
(5–7 xifres, el de la referència del catàleg).

| ZIP | Què hi ha | Què en fem |
|---|---|---|
| `STEP_Scharniere.zip` (34 MB, 881 `.stp`) | Un STEP per article (AP203 `CONFIG_CONTROL_DESIGN` o AP214), mm, la majoria d'un sol sòlid; ~150 són conjunts amb transformacions | **Forats** (cilindres) i **3D** (OpenCascade → GLB) |
| `DWG_DXF_Scharniere.zip` (122 MB, ~4400 fitxers) | Per article: `<art>_2D_front_view.dxf`, `_2D_side_view`, `_2D_top_view` (línies, arcs, cercles, polilínies 3D i 3 `POINT` a la capa `CONNECTIONPOINTS`, majúscules o minúscules) i `<art>_3D.dxf`/`.dwg` (un `3DSOLID` ACIS) | Les tres vistes 2D es dibuixen a l'editor; la que mira la cara de la peça es posa sota els forats. El 3D ACIS i els DWG s'ignoren |
| `3DS_Scharniere.zip` | `.3ds` | No (el 3D surt del STEP) |
| `dxf_einbau.zip` | Seccions de muntatge acotades (DXF + PDF) per família (no per article) | No: documentació per a l'usuari |
| `Anschlagloesungen_2D_Sensys.zip` | Exemples d'aplicació (seccions) | No |
| `STEP_Schubkastensysteme.zip` (271 MB) | Calaixos i guies (conjunts sencers: guies, laterals, fronts, accessoris) | Es llisten com a «Calaix o guia» però **encara no s'importen** (§6) |

Carpetes → categories de l'app (`classifyHettich`, `core/import/hettich.ts`):

| Carpeta | Categoria | Etiquetes / nom |
|---|---|---|
| `Scharniere/Sensys`, `Intermat`, `Eingelenkscharniere/Scharniere`, `Winkelscharniere`, `Novisys`, `Veosys`… | **Frontisses** (`hinge`) | `aufliegend` → recobrent · `aufliegend-Mittelseiten` / `halb_vorliegend` → mig recobrent · `einliegend` → encastat · `Oeffnungswinkel_110` → 110° · `Innenwinkel_120_W30` → angle 30° |
| `…_Glas`, `Glastuerscharniere` | Frontisses, etiqueta `vidre` | «Frontissa de vidre» |
| `Alurahmen-Scharniere` | Frontisses, etiqueta `alumini` | «Frontissa per a marc d'alumini» |
| `Montageplatten/System_8099/…` | **Plaques de frontissa** (`plate`) | `Mit_vor_Euroschrauben` → amb cargols euro · `Zum_Einpressen` → per pressió (espigues) · `Zum_Anschrauben` → per cargolar… |
| `Zubehoer`, `Scharniertoepfe` (cassoletes soltes), `Moebelbaender` | Altres (`misc`) | no s'importen |
| `Push_to_open…` | Push | no s'importen |
| `Schubkastensysteme/…` | Guies (`slide`) | no s'importen |

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
- **Placa** (`proposePlate`): els forats sencers de Ø2–Ø12 paral·lels entre ells a prop de l'origen (la referència de
  Hettich: a la filera, al mig de la placa). Els **traus** (forats allargats fets de dos semicercles i un tros, com els
  de les plaques amb cargols euro) es tornen un forat al centre. `n` = fora del lateral (el cos de la placa; amb
  espigues, al costat contrari d'on surten), `u` = la línia dels forats (amunt/avall), `v` = fondària (cap al darrere).
  Cargols euro: Ø5 × 12 (el System 32); espigues: la fondària del model (Ø10 × 11,5).
- **Broques** (`snapDrill`): a la més propera de 35, 26, 20, 15, 10, 8, 5, 4, 3, 2,5 (±12 %); un forat de pas una mica
  més ample (Ø5,25 o Ø5,7 d'un cargol de 5) va a la de sota. **Fondàries**: del tram dins de la peça arrodonit amunt al
  mig mil·límetre (cassoleta 12,8 → 13); si no n'hi ha, la de la categoria (cargol d'ala 10, cargol de placa 12).

Resultats amb les descàrregues reals (`hettich.roundtrip.test.ts`): Sensys 110° recobrent 9071205 → cassoleta Ø35 × 13
i cargols Ø5 a ±26 / 5,5; Sensys d'angle W30 9085166 → igual al pla de la porta; placa 8099 per pressió 9071615 →
espigues Ø10 × 11,5 a ±16; placa amb cargols euro 9071620 → Ø5 × 12 a ±16. De tot el ZIP: 472 de 554 frontisses i 210
de 219 plaques donen una proposta (les que no: sense cassoleta reconeixible, de vidre o d'alumini de pinça…).

El 3D: **OpenCascade** (`occt-import-js`, WASM de ~7,6 MB) en un worker (`components/viewer/occtWorker.ts`), només en
importar; `stepMesh.ts` passa la malla al marc del ferratge (m) i en fa un GLB (`GLTFExporter`, normals de les cares).
Una frontissa Sensys són ~1.800 triangles (~70 kB de GLB).

## 3. Les vistes 2D (DXF)

Lector propi (`core/import/dxf.ts`): `LINE`, `ARC`, `CIRCLE`, `LWPOLYLINE` i `POLYLINE` (2D amb bulge, 3D), `ELLIPSE`,
`SPLINE` (de Boor), `POINT`, `INSERT` (escala, gir, blocs niats, la capa «0» hereta la de l'INSERT), extrusió (eix
arbitrari) i `$INSUNITS` (0 = mm, com els de Hettich). Cotes, textos, ombrejats i sòlids s'ignoren. Es desen
simplificades (Douglas–Peucker 0,02 mm, centèsimes: unes desenes de kB per vista). Cada vista es **registra**
(`registerView`): de les 8 orientacions d'eixos, la que fa caure els seus cercles sobre els forats proposats (error mitjà
< 0,5 mm). A les frontisses, la frontal hi encaixa i l'editor la posa de fons sota els forats; a les plaques sovint no
(els forats hi són traus). Els `CONNECTIONPOINTS` (tres punts per vista, els mateixos girats a cada vista) es desen tal
com venen a l'item (`imported.points`); de moment no fan res (vegeu §6).

## 4. Model de dades (preferències v20, additiu)

`HardwareItem` (`core/model/hardware.ts`):
- `imported`: `maker`, `article`, `folders` (alemany, com venen), `files`, `asset` (id `hwa-…` de la taula Dexie
  `hardwareAssets`, **v6**: el GLB i les vistes; no viatja amb les còpies dels mòduls ni al `.moble`), `bbox` (marc del
  ferratge), `points`, `proposed` (els mecanitzats tal com es van llegir), `notes` i **`confirmed`**.
- Frontisses: el motor de sempre (`cup`). Target `door`: la cassoleta (`v = cupOffset`, Ø i fondària = `cupDiameter`,
  `cupDepth`) i els cargols o espigues amb `v = "cupOffset±x"` (relatius al centre de la cassoleta, tags `hinge-screw` /
  `hinge-dowel`). La quantitat per alçada, els extrems, la separació i `cupOffset` («distància de la cassoleta», «Al
  cantell» a Mides) es copien de la frontissa per defecte.
- Placa aparellada: `plate` (`id`, nom, model) i el target `side` amb els forats de la placa copiats, i
  `params.plateSetback` (del cantell de davant del lateral a la referència de la placa, 37 = filera System 32) i
  `plateOffset` (alçada de la referència respecte al centre de la cassoleta, 0).
- Plaques: motor nou `plate` (sense lloc del mòdul: només s'aparellen), `params.setback` i `offset`, target `side`.
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
la còpia d'abans (`replaceHardwareEverywhere`). Editar els forats d'un importat el torna a deixar sense confirmar.

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
confirmar, res; placa euro = forats del System 32; porta girada), `core/import/*.test.ts` (fitxers sintètics) i
`hettich.roundtrip.test.ts` (`HETTICH_DIR=<carpeta amb els ZIP> pnpm exec vitest run src/core/import/hettich.roundtrip.test.ts`;
se salta sense la carpeta). **Proves d'or idèntiques.**

## 6. Pendent

- **Guies i calaixos** (`Schubkastensysteme`): són conjunts sencers (guia, laterals de calaix, fronts) i els forats de la
  guia al lateral depenen de la llargada i del sistema (InnoTech, ArciTech, AvanTech): cal la regla (la del motor
  `slide`: 1r forat a `frontOffset`, 2n a `secondOffset`) i triar del conjunt quin sòlid és la guia. Es llisten però no
  s'importen.
- **Punts de connexió**: només es desen. Podrien dir la posició de la frontissa respecte a la placa i el lateral (el
  «Mittelseiten» mou un punt 9,5 mm): serviria per comprovar l'encavalcament i el «Topfabstand» del fabricant.
- **Taules de muntatge** (`dxf_einbau`, PDF): «Topfabstand», gruixos i encavalcament per a cada combinació; ara la
  distància de la cassoleta (`cupOffset`) i la placa són les de l'usuari.
- Fronts encastats: la placa va a `plateSetback` del davant del lateral (37 per defecte); amb portes encastades cal
  sumar-hi el gruix del front a mà.
- Altres fabricants (Blum: BXF/CAD), frontisses de vidre i d'alumini (sense forats a la porta) i el `bom`.
