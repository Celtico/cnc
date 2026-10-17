# Fabricació: regles de construcció

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Fabricació
#### Regles de construcció (`core/build/`)
- **Regles revisades** (`build/manufacturing.test.ts`): amb fronts encastats, divisors i prestatges fixos d'una zona coberta
  es retiren `t + outerGap` (`insetCut`, espigues i System 32 al cantell nou); en un mòdul dividit, tots els divisors i
  prestatges fixos més curts per la folgança de les peces de dins (vegeu Model del moble › Zones); les portes d'una zona pare fan la filera
  System 32 als trams lliures entre prestatges fixos (placa de la frontissa); forats de guia dels calaixos des del davant de
  la caixa (`zFront − 37`); trapa de reixeta darrere del front encastat; ranura del fons sempre dins de la peça, d'ample el gruix del fons + el **joc de la ranura** (`Carcass.grooveClearance`, Preferències › Folgances per defecte › «Joc de la ranura» i Mòdul › Caixa, sota «Ranura del fons»; per decisió de l'usuari, 2026-10-14: «gruix + 0,8»; el joc va cap al davant i el cantell de darrere es queda a `backSetback`; per defecte **0,8** a Preferències (v33: les que el tenien a 0 o sense, el reben) i el copien els mòduls nous i les plantilles instanciades (`applySettingsToModule`, `withInnerClearance`); a Mòdul › Caixa amb «Com a Preferències» i el botó per tornar-hi; un mòdul sense el camp, 0 (els desats no canvien, proves d'or idèntiques); `backGrooveWidth`, test `build/backGroove.test.ts`) i allargada
  `g` on la tapa/base passa per sobre del lateral (inglet, tauler de taula); fons sota el tauler de taula i fins a
  `interior.y1` amb ranura d'aire; frontisses per alçada (2/3/4/5 fins a 900/1600/2100, ara `count` de l'item; `hingeCount`
  només al `buildCabinet` antic) i cassoletes separades ≥ Ø + 10 (si no, menys i avís `hinge`); fons del calaix amb material del seu gruix (avís `drawer-bottom`); peces amb
  alguna mida ≤ 0 fora amb avís `invalid-part`. **Pendent de decidir amb el taller**: joc de les ranures i descompte del
  gruix del cantell.
