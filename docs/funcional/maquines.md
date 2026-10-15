# Màquines i regles de mecanitzat

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Màquines i regles de mecanitzat
- **Màquines CNC** (`settings/MachinesPane.tsx`, `MasterDetail`): la SCM del taller (Xilog Maestro 2.00.004, sèrie
  AA10008021) s'**importa de Maestro** amb un **sol importador** (`core/machine/maestroImport.ts`, `importMaestro`; zona
  «Importar de Maestro» amb «Triar carpeta…» (`webkitdirectory`) · «Triar fitxers…» i drag & drop de fitxers i carpetes,
  `webkitGetAsEntry`; component compartit `components/ImportDropZone`, `components/pickedFiles.ts`): la carpeta `<sèrie>.machinecontext`, un projecte `.pgmx` (zip o carpeta desplegada amb l'XML,
  `def.atrx`, `*.cfgx`) o fitxers solts. Tipus pel **contingut** (`detectMaestroFile`), agrupat per carpeta
  (`planMaestroImport`); primer el context (crea o actualitza per sèrie) i després els .pgmx: a la màquina de la seva
  carpeta (sèrie del `.cfgx`; sense `.tlgx`, eines de l'`.atrx` sense mides, `machineFromAtrx`), a la triada, a la per
  defecte o a una nova (`addPgmxTools`). Un sol avís amb el resum. Tests amb els fitxers reals (`maestroImport.test.ts`).
- Lectura (`core/machine/maestro.ts`, lector XML propi `xml.ts`, .cfgx = zip amb `DecompressionStream`, `core/file/zip.ts`):
  eines (`MachineTool`: codi, nom, broca/fresa/disc/agregat/palpador, vertical/horitzontal, Ø, fondària útil, gruix del disc,
  sentit, capçal i mandrins, `mounted`, `auto`), versió, camp de treball, àrees, capçalera. Model a `core/model/machine.ts`.
- Desat a `Settings.machines` (**preferències v10**, additiu); **una per defecte** (`defaultMachine`, ★): la de l'export .xcs
  i la que dona la separació i el marge del nesting. Detall: nom, sèrie, configuració, Maestro, camp, per defecte, «Projecte
  de Maestro (.pgmx)», «Programes .xcs» (àrea de treball, repeticions, taula, cicle continu, passants de més, broques,
  ranures disc/fresa, codificació amb/sense BOM), «Programes per tauler» (separació, marge fix o «Ø de la fresa +», martiri,
  peces petites al final/principi i la capçalera del nesting: opcions mecàniques amb l'hex i els bits al costat, `bitsLabel`;
  posició X/Y/Z/gir; paràmetres de `Pload` com a text, `loadMacroArgs`, es desen en sortir si són vàlids) i **taula d'eines per tipus** (codi · nom · Ø · fondària · posició; tocar-ne una l'edita; «Afegir eina» per a les
  que el `.tlgx` no porta, amb el codi de Maestro; una «Eina nova» `NOVA1` no es tria fins que té codi). Tornar a importar
  la mateixa sèrie (`mergeReimport`) conserva, eina per eina, els camps tocats a mà (`MachineTool.edited`), les eines
  afegides i les opcions. Una eina invàlida a les preferències només treu aquella eina (`repairMachine`; si encara falla, es
  torna a provar sense les regles d'abans de la v11 i/o sense les opcions de nesting, que tornen a les inicials amb un avís).
- **Projecte .pgmx** («Importar .pgmx» al detall = el mateix importador amb la màquina triada; `core/machine/pgmx.ts`): el
  paràmetre `tool` de l'MSL és el **nom** de l'eina i el Maestro del taller (2.0.5) les ha rebatejades (ID 2149647431: `E128`
  al .tlgx, «12mm diamant nesting» al projecte `docs/maestro/samples/Proyecto1.pgmx.xml`). Per ID (`MachineTool.id` =
  `Key/ID` del .tlgx) posa `mslName` (`toolMslName`) i el nom; el codi no canvia. També la capçalera (`MachiningParameters`):
  `SetMachiningParameters(fields, repeticions, taula, mecàniques, cicle continu)`, per defecte la del projecte
  (`DEFAULT_HEADER`: AD, 1, 10, 16973824, false). Els **programes per tauler** fan servir la capçalera del programa de nesting
  real del taller (`Machine.nesting.program`, `nestProgram`, `DEFAULT_NEST_PROGRAM`: MechanicalOptions 16777216,
  `SetWorkpieceSetupPosition(0, -20, 0, 0)`, macro `Pload`, campana 1, `SetWorkPieceFallPrevention`;
  `SetPreserveWorkingSequence` = el `preserveWorkingSequence` de la capçalera, `true` sense valor). A la UI, «Opcions
  mecàniques» només surt a «Programes per tauler» (la de la capçalera general només afecta el per peça).
- **Regles de mecanitzat** (del germà; **del taller, no de cada màquina**: `Settings.machiningRules`, per decisió de l'usuari
  «en un taller les regles són les mateixes per a les dues CNC»). Pàgina pròpia Preferències › **Regles de mecanitzat**
  (`rules`, `LuRoute`, just després de Màquines CNC), sense triar màquina; `settings/MachineRules.tsx`, `RulePicker`;
  `core/machine/rules.ts`; detall a `docs/maestro-xcs.md`. A sota, el grup **«Prebroca dels cargols»** (`Settings.kitPilot`;
  per decisió de l'usuari, aquí i no a Ferratges: no és un ferratge, és una regla del taller). Inicials (`defaultMachineRules`): ranures «8mm diamant» a 6 mm per
  passada (`CreateBidirectionalMillingStrategy`), caixeres «12mm diamant nesting» (`CreateContourPocket`), perfilar per gruix
  (8–22 → «12mm diamant nesting», 23–41 → «14mm diamant nesting»), rampa als perfilats del nesting (`SetApproachStrategy(true,
  false, k)`, des del mig del costat recte més llarg), peces petites (menys de 0,8 m²; `maxSide` 0 = no compta) en 3 passades
  (Z/XY 1/1, 0,5/0 i la final al martiri o als passants, `overMaterial`). Opcionals, amb el comportament d'abans si no hi
  són: **pell dels forats i ranures gairebé passants** (`blind`, `cncBlindDepth`: 1 mm a partir de gruix − 0,5, el que es feia sempre; només al
  .xcs, el STEP es queda amb 1) i **sentit dels contorns i talls** (`cutMode`: `asIs` · `conventional` = en oposició, com
  TopSolid · `climb`; `cutLoop`, i a la Vista CAM una punta amb el sentit).
  - Eines **pel nom a la màquina que exporta** (`findRuleTool`, només `usableTool`, les mateixes que ofereix el selector, amb
    les freses de totes les màquines); si falta, no es pot fer servir o no arriba, tria de sempre i un sol avís per regla i
    eina. A la pàgina, una línia per màquina: «✓ té totes les eines» o «falta «X»» (`missingRuleTools`).
  - L'export llegeix les regles a `Machine.rules`, on les posa **`machineWithRules(settings)`** (la màquina per defecte amb les
    del taller, `withWorkshopRules`; el mateix objecte per a les mateixes preferències): `useNesting`, Nesting i Exportar
    l'han de fer servir en lloc de `defaultMachine(settings.machines)`, si no la separació i les eines serien les inicials.
  - **Preferències v11** (additiu): sense `machiningRules`, les de la màquina per defecte (o la primera que en tingui; si cap,
    les inicials, `rulesFromMachines`) i les `rules` de les màquines es treuen (l'esquema les llegeix per compatibilitat; un
    fitxer d'abans importat també les passa); idempotent. Els valors provisionals d'abans (Ø + 1, 300 mm / 0,1 m²) es migren
    un sol cop (`Machine.rulesVersion`, `migrateMachine`) i es desa, així una tria posterior de l'usuari es queda.
    «Restaurar valors inicials» torna a `defaultMachineRules()`.
- **Coherència (ronda 5)**: les eines surten igual a tot arreu, «codi · nom · Ø» (`toolLabel`, `core/model/machine.ts`: Màquines,
  Regles i Nesting); els fronts de calaix «auto» es fan a mig mil·límetre cap avall (`snapAutoHeights`: fronts iguals,
  mateixa mida i mateixos mecanitzats; el que sobra queda al joc de dalt); la separació del nesting només compta les peces que
  caben en algun tauler (`cncNestOptions`: un taulell de 3500 mm no fa més ampla la separació).
  A Peces, el detall de la fila diu els cantells i inglets **reals** de cada peça (ref), com el LLEGEIX-ME d'Exportar (la fila
  els dona normalitzats per agrupar les mirall). A Exportar, els avisos del STEP es calculen quan el navegador és lliure.
