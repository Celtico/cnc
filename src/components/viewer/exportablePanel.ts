import { BoxGeometry, MeshStandardMaterial, type BufferGeometry, type Texture } from "three"
import { materialCategory, pocketKey, type MaterialPref, type Panel } from "../../core/model"
import { ROLE_COLOR } from "./roleColorMap"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { photoFaceTexture } from "./photoFace"
import { textureOffset, type TextureOffset } from "./textureOffset"
import { RAW_EDGE_COLOR, TILE_MM, applyFinishFx, disposeMaterial, tileClone, patternTexture, photoTexture, resolveEdgeFinish, resolveFinish, woodGenOf, woodTexture, type FinishSpec } from "./textures"

/** Materials i geometria de les peces (visor, GLB/USDZ, miniatures). mm → m. */
const S = 0.001

/**
 * Textura clonada amb repetició segons la mida real de la cara i la veta girada si cal.
 * `tileMm` = amplada real d'una repetició (la veta hi va d'esquerra a dreta) i `aspect` =
 * alçada ÷ amplada de la imatge. Girada (veta en v), l'horitzontal de la imatge cobreix la v de
 * la cara (three escala després de girar), per això es creuen les repeticions.
 * `off`: desplaçament (en repeticions, s'aplica després d'escalar) i gir de 180° propis de la
 * peça perquè no totes tinguin la mateixa veta; va a la matriu UV, que també llegeixen el
 * render (`sceneData`) i l'export (GLB/USDZ).
 */
function faceTexture(base: Texture, uMm: number, vMm: number, rotate: boolean, tileMm = TILE_MM, aspect = 1, off?: TextureOffset): Texture {
  // Sense tornar a pujar la imatge a la GPU (`tileClone`: comparteix la de la base i compta com a clon viu).
  const t = tileClone(base)
  t.center.set(0.5, 0.5)
  t.rotation = (rotate ? Math.PI / 2 : 0) + (off?.flip ? Math.PI : 0)
  const tw = tileMm, th = tileMm * aspect
  if (rotate) t.repeat.set(vMm / tw, uMm / th)
  else t.repeat.set(uMm / tw, vMm / th)
  if (off) t.offset.set(off.u, off.v)
  return t
}

/**
 * Material d'una cara de `uMm` × `vMm` amb l'acabat, pel mateix camí que les peces (textura a mida real, mapes PBR, metall,
 * vidre translúcid, llum que emet): la bola de material de Preferències (`ballMaterial`).
 */
export function finishMaterial(finish: FinishSpec, uMm: number, vMm: number): MeshStandardMaterial {
  return makeMaterial(finish, uMm, vMm, false, { transparent: false, opacity: 1 })
}

/** Material d'un acabat amb la llum i la translucidesa del render (`applyFinishFx`). */
function makeMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }, off?: TextureOffset): MeshStandardMaterial {
  return applyFinishFx(baseMaterial(finish, uMm, vMm, rotate, opts, off), finish)
}

