import { BoxGeometry, MeshStandardMaterial, type BufferGeometry, type Texture } from "three"
import type { MaterialPref, Panel } from "../../core/model"
import { ROLE_COLOR } from "./roleColorMap"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { RAW_EDGE_COLOR, TILE_MM, applyFinishFx, patternTexture, photoTexture, resolveEdgeFinish, resolveFinish, woodGenOf, woodTexture, type FinishSpec } from "./textures"

/** Materials i geometria de les peces (visor, GLB/USDZ, miniatures). mm → m. */
const S = 0.001

/**
 * Textura clonada amb repetició segons la mida real de la cara i la veta girada si cal.
 * `tileMm` = amplada real d'una repetició (la veta hi va d'esquerra a dreta) i `aspect` =
 * alçada ÷ amplada de la imatge. Girada (veta en v), l'horitzontal de la imatge cobreix la v de
 * la cara (three escala després de girar), per això es creuen les repeticions.
 */
function faceTexture(base: Texture, uMm: number, vMm: number, rotate: boolean, tileMm = TILE_MM, aspect = 1): Texture {
  const t = base.clone()
  t.needsUpdate = true
  t.center.set(0.5, 0.5)
  t.rotation = rotate ? Math.PI / 2 : 0
  const tw = tileMm, th = tileMm * aspect
  if (rotate) t.repeat.set(vMm / tw, uMm / th)
  else t.repeat.set(uMm / tw, vMm / th)
  return t
}

/** Material d'un acabat amb la llum i la translucidesa del render (`applyFinishFx`). */
function makeMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }): MeshStandardMaterial {
  return applyFinishFx(baseMaterial(finish, uMm, vMm, rotate, opts), finish)
}

function baseMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }): MeshStandardMaterial {
  // `userData.grain`: el render fa relleu i brillantor variable amb la veta (`sceneData`).
  if (finish.kind === "wood") {
    const m = new MeshStandardMaterial({ map: faceTexture(woodTexture(finish.species, finish.gen), uMm, vMm, rotate, woodGenOf(finish.species, finish.gen).tileMm), roughness: 0.7, metalness: 0, ...opts })
    m.userData.grain = true
    return m
  }
  // Foto real del tauler: la mateixa escala que al tauler de debò (tileMm = amplada de la foto).
  // Amb mapes PBR (normal, rugositat): la mateixa repetició i gir que el color.
  if (finish.kind === "image") {
    // Veta vertical a la foto: es gira un quart més perquè vagi com la de la peça.
    const turn = finish.grain === "y" ? !rotate : rotate
    const tex = (src: string, linear: boolean) => faceTexture(photoTexture(src, finish.seamless, linear), uMm, vMm, turn, finish.tileMm, finish.aspect)
    const m = new MeshStandardMaterial({
      map: tex(finish.src, false),
      ...(finish.normalMap ? { normalMap: tex(finish.normalMap, true) } : {}),
      ...(finish.roughMap ? { roughnessMap: tex(finish.roughMap, true) } : {}),
      roughness: Math.min(1, finish.roughness ?? (finish.roughMap ? 1 : 0.7)),
      metalness: 0,
      ...opts,
    })
    // Sense mapa de normals, el relleu de la veta es treu de la foto.
    if (!finish.normalMap) m.userData.grain = true
    return m
  }
  if (finish.kind === "pattern") {
    return new MeshStandardMaterial({ map: faceTexture(patternTexture(finish.pattern, finish.color, finish.grout, finish.opts), uMm, vMm, false, finish.tileMm), roughness: finish.roughness, metalness: finish.metalness ?? 0, ...opts })
  }
  // Vidre: translúcid sempre (també sense vel).
  const glass = finish.opacity !== undefined && finish.opacity < 1
  const mat = new MeshStandardMaterial({ color: finish.color, roughness: finish.roughness, metalness: finish.metalness ?? 0, ...opts, ...(glass ? { transparent: true, opacity: Math.min(opts.opacity, finish.opacity!), depthWrite: false } : {}) })
  // El render per CPU distingeix el vidre dels fantasmes (tots dos transparents).
  if (glass) mat.userData.glass = true
  return mat
}

