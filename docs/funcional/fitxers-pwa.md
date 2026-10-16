# Desar, fitxers i PWA

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Desar i fitxers
- **Tot el que es desa sol fa servir `useDebouncedSave`** (`lib/useDebouncedSave.ts`): Editor, Foto, Nesting, Ambients i
  Preferències. Desa amb retard, compara amb **l'últim valor desat** (no amb el que torna Dexie: es desava sense parar) i desa
  el pendent en sortir de la pàgina, en amagar l'app i amb `mobles:flush-save`. Obrir una cosa no la desa (no puja a la llista
  ni surt «Modificat»). Si `save` falla o torna `false`, aquell valor no compta com a desat i torna a quedar pendent.
- **Llegir sense perdre res** (`repairComposition`, `core/model/compositionRepair.ts`, test): una composició que no passa
  l'esquema es repara **element a element** (un objecte, una peça lliure, un model, un taulell o un forat dolents es treuen
  sols; d'un mòdul només els camps dolents; a l'arbre de zones, només el camp dolent; les unions amb `kind` —fronts,
  base, tapa…— es reparen camp a camp dins del seu tipus). El ferratge d'un front es llegeix **sencer o res**
  (`repairAtomically`): un `front.hardware` dolent (un paràmetre que no és un número, un `engine` d'una versió nova, un
  mecanitzat dolent) es treu sol, amb avís, i la porta, els calaixos o l'abatible es queden amb el del mòdul. `readComposition`
  (`db/compositionStore.ts`; la fa servir `compositionOf`) dona també `problems` i `unreadable`: sense cap mòdul, es queda
  sense (un moble pot tenir 0 mòduls); sense composició, la del mòdul de caixa (`params`); si no es pot reparar, caixa per defecte i **no es desa a sobre** (`updateProjectComposition` torna
  `false`; l'Editor no desa i avisa). Peces, Nesting i Exportar mostren l'error (`UnreadableAlert`, `useCompositionRead`) i
  no fan res, i el `.moble` no es desa (`projectToMoble` llança `UNREADABLE_COMPOSITION`). L'Editor avisa del que s'ha tret.
  Les parets dels ambients (`parseAmbient`) també: una obertura o un material dolents no treuen la paret.
- **Fitxer `.moble`** (`core/file/mobleFile.ts`, JSON versionat amb foto opcional; **v3 si porta ferratges col·locats a
  mà** (`usesHardwarePlacements`), **v2 si porta ferratges importats** (`usesImportedHardware`): una app d'abans el
  rebutja en lloc de treure'n `imported` o els col·locats; sense, v1 (`mobleVersionFor`); `parseMobleFile` fa la mateixa reparació i
  treu amb un avís el nesting, el calibratge de la foto (camp a camp) i les referències malmesos). Porta la càmera i els models
  de l'usuari que fa servir. El calibratge (`FileCalibrationSchema`) té els mateixos camps que `PhotoCalibration` (un test ho
  comprova en compilar). `updateProjectPhoto` no desa un calibratge d'una foto que ja no hi és.
- **El `.moble` no porta preferències** (per decisió de l'usuari): jocs per defecte, l'aspecte dels materials i la
  màquina són de **qui l'obre** (el moble s'hi adapta en silenci). Els ferratges sí que hi van, com a **còpia** a cada mòdul
  i front (`Module.hardware`, `front.hardware`): el moble es fabrica igual. Només s'avisa dels **materials** de la composició
  (`materialRefNames`, les claus d'`aliasMaterialRefs`) que no són a les preferències després dels àlies (`missingMaterials`,
  `missingMaterialsWarning` a `openMobleFile`: «Materials que no tens a Preferències: …; es veuran amb un color per defecte i
  al taller sortiran amb aquest nom. Afegeix-los a Preferències › Materials.»). Les referències que falten s'afegeixen.