- **Ferratges com a dades** (millores v1 F1–F2, [`docs/millores-v1/ferratges.md`](docs/millores-v1/ferratges.md)):
  `core/model/hardware.ts` (`HardwareItem`: categoria, motor `engine`, `params`, mecanitzats `targets[].ops` amb fórmules
  `Expr`, `count`/`pitch` = `StepRule`, `lengths`) i `core/model/expr.ts` (`evalExpr`, analitzador propi **sense `eval`**:
  `+ − × ÷`, parèntesis, `min/max/abs/floor/ceil/round`, variables). Motor pur `core/build/hardware.ts`: `applyHardware`
  (ops → `Hole`/`Cutout` en un punt d'ancoratge, mirall i gir), `drillSpec`, `cupSpec`… i `slotSpec`/`resolveKit` (un item
  que no serveix → el d'inici i avís `hardware`; mai mig ferratge). Les **regles** de col·locació es queden a `buildModule`
  (cassoletes a la filera, guies a `zFront − frontOffset`, espigues…): els números i els forats surten de l'item. Llocs
  (`HARDWARE_SLOTS`): frontissa, System 32, espiga, guia, braç d'abatible, imant, tirador i els **accessoris** opcionals
  barra de penjar, tira LED i marc de vitrina (`ACCESSORY_SLOTS`). Cada mòdul en porta una **còpia** (`Module.hardware` =
  `ModuleHardware`; els accessoris poden faltar: l'item d'inici, `moduleSlotItem`) i la porta, el calaix, l'abatible, la
  reixeta (imant) o l'accessori en poden triar un altre (`front.hardware`, `zone.rail.hardware`…, còpia; la porta de
  vidre no, `visibleModule`). **Només es resolen els llocs que el mòdul fa servir** (`resolveKit` a demanda,
  `Builder.frontHardware`/`frontHandle` amb getters; auditoria A1): un item dolent al lloc «frontissa» d'un mòdul només
  de calaixos no avisa; `usedHardwareSlots` (`core/model/usedHardware.ts`, **l'única**, declarativa, del model) diu els
  mateixos llocs a l'inspector (els fronts tapats no compten; l'espiga, només on hi ha unions a topar, `carcassDowels`).
  **La còpia de cada lloc es llegeix sencera o res** (`repairAtomically`, com el ferratge
  d'un front; A2): un joc amb el `kit` dolent torna a l'item d'inici amb avís de reparació, mai un joc sense `kit`; si
  n'arriba un, el missatge diu «joc de calaix malmès», no «no és del tipus que toca» (`moduleSlots.test.ts`). Migració: mòduls d'abans en llegir (`z.preprocess(migrateModuleHardware)`,
  `normalizeComposition`, i `buildModule` amb dades crues; un número dolent, camp a camp) i preferències **v19**
  (`hardware` → `hardwareLibrary` + `hardwareDefaults`, `libraryFromLegacy`, `fixHardwareDefaults`): **proves d'or idèntiques**.
  Ara les guies i l'abatible porten els seus números (abans `system32.edgeOffset` i `hinge.cupOffset`). `hardwarePreview`
  (peces d'exemple amb el motor) per al dibuix de Preferències i `hardwareMount` / `mountPlan` (el ferratge muntat en un
  mòdul petit per `buildModule`, en 3D i en pla). Tests a `build/hardware.test.ts`, `build/hardwareMount.test.ts` i
  `model/expr.test.ts`. Cada mòdul en porta una **còpia** per lloc (`Module.hardware` = `ModuleHardware`).
- **Jocs paramètrics** (`core/model/hardwareKit.ts`, dades a `core/model/kits/` —constructor comú de les sèries DTC
  `dtcDoubleWall.ts` i una dada per sèrie: `dtcMagicPro.ts`, `dtcMagicStarUltra.ts`, `dtcDragonPro.ts`, `dtcPurePro.ts`—,
  constructor `core/build/drawerKit.ts` + `buildKitDrawers`, comanda `core/build/kitOrders.ts`; preferències **v23**,
  additiu: els jocs inicials s'afegeixen si no hi són; **v27**: els del catàleg DTC 2026 —MAGIC-STAR ULTRA, DRAGON-PRO,
  PURE-PRO HK— s'afegeixen si no hi són, `V27_ITEMS` (els push latch DTC MS d'aquella versió es van treure a la v29);
  test `build/dtcKits.test.ts`;
  **v28**: la resta del catàleg DTC 2026 (`V28_ITEMS`, `DTC_CATALOGUE_ITEMS`, `core/model/dtc/`: **frontisses** de
  cassoleta C80/C81/C82/B80/B85 amb la placa de dos forats euro a la filera (`dtcHinges.ts`, motor `cup`), **plaques**
  (`dtcPlates.ts`, motor `plate`), **guies** ocultes, de boles i de rodets (`dtcSlides.ts`, motor `slide`: només els dos
  forats del motor; les columnes del catàleg a `tags`), suports de prestatge (`system32`, `dtcMisc.ts`) i els jocs
  PURE-BOX HL (`kits/dtcPureBox.ts`) i PURE-PRO HQ de vidre; test `build/dtcCatalogue.test.ts`). **Cap «només 3D»** (per
  decisió de l'usuari, 2026-10-13: «els que no pots ficar els mecanitzats, els treus»; «els que posa només 3D i estan
  buits, treu-los»): a la biblioteca només hi ha ferratges que un motor de l'app col·loca; elevables, portes corredisses,
  suports DM, calaixos de paret simple, unions, frontissa D, door opener i push latch no hi són (la v29 els treu de les
  preferències desades; les cotes del push latch i de les unions, a `docs/ferratges-jocs.md`). **El per defecte de cada lloc és sempre l'item de l'app** (`appItemOfEngine`: sense
  fabricant), mai el primer del catàleg del mateix motor (`kitFrom`, `fixHardwareDefaults`, `HardwarePane`)):
  vegeu Model del moble › Calaixos amb joc paramètric i `docs/ferratges-jocs.md`.
  Preferències **v24**: els jocs inicials (`builtin`) reben les dades del joc d'ara (guia de dos cossos, acabats); nom i
  prebroca es queden; les còpies dels mobles no es toquen (es veuen com abans fins a tornar a triar el joc).
  Categoria «Calaixos de doble paret» (`drawer-system`); l'editor del joc (`settings/KitSections.tsx`) és **només lectura**
  (variants, opcions, regles, components, fusta, mecanitzats, hipòtesis; duplicar-lo per canviar la prebroca a «Mides»).
  **Regla del taller «prebroca dels cargols»** (Preferències › Regles de mecanitzat › «Prebroca dels cargols», **una sola font**:
  `Settings.kitPilot`, `KitPilot`; Ø2 × 10, activada; les preferències d'abans la prenen del primer joc,
  `kitPilotFromLibrary`): un forat guia a cada cargol d'un ferratge que no té mecanitzat propi; els jocs de la biblioteca
  en copien els números (`setKitPilot`) i les còpies dels mòduls la **segueixen en construir** (`setKitPilotRule` des de
  `db/settingsStore.ts`, `planKit` llegeix `kitPilotRule()`; sense regla —tests— els `params` de la còpia). A «Mides» del
  joc ja no s'edita (`HARDWARE_PARAMS.drawerKit = []`). Els ferratges de sempre ja foraden cada cargol: guia Ø5 / Ø4,
  placa i System 32 Ø5, espigues, imants, braços; l'ala de la frontissa genèrica no en té de posicions conegudes. El `ModuleHardware` (abans `HardwareKit`) és la còpia dels items
  per lloc del mòdul; `HardwareKit` és ara el joc paramètric. Tests `build/drawerKit.test.ts` i el moble fix `kit-dtc-ht11`
  del corpus de les proves d'or (`testCorpus.ts`).
