import type { ThreeEvent } from "@react-three/fiber"
import { Edges } from "@react-three/drei"
import { memo, useEffect, useMemo, useRef } from "react"
import { Matrix4, Vector3, type Group, type Material } from "three"
import type { HwSolid } from "../../../core/build/hardwareSolids"
import type { Hole, MaterialPref, Panel } from "../../../core/model"
import { useKeyed } from "../../../lib/useKeyed"
import { edgeSourceGeometry, isShaped, mitreGeometry, shapedGeometry } from "../cutoutGeometry"
import { cutoutMaterials, panelMaterials, panelVisualKey, visualPanel } from "../exportablePanel"
import { PanelFittings, PanelHardware } from "../Hardware"
import { disposeMaterial } from "../textures"
import { EXPLODE_MM, S } from "./constants"
import { HoleMarks, PROPOSED_MAT } from "./HoleMarks"
import { useExplode } from "./anim"

const BEVEL_USERDATA = { bevel: true }

interface PanelMeshProps {
  /**
   * Signatura visual de la peça (`panelVisualKey`) i col·locació (JSON): si no canvien (i la resta de props tampoc),
   * la peça no es torna a dibuixar ni refà la geometria i els materials. Sense, es calcula aquí.
   */
  sig?: string
  place?: string
  /** El ratolí entra o surt de la peça (ressaltat del mòdul en passar-hi per sobre). Estable: la peça va com a dada. */
  onHover?: (panel: Panel, on: boolean, point?: Vector3) => void
  /** Ferratges visuals de la peça (frontisses i tirador als fronts, guies, espigues, suports…). */
  hardware?: boolean
  /** Forats de la filera System 32 de la peça amb un suport de prestatge (`shelfPins`), per al dibuix dels ferratges. */
  pins?: readonly Hole[]
  fixed?: readonly HwSolid[]
  /**
   * Fusta translúcida («Com va muntat» de Preferències › Ferratges, i Opcions de vista › Opacitat del visor): la peça es
   * veu a través (opacitat 0,4 amb `true` o la que es doni, sense escriure la profunditat) i el ferratge, opac, és el
   * protagonista. Els forats es continuen veient.
   */
  seeThrough?: boolean | number
  /** Vista en línies (les vistes ortogràfiques): el perfil més fosc, perquè es llegeixi sobre les peces gairebé transparents. */
  wire?: boolean
  /**
   * Forats amb aquestes etiquetes d'un altre color: els proposats d'un ferratge importat sense confirmar (Preferències ›
   * Ferratges, el muntatge), que el moble encara no fa.
   */
  proposedTags?: readonly string[]
  panel: Panel
  exploded: boolean
  showHoles: boolean
  /** Perfil de les arestes (no en mode presentació). */
  edges?: boolean
  /** Peça del mòdul seleccionat: translúcida, per veure'n l'interior. */
  dimmed?: boolean
  materialMode: "material" | "role"
  materials: MaterialPref[]
  /** Clic a la peça, amb el punt tocat (coordenades del món, m). Estable: la peça va com a dada. */
  onClick?: (panel: Panel, point: Vector3) => void
  /** El ferratge col·locat triat, si és d'aquesta peça (contorn). */
  selectedFitting?: string | null
  /** Clic a un ferratge col·locat (id del col·locat). Estable. */
  onSelectFitting?: (id: string) => void
}

/** Les mateixes props: per signatura si n'hi ha (la peça és un objecte nou a cada construcció), si no per referència. */
const samePanelProps = (a: PanelMeshProps, b: PanelMeshProps) =>
  (a.sig !== undefined ? a.sig === b.sig && a.place === b.place : a.panel === b.panel) &&
  a.exploded === b.exploded &&
  a.showHoles === b.showHoles &&
  a.dimmed === b.dimmed &&
  a.edges === b.edges &&
  a.hardware === b.hardware &&
  a.pins === b.pins &&
  a.seeThrough === b.seeThrough &&
  a.wire === b.wire &&
  a.proposedTags === b.proposedTags &&
  a.materialMode === b.materialMode &&
  a.materials === b.materials &&
  a.onClick === b.onClick &&
  a.onHover === b.onHover &&
  a.selectedFitting === b.selectedFitting &&
  a.onSelectFitting === b.onSelectFitting

