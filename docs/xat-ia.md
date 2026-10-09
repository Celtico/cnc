# Assistent IA (xat dins de l'app)

Un xat a l'Editor del moble que construeix i edita el moble obert amb les mateixes operacions que la UI. Per decisió de
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
  en obrir el xat (no és al bloc d'entrada).

## Pendent

- **Fase 2 — foto o plànol → moble nou**: a partir d'una foto o d'un plànol acotat, proposar un moble nou (mòduls,
  divisions, fronts) i demanar les mides reals que falten (les de la foto són estimades: vegeu `docs/foto-mesures.md`).
- **Fase 3 — plànol → ambient**: llegir un plànol de la casa i fer-ne les parets, finestres i portes d'un ambient.
- **Fase 4 — pàgina de catàleg → joc de ferratges**: llegir una pàgina d'un catàleg en PDF o foto i proposar un
  `HardwareKit` (vegeu `docs/ferratges-jocs.md`), **sempre sense confirmar** fins que es revisi amb el taller: mai un
  mecanitzat inventat.
