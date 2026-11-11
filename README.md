# Mobles CNC

**Dissenya un moble a la pantalla i surt del taller amb les peces tallades.** Una app web gratuïta i sense servidor per fer
mobles de cos a mida i treure'n tot el que necessita una CNC: llista de peces, nesting, programes de màquina, STEP i DXF.
I, abans de tallar res, veure'l en 3D, sobre una foto del lloc o en un render fotorealista com aquests.

<p align="center"><a href="docs/renders/ok4-4.jpg"><img src="docs/renders/ok4-4.jpg" width="100%" alt="Cuina de roure amb illa, render fet amb l'app"></a></p>

<p align="center"><i>Tots els renders d'aquesta pàgina surten de l'app, del mateix model que genera les peces per a la CNC.</i></p>

> **Busco gent que s'hi vulgui sumar.** No és un producte comercial ni hi ha cap empresa al darrere: és un projecte fet a
> mà per substituir TopSolid en un taller petit. Ja fa molt, però una sola persona no arriba a tot. Si ets fuster, tens una CNC,
> programes en React/three.js o simplement t'agrada la idea, [mira com pots ajudar](#vols-ajudar).

## Què pots fer amb l'app

<p><a href="docs/renders/ambient-nou-2-render-4.jpg"><img src="docs/renders/ambient-nou-2-render-4.jpg" width="32%" alt="Cuina i menjador en un ambient"></a> <a href="docs/renders/cuina-verd-fosc-i-roure-render.jpg"><img src="docs/renders/cuina-verd-fosc-i-roure-render.jpg" width="32%" alt="Cuina verd fosc i roure"></a> <a href="docs/renders/salo-al-vespre-render-2.jpg"><img src="docs/renders/salo-al-vespre-render-2.jpg" width="32%" alt="Saló al vespre"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-4.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-4.jpg" width="32%" alt="Cuina negra amb illa"></a> <a href="docs/renders/moble-nou-2-render-3.jpg"><img src="docs/renders/moble-nou-2-render-3.jpg" width="32%" alt="Moble explotat: peces, calaixos i corredisses"></a> <a href="docs/renders/cuina-oberta-amb-illa-negra-render.jpg"><img src="docs/renders/cuina-oberta-amb-illa-negra-render.jpg" width="32%" alt="Cuina oberta amb illa"></a> <a href="docs/renders/showroom-render.jpg"><img src="docs/renders/showroom-render.jpg" width="32%" alt="Showroom"></a> <a href="docs/renders/prova-columna-fons-render-5.jpg"><img src="docs/renders/prova-columna-fons-render-5.jpg" width="32%" alt="Mòduls amb llum"></a> <a href="docs/renders/salo-arquitectonic-render12.jpg"><img src="docs/renders/salo-arquitectonic-render12.jpg" width="32%" alt="Saló arquitectònic"></a> <a href="docs/renders/ambient-nou-2-render-6.jpg"><img src="docs/renders/ambient-nou-2-render-6.jpg" width="32%" alt="Illa de cuina"></a> <a href="docs/renders/dormitori-linia-render.jpg"><img src="docs/renders/dormitori-linia-render.jpg" width="32%" alt="Dormitori Línia"></a> <a href="docs/renders/llum-epotrables.jpg"><img src="docs/renders/llum-epotrables.jpg" width="32%" alt="Llums encastats"></a></p>

- **Editor paramètric**: mòduls, compartiments, portes, calaixos, prestatges i peces lliures; tot canvia amb les mides.
- **Fusteria real**: unions, System 32, cassoletes, ranures del fons, folgances, jocs de calaix del catàleg (DTC, Häfele).
- **Sortida per al taller**: nesting sobre taulers, programes de **SCM Maestro (.xcs)** per tauler, **STEP 3D + CSV**
  (format TopSolid), **DXF** per capes, Vista CAM, etiquetes, plànols i pressupost.
- **Veure-ho abans de fer-ho**: visor 3D, alçat, moble sobre una foto del lloc, ambients (plànol de la casa), render
  fotorealista i AR.
- **Assistent IA** (opcional): un xat a l'editor que fa les mateixes operacions que la UI, amb la clau de l'API de
  l'usuari (Preferències › Assistent IA).
