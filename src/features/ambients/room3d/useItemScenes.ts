import { useEffect, useMemo, useRef, useState } from "react"
import { Group, type Mesh, type Object3D } from "three"
import { exportablePanel } from "../../../components/viewer/exportablePanel"
import { buildScene } from "../../../components/viewer/exportGlb"
import { genericLegsGroup } from "../../../components/viewer/genericLegs"
import { onModelsLoaded } from "../../../components/viewer/models3d"
import { disposeTree } from "../../../components/viewer/textures"
import { rad, type Ambient, type MaterialPref } from "../../../core/model"
import type { ItemGeometry } from "../ambientData"

const shadowsOn = (o: Object3D) =>
  o.traverse((c) => {
    if ((c as Mesh).isMesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })

/** Les escenes dels elements (mobles i blocs), al seu lloc: es refan només si en canvia la geometria o els materials. */
export function useItemScenes({ items, geos, materials }: { items: Ambient["items"]; geos: Map<string, ItemGeometry | null>; materials: MaterialPref[] }) {
  // Mobles i blocs: la seva escena (m) centrada a la petjada, al seu lloc i girada. Les peces d'un element
  // només es refan si en canvia la geometria o els materials: moure'l (arrossegar-lo) només en canvia la
  // posició. Les que ja no hi són s'alliberen (memòria gràfica: a l'iPhone compta).
  const built = useRef(new Map<string, { geo: ItemGeometry; materials: MaterialPref[]; ver: number; obj: Group }>())
  // Models 3D (plantes…): es carreguen a part; quan n'arriba un, es refan els elements que en porten.
  const [modelsVer, setModelsVer] = useState(0)
  useEffect(() => onModelsLoaded(() => setModelsVer((v) => v + 1)), [])
  const scenes = useMemo(() => {
    const prev = built.current
    const next = new Map<string, { geo: ItemGeometry; materials: MaterialPref[]; ver: number; obj: Group }>()
    const out: { id: string; obj: Group }[] = []
    for (const it of items) {
      const g = geos.get(it.id)
      if (!g) continue
      let entry = prev.get(it.id)
      const ver = g.build.models.length ? modelsVer : 0
      if (!entry || entry.geo !== g || entry.materials !== materials || entry.ver !== ver) {
        const inner = buildScene([...g.build.panels, ...g.build.extras], it.id, { materials, make: exportablePanel, hardware: true }, g.build.models)
        const legs = genericLegsGroup(g.comp, g.build)
        if (legs) inner.add(legs)
        inner.position.set(-(g.min[0] + g.max[0]) / 2000, 0, -(g.min[2] + g.max[2]) / 2000)
        shadowsOn(inner)
        const outer = new Group()
        outer.add(inner)
        entry = { geo: g, materials, ver, obj: outer }
      }
      entry.obj.position.set(it.x / 1000, (it.elevation ?? 0) / 1000, it.y / 1000)
      entry.obj.rotation.y = -rad(it.rot)
      next.set(it.id, entry)
      out.push({ id: it.id, obj: entry.obj })
    }
    for (const [id, e] of prev) if (next.get(id)?.obj !== e.obj) disposeTree(e.obj)
    built.current = next
    return out
  }, [items, geos, materials, modelsVer])
  useEffect(() => () => {
    for (const e of built.current.values()) disposeTree(e.obj)
    built.current = new Map()
  }, [])
  return scenes
}
