# Prompt — Preferències (dades de l'usuari, no del codi)

Copia-ho a Claude Code dins de `~/Desktop/cnc`.

---

Llegeix el `CLAUDE.md` abans de començar.

## Objectiu
Les mides i els valors que depenen de mi (la meva tele, els meus materials, els taulers
del taller...) **no han d'estar escrits al codi**. Han de ser a una pantalla de
**Preferències** que jo edito. El codi porta només uns valors inicials.

## 1. Pantalla "Preferències"
Nova entrada al menú (icona `LuSettings`), amb seccions plegables:

1. **Objectes de referència** (una sola llista per a la foto i per a l'editor):
   nom, **amplada, alçada, fondària**, pla (paret o terra) i **distància a la paret**.
   - **A la foto** es fa servir la cara del davant (amplada × alçada) per calibrar, i la
     distància a la paret per corregir l'escala.
   - **A l'editor** és un objecte fantasma 3D (amplada × alçada × fondària) per
     comprovar que tot hi cap: la tele sobre el moble, el radiador dins del cobreradiador.
   - La fondària és opcional per a referències planes (A4, rajola). Si falta, l'objecte
     no es pot afegir com a fantasma 3D.
   - Valors inicials: full A4 (vertical i horitzontal), rajoles 300×300, 600×600 i
     600×300, portes 800×2030 i 700×2030, i:
     - **"TV Sony KD-55XD8505 (pantalla)"**: 1231 × 717 × 44, a 200 mm de la paret;
     - **"TV Sony KD-55XD8505 (amb peu)"**: 1231 × 770 × 263 (per posar-la sobre el
       moble a l'editor; el peu fa uns 515 d'ample).
   - Afegir, editar, duplicar, eliminar i reordenar. Els valors inicials es poden
     amagar, però no esborrar.
   - La pantalla de la foto llegeix aquesta llista en lloc de `REF_PRESETS` (que avui és
     fixa a `PhotoScreen.tsx`); treu la constant. Els objectes de referència de l'editor
     de compartiments es trien d'aquesta mateixa llista (i s'hi poden crear al moment,
     p. ex. "Radiador menjador").
2. **Materials**: nom, gruixos disponibles (p. ex. 10 · 16 · 19 · 30), si té veta,
   acabat visual (color o fusta) i cantell per defecte. Són els que surten als
   desplegables de l'editor.
3. **Taulers i nesting**: mides de tauler per material (per defecte 2800×2070), kerf
   (6), marge del tauler, rotació permesa o no segons la veta.
4. **Ferratges i mecanitzats per defecte**: cassoleta (Ø, fondària, distància al
   cantell), System 32 (filera, pas, Ø, fondària), espiga (Ø, fondàries), llargades de
   guia de calaix disponibles. **Un mòdul nou pren aquests valors**; els mòduls
   existents no canvien.
5. **Jocs per defecte**: portes, entre fronts, prestatges, fons.
6. **Etiquetes**: mida de l'etiqueta per a `PosX/PosY` de l'export del taller (per
   defecte 99×68, Avery L7165).
7. **Visualització**: unitat de les mides a la pantalla (mm o cm; internament sempre mm).

## 2. Dades
- Taula `settings` a Dexie, amb esquema zod i **versió** per poder migrar.
- Si no hi ha preferències guardades, es creen amb els valors inicials.
- **Exportar / importar preferències** en JSON, per fer còpia o passar-les a un altre
  dispositiu (p. ex. del Mac a l'iPhone, o al taller del meu germà).
- Botó **"Restaurar valors inicials"** per secció, amb confirmació.

## 3. Regles
- Canviar una preferència **no modifica mobles ja fets**. Només afecta els nous, o les
  pantalles que llegeixen la llista, com la de la foto.
- Validació amb missatges en català (p. ex. gruix entre 3 i 60 mm).
- Tests: valors inicials vàlids; migració d'una versió anterior; importar un JSON
  invàlid no trenca res i ho diu; la foto fa servir una referència creada per
  l'usuari; un objecte amb fondària es pot afegir com a fantasma a l'editor i un sense
  fondària no.

Al final: `pnpm typecheck && pnpm test && pnpm build`.
