# Jocs de ferratges paramètrics («jocs»)

Un **joc** (`HardwareKit`, `core/model/hardwareKit.ts`) és un sistema sencer del fabricant llegit del **catàleg en PDF**, no
d'un STEP: els seus components amb els números d'article, les opcions, les regles per triar-lo, les **peces de fusta que
demana** (amb fórmules) i els **mecanitzats** que fa a les peces del moble. És el camí principal per als ferratges a partir
d'ara; la importació de STEP/DXF del fabricant (`ferratges-import.md`) continua funcionant per als articles solts.

**Adaptació paramètrica doble**: el joc s'adapta al moble (la llargada nominal NL per la fondària interior, l'estabilitzador
i la barra de sincronització per l'amplada KB) i la fusta s'adapta al joc (el fons A i el darrere B surten de les fórmules
del catàleg; **no hi ha laterals de fusta** en un calaix de doble paret).

El primer joc (la prova) és el calaix de doble paret **DTC MAGIC-PRO HT11**, alçada **M** (lateral de 88); hi són també
l'HT10 N (62,5), l'HT12 K (126), l'HT13 C (174) i l'HT14 F (238), que tenen la mateixa estructura al catàleg
(`core/model/kits/dtcMagicPro.ts`, amb les pàgines citades al comentari de dalt). Del **catàleg DTC 2026**
(`docs/2026 DTC Home and Furniture Fittings Catalogue.pdf`, 374 pàgines dobles; el MAGIC-PRO hi és a les mateixes pàgines i
amb els mateixos números que al 2024) hi ha també les altres sèries de calaix de doble paret amb front de fusta, vegeu
«Les sèries DTC (catàleg 2026)»: **MAGIC-STAR ULTRA** (HD11–HD14), **DRAGON-PRO** (HB01, HB02, HB03, HB0C, HB04) i
**PURE-PRO HK** (HK11–HK13). Totes surten del mateix constructor de dades, `core/model/kits/dtcDoubleWall.ts`
(`doubleWallKit`): cada sèrie només dona els números, les alçades i les cotes (`DoubleWallSpec`); els components, les
formes 3D i l'ordre són els mateixos per a totes.

## On viu

- El joc va dins d'un `HardwareItem` amb motor **`drawerKit`** (`HardwareItem.kit`), categoria **«Calaixos de doble paret»**
  (`drawer-system`). Així entra a la biblioteca (Preferències › Ferratges), al selector (`HardwareSelect`), a les còpies dels
  mobles (`front.hardware`) i al `.moble` sense cap camí nou. Preferències **v23** (additiu): els jocs inicials s'afegeixen
  a la biblioteca si no hi són (per id).
- Es tria al **calaix**: Front › **Guia** llista les guies i els jocs. Amb un joc, surten **Tancament** (suau · push-open ·
  push + suau), **Darrere** (fusta · metàl·lic) i **Acabat** dels laterals (blanc seda · gris mat · negre mat, els que ven
  cada joc; només el color del 3D, `KIT_FINISHES`, el número és el mateix) (`Front.kit`, `KitOptions`; res amagat compta: amb una guia normal no es
  llegeixen), la fila **Fons** (el gruix que demana el joc, 16: fix, «el joc demana 16 mm») i la fitxa **Joc**: NL triada,
  primeres línies de la comanda i les mides del fons A i del darrere B.
- O al **mòdul**: Mòdul › Acabats › **Guia de calaix** accepta un joc (`slotAccepts`; `slotSpec("slide", joc)` el deixa
  passar amb l'`item` = el joc i el `spec` de la guia d'inici, sense cap avís; `kitFrom` / `fixHardwareDefaults` també, així
  Preferències › Ferratges pot tenir-lo per defecte als mòduls nous). Tots els calaixos del mòdul sense guia pròpia es fan
  amb el joc, exactament igual que triat al front (`buildDrawers` mira `isDrawerKit(item)` de la guia resolta); el front
  hi llegeix les opcions (`visibleZone(kitDefault)`) i el selector diu «El del mòdul (joc de calaix)». Una guia normal
  triada al calaix guanya el joc del mòdul. «Guies de calaix» de l'inspector (`ruleHardwareCounts`) compta també els
  calaixos amb joc (un parell per calaix: fons sense lateral de fusta).
- Els `params` de l'item porten la **prebroca** (`pilotDiameter`, `pilotDepth`; 0 = cap forat) i els `targets` descriuen
  el forat de prebroca de cada peça (`side`, `front`, `back`). Preferències › Regles de mecanitzat ›
  **«Prebroca dels cargols»** (`kitPilot` / `setKitPilot`) els canvia a tots els jocs de la biblioteca alhora.

## Model (`HardwareKitSchema`)

