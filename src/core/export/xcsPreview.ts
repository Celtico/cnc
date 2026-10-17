/**
 * Vista CAM: lector del text MSL (.xcs) que escriu l'app (`toMaestroNestXcs`, `toMaestroXcs`), el mateix que va al zip,
 * per dibuixar què rebrà la màquina. No és un intèrpret de l'MSL: només les instruccions que fem servir (i les del
 * programa real del taller, `CreateToolpath`…). La resta de línies es compten com a `unknown` i no fan res (mai llança).
 *
 * Coordenades del pla (`Top`: X, Y del tauler o de la peça, origen a baix a l'esquerra), en mm.
 */

// Les peces (tipus, lector, geometria, dibuix i llegenda) són a `./cam/`: aquí, l'API de sempre.
export type { CamOp, CamPath, Pt, XcsPreview } from "./cam/types"
export { arcCenter, flattenPath, offsetPolyline } from "./cam/geometry"
export { signedArea } from "../model/polygon"
export { parseXcsPreview } from "./cam/parse"
export { approachSegment, camDraw, camRows, camTools, cutWidth, findTool, toolKey, type CamDraw, type CamRow, type CamToolInfo } from "./cam/draw"
