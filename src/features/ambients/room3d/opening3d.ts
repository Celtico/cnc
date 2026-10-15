import { BoxGeometry, Mesh, MeshStandardMaterial, type Group } from "three"
import { surfaceMaterial } from "../../../components/viewer/surfaceMaterial"
import type { MaterialPref, Opening } from "../../../core/model"

/**
 * Finestra, porta o vidriera dins del forat de la paret (grup de la paret: x al llarg, y amunt,
 * z pel gruix): marc de perfils, travessers i vidre (o la fulla de fusta de la porta).
 */
export function addOpening(wg: Group, o: Opening & { u0: number; u1: number }, thickness: number, materials: MaterialPref[]) {
  const W = o.u1 - o.u0
  const f = o.kind === "glazing" ? 40 : 55
  const fd = Math.min(thickness, o.kind === "glazing" ? 60 : 70)
  const frameMat = surfaceMaterial(materials, o.frame ?? (o.kind === "door" ? "Roure massís / xapat" : "Alumini negre"), 200, 200)
  const box = (x0: number, x1: number, y0: number, y1: number, d: number, mat: MeshStandardMaterial, z = 0) => {
    const m = new Mesh(new BoxGeometry((x1 - x0) / 1000, (y1 - y0) / 1000, d / 1000), mat)
    m.position.set((x0 + x1) / 2000, (y0 + y1) / 2000, z / 1000)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.room = "wall"
    wg.add(m)
  }
  const y0 = o.sill, y1 = o.sill + o.h
  // Marc
  box(o.u0, o.u0 + f, y0, y1, fd, frameMat)
  box(o.u1 - f, o.u1, y0, y1, fd, frameMat)
  box(o.u0 + f, o.u1 - f, y1 - f, y1, fd, frameMat)
  if (o.kind !== "door" || o.sill > 0) box(o.u0 + f, o.u1 - f, y0, y0 + f, fd, frameMat)
  // Ampit de pedra a les finestres.
  if (o.kind === "window" && o.sill > 0) box(o.u0 - 40, o.u1 + 40, y0 - 30, y0, thickness + 60, surfaceMaterial(materials, "Pedra calcària", W, 100))
  if (o.kind === "door") {
    box(o.u0 + f, o.u1 - f, y0, y1 - f, 40, surfaceMaterial(materials, o.frame ?? "Roure massís / xapat", W, o.h))
    return
  }
  const panes = o.panes ?? Math.max(1, Math.round(W / (o.kind === "glazing" ? 1200 : 900)))
  for (let i = 1; i < panes; i++) {
    const x = o.u0 + (W * i) / panes
    box(x - f / 2, x + f / 2, y0 + f, y1 - f, fd, frameMat)
  }
  const glass = new MeshStandardMaterial({ color: "#dbe7e8", roughness: 0.03, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false })
  glass.userData.glass = true
  glass.userData.baseOpacity = 0.18
  const m = new Mesh(new BoxGeometry((W - 2 * f) / 1000, (o.h - 2 * f) / 1000, 0.008), glass)
  m.position.set((o.u0 + o.u1) / 2000, (y0 + y1) / 2000, 0)
  m.userData.room = "wall"
  // Per al render: la llum del cel entra per aquí (portal).
  m.userData.portal = true
  wg.add(m)
}
