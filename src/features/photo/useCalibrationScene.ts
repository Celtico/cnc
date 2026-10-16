import { useCallback, useMemo } from "react"
import { panelBox } from "../../core/build/geometry"
import type { Panel } from "../../core/model"
import { DEFAULT_FOCAL_35, cameraFromHomography, focalPx, imageToPlane, imageToPlaneAt, project, projectPanels } from "../../core/photo/camera"
import { applyHomography, planeToImage, rectanglePoints, type Pt } from "../../core/photo/homography"
import { calibrationQuality, effectiveReference, floorLevel, measureValues, planeModel, scaledOrigin } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"
import { AXIS_MM, NO_MEASURES, fin, known, type Vec3m } from "./calibration"

/** Tot el que surt del calibratge: model del pla, càmera, terra, origen i el moble projectat. Només càlculs. */
export function useCalibrationScene(cal: PhotoCalibration, W: number, H: number, panels: Panel[], totalDepth: number) {
  const calibrated = cal.points.length === 4
  const measures = cal.measures ?? NO_MEASURES
  const refW = known(cal.ref.w)
  const refH = known(cal.ref.h)

  // Model del pla (amplada de referència = 1): serveix per a les mesures relatives.
  const model = useMemo(() => (calibrated ? planeModel({ points: cal.points, refW, refH, aspect: cal.refAspect ?? null }) : null), [calibrated, cal.points, refW, refH, cal.refAspect])
  const values = useMemo(() => (model ? measureValues(model, measures, refW) : []), [model, measures, refW])
  // Mides efectives de la referència en mm (cinta > mides conegudes). Si no n'hi ha, no hi ha càmera ni moble.
  const effective = useMemo(() => (model ? effectiveReference(model, measures, refW) : null), [model, measures, refW])
  const homography = useMemo(() => (calibrated && effective ? planeToImage(cal.points, effective.w, effective.h) : null), [calibrated, cal.points, effective])
  // Una focal desada de 0 (EXIF «desconeguda» d'abans): la per defecte.
  const fPx = focalPx(cal.focal35 > 0 ? cal.focal35 : DEFAULT_FOCAL_35, W, H)
  const camera = useMemo(() => (homography ? cameraFromHomography(homography, fPx, W / 2, H / 2) : null), [homography, fPx, W, H])
  const quality = useMemo(() => (homography ? calibrationQuality(homography, fPx, W / 2, H / 2) : null), [homography, fPx, W, H])
  const wallOffset = cal.plane === "wall" ? fin(cal.refWallOffset) : 0
  // Punt de la imatge → pla on es recolza el moble (la paret real, no la referència).
  const toSupport = useCallback((p: Pt): Pt | null => (camera ? imageToPlaneAt(camera, p, -wallOffset) : homography ? imageToPlane(homography, p) : null), [camera, homography, wallOffset])
  // Línia del terra → alçada del terra sobre la paret.
  const floor = useMemo(() => (camera && cal.floorLine ? floorLevel(camera, cal.floorLine, wallOffset) : null), [camera, cal.floorLine, wallOffset])
  // Origen 3D (mm). Sense origen: cantonada baix-esquerra de la referència, a la paret.
  // L'origen es desa en mm amb l'escala d'aquell moment (`originScale`): es passa a l'escala d'ara.
  const scaleW = effective?.w ?? null
  const origin3 = useMemo<Vec3m | null>(() => {
    if (cal.originMm) return scaledOrigin(cal.originMm, cal.originScale, scaleW)
    if (!cal.origin) return null
    const q = toSupport(cal.origin)
    return q ? [q[0], q[1], 0] : null
  }, [cal.originMm, cal.originScale, scaleW, cal.origin, toSupport])
  // Escala amb què es desa un origen nou (mm d'ara).
  const originScaleNow = scaleW ? { originScale: scaleW } : { originScale: undefined }
  const originX = origin3 ? origin3[0] : 0
  const originY = origin3 ? origin3[1] : 0
  const originZ = origin3 ? origin3[2] : 0
  const sceneOffset = useMemo<Pt>(() => [fin(originX) + fin(cal.offset[0]), fin(originY) + fin(cal.offset[1])], [originX, originY, cal.offset])
  const sceneOpts = useMemo(
    () => ({ plane: cal.plane, offset: sceneOffset, totalDepth, wallOffset, offsetZ: fin(originZ) + fin(cal.offsetZ) }),
    [cal.plane, sceneOffset, totalDepth, wallOffset, cal.offsetZ, originZ],
  )
  const faces = useMemo(() => (camera ? projectPanels(panels, camera, sceneOpts) : []), [camera, panels, sceneOpts])
  // Render realista: mida del moble (per a la llum i les ombres).
  const cabinetSize = useMemo(() => {
    let w = 0, h = 0, d = 0
    for (const p of panels) {
      const b = panelBox(p)
      w = Math.max(w, b.max[0]); h = Math.max(h, b.max[1]); d = Math.max(d, b.max[2])
    }
    return { width: w, height: h, depth: d }
  }, [panels])
  // Eixos 3D = marcador de l'origen (0,0,0): X al llarg de la paret, Y amunt, Z cap a la càmera.
  const axes = useMemo(() => {
    if (!camera || !calibrated || cal.plane !== "wall") return null
    const o: Vec3m = [originX, originY, -wallOffset + originZ]
    const at = (dx: number, dy: number, dz: number) => project(camera, [o[0] + dx, o[1] + dy, o[2] + dz])
    const o2 = at(0, 0, 0)
    const x = at(AXIS_MM, 0, 0)
    const y = at(0, AXIS_MM, 0)
    const z = at(0, 0, AXIS_MM)
    if (!o2 || !x || !y || !z) return null
    return { o: o2, ends: [x, y, z] as const }
  }, [camera, calibrated, cal.plane, originX, originY, originZ, wallOffset])
  const refOutline = useMemo(() => (model ? rectanglePoints(1, 1 / model.aspect).map((p) => applyHomography(model.h, p)) : null), [model])

  return {
    calibrated,
    measures,
    refW,
    refH,
    values,
    effective,
    homography,
    camera,
    quality,
    wallOffset,
    toSupport,
    floor,
    origin3,
    originScaleNow,
    originX,
    originY,
    originZ,
    sceneOpts,
    faces,
    cabinetSize,
    axes,
    refOutline,
  }
}

export type CalibrationScene = ReturnType<typeof useCalibrationScene>
