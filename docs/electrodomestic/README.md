# Electrodomèstics integrables (dades de catàleg)

Dades d'instal·lació extretes dels catàlegs de fabricant per fer "ferratges electrodomèstics": un mòdul buit que allotja
l'aparell, amb el front muntat com diu el fabricant, el mecanitzat que implica i una foto per al render.

Aquest directori conté les **dades**. **A l'app** (v46, 2026-10-15): cada model és un ferratge de Preferències ›
Ferratges › **Electrodomèstics** (motor `appliance`; `src/core/model/appliances/applianceRows.ts`, generat d'aquest JSON,
i `applianceCatalog.ts`) i es tria a cada compartiment (Electrodomèstic). Què en fa la construcció:
[`docs/funcional/model.md`](../funcional/model.md) › Electrodomèstic del compartiment i
[`docs/funcional/fabricacio.md`](../funcional/fabricacio.md) › Electrodomèstics. Si el JSON canvia, cal tornar a fer
`applianceRows.ts` (i, si hi ha models nous, una versió de les preferències que els afegeixi).

Què fa servir l'app de cada camp: el nínxol (`niche`, `tallH` dels forns en columna, `wallH`/`wallD` del microones
penjat, `cabinet` de la campana telescòpica), les alçades i el pes del front, el sòcol, la ventilació (la sortida dels
frigorífics de columna com a retall; l'entrada, avís), els retalls (placa i grup filtrant), les frontisses de la rentadora
i la foto. **No** en fa servir: `drawingDims` (cotes sense etiqueta), la taula `dishwasherRaisedGap` (rentaplats en alt)
ni el pes per alçada de porta de la `weightTable` (només el màxim).

**Hipòtesis de l'app** (per confirmar, paràmetres editables de cada item): les prebroques de la fixació del front a la
porta de l'aparell (4 per front, Ø2 × 10, a 50 dels costats de l'aparell, 40 de dalt i 60 de baix), la guia lliscant del
frigorífic de porta lliscant (3 prebroques centrades a 40 del cantell que obre), la segona frontissa de la WKD28490ES (a
338,6 com la WIW24307ES), el pes del front (tauler de 700 kg/m³) i el sòcol per defecte (100).

## Fonts

Els PDF són locals (no es pugen, `.gitignore`: `docs/electrodomestic/*.pdf`).

| clau | fitxer | pàgines |
| --- | --- | --- |
| `siemens` | `28568295_3_Catalogo_Siemens_2026_interactivo.pdf` (Otoño 2026) | 150 |
| `balay` | `28659371_Catalogo_interactivo_Balay_0526_280426 (1).pdf` (05/2026) | 177 |
| `bosch` | `28671515_Bosch_05-2026_digital_290426.pdf` (05/2026) | 497 |
| `teka` | `CATALOGO-TEKA-SP-WEB-JULIO-2026.pdf` (juliol 2026) | 162 |

**Pàgines**: sempre és l'índex del PDF (1 = primera pàgina del fitxer). El número imprès al peu sol ser un menys
(Bosch, Balay, Teka) o igual (Siemens).

Siemens, Balay i Bosch són el mateix grup (BSH): els dibuixos d'instal·lació i les regles coincideixen; Bosch és el més
còmode (un producte per pàgina). Teka és un altre fabricant amb regles pròpies i menys detall (no dona nínxols de frigorífic).

## `appliances.json`: esquema

