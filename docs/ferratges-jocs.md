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
(`core/model/kits/dtcMagicPro.ts`, amb les pàgines citades al comentari de dalt).

## On viu

- El joc va dins d'un `HardwareItem` amb motor **`drawerKit`** (`HardwareItem.kit`), categoria **«Calaixos de doble paret»**
  (`drawer-system`). Així entra a la biblioteca (Preferències › Ferratges), al selector (`HardwareSelect`), a les còpies dels
  mobles (`front.hardware`) i al `.moble` sense cap camí nou. Preferències **v23** (additiu): els jocs inicials s'afegeixen
  a la biblioteca si no hi són (per id).
- Es tria al **calaix**: Front › **Guia** llista les guies i els jocs. Amb un joc, surten **Tancament** (suau · push-open ·
  push + suau) i **Darrere** (fusta · metàl·lic) (`Front.kit`, `KitOptions`; res amagat compta: amb una guia normal no es
  llegeixen) i la fitxa **Joc**: NL triada, primeres línies de la comanda i les mides del fons A i del darrere B.
- Els `params` de l'item porten la **prebroca** (`pilotDiameter`, `pilotDepth`; 0 = cap forat) i els `targets` descriuen
  el forat de prebroca de cada peça (`side`, `front`, `back`). «Mides» de l'editor els canvia; Preferències › Ferratges ›
  **«Prebroca dels cargols»** (`kitPilot` / `setKitPilot`) els canvia a tots els jocs de la biblioteca alhora.

## Model (`HardwareKitSchema`)

| Camp | Què és |
|---|---|
| `maker`, `series`, `family` | DTC · MAGIC-PRO HT11 · `double-wall-drawer` |
| `heightClass` | codi (N/M/K/C/F), alçada del lateral del calaix, alçada del darrere de fusta |
| `variants[]` | per NL: números del joc complet (`kit`) i de les guies (`slides`) per tancament, joc de laterals (`sideKit`) i les **columnes de cargols** de la guia (`screws.both` a les dues fileres, `screws.top` només a la de dalt), en z des del cantell de davant del lateral |
| `options` | tancaments i darreres que es venen |
| `rules` | `depthMargin` (LT = NL + 3), `slideSetback` (3), `baseAboveFront` (38), taula `widths` KB → estabilitzador / barra (0 no · 1 recomanat · 2 molt recomanat), `syncRodCut` per tancament (`LW-167`, `LW-238`), `metalBackSideThickness` (16) |
| `geometry` | on comença el lateral del calaix (`sideBase`) i el fons (`bottomBase`) per sobre de la vora inferior de la guia, gruixos del lateral i de la guia |
| `components[]` | id, nom, costat (`both` = mirall, `center`), quantitat, número (`fixed` · `variant` · `byWidth` · `none`), condició `when` (tancament, darrere, regla d'amplada), llargada de tall, formes 3D (`box` / `rod`) en coordenades del joc |
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
   peces de només veure (rol `hardware`, ids `drawer-<k>-kit-…`: el visor les mou amb el calaix, `opening.ts` agafa la NL
   de la guia). La comanda a `ModuleBuild.hardwareKits` → `CompositionBuild.hardwareKits` (amb el mòdul).
3. **Tot o res** per calaix: sense NL, sense lateral a un costat o sense alçada → només el front i avís `hardware`.

On surt: **Peces › «Ferratges dels jocs»** (`kitGroups`, calaixos iguals sumats, amb la fusta per calaix; els components no
van a «Elements sense nesting»), el **LLEGEIX-ME** dels programes Maestro (`kitReadmeLines`), l'inspector del calaix, el 3D
(components grisos, mode Per peça «Ferratges»), «Com va muntat» i la miniatura de la targeta (mòdul d'exemple de
450 × (alçada del joc + 140) × 500, càmera des de dins i del darrere), la peça d'exemple (lateral amb les prebroques).

Proves: `core/build/drawerKit.test.ts` (regles, números, pla, construcció, mirall, tot o res, opcions, muntatge), la
composició fixa `kit-dtc-ht11` del corpus de les proves d'or (`testCorpus.ts`), `settings.test.ts` (v23) i
`hiddenState.test.ts` (les opcions del joc amb una guia normal no compten).

## Com afegir un joc d'un catàleg

1. Llegeix les pàgines del joc i apunta: NL disponibles i números per tancament; números industrials (guies, laterals,
   suports); instal·lació (LT = NL + ?, retirada de la guia); taula d'amplades; fórmules de la fusta (fons, darrere) i el
   gruix que suposa el catàleg; forats del front (Ø, separació, mínim de baix); columnes de cargols de la guia per NL (si
   el dibuix no és a escala, llegeix les cotes i quines guies les porten); alçades (lateral, darrere).
2. Escriu `core/model/kits/<fabricant>.ts` amb un `HardwareKit` per classe d'alçada (una funció que faci les variants pels
   patrons dels números, com `dtcKit`). Cita les pàgines al comentari i posa a `hypotheses` tot el que no estigui acotat.
3. Afegeix-lo a `DEFAULT_HARDWARE_KITS` (`core/model/hardware.ts`, `kitItem(id, nom, kit)`); les preferències el reben a
   la propera lectura si puges `SETTINGS_VERSION` (o el que hi ha ja hi és). Retalla la foto del producte a
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