- **Ferratges importats del fabricant** (Hettich, [`docs/ferratges-import.md`](docs/ferratges-import.md); preferències
  **v20**, additiu: `HardwareItem.imported`, `plate`, motor `plate`): una frontissa importada fa servir les regles de
  sempre (`addCups`: quantitat per alçada, filera System 32, `cupOffset`, cara A) amb **tots** els forats del target
  `door` (cassoleta + cargols/espigues del fitxer, tags `hinge-screw`/`hinge-dowel`) i, amb una placa aparellada
  (`addPlate`), els forats de la placa (target `side`, tag `plate`) a la cara de dins del **lateral de les frontisses**, a
  `zFront − plateSetback` (37) i a l'alçada de cada cassoleta + `plateOffset`; un forat de placa sobre un del System 32
  es queda el més gros (cargol euro Ø5 × 12 = el mateix forat). **Sense confirmar (`imported.confirmed`), cap forat**
  (ni a la porta ni al lateral) i avís `hardware`: el taller no rep res que no s'hagi revisat. El model només per veure
  (`Panel.fittings`, GLB de `hardwareAssets`). **Mai mig ferratge ni una frontissa que no s'ha revisat**: un importat que
  no passa l'esquema es llegeix **inert** (`sanitizeImportedHardware` a `HardwareItemSchema`: preferències, mòduls,
  fronts i `.moble`; marca `imported.damaged`, avís «ferratge importat malmès: no es mecanitza»); un importat que fa
  fallar el motor queda sense forats (`inertHinge`), mai el d'inici ni el del mòdul; tot el patró (cassoleta i cargols) a
  la porta i la placa sencera al lateral i fora de les unions amb base, tapa i prestatges fixos, o res d'aquella frontissa;
  placa més fonda que el lateral → gruix − 1 i avís; sense lateral → avís; amb fronts encastats la placa es mesura des
  del darrere de la porta (sola). La placa aparellada és **per referència** (`syncPairedPlates` a cada canvi de la
  biblioteca; si en canvien els forats, la frontissa es desconfirma); no es confirma una frontissa amb la placa
  pendent, ni una placa sense forats (`confirmProblem`); canviar Ø/fondària de la cassoleta o on va la placa desconfirma
  (`setHardwareParam`). `proposePlate`: només els forats de muntatge de la cara del lateral, per parells simètrics; si
  no, cap forat (s'entren a mà). Tests `build/importedHardware.test.ts`, `build/importedHardwareSafety.test.ts`,
  `core/import/*.test.ts` i `core/import/hettich.roundtrip.test.ts` (`HETTICH_DIR` = carpeta amb els ZIP de Hettich; no
  es copien al repo).
  **Qualsevol article es pot importar** (amb STEP; sense, amb les vistes DXF, **«només 2D»**: motor `model` sense caixa ni
  3D fins que s'hi afegeix el STEP; `classifyHettich` per la família i la subcarpeta, `proposeArticle`):
  **tiradors** (`Griffe`, `proposeHandle`: els forats de la cara de muntatge → distància entre centres a la de catàleg si
  és a ≤ 0,5 mm, forat passant Ø del tirador per defecte o cargol + 1; un forat = pom; 3–4 = el parell centrat) al motor
  `barHandle` de sempre amb `pitch` sense graons, triable a cada front (`front.handle`) o al mòdul; **potes**
  (`Moebelfuesse`, `proposeLeg`: pilots a la placa) amb motor nou `leg`, triables a la base «Potes» (`Base.hardware`):
  `buildLegs` fa els forats a la cara de sota de la base a cada pota (a `inset` dels cantells; una placa que no hi cap just allà —un fons cargolat que es menja el darrere de la base, un forat a prop— es mou cap a dins el mínim, fins a 40 mm (`LEG_NUDGE`), amb avís; per decisió de l'usuari, 2026-10-16: «l'illa no respecta les potes»; si ni així, cap; una pota que cau a l'osca d'una columna la torna a posar `relayLegs`); i la resta
  **«només 3D»** (motor `model`: estructures i guies de taula, Cadro, portes corredisses i plegables, accessoris,
  electrònica, carpetes desconegudes, i els tiradors/potes sense patró): el model i el volum, **mai cap forat**, GLB per
  baixar. Tiradors i potes: **sense confirmar, cap forat** i avís `hardware`; malmesos o que fallen, inerts. Preferències
  **v21** (categories `table` «Taules» i `door-system` «Portes corredisses i plegables»). Tests
  `build/importedHandleLeg.test.ts` i `core/import/hettich2.roundtrip.test.ts` (`HETTICH2_DIR`).
  **Tornar a importar un article amplia el que ja hi és** (per decisió de l'usuari: «mira si ja existeix la referència i si
  el document importat porta nova informació, la col·loques»; clau fabricant + article, `core/import/merge.ts`,
  `mergeImported`): el STEP hi afegeix el 3D, la caixa i la proposta si no en tenia (un «només 2D» passa a frontissa,
  tirador…, sense confirmar, mateix id i nom; les vistes d'abans es registren, `registerStoredView`); el DWG/DXF, les vistes
  i els punts de connexió; els plànols de muntatge (`dxf_einbau`, exemples, PDF) que nomenen l'article s'hi adjunten
  (`HardwareAsset.docs`). **Mai es toca un mecanitzat confirmat** (ni uns forats editats): si els fitxers donen una altra
  proposta, va a `imported.update` («Hi ha una proposta nova: revisar» a l'editor, amb la comparació; aplicar-la la deixa
  sense confirmar, `applyImportUpdate`; descartar-la, `dismissImportUpdate`); `imported.proposedParams` diu els números de
  la proposta (Ø i fondària de la cassoleta, Ø i distància del tirador). Noms «<nom> <sèrie> · <article>» sense la carpeta de
  l'usuari ni la del ZIP (`core/model/makers/hettichNames.ts`: `cleanFolders`, `hettichLabel`, `hettichSeries`); els noms
  automàtics d'abans es migren en llegir les preferències (`migrateImportedNames`, només si no s'han canviat). Tests
  `core/import/merge.test.ts` i `core/import/hettichMerge.roundtrip.test.ts` (`HETTICH_DIR`/`HETTICH2_DIR`/`HETTICH_DXF_DIR`).
  Els mecanitzats del generador (`machining`) també: confirmats no es toquen (pendents a `update.machining`) i un DXF
  del taller amb capes de mecanitzat és informació nova. Detall a `docs/ferratges-import.md` §6–§7.
- **Generador de mecanitzats i ferratges col·locats a mà** (millores v1 F4, `docs/ferratges-import.md` §8; per decisió
  de l'usuari: «selecciones l'eina i el que li ha de fer a la fusta… i que es pugui posar»). **Sense UI des del
  2026-10-08** (per decisió de l'usuari: «el Generador de mecanitzats no cal… ara ho fiquem nosaltres a partir del
  catàleg»): no hi ha ni el formulari, ni el dibuix, ni «Llegir un DXF…», ni «Afegir ferratge»; el model, la fabricació
  i els col·locats que ja hi són es queden igual (treure ≠ esborrar; proves d'or idèntiques). Preferències **v22** (additiu):
  `HardwareItem.machining` = `GenOp[]` (`core/model/hardwareOps.ts`): per peça (`PART_KINDS`: porta/front, lateral, base,
  tapa/tauler de taula, prestatge, fons, caixa del calaix, peça lliure) forat (cara A/B, passant o **de cantell**), ranura
  (amplada, al llarg de P o Q, llargada o de cantell a cantell), caixera (rectangle, radi) i contorn (passant, o rectangle
  si és cec); posició del **centre** en els **eixos del moble** del pla de la peça (`planeAxes`: de cara X·Y, de costat
  Z·Y, estirada X·Z = P·Q) des del **punt de referència** o d'un cantell / del mig (`Pos`); eina de la màquina per
  defecte (`GenTool`). `machiningProblems` (pur) valida mides, cantell, contorn i eina (tipus, Ø, amplada, fondària útil);
  la llista es llegeix **sencera o res** (`MachiningListSchema`, `repairAtomically`). Editar-los en un importat el
  desconfirma (`setMachining`); un «només 3D» amb mecanitzats es confirma (`confirmProblem`). **Col·locats**
  (`Composition.hardwarePlacements`, `HardwarePlacementSchema` atòmic: còpia de l'item, `targets` = peça del mòdul
  (`module` + id local del constructor) o `freePart`, i quin grup de l'item hi va; `p`/`q` del punt de referència;
  `repeat`; `turn` del model 3D): `core/build/hardwarePlace.ts` (`applyHardwarePlacements`, a `buildComposition` abans dels
  objectes que tallen; `partFrame`: P·Q des de la normal de la peça i `toLocal`): `Hole` / `Groove` / `Cutout` amb tag
  `fitting`. **Tot o res** per col·locat (una operació fora de la peça o més fonda que el gruix → cap i avís `hardware`);
  importat sense confirmar, malmès, «només 3D» sense operacions, operació dolenta, peça que no hi és (res amagat compta) o
  que no és de CNC → cap forat i avís. Els grups de l'item sense peça triada no es fan (els «mirall» només si es trien).
  3D: `Panel.fittings` `kind: "item"` amb `placement` = l'id del col·locat (GLB o el volum de les operacions;
  `hingeVolumes` no el confon amb una frontissa); el model es veu també quan no fa cap forat (sense confirmar, mecanitzat
  dolent o que no hi cap: només visual, per trobar-lo i triar-lo al 3D).
  **Paramètrics** (per decisió de l'usuari: «la col·locació al moble no hauria de ser paramètrica?»; `PlacePos` i
  `Repeat` a `core/model/hardwareOps.ts`, `refPoints`/`placeAt` a `hardwarePlace.ts`): per eix, ancoratge des de l'inici
  (`min`), des del final (`max`), el mig o un `%` (`ratio`, `pct`) més el desplaçament `at` o una **fórmula** `expr`
  (`evalExpr`, sense `eval`; **L** llarg, **A** ample, **G** gruix de la peça, **M** la mida al llarg de l'eix; una fórmula
  dolenta → cap forat i avís); repetició `step` (des del punt, la d'abans) · `centred` · `span` (repartides entre els
  `margins`) · `pitch` (cada `spacing` entre marges, centrades), amb la quantitat fixa o per regla segons la llargada de la
  peça (`rule`, `StepRule` com `hingeCount`; `repeatCount`/`repeatOffsets`); **mirall esquerra/dreta** (`mirror`: al
  lateral de l'altre costat —`otherSideId`, la mateixa P·Q i cara de dins— o, a una peça de costat a costat, reflectit
  respecte del seu mig amb les operacions reflectides, `mirrorOpP`; sense peça a l'altre costat, cap forat; un mecanitzat
  repetit pel mirall es fa un cop). Es recalcula a cada construcció: si el mòdul canvia de mida, el ferratge el segueix;
  tot o res també amb les còpies i el mirall. Les posicions d'abans «des de la referència» (`ref` = des de l'inici) es
  llegeixen `min` (`migratePlacePos`, `z.preprocess` a `HardwarePlacementSchema`, idempotent): el mateix resultat.
  `StepRule`/`stepValue` són ara a `hardwareOps.ts`. Tests `build/hardwarePlaceParam.test.ts` (canviar l'amplada i
  l'alçada → les posicions segueixen; regla per mida; marges; mirall; fórmules; migració; `.moble`).
  `eachHardware` els recorre (confirmar/eliminar a Preferències hi passa; `.moble` **v3**, `mobleVersionFor`). **DXF del
  taller** (`core/import/dxfMachining.ts`): capes `DRILL_D<Ø>_P<f>` (`DRILL_B_…`), `GROOVE_W<a>_P<f>`, `POCKET_P<f>`,
  `CUT_THROUGH`, `CONTOUR` (el contorn que ho envolta tot no es talla) → operacions exactes; peça pel sufix del nom
  (`partFromFileName`: `_porta`, `_lateral`, `_tapa`…); en importar (`settings/hardwareImport.ts`, tret amb la UI el 2026-10-08) manen sobre el STEP. Tests
  `core/import/dxfMachining.test.ts`, `build/hardwarePlace.test.ts`, `build/hardwarePlaceExports.test.ts`. **Proves d'or
  idèntiques.**
- **Blum i un sol camí per fabricant** (per decisió de l'usuari: «estén el pipeline, no el dupliquis»; `docs/ferratges-import.md`
  §10): `core/import/makers.ts` (`detectMaker`, `importFileKind`, `importCandidate`, `groupImport` = Hettich +
  `groupBlum`, `makerOf`; `HettichArticle.maker`) i la resta comuna (`articleItem`, `mergeImported` amb la clau fabricant +
  article; el diàleg i `settings/hardwareImport.ts`, trets amb la UI el 2026-10-08). Blum (`core/model/makers/blum.ts`): fitxers `<article>_<doc 8 xifres>[_R|_L].<ext>` (solts o
  als ZIP amb el nom del producte en castellà, NFC), un item per article (mà al nom; amb les dues mans del mateix
  article, la dreta i nota), `classifyBlum` pel producte o el prefix (CLIP top → porta, plaques/guies/AVENTOS/TIP-ON →
  lateral, accessoris o desconeguts → **«Sense assignar»**, `PartKind` `any`: es pot col·locar però no es confirma fins
  que s'assigna, «Assignar a» al generador). **Programes Xilog** (`core/import/xilogPgm.ts`, `readXilog` /
  `machiningFromXilog`, pur, mai llança; registres ASCII del contenidor binari; hipòtesis documentades: `XBO` X/Y des del
  punt de referència, Z negatiu = fondària, `Z ≤ −DZ` passant, F 1 = cara A, 2–5 cantells, 6 cara B, R = total amb pas
  x/y; fresats i desconeguts a les notes): mecanitzats **exactes** del generador (X → P, Y → Q), motor `model`, sempre
  **col·locats a mà** i **sense confirmar, cap forat**. 3D: STEP (tots els del joc), si no `.dae` (`ColladaLoader`), si
  no `.glb`/`.gltf` (`GLTFLoader`, m → mm); el `.dxf` de Blum és ACIS (no es llegeix). **Formats: una sola taula**
  (`core/import/formats.ts`, `IMPORT_FORMATS`) per al classificador (`hettichFileKind`/`importFileKind`, `MODEL_3D_KINDS`)
  i per a l'`accept` de «Triar fitxers…» (`IMPORT_ACCEPT`, extensions i MIME: el diàleg del Mac deixava el `.dae` en gris);
  els que només es llisten (DWG, SAT, MAX, `*.mpr`, CAM d'altres màquines) també hi són. Molts fitxers solts de tipus
  barrejats alhora (Blum els baixa d'un en un). Test `formats.test.ts`. Hettich, formats de més: IGES (`ReadIgesFile` al mateix worker d'OpenCascade) i
  3DS (`TDSLoader`, mm) donen el 3D d'un «només 3D» sense STEP (`components/viewer/modelMeshes.ts`); SAT i MAX no; els
  PDF sense número s'adjunten per sèrie (≤ 12 articles) o surten «sense article» al diàleg (`ImportSource.loose`). Tests
  `core/import/xilogPgm.test.ts`, `blum.test.ts`, `blum.roundtrip.test.ts` (`BLUM_DIR`) i `hettich3.roundtrip.test.ts`
  (`HETTICH3_DIR`: `IGES_Griffe.zip`, `3DS_Griffe.zip`). **Proves d'or idèntiques.**
- **El lloc de cada ferratge importat («Què és»), el marc de muntatge i la col·locació a mà mínima** (per decisió de
  l'usuari: «la col·locació a mà és massa complicada», «una frontissa importada s'hauria de substituir pel paramètric que
  ja tenim», «el 3D hauria d'entrar tal com es veuria col·locat a la realitat»; `docs/ferratges-import.md` §11):
  cada importat té un **lloc** = un motor de l'app (`engine`; `HARDWARE_ROLES`: frontissa, placa, tirador, guia, braç,
  pota, imant, espiga, filera) o **«només 3D»** (`model`). Els d'un lloc els posen **les regles de sempre** del mòdul
  (cap col·locació a mà) i els seus números són a l'item, prefilats del STEP i editables. Si el STEP no dona el patró, la
  proposta és **parcial** (`partialProposal`): l'item surt del tipus que toca amb els números per defecte, «mides per
  omplir», mai «només 3D». Blum: frontisses, plaques, tiradors i potes amb 3D van al seu lloc (el Xilog, de referència).
  **«Què és»** a l'editor (`retargetImported`, pur; `settings/hardwareReframe.ts`): canvia el motor amb els números per
  defecte, sense confirmar, i **refà el GLB al marc estimat de la malla**. **Marc de muntatge** (`imported.mountFrame`,
  `frameFrom` step/mesh/file): del STEP (`proposal.ts`) o **de la malla** (`core/import/meshFrame.ts`: anells de vèrtexs
  en cercles per eix, RANSAC per anell; la cassoleta Ø25–41 amb ≥ 2 anells, els cargols Ø3–7 al voltant; sense
  cassoleta rodona —CLIP top EXPANDO T— el parell de fixacions a 28–50 mm; placa, tirador i pota per la cara d'on neixen
  els forats); amb els fitxers reals dona el mateix marc que els cilindres del STEP. El visor posa el GLB amb la mateixa
  transformació que el motor (`fittingMatrix`): el 3D entra col·locat (tancat; no s'articula). **Col·locació a mà**
  només per als «només 3D» (`isPlaceable`), només peça i posició (cantell o mig + mm); repeticions, fórmules, mirall i
  gir fora de la UI però tolerats (es llegeixen i fabriquen igual; «Avançat» + «Simplificar», `placementAdvanced`,
  `simplifyPlacement`). **Sense barra flotant** al 3D (`FittingToolbar` eliminat; editar/duplicar/eliminar a la llista
  de l'inspector); un ferratge triat es dibuixa opac i sencer (caixa sense model també opaca). Tests
  `core/import/slot.test.ts`, `meshFrame.test.ts`, `meshFrame.roundtrip.test.ts` (`HETTICH_DIR`/`BLUM_DIR`, tessel·lat
  amb `occt-import-js` al Node), `features/composition/placements.test.ts`. **Proves d'or idèntiques.**
- **Com s'aguanta el mòdul** (v45, `build/module/mounting.ts`, capa `MountingBuilder` entre la carcassa i els llums):
  **penjadors** dels mòduls penjats (l'estàndard, Libra H2: 4 × Ø10 × 13 en columna a cada lateral, cara de dins, sota la
  tapa i darrere del fons; la ranura de 12 × 54,5 al fons per regular-los; regleta de paret darrere del fons; el fons dels
  penjats nous, en ranura retirat 20; avís `hanging` si el fons no deixa 15 mm). El **sòcol** no és del mòdul: és una peça
  per tram del moble (`build/tramPlinth.ts`: al davant i, si es tria, als costats i al darrere, de fusta —a tope o a
  inglet, a trossos de 2400 com a molt amb les juntes entre mòduls— o d'alumini —per metres, un clip a cada pota—).
  Detall a [`model.md`](model.md) › Carcassa › Suport, Trams, Penjadors, i › Ferratges per metres.
- **Electrodomèstics** (v46, `build/module/appliances.ts`, capa `AppliancesBuilder` entre els calaixos i les zones; el model
  a [`model.md`](model.md) › Electrodomèstic del compartiment; les dades, les fonts i les **decisions estàndard** a
  [`docs/electrodomestic/README.md`](../electrodomestic/README.md)). Per decisió de l'usuari (2026-10-15: «fem-ho tot el
  més estàndard possible»), **avisos** (`appliance`, amb la pàgina del catàleg) **només del que no lliga amb el
  fabricant**; el que és com ha de ser (com es munta el front, què s'ha mecanitzat, el sòcol del tram de davant) va a la
  **nota de la comanda** de l'aparell (Peces › Ferratges, LLEGEIX-ME: «electrodomèstic: no es fabrica · …»). Una
  plantilla amb electrodomèstics surt sense avisos.
  - **El nínxol**: la llum del compartiment (ample, alt i fons fins al fons o la columna) amb els rangs del catàleg o de
    la fitxa del fabricant (rentadores BSH: ≥ 600 × ≥ 818/820 × ≥ 555/551; Teka RBF: el nínxol de 178 de la indústria);
    el forn en columna (mòdul de 1200 o més) amb l'alçada de columna, el microones en un mòdul penjat amb la del moble
    penjat; la campana telescòpica, el mòdul (ample, fons i alçada interior). Si el fabricant no el publica, avís. El
    forn i el microones: **només el nínxol** (es cargolen pel marc als laterals a obra; cap mecanitzat).
  - **L'aparell** es dibuixa (`extras`, rol `hardware`: ni nesting ni «Elements sense nesting») amb la **foto** a la cara
    vista (`Panel.photo`: la de davant o, a la placa, la de dalt), del material del cos de l'item (sense, el de la família,
    `applianceBodyMaterial`; només es veu), i va a la **comanda** amb la marca i la referència.
  - **El front de moble** és un front com els altres (material dels fronts o, si se n'ha triat, el seu «Material del
    front», `ZoneAppliance.panelMaterial`: es talla, es canteja i va al nesting amb aquest material i el gruix de tots els
    fronts; cantells, tirador), de la mida que dona el
    compartiment (`frontTerritory`); als aparells de terra sense peça a sota, de `plinth` (100, el sòcol de cuina
    estàndard) cap amunt. Un combi en fa **dos** (el de baix i el de dalt, junta de 4 del catàleg): el de baix tan curt
    com permet el seu rang perquè el de dalt hi entri; les alçades BSH amb A (la base on seu l'aparell) i S (la peça de
    sobre). Avisos si l'alçada, el sòcol, el gruix o el **pes estimat** surten del que admet el fabricant; el pes, amb la
    **densitat estàndard del tauler** pel nom del material (`boardDensity`: DM/MDF i lacats 750, fusta massissa 675, la
    resta —aglomerat— 660). Muntatge **com diu el fabricant**:
    - porta fixa, porta sobre porta i **rentaplats de porta lliscant**: el front es cargola a la porta de l'aparell amb la
      **plantilla de paper que porta l'aparell**, **cap frontissa de moble** i, per defecte, **cap prebroca**
      (`pilotHoles` 0); amb `pilotHoles` 1 (paràmetre de l'item), 4 prebroques Ø2 × 10 (tag `appliance`) per front, a
      `fixInset` dels costats de l'aparell, `fixTop` de dalt i `fixBottom` de baix;
    - **frigorífic de porta lliscant**: frontisses de moble (les del mòdul, tantes com demana l'alçada del front, amb la
      filera System 32 i les plaques al lateral del costat, `addCups`) i la **guia lliscant**, cargolada amb la plantilla
      de l'aparell (prebroques només amb `pilotHoles` 1);
    - **rentadora**: les **cassoletes** de les frontisses de l'aparell, les de la fitxa (WIW24307ES: Ø35 a 21 del cantell
      del panell frontal de 592 de l'aparell, a 202 i +338,6 del cantell de dalt; WKD28490ES: Ø38 a 24,5, a 202 i +420;
      ≥ 12 de fons), tag `hinge`.
  - **El que cal mecanitzar al moble** (el que dona el catàleg): la **sortida d'aire** dels frigorífics de columna
    (≥ 200 cm²) com a retall a la peça de sobre del compartiment, de lateral a lateral menys 30 i arran del fons (tag
    `vent`); l'**entrada d'aire** (≥ 200 cm²) com a **reixeta al sòcol**: el retall al sòcol de fusta del tram, centrat
    davant del compartiment (a l'ample del compartiment menys 60, prou alt per a l'àrea; tag `vent`; `ModuleBuild.ventInlets`
    → `tramPlinth.ts`) i la «Reixeta de ventilació de sòcol» a la comanda (la nota diu la mida; si no hi cap, avís); el **retall de la placa** a la peça de sobre (560 × 490, a 50 del davant; avís si queda a menys de 40 del
    darrere o el tauler és prim) i el del **grup filtrant** a la base del moble penjat (496 × 264 a 25 del davant, tauler
    de 16–19), tag `appliance`. Sense la peça (taulell de pedra, mòdul sense tapa), la nota diu el retall i on fer-lo.
  - Tests `build/appliances.test.ts`.
- **Forats que es trobarien per dins** (`build/holeClash.ts`, `resolveHoleClashes`): System 32 a banda i banda d'un divisor
  → tots dos a (T − 1)/2; si un és d'un ferratge (placa, frontissa: `shortenFitting`), primer s'escurça l'altre, sempre amb
  avís `hole-clash` i mai per sota de 8 mm (si no, no es toca i ho diu); espiga de cantell contra un forat de cara →
  l'espiga s'atura 1 mm abans (mínim 10 mm, si no avís `hole-clash`). Els forats de guia de la caixa del calaix no arriben a la ranura del fons.
- **Casos degenerats** (trobats amb un fuzzer; `build/robustness.test.ts`): res surt de les peces i **mai mitja unió**
  (`dowelJoint`: si l'espiga no cap sencera al cantell i a la cara, no es fa cap dels dos forats). Espigues de divisors i
  prestatges fixos sobre el **tram de fondària comú** (`HorizontalRef.zRear/zFront`). Mides fixes que no sumen el total
  (±0,5 mm, sense «auto»): l'última s'ajusta i avís `layout` (`fitSizes`). Calaixos: **els fronts iguals fan la mateixa
  caixa** (la més justa del grup, a mig mm); espigues de la caixa amb `dowelsAlong` (dues a 30/20 mm dels extrems, una al
  mig o cap i avís); caixa de menys de `bottomOffset + fons + 30` mm d'alt o de 50 mm entre laterals → només el front i avís
  `drawer-box`. Portes estretes: sense cassoleta si no hi cap (`hinge`) i sense tirador si cauria a la columna de les
  cassoletes o fora (`handle`); abatibles estrets, forats a ¼ i ¾ o cap. Prestatges regulables a una filera lliure; fixos a
  ≥ 10 mm entre ells; els que no hi caben no es fan (`shelves`). Retranqueig dels prestatges: el del compartiment (Opcions de l'interior) o el del mòdul; amb un **pistó de gas** d'abatible (item amb `strutG`, el del front o el de la zona que el tapa) els prestatges es retiren com a mínim fins a 2 mm per darrere del pistó (a `sideSetback` del darrere del front, Ø15,6) i s'avisa (`shelf-strut`; per decisió de l'usuari, 2026-10-17: hi topaven). La tira LED segueix el retranqueig del compartiment. **Mòduls que es trepitgen** (> 0,5 mm en les tres
  direccions): avís `overlap` amb els dos noms. Les plantilles del catàleg no poden fer cap d'aquests avisos
  (`storeCatalog.test.ts`).
- **Cantells de la caixa** (`edges` a `buildModule`): laterals, base, tapa, divisors i prestatges, el de davant; amb el mòdul **lliure al terra separat de la paret**
  (`mountOf` = `floor`, `wallGap > 0`), també el de darrere, que queda a la vista (`rearEdge`; per decisió de l'usuari,
  2026-10-13: arrambat o penjat, no es veu; 2026-10-14: «el laminat del darrere només si no és moble de paret», també
  amb fons): laterals, base i tapa sempre llevat del fons cargolat (que els tapa), i divisors i prestatges només sense
  fons (`innerRearEdge`; amb fons queden darrere). Proves d'or: les dues illes de les plantilles de l'app canvien. Un material **massís** (`MaterialPref.solid`, Preferències › Materials › Fabricació «Massís · No es
  canteja»; amaga el Cantell) no es canteja: `buildComposition` treu tots els cantells de les seves peces al final
  (`isSolidMaterial`, que posen les preferències amb `setSolidMaterials` a `db/settingsStore.ts`, com la prebroca; sense,
  tot es canteja) i al 3D el cantell és la mateixa fusta. Test `build/edgeRules.test.ts`.
- **Peces iguals**: **sense avís** (per decisió de l'usuari, 2026-10-13: «el taller les identifica per l'etiqueta»,
  A.1.L.1 ≠ A.1.L.2). L'avís `same-size` d'abans (dues peces de la mateixa mida i material amb mecanitzats diferents) es
  va treure de `buildComposition`; `build/sameSize.ts` (`sameMachining`, `sameSizeConflicts`) es queda amb els tests.
- **Res amagat compta** (regla): el que s'amaga a la UI es conserva (tornar a encendre l'opció recupera els valors), però
  `buildModule` construeix des de `visibleModule` (`model/composition.ts`), que posa a un valor fix els camps de les opcions
  apagades: fons (material i gruix sense fons; ranura sense ranura; retirada si no és encastat), inglet si Cantonades no
  surt (també els fronts dels calaixos), tauler de taula sense tapa sencera, prestatges i barra als calaixos, al **front fix** i als
  compartiments dividits, gruix i «a ras» sense prestatges, alçades de calaix de més, frontissa de les dues portes, patró de
  reixeta de l'altre tipus, l'imant triat d'una reixeta amb frontisses i sense trapa, el marc d'una porta que no és de vidre,
  el «Fons del calaix» sense calaixos, els prestatges, les fileres, la barra i la llum d'un compartiment sense una peça a cada costat i el front d'un compartiment que no és aguantat pels quatre costats (`zoneSupport.ts`), l'estil dels fronts sense cap front, la folgança de les peces de dins d'un mòdul sense dividir, el front d'un compartiment **tapat** per
  les portes de tot el mòdul (el compartiment és com obert: prestatges i accessoris sí), el front d'una zona dividida que no
  són les portes de l'arrel (el front fix de tota la zona, els de les divisions de dins: no es fan ni tapen res), i els **fronts recordats** (`Zone.fronts`). Sense fons, el fons dels calaixos surt
  del material del cos. Sense cap prestatge, «Regulables» es veu i compta (fileres System 32). **Els llocs de ferratge que
  el mòdul no fa servir no es llegeixen** (vegeu Ferratges com a dades). **Una opció nova que amaga camps s'afegeix a
  `visibleModule` i a `build/hiddenState.test.ts`** (camps amagats a l'atzar i camins de la UI en un altre ordre → les
  mateixes peces i avisos).
- **Canviar el contingut d'un compartiment no llença res** (auditoria E1): `setFront` recorda l'últim front de cada tipus
  a `Zone.fronts` i `switchFront` («Contingut») el recupera sencer (calaixos, alçades, joc i opcions, ferratge, tirador) o
  comença en blanc (`defaultFront`, amb el tirador del front d'abans si el nou tipus en pot portar); els prestatges, la
  barra i la llum **no es toquen** en passar a calaixos (`visibleZone` els amaga per construir i tornen amb el contingut
  d'abans). Un front recordat sota una altra clau o dolent es treu en llegir, idempotent (`frontMemory.test.ts`).
- **Post-processos** (`core/process/processes.ts`, `panelProcesses`): el que toca a cada peça després del nesting, en ordre:
  2a cara → Inglet 45° → Cantell → Forats de cantell → Encolar (`Panel.assembly`) → Push (Tip-On) (`Panel.push`, fronts
  sense tirador; l'avís `push` surt un sol cop i demana frontisses sense molla). **2a cara** (`needsSecondFace`: forats o
  ranures a la cara B) → columna `SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO` del CSV amb `<ref>Volt` (com TopSolid; el taller
  en fa l'etiqueta «PROGRAMA 2a CARA»). La resta surt a Peces («Després del nesting») i al CSV de peces (Processos). L'app
  **no fa etiquetes** (les fa el taller): només ho anota.
