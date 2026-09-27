# Prompt inicial per a Claude Code

Copia-ho a Claude Code dins d'aquesta carpeta (`~/Desktop/cnc`).

---

Llegeix el `CLAUDE.md` i la skill `.claude/skills/chakra-ui-builder/SKILL.md` abans de començar.

Vull construir la **Fase 1** d'una PWA per dissenyar mobles de cos paramètrics. El
projecte està buit: fes-ne el scaffold i la primera versió funcional.

## Fase 1 — abast
Un sol tipus de moble: **mòdul de caixa** (dos laterals, base, sostre, fons, prestatges
opcionals, 0–2 portes). Res més fins que això funcioni de punta a punta.

### 1. Scaffold
- Vite + React + TypeScript strict amb pnpm.
- Chakra UI v3: instal·la-ho i genera els snippets amb `npx @chakra-ui/cli snippet add`.
  Crea `src/theme/system.ts` amb `createSystem` i el `globalCss` dels inputs a 16px.
- Instal·la `react-icons` i fes servir només `react-icons/lu`.
- `@react-three/fiber`, `@react-three/drei`, `three`, `dexie`, `zod`,
  `vite-plugin-pwa`, `vitest`.
- Scripts: `dev`, `build`, `test`, `typecheck`, `lint`.

### 2. Nucli (`src/core/`, amb tests)
- Esquema zod del mòdul: amplada, alçada, fondària (mm), gruix tauler, gruix fons,
  nombre de prestatges, nombre de portes, tipus de fons (encastat en ranura o cargolat).
- `buildCabinet(params) -> Panel[]`: genera les peces amb mides correctes segons els
  gruixos (els laterals abracen base i sostre).
- Forats: System 32 als laterals per als prestatges, cazoletes Ø35 a les portes i
  forats d'unió (minifix o espiga) entre laterals i base/sostre.
- `toCutList(panels)`: llista de peces agrupant les idèntiques, amb cantells.
- `toDxf(panels)`: DXF amb capa `CONTOUR` i capes de forat `DRILL_D{Ø}_P{prof}`.
  Escriu el writer DXF tu mateix (R12 ASCII és suficient) i testeja'l.
- Noms de peça amb el vocabulari de `taller-cnc-nest` (`lat d`, `lat e`, `base`,
  `sostre`, `prestatge`, `trassera`, `porta`) i refs `A.<mòdul>.<tipus>.<n>`.
- `nest(panels, boardSpec)`: nesting **simple** de peces rectangulars (guillotina o
  per franges) respectant veta, gruix/material i separació de fresa (kerf 6 mm per
  defecte, configurable). No cal que sigui òptim; cal que sigui correcte. Retorna
  taulers i, per peça, `tab`, `x`, `y` (centre) i `angle`.
- `toUnified(panels, nesting)`: genera un `UnifiedData` complet per al taller
  (vegeu la secció d'integració del `CLAUDE.md`). Copia'n els tipus de
  `~/Desktop/taller-cnc-nest/src/nesting/types.ts`; no modifiquis aquell repo.
- Tests:
  - mides de peces d'un mòdul de 600×720×560 amb 19 mm;
  - recompte de forats;
  - el DXF conté les capes esperades;
  - el nesting no solapa peces ni surt del tauler;
  - el `UnifiedData` valida contra l'esquema zod i totes les `ref` són úniques.

### 3. UI (Chakra v3 + react-icons)
Pantalles, mobile-first i en català:
1. **Projectes**: llista de mobles guardats a Dexie, crear/duplicar/esborrar.
2. **Editor**: formulari de paràmetres a l'esquerra (o a dalt al mòbil) i visor 3D
   (r3f, OrbitControls) que s'actualitza en viu. Botó per mostrar en explosionat.
3. **Llista de peces**: taula amb mides, quantitat, cantells; exportar CSV.
4. **Nesting**: taulers dibuixats amb les peces col·locades (SVG), per revisar-ho.
5. **Exportar**: descarregar DXF, CSV, GLB i JSON `UnifiedData` (per al taller).

Navegació inferior al mòbil amb icones Lucide; barra lateral a escriptori.

### 4. PWA
Manifest amb nom "Mobles", icones, funciona offline, instal·lable a l'iPhone.

## Fora d'abast ara (fases posteriors, no ho facis)
- Fase 2: nesting millor (aprofitament, restes reutilitzables).
- Fase 3: foto del racó amb calibració per homografia i moble superposat.
- Fase 4: export USDZ + `<model-viewer>` per AR Quick Look.
- Fase 5: més tipus de moble (calaixeres, mòduls de cuina, composicions).

## Com vull que treballis
- Primer ensenya'm un pla curt de fitxers i decisions, després implementa.
- Fes-ho per passos: scaffold → core amb tests → UI → PWA. Al final de cada pas
  executa `pnpm typecheck && pnpm test && pnpm build`.
- Si hi ha un dubte de fusteria (joc de les portes, tipus d'unió, retranqueig del
  fons), pregunta'm abans d'inventar.
- Al final, dona'm les instruccions per provar-ho a l'iPhone a la xarxa local.
