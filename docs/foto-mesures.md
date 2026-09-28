# Foto: mesures, estats i fondària

Notes de `core/photo/measure.ts` i de la pestanya Foto (setembre 2026). El prompt és a
`docs/prompt/PROMPT-foto.md`.

## Un sol model de pla, tres estats
- El pla de la referència es modela sempre amb **amplada = 1** (l'alçada surt de la
  proporció: mides conegudes, forma del preset o, si no hi ha res, la imatge mateixa).
  Així qualsevol mesura té valor **relatiu** només amb els 4 punts marcats.
- Els mil·límetres surten de l'**amplada efectiva**: la mitjana de les cintes
  (`cinta / relativa` de cada mesura amb cinta) si n'hi ha; si no, l'amplada coneguda
  de la referència; si no, res (Total en blanc, mai un zero).
- Estat d'una mesura: **real** si té cinta; **estimada** si hi ha escala; **relativa** si
  no. Escriure una cinta recalibra tota la foto (la referència inclosa: si no tenia
  mides, ara les té; si en tenia, s'escalen).
- Marge d'error mostrat: ±5 % amb escala de mides o forma; ±15 % quan la proporció
  s'ha tret de la imatge (només fiable si la foto és frontal).

## Qualitat del calibratge
Amb una càmera de forat i un rectangle de debò, les dues primeres columnes de `K⁻¹·H`
són perpendiculars i de la mateixa longitud. Si les escales difereixen més d'un 12 %
o l'angle s'allunya més de 7° dels 90°, s'avisa. Una focal equivocada només es nota en
fotos obliqües: de cara no es pot detectar.

## Línia del terra i fondària
- La línia del terra (2 punts on la paret toca el terra) es passa al pla de la paret
  real (`z = −distància de la referència a la paret`) i dona `y` del terra. Es proposa
  l'origen al seu extrem esquerre.
- Fondària: el raig del punt tocat s'interseca amb el pla `y = terra`; la distància a
  la paret és `z + distància de la referència`. L'error és `píxels / f · D / sin θ`
  (θ = angle del raig amb el terra): per sobre del 35 % es recomana una foto de biaix o
  una segona de costat.

## Aplicar mesures al moble
Una mesura es pot aplicar a l'amplada, alçada o fondària d'un mòdul o d'un objecte de
referència. Es recorda quina mesura hi ha darrere de cada paràmetre i, mentre alguna
sigui estimada o relativa, l'Editor, la pestanya Foto i la pantalla d'Exportar mostren
«No tallis amb mides estimades» (i un avís en descarregar DXF, STEP o CSV).