- **Fitxer d'ambient** (`core/file/ambientFile.ts`, pur, test `ambientFile.test.ts`; I/O a `features/file/ambientIo.ts`;
  per decisió de l'usuari, «guardar un ambient com es fa als mobles i als objectes»). **Extensió `.moble`, com els mobles i
  els objectes** (per decisió de l'usuari: una sola extensió; el `format` de dins diu què és i qualsevol «Obrir fitxer» el
  porta al seu lloc; els `.ambient` desats abans es continuen obrint). JSON versionat (`format:
  "mobles-cnc-ambient"`, `version: 1`) amb `ambient` (`name` i `data` = l'`Ambient` sencer: parets i obertures, elements,
  grups, blocs, plànol de fons, materials, càmera i render a punt), `furniture` (un **`.moble` sencer** per cada moble i
  objecte enllaçat, `{ key, moble: MobleFile }`; els elements apunten a `key`, dos elements del mateix moble la
  comparteixen), `models` (GLB de l'usuari, **un sol cop** per id, no a cada moble) i `render` (la configuració del Render
  desada per a l'ambient, `SavedRender`). Es desa amb «Desar com a fitxer…» (`LuSave`) al ⋯ de la targeta d'Ambients i al
  ⋯ de la barra de l'ambient obert (`mobles:flush-save` abans), amb la finestra comuna del `.moble` (`SaveFileDialog.tsx`:
  `SaveAmbientFileDialog`; interruptor «Incloure les fotos dels mobles», **apagat**, mida en viu i avisos): un moble que
  ja no existeix o amb la composició il·legible no hi va (ni els seus elements) i el diàleg ho diu. `parseAmbientData`
  repara **part a part** com el `.moble`: cada moble passa per `parseMobleData` (la mateixa reparació; un moble d'una
  versió més nova rebutja el fitxer sencer), un moble il·legible es treu amb els seus elements, models i render malmesos
  fora amb avís, l'ambient amb `parseAmbient`; un `.moble` triat com a ambient: «és un moble, no un ambient». **Obrir-lo
  crea sempre un ambient nou i còpies noves dels seus mobles i objectes** (ids nous, enllaçats a l'ambient nou, no
  esborranys; per decisió de l'usuari, no es busquen els que ja tens), tot al **grup amb el nom de l'ambient** (com
  «Duplicar (per a un client)»: `remapMobleItems`); els models es tornen a crear amb el mateix id i les referències que
  falten s'afegeixen (les peces de `mobleIo.ts`: `restoreUserModels`, `createProjectFromMoble`, `addMissingReferences`), i
  s'avisa dels materials que no tens de l'ambient i dels mobles (`missingAmbientMaterials` → `missingMaterialsWarning`).
  **No porta**: preferències (com el `.moble`), la foto de les finestres del render (és global) ni el bloqueig de la càmera.
- **Obrir fitxer** (`features/file/openAnyFile.ts`, `openAnyFile`, i el botó `OpenFileButton`): les tres galeries (Mobles ·
  Objectes · Ambients) i el doble clic obren **qualsevol** fitxer de l'app pel seu `format` (`fileKind`) i **com el que
  és**: un `.moble` com a moble o objecte (segons la composició) i un `.ambient` com a ambient, sigui quina sigui la pàgina;
  si no és de la pàgina, el missatge ho diu (`openedNote`: «És un moble: s'ha obert a Mobles.»). Un sol `accept`
  (`.moble,.ambient,.json`).
- **Obrir un `.moble` o un `.ambient` amb doble clic** (app instal·lada, Chromium): `file_handlers` (`.moble`, `.ambient`)
  i `launch_handler` `focus-existing` al manifest; `useLaunchFiles` (`features/file/useLaunchFiles.ts`, a `App`) llegeix la
  `launchQueue` i fa el mateix que «Obrir fitxer» (`openAnyFile`; espera les preferències). Safari/iOS no ho suporta.

### PWA
- **Càrrega a demanda** (`App.tsx`, `React.lazy` + `Suspense`): Editor, Peces, Nesting, Exportar, Foto, Preferències i l'editor d'ambients es carreguen quan s'obren; el xat de l'assistent (`ChatPanel`) i el SDK de l'API de Claude (bloc `sdk`, ~220 KB) també, en obrir-lo (la barra de l'ambient és a part, `ambients/AmbientTopBar.tsx`). `advancedChunks` només posa al bloc de three el nucli (`three/build`, `@react-three`, `three-stdlib`): els carregadors i exportadors de `three/examples` van amb qui els fa servir. React va al seu bloc (`react`, prioritat més alta): si no, entrava al de three i tota l'app carregava three d'entrada. **Res d'entrada importa three**: les galeries carreguen el dibuix de les miniatures amb `import()` (`projects/thumbJobs.ts`, `ambients/ambientRender.ts`; `THUMB_VERSION` és a `viewer/thumbVersion.ts`), `measureGlb` l'importa en pujar un model i `mobleIo` fa `forgetModel` amb `import()`. JS d'entrada ~1,5 MB (430 KB gz), abans 2,5 MB. Els fallbacks JS de Draco/Basis no es precachegen. Les textures procedurals que es llegeixen (`getImageData`) fan servir `willReadFrequently`.
- **Icones a sang**: quadrat sencer amb el fons `#1a202c`, **sense cantonades rodones ni transparència** (iOS i Android hi
  posen la màscara; si ja és arrodonida, les puntes surten blanques). Font `public/icon.svg` → `pwa-192/512.png`,
  `apple-touch-icon.png` (180); `pwa-maskable-512.png` (`icon-maskable.svg`, la marca al 78 %). El `favicon.svg` sí que és
  arrodonit (amb transparència).
- **Pantalles d'inici d'iOS** (`public/splash/`, `apple-touch-startup-image` a `index.html`): una per mida i orientació
  (marca, «Mobles» i «Configurador de mobles per a CNC» en Inter). No es precachegen (`globIgnores`). Les PNG es generen des
  de l'SVG (no s'editen a mà).
- **Versió** (com a rack): `__APP_VERSION__` = nombre de commits i `__APP_COMMIT__` (git en construir, `vite.config.ts`; sense
  git, `APP_VERSION` o «dev»), petita al costat del nom al menú i al manifest. El Dockerfile instal·la git i el `.git` no
  s'ignora.
- Precache (`vite.config.ts`): només l'app (JS, CSS, HTML, icones), ~5,4 MB. Els models `.glb` del catàleg (`/models/`,
  plantes, ~4,4 MB), els HDRI del render (`/hdr/`, ~4,2 MB), les fotos de textura (`/textures/`) i els pesos d'OIDN
  (`/oidn/`, `oidn.ts` els valida i esborra els dolents de la seva memòria cau) no: `runtimeCaching` CacheFirst en fer-los
  servir (sense connexió, només els que ja s'han fet servir algun cop); splash no.
  El WASM d'OpenCascade (`assets/occt-import-js-*.wasm`, importar ferratges) tampoc: CacheFirst en fer-lo servir, a la
  seva memòria (`mobles-occt`, `src/pwaWasmCache.ts`; amb Draco i Basis a la mateixa de 4, en sortia). L'API i els fitxers de
  Poly Haven (importar models) no passen per cap memòria cau: sense connexió fallen amb `OfflineError` i la UI ho explica.
