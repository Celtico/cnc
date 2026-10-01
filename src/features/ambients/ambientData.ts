import { useMemo } from "react"
import { buildBounds, buildComposition, panelBox, type CompositionBuild } from "../../core/build/buildComposition"
import { blockComposition, type AmbientItem, type BlockItem } from "../../core/model"
import type { Composition } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import type { Project } from "../../db/db"

/** Rectangle de vista de dalt (mm), relatiu al centre de la petjada. */
export interface TopRect {
  x0: number
  z0: number
  x1: number
  z1: number
  /** Peça sense nesting (bloc, ferro, pedra…) o del moble. */
  extra: boolean
}

/**
 * Geometria d'un element de l'ambient: la composició construïda, la caixa (mm), la petjada
 * (w × d) i els rectangles de cada peça vistos des de dalt (per dibuixar-lo al plànol).
 */
export interface ItemGeometry {
  comp: Composition
  build: CompositionBuild
  min: [number, number, number]
  max: [number, number, number]
  w: number
  h: number
  d: number
  rects: TopRect[]
}

export function itemGeometry(comp: Composition): ItemGeometry {
  const build = buildComposition(comp)
  const { min, max } = buildBounds(build)
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2
  const rect = (extra: boolean) => (p: CompositionBuild["panels"][number]): TopRect => {
    const b = panelBox(p)
    return { x0: b.min[0] - cx, z0: b.min[2] - cz, x1: b.max[0] - cx, z1: b.max[2] - cz, extra }
  }
  return {
    comp,
    build,
    min: [...min] as [number, number, number],
    max: [...max] as [number, number, number],
    w: max[0] - min[0],
    h: max[1] - min[1],
    d: max[2] - min[2],
    // Els models 3D (plantes…), amb la seva caixa.
    rects: [...build.panels.map(rect(false)), ...build.extras.map(rect(true)), ...build.models.map((m) => ({ x0: m.x - cx, z0: m.z - cz, x1: m.x + m.w - cx, z1: m.z + m.d - cz, extra: true }))],
  }
}

const blockKey = (b: BlockItem) => `${b.shape}|${b.w}|${b.h}|${b.d}|${b.material}|${b.material2 ?? ""}|${b.name}`

/**
 * Geometria de tots els elements, memoritzada: la d'un moble es refà quan el moble canvia
 * (`updatedAt`), la d'un bloc quan en canvien la forma, les mides o el material.
 */
export function useItemGeometries(items: AmbientItem[], projects: Project[] | undefined): Map<string, ItemGeometry | null> {
  const cache = useMemo(() => new Map<string, { key: string; geo: ItemGeometry }>(), [])
  return useMemo(() => {
    const out = new Map<string, ItemGeometry | null>()
    const used = new Set<string>()
    for (const it of items) {
      let key: string
      let make: () => Composition
      if (it.kind === "moble") {
        const p = projects?.find((x) => x.id === it.projectId)
        if (!p) {
          out.set(it.id, null)
          continue
        }
        key = `m${p.id}:${p.updatedAt}`
        make = () => compositionOf(p)
      } else {
        key = blockKey(it)
        make = () => blockComposition(it)
      }
      used.add(key)
      const hit = cache.get(key)
      if (hit) out.set(it.id, hit.geo)
      else {
        const geo = itemGeometry(make())
        cache.set(key, { key, geo })
        out.set(it.id, geo)
      }
    }
    // Només es guarden les que es fan servir ara (cada canvi de mida o de moble en feia una de nova).
    for (const k of cache.keys()) if (!used.has(k)) cache.delete(k)
    return out
  }, [items, projects, cache])
}

/** Nom que es mostra d'un element. */
export function itemName(it: AmbientItem, projects: Project[] | undefined): string {
  if (it.kind === "block") return it.name
  return projects?.find((p) => p.id === it.projectId)?.name ?? "Element esborrat"
}
