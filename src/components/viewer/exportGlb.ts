import { builtinHardwareGroup } from "./hardwareShapes"
import { fixedSolids, shelfPins } from "../../core/build/hardwareSolids"
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  type BufferGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  type Material,
  type Texture,
  Vector3,
} from "three"
import { isShaped, mitreGeometry, shapedGeometry } from "./cutoutGeometry"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import type { MaterialPref, ModelObject, Panel, PanelRole } from "../../core/model"
import { modelInstance, preloadModels } from "./models3d"
import { disposeTree } from "./textures"

const ROLE_COLOR: Record<PanelRole, number> = {
  side: 0xe6cfa6,
  bottom: 0xe6cfa6,
  top: 0xe6cfa6,
  shelf: 0xefdcb8,
  door: 0xd6b076,
  back: 0xc9b79a,
  divider: 0xe6cfa6,
  fixedShelf: 0xe6cfa6,
  plinth: 0xb57a37,
  drawerFront: 0xd6b076,
  drawerSide: 0xefdcb8,
  drawerBack: 0xefdcb8,
  drawerBottom: 0xc9b79a,
  flap: 0xd6b076,
  grille: 0xd6b076,
  hatch: 0xd6b076,
  panel: 0xd6b076,
  worktop: 0xc6924f,
  spacer: 0xe6cfa6,
  facing: 0xe6cfa6,
  part: 0xd9b98a,
  hardware: 0x9aa0a6,
}

/**
 * Escena three.js en METRES (per a AR / visors GLB) a partir de les peces. Amb `real` (al
 * navegador): els materials i les textures del visor, i els tiradors; sense (tests, node):
 * colors per tipus de peça. `fitted`: qui la demana hi posa els ferratges importats (miniatures de Ferratges): els
 * fronts amb un tirador importat no porten la barra genèrica (com al visor).
 */
export function buildScene(panels: Panel[], name: string, real?: { materials: MaterialPref[]; make: (p: Panel, m: MaterialPref[]) => { geometry: BufferGeometry; material: MeshStandardMaterial[] }; fitted?: boolean; /** El dibuix 3D dels ferratges de sèrie i de les potes (`builtinHardwareGroup`): els ambients, perquè el render ho ensenyi tot. */ hardware?: boolean }, models: ModelObject[] = []): Scene {
  const scene = new Scene()
  const pins = real?.hardware ? shelfPins(panels) : undefined
  const fixed = real?.hardware ? fixedSolids(panels) : undefined
  scene.name = name
  const root = new Group()
  root.name = name
  scene.add(root)

  for (const p of panels) {
    const { origin, xAxis, yAxis, zAxis } = p.placement
    const m = new Matrix4().makeBasis(new Vector3(...xAxis), new Vector3(...yAxis), new Vector3(...zAxis))
    m.setPosition(origin[0] / 1000, origin[1] / 1000, origin[2] / 1000)

    const holder = new Group()
    holder.name = p.name
    holder.matrixAutoUpdate = false
    holder.matrix.copy(m)

    if (real) {
      const { geometry, material } = real.make(p, real.materials)
      const mesh = new Mesh(geometry, material)
      mesh.name = p.id
      // El render arrodoneix les arestes dels taulers (`sceneData`).
      mesh.userData.bevel = true
      holder.add(mesh)
      if (!(real.fitted && p.fittings?.some((f) => f.kind === "handle"))) for (const h of handleMeshes(p)) holder.add(h)
      if (real.hardware) {
        const hw = builtinHardwareGroup(p, pins?.get(p.id), fixed?.get(p.id))
        if (hw) holder.add(hw)
      }
      root.add(holder)
      continue
    }
    // Amb retalls (reixa, forats de taulell…): extrusió amb forats; si no, una caixa.
    const shaped = isShaped(p)
    const geo = shaped ? shapedGeometry(p) : p.mitres?.length ? mitreGeometry(p) : new BoxGeometry(p.length / 1000, p.width / 1000, p.thickness / 1000)
    if (!shaped && !p.mitres?.length) geo.translate(p.length / 2000, p.width / 2000, p.thickness / 2000)
    const mesh = new Mesh(geo, new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85 }))
    mesh.name = p.id
    holder.add(mesh)
    root.add(holder)
  }
  // Models 3D (plantes…): els que ja s'han carregat (`preloadModels` abans, si cal que hi siguin segur).
  for (const m of models) {
    const g = modelInstance(m, real?.materials)
    if (g) root.add(g)
  }
  return scene
}

