# Prompt per a Claude Code — dins de `~/Desktop/taller-cnc-nest`

Obre Claude Code a **`~/Desktop/taller-cnc-nest`** (no a `cnc`) i enganxa-ho:

---

Llegeix el `CLAUDE.md`, el `HANDOFF.md` i les skills `nesting-parsers`,
`nest-auth-rbac` i `data-sqlite-prisma` abans de començar.

Vull poder crear comandes **sense TopSolid**: un configurador de mobles meu
(`~/Desktop/cnc`) genera directament un `UnifiedData` en JSON. Cal un endpoint que
l'importi i el deixi exactament igual que si vingués de `POST /api/nesting/process`,
perquè el visor, les etiquetes PDF i els escaneigs funcionin sense cap canvi.

## Què cal fer
1. **Refactor al `NestingService`**: extreu la persistència de `process()` a un
   mètode privat `persist(unified, meta)` (crear `Order` + `Piece[]` + avisar Odoo).
   `process()` passa a ser `assemble()` + `persist()`. El comportament ha de quedar
   idèntic: comprova-ho amb `npm run test:parsers` (29 peces · 399 sòlids).
2. **Endpoint nou** `POST /api/nesting/import`, amb rols **Encarregat/Admin**
   (deny by default, com la resta). Body JSON: `{ unified: UnifiedData, source?: string }`.
   Límit de mida de body prou gran per a mobles amb molts mecanitzats (p. ex. 50 MB).
3. **Validació estricta** abans de guardar (no confiïs en el client):
   - camps obligatoris de `UnifiedData`, `Piece`, `Board` i `Solid` amb tipus correctes;
   - `ref` úniques; cada `piece.tab` existeix a `boards`; `piece.solid` és -1 o un
     índex vàlid de `solids`; `r3d` i `side3d` dins dels valors permesos;
     `match` ∈ exact|representative|none; `joins[].a/b` índexs vàlids;
   - gruixos i mides positius.
   Retorna 400 amb un missatge clar en català que digui quin camp falla.
   Fes-ho amb class-validator/DTOs o amb un validador propi a `src/nesting/`, però
   sense afegir dependències noves sense preguntar-m'ho.
4. **Origen de la comanda**: `sourceCsv` i `sourceStep` a `null` i `source`
   (p. ex. `"configurador"`). Si cal un camp nou a Prisma, fes-ho amb una migració
   **additiva** (camp opcional). Al front, mostra una etiqueta "Configurador" a
   `OrderCard` quan la comanda vingui d'aquí.
5. **Front (`apps/web`, Chakra v2)**: a la pàgina `Upload`, afegeix una segona
   opció, "Importar JSON del configurador", amb selector de fitxer `.json`. Crida
   l'endpoint i obre el visor de la comanda creada.
6. **Tests**: un test e2e que importi un `UnifiedData` petit (mòdul de 2 laterals,
   base, sostre, trassera, 1 tauler), comprovi que `GET /orders/:id` el retorna igual
   i que `labels.pdf` es genera. Més un test per cada error de validació important.

## Regles
- `UnifiedData` **no es canvia** en aquesta tasca. Si detectes que hi falta alguna
  cosa per a comandes del configurador, proposa-ho i pregunta abans (i sempre additiu).
- No trenquis el flux CSV+STEP existent.
- Al final: `npm run build:all` ha de passar, i dona'm un `curl` d'exemple amb login
  i import.