| Camp | Què és |
|---|---|
| `maker`, `series`, `family` | DTC · MAGIC-PRO HT11 · `double-wall-drawer` |
| `heightClass` | codi (N/M/K/C/F), alçada del lateral del calaix, alçada del darrere de fusta |
| `variants[]` | per NL: números del joc complet (`kit`) i de les guies (`slides`) per tancament, joc de laterals (`sideKit`) i les **columnes de cargols** de la guia (`screws.both` a les dues fileres, `screws.top` només a la de dalt), en z des del cantell de davant del lateral |
| `options` | tancaments, darreres i acabats (`finish`, opcional) que es venen |
| `rules` | `depthMargin` (LT = NL + 3), `slideSetback` (3), `baseAboveFront` (38), taula `widths` KB → estabilitzador / barra (0 no · 1 recomanat · 2 molt recomanat), `syncRodCut` per tancament (`LW-167`, `LW-238`), `metalBackSideThickness` (16) |
| `geometry` | on comença el lateral del calaix (`sideBase`) i el fons (`bottomBase`) per sobre de la vora inferior de la guia, gruixos del lateral i de la guia |
| `components[]` | id, nom, costat (`both` = mirall, `center`), `mount` (`cabinet`: fix al moble, com la guia; `drawer`: surt amb el calaix), quantitat, número (`fixed` · `variant` · `byWidth` · `none`), condició `when` (tancament, darrere, regla d'amplada), llargada de tall, `finish` (pren l'acabat triat: els laterals), formes 3D (`box` / `rod`) en coordenades del joc; cada forma pot dir el seu `mount` i `material` (la guia telescòpica és **un sol article** amb el cos fix al moble, `KIT_RAIL_MATERIAL` «Acer fosc», i la corredora que surt sota el lateral, `KIT_RUNNER_MATERIAL` «Acer inox»; totes dues NL) |
| `wood[]` | fons A i darrere B: amplada i fondària/alçada per fórmula, gruix del fons (`TB`) o del tauler (`G`), condició, nota de tolerància |
| `machining` | lateral: fileres de cargols (y); front: forats dels suports a `x` de cada lateral i a les alçades `ys` (mín. del cantell de baix); darrere: cargols dels suports |
| `source`, `photo`, `hypotheses` | pàgines del catàleg, foto retallada (`public/hardware/`), hipòtesis pendents del taller |

**Coordenades del joc** (mm): `x` des de la cara interior del lateral del moble cap a dins (el dret és el mirall), `y`
amunt des de la **vora inferior de la guia**, `z` des de la cara de darrere del front cap al fons. Les fórmules (`Expr`,
`evalExpr`, sense `eval`) tenen `LW` llum interior, `NL`, `KB` (= LW + 2 × 16, com al catàleg), `G` gruix del tauler, `TB`
gruix del fons del calaix, `H` alçada del lateral, `BH` alçada del darrere i `SR` llargada de tall de la barra.

## Construcció (`core/build/drawerKit.ts` + `buildKitDrawers` a `buildModule.ts`)

1. `planKit(item, { LW, depth, G, TB, options })`: tria la **variant** (`chooseVariant`: la NL més gran amb NL + marge ≤
   fondària darrere del front i que es vengui amb el tancament), la **fila d'amplades** (`widthRule`, KB = LW + 32; fora
   de la taula → avís), la barra (tall per fórmula), les **línies de comanda** (`KitOrderLine`: joc complet + cada component
   que toca, amb el número), les **peces de fusta** (`KitWoodSize`) i les **prebroques** (lateral, front, darrere). Avisa si
   el darrere metàl·lic és per a un altre gruix de lateral o si el fons no és de 16.
