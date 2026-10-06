# Desar ambients com a fitxer (`.ambient`)

Estudi per a la millora «Desar ambients» de [`PROMPT-millore-v1.md`](../prompt/PROMPT-millore-v1.md) §5 (línies 176-190)
i la relació amb «Selecció dels ambients» (línies 194-206). **Només estudi: no s'ha tocat cap fitxer de codi.**

> Objectiu del propietari: «Desar com a fitxer» un ambient amb els mobles, els seus plànols, la vista/càmera, la
> configuració del render i la resta del que cal. En obrir-lo, buscar si els mobles encara existeixen; els que no hi són
> no surten o s'indica que falten.

> **Prioritat**: CLAUDE.md («Què és») diu que ambients i renders són **decoratius** i no s'hi dedica temps mentre el
> nucli (fabricació) tingui coses per resoldre. Aquesta fitxa és per a la fase de priorització: és de prioritat baixa
> llevat que el propietari ho decideixi.

---

## 1. Model de dades actual de l'ambient

### 1.1 Taules de Dexie (`src/db/db.ts`)

| Taula | Clau | Què hi ha | Línies |
|---|---|---|---|
| `ambients` (v4) | `++id` | `AmbientRow`: `name`, `data: unknown` (= `Ambient`, es valida amb `parseAmbient`), `folder`, miniatura (`thumb*`), dates | 107-121, 160-165 |
| `projects` | `++id` | `Project` (mobles **i objectes**: un objecte és un moble de tipus `objecte`); la composició (`composition`) s'afegeix al tipus a `db/compositionStore.ts:9-20` | 79-104 |
| `photos` | `++id` | foto del racó d'un moble (`Blob`), `projectId` | 68-77 |
| `models` (v5) | `id` ("user-…") | `UserModel`: GLB de l'usuari (`Blob`) + mida | 123-130, 166-172 |
| `settings` | `"user"` | preferències (materials, també les **textures pròpies en data URL**) | 133-137 |

Funcions d'ambient: `createAmbient` (278), `updateAmbient` (283-294, conserva la càmera desada), `saveAmbientCamera`
(297-304, sense tocar `updatedAt`), `duplicateAmbient` (320-349, duplica els mobles enllaçats i remapeja `projectId`).

### 1.2 `Ambient` (`src/core/model/ambient.ts`)

- `AmbientSchema` (118-133): `walls`, `items`, `plan?`, `floorMaterial?`, `wallMaterial?`, `outsideFloorMaterial?`,
  `ceilingMaterial?`, `camera` (tolerant), `render` (tolerant). `parseAmbient` (139-164) mai llança i repara camp a camp.