function baseMaterial(finish: FinishSpec, uMm: number, vMm: number, rotate: boolean, opts: { transparent: boolean; opacity: number }, off?: TextureOffset): MeshStandardMaterial {
  // `userData.grain`: el render fa relleu i brillantor variable amb la veta (`sceneData`).
  if (finish.kind === "wood") {
    const m = new MeshStandardMaterial({ map: faceTexture(woodTexture(finish.species, finish.gen), uMm, vMm, rotate, woodGenOf(finish.species, finish.gen).tileMm, 1, off), roughness: 0.7, metalness: 0, ...opts })
    m.userData.grain = true
    return m
  }
  // Foto real del tauler: la mateixa escala que al tauler de debò (tileMm = amplada de la foto).
  // Amb mapes PBR (normal, rugositat): la mateixa repetició i gir que el color.
  if (finish.kind === "image") {
    // Veta vertical a la foto: es gira un quart més perquè vagi com la de la peça.
    const turn = finish.grain === "y" ? !rotate : rotate
    const tex = (src: string, linear: boolean) => faceTexture(photoTexture(src, finish.seamless, linear), uMm, vMm, turn, finish.tileMm, finish.aspect, off)
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
    return new MeshStandardMaterial({ map: faceTexture(patternTexture(finish.pattern, finish.color, finish.grout, finish.opts), uMm, vMm, false, finish.tileMm, 1, off), roughness: finish.roughness, metalness: finish.metalness ?? 0, ...opts })
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
  // Cada peça (i cada cara) amb la textura desplaçada a la seva manera (`textureOffset`).
  const off = (face: string) => textureOffset(`${p.id}${face}`)
  // Cares grans: u al llarg de x local (BoxGeometry), veta en x llevat que la peça la tingui en y.
  const big = (face: string) => makeMaterial(finish, L, W, grainY, opts, off(face))
  // Materials massissos (ferro, pedra, vidre, teixits de simulació): el cantell és el mateix material. Els components
  // dels jocs de ferratges (rol `hardware`: guies, laterals de doble paret) també, sigui quin sigui el nom del material
  // (el 3D els pinta pel nom, `resolveFinish`): si no, les cares llargues sortirien del color del tauler vist.
  const mat = materials.find((m) => m.name === p.material)
  // Fusta massissa (`MaterialPref.solid`): no es canteja i el cantell és la mateixa fusta, no el tauler vist.
  const solid = p.role === "hardware" || (!!mat && (materialCategory(mat) === "sim" || mat.cnc === false || !!mat.solid))
  const raw = (face: string) => (solid ? makeMaterial(finish, L, T, false, opts, off(face)) : new MeshStandardMaterial({ color: RAW_EDGE_COLOR, roughness: 0.95, metalness: 0, ...opts }))
  // +x / −x: cara T × W (u = gruix, v = amplada): la veta ha d'anar en v.
  const edgeX = (banded: boolean, face: string) => (banded ? makeMaterial(edgeFinish, T, W, true, opts, off(face)) : raw(face))
  // +y / −y: cara L × T (u = llargada): la veta va en u.
  const edgeY = (banded: boolean, face: string) => (banded ? makeMaterial(edgeFinish, L, T, false, opts, off(face)) : raw(face))
  const out = [edgeX(p.edges.right, "#r"), edgeX(p.edges.left, "#l"), edgeY(p.edges.top, "#t"), edgeY(p.edges.bottom, "#b"), big(""), big("#B")]
  // Electrodomèstic (v46): la foto a la cara vista (+z, la de davant, L × W; +y, la de dalt d'una placa, L × T), sencera i
  // centrada sobre el color del cos (el material de l'aparell: `photoFaceTexture`).
  if (p.photo) {
    const top = p.photo.face === "top"
    const i = top ? 2 : 4
    disposeMaterial(out[i]!)
    out[i] = new MeshStandardMaterial({ map: photoFaceTexture(p.photo.src, L, top ? T : W, finish), roughness: 0.45, metalness: 0, ...opts })
  }
  return out
}

/** Materials per a la geometria extruïda (`shapedGeometry`): [0] cares (A/B), [1] cantells amb cantell, [2] sense (talls i parets dels forats). UV en metres. */
export function cutoutMaterials(p: Panel, mode: "material" | "role", materials: MaterialPref[], dimmed: boolean): MeshStandardMaterial[] {
  const opts = { transparent: dimmed, opacity: dimmed ? 0.45 : 1 }
  if (mode === "role") {
    const m = new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85, metalness: 0, ...opts })
    return [m, m, m, new MeshStandardMaterial({ color: HOLE_WALL_COLOR, roughness: 1, metalness: 0, ...opts })]
  }
  // UV en metres: 1000 mm per unitat de textura.
  const finish = resolveFinish(materials, p.material)
  const face = makeMaterial(finish, 1000, 1000, p.grain === "y", opts, textureOffset(p.id))
  const edge = makeMaterial(resolveEdgeFinish(materials, p.material), 1000, 1000, false, opts, textureOffset(`${p.id}#e`))
  // Sense cantell: el tauler vist (com `panelMaterials`) o, als massissos, el mateix material.
  const mat = materials.find((m) => m.name === p.material)
  const solid = p.role === "hardware" || (!!mat && (materialCategory(mat) === "sim" || mat.cnc === false || !!mat.solid))
  const raw = solid ? makeMaterial(finish, 1000, 1000, false, opts, textureOffset(`${p.id}#r`)) : new MeshStandardMaterial({ color: RAW_EDGE_COLOR, roughness: 0.95, metalness: 0, ...opts })
  // Les parets dels forats i les ranures buidats (`carvedPanel`, Modelatge): fosques, com dins d'un forat.
  const hole = new MeshStandardMaterial({ color: HOLE_WALL_COLOR, roughness: 1, metalness: 0, ...opts })
  return [face, edge, raw, hole]
}

/** El color de dins d'un forat o d'una ranura buidats al 3D. */
const HOLE_WALL_COLOR = "#8f887d"

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

/**
 * Tot el que fa canviar com es dibuixa una peça (geometria, materials, veta, cantells, forats, ferratges), sense la
 * col·locació: si no canvia, el visor no refà els recursos de la GPU de la peça (editar un mòdul no refà les dels
 * altres). L'`id` hi és perquè la textura es desplaça per peça (`textureOffset`). Els forats, només si es dibuixen
 * (`holes`: marques dels forats o ferratges, que fan servir les cassoletes).
 */
export function panelVisualKey(p: Panel, holes: boolean): string {
  return JSON.stringify([p.id, p.role, p.length, p.width, p.thickness, p.material, p.grain, p.edges, p.outline, p.rawSides, p.cutouts, p.mitres, p.solidCuts, p.pockets?.map(pocketKey) ?? null, p.grooves, p.push, p.photo ?? null, holes ? p.holes : null, holes ? p.fittings ?? null : null])
}