2. El constructor fa el front de sempre i, per calaix: la vora inferior de la guia a `baseAboveFront` del cantell de baix
   del front (pujada si cal perquè quedi dins de la llum); si el joc no cap en alçada, només el front i avís. **Fusta**:
   fons (material del fons dels calaixos, gruix del joc: 16) sobre la guia del lateral, darrere (tauler del cos) sobre el
   fons al final. **Mecanitzats**: prebroques dels cargols de la guia als **dos laterals del moble** (mirall), dels suports
   de davant al darrere del front (cara A) i dels de darrere al darrere (cara de darrere). **Components** a `extras` com a
   peces de només veure (rol `hardware`, massisses i pintades pel nom del material; ids `drawer-<k>-kit-…`: el visor les
   mou amb el calaix; `kitfix-<k>-kit-…` les formes muntades al moble, el cos de la guia, es queden fixes i `opening.ts`
   n'agafa la NL). El fons: material del fons del moble (o del cos si fa el gruix del joc) i gruix del joc (`TB`, 16): no
   és cap tria del moble, i l'avís `drawer-bottom` només diu si aquest material es ven en 16. La comanda a
   `ModuleBuild.hardwareKits` → `CompositionBuild.hardwareKits` (amb el mòdul).
3. **Tot o res** per calaix: sense NL, sense lateral a un costat o sense alçada → només el front i avís `hardware`.

On surt: **Peces › «Ferratges dels jocs»** (`kitGroups`, calaixos iguals sumats, amb la fusta per calaix; els components no
van a «Elements sense nesting»), el **LLEGEIX-ME** dels programes Maestro (`kitReadmeLines`), l'inspector del calaix, el 3D
(components grisos, mode Per peça «Ferratges»), «Com va muntat» i la miniatura de la targeta (mòdul d'exemple de
450 × (alçada del joc + 140) × 500, càmera des de dins i del darrere), la peça d'exemple (lateral amb les prebroques).

Proves: `core/build/drawerKit.test.ts` (regles, números, pla, construcció, mirall, tot o res, opcions, guia telescòpica i
acabats, el joc com a guia del mòdul, muntatge), la composició fixa `kit-dtc-ht11` del corpus de les proves d'or
(`testCorpus.ts`), `settings.test.ts` (v23, v24: els jocs inicials reben les dades d'ara) i `hiddenState.test.ts` (les
opcions del joc amb una guia normal no compten).

## Com afegir un joc d'un catàleg

1. Llegeix les pàgines del joc i apunta: NL disponibles i números per tancament; números industrials (guies, laterals,
   suports); instal·lació (LT = NL + ?, retirada de la guia); taula d'amplades; fórmules de la fusta (fons, darrere) i el
   gruix que suposa el catàleg; forats del front (Ø, separació, mínim de baix); columnes de cargols de la guia per NL (si
   el dibuix no és a escala, llegeix les cotes i quines guies les porten); alçades (lateral, darrere).
2. Escriu `core/model/kits/<fabricant><sèrie>.ts` amb un `HardwareKit` per classe d'alçada: una funció que faci les
   variants pels patrons dels números i, si és un calaix de doble paret de DTC (o un de la mateixa estructura), un
   `DoubleWallSpec` per a `doubleWallKit` (`dtcDoubleWall.ts`), com `hdKit` a `dtcMagicStarUltra.ts`. Cita les pàgines al
   comentari i posa a `hypotheses` tot el que no estigui acotat.
3. Afegeix-lo a `DEFAULT_HARDWARE_KITS` (`core/model/hardware.ts`, `kitItem(id, nom, kit)`) i exporta'l a
   `core/model/index.ts`; les preferències el reben a la propera lectura si puges `SETTINGS_VERSION` amb una migració
   additiva per id (com `V27_ITEMS` a la v27). Retalla la foto del producte a
   `public/hardware/*.webp` (només el producte, mai la pàgina).
4. Afegeix un test com els de `drawerKit.test.ts` (NL per fondària, números, fusta, prebroques) i comprova-ho a l'app:
   Front › Guia → el joc, Peces, DXF (capa `DRILL_D2_P10`), 3D obert i tancat.

Si el joc no és un calaix de doble paret (p. ex. una porta corredissa), cal estendre el model (`family`) i el constructor:
el que hi ha és genèric en les dades (components, fórmules, regles) però el lloc al moble (`buildKitDrawers`) és el del
calaix.

## Hipòtesis de lectura del catàleg DTC (pendents del taller)

Vegeu `hypotheses` a `dtcMagicPro.ts` i la secció «Hipòtesis de lectura» de l'editor del joc:

- Fileres de cargols de la guia al lateral a **10 i 38** per sobre de la vora inferior de la guia (el dibuix «Screw
  Positions» mostra dues fileres sense acotar-les).
- Vora inferior de la guia a **38** del cantell de baix del front («min 38» del dibuix d'instal·lació).
- Lateral del calaix a 10 per sobre de la guia i fons a 19 (del STEP de referència del taller, fet amb fons de 19; el
  catàleg suposa 16: amb 19, el darrere de 63 sobresurt 3 mm o el fons queda més alt).
- Forats dels suports de davant a **14** de la cara interior del lateral del moble (cota «14»), centrats a l'alçada del
  lateral del calaix; cargols dels suports de darrere a 9 dels cantells i a 19 / 51 del cantell de baix del darrere.
- El fons del STEP de referència fa **NL − 13,5** de fondària (436,5 amb NL 450), no NL − 29: es fa servir la fórmula del
  catàleg i es marca com a pregunta.
- L'estabilitzador (tancament suau, ≥ 800 d'amplada) no té número al catàleg.
- Amb fronts encastats, el joc es mesura des de la cara de darrere del front (la guia queda un gruix més endins que el
  cantell del lateral).

## Les sèries DTC (catàleg 2026)

Totes de la secció «Double-wall drawer systems» (pp. 225–438). Les que **hi són** comparteixen el constructor
`doubleWallKit`; el que diu cada pàgina (números, alçades, fórmules) és al comentari de dalt de cada fitxer i les lectures
no acotades a `hypotheses`.

| Sèrie | Jocs (id) | Lateral / darrere | NL | Tancaments | Darrere metàl·lic | Fons × fondària | Pàgines |
|---|---|---|---|---|---|---|---|
| MAGIC-PRO HT (`dtcMagicPro.ts`) | ht10 N · ht11 M · ht12 K · ht13 C · ht14 F | 62,5/39 · 88/63 · 126/101 · 174/148 · 238/212 | 270–600 | suau · push · push + suau (≥ 350) | HT1s034 | LW − 19 × NL − 29 (fusta) / NL − 27 (metall) | 231–250, 259 |
| MAGIC-STAR ULTRA HD (`dtcMagicStarUltra.ts`) | hd11 M · hd12 K · hd13 C · hd14 F | 88/58 · 126/96 · 174/144 · 238/208 | 270–600 | els tres | HD1s034 | LW − 19 × NL − 13 | 273–310, 327 |
| DRAGON-PRO HB (`dtcDragonPro.ts`) | hb01 M · hb02 B · hb03 D · hb0c C · hb04 F | 95/84 · 127/116 · 178/167 · 209/198 · 238/228 | 250–650 | suau · push | TB0134 (M) · TB0234 (B) · TB0334 (D); C i F, cap | LW − 75 × NL − 24 (fusta) / NL − 22 (metall) | 341–374, 383 |
| PURE-PRO HK (`dtcPurePro.ts`) | hk11 M · hk12 K · hk13 C | 90/64 · 128/102 · 167/137 | 270–550 | suau · push | HK1s034 | LW − 16 × NL − 27 | 407–414, 421 |

Diferències de cada sèrie respecte del MAGIC-PRO:

- **MAGIC-STAR ULTRA**: guia més baixa (28,5); **sense suports de darrere** (el lateral porta el ganxo: cargols del darrere
  a 9 del cantell i 14 / 46 d'alçada a la M); suports de davant HE1s011X (cargolat), HE1s016X (a pressió) i HD1s019
  (espiga ràpida), l'F amb un de més (HE14017); taula d'amplades només de la barra (300–600 ○, 800–1200 ●), sense
  estabilitzador; el darrere de fusta fa LW − 40 i el fons NL − 13 amb els dos darreres. Guies `HD10<NL>H` (suau),
  `HD10<NL/10>04GX` (push) i `HD10<NL/10>04K` (push + suau).
- **DRAGON-PRO**: NL de 250 a 650; **només suau i push-open**; fons LW − 75 (el lateral és més cap a dins: cotes 15,5 ·
  22,8 · 37,5) i darrere LW − 87; suports de darrere TB0s031; barra tallada a LW − 106; guia a «min 33» del cantell de
  baix del front; les classes C (209) i F (238) **no tenen darrere metàl·lic** (només fusta); l'F amb un suport de davant de
  més (HE14017). Guies `HB01<NL/10>04H-1` / `HB01<NL/10>04GX` per a totes les alçades. L'**HB00** (calaix interior
  baix, amb perfil de front metàl·lic) i els calaixos interiors no s'hi fan: el model dels jocs és el calaix amb front.
- **PURE-PRO HK**: lateral ultraprim de 13; el fons i el darrere entren dins del lateral (LW − 16); **el front va amb pius
  de posició** Ø10 (o forats Ø2) a 20 de cada lateral i a 61 / 77 del cantell de baix (M; K i C a pas de 32), amb els
  suports de fixació HT10082 (sense suports de davant cargolats); sense suports de darrere; acabats només blanc seda i
  gris mat; guies les del MAGIC-STAR ULTRA (HD10). La sèrie **HQ** (lateral de vidre de 6, mateixa guia) no s'hi fa:
  caldria un component de vidre al joc.

Acabat **negre mat (E36)** nou al catàleg 2026 (MAGIC-PRO, MAGIC-STAR ULTRA, DRAGON-PRO): `KIT_FINISHES` `black`, material
del 3D «Negre mat» (paraula clau «negre» de `resolveFinish`).

També hi són (v28): **PURE-BOX HL** (`dtcPureBox.ts`: HL11 84 · HL12 122 · HL13 159; lateral prim sobre guies de sota
GG10<NL>H, només suau; sense joc complet (el `kit` de la variant és el número de les guies), laterals HLG (250/270) / HL;
fons LW − 16 × NL − 21, darrere LW − 16 × (75 / 113 / 148 − T); front amb forats a 27 de cada lateral; la geometria de
muntatge és una hipòtesi: guia de 25 a «min 34» del front, lateral a 12 i fons a 21) i **PURE-PRO HQ** (HQ11 M i HQ13 C,
`DTC_PURE_PRO_GLASS_KITS` a `dtcPurePro.ts`: l'HK amb el **lateral de vidre** de 6 com a component de més,
`extraComponents` del `DoubleWallSpec`, material «Vidre», número HK1s062<NL>; joc HQ1s<NL>A12 / HQ6s<NL/10>04A12,
laterals HQ1s<NL/10>2).

**No s'hi han afegit**: **DRAGON-BOX EE01** (calaixos interiors M/B/D), els calaixos interiors (HB00, HT/HD/HB «inner
drawer» amb perfil de front metàl·lic) i amb lateral de vidre de MAGIC-STAR ULTRA, les baranes («Dividing and storage
systems», pp. 439–460) i les frontisses angulars, de marc d'alumini i de mirall. El model dels jocs és el calaix amb front
de fusta; la resta del catàleg és a la secció següent.

