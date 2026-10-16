# Mobles CNC

App web (PWA) per dissenyar mobles **paramètrics** i treure'n directament el que necessita el taller: llista de peces,
nesting, programes de **SCM Maestro (.xcs)**, **STEP + CSV** (format TopSolid) i **DXF**. Objectiu: substituir TopSolid per
fer mobles de cos a mida amb una CNC.

- **Editor paramètric**: mòduls, compartiments, portes, calaixos, prestatges i peces lliures; tot canvia amb les mides.
- **Fusteria real**: unions, System 32, cassoletes, ranures del fons, folgances, jocs de calaix del catàleg (DTC, Häfele).
- **Sortida per al taller**: nesting sobre taulers, programes .xcs per tauler, STEP 3D + CSV, DXF per capes, Vista CAM.
- **Veure-ho abans de fer-ho**: visor 3D, alçat, moble sobre una foto del lloc, ambients (plànol de la casa), render
  fotorealista i AR.
- **Assistent IA** (opcional): un xat a l'editor que fa les mateixes operacions que la UI, amb la clau de l'API de
  l'usuari (Preferències › Assistent IA).
- **Funciona sense connexió** i es pot instal·lar a l'iPhone. Tot es desa al navegador (IndexedDB); no hi ha servidor.

## Estat
**v1.0 (tancada).** El nucli (model paramètric → peces → mecanitzats → fitxers del taller) està acabat i cobert per proves
d'or. No s'hi afegeixen funcions noves; si es reprèn, comença per [`CLAUDE.md`](CLAUDE.md) i
[`docs/convencions.md`](docs/convencions.md).

Encara **no s'ha validat a la màquina**. Abans de tallar un moble sencer:
1. Comparar els fitxers d'una peça senzilla (un lateral) amb els que fa TopSolid per a la mateixa peça.
2. Executar el programa .xcs en buit (eina aixecada) i mirar el recorregut.
3. Tallar una peça de prova en retall, i després un mòdul petit.

## Stack
Vite · React 19 · TypeScript (strict) · Chakra UI v3 · three.js / react-three-fiber · Dexie · zod · Vitest · oxlint · knip ·
madge. Sense backend.

## Començar
```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm check    # typecheck, lint (0 avisos), codi mort, cicles i tests (inclou arquitectura i proves d'or)
pnpm build    # dist/ + service worker
```

Amb Docker (nginx, port 7214; per a l'iPhone cal HTTPS al davant):
```bash
docker compose up -d --build
```

## Com està fet
```
src/
  core/        lògica pura i testejada (sense React, three ni Dexie): model, build (composició → peces),
               export (STEP, .xcs, CSV, DXF, Vista CAM), nesting, cutlist, machine, photo, assistant
               import/ (adormit: importar ferratges del fabricant, sense UI)
  components/  mòduls de UI compartits i el visor 3D
  features/    una carpeta per pantalla
  lib/ · db/ · app/ · theme/
```
- **La fabricació surt només de `core/`**; el visor 3D la pinta. Les regles de capes es comproven soles
  (`src/architecture.test.ts`).
- **Proves d'or** (`src/core/build/golden.test.ts`): totes les plantilles i 200 variacions aleatòries; qualsevol canvi a
  les peces, mecanitzats o fitxers del taller fa fallar el test. Un canvi volgut es refà amb `UPDATE_GOLDEN=1 pnpm test`
  i es revisa el diff.
- Els tests d'anada i tornada amb el parser del taller i amb descàrregues reals de Hettich/Blum se salten si no hi ha
  aquests fitxers a la màquina (no es pugen al repo).

## Documentació
- [`CLAUDE.md`](CLAUDE.md): què és, principis, stack, convencions de fusteria i com treballar-hi.
- [`docs/convencions.md`](docs/convencions.md): com s'organitza el codi (capes, mides, patrons de React).
- [`docs/funcional/`](docs/funcional/): com funciona cada part (model, fabricació, exports, editor, visor…).
- [`docs/maestro-xcs.md`](docs/maestro-xcs.md), [`docs/export-taller.md`](docs/export-taller.md): formats del taller.
- [`docs/ferratges-jocs.md`](docs/ferratges-jocs.md): ferratges com a jocs paramètrics del catàleg.
