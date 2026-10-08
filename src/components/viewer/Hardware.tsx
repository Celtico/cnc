import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useState } from "react"
import { Box3, MeshStandardMaterial, Vector3 } from "three"
import { BoxFrame } from "./BoxFrame"
import { useViewerCursor } from "./cursor"
import type { Hole, Panel, PanelFitting } from "../../core/model"
import { builtinHardwareGroup, fittingMatrix } from "./hardwareShapes"
import { loadedModel, loadModel, onModelsLoaded } from "./models3d"

/**
 * Ferratges al 3D (només visuals, no es fabriquen): frontisses, tiradors i potes, perquè
 * les portes i els mòduls no semblin flotar. Coordenades locals de la peça (mm × S), com
 * `PanelMesh`: així segueixen la porta quan s'obre i la vista explosionada.
 */
const S = 0.001
const METAL = new MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.85, roughness: 0.3 })
const DARK = new MeshStandardMaterial({ color: "#2f3033", metalness: 0.4, roughness: 0.5 })
// Compartits per totes les peces: no s'alliberen amb una peça (`disposeMaterial`).
METAL.userData.shared = DARK.userData.shared = true

/** Tirador de barra: llarg `len` mm, paral·lel a x local, centrat a (cx, cy), cap a `dir` (±z). */
function BarHandle({ cx, cy, z, dir, len, vertical }: { cx: number; cy: number; z: number; dir: 1 | -1; len: number; vertical: boolean }) {
  const standoff = 28
  const r = 6
  const rot: [number, number, number] = vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]
  // Barra: cilindre al llarg de y (vertical) o de x (horitzontal) a `standoff` de la cara.
  const zc = (z + dir * standoff) * S
  const feet = [-(len / 2 - 12), len / 2 - 12]
  return (
    <group position={[cx * S, cy * S, 0]}>
      <mesh position={[0, 0, zc]} rotation={vertical ? [0, 0, 0] : rot} material={METAL} castShadow>
        <cylinderGeometry args={[r * S, r * S, len * S, 16]} />
      </mesh>
      {feet.map((f, i) => (
        <mesh key={i} position={[vertical ? 0 : f * S, vertical ? f * S : 0, (z + (dir * standoff) / 2) * S]} rotation={[Math.PI / 2, 0, 0]} material={METAL}>
          <cylinderGeometry args={[4 * S, 4 * S, standoff * S, 10]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Els ferratges d'una peça al visor: el dibuix 3D dels de sèrie (`builtinHardwareGroup`: frontisses, guies, espigues,
 * suports de prestatge —`pins`—, braços, imants, push, suports de la barra, perfil LED; només visuals, fora del render)
 * i, als fronts, el tirador de barra genèric.
 */
export function PanelHardware({ panel, pins }: { panel: Panel; pins?: readonly Hole[] }) {
  const builtin = useMemo(() => builtinHardwareGroup(panel, pins), [panel, pins])
  return (
    <>
      {/* Geometries i materials compartits: r3f no els ha d'alliberar en desmuntar-se. */}
      {builtin && <primitive object={builtin} dispose={null} />}
      <FrontHandle panel={panel} />
    </>
  )
}

/** El tirador de barra genèric d'un front (cap si és push o si porta un tirador importat). */
function FrontHandle({ panel }: { panel: Panel }) {
  const hw = useMemo(() => {
    const isFront = panel.role === "door" || panel.role === "drawerFront" || panel.role === "flap"
    if (!isFront) return null
    const L = panel.length
    const W = panel.width
    const T = panel.thickness
    const cups = panel.holes.filter((h) => h.tag === "hinge")
    // Cara de dins: la de les cassoletes (A, z = T); el tirador va a l'altra (fora).
    const inner = cups[0]?.face === "B" ? 0 : T
    const outDir: 1 | -1 = inner === T ? -1 : 1
    const outZ = inner === T ? 0 : T
    // Cantell de les frontisses: el costat on són les cassoletes.
    let handle: { cx: number; cy: number; vertical: boolean; len: number }
    // Els forats del tirador (talls Ø5 «handle») diuen on va i la seva mida.
    const hh = (panel.cutouts ?? []).filter((c): c is Extract<typeof c, { kind: "circle" }> => c.kind === "circle" && c.tag === "handle")
    if (hh.length === 2) {
      const [a, b] = hh as [(typeof hh)[number], (typeof hh)[number]]
      const vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x)
      handle = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vertical, len: Math.hypot(a.x - b.x, a.y - b.y) + 40 }
    } else if (cups.length) {
      const mx = cups.reduce((a, h) => a + h.x, 0) / cups.length
      const my = cups.reduce((a, h) => a + h.y, 0) / cups.length
      const alongX = Math.abs(my - W / 2) / W > Math.abs(mx - L / 2) / L // frontisses a y ≈ 0 o W
      const len = Math.min(192, (alongX ? L : W) * 0.4)
      handle = alongX
        ? { cx: L / 2, cy: my < W / 2 ? W - 45 : 45, vertical: false, len }
        : { cx: mx < L / 2 ? L - 45 : 45, cy: W / 2, vertical: true, len }
    } else {
      // Calaix: tirador centrat, al llarg del costat llarg.
      handle = { cx: L / 2, cy: W / 2, vertical: false, len: Math.min(192, L * 0.4) }
    }
    return { outDir, outZ, handle }
  }, [panel])
  if (!hw) return null
  const { outDir, outZ, handle } = hw
  // Un tirador importat es dibuixa amb el seu model (`PanelFittings`): cap barra genèrica.
  const ownHandle = (panel.fittings ?? []).some((f) => f.kind === "handle")
  if (panel.push || ownHandle) return null
  return <BarHandle cx={handle.cx} cy={handle.cy} z={outZ} dir={outDir} len={handle.len} vertical={handle.vertical} />
}

/** La caixa d'un ferratge sense model: opaca (un ferratge mai es dibuixa translúcid, ni triat ni dins d'un mòdul translúcid). */
const GHOST = new MeshStandardMaterial({ color: "#a9adb3", metalness: 0.5, roughness: 0.5 })
GHOST.userData.shared = true

type V3 = [number, number, number]
/** Marge de la zona per clicar un ferratge col·locat (unitats de l'escena: 8 mm). */
const PICK_PAD = 0.008

/** Un ferratge importat: el seu model (GLB de Dexie) o, mentre no hi és, la caixa. */
function Fitting({ f, thickness, model = true, selected = false, onSelect }: { f: PanelFitting; thickness: number; model?: boolean; selected?: boolean; onSelect?: (id: string) => void }) {
  const [, setTick] = useState(0)
  const [hover, setHover] = useState(false)
  const cursor = useViewerCursor()
  useEffect(() => {
    if (!f.asset || !model) return
    void loadModel(f.asset)
    return onModelsLoaded(() => setTick((t) => t + 1))
  }, [f.asset, model])
  const l = f.asset && model ? loadedModel(f.asset) : null
  // La còpia del model i la seva caixa al marc del ferratge (per al contorn de selecció si el fitxer no en porta).
  const own = useMemo(() => {
    if (!l) return null
    const obj = l.root.clone(true)
    obj.updateMatrixWorld(true)
    const box = new Box3().setFromObject(obj)
    return { obj, box: box.isEmpty() ? null : box }
  }, [l])
  const m = useMemo(() => fittingMatrix(f, thickness), [f, thickness])
  const b = f.bbox
  // Caixa per al contorn i la barra (unitats de l'escena): la del fitxer, si no la del model.
  const frame = useMemo((): { c: V3; s: V3 } | null => {
    if (b) return { c: [((b.min[0] + b.max[0]) / 2) * S, ((b.min[1] + b.max[1]) / 2) * S, ((b.min[2] + b.max[2]) / 2) * S], s: [(b.max[0] - b.min[0]) * S, (b.max[1] - b.min[1]) * S, (b.max[2] - b.min[2]) * S] }
    const bx = own?.box
    if (!bx) return null
    const c = bx.getCenter(new Vector3()), sz = bx.getSize(new Vector3())
    return { c: [c.x, c.y, c.z], s: [sz.x, sz.y, sz.z] }
  }, [b, own])
  const id = f.placement
  // Clic i ratolí a sobre: només els col·locats a mà (els de les regles són del mòdul).
  const pick = id && onSelect
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return
          e.stopPropagation()
          onSelect(id)
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          if (e.pointerType !== "mouse") return
          e.stopPropagation()
          setHover(true)
          cursor.hover("pointer")
        },
        onPointerOut: () => {
          setHover(false)
          cursor.hover(null)
        },
      }
    : {}
  return (
    <group matrix={m} matrixAutoUpdate={false}>
      {model && (own ? (
        <primitive object={own.obj} />
      ) : b ? (
        <mesh position={frame!.c} material={GHOST}>
          <boxGeometry args={frame!.s} />
        </mesh>
      ) : null)}
      {/* Zona per clicar-lo: la seva caixa sencera i una mica més (un ferratge és petit; el model pot tenir forats). */}
      {model && id && onSelect && frame && (
        <mesh position={frame.c} visible={false} {...pick}>
          <boxGeometry args={[frame.s[0] + PICK_PAD, frame.s[1] + PICK_PAD, frame.s[2] + PICK_PAD]} />
        </mesh>
      )}
      {/* Triat o amb el ratolí a sobre: només el contorn (el model es queda opac, tal com és). */}
      {frame && (selected || (hover && model)) && (
        <group position={frame.c}>
          <BoxFrame w={frame.s[0] + 0.004} h={frame.s[1] + 0.004} d={frame.s[2] + 0.004} strong={selected} />
        </group>
      )}
    </group>
  )
}