## La resta del catàleg DTC 2026 (v28)

`core/model/dtc/` i `DTC_CATALOGUE_ITEMS` (`hardware.ts`): cada item porta el fabricant, els números i les pàgines a
`tags`; les preferències els reben a la v28 si no hi són (`V28_ITEMS`, per id). **El per defecte de cada lloc és sempre
l'item de l'app** (`appItemOfEngine`, sense fabricant): el catàleg no canvia cap moble si no es tria.

| Secció del catàleg | A l'app | Què fa a la fusta |
|---|---|---|
| Frontisses C81 (pp. 41–68), C82 Anyway (87–112) i slide-on (121–146), C80 (159–176), B80/B85 (187–196) | `dtcHinges.ts`: 25 items del motor `cup` (una geometria de cassoleta per angle i sèrie; recobrent / mig / encastat i amb o sense molla només al número) | Cassoleta a K + Ø/2 (K 5), 2 cargols a 45 (tipus 5, prebroca Ø2 × 10) i la **placa de dos forats euro** a la filera System 32 (target `side`, `plateSetback` 37): les regles de sempre de `addCups` |
| Plaques (pp. 69–70, 113–114, 147–148, 179–182, 197–198) | `dtcPlates.ts`: 13 items del motor `plate` (dos forats, quatre forats, en línia; les H i els cargols al número) | Dos forats a 32 a la filera; quatre: + 2 de fusta a 11 del davant; en línia: a 20 i 52 del davant. Com les importades: es llegeixen des d'una frontissa |
| Guies ocultes MAGIC-MOVE TS, D-MOTION DS/SS/GG (pp. 505–592) | `dtcSlides.ts`: 14 items del motor `slide` (SKW = LW − 42 o − 49, SKL = NL − 10) | **Només els dos forats del motor** (37 i 37 + 224 al lateral; a la caixa, la prebroca del bloqueig); les columnes per NL i els forats Ø6 del darrere del calaix a `tags`: a confirmar amb la guia |
| Guies de boles SUPER-RAIL i estàndard 45/36 (pp. 601–608), de rodets A/L (501–502) | 6 items `slide` (folgança 12,7 / 12,5) | Dos forats al lateral i a la caixa (prebroca Ø2) |
| Suports de prestatge AC02 / AG02 (p. 743) | 2 items `system32` (piu Ø5 a la filera) | La filera de sempre |

