# Mobles CNC

App web (PWA) per dissenyar mobles **paramètrics** i treure'n directament el que necessita el taller: llista de peces,
nesting, programes de **SCM Maestro (.xcs)**, **STEP + CSV** (format TopSolid) i **DXF**. Objectiu: substituir TopSolid per
fer mobles de cos a mida amb una CNC.

- **Editor paramètric**: mòduls, compartiments, portes, calaixos, prestatges i peces lliures; tot canvia amb les mides.
- **Fusteria real**: unions, System 32, cassoletes, ranures del fons, folgances, jocs de calaix del catàleg (DTC, Häfele).
- **Sortida per al taller**: nesting sobre taulers, programes .xcs per tauler, STEP 3D + CSV, DXF per capes, Vista CAM.
- **Veure-ho abans de fer-ho**: visor 3D, alçat, moble sobre una foto del lloc, ambients (plànol de la casa), render
  fotorealista i AR.
- **Funciona sense connexió** i es pot instal·lar a l'iPhone. Tot es desa al navegador (IndexedDB); no hi ha servidor.

## Stack
Vite · React 19 · TypeScript (strict) · Chakra UI v3 · three.js / react-three-fiber · Dexie · zod · Vitest.

## Començar
```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm check    # typecheck, lint, codi mort, cicles i tests (inclou les proves d'or de fabricació)
pnpm build
```

## Documentació
- [`CLAUDE.md`](CLAUDE.md): què és, principis, stack, convencions de fusteria i com treballar-hi.
- [`docs/convencions.md`](docs/convencions.md): com s'organitza el codi (capes, mides, patrons de React).
- [`docs/funcional/`](docs/funcional/): com funciona cada part (model, fabricació, exports, editor, visor…).
- [`docs/maestro-xcs.md`](docs/maestro-xcs.md), [`docs/export-taller.md`](docs/export-taller.md): formats del taller.