/**
 * Els 6 materials d'una peça (ordre de BoxGeometry: +x, −x, +y, −y, +z, −z; z = gruix).
 * Cares grans amb l'acabat del material i la veta en la direcció de la peça; cantells
 * folrats amb el material del cantell; cantells sense folrar, tauler vist.
 */
export function panelMaterials(p: Panel, mode: "material" | "role", materials: MaterialPref[], dimmed: boolean): MeshStandardMaterial[] {
  const opts = { transparent: dimmed, opacity: dimmed ? 0.45 : 1 }
  if (mode === "role") {
    const m = new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85, metalness: 0, ...opts })
    return [m, m, m, m, m, m]
  }
  const finish = resolveFinish(materials, p.material)
  const edgeFinish = resolveEdgeFinish(materials, p.material)
  const L = p.length
  const W = p.width
  const T = p.thickness
  const grainY = p.grain === "y"
  // Cares grans: u al llarg de x local (BoxGeometry), veta en x llevat que la peça la tingui en y.
  const big = () => makeMaterial(finish, L, W, grainY, opts)
  // Materials massissos (ferro, pedra, vidre, teixits de simulació): el cantell és el mateix material.
  const solid = materials.find((m) => m.name === p.material)?.cnc === false
  const raw = () => (solid ? makeMaterial(finish, L, T, false, opts) : new MeshStandardMaterial({ color: RAW_EDGE_COLOR, roughness: 0.95, metalness: 0, ...opts }))
  // +x / −x: cara T × W (u = gruix, v = amplada): la veta ha d'anar en v.
  const edgeX = (banded: boolean) => (banded ? makeMaterial(edgeFinish, T, W, true, opts) : raw())
  // +y / −y: cara L × T (u = llargada): la veta va en u.
  const edgeY = (banded: boolean) => (banded ? makeMaterial(edgeFinish, L, T, false, opts) : raw())
  return [edgeX(p.edges.right), edgeX(p.edges.left), edgeY(p.edges.top), edgeY(p.edges.bottom), big(), big()]
}

/** Materials per a la geometria extruïda: [0] cares (A/B), [1] cantells i parets dels forats. UV en metres. */
export function cutoutMaterials(p: Panel, mode: "material" | "role", materials: MaterialPref[], dimmed: boolean): MeshStandardMaterial[] {
  const opts = { transparent: dimmed, opacity: dimmed ? 0.45 : 1 }
  if (mode === "role") {
    const m = new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85, metalness: 0, ...opts })
    return [m, m]
  }
  // UV en metres: 1000 mm per unitat de textura.
  const face = makeMaterial(resolveFinish(materials, p.material), 1000, 1000, p.grain === "y", opts)
  const edge = makeMaterial(resolveEdgeFinish(materials, p.material), 1000, 1000, false, opts)
  return [face, edge]
}

/**
 * Geometria i materials reals d'una peça (els mateixos del visor, amb textures i veta) per
 * exportar-la (GLB / USDZ de «Veure a casa»). Coordenades en m, origen a la cantonada.
 */
export function exportablePanel(full: Panel, materials: MaterialPref[]): { geometry: BufferGeometry; material: MeshStandardMaterial[] } {
  const panel = visualPanel(full)
  if (isShaped(panel)) return { geometry: shapedGeometry(panel), material: cutoutMaterials(panel, "material", materials, false) }
  if (panel.mitres?.length) {
    const m = cutoutMaterials(panel, "material", materials, false)
    return { geometry: mitreGeometry(panel), material: [m[1]!, m[0]!] }
  }
  const g = new BoxGeometry(panel.length * S, panel.width * S, panel.thickness * S)
  g.translate((panel.length * S) / 2, (panel.width * S) / 2, (panel.thickness * S) / 2)
  return { geometry: g, material: panelMaterials(panel, "material", materials, false) }
}

/** La peça per dibuixar-la: sense els forats dels tiradors (el tirador els tapa). */
export function visualPanel(p: Panel): Panel {
  if (!p.cutouts?.some((c) => c.tag === "handle")) return p
  const cutouts = p.cutouts.filter((c) => c.tag !== "handle")
  const { cutouts: _c, ...rest } = p
  void _c
  return cutouts.length ? { ...rest, cutouts } : rest
}