**Fora, per decisió de l'usuari (2026-10-13: «els que no pots ficar els mecanitzats, els treus»; «els que posa només 3D
i estan buits, treu-los»)**: tot el que seria «només 3D» (motor `model`, el muntatge surt buit i cap regla el col·loca):
els elevables (també el DQ), les portes corredisses TRACK-PRO i els suports DM, els calaixos de paret simple, les unions
(excèntriques, VB35/VB36, fixacions del fons), la frontissa D, el door opener, els push latch MS, els perns sols i els
suports de barra. A la biblioteca només hi ha items que un motor de l'app col·loca (`dtcCatalogue.test.ts` ho comprova).
Les preferències **v29** treuen els que una v27/v28 anterior ja havia desat i, en general, tot `model` inicial o importat
sense `machining`. Les cotes que el catàleg dona d'aquests (unions, push latch) es queden aquí per al taller.

Hipòtesis de lectura (a confirmar amb la peça a la mà, com les dels jocs): cargols de la cassoleta del tipus «5» a 45 /
9,5 (el catàleg en dibuixa dos tipus); forats de les guies ocultes al lateral a 5 mm sobre la vora de baix de la caixa i
segona columna a 224; fons dels calaixos amb guia oculta retirat 12; posicions de les plaques de quatre forats i en línia
respecte de la filera.

