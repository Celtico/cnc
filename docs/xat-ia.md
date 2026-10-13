# Assistent IA (xat dins de l'app)

Un xat que construeix i edita el document obert amb les mateixes operacions que la UI: el moble i l'objecte a l'Editor i
l'ambient al seu editor (fase 1b). Per decisió de
l'usuari (2026-10-09): **la clau de l'API es desa a Preferències** i el navegador crida l'API de Claude directament
(app personal, sense backend). SDK aprovat: `@anthropic-ai/sdk`.

## Fets de l'API (comprovats a la documentació oficial el 2026-10-09)

Índex: <https://platform.claude.com/llms.txt> (abans `docs.claude.com/en/docs_site_map.md`, que hi redirigeix).

- **Models** ([Models overview](https://platform.claude.com/docs/en/models/overview)): `claude-sonnet-5-5` (Claude Sonnet
  5.5, «la millor combinació de velocitat i intel·ligència», 2 $ / 10 $ per milió de tokens d'entrada / sortida) i
  `claude-opus-5-5` (Claude Opus 5.5, 4 $ / 20 $). Tots dos: entrada de text i imatge, ús d'eines, context d'1M,
  sortida màx. 128K. Per defecte l'app fa servir **Sonnet 5.5** (més barat); Opus es tria a Preferències.
- **Navegador** ([TypeScript SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript), «Browser
  usage»): el SDK no funciona al navegador si no es crea amb `dangerouslyAllowBrowser: true` (l'API torna les capçaleres
  CORS). Amb aquesta opció el SDK envia la capçalera `anthropic-dangerous-direct-browser-access: true` (comprovat a
  `node_modules/@anthropic-ai/sdk/client.mjs`). La documentació avisa que exposa la clau a qui tingui accés al
  navegador: acceptable aquí (eina personal, la clau és de l'usuari i només es desa al seu dispositiu). Les
  organitzacions amb ZDR no tenen CORS
  ([API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).
- **Eines del client** ([Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)):
  la resposta acaba amb `stop_reason: "tool_use"` i blocs `tool_use` (`id`, `name`, `input`). Es contesta amb un
  missatge `user` que comença amb un `tool_result` per cada `tool_use` (`tool_use_id`, `content`, `is_error: true` si
  ha fallat; el text, després). Errors instructius («què ha fallat i què provar») perquè el model es corregeixi.
- **Pensament** ([Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)): a Opus 5.5 i Sonnet 5.5
  el pensament adaptatiu ja hi és sense configurar res (`display` per defecte `"omitted"`) i `thinking: {type:
  "disabled"}` dona error 400. Els blocs `thinking` (amb `signature`) s'han de **tornar sense tocar** al torn següent:
  l'app reenvia el `content` sencer de la resposta de l'assistent.
- **Imatges** ([Vision](https://platform.claude.com/docs/en/build-with-claude/vision)): bloc `image` amb `source:
  {type: "base64", media_type: "image/jpeg", data}`; JPEG, PNG, GIF, WebP; màx. 10 MB en base64 i 8000 × 8000 px;
  millor la imatge **abans** del text. Cost ≈ ⌈w/28⌉ × ⌈h/28⌉ tokens (Sonnet/Opus 5.5 són d'alta resolució, fins a
  2576 px de costat). L'app redueix la foto a **≤ 1568 px de costat en JPEG** abans d'enviar-la (menys cost i latència;
  per a un plànol o una foto de moble n'hi ha prou).
- **Streaming** ([Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)):
  `client.messages.stream({...}).on("text", …)` i `await stream.finalMessage()`; es para amb `stream.abort()`. Dins del
  flux pot arribar un esdeveniment `error` (p. ex. `overloaded_error`).
- **Errors del SDK**: `AuthenticationError` (401, clau dolenta), `PermissionDeniedError` (403), `RateLimitError` (429),
  `APIConnectionError` (sense connexió), `APIUserAbortError` (aturat). Reintents automàtics: 2.
- **Preu** ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)): es paga per tokens amb la clau de
  l'usuari (Claude Console). Cada missatge reenvia tota la conversa (i les imatges): una conversa llarga costa més.

## Fase 1 (feta, 2026-10-09)

- **Preferències › App › «Assistent IA»** (`LuMessageSquare`): clau (camp de contrasenya; es veuen només els 4
  últims caràcters), model (`ChoiceChips`: Sonnet 5.5 · Opus 5.5) i «Provar la clau». `Settings.assistant` (v26,
  additiu). **La clau no surt mai** a l'export de preferències ni al `.moble`, i en importar unes preferències es queda
  la que hi havia.
- **Xat a l'Editor**: pestanya «Assistent» a la columna de la dreta (al mòbil, una tercera pestanya al costat
  d'Estructura · Propietats). Llista de missatges, camp de text, adjuntar una foto o un plànol (reduïda a 1568 px JPEG),
  aturar, text en directe. Sense clau, envia a Preferències; sense connexió, ho diu.
- **Eines** = operacions de l'editor sobre la composició oberta (`core/assistant/`, pures, amb tests): `get_moble`,
  `add_module`, `remove_module`, `rename_module`, `set_module_size`, `set_module_position`, `set_carcass`, `split_zone`,
  `unsplit_zone`, `set_zone_size`, `set_front`, `set_shelves`, `set_material`. Entrades validades amb zod (el mateix
  esquema fa el JSON Schema de l'eina); un error torna `is_error` amb el motiu. Després de cada eina, el resum del moble
  i els avisos de fusteria nous perquè el model es corregeixi. Les mateixes regles que la UI (què aguanta cada
  compartiment, `zoneSupport.ts`; portes de tot el mòdul només a l'Interior dividit; l'última zona d'una divisió és el
  que sobra).
- **Desfer**: cada torn de l'assistent és **un sol pas** de desfer (`useHistory`: canvis en viu `commit: false` i un
  `commit()` en acabar o aturar). ⌘Z desfà tot el que ha fet en aquell torn.
- **Privadesa**: la clau no va als registres (`logLevel: "off"`), cap telemetria; l'SDK es carrega amb `import()` només
  en obrir el xat (no és al bloc d'entrada: bloc propi `sdk`, ~220 KB / 56 KB gz).
- **On és el codi**: `core/assistant/` (eines, resum, instruccions; pur, tests), `features/assistant/` (`chatTurn.ts` el
  bucle d'eines amb streaming, `ChatPanel.tsx` la UI, `claudeClient.ts` el client a demanda, `errors.ts` els errors en
  català), `features/settings/AssistantPane.tsx` (Preferències), `components/Workspace.tsx` (`extra`).
- **Comprovat** amb Playwright contra una API falsa (`page.route` a `api.anthropic.com`, cap crida de debò): sense clau
  l'avís i l'enllaç a Preferències, la clau només es veu emmascarada i no surt a l'export, «Provar la clau», un torn amb
  dues eines (mòdul i calaixos) i el text en directe, la capçalera `anthropic-dangerous-direct-browser-access`, un sol
  pas de desfer/refer, i la tercera pestanya al mòbil.

## Fase 1b (feta, 2026-10-09): Objectes i Ambients

Per decisió de l'usuari («i a Objectes i Ambients?»): el mateix assistent a l'Editor dels **objectes** i al dels
**ambients**. **Un sol xat** (no còpies): `ChatPanel` i `chatTurn` reben el **joc d'eines** del document
(`core/assistant/toolset.ts`, `AssistantToolSet<D>`: instruccions de sistema, eines amb el JSON Schema de zod, `run`
—asíncrona si cal—, el resultat per al model i la frase per al xat) dins d'un `ChatTarget` (`features/assistant/chatTarget.ts`).
Les eines es carreguen amb el primer missatge (`import()`): no són al bloc de l'editor.

- **Objectes** (`objectTools.ts`, tipus `objecte`, només peces lliures; decoratiu, no es fabrica): `get_object`,
  `add_part`, `update_part`, `remove_part`, `duplicate_part`, `set_group`, `move_group`, `duplicate_group`. Les operacions de
  sempre (`reorientPart`, `insertPartCopy`, `moveGroupBy`, `duplicateGroup`) i les formes senzilles d'`objectShapes.ts`
  (rectangle, arrodonit amb radi, el·lipse, cercle). Materials de Preferències (també els de Simulació); mides en mm, Y amunt,
  terra y = 0, posició = cantonada mínima (el resum dona també la caixa de cada peça).
- **Ambients** (`ambientTools.ts`, sobre el model `Ambient`): `get_ambient`, `add_room`, `add_wall`, `update_wall`,
  `remove_wall`, `add_opening`, `update_opening`, `remove_opening` (respecten `clampOpening` i no es trepitgen),
  `list_library` (els mobles i objectes de l'usuari amb les mides i les plantilles del catàleg, amb `query`), `place_item`
  (de l'usuari o d'una plantilla, creada pel camí de les galeries; «contra la paret N» arramba el darrere a la cara de dins i
  el gira, i `snapToWalls`), `move_item`, `rotate_item`, `remove_item`, `set_item_group`, `set_materials`. Coordenades del
  plànol: x a la dreta, y avall; elements pel centre; gir en graus horari vist des de dalt. El que és de fora de l'ambient
  (Dexie) arriba pel context (`features/assistant/ambientLibrary.ts`): les eines es proven sense base de dades.
- **Un plànol adjunt** a l'ambient (foto o captura): el model llegeix les cotes i en fa les parets i les obertures; les
  instruccions li diuen que demani les mides reals quan no es llegeixen (cobreix el que era la fase 3).
- **Desfer**: igual que al moble, cada torn és un sol pas (al `useHistory` de l'ambient i al de l'Editor). Un moble o
  objecte creat d'una plantilla per `place_item` es queda a la llista de l'usuari (com «Afegir» de la galeria); el desfer
  només el treu de l'ambient.
- **No fa** (límits): canviar les mides o l'interior d'un moble des de l'ambient (es fa a l'Editor), el plànol de fons i
  la seva calibració, la càmera, el render; ni girar o canviar les mides dels models 3D d'un objecte.
- **Comprovat** amb Playwright contra una API falsa (`page.route`): un torn a un objecte (dues peces rodones, el xat les
  diu, un sol pas de desfer/refer) i un a un ambient (habitació per dins, finestra, porta, cerca al catàleg i una nevera
  creada i arrambada a la paret de baix girada 180°; un sol pas de desfer: no queda cap altre pas), la capçalera del
  navegador i la tercera pestanya al mòbil.

## Fase 1c (feta, 2026-10-13): assistent personal de tota l'app

Per decisió de l'usuari: «un botó de l'assistent personal al menú principal, que s'obri amb un drawer, que tingui tot el
context de l'app i que pugui fer tot el que pot fer una persona, i que sàpiga si tinc alguna cosa seleccionada; no cal
guardar historial».

- **Un sol xat**: botó «Assistent» al menú principal (sota Mobles · Ambients · Objectes; al mòbil, a la barra de baix)
  que obre un calaix (`features/assistant/GlobalAssistant.tsx`). Les pestanyes «Assistent» de l'Editor i dels Ambients
  s'han tret.
- **Context**: el document obert (moble, objecte o ambient) es registra a `assistantHub.ts` amb les seves eines i què hi
  ha seleccionat; l'app hi posa la navegació. Cada missatge porta «[Context de l'app: apartat, pàgina, document obert,
  selecció]».
- **Eines de l'app** (`appTools.ts`): `get_app`, `list_documents`, `open_document`, `create_document` i `go_to`, a més de
  les del document obert. El joc d'eines es torna a llegir a cada volta del torn (`runTurn` `refresh`).
- **Desfer**: un pas per document tocat en acabar el torn. **Sense historial** desat: la conversa dura mentre l'app és
  oberta.
- **Que pugui fer-ho tot** (el mateix dia): gestionar documents (canviar el nom, duplicar, moure a un grup, esborrar amb
  confirmació), llegir les peces i el nesting i canviar-ne el tauler, baixar els fitxers del taller (xcs, STEP, CSV,
  DXF, llista de tall, GLB), els ferratges (buscar a la biblioteca, el per defecte de cada lloc i el de cada compartiment del moble obert) i llegir i canviar les preferències (materials, per defecte, folgances, màquina per defecte;
  mai la clau de l'API).
- **Sempre les mateixes eines i instruccions** (`allToolSet`): amb el pensament activat, l'API lliga cada bloc de
  pensament a les instruccions i a les eines; canviar-les en obrir un document a mitja conversa donava «Invalid
  signature in thinking block». Ara hi són totes des del principi i cada eina de document diu, si cal, que n'obri un.
- **Accés a la base de dades** (el mateix dia: «li pots donar accés a l'IndexedDB?»): `db_tables`, `db_read` (tot, sense
  imatges, fitxers ni la clau) i `db_write` (mobles, ambients i preferències, validat; fora del document obert, només
  després que l'usuari ho accepti). Si l'API rebutja els blocs de pensament d'abans (l'app ha canviat), es treuen i es
  torna a provar.
- **Columna a la dreta a l'ordinador** (el mateix dia): l'app s'estreny i es pot navegar amb l'assistent obert (al mòbil,
  calaix a pantalla completa). No es tanca sol; la ✕ pregunta si es vol perdre la conversa i, si sí, la buida. Pujar a
  llegir mentre arriba la resposta ja no et torna avall.
- **Peces lliures, ferratges i materials** (el mateix dia: «i fer peces lliures?», «i ferratges?», «pot fer material?»):
  - amb un moble obert, les peces lliures amb les eines dels objectes (es fabriquen: `nest` segons el material) i una
    forma a mida (`polygon`: punts amb arcs, com l'editor de perfils);
  - `get_hardware` (els números d'un ferratge amb els límits) i `edit_hardware` (nom, fabricant, número i paràmetres; els
    de l'app, només duplicant-los; un importat editat es desconfirma);
  - `set_pref_material` també canvia el color, la rugositat, l'acabat (o torna a un d'abans), el reflex, el vellut, la
    llum que passa i la que fa, i el nom (els mobles i ambients desats i el document obert el segueixen). Les fotos de
    textura es continuen posant a Preferències.
  - Provat de debò: un trapezi de 600 × 400 al «Moble illa» (desfet amb ⌘Z), un lacat verd brillant amb reflex 0,8 i
    una còpia de la frontissa per defecte amb els seus números (tots dos esborrats després).

## Què ha de fer l'usuari

1. Fer una clau a la Claude Console (console.anthropic.com › API keys) amb saldo.
2. Enganxar-la a Preferències › Assistent IA, «Desar» i «Provar la clau».
3. Triar el model (Sonnet 5.5 per defecte; Opus 5.5 per a encàrrecs difícils, el doble de car).

## Pendent

- **Fase 2 — foto o plànol → moble nou**: a partir d'una foto o d'un plànol acotat, proposar un moble nou (mòduls,
  divisions, fronts) i demanar les mides reals que falten (les de la foto són estimades: vegeu `docs/foto-mesures.md`).
- ~~Fase 3 — plànol → ambient~~: feta amb la fase 1b (adjuntar el plànol al xat de l'ambient).
- **Fase 4 — pàgina de catàleg → joc de ferratges**: llegir una pàgina d'un catàleg en PDF o foto i proposar un
  `HardwareKit` (vegeu `docs/ferratges-jocs.md`), **sempre sense confirmar** fins que es revisi amb el taller: mai un
  mecanitzat inventat.
