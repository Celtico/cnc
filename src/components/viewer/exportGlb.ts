import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import type { Panel, PanelRole } from "../../core/model"

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
}

/** Escena three.js en METRES (per a AR / visors GLB) a partir de les peces. */
export function buildScene(panels: Panel[], name: string): Scene {
  const scene = new Scene()
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

    const geo = new BoxGeometry(p.length / 1000, p.width / 1000, p.thickness / 1000)
    geo.translate(p.length / 2000, p.width / 2000, p.thickness / 2000)
    const mesh = new Mesh(geo, new MeshStandardMaterial({ color: ROLE_COLOR[p.role], roughness: 0.85 }))
    mesh.name = p.id
    holder.add(mesh)
    root.add(holder)
  }
  return scene
}

/** GLB binari (ArrayBuffer) del moble en metres. */
export async function exportGlb(panels: Panel[], name: string): Promise<Blob> {
  const scene = buildScene(panels, name)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true })
  if (result instanceof ArrayBuffer) return new Blob([result], { type: "model/gltf-binary" })
  return new Blob([JSON.stringify(result)], { type: "model/gltf+json" })
}