## Push latch DTC MS (obertura per pressió, pp. 205–206): cotes per al taller

Els «Tip-On» del taller. **No són a la biblioteca** (eren items «només 3D» amb els mecanitzats del generador, `pushLatch.ts`,
trets a la v29 per decisió de l'usuari: el mòdul no els col·loca sol i el muntatge sortia buit); l'avís `push` dels fronts
sense tirador continua, i les cotes són aquestes (el pas que falta: un lloc «push» al mòdul que posi el latch al lateral
o a la tapa a la vora que obre, i la contraplaca a la porta):

| Muntatge | Mecanitzat (cos del moble) | Contraplaca (porta) | Imant (frontissa sense molla) | Topall (frontissa amb tancament suau) |
|---|---|---|---|---|
| Encastat | forat **Ø10 × 72 (mín.)** al cantell de davant (tapa, base, prestatge o lateral), 3 de retirada | disc, 1 cargol, a 12,5 de la cara de dins | MSB01A00 (mitjà) · MSC01A00 (fort), èmbol 39 | MSB01F00 · MSC01F00, èmbol 40 |
| Placa en línia (79 × 14, 15 d'alt) | 2 cargols a **32** de pas, el primer a **20** del cantell de davant, a la cara de dins | ídem | MSB01A01 · MSC01A01 | MSB01F01 · MSC01F01 |
| Placa en creu (79 × 48) | 2 cargols a **32** a través (±16 de l'eix) a **37** del cantell de davant | ídem | MSB01A02 · MSC01A02 | MSB01F02 · MSC01F02 |

Regulació de l'èmbol −0 / +5; colors gris clar H10 i gris fosc H11. Els cargols es dibuixen amb la prebroca Ø2 × 10 del
taller. El **door opener MS00AL/AM/AH** (pp. 207–210, obre la porta des del costat de les frontisses) no s'hi ha posat.

## Llums: jocs de llum Häfele Loox 24 V (v31)

Per decisió de l'usuari (2026-10-13: «munta tot lo que es pugui mecanitzar i els seus accessoris per connectar a la
xarxa elèctrica»): del catàleg general Häfele (`docs/blaetterkatalog.pdf`, capítol 2, pàgines «FF 2.x»; el PDF no es
puja al repo) entren les làmpades LED de 24 V que **s'encasten amb un mecanitzat** i el sistema per connectar-les.

**Model** (`core/model/lightKit.ts`, `LightKit`, dins d'un `HardwareItem` del motor `ledProfile` com a `item.light`;
categoria «Llums», `LuLightbulb`): la làmpada (sèrie, article, color de llum, W i el pic en encendre), el **rebaix**
(`recess`: rodó Ø × fondària, quadrat costat × fondària o ranura amplada × fondària), el cos que es veu, el forat del
cable, la versió de sobreposar (`surface`: caixa o la mateixa làmpada per cargolar) i, a la barra, les llargades que es
venen i el pas de tall. El **sistema** (`LightSystem`, `HAFELE_LOOX_SYSTEM` a `core/model/lights/hafeleLoox.ts`):
alimentadors per potència amb el cable de xarxa EU, distribuïdor de 6 vies, interruptor sensor de porta (Ø12 × 46),
interruptor de proximitat (per cargolar), el cable de l'interruptor, els cables d'extensió i el màxim de 6 m.
Es tria a **Prestatges i accessoris › Llum** del compartiment (el mateix `HardwarePick` que el perfil de tira LED;
«Com el mòdul» continua sent el perfil de l'app) i surt a Preferències › Ferratges › Llums amb la peça d'exemple i «Com va
muntat» (els forats a la cara de sota del prestatge). Els paràmetres editables: «Del davant», «Entre llums» i «Rebaix»
(`hardwareParams`: els dos últims només als items amb joc de llum).

| Làmpada (pàgina) | Mecanitzat a la peça de sobre (tapa, travesser o prestatge, cara de sota) | W | Articles (3000 / 4000 K) |
|---|---|---|---|
| Loox LED 3038, focus d'acer Ø65 × 12 (2.69) | forat **Ø55 × 12** + passant Ø8 (cable); caixa 833.72.803 si no s'hi pot encastar | 3 | 833.75.120 / .121 (plata) |
| Loox LED 3010, focus d'alumini amb vidre mat (2.65) | forat **Ø60 × 13** + Ø8; caixa 833.77.730 | 3,25 (**5 en encendre**) | 833.75.040 / .041 |
| Loox LED 3001, focus IP20 (2.68) | forat **Ø55 × 12** + Ø8; caixa 833.77.710 | 1,7 | 833.75.016 |
| Loox LED 3022, plana rodona Ø185 × 6,2 (2.66) | forat **Ø180 × 6,5** + Ø8; si no, la 3023 per cargolar (833.77.130 / .131) | 4,8 | 833.75.100 / .101 |
| Loox LED 3024, plana quadrada 210 × 210 × 6,2 (2.67) | rebaix **205 × 205 × 6,5** (caixera) + Ø8; si no, la 3025 (833.77.120 / .121) | 5,8 | 833.75.090 / .091 |
| LED 1088, barra per encastar 1000 / 1500 / 2000 (2.70) | **ranura 16 × 11** al llarg del compartiment (perfil tallat a la llum − 20, tira al múltiple de 50 dins de perfil − 5) + Ø8 a un extrem | 18,3 / 27,9 / 37,4 | 833.03.100 / .101 / .102 (3200 K), .111 / .112 / .113 (4200 K) |

**Construcció** (`buildLights` a `buildModule.ts`, pla pur a `core/build/lightKit.ts` `planLights`): a la peça de sobre
del compartiment i a la cara de sota de cada prestatge, una làmpada cada «Entre llums» (com a mínim una), centrades, el
centre a «Del davant» del cantell; el forat rodó és un `Hole` (tag `light`; al Maestro, **sense broca del Ø, caixera
rodona** `CreateCircleCenterRadius` + `CreateContourPocket` amb la fresa de les caixeres, `BIG_HOLE` 20), el quadrat i
la ranura són `Groove` (tag `light`) i el cable un `Cutout` rodó (tag `cable`). Si la peça no té 5 mm de tauler sota el
rebaix o la làmpada no hi cap, **la versió de sobreposar** i només el forat del cable, amb avís `light`; sense peça a
sobre (sense tapa), avís. El cos de la làmpada es veu a `extras` (`light-<zona>-<peça>-<n>`, material «Tira LED»: fa
llum al render; sense nesting). L'**interruptor**, un per mòdul: el sensor de porta amb un forat **Ø12 × 47 al cantell
de davant del lateral esquerre** (`light-switch`, a mitja alçada del primer compartiment amb llum) si el mòdul té portes
o abatibles recobrents; si no, el de proximitat. Res amagat compta: amb calaixos, front fix o dividit, cap llum
(`visibleZone`, com la tira LED).

**Comanda** (`core/build/lightOrders.ts`, `LightOrder` a `ModuleBuild.lightKits` → `CompositionBuild.lightKits`;
Peces › «Llums i instal·lació elèctrica» i el LLEGEIX-ME de Maestro): **un grup per mòdul** (cada mòdul té el seu
circuit): les làmpades (iguals sumades; barres amb la llargada de tall), les caixes, i `electricalLines`: l'alimentador
més petit que arriba a la potència **amb el pic en encendre** (20 / 40 / 90 W amb cable EU 833.77.951 / .952 / .953;
més d'un de 90 si cal), un distribuïdor 833.77.724 per cada 5 làmpades passades les 6 ranures, l'interruptor
(833.89.128 o 833.89.136) amb el cable 833.89.142 i la nota dels cables d'extensió (833.77.712 / .713 / .714; màx. 6 m).
El de 15 W (833.77.936) no s'hi posa: no té ranura d'interruptor.

**Hipòtesis** (`light.hypotheses`, a confirmar amb la làmpada a la mà): les fondàries dels rebaixos (el catàleg dona el Ø
del forat i l'alçada de la làmpada: 12 / 13 / 6,5), el forat del cable Ø8 al mig (del dibuix de la 3038 i la 3010), la
secció de la ranura de la 1088 (16 × 11, la del perfil de muntatge Loox d'11 mm, p. 2.127) i la potència proporcional
d'una barra tallada. Fora: les làmpades de 12 V i les tires LED (altres alimentadors), la LED 1150 de sostre (cos per
sobre de la peça, per a sostres buits), els perfils de muntatge sols i els controls remots.
Tests `core/build/lightKit.test.ts`.

## Potes: Häfele AXILO 78 (v34)

Per decisió de l'usuari (2026-10-14: «afegir un ferratge nou mecanitzat del PDF… la pota Rectangular para atornillar»):
del catàleg general Häfele (`docs/blaetterkatalog.pdf`, p. **FF 11.79**, pàgina 1889 del PDF), el sistema d'ajust per a
sòcols **AXILO™ 78** amb la **placa de fixació rectangular per cargolar 637.76.333** (plàstic negre). Item
`leg-hafele-axilo78-screw` (`core/model/hafele/hafeleLegs.ts`, motor `leg`, categoria Potes): es tria a Mòdul › Caixa ›
Base «Potes» › «Pota» i `buildLegs` en fa els forats a la cara de sota de la base, a cada cantonada.

| Cota del dibuix | Valor |
|---|---|
| Placa | 92 × 79 × 25 (+5 del clip del sòcol) |
| Cargols | 4, en quadre de 64 × 64, centrats a 39,5 de la vora contrària al clip |
| Tub | forat Ø30, eix a 39,5 de la vora del clip |

**Com la munta el taller** (el model de TopSolid del germà, 2026-10-14): el costat llarg (92) al llarg de l'amplada del
moble i el **clip cap al lateral**, una a cada cantonada amb la placa gairebé enrasada amb la vora; les de la dreta, en
mirall (`params.mirror` = 1). A l'app: l'eix del tub a **45** de cada cantell (`inset`) i, al marc de la pota (u = X cap a
dins a l'esquerra, v = cap al davant), els cargols a **u = −19 / +45, v = ±32**. Preferències v37 (la de la v34, amb el clip
cap al davant i a 60, es refà).

El **tub amb el peu regulable** (Ø78, 150 kg per pota) es demana a part per l'alçada H de la base «Potes»: 60 → 637.76.351
(53–80) · 80 → .352 (70–100) · 100 → .353 (90–120) · 125 → .354 (115–145) · 150 → .355 (140–170) · 180 → .356 (170–200)
· 200 → .357 (190–220). Ara surt a les notes de l'item (encara no a una comanda per mòdul, com els jocs).

**Hipòtesis pendents del taller**: la prebroca dels cargols, **Ø3 × 10** (el catàleg no dona ni el cargol ni la
prebroca; els cargols del darrere cauen sota la ranura del fons de la base: 10 + 8 de la ranura deixen 1 mm en un tauler de
19) i l'eix a 45 dels cantells (llegit de la imatge, sense cotes).

## Catàleg general Häfele (v35)

Per decisió de l'usuari (2026-10-14: «els marcs i perfils d'alumini a partir de la p. 4.269… i les peces que falten,
només les que es puguin mecanitzar, les més modernes i fàcils, com a molt 20; les categories que ja en tenen més de 20, no»):
17 items a `core/model/hafele/hafeleCatalog.ts` i `core/model/lights/hafeleLoox.ts` (`V35_ITEMS`). Frontisses (26),
guies (21) i calaixos de doble paret (22) no s'hi toquen.

| Categoria | Items (pàgina) | Mecanitzat |
|---|---|---|
| Perfils i marcs | Marcs d'alumini per a vidre 23 × 14 (563.25.902), 38 × 14 (563.26.902), 26 × 14 de marc reduït (563.26.922) (4.270) i 20,6 × 19 (563.32.902) (4.269) | Frontissa Metallamat A 110° (4.272): placa en creu 316.51.526 (D = 6) al lateral de les frontisses, dos forats Ø5 × 12 a ±16 a 37 del davant (la filera System 32), la quantitat per alçada de les frontisses (2/3/4/5) |
| Llums | Perfil Loox d'11 mm per encastar (833.72.846) + tira LED 3015 de 24 V, 3000 K (833.76.240) / 4000 K (.241) (2.127, 2.79) | Ranura 18 × 11 al llarg del compartiment + Ø8 del cable (com la barra 1088) |
| Tiradors | H1935 en D d'alumini (1.29), H1535 de perfil (1.70), H1540 i H1545 (1.72), corbat d'alumini Ø12 i el de fins a 224 (1.92), en D d'inox Ø8 / Ø10 (1.102) i Ø12 (1.103) | Dos forats passants Ø5 (cargols M4) a la distància entre centres més gran que hi cap (llargada + 40 ≤ el front) |
| Suports de prestatge | Ixconnect de zamac 282.24.717 (3.103) i d'acer amb llengüeta 282.04.712 (3.104) | Filera System 32 (Ø5 × 12) |

**Hipòtesis pendents del taller**: la placa de la Metallamat A es cargola als forats Ø5 × 12 de la filera (el catàleg dona
el patró 37/32, no el Ø); el 20,6 × 19 porta la Duomatic de cassoleta amb la mateixa placa (els forats del perfil, de la
unió angular, no són de la CNC de fusta); la ranura del perfil Loox, 18 × 11 (l'ala de 23 queda a sobre).

Fora (no es poden mecanitzar amb un motor de l'app o són complexos): la Metallamat A a la porta (el perfil no es
mecanitza), el perfil decoratiu i la jaladera de clip del marc, els perfils Loox de 6,5 (la tira 3015 demana més de 12 d'alt)
i de 24 mm (no hi cap en un tauler de 19), el perfil acodat, els tiradors embotits (caixera), el vaivé push (es cargola) i
la placa triangular de l'AXILO 78 (cada cantonada en mirall).
