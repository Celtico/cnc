# Materials

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Materials
- **Categories** (`MaterialPref.category`, `materialCategory`, `withCategory`, `MATERIAL_CATEGORIES`): **Taulers** · **Fons** ·
  **Simulació** (als antics es dedueix de `forBacks` / `cnc`; l'antiga «Metall, pedra i vidre», `hard`, es llegeix com a
  Simulació: per decisió de l'usuari és el mateix, no es tallen a la CNC). A Preferències es llisten per
  categoria (camp Categoria en lloc dels interruptors «Per a fons» i «Es talla a la CNC») i el `MaterialSelect` agrupa per
  categoria. Els que no són de CNC (ferro, inox, pedra, vidre) van arribar a la v2 de les preferències. Els de **simulació** (`SIM_MATERIALS`: v3 teixits, vellut, cuir, parquet, rajoles, microciment, pintures,
  electrodomèstics; v4 els de les escenes de revista; v5 els llums; `SIM_MATERIALS_SINCE`: la migració només afegeix els d'una
  versió posterior a la desada, així els esborrats no tornen; v47 «Electrodomèstic negre», `APPLIANCE_MATERIALS`, el
  vidre negre del cos dels forns, microones i plaques: un lacat negre brillant, no un vidre, que el de l'app és translúcid) només es veuen: `cnc: false`, no surten als selectors del cos
  ni del taulell. Els que no són de CNC pinten els cantells amb el mateix material. Acabats `metal`, `glass`, `fabric`
  (trama) i `tiles` (rajola amb junta), procedurals (`patternTexture`).
- **Textures procedurals editables** (`settings/TextureEditor.tsx`, «Editar la textura»): mostra gran a escala real amb zoom;
  s'aplica en acceptar. A l'ordinador, com a molt el 90 % de l'alçada i el cos es desplaça (el títol i els botons a la
  vista); el diàleg es queda muntat tancat (muntar-lo ja obert el tancava sol: el focus comptava com «de fora»). **Fusta** (`Finish.wood.gen`, `WoodGenSchema`, `WOOD_PRESETS` + `WOOD_EXTRA_PRESETS`), **Teixit**,
  **Rajola** (junta, variació, quadrícula o trencajunts), **Pedra** (`stone`: marbre, granit, travertí, formigó; soroll
  periòdic), **Metall** (polit, raspallat, martellejat), **Vidre**, **Color llis i lacat**. Tots menys la foto (`isEditable`).
  Tot a `textures.ts` (canvas; `woodTexture(species, gen)`, `patternTexture(kind, color, grout, opts)`), memòria de 48.
- **Textures reals** (`Finish.kind = "image"`): foto reduïda a 1024 px JPEG i amplada real (mm); `photoTexture` en mirall o,
  amb «Sense costures (seamless)» (`Finish.seamless`), repetició normal. `Finish.aspect` fa que l'alçada real sigui
  `tileMm × aspect` (es mesura en triar-la o, a les antigues, en obrir la targeta; abans s'estirava). `faceTexture` creua
  les repeticions quan la veta va en v (three escala després de girar). Botó visible «Posar una foto de textura» (a més de
  l'Acabat «Foto (textura)»), amb miniatura, «Canviar la foto» i «Treure-la».
- **Mapes PBR de l'usuari** (com els jocs de Poly Haven; `settings/TextureMapRows.tsx`, `settings/textureImport.ts`, pur
  a `core/photo/pbrMaps.ts` amb test): amb l'acabat de foto, sota «Foto» (miniatura de la foto de color) hi ha **Relleu**
  («Mapa de relleu (normal)») i **Brillantor** («Mapa de brillantor (rugositat)»), cadascun amb miniatura, «Posar»/«Canviar»
  i «Treure». Es redueixen a 1024 px com el color; el normal i la rugositat són **dades**: es llegeixen sense gestió de
  color (`createImageBitmap` amb `colorSpaceConversion: "none"`), el normal en JPEG 0,95 (alfa opac) i la rugositat en
  grisos (JPEG 0,9; d'un ARM/ORM, el canal verd). El normal es desa sempre en **OpenGL**: «Invertir el verd (DirectX)»
  (`Finish.normalDx`, només recorda l'interruptor) inverteix el verd en carregar-lo i, si ja n'hi ha un, el torna a
  invertir. La foto de color en dona el color mitjà (`Finish.color`, STEP). **«Joc PBR»** (a tots els acabats):
  «Carregar joc de textures…» (diversos fitxers o un `.zip`, `unzip`; el `.zip` de Poly Haven tal com es baixa, en
  qualsevol format), «Carpeta…» (`webkitdirectory`) o deixar-los anar a sobre (`pickedFromDrop`). **EXR** (els zips «Blend»
  de Poly Haven porten el normal i la rugositat en EXR): `components/viewer/exrImage.ts` (`EXRLoader` de three a demanda,
  `floatToRgba8`: 0–1 → 8 bits, files de baix a dalt; el normal es queda OpenGL); entre dos fitxers del mateix mapa, la
  imatge guanya a l'EXR. Un joc de Poly Haven (`<id>_<res>` als noms, `readPickedTextureSet`) pren la mida real de l'API
  (`/info` `dimensions`; sense connexió, la d'abans). **Biblioteca › «Joc de textures…»** fa un material nou de Simulació
  amb el nom del joc (el de Poly Haven si hi ha connexió). Es reconeixen pel nom (`classifyTextureFile`/`planTextureSet`: mana l'última paraula que és un
  mapa —el nom del material va al davant—; diff/diffuse/albedo/basecolor/color/col → color; nor/normal/nrm, `_gl`/`_dx` →
  relleu i invertir; rough/roughness/rgh i ARM/ORM → brillantor; disp, ao, metal… no es fan servir; el normal OpenGL i la
  rugositat pròpia guanyen). Amb foto de color substitueix foto i mapes (i posa «Sense costures»); sense, només els mapes
  d'una foto que ja hi era. L'amplada real és la de sempre. Visor, miniatures, render (CPU/GPU), GLB/USDZ i
  exportar/importar les preferències els llegeixen com els de l'app (tot passa per `photoTexture`, memòria per `src`); a
  Dexie i al JSON de preferències no hi ha límit de mida (un material amb els tres mapes fa ~0,5–1 MB).
- **Canviar l'Acabat no perd res** (`MaterialPref.previousFinishes`, `switchFinish`/`restoredFinish` a `materialOps.ts`): l'acabat d'abans es guarda per tipus i, en tornar-hi, es recupera (la foto amb els mapes de relleu i brillantor). Un material de foto de l'app que ja l'havia perdut la recupera del material inicial (mateix id o nom). El que torna a ser l'actual surt de `previousFinishes` (si no, una foto quedaria desada dues vegades).
- **Materials de foto amb relleu** (v6): 22 jocs de Poly Haven (CC0, 1K) a `public/textures/<id>/{diff,nor,rough}.jpg`
  (normal OpenGL, rugositat en grisos), manifest a `core/model/textureSets.ts` (`TEXTURE_SETS`: nom, mida real d'una repetició,
  direcció de la veta a la foto, ús). `PHOTO_MATERIALS`: xapes a **Taulers** (16/19/30: «Roure (foto)», «Noguera (foto)»,
  «Noguera fumada (foto)», «Fusta fosca (foto)»), pedres i la resta (parquets, estucs, formigons,
  microciment, terratzo, murs de pedra, jute, llana espiga, vaquer) a **Simulació**; la migració v6 només afegeix els que
  falten. També a la biblioteca («Fotos · …»). L'acabat `image` porta `normalMap`, `roughMap`, `grain`,
  `roughness` (multiplicador) i `color` (STEP); `grain` `y` = veta vertical a la foto (es gira un quart). Visor:
  `MeshStandardMaterial` map + normalMap + roughnessMap amb la mateixa repetició i gir, sRGB només el color. Els `.jpg` no es
  precachegen (~14 MB, vegeu PWA). Les miniatures esperen les fotos (`photoTexturesIdle`).
- **Els materials de sempre amb la foto** (v7, per decisió de l'usuari: «a tot arreu»; `core/model/photoUpgrade.ts`,
  `PHOTO_UPGRADES`, nom de sempre → joc, només on la foto és fidel, mirat a `diff.jpg`): Roure massís / xapat, Melamina roure,
  Revestiment de roure → `oak_veneer_01`; Noguera xapada → `walnut_veneer_02`; Parquet de roure → `wood_floor`; Microciment
  gris → `gravel_concrete_03`; Formigó → `concrete_layers_02`; Pedra calcària → `marble_01`; Pedra de paret →
  `medieval_blocks_03`; Jute → `hessian_230`; Teixit gris → `poly_wool_herringbone`. **Els noms no canvien** (CSV del taller,
  composicions): només l'acabat (gruixos, cantell, veta, categoria i id es queden; una foto pròpia no es toca). Lacats, colors,
  metalls, vidres i el que no té foto fidel (freixe, wengué, estucs clars, teixits de color…) queden procedurals (l'acabat
  `image` no es pot tenyir). `upgradeToPhoto` (migració v7 i valors inicials, idempotent): els «(foto)» el joc dels quals ja
  fa servir un de sempre desapareixen (els seus gruixos passen al de sempre); la resta perden el «(foto)» («Fusta fosca»,
  «Terratzo»…; si el nom ja és d'un altre material, es queda amb «(foto)»). Només passa a foto un material amb l'acabat per
  defecte d'abans (`OLD_FINISHES`, igualtat estructural): un de retocat es queda, i el «(foto)» al costat. **Àlies** (`resolveMaterialAlias`: «Roure (foto)» → «Roure massís / xapat», «Fusta fosca (foto)» → «Fusta fosca»;
  `aliasMaterialRefs`: claus `material`, `material2`, `frame` de les obertures, `…Material`, `scene.floor/wall`; a
  `normalizeComposition`, `parseAmbient`, `readPresentationScene` i preferències): «X (foto)» → «X» només si no hi ha cap «X
  (foto)» i sí «X» (`setKnownMaterialNames`, de `settingsStore`). **Sense noms coneguts (preferències encara no llegides) no es reescriu res** (abans un moble
  obert massa d'hora perdia el seu «Roure (foto)» en desar-lo): per això l'Editor i l'editor d'Ambients esperen `useSettings().loading`. La biblioteca fa el mateix (`LIBRARY_PHOTO_UPGRADES`).
  Cantells (`resolveEdgeFinish`): un cantell lacat, «sense cantell» o buit és el mateix tauler (un MDF lacat antracita no
  fa el cantell blanc); si no, material de la mateixa foto, després el mateix material si el cantell en diu la primera
  paraula, després un altre material que hi surti **sencer** (no per la primera paraula) i paraules clau.
- **v8**: mida real de les xapes de foto (mirada a `diff.jpg`: fibres de roure a 2–3 mm, catedrals de noguera de ~250–300 mm;
  roure 1100 → 600, noguera 1200 → 900, noguera fumada 1200 → 800; `rescalePhotoTiles`, només si encara
  tenen la d'abans, `PREVIOUS_TILE_MM`). **v9**: `restorePhotoThicknesses` (16 · 19 · 30) i `TEMPLATE_MATERIALS` (Melamina 19
  i DM 10 de `DEFAULT_CABINET`, MDF lacats de les plantilles) s'afegeixen si falten. Un test comprova que tots els materials
  de plantilles i ambients del catàleg són a les preferències inicials.
- **v12, duplicats fora** (`mergeDuplicateMaterials`, additiu i sense perdre res): «Melamina 19» → «Melamina blanca» i
  «DM 10» → «DM (fons)» (eren iguals; només si encara són els inicials, `RETIRED_TEMPLATE_MATERIALS`, i el de sempre hi
  és; els gruixos hi passen) i les fulles «Pi» (`sim-pine`) → «Fulles de pi» (es confonia amb la fusta «Pi» de la
  biblioteca; si el nom és lliure i cap altre material es diu «Pi»; «Pi» no és un àlies general: un moble de fusta de pi es
  queda «Pi»). `DEFAULT_CABINET` i les plantilles ja fan servir els de sempre. Els canvis de nom
  (`SettingsParse.renames`) es segueixen a les preferències (per defecte, taulers) i, a `loadSettings`, a tots els mobles
  i ambients desats (`renameMaterialEverywhere`, la mateixa transacció); l'àlies (`MATERIAL_MERGES` a
  `resolveMaterialAlias`) llegeix els `.moble` i dades antigues. Conseqüència al taller: el tauler del CSV ja no porta el
  gruix dues vegades («DM (fons):…x10», `T03_DM_fons_10.xcs`; abans «DM 10:…x10», `T03_DM_10_10.xcs`).
- **v13, gruixos del catàleg** (`addCatalogThicknesses`, només afegeix): Melamina blanca/gris/roure 30, Roure massís /
  xapat 40, Freixe xapat 16 i 30 (les plantilles els feien servir). Un test comprova que cap plantilla del catàleg avisa de
  materials ni gruixos amb les preferències inicials; l'avís de gruix no surt als materials de Simulació.
- **Noms únics** (`materialNameKey`: sense majúscules ni espais repetits): l'esquema (`MaterialListSchema`) rebutja els
  repetits; en llegir unes preferències, un de repetit passa a «X 2» amb un avís (`dedupeMaterialNames`).
- **Canviar el nom** (Preferències › Materials): en acabar (sortir del camp o Retorn; Esc el desfà), no a cada tecla; un
  nom repetit o buit surt en vermell a sota i es queda l'antic. Els mobles, objectes i ambients desats el segueixen
  (`renameMaterialRefs`, les claus de `mapMaterialRefs` = les d'`aliasMaterialRefs`; `db/materialRefs.ts`
  `renameMaterialEverywhere`, una transacció amb les preferències): **sense tocar `updatedAt` ni `edited`** (com
  `saveProjectCamera`) però amb la miniatura per refer (`thumbAt` fora). També el tauler i el fons per defecte, les mides
  de tauler (`renameMaterialInSettings`), les mides de tauler per material desades al nesting de cada moble
  (`renameNestingSheets`) i l'escena de Presentació (`renamePresentationMaterial`). Avís «Nom canviat: N
  mobles i M ambients actualitzats». Importar un fitxer d'abans de la v12 fa el mateix amb els seus `renames`.
- **Eliminar** (`DeleteMaterialDialog`): diu on es fa servir (`materialUsage`: mobles, objectes, ambients; i
  `materialSettingsUsage`: tauler/fons per defecte, mida de tauler) i ofereix un substitut (les referències hi passen com
  en un canvi de nom; `removeMaterialFromSettings`); el tauler o el fons per defecte no s'eliminen sense triar-ne un.
  «Restaurar valors inicials» (i eliminar sense substitut) corregeix el per defecte i les mides de tauler que apuntaven a
  un material que ja no hi és (`fixMaterialRefs`).
- **Selectors** (`core/model/materialOps.ts`): `boardChoices` (només taulers de CNC: cos, fronts, taulell i sòcol, tauler
  per defecte), `backChoices` (taulers i fons: fons del mòdul i per defecte, mides de tauler) i `partChoices` (peces
  lliures: tot menys els fons; ferro, pedra i vidre hi van a propòsit, la simulació per als objectes). Un moble fet amb un
  material que ja no és a la llista el conserva: el `MaterialSelect` el mostra com a valor actual amb ⚠ i «No es talla a
  la CNC» / «Només de simulació» / «No és a Preferències».
  Una peça lliure nova amb un material que no és a Preferències pren el tauler per defecte (`freePartFor`; no el primer
  de la llista: els nous s'hi afegeixen al davant).
- **Avisos de materials** (`core/build/materialIssues.ts`, `materialIssues(build, comp, materials)`: el build no llegeix
  preferències): `unknown-material` («El material «X» no és a Preferències: es veu amb un color per defecte i al taller
  sortirà amb aquest nom») i `thickness-not-listed` («El gruix 18 mm no és dels gruixos de «X»»), a «Avisos de fusteria»
  de l'Editor i a Exportar. A «Per defecte als mòduls nous», un gruix que no és del material és una nota, no una pastilla.
- **Biblioteca** (`settings/libraryItems.ts`, `MATERIAL_LIBRARY`; diàleg `MaterialLibrary`): «Afegir» obre una graella de
  materials fets (fustes, lacats, pedres, metalls, vidres, teixits, terres, parets), «En blanc» i «Joc de textures…» (vegeu Mapes PBR). `libraryItems.test.ts`.
  Els que ja tens (mateix nom o mateix acabat, `ownedMaterial`) porten «Ja el tens»: tocar-ne un no fa un «X 2» en
  silenci, sinó que ofereix «Obrir el meu» o «Afegir una còpia».
  (Les dades no són a `materialLibrary.ts`: vegeu Fast Refresh.)