/**
 * Ferratges importats d'un fabricant (frontisses a la porta, plaques al lateral, `Panel.fittings`) i els col·locats a mà
 * (`kind: "item"`, amb l'id del col·locat): el GLB fet en importar (ja al marc de muntatge), al seu lloc i girat amb la
 * peça (porta oberta, explosionat: van dins del grup de la peça). Si el model no hi és, la caixa. Només visual. Un
 * col·locat es tria clicant-lo (`onSelect`): contorn en passar-hi per sobre i, triat, contorn gruixut; s'edita a
 * l'inspector (cap barra flotant al 3D). Amb «Ferratges» amagat (`models` fals) només es dibuixa el triat (sencer).
 */
export function PanelFittings({ panel, models = true, selected, onSelect }: { panel: Panel; models?: boolean; selected?: string | null; onSelect?: (id: string) => void }) {
  if (!panel.fittings?.length) return null
  return (
    <group>
      {panel.fittings.map((f, i) =>
        // El triat es veu sempre sencer (el model, opac), també amb «Ferratges» amagat: si no, només en quedaria el contorn.
        models || (selected && f.placement === selected) ? <Fitting key={i} f={f} thickness={panel.thickness} model={models || f.placement === selected} selected={!!selected && f.placement === selected} onSelect={onSelect} /> : null,
      )}
    </group>
  )
}

/** Potes regulables sota un mòdul (coordenades de la composició, mm). */
export function ModuleLegs({ x, z, width, depth, height, inset = 50 }: { x: number; z: number; width: number; depth: number; height: number; inset?: number }) {
  const pts: [number, number][] = [
    [x + inset, z + inset],
    [x + width - inset, z + inset],
    [x + inset, z + depth - inset],
    [x + width - inset, z + depth - inset],
  ]
  return (
    <group>
      {pts.map(([px, pz], i) => (
        <group key={i} position={[px * S, 0, pz * S]}>
          <mesh position={[0, (height / 2) * S, 0]} material={DARK} castShadow>
            <cylinderGeometry args={[14 * S, 14 * S, height * S, 16]} />
          </mesh>
          <mesh position={[0, 4 * S, 0]} material={DARK}>
            <cylinderGeometry args={[22 * S, 24 * S, 8 * S, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