/** Peça del moble al visor (també a la foto realista). Només es torna a pintar si canvia el que es veu (`samePanelProps`). */
export const PanelMesh = memo(function PanelMesh({
  panel,
  sig: givenSig,
  exploded,
  showHoles,
  dimmed = false,
  materialMode,
  materials,
  onClick,
  onHover,
  edges = true,
  hardware = false,
  pins,
  fixed,
  seeThrough = false,
  wire = false,
  proposedTags,
  selectedFitting,
  onSelectFitting,
}: PanelMeshProps) {
  const group = useRef<Group>(null)
  const ownSig = useMemo(() => (givenSig === undefined ? panelVisualKey(panel, showHoles || hardware) : ""), [givenSig, panel, showHoles, hardware])
  const sig = givenSig ?? ownSig
  // La peça que es dibuixa: la mateixa mentre la signatura no canviï (una construcció nova la torna a fer igual).
  const vpanel = useKeyed(panel, sig)

  const { matrix, explode } = useMemo(() => {
    const { origin, xAxis, yAxis, zAxis, explodeDir } = panel.placement
    const m = new Matrix4().makeBasis(new Vector3(...xAxis), new Vector3(...yAxis), new Vector3(...zAxis))
    m.setPosition(origin[0] * S, origin[1] * S, origin[2] * S)
    return { matrix: m, explode: new Vector3(...explodeDir).multiplyScalar(EXPLODE_MM * S) }
  }, [panel.placement])

  const see = seeThrough === true ? SEE_THROUGH_OPACITY : typeof seeThrough === "number" && seeThrough < 1 ? seeThrough : undefined
  const mats = useMemo(() => veil(panelMaterials(vpanel, materialMode, materials, dimmed || see !== undefined), see), [vpanel, materialMode, materials, dimmed, see])
  // Peces amb talls passants (reixetes, taulell amb pica i vitro, passacables): geometria
  // extruïda amb els forats de debò, perquè es vegi a través.
  // Peces a inglet (sense talls): secció en trapezi, perquè la cantonada es vegi a 45°.
  // Els forats dels tiradors no es buiden al 3D (els tapa el tirador): així una peça a inglet
  // amb tirador continua sent un prisma a 45°.
  const vis = useMemo(() => visualPanel(vpanel), [vpanel])
  const cut = useMemo(() => (isShaped(vis) ? shapedGeometry(vis) : vis.mitres?.length ? mitreGeometry(vis) : null), [vis])
  const edgeGeo = useMemo(() => (edges ? edgeSourceGeometry(vis) : null), [vis, edges])
  useEffect(() => () => edgeGeo?.dispose(), [edgeGeo])
  const cutMats = useMemo(() => {
    if (!cut) return null
    const m = veil(cutoutMaterials(vpanel, materialMode, materials, dimmed || see !== undefined), see)
    // A la geometria d'inglet els grups van al revés: [0] puntes (cantell), [1] cares.
    return isShaped(vis) ? m : [m[1]!, m[0]!]
  }, [cut, vpanel, vis, materialMode, materials, dimmed, see])
  useEffect(
    () => () => {
      cut?.dispose()
      for (const m of cutMats ?? []) disposeMaterial(m)
    },
    [cut, cutMats],
  )
  useEffect(
    () => () => {
      for (const m of new Set(mats)) disposeMaterial(m)
    },
    [mats],
  )

  useExplode(group, exploded, explode)

  const L = vpanel.length * S
  const W = vpanel.width * S
  const T = vpanel.thickness * S

  return (
    <group ref={group}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        <mesh
          position={cut ? [0, 0, 0] : [L / 2, W / 2, T / 2]}
          castShadow
          receiveShadow
          material={cut && cutMats ? cutMats : mats}
          geometry={cut ?? undefined}
          // El render arrodoneix les arestes dels taulers (`sceneData`).
          userData={BEVEL_USERDATA}
          onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
            // El clic que acaba un arrossegament (d'una fletxa o de la càmera) no selecciona.
            if (e.delta > 4) return
            e.stopPropagation()
            onClick(panel, e.point)
          } : undefined}
          onPointerOver={onHover ? (e: ThreeEvent<PointerEvent>) => {
            if (e.pointerType !== "mouse") return
            e.stopPropagation()
            onHover(panel, true, e.point)
          } : undefined}
          // Dins d'un mòdul triat, el compartiment de sota el ratolí canvia sense sortir de la peça.
          onPointerMove={onHover ? (e: ThreeEvent<PointerEvent>) => {
            if (e.pointerType !== "mouse") return
            e.stopPropagation()
            onHover(panel, true, e.point)
          } : undefined}
          onPointerOut={onHover ? () => onHover(panel, false) : undefined}
        >
          {!cut && <boxGeometry args={[L, W, T]} />}
          {edges && <Edges color={wire ? "#2b2418" : dimmed || see !== undefined ? "#a08a6a" : "#6b5a3e"} threshold={15} {...(edgeGeo ? { geometry: edgeGeo } : {})} />}
        </mesh>
        {showHoles && vpanel.holes.length > 0 && (proposedTags?.length ? (
          <>
            <HoleMarks holes={vpanel.holes.filter((h) => !h.tag || !proposedTags.includes(h.tag))} thickness={T} />
            <HoleMarks holes={vpanel.holes.filter((h) => !!h.tag && proposedTags.includes(h.tag))} thickness={T} material={PROPOSED_MAT} />
          </>
        ) : (
          <HoleMarks holes={vpanel.holes} thickness={T} />
        ))}
        {hardware && <PanelHardware panel={vpanel} pins={pins} fixed={fixed} />}
        {(hardware || selectedFitting) && <PanelFittings panel={vpanel} models={hardware} selected={selectedFitting} onSelect={onSelectFitting} />}
        {vpanel.grooves.map((g, i) => (
          <mesh key={`g${i}`} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, g.face === "A" ? T - (g.depth * S) / 2 + 0.0002 : (g.depth * S) / 2 - 0.0002]}>
            <boxGeometry args={[g.w * S, g.h * S, g.depth * S]} />
            <meshStandardMaterial color="#8a7150" roughness={1} />
          </mesh>
        ))}

      </group>
    </group>
  )
}, samePanelProps)

/** Opacitat de les peces a la vista en línies (vistes ortogràfiques). */
export const WIRE_OPACITY = 0.12

/** Opacitat de la fusta translúcida (`seeThrough`). */
const SEE_THROUGH_OPACITY = 0.4

/**
 * Fusta translúcida (`seeThrough`): els materials de la peça (ja transparents, `panelMaterials(…, true)`) a
 * `SEE_THROUGH_OPACITY` i sense escriure la profunditat, perquè el ferratge (opac) es vegi sencer a través. Els
 * materials són propis de la peça (es fan per a ella), així que es poden tocar.
 */
function veil<T extends Material>(mats: T[], opacity: number | undefined): T[] {
  if (opacity !== undefined)
    for (const m of mats) {
      if (m.userData.shared) continue
      m.transparent = true
      m.opacity = Math.min(m.opacity, opacity)
      // El render la conserva (`sceneData`: no és un fantasma, és fusta translúcida).
      m.userData.seeThrough = true
      m.depthWrite = false
    }
  return mats
}
