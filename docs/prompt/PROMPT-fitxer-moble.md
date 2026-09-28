# Prompt — Desar i obrir mobles com a fitxer (.moble)

Copia-ho a Claude Code dins de `~/Desktop/cnc`, **després** de l'editor de compartiments
(el format ha de ser el de la composició, no el del mòdul únic antic).

---

Llegeix el `CLAUDE.md` abans de començar.

## Objectiu
Ara els mobles només viuen a la base de dades del navegador (Dexie). Vull poder
**desar un moble en un fitxer** i **obrir-lo després**: per fer còpies, passar-lo del
Mac a l'iPhone o enviar-lo al taller del meu germà.

## 1. Format `.moble`
- Fitxer **JSON** amb extensió `.moble` (tipus MIME `application/json`), llegible i
  versionat:
  ```json
  {
    "format": "mobles-cnc",
    "version": 1,
    "exportedAt": "2026-09-28T12:00:00Z",
    "project": { "name": "...", "composition": { ... }, "nesting": { ... }, "photo": { ...calibratge... } },
    "references": [ { ...objectes de referència que fa servir el moble... } ],
    "photo": { "mime": "image/jpeg", "width": 4032, "height": 3024, "exifFocal35": 26, "data": "<base64>" }
  }
  ```
- `photo` és opcional ("Incloure la foto": sí per defecte; mostra la mida del fitxer
  resultant). Sense foto, el calibratge es desa igualment però queda inactiu fins que
  se'n carregui una.
- Esquema **zod** a `core/file/mobleFile.ts`, amb **migracions** per versió
  (`migrate(v1 → v2 ...)`). El codi del `core` no toca Dexie ni el DOM.
- Els `references` s'hi inclouen perquè el fitxer sigui autònom: si en obrir-lo
  l'usuari no té aquella referència a les seves preferències, s'hi afegeix (sense
  duplicar-la si ja n'hi ha una d'idèntica).

## 2. Desar
- Botó **"Desar com a fitxer"** (icona `LuSave`) a la capçalera de l'Editor i al menú
  de cada moble de la llista.
- Nom del fitxer: `<nom del moble>.moble` (sense caràcters no vàlids).
- Al Mac: descàrrega normal. **A l'iPhone** (PWA): si hi ha `navigator.share` amb
  fitxers, obre el full de compartir (Desar a Fitxers, AirDrop, Missatges...); si no,
  descàrrega.

## 3. Obrir
- Botó **"Obrir fitxer"** (icona `LuFolderOpen`) a la pantalla de Mobles. Accepta
  `.moble` i `.json`.
- Valida el fitxer i el migra si és d'una versió anterior. **Sempre crea un moble
  nou**, mai en sobreescriu cap. Si ja n'hi ha un amb el mateix nom → "Nom (2)".
- Errors en català i concrets: "Aquest fitxer no és un moble", "Fitxer d'una versió
  més nova de l'app: actualitza-la", "La foto del fitxer està malmesa; s'ha obert
  sense foto".
- Opcional (Chrome d'escriptori): `file_handlers` al manifest de la PWA perquè els
  `.moble` s'obrin amb l'app en fer-hi doble clic.

## 4. Tests
- Anada i tornada: exportar → importar dona el mateix moble (mateixes peces, mides i
  forats) i la mateixa foto (bytes idèntics).
- Fitxer sense foto; fitxer amb una referència que l'usuari no té (s'afegeix) i amb
  una que ja té (no es duplica).
- Migració d'un fitxer de versió anterior (crea un fixture de v1 quan hi hagi v2).
- Fitxer invàlid o d'un altre programa → error clar, sense crear res.

Al final: `pnpm typecheck && pnpm test && pnpm build`.