- **Els mobles van per referència, no incrustats** (`AmbientItemSchema`, 70-87): `{ id, kind: "moble", projectId: int,
  x, y, rot, elevation?, group? }`. `projectId` és la clau autoincremental **local** de Dexie: fora d'aquest navegador no
  vol dir res (en un altre aparell, l'id 12 pot ser un moble diferent o no existir). Els blocs (`kind: "block"`, llegat)
  sí que van sencers (forma, mides, material).
- Les mides generals que es toquen a l'ambient (`resizeComposition`, 526) **es desen al moble enllaçat**, no a l'ítem:
  la composició del moble ja és «el moble tal com és a l'ambient».
- **Plànol de fons** (`PlanImageSchema`, 91-103): ja està incrustat com a data URL JPEG de 2400 px
  (`AmbientEditor.tsx:1247`, `toDataURL("image/jpeg", 0.85)`), amb calibratge, opacitat i bloqueig.
- **Càmera** (`Ambient.camera`, `core/model/camera.ts:9-19`): posició, target, fov i `pose` (`home`/`eye`). Ja és dins de
  `data`.
- **Render a punt** (`AmbientRenderSchema`, 109-116): `mood` i `focal` de les escenes del catàleg; `Ambient3D.tsx:446`
  ho passa a `scene.userData.renderPreset`.

### 1.3 Com es resol un moble a l'ambient (`src/features/ambients/ambientData.ts`)

- `useItemGeometries` (63-96): busca `projects.find((x) => x.id === it.projectId)`; si no hi és, la geometria és `null` i
  l'element **no es dibuixa** (ni al plànol ni al 3D).
- `itemName` (99-102): sense moble → **«Element esborrat»**. A l'inspector, `AmbientEditor.tsx:926-937`: «Aquest moble
  s'ha esborrat de la llista.» (`fg.error`). **Ja existeix, doncs, un estat «falta» per als mobles esborrats**; el fitxer
  el pot reaprofitar.

### 1.4 El que viu fora de `Ambient.data` (i s'ha de recollir a part)

| Dada | On | Clau |
|---|---|---|
| **Configuració del render** («es recorda per ambient») | `localStorage`, `renderPrefs.ts:17-36` (`SavedRender`: `opts`, `look`, `mood`, `res`, `limit`, `room`, `format`, `sky`) | `mobles:render:ambient:<id>` (`AmbientEditor.tsx:841`, `saveKey`) |
| Càmera bloquejada | `localStorage` | `mobles:ambient-camera-lock:<id>` (`AmbientEditor.tsx:215`) |
| Opcions de vista (graella, sostre, casa de nines, ombres…) | `localStorage`, globals | `mobles:ambient-*` (`AmbientEditor.tsx:175-183`) |
| **Foto de les finestres** («La meva foto», `opts.view = "photo"`) | Cache Storage **global** (una sola), `backdrops.ts:108-141` | `mobles-backdrop-v1` / `/backdrop/user-photo` |
| `.hdr` propi del cel | memòria; **no es desa mai** (`RenderDialog.tsx:596` treu `sky: "file"`) | — |
| Models GLB de l'usuari | Dexie `models` | `ModelObject.src = "user-…"` dins la composició |
| Textures pròpies dels materials | preferències, `Finish.kind = "image"` amb `src` data URL (`settings.ts:45, 146-170`) | per **nom** de material |

Nota: la configuració del render està indexada per l'**id local** de l'ambient; en importar-lo, l'id serà un altre i
s'ha de reescriure a la clau nova (`writeRenderPrefs`).

---

## 2. Com funciona el `.moble` i què es reaprofita

- **Format pur** (`src/core/file/mobleFile.ts`): JSON llegible, `format: "mobles-cnc"`, `version: 1` (11-12), esquema
  zod `MobleFileSchema` (73-89): `project { name, composition, nesting?, photo? }`, `references`, `photo?` (base64),
  `models?` (`FileModelSchema`, 61-71, GLB en base64 amb el **mateix id**). `parseMobleFile` (173-239): JSON → format →
  versió (més nova = error; `MIGRATIONS` per pujar) → reparació **part a part** amb avisos (foto, models, nesting,
  calibratge, composició amb `repairComposition`, referències). `uniqueName` (242-252), `missingMaterials` /
  `missingMaterialsWarning` (266-280). Test: `mobleFile.test.ts`.
- **I/O amb Dexie** (`src/features/file/mobleIo.ts`): `blobToBase64`/`base64ToBlob` (22-35, test a `mobleIo.test.ts`),
  `projectToMoble` (44-81; llança `UNREADABLE_COMPOSITION`), `shareOrDownload` (88-102, full de compartir a l'iPhone),
  `saveProjectAsFile` (104-111, `keepProject`), `openMobleFile` (121-167): **sempre crea un moble nou**, recrea models
  (`ensureUserModel`, `db/userModels.ts:73-77`: si l'id ja hi és, es fa servir el que hi ha), foto, referències que
  falten, avís de materials.
- **UI**: `SaveFileDialog.tsx` (interruptor «Incloure la foto», mida calculada en viu, `fmtBytes`); «Desar com a fitxer…»
  al menú ⋯ de la `TopBar` (`App.tsx:386-390`) i a les targetes (`ProjectCard.tsx:135`); «Obrir fitxer»
  (`ProjectsScreen.tsx:50-63, 87, 98-100`) amb `fileAccept` (`fileAccept.ts`: a iOS sense filtre).
- **PWA**: `vite.config.ts:43-46` `file_handlers: [{ accept: { "application/json": [".moble"] } }]` i `launch_handler
  focus-existing`; `useLaunchFiles.ts` crida **només** `openMobleFile` i obre el moble (`App.tsx:145-146`).
- **Decisió del propietari** (CLAUDE.md, «Desar i fitxers»): el `.moble` **no porta preferències**; només s'avisa dels
  materials que falten. Les referències sí que s'afegeixen.

### 2.1 Proposta de format: `.ambient`

- **Extensió `.ambient`** (paral·lela a `.moble`: paraula del producte, i és igual en català i en anglès; codi i
  identificadors en anglès segons CLAUDE.md). Nom del fitxer: `ambientFileName(name)` = mateixa neteja que
  `mobleFileName` (152-159).
- **JSON versionat**, `format: "mobles-cnc-ambient"`, `version: 1`. Un `format` diferent (i no `kind: "ambient"` dins de
  `mobles-cnc`) fa que `parseMobleFile` el refusi net i permet un missatge útil («És un ambient: obre'l des d'Ambients»).
- **JSON i no ZIP** (tot i que hi ha `core/file/zip.ts`): coherent amb el `.moble`, un sol lector, llegible a mà. Cost:
  base64 = +33 %. Si més endavant pesa massa (molts GLB), una v2 pot anar en ZIP amb el JSON a dins i els binaris a part
  (la migració ho permet).

Esquema proposat (`src/core/file/ambientFile.ts`, pur, sense Dexie ni DOM, com `mobleFile.ts`):

```ts
export const AMBIENT_FORMAT = "mobles-cnc-ambient"
export const AMBIENT_VERSION = 1

/** Un moble o objecte de l'ambient: referència per trobar-lo + còpia per si no hi és. */
const FileFurnitureSchema = z.object({
  /** Clau dins del fitxer: la que fan servir els items (`AmbientItem.projectId` reescrit a aquest valor). */
  key: z.number().int(),
  /** Per trobar-lo en obrir: id local d'on es va desar, nom i empremta de la composició. */
  ref: z.object({ id: z.number().int(), name: z.string(), print: z.string(), updatedAt: z.number().optional() }),
  /** Còpia (el mateix bloc `project` del .moble). Sense, només referència (composició il·legible en desar). */
  project: MobleFileSchema.shape.project.optional(),
  folder: z.string().optional(),
})

export const AmbientFileSchema = z.object({
  format: z.literal(AMBIENT_FORMAT),
  version: z.literal(AMBIENT_VERSION),
  exportedAt: z.string(),
  /** Origen: per saber si s'obre al mateix navegador (llavors els ids locals valen). */
  origin: z.string().optional(),
  ambient: z.object({ name: z.string(), data: AmbientSchema, folder: z.string().optional() }),
  furniture: z.array(FileFurnitureSchema),
  /** `SavedRender` de `renderPrefs.ts` (tolerant: `mergeSaved` ja filtra tipus en llegir-lo). */
  render: z.record(z.string(), z.unknown()).optional(),
  cameraLocked: z.boolean().optional(),
  /** Foto de les finestres («La meva foto»), només si `render.opts.view === "photo"` i es demana. */
  backdrop: FilePhotoSchema.omit({ exifFocal35: true }).optional(),
  /** GLB de l'usuari de tots els mobles, sense repetir (el `.moble` els posa per moble). */
  models: z.array(FileModelSchema).optional(),
  /** Fotos del racó dels mobles (opcional, com «Incloure la foto»), per `key`. */
  photos: z.array(FilePhotoSchema.extend({ key: z.number().int() })).optional(),
  references: z.array(RefPresetSchema),
})
```

### 2.2 Referència o còpia? (la decisió central)

| Opció | A favor | En contra |
|---|---|---|
| **Només referència** (`projectId`) | fitxer petit; respecta «buscar si encara existeixen» literalment | inútil en un altre aparell o després d'esborrar l'historial; els ids són locals |
| **Només còpia** (com fer N `.moble`) | s'obre igual a tot arreu | sempre duplica mobles; no «busca» res |
| **Referència + còpia** (recomanat) | troba els que hi són (no duplica) i restaura els que falten; funciona a tot arreu | fitxer més gran (composicions: 5-50 kB cadascuna, poc); cal una regla de coincidència |

**Recomanació: referència + còpia.** Es fa servir el bloc `project` del `.moble` (`MobleFileSchema.shape.project`) per
no tenir dos formats de moble, i la reparació de `parseMobleFile` (219-224) per a cada còpia. Al desar:

- els items `kind: "moble"` es reescriuen amb `projectId = key` (0, 1, 2… per moble únic: dos items del mateix moble
  comparteixen `key`, com «Duplicar» dins l'ambient);
- un item el moble del qual **ja no existeix en desar** (l'«Element esborrat» de §1.3) es treu del fitxer amb un avís al
  diàleg («N elements ja no existeixen i no van al fitxer»);
- composició il·legible (`readComposition(...).unreadable`): només `ref`, sense `project`, amb avís (no es desa una caixa
  per defecte, com `UNREADABLE_COMPOSITION`).

**Empremta** (`ref.print`): `templatePrint` (`features/projects/thumbStore.ts:25-37`, FNV-1a amb els ids renumerats)
fa exactament això; caldria moure-la (amb `fingerprint`) a `core/` perquè el mòdul pur la pugui fer servir.

### 2.3 Actius incrustats i mida

| Actiu | Font | Mida típica (base64) | Proposta |
|---|---|---|---|
| Composicions | `compositionOf` | 5-50 kB/moble | sempre |
| Plànol de fons | `Ambient.plan.src` (ja data URL) | 0,3-1,5 MB | sempre (ja és a `data`); interruptor opcional «Incloure el plànol de fons» |
| GLB de l'usuari | `db.models` | fins a ~15 MB → ~20 MB (avís de `addUserModel`) | sempre (si no, no es veuen), un cop per id |
| Models de l'app (`MODEL_ASSETS`), textures de l'app (`textures/<id>/…`), Jardí/Mar, HDRI | l'app | 0 | per referència (l'app ja els porta) |
| Foto de les finestres | Cache Storage | 0,5-5 MB | interruptor «Incloure la foto de les finestres», només si el render la fa servir |
| Fotos del racó dels mobles | `db.photos` | 0,2-3 MB c/u | interruptor «Incloure les fotos dels mobles», **apagat** per defecte (no són de l'ambient) |
| Miniatura | `AmbientRow.thumb` | — | no (es refà sola) |

El diàleg ha de mostrar la mida en viu (com `SaveFileDialog.tsx:19-35`) i un desglossament si passa de ~10 MB.

### 2.4 Materials

L'ambient fa servir materials per **nom**: terra, parets, sostre, terra de fora, `Wall.material`, `Opening.frame`, blocs i
tots els de les composicions. Proposta v1, **coherent amb el `.moble`**: no portar preferències i avisar amb un
`missingAmbientMaterials` (la unió de `missingMaterials` de cada composició + els noms de l'ambient, resolent àlies).

**Pregunta per al propietari**: un material propi amb foto (data URL a les preferències) es veurà gris en un altre
aparell. Si vol que l'ambient surti «igual», caldria un camp opcional `materials?: MaterialPref[]` (només els que no són
de l'app) que s'afegeixin a Preferències si no hi ha cap material amb aquell nom, com les referències del `.moble`
(`mobleIo.ts:159-163`). Això contradiu la decisió «el fitxer no porta preferències», per això no es fa sense que ho digui.

---

## 3. Obrir un `.ambient`

### 3.1 Flux (`openAmbientFile` a `src/features/file/ambientIo.ts`)

1. `parseAmbientFile(text)`: JSON → `format` (si és `mobles-cnc`, error «És un moble: obre'l des de Mobles») → versió →
   migracions → reparació per parts amb avisos (com `parseMobleFile`): `parseAmbient` per a `ambient.data`,
   `repairComposition` per a cada còpia, models/fotos/backdrop malmesos fora amb avís.
2. **Coincidència de cada moble** (funció pura `matchFurniture(file.furniture, locals)` a `core/file/ambientFile.ts`,
   `locals` = `{ id, name, print, draft }[]`):
   1. **Mateix id** i (mateix nom **o** mateixa empremta) → *trobat* (enllaça). Si l'empremta difereix → *trobat,
      modificat* (informatiu: «ha canviat des que es va desar»).
   2. Si no: **mateixa empremta** en un altre id (p. ex. un altre aparell que ja el té d'un `.moble`) → *trobat*.
      Diversos candidats: el de mateix nom; si no, el més recent.
   3. Si no → *falta*. No es busca **només per nom** (dos «Armari 2 portes» diferents són habituals amb el catàleg).
   Els esborranys (`Project.draft`) no compten com a trobats (`dropDrafts` els esborraria).
3. **Diàleg «Obrir l'ambient»** (només si hi ha algun *falta* o algun *trobat, modificat*; si tot és trobat, s'obre
   directament amb un toast, com ara el `.moble`): llista amb `LuBox`/`LuSofa` i l'estat de cada moble, i una tria:
   - **«Restaurar els que falten des del fitxer»** (per defecte; `createProject` amb la còpia, com `openMobleFile`
     141-146, al mateix `folder` que l'ambient si en té);
   - **«Deixar-los com a absents»**: els items es treuen i surten al toast d'avís amb el nom («No hi són: …»). No es
     deixa un `projectId` estranger a l'ambient: podria coincidir amb un moble local diferent (ara o en el futur).
   - Casella **«Fer còpies dels que ja tinc»** (apagada): com `duplicateAmbient` (320-349) / «Duplicar (per a un
     client)». Important perquè **tocar les mides a l'ambient canvia el moble enllaçat** (`resizeComposition`): obrir el
     fitxer d'un client sobre els mobles de l'altre els modificaria tots dos.
4. **Escriure a Dexie** (en una transacció `db.projects, db.ambients, db.models, db.photos`): models (`ensureUserModel` +
   `forgetModel` amb `import()`, `mobleIo.ts:127-139`), mobles restaurats, `projectId` remapejats (`key` → id local),
   `createAmbient(uniqueName(name, ambients), data)`, `folder`. Fora de la transacció: `writeRenderPrefs("ambient:<nou>",
   file.render)`, `mobles:ambient-camera-lock:<nou>`, referències que falten (`saveSettings`) i foto de les finestres.
5. **Foto de les finestres**: és **global** (una sola per a tota l'app). Si l'usuari no en té cap → `saveBackdropPhoto`.
   Si ja en té una → no se sobreescriu sense preguntar (casella al diàleg «Fer servir la foto de les finestres del
   fitxer»); si no es tria, avís. (Una millora futura seria fer-la per ambient.)
6. Avisos finals en un toast `warning` (8 s), com `ProjectsScreen.tsx:58-62`: materials que falten, absents, parts
   malmeses. Obre l'ambient (`AMBIENT_TAB_KEY` 3D si porta càmera).

### 3.2 UI de «falta» coherent amb el que ja hi ha

- Dins de l'ambient ja existeix «Element esborrat» + text vermell a l'inspector (`ambientData.ts:101`,
  `AmbientEditor.tsx:935-937`). Proposta: unificar el text («Aquest moble ja no hi és») i afegir a la fila de la llista
  (`ElementRow`, 358-410) la icona `LuTriangleAlert` (catàleg: «Avisos») i l'acció del menú «Treure de l'ambient» que ja
  hi és. No cal un component nou tipus `UnreadableAlert` (`components/UnreadableAlert.tsx`) per a l'editor; sí que es pot
  fer servir el mateix patró `Alert.Root status="warning"` al **Resum** de l'ambient (vegeu §4) quan n'hi ha.
- Al diàleg d'obrir: `Alert` amb la llista, i botons `colorPalette="wood"` per a l'acció principal.

### 3.3 On s'obre

- **Ambients › «Obrir fitxer»** (`LuFolderOpen`) al costat de «Nou ambient» a `AmbientsScreen` (com Mobles,
  `ProjectsScreen.tsx:98-100`), `accept={fileAccept(".ambient,.json,application/json")}`.
- **Despatxador comú** `openAnyFile(text)` que mira `format` i crida `openMobleFile` o `openAmbientFile`: el fan servir
  `useLaunchFiles` i els dos «Obrir fitxer» (un `.ambient` triat a Mobles s'obre igualment, sense error).
- **PWA**: `vite.config.ts:44` → `accept: { "application/json": [".moble", ".ambient"] }`; `useLaunchFiles` rep també
  `onOpenAmbient(id)` (a `App.tsx:145-146`, `setAmbientId` + `setScreen("ambient")`). Safari/iOS: sense canvis
  (`fileAccept` ja no filtra).

### 3.4 On es desa

- Menú ⋯ de la targeta d'ambient (`AmbientsScreen.tsx:102-124`): «Desar com a fitxer» (`LuSave`) abans de «Duplicar».
- Barra de l'ambient obert: `AmbientTopBar.tsx:8` fa servir `DocBar` **sense** `menu`; `DocBar` ja l'accepta
  (`components/TopBar.tsx:45, 118`). Afegir-hi ⋯ › «Desar com a fitxer…» (amb `mobles:flush-save` abans, com
  `App.tsx:387`).
- `SaveAmbientFileDialog` (nou, mateix esquelet que `SaveFileDialog`): interruptors (plànol, foto de les finestres,
  fotos dels mobles), mida en viu, avisos (elements esborrats, composicions il·legibles). Desar l'ambient com a fitxer
  ha de fer `keepProject` dels seus mobles (com `saveProjectAsFile`, 109).

---

## 4. Relació amb «Selecció dels ambients» (§5 del prompt, 194-206)

- **Editor de mobles**: `StructureTree` té una **fila arrel** amb el nom del moble, en negreta, que selecciona
  `{ kind: "moble" }` (`StructureTree.tsx:221`); l'inspector mostra **«Resum»** (`EditorScreen.tsx:905-915`: mòduls,
  mides, peces, forats, referències, models 3D).
- **Ambients**: l'esquerra comença directament amb «Elements» + «+ Moble»/«+ Objecte» (`AmbientEditor.tsx:531-588`) i un
  peu amb parets i longitud (583-587). L'`AmbientInspector` només surt quan **no hi ha res seleccionat** (627-636), i
  això només s'aconsegueix clicant buit al centre. És la queixa del propietari.
- Proposta (per a la fitxa de coherència, no d'aquest fitxer): fila arrel amb `LuHouse` i el nom de l'ambient
  (selecció `{ kind: "ambient" }` o `null`) i un **«Resum»** a l'inspector: nombre de mobles i objectes, parets, m² de
  terra i **«N mobles que falten»** (amb `Alert` i «Treure'ls de l'ambient»).
- **Interacció amb el fitxer**: (1) el Resum és el lloc natural per a l'estat dels absents després d'obrir un
  `.ambient` (i dels esborrats de sempre); (2) «Desar com a fitxer…» també pot sortir al menú ⋯ de la fila arrel, com al
  de la `TopBar` del moble; (3) el comptador del Resum i el del diàleg de desar han de fer servir la mateixa funció
  (`ambientSummary(amb, projects)`), perquè diguin el mateix.

---

## 5. Pla d'implementació

### 5.1 Fitxers

| Fitxer | Canvi |
|---|---|
| `src/core/file/ambientFile.ts` (nou) | esquema, `buildAmbientFile`, `parseAmbientFile` (+ `MIGRATIONS`), `ambientFileName`, `matchFurniture`, `missingAmbientMaterials`, `usedUserModelIds` de tots els mobles |
| `src/core/file/fingerprint.ts` (nou) | `fingerprint` + `templatePrint` mogudes de `features/projects/thumbStore.ts` (que les reexporta) |
| `src/features/file/ambientIo.ts` (nou) | `ambientToFile(row, settings, opts)`, `saveAmbientAsFile`, `openAmbientFile(text, settings, save, choice)`; reaprofita `blobToBase64`, `base64ToBlob`, `shareOrDownload` de `mobleIo.ts` |
| `src/features/file/openAnyFile.ts` (nou) | despatx per `format` |
| `src/features/file/SaveAmbientFileDialog.tsx`, `OpenAmbientDialog.tsx` (nous) | diàlegs de §3.1 i §3.4 |
| `src/features/file/useLaunchFiles.ts` | `openAnyFile`, segon callback `onOpenAmbient` |
| `src/App.tsx` | `useLaunchFiles(openProject, openAmbient)` |
| `src/features/ambients/AmbientsScreen.tsx` | «Obrir fitxer», ⋯ «Desar com a fitxer» |
| `src/features/ambients/AmbientTopBar.tsx` | `menu` del `DocBar` |
| `src/features/ambients/AmbientEditor.tsx`, `ambientData.ts` | marca de «falta» a la fila; (amb §4) fila arrel i Resum |
| `src/components/viewer/render/backdrops.ts` | `readBackdropPhoto(): Promise<Blob \| null>` i `hasBackdropPhoto()` |
| `vite.config.ts` | `.ambient` a `file_handlers` |
| `CLAUDE.md` | secció «Desar i fitxers»: `.ambient` i les decisions (còpia + referència, foto global, materials) |

### 5.2 Tests

- `src/core/file/ambientFile.test.ts` (com `mobleFile.test.ts`):
  - **anada i tornada**: `buildAmbientFile` → `JSON.stringify` → `parseAmbientFile` = igual (parets amb obertures,
    blocs, grups, plànol, càmera, `render` amb `mood`/`focal`, `SavedRender`);
  - items del mateix moble comparteixen `key`; els d'un moble esborrat no hi són; il·legible → sense `project`;
  - models: un GLB fet servir per dos mobles va un sol cop;
  - errors en català: no és JSON, és un `.moble`, versió més nova; parts malmeses → avisos i la resta s'obre;
  - `matchFurniture`: mateix id+nom, mateix id amb un altre nom i una altra empremta (→ falta), empremta en un altre id,
    dos candidats, només el nom igual (→ falta), esborrany (→ falta);
  - `missingAmbientMaterials`: noms de l'ambient + composicions, amb àlies.
- `src/features/file/mobleIo.test.ts`: ja cobreix base64; si es mou a un `fileIo.ts` comú, el test el segueix.
- `templatePrint` estable entre sessions (ids nous amb `newId` → mateixa empremta): test al moure-la.
- Manual / e2e: desar «Showroom» (catàleg), esborrar l'historial (els mobles de l'ambient es queden), esborrar un moble
  a mà, obrir el fitxer → restaurar; obrir-lo en un altre navegador (tots «falten» → es restauren); render amb la
  mateixa configuració; doble clic a un `.ambient` (Chromium instal·lat).

### 5.3 Mida de la feina

| Part | Esforç |
|---|---|
| Format pur + tests (`ambientFile.ts`, `fingerprint.ts`) | M (~300 línies + ~250 de test) |
| I/O Dexie + render/backdrop/camera-lock | M |
| Diàlegs de desar i obrir | M |
| Integració (Ambients, barra, App, PWA, despatxador) | S |
| Marca de «falta» a la llista | S |
| Fila arrel + Resum (§4, compartit amb la fitxa de coherència) | S-M |

Total aproximat: **2-3 dies** de feina. Dependència suau amb §4 (Resum) i amb la decisió dels materials (§2.4).

### 5.4 Preguntes obertes per al propietari

1. Materials propis amb foto: portar-los al fitxer (§2.4) o mantenir «el fitxer no porta preferències»?
2. Per defecte, en obrir: **enllaçar** els mobles que ja tens (el que demana el prompt) o **fer-ne còpies** (més segur
   si l'ambient és d'un altre client)?
3. La foto de les finestres hauria de passar a ser per ambient (avui és una sola per a tota l'app)?