const METAL = new MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.85, roughness: 0.3, name: "Inox" })
// El fan servir tots els tiradors de totes les escenes: `disposeMaterial` no l'allibera.
METAL.userData.shared = true

/** Tirador de barra als fronts (el mateix criteri que `PanelHardware` del visor), en m. */
function handleMeshes(p: Panel): Mesh[] {
  if ((p.role !== "door" && p.role !== "drawerFront" && p.role !== "flap") || p.push) return []
  const L = p.length, W = p.width, T = p.thickness
  const cups = p.holes.filter((h) => h.tag === "hinge")
  const inner = cups[0]?.face === "B" ? 0 : T
  const outZ = inner === T ? 0 : T
  const dir = inner === T ? -1 : 1
  let cx = L / 2, cy = W / 2, vertical = false
  let len = Math.min(192, L * 0.4)
  const hh = (p.cutouts ?? []).filter((c): c is Extract<typeof c, { kind: "circle" }> => c.kind === "circle" && c.tag === "handle")
  if (hh.length === 2) {
    const [a, b] = hh as [(typeof hh)[number], (typeof hh)[number]]
    vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x)
    cx = (a.x + b.x) / 2
    cy = (a.y + b.y) / 2
    len = Math.hypot(a.x - b.x, a.y - b.y) + 40
  } else if (cups.length) {
    const mx = cups.reduce((a, h) => a + h.x, 0) / cups.length
    const my = cups.reduce((a, h) => a + h.y, 0) / cups.length
    const alongX = Math.abs(my - W / 2) / W > Math.abs(mx - L / 2) / L
    len = Math.min(192, (alongX ? L : W) * 0.4)
    if (alongX) cy = my < W / 2 ? W - 45 : 45
    else {
      cx = mx < L / 2 ? L - 45 : 45
      vertical = true
    }
  }
  const k = 1 / 1000
  const bar = new Mesh(new CylinderGeometry(6 * k, 6 * k, len * k, 16), METAL)
  bar.position.set(cx * k, cy * k, (outZ + dir * 28) * k)
  if (!vertical) bar.rotation.z = Math.PI / 2
  const feet = [-(len / 2 - 12), len / 2 - 12].map((f) => {
    const m = new Mesh(new CylinderGeometry(4 * k, 4 * k, 28 * k, 10), METAL)
    m.position.set((vertical ? cx : cx + f) * k, (vertical ? cy + f : cy) * k, (outZ + dir * 14) * k)
    m.rotation.x = Math.PI / 2
    return m
  })
  return [bar, ...feet]
}

/** GLB binari (ArrayBuffer) del moble en metres, amb els models 3D (s'esperen carregats). */
export async function exportGlb(panels: Panel[], name: string, real?: Parameters<typeof buildScene>[2], models: ModelObject[] = []): Promise<Blob> {
  await preloadModels(models)
  const scene = buildScene(panels, name, real, models)
  bakeTextureCenters(scene)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true }).finally(() => disposeTree(scene))
  if (result instanceof ArrayBuffer) return new Blob([result], { type: "model/gltf-binary" })
  return new Blob([JSON.stringify(result)], { type: "model/gltf+json" })
}

/**
 * `KHR_texture_transform` no té `center` (gira i escala des de l'origen de les UV): es passa a l'`offset` perquè la
 * matriu UV sigui la mateixa, offset' = offset + c − M·c (M = escala i gir de three), i el centre queda a 0.
 * Només per exportar, sobre les textures pròpies de l'escena exportada (els clons de `faceTexture`; els models 3D
 * comparteixen les seves amb el visor i no es toquen).
 */
export function bakeTextureCenter(t: Texture): void {
  const cx = t.center.x, cy = t.center.y
  if (!cx && !cy) return
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation)
  const sx = t.repeat.x, sy = t.repeat.y
  t.offset.set(t.offset.x + cx - (sx * c * cx + sx * s * cy), t.offset.y + cy - (-sy * s * cx + sy * c * cy))
  t.center.set(0, 0)
  t.updateMatrix()
}

function bakeTextureCenters(scene: Scene): void {
  scene.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || m.userData.sharedModel) return
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[])
      for (const v of Object.values(mat)) if ((v as Texture | null)?.isTexture) bakeTextureCenter(v as Texture)
  })
}