- **Funciona sense connexió** i es pot instal·lar a l'iPhone. Tot es desa al navegador (IndexedDB); no hi ha servidor ni
  comptes: les teves dades són teves.

## Vols ajudar?

El nucli funciona i està cobert per proves, però hi ha feina per a perfils molt diferents:

- **Fusters i tallers amb CNC**: provar-la amb mobles de debò i dir què falta o què no es fa així al taller. Sobretot, falta
  **validar els programes a la màquina** (vegeu [Estat](#estat)).
- **Altres màquines**: ara surt .xcs per a SCM Maestro, STEP/CSV i DXF. Postprocessadors per a altres CNC (Biesse,
  Homag/woodWOP, Felder…) obririen l'app a molts més tallers.
- **Programadors** (TypeScript, React, three.js): el codi és estricte, té proves d'or i regles d'arquitectura que es
  comproven soles, així que és fàcil entrar-hi sense trencar res. Comença per [`CLAUDE.md`](CLAUDE.md).
- **Disseny i traducció**: l'app és en català; traduir-la (castellà, anglès…) i polir la interfície.

Obre una *issue* o una *pull request*, o escriu-me directament. Qualsevol ajuda, per petita que sigui, compta.

<details>
<summary><b>In English</b></summary>

Mobles CNC is a free, serverless web app (PWA) to design custom cabinets and furniture and get everything a CNC workshop
needs: cut list, nesting, SCM Maestro programs (.xcs), STEP + CSV and DXF, plus 3D view, photo placement and photorealistic
renders (every image on this page comes from the app). It is a non-commercial, one-person project and I'm looking for
people to help: woodworkers with a CNC to test it, developers (TypeScript/React/three.js), post-processors for other
machines and translators. The UI and docs are in Catalan for now. Issues and pull requests are welcome.
</details>

## Més renders

<details>
<summary>Tots els renders (61)</summary>

**Ambient nou**

<p><a href="docs/renders/ambient-nou-2-render-1-copia.jpg"><img src="docs/renders/ambient-nou-2-render-1-copia.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-1.jpg"><img src="docs/renders/ambient-nou-2-render-1.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-2.jpg"><img src="docs/renders/ambient-nou-2-render-2.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-3.jpg"><img src="docs/renders/ambient-nou-2-render-3.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-4.jpg"><img src="docs/renders/ambient-nou-2-render-4.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-5.jpg"><img src="docs/renders/ambient-nou-2-render-5.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-6.jpg"><img src="docs/renders/ambient-nou-2-render-6.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-8.jpg"><img src="docs/renders/ambient-nou-2-render-8.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-9.jpg"><img src="docs/renders/ambient-nou-2-render-9.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render-copia.jpg"><img src="docs/renders/ambient-nou-2-render-copia.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-2-render.jpg"><img src="docs/renders/ambient-nou-2-render.jpg" width="32%" alt="Ambient nou"></a> <a href="docs/renders/ambient-nou-render-1.jpg"><img src="docs/renders/ambient-nou-render-1.jpg" width="32%" alt="Ambient nou"></a></p>

**Cuina amb illa**

<p><a href="docs/renders/cuina-amb-illa-render-3.jpg"><img src="docs/renders/cuina-amb-illa-render-3.jpg" width="32%" alt="Cuina amb illa"></a></p>

**Cuina de roure**

<p><a href="docs/renders/3-3.jpg"><img src="docs/renders/3-3.jpg" width="32%" alt="Cuina de roure"></a> <a href="docs/renders/55.jpg"><img src="docs/renders/55.jpg" width="32%" alt="Cuina de roure"></a> <a href="docs/renders/ok.jpg"><img src="docs/renders/ok.jpg" width="32%" alt="Cuina de roure"></a> <a href="docs/renders/ok2-2.jpg"><img src="docs/renders/ok2-2.jpg" width="32%" alt="Cuina de roure"></a> <a href="docs/renders/ok4-4.jpg"><img src="docs/renders/ok4-4.jpg" width="32%" alt="Cuina de roure"></a> <a href="docs/renders/prova-render.jpg"><img src="docs/renders/prova-render.jpg" width="32%" alt="Cuina de roure"></a></p>

**Cuina greige**

<p><a href="docs/renders/cuina-greige-2-render-4.jpg"><img src="docs/renders/cuina-greige-2-render-4.jpg" width="32%" alt="Cuina greige"></a></p>

**Cuina greige amb illa**

<p><a href="docs/renders/cuina-greige-amb-illa-2-render.jpg"><img src="docs/renders/cuina-greige-amb-illa-2-render.jpg" width="32%" alt="Cuina greige amb illa"></a></p>

**Cuina greige ok**

<p><a href="docs/renders/cuina-greige-ok-2-render-1.jpg"><img src="docs/renders/cuina-greige-ok-2-render-1.jpg" width="32%" alt="Cuina greige ok"></a> <a href="docs/renders/cuina-greige-ok-2-render.jpg"><img src="docs/renders/cuina-greige-ok-2-render.jpg" width="32%" alt="Cuina greige ok"></a></p>

**Cuina monòlit**

<p><a href="docs/renders/cuina-monolit-render.jpg"><img src="docs/renders/cuina-monolit-render.jpg" width="32%" alt="Cuina monòlit"></a></p>

**Cuina oberta amb illa n4egra**

<p><a href="docs/renders/cuina-oberta-amb-illa-n4egra-render.jpg"><img src="docs/renders/cuina-oberta-amb-illa-n4egra-render.jpg" width="32%" alt="Cuina oberta amb illa n4egra"></a></p>

**Cuina oberta amb illa negra**

<p><a href="docs/renders/cuina-oberta-amb-illa-negra-render.jpg"><img src="docs/renders/cuina-oberta-amb-illa-negra-render.jpg" width="32%" alt="Cuina oberta amb illa negra"></a></p>

**Cuina verd fosc i roure**

<p><a href="docs/renders/cuina-verd-fosc-i-roure-render-1.jpg"><img src="docs/renders/cuina-verd-fosc-i-roure-render-1.jpg" width="32%" alt="Cuina verd fosc i roure"></a> <a href="docs/renders/cuina-verd-fosc-i-roure-render.jpg"><img src="docs/renders/cuina-verd-fosc-i-roure-render.jpg" width="32%" alt="Cuina verd fosc i roure"></a></p>

**Dormitori de calma**

<p><a href="docs/renders/dormitori-de-calma-render3.jpg"><img src="docs/renders/dormitori-de-calma-render3.jpg" width="32%" alt="Dormitori de calma"></a></p>

**Dormitori Línia**

<p><a href="docs/renders/dormitori-linia-render.jpg"><img src="docs/renders/dormitori-linia-render.jpg" width="32%" alt="Dormitori Línia"></a></p>

**Llum epotrables**

<p><a href="docs/renders/llum-epotrables.jpg"><img src="docs/renders/llum-epotrables.jpg" width="32%" alt="Llum epotrables"></a></p>

**Menjador Línia**

<p><a href="docs/renders/menjador-linia-render-copia.jpg"><img src="docs/renders/menjador-linia-render-copia.jpg" width="32%" alt="Menjador Línia"></a> <a href="docs/renders/menjador-linia-render.jpg"><img src="docs/renders/menjador-linia-render.jpg" width="32%" alt="Menjador Línia"></a></p>

**Moble de prova de obcions**

<p><a href="docs/renders/moble-de-prova-de-obcions-render-1.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-1.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-2.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-2.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-3.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-3.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-4.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-4.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-6.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-6.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-7.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-7.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render-8.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render-8.jpg" width="32%" alt="Moble de prova de obcions"></a> <a href="docs/renders/moble-de-prova-de-obcions-render.jpg"><img src="docs/renders/moble-de-prova-de-obcions-render.jpg" width="32%" alt="Moble de prova de obcions"></a></p>

**Moble de prova de obcions (prova avisos Claude)**

<p><a href="docs/renders/moble-de-prova-de-obcions-prova-avisos-claude-render-1.jpg"><img src="docs/renders/moble-de-prova-de-obcions-prova-avisos-claude-render-1.jpg" width="32%" alt="Moble de prova de obcions (prova avisos Claude)"></a></p>

**Moble nou**

<p><a href="docs/renders/moble-nou-2-render-3.jpg"><img src="docs/renders/moble-nou-2-render-3.jpg" width="32%" alt="Moble nou"></a> <a href="docs/renders/moble-nou-2-render.jpg"><img src="docs/renders/moble-nou-2-render.jpg" width="32%" alt="Moble nou"></a></p>

**Prova columna fons**

<p><a href="docs/renders/prova-columna-fons-render-3.jpg"><img src="docs/renders/prova-columna-fons-render-3.jpg" width="32%" alt="Prova columna fons"></a> <a href="docs/renders/prova-columna-fons-render-5.jpg"><img src="docs/renders/prova-columna-fons-render-5.jpg" width="32%" alt="Prova columna fons"></a></p>

**Saló al vespre**

<p><a href="docs/renders/salo-al-vespre-render-2.jpg"><img src="docs/renders/salo-al-vespre-render-2.jpg" width="32%" alt="Saló al vespre"></a> <a href="docs/renders/salo-al-vespre-render-5.jpg"><img src="docs/renders/salo-al-vespre-render-5.jpg" width="32%" alt="Saló al vespre"></a></p>

**Saló amb kilim**

<p><a href="docs/renders/salo-amb-kilim-render-2.jpg"><img src="docs/renders/salo-amb-kilim-render-2.jpg" width="32%" alt="Saló amb kilim"></a></p>

**Saló arquitectònic**

<p><a href="docs/renders/salo-arquitectonic-rende10r.jpg"><img src="docs/renders/salo-arquitectonic-rende10r.jpg" width="32%" alt="Saló arquitectònic"></a> <a href="docs/renders/salo-arquitectonic-render-2.jpg"><img src="docs/renders/salo-arquitectonic-render-2.jpg" width="32%" alt="Saló arquitectònic"></a> <a href="docs/renders/salo-arquitectonic-render12.jpg"><img src="docs/renders/salo-arquitectonic-render12.jpg" width="32%" alt="Saló arquitectònic"></a> <a href="docs/renders/salo-arquitectonic-render3.jpg"><img src="docs/renders/salo-arquitectonic-render3.jpg" width="32%" alt="Saló arquitectònic"></a></p>

**Saló d'estuc**

<p><a href="docs/renders/salo-d-estuc-render.jpg"><img src="docs/renders/salo-d-estuc-render.jpg" width="32%" alt="Saló d'estuc"></a></p>

**Saló Doble U**

<p><a href="docs/renders/salo-doble-u-rende-r.jpg"><img src="docs/renders/salo-doble-u-rende-r.jpg" width="32%" alt="Saló Doble U"></a></p>

**Showroom**

<p><a href="docs/renders/showroom-render3.jpg"><img src="docs/renders/showroom-render3.jpg" width="32%" alt="Showroom"></a> <a href="docs/renders/showroom-render.jpg"><img src="docs/renders/showroom-render.jpg" width="32%" alt="Showroom"></a></p>

**Sistema de paret «Estrat»**

<p><a href="docs/renders/sistema-de-paret-estrat-render.jpg"><img src="docs/renders/sistema-de-paret-estrat-render.jpg" width="32%" alt="Sistema de paret «Estrat»"></a></p>

**Suite de roure**

<p><a href="docs/renders/suite-de-roure-render.jpg"><img src="docs/renders/suite-de-roure-render.jpg" width="32%" alt="Suite de roure"></a></p>

**Vitrina de roure de fil**

<p><a href="docs/renders/vitrina-de-roure-de-fil-2-render.jpg"><img src="docs/renders/vitrina-de-roure-de-fil-2-render.jpg" width="32%" alt="Vitrina de roure de fil"></a></p>

**Vitrina «Galeria»**

<p><a href="docs/renders/vitrina-galeria-render3.jpg"><img src="docs/renders/vitrina-galeria-render3.jpg" width="32%" alt="Vitrina «Galeria»"></a></p>

</details>

## Estat
El nucli (model paramètric → peces → mecanitzats → fitxers del taller) està acabat i cobert per proves
d'or. Per començar a treballar-hi, llegeix [`CLAUDE.md`](CLAUDE.md) i
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