Unitats: **mm**, **kg**, **cm²** (ventilació). Un valor que el catàleg no dona és `null` (no s'inventa res).

```
{
  schemaVersion: 1,
  units: { length: "mm", weight: "kg", area: "cm2" },
  pageConvention: "...",
  sources: { <clau>: { file, title, pages } },
  families: [Family],
  models: [Model],
  tables: { dishwasherRaisedGap: {...} }
}
```

- **Rang** `{ min, max }`: qualsevol dels dos pot ser `null` (p. ex. `{ min: 550, max: null }` = "mín. 550").
  Quan el catàleg dona una cota amb tolerància (`560 +8`) es guarda com `{ min: 560, max: 568 }`.
  Les cotes que depenen del moble es guarden com a text: `"1041+S"` (S = gruix/alçada de la part superior del moble),
  `"703+A"` (A = gruix de la base inferior del moble).
- **Family**: `id`, `name`, `category` (`dishwasher` | `fridge` | `oven` | `microwave` | `hob` | `hood` | `laundry`),
  `mount` (`base`, `tall`, `wall_cabinet`, `worktop`...), `niche` (rangs `w`/`h`/`d` + `note`), `doorSystems`,
  `frontHeight`, `plinthHeight`, `frontWeightKg`, `ventilation`, `cutout`, `rules`, `sources: [{ source, page, what? }]`.
  Els camps varien segons la família (només hi ha el que el catàleg dona).
- **Model**: `brand`, `ref`, `family`, `name`, `pdfPage` (fitxa), `drawingPage?` (dibuix d'encastre si és a una altra pàgina),
  `doorSystem` (`sliding` = porta lliscant, `fixed` = porta fixa, `door_on_door`), `appliance` (`w`, `h`, `d` i extres:
  `frontThickness`, `bodyH`, `bodyD`...), `niche`, `front` (alçades, pes, frontisses), `plinth.h`, `cutout`, `cabinet`,
  `ventilation`, `notes`, `image` (camí relatiu a `public/`, o `null`), `source`.
- **tables.dishwasherRaisedGap**: separació D (mm) entre el front del rentaplats i el calaix de sota quan s'instal·la
  en alt (semicolumna). `variants.<chamfer|nochamfer>_<fixed|sliding>.rows[A][B][C] = D` amb A = alçada del nínxol,
  B = gruix del front (16/19/22), C = alçada del sòcol. Cel·la absent = combinació no permesa.
  Font: Balay p146 (taules idèntiques a Siemens p115; Bosch p380 només publica la de porta lliscant).

Fotos: `public/appliances/<marca>-<ref>.webp` (≤ 600 px d'ample, fons blanc, 35 fitxers, ~0,4 MB en total), retallades
de la foto de producte del catàleg. Notes: `bosch-ceg732xb1` és la mateixa foto que el catàleg fa servir per a
`bosch-cbg7341b1`; els frigorífics surten amb la porta oberta (és l'única foto que hi ha); `siemens GI21VAFE0` no en té.

## Famílies i models

| família | models |
| --- | --- |
| `dishwasher_60` | Bosch SMH6YCX02E (lliscant), SMV6ZCX10E (fixa); Siemens SN75ZX17CE (lliscant), SX65ZX17CE (XXL fixa); Balay 3VF6331SA (fixa); Teka DFI 76960 (lliscant), DFI 46740 (fixa) |
| `dishwasher_45` | Bosch SPV4EMX17E (fixa); Balay 3VT5332DA (lliscant); Teka DFI 74860 (lliscant), DFI 44800 (fixa) |
| `fridge_column` | Bosch KIN86ADD0 (fixa), KIN86VSE0 (lliscant), KIR41VFE0 (122,5), GIV11AFE0 (72); Balay 3KID767F (fixa), 3KIE734F (lliscant); Siemens KI81RADD0 (1 porta), GI21VAFE0 (88); Teka RBF 73355 FI (guia lliscant) |
| `fridge_undercounter` | Bosch KUL22VFD0 (fixa); Teka RSF 41160 BU (door to door) |
| `oven_60` | Bosch HBA514ES4; Balay 3HB5821N3; Teka HSB 6250 P |
| `compact_45` | Bosch CBG7341B1, CEG732XB1 (microones 45); Teka HLC 8440 C |
| `microwave_38` | Bosch BFL7221B1 |
| `hob` | Bosch PIE631HC1E; Teka IBC 63010 MSS |
| `hood_telescopic` | Bosch DFS067A51 |
| `hood_integrated` | Bosch DLN57PC60; Teka GFI 63030 |
| `washer_integrated` | Bosch WIW24307ES (rentadora), WKD28490ES (rentadora-assecadora) |

No hi ha nínxols de 158 / 140 / 102 cm en cap dels quatre catàlegs: BSH només té 194, 177,5, 122,5, 88, 82 (sota
taulell) i 72 cm. Assecadores integrables: cap (només de lliure instal·lació). Campanes "decoratives integrables" i
plaques amb extractor: no s'han extret (no són mòdul de moble estàndard).

## Resum per família

### Rentaplats integrable 60 / 45 (`dishwasher_60`, `dishwasher_45`)

- Nínxol BSH: ample 600 (450), alt **815-875** (XXL 86,5: **865-925**), fons **≥ 550**. Aparell 598 (448) x 815-875 x 550.
  Bosch p345/p348/p360, Siemens p108, Balay p140-141.
- Teka: nínxol alt **820-865** (DW8 40 FI: 820-870), fons **≥ 580**, aparell 815 (+50 amb potes). Teka p144.
- Sòcol: porta **lliscant 50-220**, porta **fixa 90-220** (BSH); Teka 90-155 (+50).
- Alçada del front: lliscant 655-765 (XXL 705-815), fixa 655-725 (XXL 705-775). Teka: màx. 800 (sliding) / 720 (fixa).
- Pes del front (BSH, Bosch p378 = Balay p147): 45 cm 2,5-7,5 kg (les dues); 60 cm x 81,5: lliscant 4,5-11, fixa 2,5-8,5;
  60 cm x 86,5: lliscant 4,5-11, fixa 3-10. Porta fixa: accessori del SAT fins a 11,5 kg. Teka: 5-10 / 5-7 (60),
  4-8 / 3,5-5 (45).
- TimeLight (Balay p147): l'alçada màxima del sòcol depèn del nínxol, l'alçada del front i el retranqueig (suma 120 mm);
  no s'ha passat a JSON (només afecta models amb projecció a terra).
- Instal·lació en alt: taula `dishwasherRaisedGap`.

#### Com es munta el front

- El front de moble **es cargola a la porta de l'aparell** (no porta frontisses de moble). La plantilla de muntatge
  i la posició dels cargols venen amb l'aparell: **el catàleg no les dona**.
- **Porta fixa**: front i porta de l'aparell giren junts; el front ha de ser més baix (fins a 725) i el sòcol més alt
  (≥ 90) perquè el cantell inferior no toqui el sòcol en obrir.
- **Porta lliscant** (BSH "puerta deslizante", Teka "Sliding door"): en obrir, el front llisca respecte de la porta de
  l'aparell; permet fronts més alts (fins a 765, Teka 800) i sòcols de només 50.
- Mecanitzat del moble: cap forat de frontissa; el sòcol queda davant (cota 53/100 als dibuixos BSH, sense etiqueta).
  En alt, separació D o aixamfranat a 35° del calaix inferior (taula). Fonts: Bosch p380, Balay p146, Siemens p115.

### Frigorífic de columna (`fridge_column`)

- Nínxols BSH (alt x ample x fons, cm): **177,5 x 56 x 55** (combi i una porta), 194 x 56 x 55, 194 x 71 x 56 (XXL),
  **122,5 x 56 x 55**, **88 x 56 x 55**, **72 x 56 x 55**. Alçada amb tolerància: 1772 +8, 1221 +7, 712 +7.
  Fons recomanat 560 (mín. 550). Alçada màxima del moble 2200. Bosch p414-428, Siemens p130-131, Balay p115-117.
- Dos combis integrables junts: ≥ 150 mm entre ells (Bosch p414, Balay p115).
- Ventilació: **entrada ≥ 200 cm²** (reixeta al sòcol o sòcol retranquejat) i **sortida ≥ 200 cm²** per dalt al darrere
  (retall o reixeta si el moble va a sostre). Bosch p404-405, Balay p105.
- Teka només dona mides d'aparell (RBF 73355 FI: 540 x 1785 x 545) i "integración por guía deslizante"; nínxol `null`.

#### Com es munta el front

- **Porta fixa** (Bosch p404, Balay p105): el front de moble **es fixa a la porta del frigorífic** amb les peces de l'aparell;
  el moble **no porta frontisses**. Alçades: combi superior 1041+S..1065+S, inferior 703+A..727+A, junta entre fronts 4 mm;
  una porta: ≤ 1772+A+S (S = part superior del moble, A = base inferior). Pes màxim (Balay p115, Siemens p130):
  porta 1500-1750 → 22 kg; 720-1400 → 19 kg; combi A1/A2 → 15 kg (frontissa no amortiguada) / 19 kg (amortiguada).
  Bosch KIN86ADD0: 15 + 15 kg, +5 kg amb el suport KSZB0S00 (Bosch p414, p430). Joc lateral X segons gruix i radi del
  front (taula F/R/X, Bosch p427): 16-19 mm → X 2,5; 22 mm amb aresta viva → X 4.
- **Porta lliscant** (Bosch p404, Balay p105): el front **penja de frontisses de moble** (cassoleta al front i base al
  lateral del moble) i s'uneix a la porta de l'aparell amb **guies lliscants**. Admet fronts més pesats. Alçades: superior
  1012+S..1091+S, inferior 677+A..756+A. El catàleg **no diu** quantes frontisses ni on van.
- Mecanitzat: reixeta o retranqueig al sòcol (≥ 200 cm²), retall superior posterior (≥ 200 cm²), base intermèdia quan
  es combinen 122,5 + 72 (Bosch p427). Porta lliscant: forats de cassoleta al front i plaques al lateral.

### Frigorífic sota taulell (`fridge_undercounter`)

- BSH: encastre 82 x 60 x 55, alçada de subestructura 820-900, sòcol 100-180, entrada d'aire ≥ 200 cm², front ≤ 12 kg
  (Bosch p426). Teka RSF 41160 BU: nínxol 600 x 820-870 x 550, sòcol 100-150 (Teka p149).

#### Com es munta el front

- Bosch: porta fixa (front cargolat a la porta de l'aparell, ≤ 12 kg).
- Teka: **"Door to Door"** (porta sobre porta, Teka p80): el front es fixa a la porta de l'aparell. Detall no publicat.
- Mecanitzat: reixeta de ventilació al sòcol.

### Forn 60 (`oven_60`) i compacte 45 (`compact_45`)

- BSH: nínxol **560 (+8) x 600 (+4) sota taulell / 585 (+10) en columna**, fons ≥ 550. Aparell 594 x 595 x 548,
  front 19,5. Espai de connexió 320 x 115. Columna: obertura de ventilació ≥ 20 al darrere de dalt. Sota taulell: cota
  180 a la base posterior i mín. 20. Bosch p48, Balay p29.
- Compacte: 560 (+8) x 450 (+2) en columna (≥ 460 sota taulell), aparell 594 x 455 x 548; ventilació de sòcol ≥ 200 cm².
  Bosch p54, p57.
- Teka: 560-568 x mín. 590 (compacte mín. 450), moble ≥ 580 de fons; obertures 60-100 a dalt i 490 al fons del nínxol
  **només si no és pirolític**. Teka p135.
- Placa a sobre: separació mínima placa-forn 5 mm (inducció/gas) o 2 mm (elèctrica) (Bosch p48).

#### Com es munta el front

- No hi ha front de moble. Mecanitzat: retalls de ventilació del prestatge/fons i, en columna, travessers a l'alçada
  del nínxol. La fixació del forn (cargols pel marc lateral als costats del moble) **no surt al catàleg**.

### Microones 38 (`microwave_38`)

- Columna: 560 (+8) x 380 (+2), fons ≥ 550. Moble penjat: nínxol 362-365, fons ≥ 300, **paret posterior oberta**,
  laterals ≥ 16; el front sobresurt 6 mm (nínxol 362) o 3 mm (365) per dalt i 14 per baix. Bosch p60.
- Teka ML 82: penjat mín. 370 x mín. 568 x mín. 320; columna mín. 380 x fons mín. 550. Teka p135.

### Placa (`hob`)

- Inducció 60 BSH: retall **560 (+2) x 490-500 (+2)**, taulell ≥ 16, ≥ 40 a la paret, ≥ 50 al cantell davanter; ≥ 35
  (taulell 585-600) o ≥ 50 (> 600) als laterals. Calaix a sota: mín. 65 sota el taulell i 20 de ventilació posterior.
  Forn a sota: 30 lliures entre taulell i forn. Bosch p141, p144.
- Teka IBC 63010: aparell 600 x 510 x 54, retall 560 x 490. Teka p138.

#### Com es munta el front

- Retall al taulell (no és un mecanitzat de moble de la CNC). Si hi ha calaix a sota, cal deixar l'espai de ventilació.

### Campana telescòpica (`hood_telescopic`) i grup filtrant (`hood_integrated`)

- Telescòpica 60 Bosch DFS067A51: moble de 600, fons ≥ 300 (recomanat 320), alçada interior ≥ 420; visera de 21 mm.
  Per a 90 cm en moble de 90 cal joc d'esquadres (Bosch p210). Bosch p213.
- Mòdul d'integració Bosch DLN57PC60: retall **496 x 264** a la base del moble (gruix 16-19, ≥ 25 del cantell
  davanter); alçada sobre la placa ≥ 500 (elèctrica) / ≥ 650 (gas). Bosch p218.
- Teka GFI 63030: ala 592 x 320, cos 538 x 305; retall no acotat. Teka p143.

#### Com es munta el front

- Telescòpica: la visera sobresurt per sota de la porta del moble penjat; accessori DSZ4660 per ocultar-la.
  Mecanitzat: forat per al tub (ø 170 al dibuix) al taulell superior del moble i el retall inferior.
- Grup filtrant: retall a la base del moble i forat per al tub (ø 150).

### Rentadora integrable (`washer_integrated`)

- Bosch WIW24307ES: aparell 596 x 818 (+12) x 544 (555 amb frontissa, 574 amb frontissa i front). WKD28490ES:
  820 (+12) x 540. Nínxol **no publicat**. Bosch p301-302.

#### Com es munta el front

- El front de moble **penja de frontisses que es cargolen a l'aparell**: forats de **cassoleta ø 35, mín. 12 de fons, a 21
  del cantell**; primera frontissa a 202 del cantell superior de l'aparell, segona a +338,6; obertura a dreta o esquerra
  (Bosch p301). WKD: front 19-21 de gruix (Bosch p302).

## Preguntes obertes (usuari / taller)

Estat a l'app (2026-10-15): les 1, 2 i 6 tenen una hipòtesi a l'app (avís a cada moble); la 3 i la 5, un avís sense
mecanitzat (entrada d'aire i sòcol de davant de l'aparell); la 4 es resol amb el gruix real de les peces del mòdul; la 7
i la 8, sense fer (Teka RBF sense nínxol: avís; TimeLight fora).

1. **Plantilla del rentaplats** (i de tots els fronts cargolats a la porta de l'aparell): la posició dels cargols i dels
   tacs del front només surt a la plantilla de paper que ve amb l'aparell. Teniu plantilles de BSH i Teka per mesurar-les
   i posar-les a l'app? (Ara: 4 prebroques d'hipòtesi per front.)
2. **Frigorífic porta lliscant**: quantes frontisses de moble i a quina alçada? (el catàleg no ho diu). Quina frontissa
   feu servir (angle, cassoleta 35)?
3. **Ventilació**: preferiu reixeta vista al sòcol o sòcol retranquejat? I a dalt, retall al fons posterior o reixeta?
4. **Valors S i A** (frigorífics): quin gruix de tauler superior i inferior feu servir a les columnes (16 o 19)?
5. Les cotes de rentaplats **53 / 89 / 100** (BSH) i **110 / 48 / 115** (Teka) no estan etiquetades al catàleg:
   les interpretem com a retranqueig i alçada del sòcol / pas de tubs? Cal confirmar-ho amb el manual d'instal·lació.
6. Rentadora: quin nínxol feu servir (600 x 820-880?) i quina alçada de front? El catàleg no ho diu. I la segona frontissa
   de la WKD28490ES (el catàleg només dona la primera, a 202)?
7. Frigorífics Teka: no tenen nínxol publicat. Assumim el mateix que BSH (177,5 x 56 x 55) o es deixen fora?
8. Es vol incloure la taula TimeLight (alçada màxima del sòcol, Balay p147) o no es fan servir aquests models?
9. **Sòcol davant dels aparells de terra**: el fa el mòdul de l'aparell (un tauler com el «Sòcol · Davant de les potes»,
   i a quina retirada: 53 / 100 dels dibuixos BSH?) o el poseu corregut amb els dels mòduls del costat?
10. **Densitat dels fronts** per comprovar el pes que admet l'aparell: 700 kg/m³ (aglomerat / DM) us va bé, o voleu la de
    cada material a Preferències?
11. **Forns**: la fixació (cargols pel marc als laterals del moble) i la ventilació (BSH: obertura ≥ 20 al darrere de
    dalt en columna) no es mecanitzen: les voleu a l'app?
