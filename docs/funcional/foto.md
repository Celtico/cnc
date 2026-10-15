# Foto

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Foto
- La foto serveix per **veure proporcions**, no per fabricar. Les mides reals sempre les entra l'usuari i **recalculen** el
  model i recalibren la foto.
- Calibració: 4 punts d'un rectangle de mides conegudes (rajola, porta, A4) → homografia → escala i pla del terra/paret.
  EXIF (focal) si n'hi ha (focal 35 mm = 0 vol dir desconeguda).
- Rectangle amb cinta: només el valor principal és real; l'alçada continua estimada (`MeasureValue.state2`/`error2`) i les
  aplicades recorden quin valor (`AppliedMeasure.which`). L'origen (`originMm`) es desa amb l'escala d'aquell moment
  (`originScale`) i `scaledOrigin` el passa a l'actual: recalibrar no el fa lliscar.
- Moble sobre la foto (`cal.render`): **Línies** (SVG de cares projectades) o **Realista** (`photo/PhotoRender.tsx`: three.js
  amb la càmera calibrada, materials reals, llum de Preferències › Visor 3D i ombres sobre plans invisibles). L'SVG de
  controls va sempre a sobre. Panell de 280–560 px.
